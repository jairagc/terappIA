// src/pages/LoginScreen.jsx
import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithPopup,
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

  // If already logged in, bounce to dashboard
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

  const handleGoogle = async () => {
    setErr("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div className="relative flex h-screen min-h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark font-display overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-20 -left-40 w-96 h-96 bg-dark-navy/5 dark:bg-dark-navy/20 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute -bottom-20 -right-40 w-96 h-96 bg-light-gray/20 dark:bg-light-gray/10 rounded-full blur-3xl opacity-50"></div>

      {/* Login card */}
      <div className="relative z-10 flex flex-col w-full max-w-md p-8 space-y-6 bg-calm-blue dark:bg-primary/20 rounded-xl shadow-subtle">
        {/* Logo + title */}
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center justify-center w-12 h-12 bg-dark-navy rounded-full">
            <span className="material-symbols-outlined text-white text-2xl">neurology</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-white">TerappIA</h1>
        </div>

        {/* Header text */}
        <div className="flex flex-col gap-2 text-center">
          <p className="text-text-primary dark:text-white text-3xl font-black tracking-tighter">
            {isRegistering ? "Crear cuenta" : "Iniciar sesión"}
          </p>
          <p className="text-text-secondary dark:text-gray-300 text-base font-normal">
            {isRegistering
              ? "Crea tu cuenta para comenzar."
              : "Welcome back! Please enter your details."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailPass} className="flex flex-col gap-4">
          <label className="flex flex-col">
            <p className="text-text-primary dark:text-white text-sm font-medium pb-2">Email</p>
            <input
              type="email"
              placeholder="Enter your email"
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-dark-navy/50 border-none bg-white h-12 placeholder:text-text-secondary px-4 text-base font-normal shadow-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col">
            <p className="text-text-primary dark:text-white text-sm font-medium pb-2">Password</p>
            <div className="relative flex w-full items-center">
              <input
                type="password"
                placeholder="Enter your password"
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-dark-navy/50 border-none bg-white h-12 placeholder:text-text-secondary pl-4 pr-12 text-base font-normal shadow-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <div className="absolute right-0 flex items-center justify-center h-full w-12 text-text-secondary">
                <span className="material-symbols-outlined">lock</span>
              </div>
            </div>
          </label>

          {/* Primary submit */}
          <button
            type="submit"
            className="flex min-w-[84px] max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-dark-navy text-white text-base font-bold tracking-wide hover:bg-opacity-90 transition-colors duration-300 shadow-md"
          >
            <span className="truncate">{isRegistering ? "Crear cuenta" : "Iniciar sesión"}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px bg-light-gray/60 flex-1" />
          <span className="text-sm text-text-secondary">o</span>
          <div className="h-px bg-light-gray/60 flex-1" />
        </div>

        {/* Extra buttons (keep 2nd repo style) */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoogle}
            className="flex items-center justify-center gap-2 h-12 px-5 rounded-lg bg-white text-text-primary font-semibold shadow-sm hover:shadow transition"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
            Iniciar con Google
          </button>

          <button
            type="button"
            onClick={() => setIsRegistering((s) => !s)}
            className="flex items-center justify-center h-12 px-5 rounded-lg bg-transparent border border-dark-navy/30 text-text-primary dark:text-white font-semibold hover:bg-white/60 transition"
          >
            {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Crear una"}
          </button>
        </div>

        {/* Error */}
        {err && (
          <p className="text-center text-sm text-red-500">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
