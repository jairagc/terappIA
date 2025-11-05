import os
import re
import textwrap
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path
import io

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import firestore
from starlette.responses import PlainTextResponse

from fpdf import FPDF

# ──────────────────────────────────────────────────────────────────────────────
# Firebase Admin init (seguro para Cloud Run: sin JSON si no existe)
def _init_firebase_admin_once():
    try:
        firebase_admin.get_app()
    except ValueError:
        path = "serviceAccountKey.json"
        if os.path.exists(path):
            cred = credentials.Certificate(path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()  # ADC (Workload Identity / SA de Cloud Run)

_init_firebase_admin_once()

# INICIALIZACIÓN DE FIRESTORE
db = firestore.Client()

security = HTTPBearer()

async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(security)):
    if not cred:
        raise HTTPException(status_code=401, detail="Falta el token de autorización")
    try:
        token = cred.credentials
        decoded = auth.verify_id_token(token)
        return decoded  # incluye 'uid', 'email', etc.
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {e}")

# ──────────────────────────────────────────────────────────────────────────────
# Microservice URLs (env or defaults)
OCR_URL       = (
    os.getenv("ORC_OCR_URL")
    or os.getenv("ORCH_OCR_URL")
    or "https://ocr-826777844588.us-central1.run.app/ocr"
)
ANALYSIS_URL  = (
    os.getenv("ORC_ANALYSIS_URL")
    or os.getenv("ORCH_ANALYSIS_URL")
    or "https://analisis-826777844588.us-central1.run.app/analizar_emociones"
)
AUDIO_URL     = (
    os.getenv("ORC_AUDIO_URL")
    or os.getenv("ORCH_AUDIO_URL")
    or "https://audio-826777844588.us-central1.run.app/transcribir_audio"
)

