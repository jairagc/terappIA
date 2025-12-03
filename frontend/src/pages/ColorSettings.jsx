// src/pages/ColorSettings.jsx
import React, { useState } from "react";
import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";

const THEMES = {
  coastal: { label: "Coastal Blues", chips: ["#33539E", "#7FACD6", "#BFB8DA", "#FEB7D4", "#A5678E"] },
  pastel:  { label: "Pastel Sunny",  chips: ["#ACC182", "#D0E6A5", "#FFDD94", "#FA897B", "#CCABDB"] },
  warm:    { label: "Warm Neutrals", chips: ["#B88F5B", "#D0B7B3", "#F0E0DC", "#F9DDCF", "#909B84"] },
  neuron:  { label: "Neuron Greens", chips: ["#3B5284", "#5B8A8A", "#CBE54E", "#94B447", "#5D6E1E"] },
  autumn:  { label: "Autumn Harvest",chips: ["#F28930", "#E3AF38", "#F6A685", "#D0C2CF", "#F6D3BD"] },
  rose:    { label: "Rose & Slate",  chips: ["#DE5B6D", "#478BA2", "#E9765B", "#F2A490", "#B9D4DB"] },
};

const FONT_OPTIONS = [
  { label: "Pequeña (14px)", value: "14px", description: "Fuente ideal para pantallas grandes." },
  { label: "Normal (16px)",  value: "16px", description: "Recomendada (predeterminada)." },
  { label: "Grande (18px)",  value: "18px", description: "Accesibilidad mejorada." },
];

