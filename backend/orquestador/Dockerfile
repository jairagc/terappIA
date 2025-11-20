# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Variables de entorno estándar de Python y para Cloud Run
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# --- MODIFICADO ---
# Se añaden las dependencias de sistema para WeasyPrint (libpango, libcairo, etc.)
# junto con las dependencias que ya tenías (curl, fontconfig).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    # Dependencias de WeasyPrint
    libpango-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libgobject-2.0-0 \
    && \
    # Limpia la caché de apt para mantener la imagen ligera
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Python (mejor caché)
# (Asegúrate de que 'weasyprint' esté en tu requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia del código
COPY orchestrator.py .

# --- Fuentes ---
# Copia tus .ttf al directorio estándar y reconstruye la caché de fuentes
# (Esto es necesario para que WeasyPrint encuentre las fuentes DejaVuSans)
RUN mkdir -p /usr/local/share/fonts/truetype/app
COPY DejaVuSans*.ttf /usr/local/share/fonts/truetype/app/
RUN fc-cache -f -v

# (Recomendado por Cloud Run) usuario no root
RUN useradd -m appuser
USER appuser

# Expone el puerto y ejecuta el comando
EXPOSE 8080
CMD ["sh","-c","uvicorn orchestrator:app --host 0.0.0.0 --port ${PORT:-8080}"]