import os
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Form
from pydantic import BaseModel
import httpx
import json

# ──────────────────────────────────────────────────────────────────────────────
# URLs de microservicios (ajusta a Cloud Run cuando migres)
OCR_URL       = os.getenv("ORC_OCR_URL", "http://localhost:8002/ocr")
ANALYSIS_URL  = os.getenv("ORC_ANALYSIS_URL", "http://localhost:8001/analizar_emociones")
AUDIO_URL     = os.getenv("ORC_AUDIO_URL", "http://localhost:8003/transcribir_audio")

# Timeouts
CONNECT_TIMEOUT = float(os.getenv("ORC_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT    = float(os.getenv("ORC_READ_TIMEOUT", "60"))

# Raíz de almacenamiento local (para pruebas)
DATA_ROOT = os.getenv("ORC_DATA_ROOT", "data_local")

# Subcarpetas locales
DIR_OCR           = "pruebas_ocr"
DIR_ANALYSIS      = "pruebas_analisis"
DIR_FOTOS         = "fotos"
DIR_AUDIOS        = "audios"
DIR_PRUEBAS_AUDIO = "pruebas_audio"

# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Orquestador (Foto→OCR→Análisis | Audio→Transcripción→Análisis)")

class OrquestacionFotoRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    foto_guardada: Optional[str] = None  # solo si vino archivo
    ocr: Dict[str, Any]
    analisis: Dict[str, Any]

class OrquestacionAudioRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    audio_guardado: Optional[str] = None  # solo si vino archivo
    transcripcion: Dict[str, Any]
    analisis: Dict[str, Any]

# ──────────────────────────────────────────────────────────────────────────────
def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def ensure_user_dirs(user_id: Optional[str]) -> Dict[str, str]:
    base = os.path.join(DATA_ROOT, user_id if user_id else "_public")
    paths = {
        "base": base,
        "ocr": os.path.join(base, DIR_OCR),
        "analysis": os.path.join(base, DIR_ANALYSIS),
        "fotos": os.path.join(base, DIR_FOTOS),
        "audios": os.path.join(base, DIR_AUDIOS),
        "pruebas_audio": os.path.join(base, DIR_PRUEBAS_AUDIO),
    }
    for p in paths.values():
        os.makedirs(p, exist_ok=True)
    return paths

def save_uploaded(file: UploadFile, file_bytes: bytes, tgt_dir: str, prefix: str) -> str:
    original = file.filename or "upload.bin"
    _, ext = os.path.splitext(original)
    ts_name = f"{prefix}_{_timestamp()}{ext or '.bin'}"
    abs_path = os.path.join(tgt_dir, ts_name)
    with open(abs_path, "wb") as f:
        f.write(file_bytes)
    return os.path.relpath(abs_path, start=".")

def save_json_copy(data: Dict[str, Any], target_dir: str, prefix: str) -> str:
    fname = f"{prefix}_{_timestamp()}.json"
    abs_path = os.path.join(target_dir, fname)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return os.path.relpath(abs_path, start=".")

def build_forward_headers(authorization: Optional[str], uid: Optional[str]) -> Dict[str, str]:
    headers = {}
    if authorization:
        headers["Authorization"] = authorization  # Firebase ID token (prod)
    if uid:
        headers["X-User-Id"] = uid               # útil en dev/local
    return headers

# ──────────────────────────────────────────────────────────────────────────────
# FOTO → OCR → ANÁLISIS  (acepta archivo O gcs_uri)
@app.post("/orquestar_foto", response_model=OrquestacionFotoRespuesta)
async def orquestar_foto(
    file: UploadFile = File(None, description="Imagen o PDF (raster)"),
    gcs_uri: Optional[str] = Form(default=None, description="gs://bucket/ruta/imagen"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    user_id_header: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id_form: Optional[str] = Form(default=None),
):
    """
    Si viene 'file': guarda la foto localmente (pruebas) y llama OCR con 'file'.
    Si viene 'gcs_uri': NO guarda binario local y llama OCR con 'gcs_uri'.
    Luego pasa el 'texto' devuelto por OCR DIRECTO al analizador (JSON).
    """
    effective_user_id = user_id_form or user_id_header
    dirs = ensure_user_dirs(effective_user_id)
    forward_headers = build_forward_headers(authorization, effective_user_id)

    if not file and not gcs_uri:
        raise HTTPException(status_code=400, detail="Envía 'file' o 'gcs_uri'.")

    try:
        foto_rel_path = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
            # OCR
            if file is not None:
                file_bytes = await file.read()
                if not file_bytes:
                    raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
                # guardar local (pruebas)
                foto_rel_path = save_uploaded(file, file_bytes, dirs["fotos"], prefix="foto")
                files = {"file": (file.filename or "upload.bin", file_bytes, file.content_type or "application/octet-stream")}
                ocr_resp = await client.post(OCR_URL, files=files, headers=forward_headers)
            else:
                # gcs_uri
                ocr_resp = await client.post(OCR_URL, data={"gcs_uri": gcs_uri}, headers=forward_headers)

            if ocr_resp.status_code >= 400:
                raise HTTPException(status_code=ocr_resp.status_code, detail=f"OCR error: {ocr_resp.text}")
            ocr_json = ocr_resp.json()

            # Análisis (usar texto del OCR)
            texto_detectado = (ocr_json.get("resultado", {}).get("texto") or "").strip()
            
            analysis_resp = await client.post(ANALYSIS_URL, json={"texto": texto_detectado}, headers=forward_headers)
            if analysis_resp.status_code >= 400:
                raise HTTPException(status_code=analysis_resp.status_code, detail=f"Análisis error: {analysis_resp.text}")
            analysis_json = analysis_resp.json()

        # Copias locales de JSON para pruebas
        ocr_copy_path = save_json_copy({**ocr_json, "fuente_gcs_uri": gcs_uri} if gcs_uri else ocr_json, dirs["ocr"], "ocr")
        analysis_copy_path = save_json_copy(analysis_json, dirs["analysis"], "emociones")

        return {
            "mensaje": "Pipeline completado (foto)",
            "user_id": effective_user_id,
            "foto_guardada": foto_rel_path,
            "ocr": {**ocr_json, "archivo_guardado_copy": ocr_copy_path},
            "analisis": {**analysis_json, "archivo_guardado_copy": analysis_copy_path},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────────────────────────────────────
# AUDIO → TRANSCRIPCIÓN → ANÁLISIS (acepta archivo O gcs_uri)
@app.post("/orquestar_audio", response_model=OrquestacionAudioRespuesta)
async def orquestar_audio(
    file: UploadFile = File(None, description="Audio (mp3, m4a, wav, etc.)"),
    gcs_uri: Optional[str] = Form(default=None, description="gs://bucket/ruta/audio"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    user_id_header: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id_form: Optional[str] = Form(default=None),
):
    """
    Si viene 'file': guarda el audio localmente (pruebas) y llama al transcriber con 'file'.
    El transcriber se encarga de subir a GCS (si USE_GCS=true).
    Si viene 'gcs_uri': llama al transcriber con 'gcs_uri' (no guardamos binario local).
    Luego pasa el 'texto' de la transcripción DIRECTO al analizador (JSON).
    """
    effective_user_id = user_id_form or user_id_header
    dirs = ensure_user_dirs(effective_user_id)
    forward_headers = build_forward_headers(authorization, effective_user_id)

    if not file and not gcs_uri:
        raise HTTPException(status_code=400, detail="Envía 'file' o 'gcs_uri'.")

    try:
        audio_rel_path = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
            # Transcripción
            if file is not None:
                file_bytes = await file.read()
                if not file_bytes:
                    raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
                # guardar local (pruebas)
                audio_rel_path = save_uploaded(file, file_bytes, dirs["audios"], prefix="audio")
                files = {"file": (file.filename or "audio.bin", file_bytes, file.content_type or "audio/mpeg")}
                trans_resp = await client.post(AUDIO_URL, files=files, headers=forward_headers)
            else:
                trans_resp = await client.post(AUDIO_URL, data={"gcs_uri": gcs_uri}, headers=forward_headers)

            if trans_resp.status_code >= 400:
                raise HTTPException(status_code=trans_resp.status_code, detail=f"Audio error: {trans_resp.text}")
            trans_json = trans_resp.json()

            # Análisis (usar texto transcrito)
            texto = (trans_json.get("resultado", {}).get("texto") or "").strip()
            analysis_resp = await client.post(ANALYSIS_URL, json={"texto": texto}, headers=forward_headers)
            if analysis_resp.status_code >= 400:
                raise HTTPException(status_code=analysis_resp.status_code, detail=f"Análisis error: {analysis_resp.text}")
            analysis_json = analysis_resp.json()

        # Copias locales de JSON para pruebas
        trans_copy_path = save_json_copy({**trans_json, "fuente_gcs_uri": gcs_uri} if gcs_uri else trans_json,
                                         dirs["pruebas_audio"], "transcripcion")
        analysis_copy_path = save_json_copy(analysis_json, dirs["analysis"], "emociones")

        return {
            "mensaje": "Pipeline completado (audio)",
            "user_id": effective_user_id,
            "audio_guardado": audio_rel_path,
            "transcripcion": {**trans_json, "archivo_guardado_copy": trans_copy_path},
            "analisis": {**analysis_json, "archivo_guardado_copy": analysis_copy_path},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
