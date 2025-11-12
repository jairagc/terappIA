// src/theme/ThemeContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeCtx = createContext({
  theme: "coastal",
  setTheme: () => {},
  fontSize: "16px",
  setFontSize: () => {},
});

export function ThemeProvider({
  children,
  defaultTheme = "coastal",
  defaultFontSize = "16px",
}) {
  const [theme, setTheme] = useState(defaultTheme);
  const [fontSize, setFontSize] = useState(defaultFontSize);

  // Cargar preferencias guardadas
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("app-theme");
      if (savedTheme) setTheme(savedTheme);
    } catch {}
    try {
      const savedFont = localStorage.getItem("app-font-size");
      if (savedFont) setFontSize(savedFont);
    } catch {}
  }, []);

  // Aplicar tema → data-attribute (como ya hacías) + persistir
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("app-theme", theme); } catch {}
  }, [theme]);

  // Aplicar tamaño de fuente → CSS var global + persistir
  useEffect(() => {
    document.documentElement.style.setProperty("--font-size-base", fontSize);
    try { localStorage.setItem("app-font-size", fontSize); } catch {}
  }, [fontSize]);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, fontSize, setFontSize }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
