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

/* =========================
   MiniToast – éxito 40x30
   ========================= */
const MiniToast = ({ message, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000); // auto-cierra en 3s
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

/* (Opcional) Modal de celebración grande que ya tenías */
const ConfettiAlert = ({ message, onClose }) => (
  <div className="confetti-alert-overlay" onClick={onClose}>
    <div className="confetti-alert-card card">
      <h2 className="section-title">🎉 ¡Éxito! 🎉</h2>
      <p className="mt-2 text-center">{message}</p>
      <button onClick={onClose} className="btn primary mt-4 h-10">
        Entendido
      </button>
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

  // Perfil leído (org preferente desde Firestore)
  const { orgId: orgFromProfile } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );

  // UI
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // inicia oculto
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  // Éxito (mini-toast y/o confetti)
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // Campos del form
  const [orgId, setOrgId] = useState("");
  const [firstNames, setFirstNames] = useState(""); // Nombres
  const [lastNameFather, setLastNameFather] = useState(""); // Ap. paterno
  const [lastNameMother, setLastNameMother] = useState(""); // Ap. materno
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [cedula, setCedula] = useState("");

  // Nombre inicial de referencia
  const initialDisplay = useMemo(() => user?.displayName || "", [user?.displayName]);

  // Prefill org/nombre y ready
  useEffect(() => {
    const cachedOrg = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cachedOrg);
    if (initialDisplay && !firstNames) setFirstNames(initialDisplay);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgFromProfile, initialDisplay]);

  // Cargar perfil desde Firestore cuando haya uid+org
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

  // Validaciones
  const cleanDigits = (s) => (s || "").replace(/\D+/g, "");
  const isPhoneValid = phone && cleanDigits(phone).length === 10; // MX 10 dígitos
  const isOrgValid = !!orgId?.trim();
  const isNameValid =
    !!firstNames?.trim() || !!(lastNameFather?.trim() || lastNameMother?.trim());
  const isCedulaValid = cedula && cleanDigits(cedula).length === 8; // MX 8 dígitos

  const prettyName = useMemo(() => {
    const fn = (firstNames || "").trim();
    const ap = (lastNameFather || "").trim();
    const am = (lastNameMother || "").trim();
    return [fn, ap, am].filter(Boolean).join(" ");
  }, [firstNames, lastNameFather, lastNameMother]);

  // Permitir guardar solo si el perfil NO está cargado
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

    // Bloqueo si ya existe
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

          // Segmentado
          firstNames: firstNames.trim(),
          lastNameFather: lastNameFather.trim(),
          lastNameMother: lastNameMother.trim(),

          // Compuesto
          name: prettyName,

          // Otros
          phone: cleanDigits(phone),
          role: role.trim(),
          cedula: cedula.trim(),

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      localStorage.setItem("orgId", orgId.trim());
      setMsg("Perfil guardado. Los datos han sido bloqueados para su visualización.");
      setIsProfileLoaded(true);

      // Mini-toast (3s)
      setToastMsg("¡Perfil guardado con éxito!");
      setShowToast(true);

      // Si quieres mantener el modal de confetti:
      // setShowConfetti(true);
    } catch (e) {
      console.error("Error al guardar perfil:", e);
      setErr("No se pudo guardar el perfil. Revisa la consola y reglas.");
    } finally {
      setSaving(false);
      setBusyMsg("");
    }
  }

  const rightActions = (
    <button onClick={handleLogout} className="btn ghost h-10" title="Cerrar sesión">
      <span className="material-symbols-outlined" style={{marginRight:6}}>logout</span>
      Cerrar sesión
    </button>
  );
  const isDisabled = saving || isProfileLoaded;

  if (loading || !ready) {
    return (
      <AppLayout
        title="Perfil del doctor"
        leftActions={
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="btn-ghost h-9"
            title={sidebarCollapsed ? "Expandir" : "Contraer"}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        }
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
      title="Perfil del doctor"
      rightActions={rightActions}
      leftActions={
        <button
          onClick={() => setSidebarCollapsed((v) => !v)}
          className="btn-ghost h-9"
          title={sidebarCollapsed ? "Expandir" : "Contraer"}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      }
      sidebar={
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
      }
    >
      <LoadingOverlay open={!!busyMsg} message={busyMsg} />

      {/* Mini-toast flotante 3s */}
      {showToast && (
        <MiniToast message={toastMsg} onClose={() => setShowToast(false)} />
      )}

      {/* (Opcional) Confetti modal si deseas conservarlo */}
      {showConfetti && (
        <ConfettiAlert
          message="¡Tu perfil ha sido guardado exitosamente y ahora está bloqueado para proteger tus datos!"
          onClose={() => setShowConfetti(false)}
        />
      )}

      {/* RUTA / MENSAJES */}
      <div className="px-4 sm:px-6 pt-8 maxw-7xl mx-auto">
        <p className="caption text-muted">Datos requeridos de acuerdo a la NOM</p>
        {msg && <div className="mt-2 text-primary font-semibold">{msg}</div>}
        {err && <div className="alert-error-banner mt-2">{err}</div>}
      </div>

      {/* Tarjeta formulario */}
      <section className="px-4 sm:px-6 pb-8 maxw-7xl mx-auto">
        <div className="card mt-4 p-6">
          <form onSubmit={onSubmit} className="fields-grid gap-y-6">
            {/* Organización */}
            <div className="form-field span-2">
              <label className="label">Organización / Institución *</label>
              <input
                type="text"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Ej. miClinica, etc."
                required
                className={`input h-11 ${isDisabled ? "input-readonly" : ""}`}
                readOnly={isDisabled}
              />
            </div>

            {/* Email (solo lectura) */}
            <div className="form-field">
              <label className="label">Correo (solo lectura)</label>
              <input
                type="email"
                value={user?.email || ""}
                readOnly
                className="input input-readonly h-11"
              />
            </div>

            {/* Cédula profesional */}
            <div className="form-field">
              <label className="label">
                Cédula Profesional{" "}
                {cedula && !isDisabled ? (isCedulaValid ? "✅" : "❌ 8 dígitos") : ""}
              </label>
              <input
                type="text"
                value={cedula}
                onChange={(e) => {
                  const char = e.target.value.replace(/\D+/g, "").slice(0, 8);
                  setCedula(char);
                }}
                placeholder="12345678"
                className={`input h-11 ${
                  cedula && !isCedulaValid && !isDisabled ? "input-error" : ""
                } ${isDisabled ? "input-readonly" : ""}`}
                readOnly={isDisabled}
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
                className={`input h-11 ${isDisabled ? "input-readonly" : ""}`}
                readOnly={isDisabled}
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
                className={`input h-11 ${isDisabled ? "input-readonly" : ""}`}
                readOnly={isDisabled}
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
                className={`input h-11 ${isDisabled ? "input-readonly" : ""}`}
                readOnly={isDisabled}
              />
            </div>

            {/* Teléfono */}
            <div className="form-field">
              <label className="label">
                Teléfono{" "}
                {phone && !isDisabled ? (isPhoneValid ? "✅" : "❌ 10 dígitos") : ""}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D+/g, "").slice(0, 10);
                  setPhone(digits);
                }}
                placeholder="5512345678"
                className={`input h-11 ${
                  phone && !isPhoneValid && !isDisabled ? "input-error" : ""
                } ${isDisabled ? "input-readonly" : ""}`}
                readOnly={isDisabled}
              />
              <p className="caption text-muted mt-1">
                Se guardará como 10 dígitos (sin espacios).
              </p>
            </div>

            {/* Rol / Puesto */}
            <div className="form-field">
              <label className="label">Rol / Puesto</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Terapeuta, Admin…"
                className={`input h-11 ${isDisabled ? "input-readonly" : ""}`}
                readOnly={isDisabled}
              />
            </div>

            {/* Guardar */}
            <div className="span-2 flex justify-end mt-4">
              <button
                type="submit"
                disabled={!canSubmit || saving || isProfileLoaded}
                className={`btn primary h-12 px-6 ${
                  !canSubmit || saving || isProfileLoaded ? "is-disabled" : ""
                }`}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>

          {/* Vista previa del nombre */}
          <div className="mt-6 caption text-muted">
            <b>Nombre Completo:</b> {prettyName || "—"}
          </div>

          {/* Aviso de bloqueo */}
          {isProfileLoaded && (
            <div className="mt-4 alert-warn">
              ⚠️Los datos ya han sido guardados. No se
              permiten modificaciones.
            </div>
          )}
        </div>
      </section>

      {/* (Si mantienes ConfettiAlert duplicado al final) */}
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
