// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./components/ProtectedRoute";

const LoginScreen = lazy(() => import("./pages/LoginScreen.jsx"));
const MainDashboard = lazy(() => import("./pages/MainDashboard.jsx"));
const GenerateProgressNote = lazy(() => import("./pages/GenerateProgressNote.jsx"));
const PatientList = lazy(() => import("./pages/PatientList.jsx"));
const RegisterNewPatient = lazy(() => import("./pages/RegisterNewPatient.jsx"));
const PatientProgressNoteOverview = lazy(() => import("./pages/PatientProgressNoteOverview.jsx"));
const Profile = lazy(() => import("./pages/profile.jsx"));
const CapturePhoto = lazy(() => import("./pages/CapturePhoto.jsx"));
const CaptureAudio = lazy(() => import("./pages/CaptureAudio.jsx"));
const ReviewText   = lazy(() => import("./pages/ReviweText.jsx"));
const NotesList = lazy(() => import("./pages/NotesList.jsx"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Private */}
        <Route path="/dashboard" element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
        <Route path="/generate-progress-note" element={<ProtectedRoute><GenerateProgressNote /></ProtectedRoute>} />
        <Route path="/patient-list" element={<ProtectedRoute><PatientList /></ProtectedRoute>} />
        <Route path="/register-new-patient" element={<ProtectedRoute><RegisterNewPatient /></ProtectedRoute>} />
        <Route path="/patient-progress-note-overview" element={<ProtectedRoute><PatientProgressNoteOverview /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Flujos de captura y revisión */}
        <Route path="/capture-photo" element={<ProtectedRoute><CapturePhoto /></ProtectedRoute>} />
        <Route path="/capture-audio" element={<ProtectedRoute><CaptureAudio /></ProtectedRoute>} />
        <Route path="/review-text"  element={<ProtectedRoute><ReviewText /></ProtectedRoute>} />

        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <NotesList />
            </ProtectedRoute>
          }
        />

        {/* Debug catch-all */}
        <Route path="*" element={<div className="p-10 text-xl">✅ Router working</div>} />

        
      </Routes>
    </Suspense>
  );
}
