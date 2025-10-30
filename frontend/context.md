# Frontend Context

## Overview
React-based web application using Vite as build tool, with Firebase integration and modern styling using Tailwind CSS.

## Key Components

### Core Structure
- `src/App.jsx`: Main application component
- `src/main.jsx`: Application entry point
- `index.html`: HTML template

### Component Architecture
- `/components/`
  - `Header.jsx`: Navigation header
  - `HistoryViewer.jsx`: Historical data viewer
  - `Login.jsx`: Authentication component
  - `PageShell.jsx`: Layout wrapper
  - `ProtectedRoute.jsx`: Auth route protection
  - `SentimentTester.jsx`: Sentiment analysis interface

### Pages
- `/pages/`
  - `GenerateProgressNote.jsx`: Note generation interface
  - `LoginScreen.jsx`: User authentication
  - `MainDashboard.jsx`: Main user interface
  - `PatientList.jsx`: Patient management
  - `PatientProgressNoteOverview.jsx`: Note review
  - `RegisterNewPatient.jsx`: Patient registration

### Services & Context
- `/services/`
  - `firebaseConfig.js`: Firebase configuration
- `/context/`
  - `AuthContext.jsx`: Authentication state management

## Configuration Files
- `vite.config.js`: Build configuration
- `tailwind.config.js`: Styling framework setup
- `nginx.conf`: Web server configuration
- `Dockerfile`: Container setup
- `.env`: Environment variables

## Dependencies
- React + Vite
- Tailwind CSS
- Firebase Authentication
- NGINX (Production)

## Role in System
- Provides user interface for therapists
- Manages authentication and authorization
- Interfaces with backend services
- Handles patient data visualization
- Manages progress note generation workflow