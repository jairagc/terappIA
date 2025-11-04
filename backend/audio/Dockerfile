FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY audio_transcriber.py /app/

EXPOSE 8080
CMD ["sh","-c","uvicorn audio_transcriber:app --host 0.0.0.0 --port ${PORT:-8080}"]
