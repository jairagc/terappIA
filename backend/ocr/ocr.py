import os
import json
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Form
from pydantic import BaseModel

# ──────────────────────────────────────────────────────────────────────────────
# Config
PROJECT_ID = os.getenv("OCR_PROJECT_ID", "terapia-471517")
LOCATION   = os.getenv("OCR_LOCATION", "us-central1")

USE_GCS         = os.getenv("OCR_USE_GCS", "true").lower() == "true"
GCS_BUCKET      = os.getenv("OCR_GCS_BUCKET", "ceroooooo")
GCS_BASE_PREFIX = os.getenv("OCR_GCS_BASE_PREFIX", "")  # ej: "prod"

# Para evitar import-time failures, no importamos google.cloud aquí.
_storage_client = None
_vision_client = None

def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def _prefix() -> str:
    return f"{GCS_BASE_PREFIX.strip('/')}/" if GCS_BASE_PREFIX else ""

def guess_mime(filename: str, fallback: str) -> str:
    low = (filename or "").lower()
    if low.endswith(".jpg") or low.endswith(".jpeg"): return "image/jpeg"
    if low.endswith(".png"): return "image/png"
    if low.endswith(".webp"): return "image/webp"
    if low.endswith(".tif") or low.endswith(".tiff"): return "image/tiff"
    if low.endswith(".heic"): return "image/heic"
    return fallback

def get_storage_client():
    global _storage_client
    if _storage_client is None:
        # IMPORTAR AQUÍ
        from google.cloud import storage
        _storage_client = storage.Client(project=PROJECT_ID)
    return _storage_client

def get_vision_client():
    global _vision_client
    if _vision_client is None:
        # IMPORTAR AQUÍ
        from google.cloud import vision
        # Si quieres forzar REST (evitar gRPC), descomenta transport="rest"
        # _vision_client = vision.ImageAnnotatorClient(transport="rest")
        _vision_client = vision.ImageAnnotatorClient()
    return _vision_client

def gcs_upload_bytes(org_id: str, doctor_uid: str, patient_id: str, session_id: str,
                     subfolder: str, filename: str, content: bytes, content_type: str) -> str:
    if not USE_GCS:
        raise HTTPException(status_code=500, detail="GCS no habilitado en OCR.")
    client = get_storage_client()
    bucket = client.bucket(GCS_BUCKET)
    path = f"{_prefix()}{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/{subfolder}/{filename}"
    blob = bucket.blob(path)
    blob.upload_from_string(content, content_type=content_type)
    return f"gs://{GCS_BUCKET}/{path}"

def gcs_upload_json(org_id: str, doctor_uid: str, patient_id: str, session_id: str,
                    note_id: str, data: Dict[str, Any]) -> str:
    if not USE_GCS:
        raise HTTPException(status_code=500, detail="GCS no habilitado en OCR.")
    client = get_storage_client()
    bucket = client.bucket(GCS_BUCKET)
    fname = f"ocr_{_ts()}.json"
    path = f"{_prefix()}{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/derived/ocr/{note_id}/{fname}"
    blob = bucket.blob(path)
    blob.upload_from_string(json.dumps(data, ensure_ascii=False, indent=4), content_type="application/json")
    return f"gs://{GCS_BUCKET}/{path}"

# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Servicio de OCR con Google Cloud Vision (file o GCS)")

class OCRRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    imagen_gcs: Optional[str]
    resultado: Dict[str, Any]  # {"texto": "...", "archivo_guardado_gcs": "gs://..."}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/ocr", response_model=OCRRespuesta)
async def ocr_imagen(
    file: UploadFile = File(None, description="Imagen (jpg, png, webp, tiff, etc.)"),
    gcs_uri: Optional[str] = Form(default=None, description="URI de GCS gs://bucket/path"),
    user_id_header: Optional[str] = Header(default=None, alias="X-User-Id"),  # doctor_uid
    org_id: str = Form(...),
    patient_id: str = Form(...),
    session_id: str = Form(...),
    note_id: str = Form(...),
):
    """
    Acepta:
      - file (multipart)  O  gcs_uri (gs://…)
    Hace OCR con Vision, y guarda SOLO el JSON de resultado en GCS.
    Si llega file, sube la imagen a GCS (/raw/) antes del OCR.
    """
    uid = user_id_header or "_public"

    try:
        vision_client = get_vision_client()
        from google.cloud import vision  # seguro aquí

        imagen_gcs_uri: Optional[str] = None

        if file is not None:
            image_bytes = await file.read()
            if not image_bytes:
                raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")

            _, ext = os.path.splitext(file.filename or "imagen.bin")
            gcs_filename = f"{note_id}_{_ts()}{ext or '.bin'}"
            imagen_gcs_uri = gcs_upload_bytes(
                org_id=org_id, doctor_uid=uid, patient_id=patient_id,
                session_id=session_id, subfolder="raw", filename=gcs_filename,
                content=image_bytes, content_type=guess_mime(file.filename or "", file.content_type or "application/octet-stream")
            )

            image = vision.Image(content=image_bytes)

        elif gcs_uri:
            imagen_gcs_uri = gcs_uri
            image = vision.Image(source=vision.ImageSource(image_uri=gcs_uri))

        else:
            raise HTTPException(status_code=400, detail="Debes enviar 'file' o 'gcs_uri'.")

        response = vision_client.text_detection(image=image)
        if getattr(response, "error", None) and response.error.message:
            raise HTTPException(status_code=500, detail=response.error.message)

        # Texto
        texto_detectado = ""
        if getattr(response, "full_text_annotation", None) and response.full_text_annotation.text:
            texto_detectado = response.full_text_annotation.text.strip()
        elif getattr(response, "text_annotations", None):
            texto_detectado = (response.text_annotations[0].description or "").strip()

        payload = {"texto": texto_detectado or ""}
        json_gcs_uri = gcs_upload_json(
            org_id=org_id, doctor_uid=uid, patient_id=patient_id,
            session_id=session_id, note_id=note_id, data=payload
        )

        return {
            "mensaje": "OCR completado",
            "user_id": uid,
            "imagen_gcs": imagen_gcs_uri,
            "resultado": {**payload, "archivo_guardado_gcs": json_gcs_uri}
        }

    except HTTPException:
        raise
    except Exception as e:
        # Cualquier error en runtime se reporta aquí, no al importar el módulo
        raise HTTPException(status_code=500, detail=str(e))
