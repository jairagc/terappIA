import React from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebaseConfig";

const Header = ({ user }) => {
  return (
    <nav className="bg-blue-700 text-white p-4 shadow-lg flex justify-between items-center">
      {/* Links de navegación */}
      <div className="flex space-x-6">
        <Link to="/" className="hover:underline">
          Analizador
        </Link>
        <Link to="/history" className="hover:underline">
          Historial
        </Link>
      </div>

      {/* Usuario logueado */}
      <div className="flex items-center space-x-4">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="Foto de perfil"
            className="w-8 h-8 rounded-full border border-white"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
            {user.email ? user.email[0].toUpperCase() : "U"}
          </div>
        )}

        <span className="text-sm">{user.displayName || user.email}</span>

        <button
          onClick={() => signOut(auth)}
          className="bg-red-500 px-3 py-1 rounded hover:bg-red-600 transition"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
};

export default Header;
