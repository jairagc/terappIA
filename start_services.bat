@echo off
cd backend\microservices
start cmd /k "..\..\\.venv\Scripts\python -m uvicorn Analysis:app --port 8001 --reload"
start cmd /k "..\..\\.venv\Scripts\python -m uvicorn Audio_transcriber:app --port 8002 --reload"
start cmd /k "..\..\\.venv\Scripts\python -m uvicorn OCR:app --port 8003 --reload"
cd ..\orquestador
start cmd /k "..\..\\.venv\Scripts\python -m uvicorn orchestrator:app --port 8000 --reload"