// src/pages/LoginScreen.jsx
import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;

  const handleEmailPass = async (e) => {
    e.preventDefault(); setErr("");
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard", { replace: true });
    } catch (error) { setErr(error.message); }
  };

  const shouldFallbackToRedirect = (error) => {
    const code = error?.code || ""; const msg = String(error?.message || "").toLowerCase();
    return code==="auth/operation-not-supported-in-this-environment" || code==="auth/popup-blocked" || code==="auth/popup-closed-by-user" || code==="auth/web-storage-unsupported" || msg.includes("storage") || msg.includes("popup");
  };

  const handleGoogle = async () => {
    setErr(""); const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); navigate("/dashboard", { replace: true }); }
    catch (error) {
      if (shouldFallbackToRedirect(error)) { try { await signInWithRedirect(auth, provider); return; } catch(e2){ setErr(e2.message); return; } }
      setErr(error.message);
    }
  };

  return (
   
    <div className="login-container">
      <div className="card login-card"> 
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:1}}>
          <div className="login-avatar">
            <span className="material-symbols-outlined">neurology</span>
            </div>
          <h1 className="h2">TerappIA</h1>
          <p className="h2">{isRegistering ? "Crear cuenta" : "Iniciar sesión"}</p>
        </div>

        <form onSubmit={handleEmailPass} style={{display:"grid", gap:12, marginTop:20}}>  
          <label className="form-field">
            <span className="label">Email</span>
            <input type="email" className="input h-12" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          </label>
          <label className="form-field">
            <span className="label">Password</span>
            <input type="password" className="input h-12" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={6} />
          </label>
          <button type="submit" className="btn primary h-12">
            {isRegistering ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </form>

        <div className="mt-6" style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{height:1, background:"var(--ring)", flex:1}} />
          <span className="caption text-muted">o</span>
          <div style={{height:1, background:"var(--ring)", flex:1}} />
        </div>

        <div className="mt-6" style={{display:"grid", gap:12}}>
          <button onClick={handleGoogle} className="btn-google h-12">
            {/* Eliminamos el estilo inline 'display:flex, alignItems:center, justifyContent:center, gap:8' 
                ya que está definido en .btn-google */}
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="btn-google img" />
            Iniciar con Google
          </button>
          <button type="button" onClick={()=>setIsRegistering(s=>!s)} className="btn ghost h-12">
            {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Crear una"}
          </button>
        </div>

        {err && <p className="caption" style={{color:"#d94848", textAlign:"center", marginTop:12}}>{err}</p>}
      </div>
    </div>
  );
}