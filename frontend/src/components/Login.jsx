import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setError('');
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      // --- LÓGICA DE REGISTRO ---
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        // Firebase automáticamente inicia sesión después de un registro exitoso
      } catch (err) {
        setError(err.message);
      }
    } else {
      // --- LÓGICA DE INICIO DE SESIÓN ---
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  // CAMBIO: Función para alternar el modo y limpiar errores
  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-[#5F2167] bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-primaryPurple text-lightText p-8 rounded-2xl shadow-lg w-full max-w-md">
        {/* El título es dinámico */}
        <h2 className="text-2xl font-bold mb-2 text-center">
          {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h2>
        <p className="text-sm text-lightText text-center mb-6">
          Debes {isRegistering ? 'crear una cuenta' : 'iniciar sesión'} para usar el Agente.
        </p>

        {/* Manejo de ambos casos */}
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
            minLength={6} // Firebase requiere al menos 6 caracteres
          />
          <button
            type="submit"
            className="w-full py-3 bg-[#5F2167] text-white font-semibold rounded-lg hover:bg-[#84BB7B] transition duration-200"
          >
            {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="border-t border-mediumGray my-6" />

        <button
          onClick={handleGoogleLogin}
          className="w-full py-3 bg-[#5F2167] text-white font-semibold rounded-lg hover:bg-[#4F88C9] transition duration-200"
        >
          Iniciar con Google
        </button>

        {error && (
          <p className="mt-4 text-sm text-[#F81213] text-center">{error}</p>
        )}

        {/* Texto para alternar entre modos */}
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
