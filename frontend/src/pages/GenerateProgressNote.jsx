// src/pages/GenerateProgressNote.jsx
import React from "react";

export default function GenerateProgressNote() {
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display">
      <div className="layout-container flex h-full grow flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-primary dark:text-white">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z"
                    fill="currentColor"
                  />
                </svg>
                <h2 className="text-xl font-bold leading-tight tracking-tight">
                  TerappIA
                </h2>
              </div>
              <div className="flex items-center gap-6">
                <a
                  href="#"
                  className="text-gray-700 dark:text-gray-200 text-sm font-medium"
                >
                  Notas de evolución
                </a>
                <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-wide">
                  <span className="truncate">Regresar</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 px-6 py-10">
          <div className="max-w-7xl mx-auto">
            {/* Select patient */}
            <div className="mb-8">
              <p className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-tighter">
                Seleccionar paciente
              </p>
              <div className="flex items-center gap-4 mt-6">
                <div className="flex-1 max-w-md">
                  <label htmlFor="patient-select" className="sr-only">
                    Seleccionar paciente
                  </label>
                  <select
                    id="patient-select"
                    className="form-select w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-14 pl-4 pr-10 text-base focus:border-primary focus:ring-primary"
                  >
                    <option>Seleccionar paciente</option>
                    <option>Ana García</option>
                    <option>Carlos Rodríguez</option>
                    <option>Sofía Martínez</option>
                  </select>
                </div>
                <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-wide">
                  <span className="truncate">Registrar nuevo paciente</span>
                </button>
              </div>
            </div>

            {/* Note section */}
            <div className="mb-8">
              <p className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-tighter">
                Nota de evolución
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Textarea */}
              <div className="md:col-span-2">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm h-full flex flex-col">
                  <textarea
                    placeholder="Escribe la nota de evolución aquí..."
                    className="w-full flex-1 rounded-lg border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-700 text-gray-900 dark:text-white p-4 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-primary focus:border-primary"
                  />
                  <div className="mt-4">
                    <button className="flex items-center justify-center rounded-full h-10 px-5 bg-white dark:bg-gray-700 text-primary dark:text-white border border-primary dark:border-white text-sm font-bold">
                      <span className="truncate">Añadir comentarios</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Side options */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Tomar captura
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Toma o sube una captura del ejercicio.
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Grabar voz
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    Graba o sube una nota de voz.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit button */}
            <div className="mt-12 text-center">
              <button className="flex min-w-[240px] max-w-sm mx-auto cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 px-8 bg-primary text-white text-lg font-bold leading-normal tracking-wide">
                <span className="truncate">Generar nota de evolución</span>
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-gray-800 mt-10">
          <div className="container mx-auto px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-600 dark:text-gray-400">
              <div className="flex gap-6 mb-4 md:mb-0">
                <a href="#" className="hover:text-primary dark:hover:text-white">
                  Contact Us
                </a>
                <a href="#" className="hover:text-primary dark:hover:text-white">
                  Privacy Policy
                </a>
                <a href="#" className="hover:text-primary dark:hover:text-white">
                  Terms of Service
                </a>
              </div>
              <p>© 2024 MentalHealthNLP. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
