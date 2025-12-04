import os
import re
import textwrap
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pathlib import Path
import io
import logging 
import weasyprint
import hashlib
import html
from fastapi import (
    FastAPI, File, UploadFile, HTTPException, Header, Form, Depends, Request, Body
)
import json
from google.oauth2 import service_account
from google.auth import default as google_auth_default
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import firestore
from google.cloud import storage, bigquery # <-- AÑADIDO
from starlette.responses import PlainTextResponse

# ──────────────────────────────────────────────────────────────────────────────
# Configuración de logging (AÑADIDO)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger('fontTools.subset').setLevel(logging.WARNING)
logging.getLogger('fontTools.ttLib').setLevel(logging.WARNING)
logging.getLogger('weasyprint').setLevel(logging.WARNING)

# Firebase Admin init (Tu lógica original)
def _init_firebase_admin_once():
    try:
        firebase_admin.get_app()
        logger.info("Firebase Admin ya estaba inicializado.") # Log añadido
    except ValueError:
        path = "serviceAccountKey.json"
        if os.path.exists(path):
            cred = credentials.Certificate(path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin inicializado con serviceAccountKey.json.") # Log añadido
        else:
            firebase_admin.initialize_app()  # ADC (Workload Identity / SA de Cloud Run)
            logger.info("Firebase Admin inicializado con Application Default Credentials (ADC).") # Log añadido

_init_firebase_admin_once()

GCS_BUCKET_ENV = os.getenv("GCS_BUCKET_NAME", "ceroooooo") 
try:
    db = firestore.Client()
    storage_client = storage.Client()
    bq_client = bigquery.Client()
    BUCKET_NAME = GCS_BUCKET_ENV # Usa la variable de entorno
    logger.info(f"Clientes de Google Cloud (Firestore, Storage, BigQuery) inicializados. Bucket: {BUCKET_NAME}")
except Exception as e:
    logger.error(f"Error inicializando clientes de Google Cloud: {e}")
    raise

security = HTTPBearer()

# Intentamos primero usar una service account key JSON "real" para firmar URLs
SIGNED_URL_CREDS = None

try:
    # 👇 Default: usamos el JSON que copiaste en el Dockerfile
    SA_KEY_PATH = os.getenv(
        "SIGNED_URL_KEY_PATH",  # nombre de la env var
        "/app/terapia-471517-8474c5fd5787.json",  # default real que SÍ existe
    )

    if os.path.exists(SA_KEY_PATH):
        logger.info(f"[signed_url] Usando service account key desde archivo: {SA_KEY_PATH}")
        SIGNED_URL_CREDS = service_account.Credentials.from_service_account_file(
            SA_KEY_PATH,
            scopes=["https://www.googleapis.com/auth/devstorage.read_only"],
        )
    else:
        SA_KEY_JSON = os.getenv("SIGNED_URL_KEY_JSON")
        if SA_KEY_JSON:
            logger.info("[signed_url] Usando service account key desde SIGNED_URL_KEY_JSON")
            SIGNED_URL_CREDS = service_account.Credentials.from_service_account_info(
                json.loads(SA_KEY_JSON),
                scopes=["https://www.googleapis.com/auth/devstorage.read_only"],
            )
        else:
            # 🚫 Nada de ADC aquí: si no hay key, es un error de config.
            raise RuntimeError(
                f"No se encontró key para firmar URLs. "
                f"SA_KEY_PATH={SA_KEY_PATH}, SIGNED_URL_KEY_JSON vacío."
            )

    logger.info(f"[signed_url] Tipo de credenciales para firma: {type(SIGNED_URL_CREDS)}")
except Exception as e:
    logger.error(f"[signed_url] Error creando SIGNED_URL_CREDS: {e}", exc_info=True)
    SIGNED_URL_CREDS = None


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(security)):
    if not cred:
        raise HTTPException(status_code=401, detail="Falta el token de autorización")
    try:
        token = cred.credentials
        decoded = auth.verify_id_token(token)
        return decoded  # incluye 'uid', 'email', etc.
    except Exception as e:
        logger.warning(f"Token inválido o expirado: {e}") # Log mejorado
        raise HTTPException(status_code=401, detail=f"Token inválido: {e}")

