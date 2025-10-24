// src/pages/MainDashboard.jsx
import React from "react";

export default function MainDashboard() {
  return (
    <div className="flex h-screen flex-col bg-background-light dark:bg-background-dark font-display text-text-primary">
      {/* Header */}
      <header className="flex h-16 w-full items-center justify-between bg-dark-navy px-6 text-white">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-white text-3xl">
            neurology
          </span>
          <h1 className="text-xl font-bold">TerappIA</h1>
        </div>
        <a
          href="#"
          className="text-sm font-medium hover:underline"
        >
          Cerrar sesión
        </a>
      </header>

      {/* Main layout */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="flex w-64 flex-col bg-light-gray p-4">
          <div className="mb-4 h-10 flex items-center justify-center bg-calm-blue rounded-md text-dark-navy font-semibold">
            Barra rápida
          </div>
          <nav className="flex flex-col space-y-2">
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-text-primary hover:bg-calm-blue"
            >
              <span className="material-symbols-outlined">build</span>
              <span>Perfil</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-text-primary hover:bg-calm-blue"
            >
              <span className="material-symbols-outlined">settings</span>
              <span>Configuración</span>
            </a>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-white p-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Card 1 */}
            <div className="flex flex-col items-center justify-center rounded-xl bg-calm-blue p-8 text-center shadow-subtle">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
                <span className="material-symbols-outlined text-4xl text-dark-navy">
                  description
                </span>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-dark-navy">
                Notas de evolución
              </h2>
              <p className="mb-6 text-text-secondary">
                Genera y modifica notas de evolución.
              </p>
              <button className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg bg-dark-navy px-5 py-3 text-base font-bold text-white shadow-md transition-colors duration-300 hover:bg-opacity-90">
                Generar notas
              </button>
            </div>

            {/* Card 2 */}
            <div className="flex flex-col items-center justify-center rounded-xl bg-calm-blue p-8 text-center shadow-subtle">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
                <span className="material-symbols-outlined text-4xl text-dark-navy">
                  search
                </span>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-dark-navy">
                Consultar notas
              </h2>
              <p className="mb-6 text-text-secondary">
                Revisa y analiza notas previamente registradas.
              </p>
              <button className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg bg-dark-navy px-5 py-3 text-base font-bold text-white shadow-md transition-colors duration-300 hover:bg-opacity-90">
                Consultar notas
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between bg-dark-navy p-4 text-white">
        <div className="text-sm">
          <p>contacto@terappia.com</p>
          <p>+1 (234) 567-890</p>
        </div>

        <div className="flex space-x-4">
          {/* Twitter */}
          <a href="#" className="text-white hover:text-gray-300">
            <svg
              className="h-6 w-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M22.46,6C21.69,6.35 20.86,6.58 20,6.69C20.88,6.16 21.56,5.32 21.88,4.31C21.05,4.81 20.13,5.16 19.16,5.36C18.37,4.5 17.26,4 16,4C13.65,4 11.73,5.92 11.73,8.29C11.73,8.63 11.77,8.96 11.84,9.28C8.28,9.09 5.11,7.38 3,4.79C2.63,5.42 2.42,6.16 2.42,6.94C2.42,8.43 3.17,9.75 4.33,10.5C3.62,10.48 2.96,10.29 2.38,10V10.03C2.38,12.11 3.86,13.85 5.82,14.24C5.46,14.34 5.08,14.39 4.69,14.39C4.42,14.39 4.15,14.36 3.89,14.31C4.43,16.03 6.02,17.25 7.89,17.29C6.43,18.45 4.58,19.13 2.56,19.13C2.22,19.13 1.88,19.11 1.54,19.07C3.44,20.29 5.7,21 8.12,21C16,21 20.33,14.46 20.33,8.79C20.33,8.56 20.33,8.34 20.32,8.12C21.17,7.5 21.88,6.81 22.46,6Z" />
            </svg>
          </a>

          {/* Instagram */}
          <a href="#" className="text-white hover:text-gray-300">
            <svg
              className="h-6 w-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.148-4.771-1.691-4.919-4.919-.058-1.265-.069-1.645-.069-4.85s.011-3.584.069-4.85c.149-3.225 1.664-4.771 4.919-4.919C8.416 2.175 8.796 2.163 12 2.163m0-2.163C8.74 0 8.333.012 7.053.072 2.695.272.273 2.69.073 7.052.012 8.333 0 8.74 0 12s.012 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.988 8.74 24 12 24s3.667-.012 4.947-.072c4.358-.2 6.78-2.618 6.98-6.98.06-1.28.072-1.687.072-4.947s-.012-3.667-.072-4.947c-.2-4.358-2.618-6.78-6.98-6.98C15.667.012 15.26 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z" />
            </svg>
          </a>

          {/* LinkedIn */}
          <a href="#" className="text-white hover:text-gray-300">
            <svg
              className="h-6 w-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}
