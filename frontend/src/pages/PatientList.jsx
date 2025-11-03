// src/pages/PatientList.jsx
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
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display">
      {/* Sidebar */}
      <div className="w-64 bg-[#f5f5f5] dark:bg-gray-800 p-4 flex flex-col justify-between rounded-r-xl">
        <div>
          <h2 className="text-xl font-bold mb-8 text-[#0d121b] dark:text-white">
            Pacientes
          </h2>
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => navigate("/dashboard")}
              href="#"
              className="flex items-center gap-3 px-3 py-2 text-[#0d121b] dark:text-white"
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-medium">Main dashboard</span>
            </button>
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#e7ebf3] dark:bg-primary/30 text-[#0d121b] dark:text-white"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                group
              </span>
              <span className="font-medium">Pacientes</span>
            </a>
          </nav>
        </div>

        {/* User info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA0b5HsP6gzFWC--bW-J5g4oUlPfiZyfdWzHY81CCGXpZCV5GEE5gS6fqzvHreBfS_DvznwOXICvckFa5n2arTTElXLLfATdZm-K3pGJB-aHYCvx6sSHkuZ4oIw1AO0boJVBzkGB0nFpc5FjMS1xA1pl9A3qmkieVc0Xn-c8lVDJ8vvtl1SnQ-PrVkJtdz8x8iAchU_Rg82no6ttOzJPqAMdiXc-ivfTS6peGXLRPUND6qjf0wYwf5uI5TaarQmkk4EPXqrJkbiTnE')",
              }}
            ></div>
            <div className="flex flex-col">
              <h1 className="text-[#0d121b] dark:text-white text-base font-medium">
                Doctor
              </h1>
              <p className="text-blue-500 text-sm font-normal">
                doctor@example.com
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <a
              href="#"
              className="flex items-center gap-3 px-3 py-2 text-[#0d121b] dark:text-white"
            >
              <span className="material-symbols-outlined">settings</span>
              <span className="text-sm font-medium">Configuración</span>
            </a>
            <button onClick={handleLogout}
              href="#"
              className="flex items-center gap-3 px-3 py-2 text-[#0d121b] dark:text-white"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="text-sm font-medium">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <header>
          <p className="text-[#0d121b] dark:text-white text-4xl font-black tracking-[-0.033em]">
            Lista de pacientes del usuario
          </p>
        </header>

        {/* Filters */}
        <div className="mt-6 p-3 rounded-lg bg-[#f5f5f5] dark:bg-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            {["Búsqueda avanzada", "Últimos 7 días", "Importancia"].map(
              (label) => (
                <button
                  key={label}
                  className="flex h-8 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-gray-700 px-4"
                >
                  <p className="text-[#0d121b] dark:text-white text-sm font-medium">
                    {label}
                  </p>
                  <span className="material-symbols-outlined text-[#0d121b] dark:text-white text-base">
                    expand_more
                  </span>
                </button>
              )
            )}
            <div className="flex items-center gap-2">
              <label
                htmlFor="search-date"
                className="text-sm font-medium text-[#0d121b] dark:text-white"
              >
                Buscar por fecha:
              </label>
              <input
                id="search-date"
                type="date"
                className="h-8 rounded-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
            </div>
            <button className="flex h-8 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-gray-700 px-4">
              <p className="text-[#0d121b] dark:text-white text-sm font-medium">
                Aplicar filtros
              </p>
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate("/generate-progress-note")} className="flex min-w-[84px] items-center justify-center rounded-lg h-10 px-4 bg-primary text-white">
              <span>Crear nueva nota</span>
            </button>
            <button onClick={() => navigate("/register-new-patient")} className="flex min-w-[84px] items-center justify-center rounded-lg h-10 px-4 bg-primary text-white">
              <span>Agregar paciente</span>
            </button>
          </div>
        </div>
        
        
        {/* Patient Cards */}

        {/* 
        <div className="mt-6 space-y-4">
          {[
            {
              name: "Nota de evolución. Paciente XXYX",
              desc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
              initials: "AB",
              sessions: "45 sesiones, 15 faltantes",
              img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCkW2G-TSKlDZ35FTcohux_3Ojk6u0cjVJh5Me-BgRRYiLDAR5nVcjHCEu50c0mIdYrpe3MweYkuMsSrAny7uJvYkLX7D809SsMneITJbbWtgkHRA7XR_iU1uYyTwybg22PiVwPKo8SG4oimn6Ei3KgABbgAb34uHQdC825Ja2a26ThOlvzj4PyVRoeLVZM07iKkr-WllXi1t05JzU0dZZQXLMQqh7thRp-hyvBcuq3l0mDNvZ_Vtl_CC0OnSNGAOeutmttcTUxbBA",
            },
            {
              name: "Nota de evolución. Paciente ZWPV",
              desc: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
              initials: "CD",
              sessions: "30 sesiones, 5 faltantes",
              img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBDCGxjiqzGdHNLR3k_3XvuDZ2I2v9SsuW4onXVPi1pO5yLWQNGy6XzszRMexSbEmjbQN33Es6lwrtx9jglC0l36xTacuH5Se-04Sn4oJA0zWp4TJIL_72FuSqpR5_s4L_PHCXBhKcLeJx_0QOJV0MeUlLpKjXxCJSW18ZDcb4Tw46z9lYOP37wXanIXA9jTeFoI5brHXlJAp3K9RBnXeAcAVXjDj-BLqE3GJ_xJjRz5Ht7OOn7r3jSVF4XklDH17SCCJJUGmZKEhA",
            },
            {
              name: "Nota de evolución. Paciente MNQR",
              desc: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
              initials: "EF",
              sessions: "60 sesiones, 30 faltantes",
              img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBlwACkxpEoT6D4zqrzYTBVIxEb9YBYKnXj2eXZb2iR5EsJrMOu8KbnIm6HltwctfIxOrJiXh3RS77UDJnQ7H-v7tPeo1m2E0rz9737IRziJh9VkcoZQ1nyY2EwbyH_d_A8yr7BwRwoqeDOBBC_yKjpKodnlJcp3q7UOKIMQY4ep-nskhmtMZi7AgRz5cSmrOB_flLr3yk_fnMo-l-5Dai-UqozYFJEeAeEF99PaugIIuTw9v4AZSlpHBXo1IUYOVeufe8S1HFgbb4",
            },
          ].map((patient, i) => (
            <React.Fragment key={i}>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg flex items-center gap-4">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12"
                  style={{ backgroundImage: `url('${patient.img}')` }}
                ></div>
                <div className="flex-grow">
                  <p className="text-[#0d121b] dark:text-white text-base font-bold">
                    {patient.name}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    {patient.desc}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[#0d121b] dark:text-white font-bold text-lg">
                    {patient.initials}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    {patient.sessions}
                  </p>
                </div>
                <button className="flex items-center justify-center rounded-lg h-10 px-4 bg-[#e7ebf3] dark:bg-gray-700 text-[#0d121b] dark:text-white font-medium">
                  Ver resumen
                </button>
              </div>
              {i < 2 && (
                <hr className="border-gray-200 dark:border-gray-700" />
              )}
            </React.Fragment>
          ))}
        </div>
        */}
      </div>
    </div>
  );
}
