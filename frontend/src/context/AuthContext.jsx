// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, getRedirectResult } from "firebase/auth"; // CHANGE
import { auth } from "../services/firebaseConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // splash inicial

  useEffect(() => {
    let unsub;

    // CHANGE: resolver el resultado del redirect SIN tronar si falta el estado
    getRedirectResult(auth)
      .catch((err) => {
        const msg = String(err?.message || "");
        if (msg.includes("missing initial state")) {
          // iOS/Safari o in-app browsers con storage partitioning: lo ignoramos
          return;
        }
        console.error("getRedirectResult error:", err);
      })
      .finally(() => {
        // CHANGE: solo después, nos suscribimos al usuario
        unsub = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
      });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

