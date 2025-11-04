import os
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Form, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import httpx
import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import firestore
from starlette.responses import PlainTextResponse
from fastapi import Request
from fpdf import FPDF
from fastapi.responses import StreamingResponse
import io
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

# INICIALIZACIÓN DE FIRESTORE
db = firestore.Client()

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
app = FastAPI(title="Orquestador (Foto→OCR→Análisis | Audio→Transcripción→Análisis)")
# Definición de las URLs que serán aceptadas
FRONTEND_ORIGIN = [
    "https://frontend-826777844588.us-central1.run.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGIN,            # prod exacto
    allow_origin_regex=r"https?://localhost(:\d+)?$",  # dev: cualquier puerto
    allow_credentials=True,                   # ok si usas cookies; con Bearer no molesta
    allow_methods=["*"],                      # evita sorpresas
    allow_headers=["*"],                      # idem
    expose_headers=["*"],
    max_age=600,
)

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
    analysis: Optional[Dict[str, Any]] = None # JSON de emociones
# ──────────────────────────────────────────────────────────────────────────────
async def _save_note_to_firestore(
    db_client,
    org_id: str,
    doctor_uid: str,
    patient_id: str,
    session_id: str,
    note_id: str,
    note_type: str,       # "image" | "audio"
    source_type: str,     # "upload" | "gcs_uri"
    source_gcs_uri: Optional[str],
    text_content: str,
    analysis_result: dict,
):
    """
    Guarda un documento 'note' en Firestore si está disponible.
    Si Firestore no está disponible, no hace nada (no falla la request).
    """
    if not db_client:
        return  # Silently skip if Firestore is not configured

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
            "type": note_type,                # "image" o "audio"
            "source": source_type,            # "upload" o "gcs_uri"
            "gcs_uri_source": source_gcs_uri, # Enlace al archivo original (si aplica)
            "ocr_text": text_content,         # o transcripción para audio
            "emotions": analysis_result.get("resultado", {}),
            "status_pipeline": "done",
        }

        # Timestamps del servidor (si Firestore disponible)
        try:
            note_data["created_at"] = firestore.SERVER_TIMESTAMP  # type: ignore
            note_data["processed_at"] = firestore.SERVER_TIMESTAMP  # type: ignore
        except Exception:
            pass

        note_ref.set(note_data)
    except Exception as e:
        # No detiene la request principal; puedes cambiar a raise si quieres endurecer.
        print(f"[WARN] Firestore write failed for note {note_id}: {e}")

def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def build_forward_headers(authorization: Optional[str], uid: Optional[str]) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if authorization:
        headers["Authorization"] = authorization   # forward del ID token
    if uid:
        headers["X-User-Id"] = uid                # tu micro la usa como doctor_uid
    return headers

@app.post("/generar_reporte_pdf")
async def generar_reporte_pdf(
    payload: GenerarReporteIn,
    current_user: dict = Depends(get_current_user),
):
    doctor_uid = current_user.get("uid")
    
    try:
        # --- Fase 1: Obtener Datos (Dejamos esto activo) ---
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

        # --- Fase 2: Inicializar PDF (Dejamos esto activo) ---
        print("DEBUG: Inicializando FPDF y cargando fuentes...")
        pdf = FPDF()
        
        try:
            pdf.add_font("DejaVu", "", "DejaVuSans.ttf", uni=True)
            pdf.add_font("DejaVu", "B", "DejaVuSans-Bold.ttf", uni=True)
            pdf.add_page()
            pdf.set_font("DejaVu", size=16)
        except Exception as e:
            print(f"ADVERTENCIA: No se pudo cargar la fuente DejaVu: {e}")
            pdf.add_page()
            pdf.set_font("Arial", size=16)
        
        print("DEBUG: PDF inicializado.")

        print("DEBUG: Añadiendo Título y Datos...")
        # Título
        pdf.cell(200, 10, txt="Reporte de Nota de Evolución", ln=True, align="C")
        pdf.set_font("DejaVu", size=12) 

        # Datos del Doctor
        pdf.cell(200, 10, txt=f"Doctor: {str(doctor_data.get('name', 'N/A'))}", ln=True)
        pdf.cell(200, 10, txt=f"Cédula: {str(doctor_data.get('cedula', 'N/A'))}", ln=True)
        pdf.cell(200, 10, txt=f"Organización: {str(payload.org_id)}", ln=True)
        
        # Datos del Paciente
        pdf.cell(200, 10, txt=f"Paciente: {str(patient_data.get('fullName', 'N/A'))}", ln=True)
        pdf.cell(200, 10, txt=f"Edad: {str(patient_data.get('age', 'N/A'))}", ln=True)
        pdf.cell(200, 10, txt=f"Sesión ID: {str(payload.session_id)}", ln=True)
        pdf.ln(10) # Salto de línea
        print("DEBUG: Título y Datos añadidos.")

        print("DEBUG: Añadiendo Nota del Médico...")
        # Nota del Médico
        pdf.set_font("DejaVu", 'B', size=14)
        pdf.cell(200, 10, txt="Nota de Evolución (Médico)", ln=True)
        pdf.set_font("DejaVu", size=12)
        pdf.multi_cell(0, 5, txt=str(payload.evolution_note))
        pdf.ln(10)
        print("DEBUG: Nota del Médico añadida.")

        print("DEBUG: Añadiendo Análisis de Emociones...")
        # Análisis de Emociones
        pdf.set_font("DejaVu", 'B', size=14)
        pdf.cell(200, 10, txt="Análisis de Emociones", ln=True)
        pdf.set_font("DejaVu", size=12)
        if payload.analysis and payload.analysis.get('resultado'):
            for emocion, data in payload.analysis['resultado'].items():
                ents = ", ".join(data.get('entidades', []))
                pdf.multi_cell(0, 5, txt=f"- {str(emocion).capitalize()}: {str(data.get('porcentaje', 0))}% (Entidades: {ents or 'N/A'})")
        else:
            pdf.multi_cell(0, 5, txt="No se realizó análisis.")
        pdf.ln(10)
        print("DEBUG: Análisis añadido.")

        print("DEBUG: Añadiendo Texto de Referencia...")
        # Texto de Referencia
        pdf.set_font("DejaVu", 'B', size=14) 
        pdf.cell(200, 10, txt="Texto de Referencia (Extraído)", ln=True)
        pdf.set_font("DejaVu", '', size=10) 
        pdf.multi_cell(0, 5, txt=str(payload.baseline_text or "N/A"))
        print("DEBUG: Texto de Referencia añadido.")

        print("DEBUG: Generando bytes del PDF...")
        pdf_string = pdf.output(dest='S')
        pdf_bytes = pdf_string.encode('latin-1')
        
        print("DEBUG: Enviando StreamingResponse...")
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Nota_{payload.note_id}.pdf"}
        )

    except Exception as e:
        # Esto capturará cualquier error (como el 'bytes-like')
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
    analyze_now: bool = Form(default=False),              # <- NUEVO
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

        # Solo persistimos si ya analizamos (confirmación humana vendrá después si no)
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
    analyze_now: bool = Form(default=False),              # <- NUEVO
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
