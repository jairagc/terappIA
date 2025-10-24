""" Ebdpoint para:
Recibir un texto en un POST.
Analizar 8 emociones (ej: alegría, tristeza, enojo, miedo, sorpresa, disgusto, estrés, calma).
Extraer entidades relacionadas con cada emoción y asignar porcentajes de certeza.
Devolver el resultado en JSON limpio.
Guardar ese JSON en una carpeta local.

Se espera recibir un texto en formato JSON, ej:
{ "texto": "Me siento estresado en la escuela pero feliz con mis amigos." }

Respuesta devuelta:
{
  "estres": { "porcentaje": 90.0, "entidades": ["escuela"] },
  "alegria": { "porcentaje": 75.0, "entidades": ["amigos"] }
}
"""
import os
import json
from datetime import datetime
from typing import Dict, Any, Optional
import re
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import vertexai
from vertexai.generative_models import GenerativeModel
from google.cloud import storage

PROJECT_ID = os.getenv("AN_PROJECT_ID", "terapia-471517")
LOCATION   = os.getenv("AN_LOCATION", "us-central1")
MODEL_ID   = os.getenv("AN_MODEL_ID", "gemini-2.5-flash-lite")

DATA_ROOT       = os.getenv("AN_DATA_ROOT", "data_local")
DIR_ANALYSIS    = "pruebas_analisis"

USE_GCS         = os.getenv("AN_USE_GCS", "true").lower() == "true"
GCS_BUCKET      = os.getenv("AN_GCS_BUCKET", "tu-bucket")
GCS_BASE_PREFIX = os.getenv("AN_GCS_BASE_PREFIX", "")

vertexai.init(project=PROJECT_ID, location=LOCATION)
model = GenerativeModel(MODEL_ID)
gcs_client = storage.Client() if USE_GCS else None

app = FastAPI(title="API Análisis de Emociones (texto o gcs_uri)")

TARGET_EMOTIONS = [
    "alegria","tristeza","enojo","miedo","sorpresa","disgusto","estres","calma","aversión","anticipación"
]

class TextoEntrada(BaseModel):
    texto: Optional[str] = None
    gcs_uri: Optional[str] = None 

def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def ensure_user_dirs(uid: Optional[str]) -> str:
    base = os.path.join(DATA_ROOT, uid if uid else "_public", DIR_ANALYSIS)
    os.makedirs(base, exist_ok=True)
    return base

def save_local_json(uid: Optional[str], data: Dict[str, Any], prefix: str) -> str:
    out_dir = ensure_user_dirs(uid)
    fname = f"{prefix}_{_ts()}.json"
    abspath = os.path.join(out_dir, fname)
    with open(abspath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return os.path.relpath(abspath, start=".")

def upload_json_to_gcs(uid: Optional[str], data: Dict[str, Any], prefix: str) -> str:
    if not USE_GCS:
        return ""
    bucket = gcs_client.bucket(GCS_BUCKET)
    base = f"{GCS_BASE_PREFIX.strip('/')}/" if GCS_BASE_PREFIX else ""
    user = uid if uid else "_public"
    fname = f"{prefix}_{_ts()}.json"
    blob_path = f"{base}{user}/{DIR_ANALYSIS}/{fname}"
    blob = bucket.blob(blob_path)
    blob.upload_from_string(json.dumps(data, ensure_ascii=False, indent=4), content_type="application/json")
    return f"gs://{GCS_BUCKET}/{blob_path}"

def download_gcs_text(uri: str) -> str:
    if not uri.startswith("gs://"):
        raise ValueError("gcs_uri inválido")
    _, rest = uri.split("gs://", 1)
    bucket_name, blob_path = rest.split("/", 1)
    bucket = storage.Client().bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_text(encoding="utf-8")

def limpiar_json(data: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for emocion, valores in data.items():
        if isinstance(valores, dict):
            try:
                pct = float(valores.get("porcentaje", 0))
            except:
                pct = 0.0
            entidades = valores.get("entidades", [])
            if not isinstance(entidades, list):
                entidades = [str(entidades)]
            out[emocion] = {"porcentaje": pct, "entidades": entidades}
    return out

@app.post("/analizar_emociones")
def analizar_emociones(
    entrada: TextoEntrada,
    user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
):
    """
    Entrada:
      - {"texto": "..."}  O  {"gcs_uri": "gs://bucket/carpeta/texto.txt"}
    Guarda JSON local y en GCS (si AN_USE_GCS=true).
    """
    try:
        if not entrada.texto and not entrada.gcs_uri:
            raise HTTPException(status_code=400, detail="Debes enviar 'texto' o 'gcs_uri'.")

        texto = entrada.texto or download_gcs_text(entrada.gcs_uri)

        prompt = f"""
            Analiza el siguiente texto y extrae estas emociones: {', '.join(TARGET_EMOTIONS)}.
            Para cada emoción encontrada, asigna un porcentaje (0-100) e identifica entidades relacionadas.

            Texto: {texto}

            Devuelve SOLO un JSON:
            {{
            "emocion": {{
                "porcentaje": 85.5,
                "entidades": ["entidad1","entidad2"]
            }}
            }}
        """
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        raw = response.candidates[0].content.parts[0].text.strip()
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            raise HTTPException(status_code=500, detail="No se encontró JSON en la respuesta del modelo.")

        parsed = json.loads(m.group())
        cleaned = limpiar_json(parsed)

        result = {
            "mensaje": "Análisis completado",
            "resultado": cleaned
        }

        # Guardar local y GCS
        local_path = save_local_json(user_id, result, "emociones")
        gcs_path = upload_json_to_gcs(user_id, result, "emociones") if USE_GCS else ""

        return {
            **result,
            "archivo_guardado_local": local_path,
            "archivo_guardado_gcs": gcs_path or None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
