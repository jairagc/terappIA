import os
import json
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Form
from pydantic import BaseModel

# GCS
from google.cloud import storage

# Vision OCR
from google.cloud import vision

# ──────────────────────────────────────────────────────────────────────────────
# Config (idéntica estructura a audio, pero prefijo OCR_)
PROJECT_ID = os.getenv("OCR_PROJECT_ID", "terapia-471517")     # No estrictamente necesario p/ Vision, lo dejamos por simetría
LOCATION   = os.getenv("OCR_LOCATION", "us-central1")          # idem
DATA_ROOT       = os.getenv("OCR_DATA_ROOT", "data_local")
DIR_FOTOS       = "fotos"
DIR_PRUEBAS_IMG = "pruebas_ocr"

USE_GCS         = os.getenv("OCR_USE_GCS", "true").lower() == "true"
GCS_BUCKET      = os.getenv("OCR_GCS_BUCKET", "ceroooooo")
GCS_BASE_PREFIX = os.getenv("OCR_GCS_BASE_PREFIX", "")

# Clientes (simétrico al de audio)
gcs_client = storage.Client() if USE_GCS else None
VISION_CLIENT = vision.ImageAnnotatorClient()

app = FastAPI(title="Servicio de OCR con Google Cloud Vision (file o GCS)")

# ──────────────────────────────────────────────────────────────────────────────
# Respuesta (idéntico formato “resultado” que audio)
class OCRRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    imagen_guardada: Optional[str]  # local path si hubo file
    imagen_gcs: Optional[str]       # gs://... si hubo file y USE_GCS=true
    resultado: Dict[str, Any]       # {"texto": "...", "archivo_guardado_local": "...", "archivo_guardado_gcs": "gs://..."}

# ──────────────────────────────────────────────────────────────────────────────
# Helpers (copiados/ajustados del servicio de audio)

def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def ensure_user_dirs(uid: Optional[str]) -> Dict[str, str]:
    base = os.path.join(DATA_ROOT, uid if uid else "_public")
    paths = {
        "base": base,
        "fotos": os.path.join(base, DIR_FOTOS),
        "pruebas_ocr": os.path.join(base, DIR_PRUEBAS_IMG),
    }
    for p in paths.values():
        os.makedirs(p, exist_ok=True)
    return paths

def save_local_bytes(content: bytes, target_dir: str, prefix: str, filename: Optional[str]) -> str:
    name, ext = os.path.splitext(filename or "blob.bin")
    fname = f"{prefix}_{_ts()}{ext or '.bin'}"
    abspath = os.path.join(target_dir, fname)
    with open(abspath, "wb") as f:
        f.write(content)
    return os.path.relpath(abspath, start=".")

