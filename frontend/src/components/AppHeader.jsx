import React from "react";

export default function AppHeader({ onToggleSidebar, rightActions, title }) {
  return (
    <header className="app-header">
      <div style={{display:"flex", alignItems:"center", gap:12}}>
        <button
          onClick={onToggleSidebar}
          className="btn icon"
          title="Abrir menú"
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <span className="material-symbols-outlined" style={{fontSize: 28}}>neurology</span>
        <h1 style={{margin:0, fontSize: 20, fontWeight: 800}}>TerappIA</h1>
        {title && <span style={{marginLeft: 8, opacity:.65}}>/ {title}</span>}
      </div>

      <div style={{display:"flex", alignItems:"center", gap:8}}>
        {rightActions}

      </div>
    </header>
  );
}
