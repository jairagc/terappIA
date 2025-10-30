# Backend Context

## Overview
The backend component consists of microservices architecture handling various data processing tasks.

## Directory Structure
- `/microservices/`: Core processing services
- `/orquestador/`: Orchestration service

## Key Components

### Microservices
1. **Analysis.py**: Emotion/sentiment analysis service
2. **Audio_transcriber.py**: Speech-to-text transcription service
3. **OCR.py**: Optical Character Recognition service
4. **Orchestrator.py**: Service coordination
5. **get_token.py**: Authentication token management

### Orchestrator Service
- `Dockerfile`: Container configuration
- `orchestrator.py`: Main orchestration logic
- `requirements.txt`: Python dependencies

## Data Storage
- `/data_local/`: Local storage for processed data
  - Organized by user ID
  - Separate directories for analysis, audio, and OCR results

## Dependencies
- Python-based microservices
- Firebase integration (serviceAccountKey.json)
- Docker containerization

## Role in System
The backend handles all data processing operations including:
- Speech recognition and transcription
- Text analysis and sentiment detection
- Document OCR processing
- Service orchestration and coordination