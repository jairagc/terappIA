import React, { useState } from "react";
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  signInWithEmailAndPassword, createUserWithEmailAndPassword
} from "firebase/auth";
import { auth } from "../services/firebaseConfig";

export const Login = () => {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [isRegistering, setIsRegistering] = useState(false);

  const shouldFallbackToRedirect = (err) => {
    const code = err?.code || ""; const msg = String(err?.message || "").toLowerCase();
    return code === "auth/operation-not-supported-in-this-environment" ||
           code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" ||
           code === "auth/web-storage-unsupported" || msg.includes("storage") || msg.includes("popup");
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { setError(""); await signInWithPopup(auth, provider); }
    catch (err) { if (shouldFallbackToRedirect(err)) { try { await signInWithRedirect(auth, provider); } catch(e2){ setError(e2.message); } }
                  else setError(err.message); }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault(); setError("");
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:50,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"#5F2167ee"
    }}>
      <div style={{
        width:"100%", maxWidth:420, margin:"0 16px",
        background:"var(--card)", color:"var(--text)",
        border:"1px solid var(--ring)", borderRadius:16, padding:24, boxShadow:"0 20px 40px rgba(0,0,0,.3)"
      }}>
        <h2 style={{margin:"0 0 6px", textAlign:"center"}}>{isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}</h2>
        <p className="caption text-muted" style={{textAlign:"center", marginBottom:18}}>
          Debes {isRegistering ? "crear una cuenta" : "iniciar sesión"} para usar el Agente.
        </p>

        <form onSubmit={handleFormSubmit} style={{display:"grid", gap:12}}>
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)}
            placeholder="Correo electrónico" required
          />
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)}
            placeholder="Contraseña" required minLength={6}
          />
          <button type="submit" className="btn-primary h-11">
            {isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}
          </button>
        </form>

        <div style={{borderTop:"1px solid var(--ring)", margin:"18px 0"}} />

        <button onClick={handleGoogleLogin} className="btn-primary h-11" style={{width:"100%"}}>
          Iniciar con Google
        </button>

        {error && <p style={{marginTop:12, fontSize:13, color:"#F81213", textAlign:"center"}}>{error}</p>}

        <p className="caption text-muted" style={{marginTop:16, textAlign:"center"}}>
          {isRegistering ? "¿Ya tienes una cuenta? " : "¿No tienes una cuenta? "}
          <span onClick={()=>setIsRegistering(!isRegistering)}
            style={{ color:"#33539E", cursor:"pointer", textDecoration:"underline" }}>
            {isRegistering ? "Inicia sesión" : "Regístrate aquí"}
          </span>
        </p>
      </div>
    </div>
  );
};
