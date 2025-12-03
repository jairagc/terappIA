// src/pages/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useDoctorProfile } from "../services/userDoctorProfile";

/* ===== estilos embebidos para esta pantalla (responsive) ===== */
const pageCSS = `
  .maxw-7xl { max-width: 1120px; margin: 0 auto; }
  .page-pad { padding: 20px; }

  /* Contenedor principal de la card de perfil */
  .profile-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid var(--line-soft, #e6ebf3);
    box-shadow: 0 2px 10px rgba(0,0,0,.04);
    padding: 24px 28px 22px;
    margin: 8px auto 28px;
    max-width: 880px;
    box-sizing: border-box;
  }

  .profile-card form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 18px 20px;
  }

  .form-field { min-width: 0; }
  .span-2 { grid-column: span 2; }

  .label {
    display: block;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .input {
    width: 100%;
    border: 1px solid var(--line-soft,#e6ebf3);
    border-radius: 12px;
    padding: 0 12px;
    height: 44px;
    background: #fff;
    box-sizing: border-box;
  }
  .input-readonly { background:#f6f7fb; color:#5b6471; }
  .input-error { border-color:#ef4444; }

  .btn.primary {
    background: var(--accent-blue,#2156e6);
    color: #fff;
    border-radius: 999px;
    padding: 0 18px;
    font-weight: 800;
    border: 0;
  }
  .btn.is-disabled { opacity:.6; cursor:not-allowed; }

  .alert-error-banner {
    background:#ffe7e7;
    color:#991b1b;
    border:1px solid #fecaca;
    border-radius:12px;
    padding:10px 12px;
  }
  .alert-warn {
    background:#fff7e6;
    color:#7a4b00;
    border:1px solid #ffe0b3;
    border-radius:12px;
    padding:10px 12px;
  }
  .text-muted { opacity:.8; }

  /* MiniToast */
  .mini-toast {
    position: fixed;
    right: 16px;
    bottom: 16px;
    width: 40px;
    height: 30px;
    border-radius: 999px;
    background: #22c55e;
    color:#fff;
    display:flex;
    align-items:center;
    justify-content:center;
    box-shadow: 0 8px 20px rgba(34,197,94,.35);
    z-index: 60;
  }

  /* Confetti modal básico */
  .confetti-alert-overlay {
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.25);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:50;
  }
  .confetti-alert-card {
    max-width: 420px;
    padding: 20px;
  }

  /* Tablet */
  @media (max-width: 1024px) {
    .page-pad { padding: 16px; }
    .profile-card {
      padding: 22px 22px 20px;
      max-width: 780px;
    }
    .profile-card form {
      gap: 16px 18px;
    }
  }

  /* Móvil */
  @media (max-width: 640px) {
    .page-pad { padding: 14px 10px 24px; }

    .profile-card {
      max-width: 480px;
      width: 100%;
      margin: 14px auto 26px;
      padding: 18px 14px 18px;
      border-radius: 14px;
    }

    .profile-card form {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .span-2 { grid-column: span 1; }

    .label {
      font-size: 12px;
      margin-bottom: 4px;
    }
    .input {
      height: 40px;
      border-radius: 10px;
      padding: 0 10px;
      font-size: 13px;
    }
    .btn.primary {
      height: 42px;
      padding: 0 16px;
      font-size: 14px;
    }
    .caption { font-size: 12px; }
  }
`;

/* =========================
   MiniToast – éxito 40x30
   ========================= */
const MiniToast = ({ message, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="mini-toast"
      role="status"
      aria-live="polite"
      title={message}
      aria-label={message}
    >
      <span className="material-symbols-outlined">check_circle</span>
    </div>
  );
};

const ConfettiAlert = ({ message, onClose }) => (
  <div className="confetti-alert-overlay" onClick={onClose}>
    <div className="confetti-alert-card card">
      <h2 className="section-title text-center">🎉 ¡Éxito! 🎉</h2>
      <p className="mt-2 text-center">{message}</p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button onClick={onClose} className="btn primary mt-4 h-10">
          Entendido
        </button>
      </div>
    </div>
  </div>
);

