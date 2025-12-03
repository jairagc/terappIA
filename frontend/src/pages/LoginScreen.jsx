// src/pages/LoginScreen.jsx
import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (user) return <Navigate to="/dashboard" replace />;

  const handleEmailPass = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErr(error.message);
    }
  };

  const shouldFallbackToRedirect = (error) => {
    const code = error?.code || "";
    const msg = String(error?.message || "").toLowerCase();
    return (
      code === "auth/operation-not-supported-in-this-environment" ||
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/web-storage-unsupported" ||
      msg.includes("storage") ||
      msg.includes("popup")
    );
  };

  const handleGoogle = async () => {
    setErr("");
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (shouldFallbackToRedirect(error)) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (e2) {
          setErr(e2.message);
          return;
        }
      }
      setErr(error.message);
    }
  };

  return (
    <div
      className="
        login-container
        min-h-screen
        flex items-center justify-center
        px-4 sm:px-6
        bg-[var(--bg-alt)]
      "
    >
      <div
        className="
          card login-card
          w-full
          max-w-md sm:max-w-lg
          p-5 sm:p-8
          rounded-2xl
        "
      >
        {/* Logo + títulos */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <div className="login-avatar mb-2">
            <span className="material-symbols-outlined">neurology</span>
          </div>
          <h1 className="h2 text-xl sm:text-2xl mb-0">TerappIA</h1>
          <p className="text-sm sm:text-base text-[var(--text-muted)]">
            {isRegistering ? "Crear cuenta" : "Iniciar sesión"}
          </p>
        </div>

        {/* Form email/password */}
        <form
          onSubmit={handleEmailPass}
          className="grid gap-3 sm:gap-4 mt-2"
        >
          <label className="form-field text-sm sm:text-base">
            <span className="label text-xs sm:text-sm">Email</span>
            <input
              type="email"
              className="input h-11 sm:h-12 text-sm sm:text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="form-field text-sm sm:text-base">
            <span className="label text-xs sm:text-sm">Password</span>
            <input
              type="password"
              className="input h-11 sm:h-12 text-sm sm:text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <button
            type="submit"
            className="btn primary h-11 sm:h-12 text-sm sm:text-base mt-1"
          >
            {isRegistering ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </form>

        {/* Separador */}
        <div className="mt-5 sm:mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--ring)]" />
          <span className="caption text-muted text-[11px] sm:text-xs">o</span>
          <div className="flex-1 h-px bg-[var(--ring)]" />
        </div>

        {/* Botón Google + toggle registrar/iniciar */}
        <div className="mt-5 sm:mt-6 grid gap-3 sm:gap-4">
          <button
            type="button"
            onClick={handleGoogle}
            className="btn-google h-11 sm:h-12 text-sm sm:text-base"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt=""
              className="btn-google img"
            />
            Iniciar con Google
          </button>

          <button
            type="button"
            onClick={() => setIsRegistering((s) => !s)}
            className="btn ghost h-11 sm:h-12 text-xs sm:text-sm"
          >
            {isRegistering
              ? "¿Ya tienes cuenta? Inicia sesión"
              : "¿No tienes cuenta? Crear una"}
          </button>
        </div>

        {/* Error */}
        {err && (
          <p className="caption text-[11px] sm:text-xs text-center mt-4 text-[#d94848]">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
