"""
Endpoint para:
- Recibir texto (o una gcs_uri a un .txt) en un POST.
- Analizar emociones (alegria, tristeza, enojo, miedo, sorpresa, disgusto, estres, calma, aversión, anticipación)
  con Gemini en Vertex AI, asignando % y entidades.
- Guardar SOLO el JSON de resultado en GCS, bajo:
  {prefix}{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/derived/analisis/{note_id}/analisis_YYYYmmdd_HHMMSS.json
"""

import os
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

# ──────────────────────────────────────────────────────────────────────────────
# Config
PROJECT_ID = os.getenv("AN_PROJECT_ID", "terapia-471517")
LOCATION   = os.getenv("AN_LOCATION", "us-central1")
MODEL_ID   = os.getenv("AN_MODEL_ID", "gemini-2.5-flash-lite")

USE_GCS         = os.getenv("AN_USE_GCS", "true").lower() == "true"
GCS_BUCKET      = os.getenv("AN_GCS_BUCKET", "ceroooooo")
GCS_BASE_PREFIX = os.getenv("AN_GCS_BASE_PREFIX", "")  # ej: "prod"

# Lazy singletons (evitar fallas en import-time)
_storage_client = None
_vertex_inited  = False
_model          = None

def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def _prefix() -> str:
    return f"{GCS_BASE_PREFIX.strip('/')}/" if GCS_BASE_PREFIX else ""

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

def upload_json_to_gcs(org_id: str, doctor_uid: str, patient_id: str,
                       session_id: str, note_id: str, data: Dict[str, Any]) -> str:
    if not USE_GCS:
        raise HTTPException(status_code=500, detail="GCS no habilitado en Analysis.")
    client = get_storage_client()
    bucket = client.bucket(GCS_BUCKET)
    fname = f"analisis_{_ts()}.json"
    path = f"{_prefix()}{org_id}/{doctor_uid}/{patient_id}/sessions/{session_id}/derived/analisis/{note_id}/{fname}"
    blob = bucket.blob(path)
    blob.upload_from_string(json.dumps(data, ensure_ascii=False, indent=4), content_type="application/json")
    return f"gs://{GCS_BUCKET}/{path}"

def download_gcs_text(uri: str) -> str:
    if not uri or not uri.startswith("gs://"):
        raise HTTPException(status_code=400, detail="gcs_uri inválido")
    _, rest = uri.split("gs://", 1)
    bucket_name, blob_path = rest.split("/", 1)
    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_text(encoding="utf-8")

TARGET_EMOTIONS = [
    "alegria","tristeza","enojo","miedo","sorpresa","disgusto","estres","calma","aversión","anticipación"
]

def limpiar_json(data: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for emocion, valores in data.items():
        if isinstance(valores, dict):
            try:
                pct = float(valores.get("porcentaje", 0))
            except Exception:
                pct = 0.0
            entidades = valores.get("entidades", [])
            if not isinstance(entidades, list):
                entidades = [str(entidades)]
            out[emocion] = {"porcentaje": pct, "entidades": entidades}
    return out

# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="API Análisis de Emociones (texto o gcs_uri)")

class TextoEntrada(BaseModel):
    texto: Optional[str] = None
    gcs_uri: Optional[str] = None
    org_id: str
    patient_id: str
    session_id: str
    note_id: str

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/analizar_emociones")
def analizar_emociones(
    entrada: TextoEntrada,
    user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
):
    """
    Entrada:
      - {"texto": "..."}  O  {"gcs_uri": "gs://bucket/carpeta/texto.txt"}
      - org_id, patient_id, session_id, note_id (para nombrado y segmentación)
    Guarda SOLO en GCS (si AN_USE_GCS=true).
    """
    try:
        if not entrada.texto and not entrada.gcs_uri:
            raise HTTPException(status_code=400, detail="Debes enviar 'texto' o 'gcs_uri'.")

        # Cargar texto
        texto = entrada.texto if entrada.texto is not None else download_gcs_text(entrada.gcs_uri)

        # Modelo Gemini (lazy)
        model = ensure_vertex_model()

        prompt = f"""
Analiza el siguiente texto y extrae estas emociones: {', '.join(TARGET_EMOTIONS)}.
Para cada emoción encontrada, asigna un porcentaje (0-100) e identifica entidades relacionadas.

Texto: {texto}

Devuelve SOLO un JSON con el formato:
{{
  "emocion": {{
    "porcentaje": 85.5,
    "entidades": ["entidad1","entidad2"]
  }}
}}
""".strip()

        # Pedimos salida JSON
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )

        raw = ""
        if response and getattr(response, "candidates", None):
            raw = response.candidates[0].content.parts[0].text.strip()

        # Intentar parsear como JSON puro; si no, usa regex como respaldo
        try:
            parsed = json.loads(raw)
        except Exception:
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if not m:
                raise HTTPException(status_code=500, detail="No se encontró JSON en la respuesta del modelo.")
            parsed = json.loads(m.group())

        cleaned = limpiar_json(parsed)

        result = {"mensaje": "Análisis completado", "resultado": cleaned}

        # Guardar SOLO en GCS
        gcs_path = upload_json_to_gcs(
            org_id=entrada.org_id,
            doctor_uid=user_id or "_public",
            patient_id=entrada.patient_id,
            session_id=entrada.session_id,
            note_id=entrada.note_id,
            data=result
        ) if USE_GCS else None

        return {**result, "archivo_guardado_gcs": gcs_path}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
