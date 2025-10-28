import os
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Form, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import httpx
import firebase_admin
from firebase_admin import credentials, auth

# ──────────────────────────────────────────────────────────────────────────────
# Firebase Admin init (seguro para Cloud Run: sin JSON si no existe)
def _init_firebase_admin_once():
    try:
        firebase_admin.get_app()
    except ValueError:
        # 1) Si existe serviceAccountKey.json, úsalo. 2) Si no, ADC (SA de Cloud Run)
        path = "serviceAccountKey.json"
        if os.path.exists(path):
            cred = credentials.Certificate(path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()  # ADC (Workload Identity/SA de Cloud Run)

_init_firebase_admin_once()

security = HTTPBearer()

async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(security)):
    if not cred:
        raise HTTPException(status_code=401, detail="Falta el token de autorización")
    try:
        token = cred.credentials
        decoded = auth.verify_id_token(token)  # Verificación online/offline automática
        return decoded  # incluye 'uid', 'email', etc.
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {e}")

# ──────────────────────────────────────────────────────────────────────────────
# URLs de microservicios (usa las rutas completas, incl. el path del endpoint)
OCR_URL       = os.getenv("ORC_OCR_URL", "https://ocr-826777844588.us-central1.run.app/ocr")
ANALYSIS_URL  = os.getenv("ORC_ANALYSIS_URL", "https://analisis-826777844588.us-central1.run.app/analizar_emociones")
AUDIO_URL     = os.getenv("ORC_AUDIO_URL", "https://audio-826777844588.us-central1.run.app/transcribir_audio")

# Timeouts
CONNECT_TIMEOUT = float(os.getenv("ORC_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT    = float(os.getenv("ORC_READ_TIMEOUT", "120"))

# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Orquestador (Foto→OCR→Análisis | Audio→Transcripción→Análisis)")

class OrquestacionFotoRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    ocr: Dict[str, Any]
    analisis: Dict[str, Any]

class OrquestacionAudioRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    transcripcion: Dict[str, Any]
    analisis: Dict[str, Any]

def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def build_forward_headers(authorization: Optional[str], uid: Optional[str]) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if authorization:
        headers["Authorization"] = authorization   # forward del ID token
    if uid:
        headers["X-User-Id"] = uid                # tu micro la usa como doctor_uid
    return headers

# ──────────────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True, "ts": _timestamp()}

# FOTO → OCR → ANÁLISIS
@app.post("/orquestar_foto", response_model=OrquestacionFotoRespuesta)
async def orquestar_foto(
    file: UploadFile = File(None, description="Imagen (jpg/png/…)"),
    gcs_uri: Optional[str] = Form(default=None, description="gs://bucket/ruta/imagen"),
    patient_id: str = Form(...),
    session_id: str = Form(...),
    org_id: str = Form(...),
    current_user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """
    Si viene 'file': lo manda a OCR como multipart.
    Si viene 'gcs_uri': lo manda a OCR como form-data (sin file).
    Luego pasa el 'texto' devuelto por OCR DIRECTO al análisis (JSON).
    """
    effective_user_id = current_user.get("uid")
    if not file and not gcs_uri:
        raise HTTPException(status_code=400, detail="Envía 'file' o 'gcs_uri'.")

    note_id = str(uuid.uuid4())
    downstream_form = {
        "org_id": org_id,
        "patient_id": patient_id,
        "session_id": session_id,
        "note_id": note_id,
    }
    headers = build_forward_headers(authorization, effective_user_id)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
            # OCR
            if file is not None:
                file_bytes = await file.read()
                if not file_bytes:
                    raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
                files = {
                    "file": (
                        file.filename or "upload.bin",
                        file_bytes,
                        file.content_type or "application/octet-stream",
                    )
                }
                ocr_resp = await client.post(OCR_URL, files=files, data=downstream_form, headers=headers)
            else:
                form = {**downstream_form, "gcs_uri": gcs_uri}
                ocr_resp = await client.post(OCR_URL, data=form, headers=headers)

            if ocr_resp.status_code >= 400:
                raise HTTPException(status_code=ocr_resp.status_code, detail=f"OCR error: {ocr_resp.text}")
            ocr_json = ocr_resp.json()

            # Análisis
            texto_detectado = (ocr_json.get("resultado", {}).get("texto") or "").strip()
            analysis_payload = {
                "texto": texto_detectado,
                "org_id": org_id,
                "patient_id": patient_id,
                "session_id": session_id,
                "note_id": note_id,
            }
            an_resp = await client.post(ANALYSIS_URL, json=analysis_payload, headers=headers)
            if an_resp.status_code >= 400:
                raise HTTPException(status_code=an_resp.status_code, detail=f"Análisis error: {an_resp.text}")
            analysis_json = an_resp.json()

        return {
            "mensaje": "Pipeline completado (foto)",
            "user_id": effective_user_id,
            "ocr": ocr_json,
            "analisis": analysis_json,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# AUDIO → TRANSCRIPCIÓN → ANÁLISIS
@app.post("/orquestar_audio", response_model=OrquestacionAudioRespuesta)
async def orquestar_audio(
    file: UploadFile = File(None, description="Audio (mp3, m4a, wav, etc.)"),
    gcs_uri: Optional[str] = Form(default=None, description="gs://bucket/ruta/audio"),
    patient_id: str = Form(...),
    session_id: str = Form(...),
    org_id: str = Form(...),
    current_user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """
    Si viene 'file': lo manda al transcriber como multipart (él sube a GCS).
    Si viene 'gcs_uri': lo manda al transcriber como form-data.
    Luego pasa el 'texto' transcrito DIRECTO al análisis (JSON).
    """
    effective_user_id = current_user.get("uid")
    if not file and not gcs_uri:
        raise HTTPException(status_code=400, detail="Envía 'file' o 'gcs_uri'.")

    note_id = str(uuid.uuid4())
    downstream_form = {
        "org_id": org_id,
        "patient_id": patient_id,
        "session_id": session_id,
        "note_id": note_id,
    }
    headers = build_forward_headers(authorization, effective_user_id)

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
            # Transcripción
            if file is not None:
                file_bytes = await file.read()
                if not file_bytes:
                    raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
                files = {
                    "file": (
                        file.filename or "audio.bin",
                        file_bytes,
                        file.content_type or "audio/mpeg",
                    )
                }
                tr_resp = await client.post(AUDIO_URL, files=files, data=downstream_form, headers=headers)
            else:
                form = {**downstream_form, "gcs_uri": gcs_uri}
                tr_resp = await client.post(AUDIO_URL, data=form, headers=headers)

            if tr_resp.status_code >= 400:
                raise HTTPException(status_code=tr_resp.status_code, detail=f"Audio error: {tr_resp.text}")
            tr_json = tr_resp.json()

            # Análisis
            texto = (tr_json.get("resultado", {}).get("texto") or "").strip()
            analysis_payload = {
                "texto": texto,
                "org_id": org_id,
                "patient_id": patient_id,
                "session_id": session_id,
                "note_id": note_id,
            }
            an_resp = await client.post(ANALYSIS_URL, json=analysis_payload, headers=headers)
            if an_resp.status_code >= 400:
                raise HTTPException(status_code=an_resp.status_code, detail=f"Análisis error: {an_resp.text}")
            analysis_json = an_resp.json()

        return {
            "mensaje": "Pipeline completado (audio)",
            "user_id": effective_user_id,
            "transcripcion": tr_json,
            "analisis": analysis_json,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