# ──────────────────────────────────────────────────────────────────────────────
# Microservice URLs (Tu lógica original)
OCR_URL = (
    os.getenv("ORC_OCR_URL")
    or os.getenv("ORCH_OCR_URL")
    or "https://ocr-826777844588.us-central1.run.app/ocr"
)
ANALYSIS_URL = (
    os.getenv("ORC_ANALYSIS_URL")
    or os.getenv("ORCH_ANALYSIS_URL")
    or "https://analisis-826777844588.us-central1.run.app/analizar_emociones"
)
AUDIO_URL = (
    os.getenv("ORC_AUDIO_URL")
    or os.getenv("ORCH_AUDIO_URL")
    or "https://audio-826777844588.us-central1.run.app/transcribir_audio"
)

# Timeouts (Tu lógica original)
CONNECT_TIMEOUT = float(os.getenv("ORC_CONNECT_TIMEOUT", "10"))
READ_TIMEOUT = float(os.getenv("ORC_READ_TIMEOUT", "120"))

# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Orquestador (Foto→OCR→Análisis | Audio→Transcripción→Análisis)")
#FRONTEND_ORIGIN = ["https://frontend-826777844588.us-central1.run.app"]
ALLOWED_ORIGINS = [


    # --- AÑADE TU URL DE PRODUCCIÓN DE CLOUD RUN AQUÍ ---
    "https://frontend-826777844588.us-central1.run.app"
]

app.add_middleware(
    CORSMiddleware,
    # Usamos la lista explícita para la seguridad
    allow_origins= ALLOWED_ORIGINS , 
    # Mantenemos las opciones de seguridad necesarias para la autenticación
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"], 
)

# ──────────────────────────────────────────────────────────────────────────────
# Schemas (Tu lógica original)

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

class DoctorSOAPInput(BaseModel):
    """
    Modelo de entrada para la nota SOAP que el doctor escribe
    en el frontend. El frontend debe enviar un JSON con esta estructura.
    """
    subjetivo: str
    observacion_clinica: str
    analisis: str
    plan: str

class FinalizarSesionPayload(BaseModel):
    """
    Este es el Body (JSON) completo que el frontend enviará
    para finalizar la sesión.
    """
    org_id: str
    patient_id: str
    soap_input: DoctorSOAPInput

class SignedPdfIn(BaseModel):
    org_id: str 
    patient_id: str
    session_id: str

async def _save_note_to_firestore(
    db_client,
    org_id: str,
    doctor_uid: str,
    patient_id: str,
    session_id: str,
    note_id: str,
    note_type: str,      # "image" | "audio" | "text"
    source_type: str,    # "upload" | "gcs_uri" | "final"
    source_gcs_uri: Optional[str],
    text_content: str,
    analysis_result: dict,
):
    """
    Guarda la nota con campos de scoping para poder filtrar con collectionGroup
    y para que las reglas puedan autorizar la lectura.
    """
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

        # ⬇️ Campos denormalizados claves para seguridad/consultas
        note_data = {
            "note_id": note_id,
            "org_id": org_id,                 # ← NUEVO
            "doctor_uid": doctor_uid,         # ← NUEVO
            "patient_id": patient_id,         # ← NUEVO
            "session_id": session_id,         # ← NUEVO

            "type": note_type,                # "image" | "audio" | "text"
            "source": source_type,            # "upload" | "gcs_uri" | "final"
            "gcs_uri_source": source_gcs_uri, # gs://... o None
            "ocr_text": text_content,         # texto extraído o final
            "emotions": (analysis_result or {}).get("resultado", {}),  # JSON limpio
            "status_pipeline": "done",
        }

        # Timestamps del lado servidor (siempre que se pueda)
        try:
            from google.cloud import firestore as _fs  # import local para evitar sombras
            note_data["created_at"] = _fs.SERVER_TIMESTAMP
            note_data["processed_at"] = _fs.SERVER_TIMESTAMP
        except Exception:
            pass

        note_ref.set(note_data)
        logger.info(f"[OK] Nota guardada: {note_ref.path}")

    except Exception as e:
        logger.warning(f"[WARN] Firestore write failed for note {note_id}: {e}")


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
from datetime import timedelta

