// src/components/AppFooter.jsx
import React from "react";

// CSS exclusivo de este componente
const footerCSS = `
  .app-footer {
    border-top: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.06));
    background: var(--surface, #ffffff);
    color: var(--text, #111827);
    padding: 10px 16px;
    font-size: 13px;
  }

  .app-footer-inner {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .app-footer-contact {
    display: flex;
    flex-direction: column;
    gap: 2px;
    opacity: 0.9;
  }

  .app-footer-links {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .app-footer-icon {
    height: 32px;
    width: 32px;
    border-radius: 999px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-footer-icon .material-symbols-outlined {
    font-size: 18px;
  }

  /* ---------- MOBILE: solo iconos centrados, sin fondo blanco ---------- */
  @media (max-width: 640px) {
    .app-footer {
      padding: 8px 12px 10px;
      font-size: 12px;

      /* quitar fondo blanco en móvil */
      background: transparent;
      border-top-color: transparent;
    }

    .app-footer-inner {
      max-width: 100%;
      justify-content: center;
    }

    /* Ocultamos el texto de contacto en móvil */
    .app-footer-contact {
      display: none;
    }

    /* Iconos centrados en una hilera */
    .app-footer-links {
      width: 100%;
      justify-content: center;
      gap: 10px;
    }

    .app-footer-icon {
      height: 34px;
      width: 34px;
    }

    .app-footer-icon .material-symbols-outlined {
      font-size: 18px;
    }
  }
`;

export default function AppFooter() {
  return (
    <>
      <style>{footerCSS}</style>

      <footer className="app-footer">
        <div className="app-footer-inner">
          {/* Desktop: texto de contacto. Mobile: se oculta vía CSS */}
          <div className="app-footer-contact">
            <div>contacto@terappia.com</div>
            <div>+1 (234) 567-890</div>
          </div>

          {/* Iconos sociales */}
          <div className="app-footer-links">
            <a
              className="btn icon app-footer-icon"
              href="#"
              aria-label="X/Twitter"
              title="X/Twitter"
            >
              <span className="material-symbols-outlined">public</span>
            </a>
            <a
              className="btn icon app-footer-icon"
              href="#"
              aria-label="Instagram"
              title="Instagram"
            >
              <span className="material-symbols-outlined">camera</span>
            </a>
            <a
              className="btn icon app-footer-icon"
              href="#"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              <span className="material-symbols-outlined">work</span>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