# Timeouts
CONNECT_TIMEOUT = float(os.getenv("ORC_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT    = float(os.getenv("ORC_READ_TIMEOUT", "120"))

# ──────────────────────────────────────────────────────────────────────────────
# Fuentes DejaVu (Docker + local dev)
DEJAVU_REGULAR_CANDIDATES = [
    "/usr/local/share/fonts/truetype/app/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/app/DejaVuSans.ttf",
    "DejaVuSans.ttf",
]
DEJAVU_BOLD_CANDIDATES = [
    "/usr/local/share/fonts/truetype/app/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/app/DejaVuSans-Bold.ttf",
    "DejaVuSans-Bold.ttf",
]

def _first_existing_path(candidates) -> Optional[str]:
    for p in candidates:
        if Path(p).exists():
            return p
    return None

def register_dejavu(pdf: FPDF) -> bool:
    """Registra DejaVu en FPDF si las TTF están disponibles. Devuelve True si se registró."""
    reg = _first_existing_path(DEJAVU_REGULAR_CANDIDATES)
    bold = _first_existing_path(DEJAVU_BOLD_CANDIDATES)
    if not reg or not bold:
        print(f"[WARN] Fuentes DejaVu no encontradas. regular={reg} bold={bold}")
        return False
    try:
        pdf.add_font("DejaVu", "", reg, uni=True)
        pdf.add_font("DejaVu", "B", bold, uni=True)
        print(f"[INFO] DejaVu registrado: regular={reg}, bold={bold}")
        return True
    except Exception as e:
        print(f"[WARN] Falló el registro de DejaVu: {e}")
        return False

# Cortar secuencias sin espacios (URLs, tokens, base64) para que quepan en multi_cell
def soften_unbreakables(s: str, chunk: int = 60) -> str:
    if not s:
        return ""
    return re.sub(
        r"(\S{" + str(chunk) + r",})",
        lambda m: "\n".join(textwrap.wrap(m.group(1), chunk)),
        s,
    )

# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Orquestador (Foto→OCR→Análisis | Audio→Transcripción→Análisis)")
FRONTEND_ORIGIN = ["https://frontend-826777844588.us-central1.run.app"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGIN,
    allow_origin_regex=r"https?://localhost(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

# ──────────────────────────────────────────────────────────────────────────────
# Schemas
class OrquestacionFotoRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    note_id: str
    ocr: Dict[str, Any]
    analisis: Optional[Dict[str, Any]] = None

class OrquestacionAudioRespuesta(BaseModel):
    mensaje: str
    user_id: Optional[str]
    note_id: str
    transcripcion: Dict[str, Any]
    analisis: Optional[Dict[str, Any]] = None

class GuardarNotaIn(BaseModel):
    org_id: str
    patient_id: str
    session_id: str
    note_id: str
    texto: str

class GuardarNotaOut(BaseModel):
    mensaje: str
    note_id: str
    analisis: Dict[str, Any]

class GenerarReporteIn(BaseModel):
    org_id: str
    patient_id: str
    session_id: str
    note_id: str
    evolution_note: str  # Nota del doctor
    baseline_text: str   # Texto de OCR/Audio
    analysis: Optional[Dict[str, Any]] = None  # JSON de emociones

# ──────────────────────────────────────────────────────────────────────────────
async def _save_note_to_firestore(
    db_client,
    org_id: str,
    doctor_uid: str,
    patient_id: str,
    session_id: str,
    note_id: str,
    note_type: str,       # "image" | "audio" | "text"
    source_type: str,     # "upload" | "gcs_uri" | "final"
    source_gcs_uri: Optional[str],
    text_content: str,
    analysis_result: dict,
):
    if not db_client:
        return
    try:
        note_ref = (
            db_client.collection("orgs").document(org_id)
            .collection("doctors").document(doctor_uid)
            .collection("patients").document(patient_id)
            .collection("sessions").document(session_id)
            .collection("notes").document(note_id)
        )
        note_data = {
            "note_id": note_id,
            "type": note_type,
            "source": source_type,
            "gcs_uri_source": source_gcs_uri,
            "ocr_text": text_content,
            "emotions": (analysis_result or {}).get("resultado", {}),
            "status_pipeline": "done",
        }
        try:
            note_data["created_at"] = firestore.SERVER_TIMESTAMP  # type: ignore
            note_data["processed_at"] = firestore.SERVER_TIMESTAMP  # type: ignore
        except Exception:
            pass
        note_ref.set(note_data)
    except Exception as e:
        print(f"[WARN] Firestore write failed for note {note_id}: {e}")

def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def build_forward_headers(authorization: Optional[str], uid: Optional[str]) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if authorization:
        headers["Authorization"] = authorization
    if uid:
        headers["X-User-Id"] = uid
    return headers

# ──────────────────────────────────────────────────────────────────────────────
@app.post("/generar_reporte_pdf")
async def generar_reporte_pdf(
    payload: GenerarReporteIn,
    current_user: dict = Depends(get_current_user),
):
    doctor_uid = current_user.get("uid")

    try:
        # --- Fase 1: Firestore ---
        print("DEBUG: Obteniendo datos de Firestore...")
        doc_ref = db.collection("orgs").document(payload.org_id) \
                    .collection("doctors").document(doctor_uid)
        doc_snap = doc_ref.get()
        doctor_data = doc_snap.to_dict() if doc_snap.exists else {}

        pat_ref = db.collection("orgs").document(payload.org_id) \
                    .collection("doctors").document(doctor_uid) \
                    .collection("patients").document(payload.patient_id)
        pat_snap = pat_ref.get()
        patient_data = pat_snap.to_dict() if pat_snap.exists else {}
        print("DEBUG: Datos de Firestore obtenidos.")

        # --- Fase 2: PDF ---
        print("DEBUG: Inicializando FPDF y fuentes...")
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)  # evita desbordes verticales
        fonts_ok = register_dejavu(pdf)

        pdf.add_page()
        if fonts_ok:
            pdf.set_font("DejaVu", size=16)
        else:
            pdf.set_font("Arial", size=16)

        # Título
        pdf.cell(0, 10, txt="Reporte de Nota de Evolución", ln=True, align="C")

        if fonts_ok:
            pdf.set_font("DejaVu", size=12)
        else:
            pdf.set_font("Arial", size=12)

        # Datos del Doctor (usar ancho 0 = ancho restante de línea)
        pdf.cell(0, 10, txt=f"Doctor: {str(doctor_data.get('name', 'N/A'))}", ln=True)
        pdf.cell(0, 10, txt=f"Cédula: {str(doctor_data.get('cedula', 'N/A'))}", ln=True)
        pdf.cell(0, 10, txt=f"Organización: {str(payload.org_id)}", ln=True)

        # Paciente
        pdf.cell(0, 10, txt=f"Paciente: {str(patient_data.get('fullName', 'N/A'))}", ln=True)
        pdf.cell(0, 10, txt=f"Edad: {str(patient_data.get('age', 'N/A'))}", ln=True)
        pdf.cell(0, 10, txt=f"Sesión ID: {str(payload.session_id)}", ln=True)
        pdf.ln(5)

        # Nota del médico
        if fonts_ok:
            pdf.set_font("DejaVu", "B", size=14)
        else:
            pdf.set_font("Arial", "B", size=14)
        pdf.cell(0, 10, txt="Nota de Evolución (Médico)", ln=True)

        if fonts_ok:
            pdf.set_font("DejaVu", size=12)
        else:
            pdf.set_font("Arial", size=12)

        note_txt = soften_unbreakables(str(payload.evolution_note))
        pdf.multi_cell(0, 5, txt=note_txt)
        pdf.ln(3)

        # Análisis
        if fonts_ok:
            pdf.set_font("DejaVu", "B", size=14)
        else:
            pdf.set_font("Arial", "B", size=14)
        pdf.cell(0, 10, txt="Análisis de Emociones", ln=True)

        if fonts_ok:
            pdf.set_font("DejaVu", size=12)
        else:
            pdf.set_font("Arial", size=12)

        if payload.analysis and payload.analysis.get('resultado'):
            for emocion, data in payload.analysis['resultado'].items():
                ents = ", ".join(data.get('entidades', []))
                line = f"- {str(emocion).capitalize()}: {str(data.get('porcentaje', 0))}% (Entidades: {ents or 'N/A'})"
                pdf.multi_cell(0, 5, txt=soften_unbreakables(line))
        else:
            pdf.multi_cell(0, 5, txt="No se realizó análisis.")
        pdf.ln(3)

        # Texto de referencia (OCR/Audio)
        if fonts_ok:
            pdf.set_font("DejaVu", "B", size=14)
        else:
            pdf.set_font("Arial", "B", size=14)
        pdf.cell(0, 10, txt="Texto de Referencia (Extraído)", ln=True)

        if fonts_ok:
            pdf.set_font("DejaVu", "", size=10)
        else:
            pdf.set_font("Arial", "", size=10)

        base_txt = soften_unbreakables(str(payload.baseline_text or "N/A"))
        pdf.multi_cell(0, 5, txt=base_txt)

        # Salida
        pdf_string = pdf.output(dest='S')  # str (latin-1)
        pdf_bytes = pdf_string.encode('latin-1', errors='ignore')

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Nota_{payload.note_id}.pdf"}
        )

    except Exception as e:
        print(f"ERROR DETALLADO: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {e}")

# ──────────────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True, "ts": _timestamp()}

@app.options("/{full_path:path}")
async def preflight_catch_all(full_path: str, request: Request):
    # 204 sin validar nada; CORSMiddleware inyecta los headers CORS
    return PlainTextResponse("", status_code=204)

# FOTO → OCR → ANÁLISIS
@app.post("/orquestar_foto", response_model=OrquestacionFotoRespuesta)
async def orquestar_foto(
    file: UploadFile = File(None),
    gcs_uri: Optional[str] = Form(default=None),
    patient_id: str = Form(...),
    session_id: str = Form(...),
    org_id: str = Form(...),
    analyze_now: bool = Form(default=False),
    current_user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
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

    async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
        # OCR
        if file is not None:
            file_bytes = await file.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
            files = {"file": (file.filename or "upload.bin", file_bytes, file.content_type or "application/octet-stream")}
            ocr_resp = await client.post(OCR_URL, files=files, data=downstream_form, headers=headers)
        else:
            form = {**downstream_form, "gcs_uri": gcs_uri}
            ocr_resp = await client.post(OCR_URL, data=form, headers=headers)

        if ocr_resp.status_code >= 400:
            raise HTTPException(status_code=ocr_resp.status_code, detail=f"OCR error: {ocr_resp.text}")
        ocr_json = ocr_resp.json()

        analysis_json = None
        if analyze_now:
            texto_detectado = (ocr_json.get("resultado", {}).get("texto") or "").strip()
            an_payload = {**downstream_form, "texto": texto_detectado}
            an_resp = await client.post(ANALYSIS_URL, json=an_payload, headers=headers)
            if an_resp.status_code >= 400:
                raise HTTPException(status_code=an_resp.status_code, detail=f"Análisis error: {an_resp.text}")
            analysis_json = an_resp.json()

        # Persistimos si ya analizamos
        if analysis_json:
            source_gcs_uri = ocr_json.get("imagen_gcs") if file else gcs_uri
            await _save_note_to_firestore(
                db_client=db,
                org_id=org_id,
                doctor_uid=effective_user_id,
                patient_id=patient_id,
                session_id=session_id,
                note_id=note_id,
                note_type="image",
                source_type="upload" if file else "gcs_uri",
                source_gcs_uri=source_gcs_uri,
                text_content=(ocr_json.get("resultado", {}).get("texto") or ""),
                analysis_result=analysis_json,
            )

    return {
        "mensaje": "OCR listo (pendiente de confirmación)" if not analyze_now else "Pipeline completado (foto)",
        "user_id": effective_user_id,
        "note_id": note_id,
        "ocr": ocr_json,
        "analisis": analysis_json,
    }

# AUDIO → TRANSCRIPCIÓN → ANÁLISIS
@app.post("/orquestar_audio", response_model=OrquestacionAudioRespuesta)
async def orquestar_audio(
    file: UploadFile = File(None),
    gcs_uri: Optional[str] = Form(default=None),
    patient_id: str = Form(...),
    session_id: str = Form(...),
    org_id: str = Form(...),
    analyze_now: bool = Form(default=False),
    current_user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    effective_user_id = current_user.get("uid")
    if not file and not gcs_uri:
        raise HTTPException(status_code=400, detail="Envía 'file' o 'gcs_uri'.")

    note_id = str(uuid.uuid4())
    downstream_form = { "org_id": org_id, "patient_id": patient_id, "session_id": session_id, "note_id": note_id }
    headers = build_forward_headers(authorization, effective_user_id)

    async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
        # Transcripción
        if file is not None:
            file_bytes = await file.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
            files = {"file": (file.filename or "audio.bin", file_bytes, file.content_type or "audio/mpeg")}
            tr_resp = await client.post(AUDIO_URL, files=files, data=downstream_form, headers=headers)
        else:
            form = {**downstream_form, "gcs_uri": gcs_uri}
            tr_resp = await client.post(AUDIO_URL, data=form, headers=headers)

        if tr_resp.status_code >= 400:
            raise HTTPException(status_code=tr_resp.status_code, detail=f"Audio error: {tr_resp.text}")
        tr_json = tr_resp.json()

        analysis_json = None
        if analyze_now:
            texto = (tr_json.get("resultado", {}).get("texto") or "").strip()
            an_payload = {**downstream_form, "texto": texto}
            an_resp = await client.post(ANALYSIS_URL, json=an_payload, headers=headers)
            if an_resp.status_code >= 400:
                raise HTTPException(status_code=an_resp.status_code, detail=f"Análisis error: {an_resp.text}")
            analysis_json = an_resp.json()

        if analysis_json:
            source_gcs_uri = tr_json.get("audio_gcs") if file else gcs_uri
            await _save_note_to_firestore(
                db_client=db,
                org_id=org_id,
                doctor_uid=effective_user_id,
                patient_id=patient_id,
                session_id=session_id,
                note_id=note_id,
                note_type="audio",
                source_type="upload" if file else "gcs_uri",
                source_gcs_uri=source_gcs_uri,
                text_content=(tr_json.get("resultado", {}).get("texto") or ""),
                analysis_result=analysis_json,
            )

    return {
        "mensaje": "Transcripción lista (pendiente de confirmación)" if not analyze_now else "Pipeline completado (audio)",
        "user_id": effective_user_id,
        "note_id": note_id,
        "transcripcion": tr_json,
        "analisis": analysis_json,
    }

@app.post("/guardar_nota", response_model=GuardarNotaOut)
async def guardar_nota(
    payload: GuardarNotaIn,
    current_user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    effective_user_id = current_user.get("uid")
    headers = build_forward_headers(authorization, effective_user_id)

    # 1) Analizar una sola vez con el texto final
    an_payload = {
        "texto": payload.texto,
        "org_id": payload.org_id,
        "patient_id": payload.patient_id,
        "session_id": payload.session_id,
        "note_id": payload.note_id,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT)) as client:
        an_resp = await client.post(ANALYSIS_URL, json=an_payload, headers=headers)
        if an_resp.status_code >= 400:
            raise HTTPException(status_code=an_resp.status_code, detail=f"Análisis error: {an_resp.text}")
        analysis_json = an_resp.json()

    # 2) Persistir en Firestore
    await _save_note_to_firestore(
        db_client=db,
        org_id=payload.org_id,
        doctor_uid=effective_user_id,
        patient_id=payload.patient_id,
        session_id=payload.session_id,
        note_id=payload.note_id,
        note_type="text",
        source_type="final",
        source_gcs_uri=None,
        text_content=payload.texto,
        analysis_result=analysis_json,
    )

    return {"mensaje": "Nota guardada y analizada", "note_id": payload.note_id, "analisis": analysis_json}
