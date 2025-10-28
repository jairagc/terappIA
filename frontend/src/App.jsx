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

export default function App() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Private */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/generate-progress-note"
          element={
            <ProtectedRoute>
              <GenerateProgressNote />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-list"
          element={
            <ProtectedRoute>
              <PatientList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/register-new-patient"
          element={
            <ProtectedRoute>
              <RegisterNewPatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient-progress-note-overview"
          element={
            <ProtectedRoute>
              <PatientProgressNoteOverview />
            </ProtectedRoute>
          }
        />

        {/* Debug catch-all */}
        <Route path="*" element={<div className="p-10 text-xl">✅ Router working</div>} />
      </Routes>
    </Suspense>
  );
}
