// src/pages/RegisterNewPatient.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterNewPatient() {

  const navigate = useNavigate();

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#0d121b] dark:text-white">
      <div className="layout-container flex h-full grow flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white dark:bg-background-dark shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between whitespace-nowrap h-16">
              <div className="flex items-center gap-4 text-primary">
                <div className="size-8">
                  <svg
                    className="text-primary"
                    fill="none"
                    viewBox="0 0 48 48"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-primary">
                  TerappIA
                </h2>
              </div>
              <button onClick={() => navigate("/generate-progress-note")} className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em]">
                <span className="truncate">Regresar</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap justify-between gap-3 mb-8">
              <p className="text-4xl font-black leading-tight tracking-[-0.033em] text-[#0d121b] dark:text-white min-w-72">
                Registrar paciente
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-8">
                {/* Patient data */}
                <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
                  <h2 className="text-[#0d121b] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-6">
                    Datos del paciente
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Nombre completo
                      </p>
                      <input
                        placeholder="Nombre completo"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Edad
                      </p>
                      <input
                        type="number"
                        placeholder="Edad"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Género
                      </p>
                      <select className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal">
                        <option value="one">Seleccionar género</option>
                        <option value="two">Masculino</option>
                        <option value="three">Femenino</option>
                        <option value="four">Otro</option>
                      </select>
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Teléfono
                      </p>
                      <input
                        type="tel"
                        placeholder="Número de teléfono"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col md:col-span-2">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Dirección
                      </p>
                      <input
                        placeholder="Dirección completa"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col md:col-span-2">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Correo electrónico
                      </p>
                      <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>
                  </div>
                </div>

                {/* Medical history */}
                <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
                  <h2 className="text-[#0d121b] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-6">
                    Historial médico
                  </h2>

                  <div className="grid grid-cols-1 gap-6">
                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Condiciones médicas previas
                      </p>
                      <textarea
                        placeholder="Liste condiciones relevantes..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Alergias
                      </p>
                      <textarea
                        placeholder="Liste alergias conocidas..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Medicamentos actuales
                      </p>
                      <textarea
                        placeholder="Liste medicamentos actuales..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Notas adicionales
                      </p>
                      <textarea
                        placeholder="Añada cualquier nota adicional aquí..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-1">
                <div className="sticky top-24">
                  <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
                    <h3 className="text-[#0d121b] dark:text-white text-lg font-bold mb-4">
                      Adjuntar documentos
                    </h3>
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark">
                      <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-500">
                        description
                      </span>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Arrastra y suelta archivos o
                      </p>
                      <button className="mt-4 flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em]">
                        <span className="truncate">Seleccionar archivos</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="mt-12 flex justify-center">
              <button onClick={() => navigate ("/patient-list")} className="flex min-w-[200px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em]">
                <span className="truncate">Registrar paciente</span>
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-background-dark/50 mt-auto border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 dark:text-gray-400">
              <div className="flex space-x-4 mb-4 sm:mb-0">
                <a href="#" className="hover:text-primary">
                  Contact Us
                </a>
                <a href="#" className="hover:text-primary">
                  Privacy Policy
                </a>
                <a href="#" className="hover:text-primary">
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
