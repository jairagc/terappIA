// src/components/AppSidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDoctorProfile } from "../services/userDoctorProfile";

/**
 * Sidebar reusable y colapsable (controlado por el padre).
 * Ya NO renderiza botón interno de colapsar; usa el del header.
 * Props:
 *  - collapsed (bool)
 */
export default function AppSidebar({ collapsed = false }) {
  const { user } = useAuth();
  const { orgId, name, photoURL, email } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );

  return (
    <aside
      className={`flex flex-col bg-light-gray dark:bg-[#141a24] transition-all duration-200 ${
        collapsed ? "w-16" : "w-72"
      } p-3`}
    >
      {/* User card */}
      <div className="flex items-center gap-3 mb-6">
        <img
          src={photoURL}
          alt="Foto de perfil"
          className="h-10 w-10 rounded-full object-cover"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-dark-navy dark:text-white">
              {name}
            </p>
            {/* Mostrar correo debajo del nombre */}
            {!!email && (
              <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                {email}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-text-primary hover:bg-calm-blue ${
              isActive ? "bg-calm-blue" : ""
            }`
          }
          title="Inicio"
        >
          <span className="material-symbols-outlined">house</span>
          {!collapsed && <span>Inicio</span>}
        </NavLink>
        
        <NavLink
          to="/generate-progress-note"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-text-primary hover:bg-calm-blue ${
              isActive ? "bg-calm-blue" : ""
            }`
          }
          title="Nueva nota"
        >
          <span className="material-symbols-outlined">add_notes</span>
          {!collapsed && <span>Nueva nota</span>}
        </NavLink>

        <NavLink
          to="/patient-list"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-text-primary hover:bg-calm-blue ${
              isActive ? "bg-calm-blue" : ""
            }`
          }
          title="Pacientes"
        >
          <span className="material-symbols-outlined">group</span>
          {!collapsed && <span>Pacientes</span>}
        </NavLink>

        <NavLink
          to="/notes"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-text-primary hover:bg-calm-blue ${
              isActive ? "bg-calm-blue" : ""
            }`
          }
          title="Notas"
        >
          <span className="material-symbols-outlined">notes</span>
          {!collapsed && <span>Notas</span>}
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-text-primary hover:bg-calm-blue ${
              isActive ? "bg-calm-blue" : ""
            }`
          }
          title="Perfil"
        >
          <span className="material-symbols-outlined">account_circle</span>
          {!collapsed && <span>Perfil</span>}
        </NavLink>

        <button
          type="button"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-text-primary hover:bg-calm-blue"
          title="Configuración"
          onClick={() => {}}
        >
          <span className="material-symbols-outlined">settings</span>
          {!collapsed && <span>Configuración</span>}
        </button>
      </nav>

      <div className="mt-auto pt-4 text-[11px] text-gray-500 dark:text-gray-400">
        {!collapsed && (
          <>
            <div>
              Org: <span className="font-semibold">{orgId || "—"}</span>
            </div>
            <div>© TerappIA</div>
          </>
        )}
      </div>
    </aside>
  );
}
