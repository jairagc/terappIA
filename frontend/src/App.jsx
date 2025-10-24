import { lazy, Suspense } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";

// ⬇️ Add your pages here as you create them
/* const DashboardOverview = lazy(() => import("./pages/DashboardOverview.jsx"));
const GenerateProgressNote = lazy(() => import("./pages/GenerateProgressNote.jsx"));
const PatientNoteView = lazy(() => import("./pages/PatientNoteView.jsx"));
const PatientDashboard = lazy(() => import("./pages/PatientDashboard.jsx")); */

//NEWWORK BABY
const LoginScreen = lazy(() => import("./pages/LoginScreen.jsx"));
const MainDashboard = lazy(() => import("./pages/MainDashboard.jsx"));
const GenerateProgressNote = lazy(() => import("./pages/GenerateProgressNote.jsx"));
const PatientList = lazy(() => import("./pages/PatientList.jsx"));
const RegisterNewPatient = lazy(() => import("./pages/RegisterNewPatient.jsx"));
const PatientProgressNoteOverview = lazy(() => import("./pages/PatientProgressNoteOverview.jsx"));

// Central registry so the index lists everything automatically
const PAGES = [
  /* { path: "/dashboard-overview", name: "Dashboard Overview", element: <DashboardOverview/> },
  { path: "/generate-progress-note", name: "Generate Progress Note", element: <GenerateProgressNote/> },
  { path: "/patient-note-view", name: "Patient Note View", element: <PatientNoteView/> },
  { path: "/patient-dashboard", name: "Patient Dashboard", element: <PatientDashboard/> }, */
  { path: "/login", name: "Login Screen", element: <LoginScreen /> },
  { path: "/dashboard", name: "Main Dashboard", element: <MainDashboard /> },
  { path: "/generate-progress-note", name: "Generate Progress Note", element: <GenerateProgressNote /> },
  { path: "/patient-list", name: "Patient List", element: <PatientList /> },
  { path: "/register-new-patient", name: "Register new patient", element: <RegisterNewPatient/>},
  { path: "/patient-progress-note-overview", name: "Patient Progress Note Overview", element: <PatientProgressNoteOverview/>},  
  
];

function Index() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-bold">UI Pages</h1>
        <p className="mb-6 text-gray-600">Click a page to open it:</p>
        <ul className="space-y-2">
          {PAGES.map(p => (
            <li key={p.path}>
              <Link
                to={p.path}
                className="block rounded-lg border bg-white px-4 py-3 hover:bg-gray-50"
              >
                {p.name} <span className="text-gray-400">({p.path})</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <Routes>
        <Route path="/" element={<Index />} />
        {PAGES.map(p => (
          <Route key={p.path} path={p.path} element={p.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
