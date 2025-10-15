from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os, uuid, shutil, imghdr

app = FastAPI(title="Photo Service")

PHOTO_DATA_ROOT = os.getenv("PHOTO_DATA_ROOT", "data_photos")
os.makedirs(PHOTO_DATA_ROOT, exist_ok=True)

# índice simple id -> ruta
INDEX = {}

class PhotoOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    url: str
    mime: Optional[str] = None
    size: int

def _safe_ext(filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    return ext if ext in [".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"] else ".jpg"

@app.post("/photos", response_model=PhotoOut)
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Archivo vacío.")

    # Validación ligera
    mime = file.content_type or "application/octet-stream"
    if not (mime.startswith("image/")):
        raise HTTPException(415, "Solo imágenes (image/*).")

    # Persistencia local (hoy). Mañana aquí cambias a S3/MinIO/GCS.
    pid = uuid.uuid4().hex
    folder = os.path.join(PHOTO_DATA_ROOT, user_id or "_public")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, pid + _safe_ext(file.filename))

    with open(path, "wb") as f:
        f.write(raw)

    # Verificación opcional
    if not imghdr.what(path):
        # si no parece imagen, borra y rechaza
        try: os.remove(path)
        except: pass
        raise HTTPException(400, "Contenido no es imagen válida.")

    INDEX[pid] = path
    base = str(request.base_url).rstrip("/")      # p.ej. http://127.0.0.1:9003
    url = f"{base}/photos/{pid}"                  # URL que el OCR podrá leer

    return PhotoOut(id=pid, user_id=user_id, url=url, mime=mime, size=len(raw))

@app.get("/photos/{pid}")
def get_photo(pid: str):
    path = INDEX.get(pid)
    if not path or not os.path.exists(path):
        raise HTTPException(404, "No encontrada")
    # FastAPI detecta mime por extensión; si quieres ser explícito, añade media_type
    return FileResponse(path, media_type="image/jpeg")
