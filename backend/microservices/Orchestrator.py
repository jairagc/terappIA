import os
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Form
from pydantic import BaseModel
import httpx
import json

# ──────────────────────────────────────────────────────────────────────────────
# URLs de los microservicios
PHOTO_URL   = os.getenv("PHOTO_SERVICE_URL", "http://127.0.0.1:9003/photos")
OCR_URL = os.getenv("ORC_OCR_URL", "http://localhost:8002/ocr")
ANALYSIS_URL = os.getenv("ORC_ANALYSIS_URL", "http://localhost:8001/analizar_emociones")

# Timeouts
CONNECT_TIMEOUT = float(os.getenv("ORC_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT = float(os.getenv("ORC_READ_TIMEOUT", "60"))

# Raíz de almacenamiento local
DATA_ROOT = os.getenv("ORC_DATA_ROOT", "data_local")

# Subcarpetas
DIR_OCR = "pruebas_ocr"
DIR_ANALYSIS = "pruebas_analisis"
DIR_FOTOS = "fotos"

# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Orquestador HTTP OCR → Análisis (con almacenamiento por usuario)")

class OrquestacionRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    foto_guardada: Optional[str]
    foto_url: Optional[str]           # ← NUEVO: URL devuelta por Photo Service
    ocr: Dict[str, Any]
    analisis: Dict[str, Any]

# ──────────────────────────────────────────────────────────────────────────────
def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def ensure_user_dirs(user_id: Optional[str]) -> Dict[str, str]:
    """
    Crea (si no existen) las carpetas del usuario:
      data_local/<user_id|_public>/{pruebas_ocr, pruebas_analisis, fotos}
    Devuelve paths absolutos.
    """
    base = os.path.join(DATA_ROOT, user_id if user_id else "_public")
    paths = {
        "base": base,
        "ocr": os.path.join(base, DIR_OCR),
        "analysis": os.path.join(base, DIR_ANALYSIS),
        "fotos": os.path.join(base, DIR_FOTOS),
    }
    for p in paths.values():
        os.makedirs(p, exist_ok=True)
    return paths

def save_uploaded_photo(file: UploadFile, file_bytes: bytes, fotos_dir: str) -> str:
    """
    Guarda la foto recibida en fotos/ con timestamp y devuelve ruta relativa.
    """
    original = file.filename or "upload.bin"
    _, ext = os.path.splitext(original)
    ts_name = f"foto_{_timestamp()}{ext or '.bin'}"
    abs_path = os.path.join(fotos_dir, ts_name)
    with open(abs_path, "wb") as f:
        f.write(file_bytes)
    return os.path.relpath(abs_path, start=".")

def save_json_copy(data: Dict[str, Any], target_dir: str, prefix: str) -> str:
    """
    Guarda una copia JSON (bonito, UTF-8) en la carpeta del usuario.
    Devuelve la ruta relativa.
    """
    fname = f"{prefix}_{_timestamp()}.json"
    abs_path = os.path.join(target_dir, fname)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return os.path.relpath(abs_path, start=".")

# ──────────────────────────────────────────────────────────────────────────────
@app.post("/orquestar", response_model=OrquestacionRespuesta)
async def orquestar(
    file: UploadFile = File(..., description="Imagen o PDF (raster)"),
    user_id_header: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id_form: Optional[str] = Form(default=None),
):
    effective_user_id = user_id_form or user_id_header
    dirs = ensure_user_dirs(effective_user_id)

    try:
        # 1) Leer archivo (para copia local y subida al Photo Service)
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")

        # 2) (Opcional) guardado local como ya tenías
        foto_rel_path = save_uploaded_photo(file, file_bytes, dirs["fotos"])

        # 3) Propagar user_id
        forward_headers = {}
        if effective_user_id:
            forward_headers["X-User-Id"] = effective_user_id

        async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
            # 4) Subir al Photo Service
            photo_files = {
                "file": (
                    file.filename or "upload.bin",
                    file_bytes,
                    file.content_type or "application/octet-stream",
                )
            }
            try:
                photo_resp = await client.post(PHOTO_URL, files=photo_files, headers=forward_headers)
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"No se pudo conectar con Photo Service en {PHOTO_URL}: {repr(e)}")

            if photo_resp.status_code >= 400:
                raise HTTPException(status_code=photo_resp.status_code, detail=f"Photo Service error: {photo_resp.text}")

            photo_json = photo_resp.json()
            foto_url = photo_json.get("url")
            if not foto_url:
                raise HTTPException(status_code=500, detail="Photo Service no devolvió 'url'.")

            # 👀 Log visual en la respuesta final (útil para debug)
            # print(f"[ORQ] foto_url={foto_url}")

            # 5) Llamar OCR pasándole file_url como FORM (no JSON)
            try:
                ocr_resp = await client.post(
                    OCR_URL,
                    data={"file_url": foto_url},          # importante: 'data' => form/x-www-form-urlencoded
                    headers=forward_headers
                )
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"No se pudo conectar con OCR en {OCR_URL}: {repr(e)}")

            if ocr_resp.status_code >= 400:
                raise HTTPException(status_code=ocr_resp.status_code, detail=f"OCR error: {ocr_resp.text}")

            ocr_json = ocr_resp.json()

            # 6) Análisis con el texto del OCR
            texto_detectado = (ocr_json.get("texto") or "").strip()
            try:
                analysis_resp = await client.post(ANALYSIS_URL, json={"texto": texto_detectado}, headers=forward_headers)
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"No se pudo conectar con Análisis en {ANALYSIS_URL}: {repr(e)}")

            if analysis_resp.status_code >= 400:
                raise HTTPException(status_code=analysis_resp.status_code, detail=f"Análisis error: {analysis_resp.text}")
            analysis_json = analysis_resp.json()

        # 7) Guardar copias JSON
        ocr_copy_path = save_json_copy(ocr_json, dirs["ocr"], "ocr")
        analysis_copy_path = save_json_copy(analysis_json, dirs["analysis"], "emociones")

        return {
            "mensaje": "Pipeline completado",
            "user_id": effective_user_id,
            "foto_guardada": foto_rel_path,  # copia local opcional
            "foto_url": foto_url,            # para que la veas en la respuesta y pruebes en el navegador
            "ocr": {**ocr_json, "archivo_guardado_copy": ocr_copy_path},
            "analisis": {**analysis_json, "archivo_guardado_copy": analysis_copy_path},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

