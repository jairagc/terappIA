# Orchestrator: FastAPI + httpx
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# deps del sistema (certs, build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY orchestrator_http.py /app/
# (opcional) si tienes más módulos, cópialos también
# COPY common/ /app/common/

RUN pip install --no-cache-dir fastapi uvicorn[standard] httpx pydantic

# Cloud Run inyecta $PORT
EXPOSE 8080
CMD ["sh","-c","uvicorn orchestrator_http:app --host 0.0.0.0 --port ${PORT:-8080}"]
