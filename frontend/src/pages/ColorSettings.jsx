import React, { useState } from "react";
import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

const THEMES = {
  coastal: { label: "Coastal Blues", chips: ["#33539E", "#7FACD6", "#BFB8DA", "#FEB7D4", "#A5678E"] },
  pastel:  { label: "Pastel Sunny",  chips: ["#ACC182", "#D0E6A5", "#FFDD94", "#FA897B", "#CCABDB"] },
  warm:    { label: "Warm Neutrals", chips: ["#B88F5B", "#D0B7B3", "#F0E0DC", "#F9DDCF", "#909B84"] },
  
  // --- NUEVAS PALETAS AGREGADAS ---
  neuron:  { label: "Neuron Greens", chips: ["#3B5284", "#5B8A8A", "#CBE54E", "#94B447", "#5D6E1E"] },
  autumn:  { label: "Autumn Harvest",chips: ["#F28930", "#E3AF38", "#F6A685", "#D0C2CF", "#F6D3BD"] },
  rose:    { label: "Rose & Slate",  chips: ["#DE5B6D", "#478BA2", "#E9765B", "#F2A490", "#B9D4DB"] },
  // --------------------------------
};

const FONT_OPTIONS = [
  { label: "Pequeña (14px)", value: "14px", description: "Fuente ideal para pantallas grandes." },
  { label: "Normal (16px)",  value: "16px", description: "Recomendada (predeterminada)." },
  { label: "Grande (18px)",  value: "18px", description: "Accesibilidad mejorada." },
];

export default function ColorSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // ThemeContext (con fallback seguro)
  const themeCtx = useTheme?.() ?? {};
  const theme = themeCtx.theme ?? "coastal";
  const setTheme = themeCtx.setTheme ?? (() => {});
  const fontSize = themeCtx.fontSize ?? "16px";
  const setFontSize = themeCtx.setFontSize ?? (() => {});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Hovers sutiles
  const [hoveredTheme, setHoveredTheme] = useState(null);
  const [hoveredFont, setHoveredFont] = useState(null);

  const rightActions = (
    <div className="header-actions">
      <button onClick={() => navigate("/dashboard")} className="btn ghost h-10">Inicio</button>
      <button onClick={() => navigate("/patient-list")} className="btn ghost h-10">Pacientes</button>
      <button onClick={() => navigate("/notes")} className="btn ghost h-10">Notas</button>
      <button onClick={async () => { await logout(); navigate("/login",{replace:true}); }} className="btn ghost h-10">
        Cerrar sesión
      </button>
    </div>
  );

  return (
    <AppLayout
      title="Apariencia y tema"
      rightActions={rightActions}
      leftActions={
        <button
          onClick={() => setSidebarCollapsed(v=>!v)}
          className="btn icon"
          title={sidebarCollapsed ? "Expandir" : "Contraer"}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      }
      sidebar={<AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v=>!v)} />}
    >
      <LoadingOverlay open={false} message="Cargando…" />

      <div className="container-pad maxw-7xl">
        {/* Encabezado mini */}
        <section className="settings-hero card p-6 rounded-xl">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="h1" style={{fontSize:24, margin:0}}>Configuración de apariencia</h1>
              <p className="text-muted" style={{marginTop:6}}>
                Personaliza colores y tipografía. Los cambios se aplican a toda la app.
              </p>
            </div>
            {/* Vista rápida de la paleta activa */}
            <div className="swatchRow">
              {(THEMES[theme]?.chips ?? []).map((c,i)=>(
                <span key={i} className="swatch" title={c} style={{background:c}} />
              ))}
            </div>
          </div>
        </section>

        {/* Tamaño de fuente */}
        <section className="settings-section card p-6 rounded-xl mt-6">
          <h2 className="h2" style={{margin:0}}>Tamaño de fuente</h2>
          <p className="caption text-muted" style={{marginTop:6, marginBottom:12}}>
            Afecta al texto principal y componentes estándar.
          </p>

          <div className="settings-actions">
            {FONT_OPTIONS.map(opt=>(
              <button
                key={opt.value}
                className={`btn h-11 ${fontSize===opt.value ? "primary" : "ghost"}`}
                onClick={()=>setFontSize(opt.value)}
                onMouseEnter={()=>setHoveredFont(opt.value)}
                onMouseLeave={()=>setHoveredFont(null)}
                style={{
                  boxShadow: (fontSize===opt.value || hoveredFont===opt.value) ? "0 8px 22px rgba(0,0,0,.10)" : "0 2px 8px rgba(0,0,0,.06)"
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Demo de texto con el tamaño actual */}
          <div className="font-demo" style={{fontSize}}>
            <div className="font-demo-title">Vista previa</div>
            <div className="font-demo-body">
              Este es un texto de ejemplo con el tamaño seleccionado ({fontSize}).
            </div>
          </div>
        </section>

        {/* Paletas / temas */}
        <section className="settings-section card p-6 rounded-xl mt-6">
          <h2 className="h2" style={{margin:0}}>Paleta de colores (Tema)</h2>
          <p className="caption text-muted" style={{marginTop:6, marginBottom:12}}>
            Define los colores de fondo, texto, acentos y estados.
          </p>

          <div className="settings-grid">
            {Object.entries(THEMES).map(([key, meta])=>(
              <article
                key={key}
                role="button"
                tabIndex={0}
                aria-label={`Seleccionar tema ${meta.label}`}
                onClick={()=>setTheme(key)}
                onKeyDown={(e)=>{ if(e.key==="Enter"||e.key===" ") setTheme(key); }}
                onMouseEnter={()=>setHoveredTheme(key)}
                onMouseLeave={()=>setHoveredTheme(null)}
                className={`option-card ${theme===key ? "selected" : ""}`}
                style={{
                  transform: (theme===key || hoveredTheme===key) ? "translateY(-2px)" : "translateY(0)",
                  boxShadow: (theme===key || hoveredTheme===key) ? "0 8px 22px rgba(0,0,0,.12)" : "0 1px 8px rgba(0,0,0,.04)",
                }}
              >
                <div className="option-head">
                  <h3 className="option-title">{meta.label}</h3>
                  <span className={`badge ${theme===key ? "badge-on" : ""}`}>
                    {theme===key ? "Seleccionado" : "Usar"}
                  </span>
                </div>
                <div className="swatchRow">
                  {meta.chips.map((c,i)=>(
                    <span key={i} className="swatch" title={c} style={{background:c}} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}