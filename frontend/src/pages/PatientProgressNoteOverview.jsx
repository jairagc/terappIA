// src/pages/PatientProgressNoteOverview.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PatientList() {

  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    try {
      await logout();             // Firebase signOut via AuthContext
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };
  
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden lg:flex-row bg-background-light dark:bg-background-dark font-display text-[#0d121b] dark:text-white">
      {/* Sidebar */}
      <aside className="flex-shrink-0 w-full lg:w-64 bg-gray-100 dark:bg-gray-800 p-4 flex flex-col justify-between">
        <div>
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Paciente
            </h3>
            <nav className="space-y-2">
              <a
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-3 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-primary/10 dark:hover:bg-primary/20"
              >
                <span className="material-symbols-outlined">dashboard</span>
                <span>Main Dashboard</span>
              </a>
              <a
                href="#"
                className="flex items-center gap-3 p-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary font-semibold"
              >
                <span className="material-symbols-outlined">note_alt</span>
                <span>Notas de evolución</span>
              </a>
            </nav>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAS_Pgvr23t1FHdp9KkSjFeve6Z5qa-mgPwBFhkYmi4UQWwK_PWTHyh5cyPuGrzWOdNzeIeZ2Y9bT9kI2IS_7e65JiRliTkE-vuo6PRakz13xsq3Fh38F5w9x_IcEe1h6G4o-Y-gP5IZeJOIjSewubW7JDD4Vn7wcLaGOT-deIiVKbc03yEVXoF6X0H1AI8tfHk3ZrIlu9YZVSRznwQv-G74U7GczBp5LGrfnusSfQ2X5R9CrDbNsgBA4qh9fP5M-MPf5r789tfcYI"
              alt="Doctor profile"
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="font-semibold text-sm">Doctor</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                doctor@terappia.com
              </p>
            </div>
          </div>
          <a
            href="#"
            className="flex items-center gap-3 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <span className="material-symbols-outlined">settings</span>
            <span>Configuración</span>
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
          {/* Search and top buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar nota específica del paciente"
                className="form-input w-full pl-10 pr-4 py-2 rounded-lg border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark focus:ring-primary/50 focus:border-primary/50"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 text-primary font-medium">
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button className="flex min-w-[84px] max-w-[480px] items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold">
                Detalles
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="relative text-center mb-6">
            <h1 className="text-2xl font-bold">Nota del paciente</h1>
            <button className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              Nombre del paciente: Juan Pérez
            </span>
            <span className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
              Fecha: 15/05/2024
            </span>
            <span className="inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
              Casos de paciente: Ansiedad
            </span>
            <span className="inline-block bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
              Importancia: Alta
            </span>
          </div>

          {/* Text extracted */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Texto extraído</h2>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-inner">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                El paciente refiere sentirse constantemente preocupado y ansioso
                durante las últimas dos semanas. Menciona dificultades para
                conciliar el sueño y una pérdida de apetito. Ha experimentado
                palpitaciones y sudoración en situaciones sociales. Expresa
                temor a no poder controlar sus preocupaciones.
              </p>
            </div>
          </div>

          {/* Emotions */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Emociones extraídas</h2>
            <div className="flex flex-wrap gap-2">
              {["Feliz", "Triste", "Enojo", "Miedo"].map((emotion, i) => {
                const colors = [
                  "bg-yellow-100 text-yellow-800",
                  "bg-blue-100 text-blue-800",
                  "bg-red-100 text-red-800",
                  "bg-purple-100 text-purple-800",
                ];
                return (
                  <span
                    key={emotion}
                    className={`inline-block ${colors[i]} text-xs font-medium px-2.5 py-1 rounded-full`}
                  >
                    {emotion}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Attachments and resources */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Archivos adjuntos</h3>
              <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay archivos adjuntos disponibles
                </p>
                <button className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Adjuntar archivo
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Recursos relacionados</h3>
              <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay links incluidos
                </p>
                <button className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Adjuntar archivo
                </button>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-8 flex justify-center gap-4">
            <button className="flex min-w-[160px] items-center justify-center rounded-lg h-12 px-6 bg-green-600 text-white text-base font-bold">
              Guardar nota
            </button>
            <button className="flex min-w-[160px] items-center justify-center rounded-lg h-12 px-6 bg-blue-600 text-white text-base font-bold">
              Modificar nota
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
