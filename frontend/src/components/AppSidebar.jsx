import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDoctorProfile } from "../services/userDoctorProfile";

export default function AppSidebar({ collapsed = false }) {
  const { user } = useAuth();
  const { orgId, name, photoURL, email } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );

  return (
    <aside className={`app-sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* User card */}
      <div className="sidebar-user">
        <img
          src={photoURL}
          alt="Foto de perfil"
          className="sidebar-avatar"
          referrerPolicy="no-referrer"
        />
        {!collapsed && (
          <div className="user-meta">
            <p className="user-name trunc" title={name || ""}>{name || "—"}</p>
            {!!email && (
              <p className="user-email trunc" title={email}>
                {email}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          title="Inicio"
        >
          <span className="material-symbols-outlined">house</span>
          {!collapsed && <span className="nav-text trunc">Inicio</span>}
        </NavLink>

        <NavLink
          to="/generate-progress-note"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          title="Nueva nota"
        >
          <span className="material-symbols-outlined">add_notes</span>
          {!collapsed && <span className="nav-text trunc">Nueva nota</span>}
        </NavLink>

        <NavLink
          to="/patient-list"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          title="Pacientes"
        >
          <span className="material-symbols-outlined">group</span>
          {!collapsed && <span className="nav-text trunc">Pacientes</span>}
        </NavLink>

        <NavLink
          to="/notes"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          title="Notas"
        >
          <span className="material-symbols-outlined">notes</span>
          {!collapsed && <span className="nav-text trunc">Notas</span>}
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          title="Perfil"
        >
          <span className="material-symbols-outlined">account_circle</span>
          {!collapsed && <span className="nav-text trunc">Perfil</span>}
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          title="Configuración"
        >
          <span className="material-symbols-outlined">palette</span>
          {!collapsed && <span className="nav-text trunc">Configuración</span>}
        </NavLink>
      </nav>

      {/* Footer fijo (org hasta abajo) */}
      <div className="sidebar-footer">
        {!collapsed ? (
          <div className="org-chip" title={orgId || "Sin organización"}>
            <span className="material-symbols-outlined">business</span>
            <span className="trunc">{orgId || "—"}</span>
          </div>
        ) : (
          <div className="org-icon" title={orgId || "Sin organización"}>
            <span className="material-symbols-outlined">business</span>
          </div>
        )}
        {!collapsed && <div className="copyright">© TerappIA</div>}
      </div>
    </aside>
  );
}
