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

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import os
import json
from datetime import datetime
import re

# Vertex AI imports
from vertexai.generative_models import GenerativeModel
import vertexai

# Inicializar Vertex AI
PROJECT_ID = "terapia-471517" 
LOCATION = "us-central1"     
vertexai.init(project=PROJECT_ID, location=LOCATION)

# Instanciar el modelo Gemini Flash 2.0
model = GenerativeModel("gemini-2.5-flash-lite")

# Emociones base que queremos identificar
TARGET_EMOTIONS = [
    "alegria", "tristeza", "enojo", "miedo","aversión",
    "sorpresa", "disgusto", "estres", "calma","anticipación"
]

# Carpeta donde se guardarán los JSON
OUTPUT_DIR = "pruebas_analisis"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# FastAPI app
app = FastAPI(title="API Análisis de Emociones con Gemini Flash 2.0")

# Modelo de entrada
class TextoEntrada(BaseModel):
    texto: str

# Función para limpiar JSON (asegura formato consistente)
def limpiar_json(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Limpia y organiza el JSON para tener solo campos relevantes.
    """
    resultado = {}
    for emocion, valores in data.items():
        if isinstance(valores, dict):
            resultado[emocion] = {
                "porcentaje": float(valores.get("porcentaje", 0)),
                "entidades": valores.get("entidades", [])
            }
    return resultado

# Función para guardar el JSON
def guardar_json(data: Dict[str, Any]) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(OUTPUT_DIR, f"emociones_{timestamp}.json")
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return filename

@app.post("/analizar_emociones")
def analizar_emociones(entrada: TextoEntrada):
    """
    Endpoint que recibe un texto, analiza emociones y entidades relacionadas
    usando Gemini Flash 2.0 en Vertex AI.
    """
    try:
        prompt = f"""
        Analiza el siguiente texto y extrae las siguientes emociones: {', '.join(TARGET_EMOTIONS)}.
        Para cada emoción encontrada, asigna un porcentaje de certeza (0-100%).
        Además, identifica entidades relacionadas (lugares, personas, objetos, organizaciones) asociadas a cada emoción.

        Texto: {entrada.texto}

        Devuelve el resultado en formato JSON con este formato:
        {{
          "emocion": {{
            "porcentaje": 85.5,
            "entidades": ["entidad1", "entidad2"]
          }}
        }}
        """

        response = model.generate_content(prompt, generation_config={
        "response_mime_type": "application/json"
    })

        # Extraer texto de la respuesta
        raw_text = response.candidates[0].content.parts[0].text.strip()

        # Intentar encontrar un bloque JSON válido dentro del texto
        match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if not match:
            raise HTTPException(status_code=500, detail="No se encontró JSON en la respuesta del modelo.")

        try:
            raw_json = json.loads(match.group())
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al parsear JSON: {str(e)}")

        # Limpiar y guardar
        cleaned = limpiar_json(raw_json)
        filepath = guardar_json(cleaned)

        return {
            "mensaje": "Análisis completado",
            "resultado": cleaned,
            "archivo_guardado": filepath
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