def build_pdf_object_name(org_id: str, doctor_uid: str, patient_id: str, session_id: str) -> str:
    return f"{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/derived/evolution/evolution_note_{session_id}.pdf"

def object_exists(bucket_name: str, object_name: str) -> bool:
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(object_name)
    return blob.exists(storage_client)

def generate_signed_get_url(bucket_name: str, object_name: str, expires_seconds: int = 300) -> str:
    if not SIGNED_URL_CREDS:
        logger.error("[signed_url] SIGNED_URL_CREDS es None, no se puede firmar")
        raise HTTPException(status_code=500, detail="Config error: no hay credenciales para firmar PDFs")

    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(object_name)

    logger.info(
        f"[signed_url] Firmando gs://{bucket_name}/{object_name} con creds tipo {type(SIGNED_URL_CREDS)}"
    )

    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(seconds=expires_seconds),
        method="GET",
        response_disposition=f'inline; filename="{Path(object_name).name}"',
        # 👇 LO IMPORTANTE: usar credenciales con llave privada
        credentials=SIGNED_URL_CREDS,
    )
    return url


# ──────────────────────────────────────────────────────────────────────────────

def formatear_analisis_html(analisis: dict) -> str:
    """
    Función auxiliar para convertir el JSON de análisis de sentimientos
    en un HTML legible y bien formateado para el PDF.
    
    *** ADAPTADA AL FORMATO DE TU MICROSERVICIO ORIGINAL ***
    (Asume que 'analisis' es el objeto guardado en 'emotions' en Firestore,
     que es igual al 'resultado' del microservicio de análisis)
    """
    if not analisis:
        return "<p>No hay datos de análisis disponibles.</p>"

    html_output = "<ul>"
    
    # Ordenar emociones por 'porcentaje' (de mayor a menor)
    try:
        sorted_emociones = sorted(
            analisis.items(), 
            key=lambda item: item[1].get('porcentaje', 0), 
            reverse=True
        )
    except Exception:
        # Si el formato es incorrecto, solo lo muestra
        return f"<p>Error al formatear análisis: {html.escape(str(analisis))}</p>"

    # Itera sobre el formato: {"tristeza": {"porcentaje": 0.5, "entidades": [...]}}
    for emocion, data in sorted_emociones:
        if isinstance(data, dict):
            porcentaje = data.get('porcentaje', 0) * 100
            entidades = data.get('entidades', [])
            ents_str = ", ".join(entidades) if entidades else 'N/A'
            
            linea = f"<strong>{html.escape(emocion.capitalize())}</strong>: {porcentaje:.1f}% (Entidades: {html.escape(ents_str)})"
            html_output += f"<li>{linea}</li>"
        else:
            # Fallback por si el formato es simple {"tristeza": 0.5}
            linea = f"<strong>{html.escape(emocion.capitalize())}</strong>: {data*100:.1f}%"
            html_output += f"<li>{linea}</li>"

    html_output += "</ul>"
    
    # Si no se encontraron emociones válidas
    if len(sorted_emociones) == 0:
        return "<p>No se detectaron emociones.</p>"

    return html_output

# --- NUEVO ENDPOINT DE GENERACIÓN DE NOTA DE EVOLUCIÓN (PDF) (AÑADIDO) ---

