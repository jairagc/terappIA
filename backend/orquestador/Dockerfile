FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY orchestrator.py /app/

EXPOSE 8080
CMD ["sh","-c","uvicorn orchestrator:app --host 0.0.0.0 --port ${PORT:-8080}"]
# syntax=docker/dockerfile:1
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# Paquetes mínimos + fontconfig para registrar las fuentes
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl fontconfig && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero (mejor caché)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia del código
COPY orchestrator.py .

# --- Fuentes ---
# Copia tus .ttf al directorio estándar y reconstruye la caché de fuentes
# (asegúrate de que .dockerignore NO excluya *.ttf)
RUN mkdir -p /usr/local/share/fonts/truetype/app
COPY DejaVuSans*.ttf /usr/local/share/fonts/truetype/app/
RUN fc-cache -f -v

# (Opcional recomendado por Cloud Run) usuario no root
RUN useradd -m appuser
USER appuser

EXPOSE 8080
CMD ["sh","-c","uvicorn orchestrator:app --host 0.0.0.0 --port ${PORT:-8080}"]
