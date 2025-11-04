import os
import json
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Form
from pydantic import BaseModel

# ──────────────────────────────────────────────────────────────────────────────
# Config
PROJECT_ID = os.getenv("AUDIO_PROJECT_ID", "terapia-471517")
LOCATION   = os.getenv("AUDIO_LOCATION", "us-central1")
MODEL_ID   = os.getenv("AUDIO_MODEL_ID", "gemini-2.5-flash")

USE_GCS         = os.getenv("AUDIO_USE_GCS", "true").lower() == "true"
GCS_BUCKET      = os.getenv("AUDIO_GCS_BUCKET", "ceroooooo")
GCS_BASE_PREFIX = os.getenv("AUDIO_GCS_BASE_PREFIX", "")  # ej: "prod"

# Lazy singletons para evitar fallas en import-time
_storage_client = None
_vertex_inited = False
_model = None

def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def _prefix() -> str:
    return f"{GCS_BASE_PREFIX.strip('/')}/" if GCS_BASE_PREFIX else ""

def guess_mime(filename: str, fallback: str) -> str:
    low = (filename or "").lower()
    if low.endswith(".m4a"): return "audio/mp4"
    if low.endswith(".mp3"): return "audio/mpeg"
    if low.endswith(".wav"): return "audio/wav"
    if low.endswith(".ogg"): return "audio/ogg"
    if low.endswith(".webm"): return "audio/webm"
    return fallback

def get_storage_client():
    global _storage_client
    if _storage_client is None:
        from google.cloud import storage
        _storage_client = storage.Client(project=PROJECT_ID)
    return _storage_client

def ensure_vertex_model():
    """Inicializa Vertex AI y devuelve el modelo (lazy)."""
    global _vertex_inited, _model
    if not _vertex_inited or _model is None:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        _model = GenerativeModel(MODEL_ID)
        _vertex_inited = True
    return _model

def gcs_upload_bytes(org_id: str, doctor_uid: str, patient_id: str, session_id: str,
                     subfolder: str, filename: str, content: bytes, content_type: str) -> str:
    if not USE_GCS:
        raise HTTPException(status_code=500, detail="GCS no habilitado en Audio Transcriber.")
    client = get_storage_client()
    bucket = client.bucket(GCS_BUCKET)
    path = f"{_prefix()}{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/{subfolder}/{filename}"
    blob = bucket.blob(path)
    blob.upload_from_string(content, content_type=content_type)
    return f"gs://{GCS_BUCKET}/{path}"

def gcs_upload_json(org_id: str, doctor_uid: str, patient_id: str, session_id: str,
                    note_id: str, data: Dict[str, Any]) -> str:
    if not USE_GCS:
        raise HTTPException(status_code=500, detail="GCS no habilitado en Audio Transcriber.")
    client = get_storage_client()
    bucket = client.bucket(GCS_BUCKET)
    fname = f"transcripcion_{_ts()}.json"
    path = f"{_prefix()}{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/derived/transcription/{note_id}/{fname}"
    blob = bucket.blob(path)
    blob.upload_from_string(json.dumps(data, ensure_ascii=False, indent=4), content_type="application/json")
    return f"gs://{GCS_BUCKET}/{path}"

def download_gcs_bytes(uri: str) -> bytes:
    """gs://bucket/path -> bytes"""
    if not uri.startswith("gs://"):
        raise HTTPException(status_code=400, detail="gcs_uri inválido")
    _, rest = uri.split("gs://", 1)
    bucket_name, blob_path = rest.split("/", 1)
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_bytes()

# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Servicio de Transcripción de Audio (file o GCS) con Gemini 2.5")

class TranscripcionRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    audio_gcs: Optional[str]         # gs://... del audio (si vino file, se sube; si vino gcs_uri, se refleja)
    resultado: Dict[str, Any]        # {"texto": "...", "archivo_guardado_gcs": "gs://..."}

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/transcribir_audio", response_model=TranscripcionRespuesta)
async def transcribir_audio(
    file: UploadFile = File(None, description="Archivo de audio (mp3, m4a, wav, etc.)"),
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
    Si llega file: sube el binario a GCS bajo /raw/ y transcribe desde bytes.
    Si llega gcs_uri: descarga bytes de GCS para transcribir (más estable).
    Guarda SOLO el JSON de la transcripción en GCS.
    """
    uid = user_id_header or "_public"

    try:
        # Modelo de Vertex AI (lazy)
        model = ensure_vertex_model()
        from vertexai.generative_models import Part  # importar aquí por seguridad

        audio_gcs_uri: Optional[str] = None

        # Preparar bytes + MIME
        if file is not None:
            audio_bytes = await file.read()
            if not audio_bytes:
                raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
            # Subir a GCS (raw)
            _, ext = os.path.splitext(file.filename or "audio.bin")
            gcs_filename = f"{note_id}_{_ts()}{ext or '.bin'}"
            audio_gcs_uri = gcs_upload_bytes(
                org_id=org_id, doctor_uid=uid, patient_id=patient_id,
                session_id=session_id, subfolder="raw", filename=gcs_filename,
                content=audio_bytes, content_type=guess_mime(file.filename or "", file.content_type or "application/octet-stream")
            )
            mime = guess_mime(file.filename or "", file.content_type or "audio/mpeg")

        elif gcs_uri:
            audio_bytes = download_gcs_bytes(gcs_uri)
            audio_gcs_uri = gcs_uri
            mime = guess_mime(gcs_uri, "audio/mpeg")

        else:
            raise HTTPException(status_code=400, detail="Debes enviar 'file' o 'gcs_uri'.")

        # Transcripción
        audio_part = Part.from_data(data=audio_bytes, mime_type=mime)
        prompt = "Transcribe el audio a texto en español. Devuelve SOLO la transcripción."
        resp = model.generate_content([audio_part, prompt], generation_config={"response_mime_type": "text/plain"})

        # Extraer texto
        texto = (resp.candidates[0].content.parts[0].text or "").strip() if resp and resp.candidates else ""

        payload = {"texto": texto}

        # Guardar JSON en GCS
        json_gcs_uri = gcs_upload_json(
            org_id=org_id, doctor_uid=uid, patient_id=patient_id,
            session_id=session_id, note_id=note_id, data=payload
        ) if USE_GCS else None

        return {
            "mensaje": "Transcripción completada",
            "user_id": uid,
            "audio_gcs": audio_gcs_uri,
            "resultado": {**payload, "archivo_guardado_gcs": json_gcs_uri},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