def save_local_json(data: Dict[str, Any], target_dir: str, prefix: str) -> str:
    fname = f"{prefix}_{_ts()}.json"
    abspath = os.path.join(target_dir, fname)
    with open(abspath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return os.path.relpath(abspath, start=".")

def guess_mime(filename: str, fallback: str) -> str:
    low = (filename or "").lower()
    if low.endswith(".jpg") or low.endswith(".jpeg"): return "image/jpeg"
    if low.endswith(".png"): return "image/png"
    if low.endswith(".webp"): return "image/webp"
    if low.endswith(".tif") or low.endswith(".tiff"): return "image/tiff"
    if low.endswith(".heic"): return "image/heic"
    return fallback

def gcs_uri_for(uid: Optional[str], folder: str, filename: str) -> str:
    prefix = f"{GCS_BASE_PREFIX.strip('/')}/" if GCS_BASE_PREFIX else ""
    user = uid if uid else "_public"
    return f"gs://{GCS_BUCKET}/{prefix}{user}/{folder}/{filename}"

def upload_to_gcs(uid: Optional[str], folder: str, content: bytes, filename: str) -> str:
    if not USE_GCS:
        return ""
    bucket = gcs_client.bucket(GCS_BUCKET)
    prefix = f"{GCS_BASE_PREFIX.strip('/')}/" if GCS_BASE_PREFIX else ""
    user = uid if uid else "_public"
    blob_path = f"{prefix}{user}/{folder}/{filename}"
    blob = bucket.blob(blob_path)
    # Para imágenes, mejor con content_type correcto
    blob.upload_from_string(content, content_type=guess_mime(filename, "application/octet-stream"))
    return f"gs://{GCS_BUCKET}/{blob_path}"

def upload_json_to_gcs(uid: Optional[str], folder: str, data: Dict[str, Any], prefix: str) -> str:
    if not USE_GCS:
        return ""
    fname = f"{prefix}_{_ts()}.json"
    bucket = gcs_client.bucket(GCS_BUCKET)
    prefix0 = f"{GCS_BASE_PREFIX.strip('/')}/" if GCS_BASE_PREFIX else ""
    user = uid if uid else "_public"
    blob_path = f"{prefix0}{user}/{folder}/{fname}"
    blob = bucket.blob(blob_path)
    blob.upload_from_string(json.dumps(data, ensure_ascii=False, indent=4), content_type="application/json")
    return f"gs://{GCS_BUCKET}/{blob_path}"

def download_gcs_bytes(uri: str) -> bytes:
    """gs://bucket/path -> bytes (para mantener simetría con audio).
       OJO: Vision también acepta image_uri directo; aquí bajamos bytes por paralelismo de estructura."""
    if not uri.startswith("gs://"):
        raise ValueError("gcs_uri inválido")
    _, rest = uri.split("gs://", 1)
    bucket_name, blob_path = rest.split("/", 1)
    bucket = storage.Client().bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_bytes()

# ──────────────────────────────────────────────────────────────────────────────
# Endpoint (idéntica firma y lógica de control que el de audio)

@app.post("/ocr_imagen", response_model=OCRRespuesta)
async def ocr_imagen(
    file: UploadFile = File(None, description="Imagen (jpg, png, webp, tiff, etc.)"),
    gcs_uri: Optional[str] = Form(default=None, description="URI de GCS gs://bucket/path"),
    user_id_header: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id_form: Optional[str] = Form(default=None),
):
    """
    Soporta:
      - file (multipart)  O  gcs_uri (form)
    Guarda la imagen local y, si USE_GCS=true, también en GCS.
    Ejecuta OCR con Vision y devuelve texto + JSON local/GCS (mismo formato que audio).
    """
    uid = user_id_form or user_id_header
    dirs = ensure_user_dirs(uid)

    try:
        image_bytes: bytes
        local_img_rel: Optional[str] = None
        image_gcs_uri: Optional[str] = None
        mime: str

        if file is not None:
            image_bytes = await file.read()
            if not image_bytes:
                raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
            # Guardar local
            local_img_rel = save_local_bytes(image_bytes, dirs["fotos"], "imagen", file.filename)
            # Subir a GCS (opcional)
            if USE_GCS:
                name, ext = os.path.splitext(file.filename or "imagen.bin")
                gcs_name = f"imagen_{_ts()}{ext or '.bin'}"
                image_gcs_uri = upload_to_gcs(uid, DIR_FOTOS, image_bytes, gcs_name)
            mime = guess_mime(file.filename or "", file.content_type or "image/jpeg")

            # 2) Ejecutar OCR (con bytes, simétrico a audio)
            image = vision.Image(content=image_bytes)

        elif gcs_uri:
            # Mantener simetría con audio: podemos bajar bytes y pasar content=...
            # (alternativa válida: image=vision.Image(source=vision.ImageSource(image_uri=gcs_uri)))
            image_bytes = download_gcs_bytes(gcs_uri)
            image_gcs_uri = gcs_uri
            mime = guess_mime(gcs_uri, "image/jpeg")

            image = vision.Image(content=image_bytes)

        else:
            raise HTTPException(status_code=400, detail="Debes enviar 'file' o 'gcs_uri'.")

        # 2) Ejecutar OCR (común)
        response = VISION_CLIENT.text_detection(image=image)
        if response.error.message:
            raise HTTPException(status_code=500, detail=response.error.message)

        # Extraer texto (full_text_annotation si está disponible; fallback a text_annotations)
        texto_detectado = ""
        if response.full_text_annotation and response.full_text_annotation.text:
            texto_detectado = response.full_text_annotation.text.strip()
        elif response.text_annotations:
            texto_detectado = (response.text_annotations[0].description or "").strip()

        payload = {"texto": texto_detectado or ""}

        # Guardar JSON local (mismo patrón que audio)
        local_json_rel = save_local_json(payload, dirs["pruebas_ocr"], "ocr")
        # Guardar JSON en GCS (mismo patrón que audio)
        gcs_json_uri = upload_json_to_gcs(uid, DIR_PRUEBAS_IMG, payload, "ocr") if USE_GCS else ""

        return {
            "mensaje": "OCR completado",
            "user_id": uid,
            "imagen_guardada": local_img_rel,
            "imagen_gcs": image_gcs_uri,
            "resultado": {
                **payload,
                "archivo_guardado_local": local_json_rel,
                "archivo_guardado_gcs": gcs_json_uri or None
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
