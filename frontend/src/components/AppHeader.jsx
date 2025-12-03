// src/components/AppHeader.jsx
import React from "react";

export default function AppHeader({ onToggleSidebar, rightActions /*, title */ }) {
  return (
    <header className="app-header">
      {/* LADO IZQUIERDO */}
      <div className="app-header-left" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onToggleSidebar}
          className="btn icon app-header-menu"
          title="Abrir menú"
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Logo + Marca en línea */}
        <div
          className="app-header-logo-wrap"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span className="material-symbols-outlined app-header-logo" style={{ fontSize: 28 }}>
            neurology
          </span>
          <span
            className="app-header-brand"
            style={{ fontWeight: 800, fontSize: 18 }}
          >
            TerappIA
          </span>
        </div>
      </div>

      {/* LADO DERECHO */}
      <div className="app-header-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {rightActions}
      </div>
    </header>
  );
}
