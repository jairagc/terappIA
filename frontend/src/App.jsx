// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "./components/ProtectedRoute";

const NotesList = lazy(() => import("./pages/NotesList.jsx"));
const LoginScreen = lazy(() => import("./pages/LoginScreen.jsx"));
const MainDashboard = lazy(() => import("./pages/MainDashboard.jsx"));
const GenerateProgressNote = lazy(() => import("./pages/GenerateProgressNote.jsx"));
const PatientList = lazy(() => import("./pages/PatientList.jsx"));
const RegisterNewPatient = lazy(() => import("./pages/RegisterNewPatient.jsx"));
const PatientProgressNoteOverview = lazy(() => import("./pages/PatientProgressNoteOverview.jsx"));
const Profile = lazy(() => import("./pages/profile.jsx"));
// OJO: si ya renombraste el archivo, usa el nombre correcto:
const ReviewText = lazy(() => import("./pages/ReviweText.jsx"));
const ColorSettings = lazy(() => import("./pages/ColorSettings.jsx"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-8">Cargando…</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        {/* público */}
        <Route path="/login" element={<LoginScreen />} />
        {/* privadas */}
        <Route path="/dashboard" element={<ProtectedRoute><MainDashboard /></ProtectedRoute>} />
        <Route path="/generate-progress-note" element={<ProtectedRoute><GenerateProgressNote /></ProtectedRoute>} />
        <Route path="/patient-list" element={<ProtectedRoute><PatientList /></ProtectedRoute>} />
        <Route path="/register-new-patient" element={<ProtectedRoute><RegisterNewPatient /></ProtectedRoute>} />
        <Route path="/patient-progress-note-overview" element={<ProtectedRoute><PatientProgressNoteOverview /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/review-text" element={<ProtectedRoute><ReviewText /></ProtectedRoute>} />

        {/* ✅ Ruta correcta para la lista de notas */}
        <Route path="/notes" element={<ProtectedRoute><NotesList /></ProtectedRoute>} />

        {/* Configuración de colores */}
        <Route path="/settings" element={<ProtectedRoute><ColorSettings /></ProtectedRoute>} />

        <Route path="*" element={<div className="p-10 text-xl">✅ Router working</div>} />
      </Routes>
    </Suspense>
  );
}
