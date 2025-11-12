// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

/* Estilos (primero nuestras capas) */
import "./styles/theme.css";  // <- variables de tema PRIMERO
import "./index.css";         // <- tus utilidades y lo demás DESPUÉS
           // tailwind + base que añadiste

import { ThemeProvider } from "./theme/ThemeContext.jsx";

/* Evitar flash: aplicar tema guardado antes de montar (opcional extra seguridad) */
try {
  const saved = localStorage.getItem("app-theme");
  document.documentElement.setAttribute("data-theme", saved || "coastal");
} catch {
  document.documentElement.setAttribute("data-theme", "coastal");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider defaultTheme="coastal" defaultFontSize="16px">
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
