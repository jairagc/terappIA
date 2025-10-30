# TerappIA System Overview

## System Architecture
TerappIA is a full-stack application designed for therapeutic note-taking and analysis, consisting of:
- Frontend web application (React/Vite)
- Backend microservices (Python)
- Data processing capabilities (Audio, Text, OCR)

## Main Components

### Frontend (`/frontend`)
- Web-based user interface
- Patient management system
- Progress note generation
- Authentication and authorization

### Backend (`/backend`)
- Microservices architecture
- Data processing services
- Service orchestration
- Local data storage

## Key Features
1. Audio transcription
2. Sentiment/emotion analysis
3. Document OCR processing
4. Progress note generation
5. Patient data management

## Technology Stack
- Frontend: React, Vite, Tailwind CSS
- Backend: Python, FastAPI
- Authentication: Firebase
- Deployment: Docker
- Storage: Local file system + Firebase

## Documentation
- `BasesDeDatos.md`: Database documentation
- `README.md`: Project overview
- Context files in each directory

## Development Workflow
1. Frontend development in `/frontend`
2. Backend service development in `/backend/microservices`
3. Integration via orchestrator
4. Containerized deployment

## Testing
Test files and sample data located in:
- `/archivosPrueba`
- `/backend/microservices/data_local`