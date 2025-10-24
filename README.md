## Levantamiento de servicios:
# OCR (puerto 8002)
uvicorn OCR:app --host 0.0.0.0 --port 8002 --reload

# Análisis (puerto 8001)
uvicorn Analysis:app --host 0.0.0.0 --port 8001 --reload

# Transcriptor de audio (puerto 8003)
uvicorn Audio_transcriber:app --host 0.0.0.0 --port 8003 --reload

# Orquestador (puerto 8080)
uvicorn Orchestrator:app --host 0.0.0.0 --port 8080 --reload

Pruebas rápidas
Windows CMD, par ala imagen (OCR)
curl -X POST "http://localhost:8080/orquestar" -H "X-User-Id: JenniferMorales" -F "file=@Backend\\Microservices\\images\\Nota1.jpg"

Windows CMD, para el audio
curl -X POST "http://localhost:8080/orquestar_audio" -H "X-User-Id: JenniferMorales" -F "file=@Backend\\Microservices\\audio\\nota1.m4a"

## prueba con gcs  , uri
OCR 
curl -X POST "http://localhost:8080/orquestar_foto" ^  -H "Authorization: Bearer <ID_TOKEN>" ^  -H "X-User-Id: JenniferMorales" ^  -F "gcs_uri=gs://ceroooooo/Nota1.jpg"

AUDIO
>curl -X POST "http://localhost:8080/orquestar_audio" ^  -H "Authorization: Bearer <ID_TOKEN>" ^  -H "X-User-Id: JenniferMorales" ^  -F "gcs_uri=gs://ceroooooo/AudioPrueba.m4a"