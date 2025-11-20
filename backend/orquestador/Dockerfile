# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Variables de entorno estándar de Python y para Cloud Run
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Instalar dependencias del sistema para WeasyPrint
# Se agregan libpangoft2, libharfbuzz y librerías de imagen para evitar errores futuros
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    # Dependencias de WeasyPrint
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libjpeg62-turbo \
    libopenjp2-7 \
    libxcb1 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libgobject-2.0-0 \
    && \
    # Limpia la caché de apt para mantener la imagen ligera
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código y fuentes
COPY orchestrator.py .

# Configuración de fuentes
RUN mkdir -p /usr/local/share/fonts/truetype/app
COPY DejaVuSans*.ttf /usr/local/share/fonts/truetype/app/
RUN fc-cache -f -v

# Usuario no root
RUN useradd -m appuser
USER appuser

EXPOSE 8080
CMD ["sh","-c","uvicorn orchestrator:app --host 0.0.0.0 --port ${PORT:-8080}"]