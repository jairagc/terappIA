from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from pydantic import BaseModel
from typing import Optional, Dict
import os, json
from datetime import datetime
import httpx
import logging
from google.cloud import vision

app = FastAPI(title="API OCR con Google Cloud Vision")
logger = logging.getLogger("ocr")
logging.basicConfig(level=logging.INFO)

OUTPUT_DIR = "pruebas_ocr"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VISION_CLIENT = vision.ImageAnnotatorClient()

class OCRResultado(BaseModel):
    texto: str
    archivo_guardado: Optional[str] = None

def guardar_json(data: Dict) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(OUTPUT_DIR, f"ocr_{ts}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return path

@app.post("/ocr", response_model=OCRResultado)
async def analizar_ocr(
    file: Optional[UploadFile] = File(None),
    file_url: Optional[str] = Form(None),
    gcs_uri: Optional[str] = Form(None),
):
    """
    Acepta: file (multipart), file_url (HTTP[S]), gcs_uri (gs://...).
    """
    try:
        if not any([file, file_url, gcs_uri]):
            raise HTTPException(status_code=400, detail="Envía 'file', 'file_url' o 'gcs_uri'.")

        # 1) Construir 'image' según el origen, SIN usar image_bytes fuera del bloque
        if gcs_uri:
            logger.info("OCR: usando gcs_uri=%s", gcs_uri)
            image = vision.Image(source=vision.ImageSource(image_uri=gcs_uri))

        elif file is not None:
            logger.info("OCR: usando file UploadFile (filename=%s, content_type=%s)", file.filename, file.content_type)
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Archivo vacío o no válido.")
            image = vision.Image(content=data)

        else:
            logger.info("OCR: usando file_url=%s", file_url)
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.get(file_url)
                if r.status_code >= 400:
                    raise HTTPException(status_code=502, detail=f"No se pudo descargar file_url: {r.text}")
                data = r.content
            if not data:
                raise HTTPException(status_code=400, detail="Imagen vacía o no válida.")
            image = vision.Image(content=data)

        # 2) Ejecutar OCR (común)
        response = VISION_CLIENT.text_detection(image=image)
        if response.error.message:
            raise HTTPException(status_code=500, detail=response.error.message)

        texto_detectado = (response.full_text_annotation.text or "").strip()
        filepath = guardar_json({"texto": texto_detectado})

        logger.info("OCR: texto_len=%d, json_guardado=%s", len(texto_detectado), filepath)
        return OCRResultado(texto=texto_detectado or "", archivo_guardado=filepath)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("OCR: excepción inesperada")
        raise HTTPException(status_code=500, detail=str(e))