@app.post("/sesion/finalizar_y_firmar/{session_id}")
async def finalizar_y_firmar_sesion(
    session_id: str,
    payload: FinalizarSesionPayload = Body(...),
    current_user: dict = Depends(get_current_user) # Adaptado a tu auth
):
    """
    Finaliza una sesión, genera la Nota de Evolución (PDF) con la entrada
    SOAP del doctor, la "firma" (Hash) y la almacena en GCS y Firestore,
    cumpliendo con la NOM-004.
    
    Este endpoint es una ACCIÓN FINAL separada de /guardar_nota.
    """
    doctor_uid = current_user.get("uid") # Adaptado a tu auth
    if not doctor_uid:
        raise HTTPException(status_code=403, detail="UID de doctor no encontrado en el token")

    org_id = payload.org_id
    patient_id = payload.patient_id
    soap_input = payload.soap_input
    logger.info(f"Iniciando finalización de sesión: {session_id} por doctor: {doctor_uid}")
    
    try:
        # --- PASO 1: OBTENER DATOS REALES DE FIRESTORE ---
        
        # Obtener datos del Doctor
        doctor_ref = db.collection("orgs").document(org_id).collection("doctors").document(doctor_uid)
        doctor_doc = doctor_ref.get()
        if not doctor_doc.exists:
            logger.warning(f"Doctor no encontrado: {doctor_uid} en org {org_id}")
            raise HTTPException(status_code=404, detail="Doctor no encontrado")
        datos_doctor = doctor_doc.to_dict() or {}
        datos_doctor_formato = {
            "nombre_completo": datos_doctor.get("name", "N/A"),
            "cedula": datos_doctor.get("cedula", "N/A") # Asumiendo campo 'cedula'
        }

        # Obtener datos del Paciente
        patient_ref = doctor_ref.collection("patients").document(patient_id)
        patient_doc = patient_ref.get()
        if not patient_doc.exists:
            logger.warning(f"Paciente no encontrado: {patient_id}")
            raise HTTPException(status_code=404, detail="Paciente no encontrado")
        datos_paciente = patient_doc.to_dict() or {}
        datos_paciente_formato = {
            "display_code": datos_paciente.get("display_code", "N/A"),
            "fullName": datos_paciente.get("fullName", "N/A"), # Usando campos de tu PDF anterior
            "age": datos_paciente.get("age", "N/A"),
            "id": patient_id
        }

        # --- PASO 2: OBTENER DATOS DE IA DE LA SESIÓN (DE FIRESTORE) ---
        session_ref = patient_ref.collection("sessions").document(session_id)
        
        # Buscamos la *última* nota de IA guardada (la de /guardar_nota)
        notes_collection = session_ref.collection("notes").order_by(
            "created_at", direction=firestore.Query.DESCENDING
        ).limit(1).stream()
        
        datos_ia_procesados = {
            "origen": "N/A",
            "texto_completo": "No se procesaron notas de IA para esta sesión.",
            "analisis_sentimiento": {}
        }
        
        for note in notes_collection:
            note_data = note.to_dict() or {}
            datos_ia_procesados["origen"] = note_data.get("type", "N/A").capitalize()
            datos_ia_procesados["texto_completo"] = note_data.get("ocr_text", "Texto no extraído.")
            # Lee el campo 'emotions' que tu función _save_note_to_firestore guardó
            datos_ia_procesados["analisis_sentimiento"] = note_data.get("emotions", {})
            break
            
    except Exception as e:
        logger.error(f"Error al leer datos de Firestore para sesión {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al leer datos de Firestore: {e}")

    # --- PASO 3: ENSAMBLAR HTML Y GENERAR PDF ---
    try:
        timestamp_firma = datetime.now(timezone.utc)
        # Formatear el análisis usando la NUEVA función adaptada
        analisis_ia_html = formatear_analisis_html(datos_ia_procesados['analisis_sentimiento'])

        # Plantilla HTML (Usa fuentes DejaVu del Dockerfile)
        html_content = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page {{ margin: 1in; }}
                body {{ 
                    font-family: "DejaVu Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    font-size: 11pt; line-height: 1.5;
                }}
                h1 {{ 
                    font-size: 18pt; text-align: center; border-bottom: 2px solid #000; 
                    padding-bottom: 10px; margin-bottom: 30px;
                }}
                h2 {{ 
                    font-size: 14pt; color: #000; border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }}
                h3 {{ font-size: 12pt; color: #444; font-weight: 700; }}
                .header-info {{ 
                    font-size: 9pt; color: #555; line-height: 1.6;
                    margin-bottom: 20px; padding: 10px;
                    border: 1px solid #eee; border-radius: 5px;
                }}
                .header-info p {{ margin: 0; }}
                .section {{ margin-bottom: 15px; }}
                .ia-data-block {{
                    background-color: #f9f9f9; border: 1px solid #eee;
                    border-radius: 5px; padding: 10px 15px; margin-top: 10px;
                }}
                .ia-data-block h4 {{ margin-top: 0; font-size: 11pt; color: #111; }}
                .ia-data-block blockquote {{
                    font-style: italic; color: #333; border-left: 3px solid #ccc;
                    padding-left: 10px; margin-left: 0; font-size: 10.5pt;
                }}
                .ia-analysis-item {{ font-size: 10pt; color: #222; }}
                .ia-analysis-item ul {{ margin-top: 5px; }}
                .firma-block {{ 
                    margin-top: 50px; border-top: 1px solid #aaa; 
                    padding-top: 10px; font-size: 9pt; color: #666;
                }}
                .firma-block p {{ margin: 3px 0; }}
            </style>
        </head>
        <body>
            <h1>NOTA DE EVOLUCIÓN</h1>

            <div class="header-info">
                <p><strong>Establecimiento:</strong> {html.escape(org_id)}</p>
                <p><strong>Médico/Especialista:</strong> {html.escape(datos_doctor_formato['nombre_completo'])} (Cédula: {html.escape(datos_doctor_formato['cedula'])})</p>
                <p><strong>Fecha de Sesión:</strong> {timestamp_firma.strftime('%Y-%m-%d')}</p>
                <p><strong>Hora de Elaboración:</strong> {timestamp_firma.strftime('%H:%M:%S %Z')}</p>
                <p><strong>Paciente:</strong> {html.escape(datos_paciente_formato['fullName'])} (ID: {html.escape(datos_paciente_formato['id'])}) (Edad: {datos_paciente_formato['age']})</p>
            </div>

            <h2>II. Cuerpo de la Nota (Modelo SOAP)</h2>

            <div class="section">
                <h3>S: Subjetivo (Lo que el paciente expresa)</h3>
                <p>{html.escape(soap_input.subjetivo)}</p>
            </div>

            <div class="section">
                <h3>O: Objetivo (Datos observables y generados por TerappIA)</h3>
                <p><strong>Observación Clínica:</strong> {html.escape(soap_input.observacion_clinica)}</p>
                
                <div class="ia-data-block">
                    <h4>Datos de IA (Fuente: {html.escape(datos_ia_procesados['origen'])})</h4>
                    <p><strong>Texto Extraído:</strong></p>
                    <blockquote>"{html.escape(datos_ia_procesados['texto_completo'])}"</blockquote>
                    <hr style="border:0; border-top: 1px dashed #ccc; margin: 15px 0;">
                    
                    <h4>Análisis de Emociones (sobre texto extraído)</h4>
                    <div class="ia-analysis-item">
                        {analisis_ia_html}
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>A: Análisis / Evaluación (Interpretación Clínica)</h3>
                <p>{html.escape(soap_input.analisis)}</p>
            </div>

            <div class="section">
                <h3>P: Plan (Tratamiento y Próximos Pasos)</h3>
                <p>{html.escape(soap_input.plan)}</p>
            </div>

            <h2>III. Certificación de Firma Electrónica</h2>
            <div class="firma-block">
                <p><strong>Nota cerrada y firmada electrónicamente por:</strong> {html.escape(datos_doctor_formato['nombre_completo'])}</p>
                <p><strong>Doctor UID (Atribución):</strong> {html.escape(doctor_uid)}</p>
                <p><strong>Sello de Tiempo (Integridad):</strong> {timestamp_firma.isoformat()}</p>
                <p><strong>Huella Digital (Hash) del Documento:</strong> <span style="font-size: 8pt; word-wrap: break-word;">(Se calculará y guardará)</span></p>
            </div>
        </body>
        </html>
        """

        # Generar PDF y Hash
        logger.info("Generando PDF y Hash...")
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
        document_hash = hashlib.sha256(pdf_bytes).hexdigest()
        
        # Actualizar el HTML con el Hash real ANTES de la regeneración final
        html_content_firmado = html_content.replace(
            '<span style="font-size: 8pt; word-wrap: break-word;">(Se calculará y guardará)</span>',
            f'<span style="font-size: 8pt; word-wrap: break-word;">{document_hash}</span>'
        )
        pdf_bytes = weasyprint.HTML(string=html_content_firmado).write_pdf() # Regenerar con el hash

    except Exception as e:
        logger.error(f"Error al generar el PDF para sesión {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al generar el PDF: {e}")

    # -----------------------------------------------------
    # PASO 4: GUARDAR EN GCS, FIRESTORE Y (opcional) BIGQUERY
    # -----------------------------------------------------
    try:
        # 1. Guardar PDF en GCS
        gcs_path = f"{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/derived/evolution/evolution_note_{session_id}.pdf"
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(gcs_path)
        blob.upload_from_string(pdf_bytes, content_type='application/pdf')
        gcs_uri = f"gs://{BUCKET_NAME}/{gcs_path}"
        logger.info(f"PDF guardado en GCS: {gcs_uri}")

        # 2. Actualizar Documento de Sesión en Firestore
        note_txt_completa = f"S: {soap_input.subjetivo}\nO: {soap_input.observacion_clinica}\nA: {soap_input.analisis}\nP: {soap_input.plan}"
        
        datos_firma = {
            "evolution_note_md_uri": gcs_uri, # El nombre del campo dice MD pero guardamos PDF
            "evolution_note_txt": note_txt_completa,
            "status_pipeline": "done", # Marcamos la sesión como completada
            "signed_at_ts": timestamp_firma,
            "signature_method": "firma_simple_terappia",
            "document_hash": document_hash
        }
        
        # Usamos update() para añadir estos campos al documento de sesión existente
        session_ref.set(datos_firma, merge = True)
        logger.info(f"Documento de sesión {session_id} actualizado en Firestore.")

        # 3. (Opcional) Guardar en BigQuery
        # BQ_DATASET = os.environ.get("BQ_DATASET", "tu_dataset") # Necesitas definir esto
        # BQ_TABLE_EVOLUTION = f"{bq_client.project}.{BQ_DATASET}.evolution_notes"
        
        # bq_row = {
        #     "session_id": session_id, "patient_id": patient_id, "doctor_uid": doctor_uid,
        #     "org_id": org_id, "ds": timestamp_firma.date(),
        #     "note_md_uri": gcs_uri, "note_txt": note_txt_completa,
        #     "signed_at_ts": timestamp_firma.isoformat(), "document_hash": document_hash,
        #     "created_ts": timestamp_firma.isoformat()
        # }
        # errors = bq_client.insert_rows_json(BQ_TABLE_EVOLUTION, [bq_row])
        # if errors:
        #     logger.error(f"Errores al insertar en BigQuery: {errors}")
        # else:
        #     logger.info("Datos de evolución insertados en BigQuery.")

    except Exception as e:
        logger.error(f"Error al guardar datos en GCS/Firestore para sesión {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al guardar datos en GCS/Firestore: {e}")

    # Devuelve el PDF directamente para revisión/descarga
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=Nota_{session_id}.pdf"}
    )
    
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/signed_pdf_url")
async def signed_pdf_url(
    payload: SignedPdfIn,
    current_user: dict = Depends(get_current_user),
):
    if not BUCKET_NAME:
        raise HTTPException(status_code=500, detail="Bucket no configurado")

    doctor_uid = current_user.get("uid")
    if not doctor_uid:
        raise HTTPException(status_code=401, detail="Token sin uid")

    object_name = build_pdf_object_name(
        org_id=payload.org_id,
        doctor_uid=doctor_uid,
        patient_id=payload.patient_id,
        session_id=payload.session_id,
    )

    try:
        if not object_exists(BUCKET_NAME, object_name):
            raise HTTPException(
                status_code=404,
                detail=f"No existe: gs://{BUCKET_NAME}/{object_name}"
            )
        url = generate_signed_get_url(BUCKET_NAME, object_name, expires_seconds=300)
        return {"url": url, "expires_in_seconds": 300}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[signed_pdf_url] Error firmando URL para gs://{BUCKET_NAME}/{object_name}: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo firmar el PDF: {e}",
        )

# ──────────────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"ok": True, "ts": _timestamp()}

@app.options("/{full_path:path}")
async def preflight_catch_all(full_path: str, request: Request):
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

        # Persistimos si ya analizamos (Tu lógica original de 'if analysis_json:')
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

        # Persistimos si ya analizamos (Tu lógica original de 'if analysis_json:')
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