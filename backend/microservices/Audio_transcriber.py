import os
import json
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Form
from pydantic import BaseModel

# Vertex AI
import vertexai
from vertexai.generative_models import GenerativeModel, Part

# GCS
from google.cloud import storage

# ──────────────────────────────────────────────────────────────────────────────
# Config
PROJECT_ID = os.getenv("AUDIO_PROJECT_ID", "terapia-471517")
LOCATION   = os.getenv("AUDIO_LOCATION", "us-central1")
MODEL_ID   = os.getenv("AUDIO_MODEL_ID", "gemini-2.5-flash")

DATA_ROOT       = os.getenv("AUDIO_DATA_ROOT", "data_local")
DIR_AUDIOS      = "audios"
DIR_PRUEBAS_AUD = "pruebas_audio"

USE_GCS         = os.getenv("AUDIO_USE_GCS", "true").lower() == "true"
GCS_BUCKET      = os.getenv("AUDIO_GCS_BUCKET", "tu-bucket")  
GCS_BASE_PREFIX = os.getenv("AUDIO_GCS_BASE_PREFIX", "")      

vertexai.init(project=PROJECT_ID, location=LOCATION)
model = GenerativeModel(MODEL_ID)
gcs_client = storage.Client() if USE_GCS else None

app = FastAPI(title="Servicio de Transcripción de Audio con Gemini 2.5 (file o GCS)")

class TranscripcionRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    audio_guardado: Optional[str]   # local path si hubo file
    audio_gcs: Optional[str]        # gs://... si hubo file y USE_GCS=true
    resultado: Dict[str, Any]

def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def ensure_user_dirs(uid: Optional[str]) -> Dict[str, str]:
    base = os.path.join(DATA_ROOT, uid if uid else "_public")
    paths = {
        "base": base,
        "audios": os.path.join(base, DIR_AUDIOS),
        "pruebas_audio": os.path.join(base, DIR_PRUEBAS_AUD),
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
    if low.endswith(".m4a"): return "audio/mp4"
    if low.endswith(".mp3"): return "audio/mpeg"
    if low.endswith(".wav"): return "audio/wav"
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
    blob.upload_from_string(content)  # bytes
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
    """gs://bucket/path -> bytes"""
    if not uri.startswith("gs://"):
        raise ValueError("gcs_uri inválido")
    _, rest = uri.split("gs://", 1)
    bucket_name, blob_path = rest.split("/", 1)
    bucket = storage.Client().bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_bytes()

@app.post("/transcribir_audio", response_model=TranscripcionRespuesta)
async def transcribir_audio(
    file: UploadFile = File(None, description="Archivo de audio (mp3, m4a, wav, etc.)"),
    gcs_uri: Optional[str] = Form(default=None, description="URI de GCS gs://bucket/path"),
    user_id_header: Optional[str] = Header(default=None, alias="X-User-Id"),
    user_id_form: Optional[str] = Form(default=None),
):
    """
    Soporta:
      - file (multipart)  O  gcs_uri (form)
    Guarda local y, si USE_GCS=true, también en GCS.
    """
    uid = user_id_form or user_id_header
    dirs = ensure_user_dirs(uid)

    try:
        audio_bytes: bytes
        local_audio_rel: Optional[str] = None
        audio_gcs_uri: Optional[str] = None
        mime: str

        if file is not None:
            audio_bytes = await file.read()
            if not audio_bytes:
                raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
            # Local save
            local_audio_rel = save_local_bytes(audio_bytes, dirs["audios"], "audio", file.filename)
            # GCS save (opcional)
            if USE_GCS:
                name, ext = os.path.splitext(file.filename or "audio.bin")
                gcs_name = f"audio_{_ts()}{ext or '.bin'}"
                audio_gcs_uri = upload_to_gcs(uid, DIR_AUDIOS, audio_bytes, gcs_name)
            mime = guess_mime(file.filename or "", file.content_type or "audio/mpeg")

        elif gcs_uri:
            # Descargar bytes desde GCS para alimentar a Gemini
            audio_bytes = download_gcs_bytes(gcs_uri)
            # No guardamos local (podrías si quieres); mantenemos referencia al gcs_uri original
            audio_gcs_uri = gcs_uri
            # MIME heurístico
            mime = guess_mime(gcs_uri, "audio/mpeg")

        else:
            raise HTTPException(status_code=400, detail="Debes enviar 'file' o 'gcs_uri'.")

        # Part correcto
        audio_part = Part.from_data(data=audio_bytes, mime_type=mime)
        prompt = "Transcribe el audio a texto en español. Devuelve SOLO la transcripción."
        resp = model.generate_content([audio_part, prompt], generation_config={"response_mime_type": "text/plain"})
        texto = (resp.candidates[0].content.parts[0].text or "").strip()

        payload = {"texto": texto}

        # Guardar JSON local
        local_json_rel = save_local_json(payload, dirs["pruebas_audio"], "transcripcion")
        # Guardar JSON en GCS
        gcs_json_uri = upload_json_to_gcs(uid, DIR_PRUEBAS_AUD, payload, "transcripcion") if USE_GCS else ""

        return {
            "mensaje": "Transcripción completada",
            "user_id": uid,
            "audio_guardado": local_audio_rel,
            "audio_gcs": audio_gcs_uri,
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
