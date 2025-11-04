// src/components/Login.jsx
import React, { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect, // CHANGE
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // CHANGE: helper para decidir fallback a redirect
  const shouldFallbackToRedirect = (err) => {
    const code = err?.code || "";
    const msg = String(err?.message || "").toLowerCase();
    return (
      code === "auth/operation-not-supported-in-this-environment" ||
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/web-storage-unsupported" ||
      msg.includes("storage") ||
      msg.includes("popup")
    );
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setError('');
      await signInWithPopup(auth, provider);        // 1) popup primero
      // onAuthStateChanged actualizará el usuario
    } catch (err) {
      if (shouldFallbackToRedirect(err)) {          // CHANGE: fallback
        try {
          await signInWithRedirect(auth, provider); // 2) redirect
          return; // al volver del IdP, AuthContext sigue el flujo
        } catch (e2) {
          setError(e2.message);
          return;
        }
      }
      setError(err.message);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        setError(err.message);
      }
    } else {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
  };

  // === UI ORIGINAL MANTENIDA ===
  return (
    <div className="fixed inset-0 bg-[#5F2167] bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-primaryPurple text-lightText p-8 rounded-2xl shadow-lg w-full max-w-md">
        {/* Título dinámico */}
        <h2 className="text-2xl font-bold mb-2 text-center">
          {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h2>
        <p className="text-sm text-lightText text-center mb-6">
          Debes {isRegistering ? 'crear una cuenta' : 'iniciar sesión'} para usar el Agente.
        </p>

        {/* Form correo/contraseña */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            className="w-full px-4 py-2 rounded-lg border border-mediumGray bg-lightBg text-darkText focus:outline-none focus:ring-2 focus:ring-primaryPurple"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-2 rounded-lg border border-mediumGray bg-lightBg text-darkText focus:outline-none focus:ring-2 focus:ring-primaryPurple"
            required
            minLength={6}
          />
          <button
            type="submit"
            className="w-full py-3 bg-[#5F2167] text-white font-semibold rounded-lg hover:bg-[#84BB7B] transition duration-200"
          >
            {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="border-t border-mediumGray my-6" />

        {/* Botón Google conservando estilos */}
        <button
          onClick={handleGoogleLogin}
          className="w-full py-3 bg-[#5F2167] text-white font-semibold rounded-lg hover:bg-[#4F88C9] transition duration-200"
        >
          Iniciar con Google
        </button>

        {error && (
          <p className="mt-4 text-sm text-[#F81213] text-center">{error}</p>
        )}

        {/* Alternar modo */}
        <p className="mt-5 text-sm text-lightText text-center">
          {isRegistering ? '¿Ya tienes una cuenta? ' : '¿No tienes una cuenta? '}
          <span
            onClick={toggleMode}
            className="text-[#78D0FF] hover:text-blue-500 underline cursor-pointer transition-colors"
          >
            {isRegistering ? 'Inicia sesión' : 'Regístrate aquí'}
          </span>
        </p>
      </div>
    </div>
  );
};