// CSS local para esta pantalla
const pageCSS = `
  .maxw-7xl { max-width: 1120px; margin: 0 auto; }

  .settings-root {
    padding: 24px 20px;
    width: 100%;
    box-sizing: border-box;
  }

  .settings-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid var(--line-soft, #e6ebf3);
    box-shadow: 0 2px 10px rgba(0,0,0,.04);
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    /* MÁS PADDING EN ESCRITORIO PARA QUE NADA SE PEGUE A LOS BORDES */
    padding: 24px 24px;
  }

  .settings-hero,
  .settings-section {
    box-sizing: border-box;
  }

  .settings-hero h1 {
    font-size: 24px;
    font-weight: 800;
  }

  .settings-hero p {
    font-size: 14px;
  }

  .swatchRow {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .swatch {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    border: 1px solid rgba(0,0,0,.06);
    box-shadow: 0 1px 3px rgba(0,0,0,.18);
    flex-shrink: 0;
  }

  .settings-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 12px;
  }

  .settings-actions .btn {
    min-width: 150px;
    font-size: 14px;
  }

  .font-demo {
    margin-top: 18px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--bg-muted, #f3f4fb);
    border: 1px dashed rgba(0,0,0,.06);
    box-sizing: border-box;
    max-width: 100%;
  }

  .font-demo-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .font-demo-body {
    font-size: 0.95em;
  }

  .settings-grid {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  .option-card {
    position: relative;
    padding: 14px 14px 12px;
    border-radius: 14px;
    border: 1px solid var(--line-soft, #e6ebf3);
    background: #fff;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    outline: none;
    box-sizing: border-box;
    max-width: 100%;
  }

  .option-card.selected {
    border-color: var(--accent-blue, #2156e6);
  }

  .option-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .option-title {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
  }

  .badge {
    font-size: 11px;
    border-radius: 999px;
    padding: 3px 10px;
    border: 1px solid var(--line-soft, #e6ebf3);
    background: #f8fafc;
    color: #344054;
    white-space: nowrap;
  }
  .badge-on {
    background: var(--accent-blue, #2156e6);
    border-color: var(--accent-blue, #2156e6);
    color: #fff;
  }

  /* Móvil */
  @media (max-width: 640px) {
    .settings-root {
      padding: 14px 12px;
    }
    .settings-card {
      border-radius: 14px;
      padding: 16px 14px;
    }
    .settings-hero h1 {
      font-size: 18px;
    }
    .settings-hero p {
      font-size: 12px;
    }

    .settings-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .settings-actions .btn {
      width: 100%;
      min-width: 0;
      font-size: 13px;
      height: 42px;
    }

    .font-demo {
      margin-top: 12px;
      padding: 8px 10px;
    }
    .font-demo-title {
      font-size: 12px;
    }
    .font-demo-body {
      font-size: 12px;
    }

    .settings-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }
    .option-card {
      padding: 10px;
      border-radius: 12px;
    }
    .option-title {
      font-size: 13px;
    }
    .badge {
      font-size: 10px;
      padding: 2px 8px;
    }

    .swatch {
      width: 18px;
      height: 18px;
    }
  }

  /* Tablet intermedio */
  @media (max-width: 1024px) and (min-width: 641px) {
    .settings-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;

export default function ColorSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const themeCtx = useTheme?.() ?? {};
  const theme = themeCtx.theme ?? "coastal";
  const setTheme = themeCtx.setTheme ?? (() => {});
  const fontSize = themeCtx.fontSize ?? "16px";
  const setFontSize = themeCtx.setFontSize ?? (() => {});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const [hoveredTheme, setHoveredTheme] = useState(null);
  const [hoveredFont, setHoveredFont] = useState(null);

  // HEADER: solo botón de Cerrar sesión (sin Inicio/Pacientes/Notas)
  const rightActions = (
    <button
      onClick={async () => {
        await logout();
        navigate("/login", { replace: true });
      }}
      className="btn ghost h-10"
    >
      <span className="material-symbols-outlined" style={{marginRight:6}}>logout</span>
      Cerrar sesión
    </button>
  );

  return (
    <AppLayout
      title={null}  // <- sin "/ Apariencia y tema" en el header, solo TerappIA
      rightActions={rightActions}
      leftActions={
        <button
          onClick={() => setSidebarCollapsed(v => !v)}
          className="btn icon"
          title={sidebarCollapsed ? "Expandir" : "Contraer"}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      }
      sidebar={<AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />}
    >
      <style>{pageCSS}</style>

      <LoadingOverlay open={false} message="Cargando…" />

      <div className="settings-root maxw-7xl">
        {/* Encabezado mini */}
        <section className="settings-hero settings-card">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="h1" style={{ margin: 0 }}>
                Configuración de apariencia
              </h1>
              <p className="text-muted" style={{ marginTop: 6 }}>
                Personaliza colores y tipografía. Los cambios se aplican a toda la app.
              </p>
            </div>

            {/* Vista rápida de la paleta activa */}
            <div className="swatchRow">
              {(THEMES[theme]?.chips ?? []).map((c, i) => (
                <span key={i} className="swatch" title={c} style={{ background: c }} />
              ))}
            </div>
          </div>
        </section>

        {/* Tamaño de fuente */}
        <section className="settings-section settings-card mt-6">
          <h2 className="h2" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Tamaño de fuente
          </h2>
          <p className="caption text-muted" style={{ marginTop: 6, marginBottom: 12 }}>
            Afecta al texto principal y componentes estándar.
          </p>

          <div className="settings-actions">
            {FONT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`btn h-11 ${fontSize === opt.value ? "primary" : "ghost"}`}
                onClick={() => setFontSize(opt.value)}
                onMouseEnter={() => setHoveredFont(opt.value)}
                onMouseLeave={() => setHoveredFont(null)}
                style={{
                  boxShadow:
                    fontSize === opt.value || hoveredFont === opt.value
                      ? "0 8px 22px rgba(0,0,0,.10)"
                      : "0 2px 8px rgba(0,0,0,.06)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Demo de texto con el tamaño actual */}
          <div className="font-demo" style={{ fontSize }}>
            <div className="font-demo-title">Vista previa</div>
            <div className="font-demo-body">
              Este es un texto de ejemplo con el tamaño seleccionado ({fontSize}).
            </div>
          </div>
        </section>

        {/* Paletas / temas */}
        <section className="settings-section settings-card mt-6">
          <h2 className="h2" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Paleta de colores (Tema)
          </h2>
          <p className="caption text-muted" style={{ marginTop: 6, marginBottom: 12 }}>
            Define los colores de fondo, texto, acentos y estados.
          </p>

          <div className="settings-grid">
            {Object.entries(THEMES).map(([key, meta]) => (
              <article
                key={key}
                role="button"
                tabIndex={0}
                aria-label={`Seleccionar tema ${meta.label}`}
                onClick={() => setTheme(key)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setTheme(key); }}
                onMouseEnter={() => setHoveredTheme(key)}
                onMouseLeave={() => setHoveredTheme(null)}
                className={`option-card ${theme === key ? "selected" : ""}`}
                style={{
                  transform:
                    theme === key || hoveredTheme === key ? "translateY(-2px)" : "translateY(0)",
                  boxShadow:
                    theme === key || hoveredTheme === key
                      ? "0 8px 22px rgba(0,0,0,.12)"
                      : "0 1px 8px rgba(0,0,0,.04)",
                }}
              >
                <div className="option-head">
                  <h3 className="option-title">{meta.label}</h3>
                  <span className={`badge ${theme === key ? "badge-on" : ""}`}>
                    {theme === key ? "Seleccionado" : "Usar"}
                  </span>
                </div>
                <div className="swatchRow">
                  {meta.chips.map((c, i) => (
                    <span key={i} className="swatch" title={c} style={{ background: c }} />
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