export default function Profile() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid || null;

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
    }
  };

  const { orgId: orgFromProfile } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  const [orgId, setOrgId] = useState("");
  const [firstNames, setFirstNames] = useState("");
  const [lastNameFather, setLastNameFather] = useState("");
  const [lastNameMother, setLastNameMother] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [cedula, setCedula] = useState("");

  const initialDisplay = useMemo(
    () => user?.displayName || "",
    [user?.displayName]
  );

  useEffect(() => {
    const cachedOrg = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cachedOrg);
    if (initialDisplay && !firstNames) setFirstNames(initialDisplay);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgFromProfile, initialDisplay]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid || !orgId) return;
      try {
        setBusyMsg("Cargando perfil…");
        const ref = doc(db, "orgs", orgId, "doctors", uid);
        const snap = await getDoc(ref);
        if (!alive) return;

        if (snap.exists()) {
          const d = snap.data();
          setFirstNames(d?.firstNames ?? d?.name ?? firstNames);
          setLastNameFather(d?.lastNameFather ?? "");
          setLastNameMother(d?.lastNameMother ?? "");
          setPhone(d?.phone ?? "");
          setRole(d?.role ?? "");
          setCedula(d?.cedula ?? "");
          setMsg("Perfil cargado.");
          setIsProfileLoaded(true);
        } else {
          setMsg("Aún no tienes un perfil. Captura tus datos y guarda.");
          setIsProfileLoaded(false);
        }
      } catch (e) {
        console.error("Error al cargar perfil:", e);
        setErr("No se pudo cargar tu perfil. Revisa la consola.");
      } finally {
        setBusyMsg("");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, orgId]);

  const cleanDigits = (s) => (s || "").replace(/\D+/g, "");
  const isPhoneValid = phone && cleanDigits(phone).length === 10;
  const isOrgValid = !!orgId?.trim();
  const isNameValid =
    !!firstNames?.trim() ||
    !!(lastNameFather?.trim() || lastNameMother?.trim());
  const isCedulaValid = cedula && cleanDigits(cedula).length === 8;

  const prettyName = useMemo(() => {
    const fn = (firstNames || "").trim();
    const ap = (lastNameFather || "").trim();
    const am = (lastNameMother || "").trim();
    return [fn, ap, am].filter(Boolean).join(" ");
  }, [firstNames, lastNameFather, lastNameMother]);

  const canSubmit =
    !isProfileLoaded &&
    !!uid &&
    isOrgValid &&
    isNameValid &&
    (!phone || isPhoneValid) &&
    (!cedula || isCedulaValid);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (isProfileLoaded) {
      setErr(
        "El perfil ya ha sido capturado y guardado previamente. No se permiten modificaciones."
      );
      return;
    }
    if (!uid) {
      setErr("No hay sesión activa.");
      return;
    }
    if (!isOrgValid) {
      setErr("Debes escribir tu Organización / Institución.");
      return;
    }
    if (!isNameValid) {
      setErr("Captura al menos Nombres o algún Apellido.");
      return;
    }
    if (phone && !isPhoneValid) {
      setErr("El teléfono debe tener 10 dígitos (solo números).");
      return;
    }
    if (cedula && !isCedulaValid) {
      setErr("La cedula debe de tener 8 dígitos.");
      return;
    }

    try {
      setSaving(true);
      setBusyMsg("Guardando perfil…");
      const ref = doc(db, "orgs", orgId.trim(), "doctors", uid);
      await setDoc(
        ref,
        {
          email: user?.email ?? null,
          orgId: orgId.trim(),
          firstNames: firstNames.trim(),
          lastNameFather: lastNameFather.trim(),
          lastNameMother: lastNameMother.trim(),
          name: prettyName,
          phone: cleanDigits(phone),
          role: role.trim(),
          cedula: cedula.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      localStorage.setItem("orgId", orgId.trim());
      setMsg(
        "Perfil guardado. Los datos han sido bloqueados para su visualización."
      );
      setIsProfileLoaded(true);
      setToastMsg("¡Perfil guardado con éxito!");
      setShowToast(true);
      // setShowConfetti(true);
    } catch (e) {
      console.error("Error al guardar perfil:", e);
      setErr("No se pudo guardar el perfil. Revisa la consola y reglas.");
    } finally {
      setSaving(false);
      setBusyMsg("");
    }
  }

  // HEADER: solo logo + TerappIA y botón Cerrar sesión (sin nombre de vista)
  const rightActions = (
    <button
      onClick={handleLogout}
      className="btn ghost h-10"
      title="Cerrar sesión"
    >
      <span className="material-symbols-outlined" style={{ marginRight: 6 }}>
        logout
      </span>
      Cerrar sesión
    </button>
  );

  const leftActions = (
    <button
      onClick={() => setSidebarCollapsed((v) => !v)}
      className="btn-ghost h-9"
      title={sidebarCollapsed ? "Expandir" : "Contraer"}
    >
      <span className="material-symbols-outlined">menu</span>
    </button>
  );

  if (loading || !ready) {
    return (
      <AppLayout
        title={null}                // ⬅️ sin nombre de vista
        leftActions={leftActions}
        rightActions={rightActions}
        sidebar={
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((v) => !v)}
          />
        }
      >
        <LoadingOverlay open message="Cargando…" />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={null}                  // ⬅️ sin “/ Perfil del doctor”
      rightActions={rightActions}
      leftActions={leftActions}
      sidebar={
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
      }
    >
      <style>{pageCSS}</style>

      <LoadingOverlay open={!!busyMsg} message={busyMsg} />

      {showToast && (
        <MiniToast
          message={toastMsg}
          onClose={() => setShowToast(false)}
        />
      )}
      {showConfetti && (
        <ConfettiAlert
          message="¡Tu perfil ha sido guardado exitosamente y ahora está bloqueado para proteger tus datos!"
          onClose={() => setShowConfetti(false)}
        />
      )}

      {/* Ruta / mensajes */}
      <div className="page-pad maxw-7xl">
        <p className="caption text-muted">
          Datos requeridos de acuerdo a la NOM
        </p>
        {msg && <div className="mt-2 text-primary font-semibold">{msg}</div>}
        {err && <div className="alert-error-banner mt-2">{err}</div>}
      </div>

      {/* Tarjeta formulario */}
      <section className="page-pad maxw-7xl">
        <div className="profile-card mt-2">
          <form onSubmit={onSubmit}>
            {/* Organización */}
            <div className="form-field span-2">
              <label className="label">Organización / Institución *</label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Ej. miClinica, etc."
                required
                className={`input ${
                  isProfileLoaded ? "input-readonly" : ""
                }`}
                readOnly={isProfileLoaded}
              />
            </div>

            {/* Email */}
            <div className="form-field">
              <label className="label">Correo (solo lectura)</label>
              <input
                type="email"
                value={user?.email || ""}
                readOnly
                className="input input-readonly"
              />
            </div>

            {/* Cédula */}
            <div className="form-field">
              <label className="label">
                Cédula Profesional{" "}
                {cedula && !isProfileLoaded
                  ? isCedulaValid
                    ? "✅"
                    : "❌ 8 dígitos"
                  : ""}
              </label>
              <input
                type="text"
                value={cedula}
                onChange={(e) =>
                  setCedula(
                    e.target.value.replace(/\D+/g, "").slice(0, 8)
                  )
                }
                placeholder="12345678"
                className={`input ${
                  cedula && !isCedulaValid && !isProfileLoaded
                    ? "input-error"
                    : ""
                } ${isProfileLoaded ? "input-readonly" : ""}`}
                readOnly={isProfileLoaded}
              />
            </div>

            {/* Nombres */}
            <div className="form-field">
              <label className="label">Nombres *</label>
              <input
                type="text"
                value={firstNames}
                onChange={(e) => setFirstNames(e.target.value)}
                required
                placeholder="María Fernanda"
                className={`input ${
                  isProfileLoaded ? "input-readonly" : ""
                }`}
                readOnly={isProfileLoaded}
              />
            </div>

            {/* Apellido paterno */}
            <div className="form-field">
              <label className="label">Apellido paterno</label>
              <input
                type="text"
                value={lastNameFather}
                onChange={(e) => setLastNameFather(e.target.value)}
                placeholder="García"
                className={`input ${
                  isProfileLoaded ? "input-readonly" : ""
                }`}
                readOnly={isProfileLoaded}
              />
            </div>

            {/* Apellido materno */}
            <div className="form-field">
              <label className="label">Apellido materno</label>
              <input
                type="text"
                value={lastNameMother}
                onChange={(e) => setLastNameMother(e.target.value)}
                placeholder="Hernández"
                className={`input ${
                  isProfileLoaded ? "input-readonly" : ""
                }`}
                readOnly={isProfileLoaded}
              />
            </div>

            {/* Teléfono */}
            <div className="form-field">
              <label className="label">
                Teléfono{" "}
                {phone && !isProfileLoaded
                  ? isPhoneValid
                    ? "✅"
                    : "❌ 10 dígitos"
                  : ""}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value.replace(/\D+/g, "").slice(0, 10)
                  )
                }
                placeholder="5512345678"
                className={`input ${
                  phone && !isPhoneValid && !isProfileLoaded
                    ? "input-error"
                    : ""
                } ${isProfileLoaded ? "input-readonly" : ""}`}
                readOnly={isProfileLoaded}
              />
              <p className="caption text-muted mt-1">
                Se guardará como 10 dígitos (sin espacios).
              </p>
            </div>

            {/* Rol */}
            <div className="form-field">
              <label className="label">Rol / Puesto</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Terapeuta, Admin…"
                className={`input ${
                  isProfileLoaded ? "input-readonly" : ""
                }`}
                readOnly={isProfileLoaded}
              />
            </div>

            {/* Guardar */}
            <div
              className="span-2"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <button
                type="submit"
                disabled={!canSubmit || saving || isProfileLoaded}
                className={`btn primary ${
                  !canSubmit || saving || isProfileLoaded
                    ? "is-disabled"
                    : ""
                }`}
                style={{ height: 48 }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>

          {/* Vista previa */}
          <div className="mt-6 caption text-muted">
            <b>Nombre Completo:</b> {prettyName || "—"}
          </div>

          {isProfileLoaded && (
            <div className="mt-4 alert-warn">
              ⚠️ Los datos ya han sido guardados. No se permiten
              modificaciones.
            </div>
          )}
        </div>
      </section>

      {showConfetti && (
        <div className="confetti-container">
          <ConfettiAlert
            message="¡Tu perfil ha sido guardado exitosamente y ahora está bloqueado para proteger tus datos!"
            onClose={() => setShowConfetti(false)}
          />
        </div>
      )}
    </AppLayout>
  );
}
