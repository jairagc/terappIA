// src/pages/RegisterNewPatient.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";

// --- CSS local para layout responsive ---
const pageCSS = `
  .maxw-7xl { max-width: 1120px; margin: 0 auto; }
  .regp-page { padding: 16px; width: 100%; box-sizing: border-box; }

  .card {
    background:#fff;
    border-radius:16px;
    border:1px solid var(--line-soft,#e6ebf3);
    box-shadow:0 2px 10px rgba(0,0,0,.04);
    width:100%;
    box-sizing:border-box;
    overflow:hidden;
  }

  .form-2col {
    display:grid;
    grid-template-columns: minmax(0,1.5fr);
    gap:16px;
    width:100%;
    box-sizing:border-box;
  }
  .form-stack {
    display:flex;
    flex-direction:column;
    gap:16px;
    width:100%;
  }

  .fields-grid {
    display:grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap:12px 16px;
    width:100%;
    box-sizing:border-box;
  }
  .fields-grid .span-2 { grid-column: span 2; }
  .fields-stack { display:flex; flex-direction:column; gap:12px; width:100%; }

  .form-field {
    display:flex;
    flex-direction:column;
    gap:4px;
    min-width:0;
    width:100%;
    box-sizing:border-box;
  }
  .label { font-weight:700; font-size:14px; }

  .input,
  .select {
    width:100%;
    max-width:100%;
    border-radius:12px;
    border:1px solid var(--line-soft,#e6ebf3);
    padding:0 12px;
    background:#fff;
    box-sizing:border-box;
  }
  .input.h-12,
  .select.h-12 { height:48px; }

  .textarea {
    width:100%;
    max-width:100%;
    min-height:96px;
    padding:8px 12px;
    border-radius:12px;
    border:1px solid var(--line-soft,#e6ebf3);
    resize:vertical;
    font: inherit;
    box-sizing:border-box;
  }

  .btn-primary {
    background:var(--accent-blue,#2156e6);
    color:#fff;
    border-radius:999px;
    border:none;
    padding:0 20px;
    font-weight:800;
  }

  .section-title { font-size:18px; font-weight:800; }
  .caption { font-size:12px; }

  /* Tablet */
  @media (max-width: 1024px) {
    .form-2col { grid-template-columns:minmax(0,1fr); }
  }

  /* Móvil */
  @media (max-width: 640px) {
    .regp-page { padding:12px; }
    .card { border-radius:14px; padding:14px !important; }

    .fields-grid {
      grid-template-columns:1fr;
      gap:10px;
    }
    .fields-grid .span-2 { grid-column: span 1; }

    .label { font-size:12px; }
    .input.h-12,
    .select.h-12 {
      height:40px;
      padding:0 10px;
      font-size:13px;
    }
    .textarea {
      min-height:80px;
      font-size:13px;
    }
    .section-title { font-size:16px; }
    .btn-primary {
      height:42px;
      font-size:14px;
      padding:0 16px;
    }
  }
`;

// --- UTILIDADES DE VALIDACIÓN ---
const validateEmail = (email) => {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const validatePhone = (phone) => {
  if (!phone) return true;
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 8 && cleaned.length <= 15;
};
// -------------------------------

export default function RegisterNewPatient() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const uid = user?.uid || null;

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [orgId, setOrgId] = useState("");
  useEffect(() => { setOrgId(localStorage.getItem("orgId") || ""); }, []);

  const [form, setForm] = useState({
    fullName: "", age: "", gender: "", phone: "", address: "", email: "",
    medicalConditions: "", allergies: "", medications: "", notes: ""
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const onChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const isEmailValid = useMemo(() => validateEmail(form.email), [form.email]);
  const isPhoneValid = useMemo(() => validatePhone(form.phone), [form.phone]);

  const isValid = useMemo(() =>
    orgId.trim().length > 0 &&
    !!uid &&
    form.fullName.trim().length > 0 &&
    String(form.age || "").length > 0 &&
    isEmailValid &&
    isPhoneValid
  , [orgId, uid, form.fullName, form.age, isEmailValid, isPhoneValid]);

  const genId = () => (crypto?.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`);

  const handleSave = async () => {
    setErr(""); setMsg("");
    if (!uid) return setErr("No hay sesión activa.");
    if (!orgId.trim()) return setErr("Debes capturar tu Organización en Perfil antes de registrar pacientes.");
    if (!isValid) {
      if (!isEmailValid) return setErr("El formato del correo electrónico es inválido.");
      if (!isPhoneValid) return setErr("El número de teléfono es inválido. Debe contener entre 8 y 15 dígitos.");
      return setErr("Faltan campos obligatorios (Nombre completo y Edad).");
    }

    try {
      setSaving(true);
      const patientId = genId();
      const ref = doc(db, "orgs", orgId.trim(), "doctors", uid, "patients", patientId);
      await setDoc(ref, {
        patientId,
        fullName: form.fullName.trim(),
        age: Number(form.age) || null,
        gender: form.gender || "",
        phone: form.phone ? form.phone.replace(/\D/g, "") : "",
        address: form.address?.trim() || "",
        email: form.email?.trim() || "",
        medicalConditions: form.medicalConditions?.trim() || "",
        allergies: form.allergies?.trim() || "",
        medications: form.medications?.trim() || "",
        notes: form.notes?.trim() || "",
        orgId: orgId.trim(),
        doctorUid: uid,
        doctorEmail: user?.email || null,
        doctorDisplayName: user?.displayName || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setMsg("Paciente registrado.");
      navigate("/patient-list", { replace: true });
    } catch (e) {
      console.error("Error guardando paciente:", e);
      setErr("No se pudo registrar el paciente (revisa consola y reglas).");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); navigate("/login", { replace: true }); }
    catch (e) { console.error("Logout failed:", e); }
  };

  const leftActions = (
    <button
      onClick={() => setSidebarCollapsed(v => !v)}
      className="btn-ghost h-9"
      title={sidebarCollapsed ? "Expandir" : "Contraer"}
    >
      <span className="material-symbols-outlined">menu</span>
    </button>
  );
  const rightActions = (
    <div className="flex-row-center">
      <button onClick={() => navigate("/patient-list")} className="btn ghost h-10">
        Regresar
      </button>
      <button onClick={handleLogout} className="btn ghost h-10">
        Cerrar sesión
      </button>
    </div>
  );

  return (
    <AppLayout
      title="Registrar paciente"
      leftActions={leftActions}
      rightActions={rightActions}
      sidebar={<AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />}
    >
      <style>{pageCSS}</style>

      <LoadingOverlay open={saving} message="Guardando paciente…" />

      <div className="regp-page maxw-7xl">
        {(err || msg || !orgId) && (
          <div className="mb-4 sm:mb-6">
            {!orgId && (
              <div className="alert-warn text-sm sm:text-base">
                ⚠️ Debes capturar tu <b>Organización</b> en <b>Perfil</b> antes de registrar pacientes.
              </div>
            )}
            {err && <div className="alert-error text-sm sm:text-base mt-2">{err}</div>}
            {msg && <div className="alert-success text-sm sm:text-base mt-2">{msg}</div>}
          </div>
        )}

        <div className="form-2col">
          <div className="form-stack">
            {/* Datos básicos */}
            <div className="card p-5 sm:p-6">
              <h2 className="section-title mb-4 sm:mb-6">Datos del paciente</h2>

              <div className="fields-grid">
                <label className="form-field span-2">
                  <span className="label">Nombre completo *</span>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={onChange}
                    placeholder="Nombre completo"
                    className="input h-12"
                    required
                  />
                </label>

                <label className="form-field">
                  <span className="label">Edad *</span>
                  <input
                    type="number"
                    name="age"
                    value={form.age}
                    onChange={onChange}
                    placeholder="Edad"
                    className="input h-12"
                    required
                  />
                </label>

                <label className="form-field">
                  <span className="label">Género</span>
                  <div className="select-wrap">
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={onChange}
                      className="select h-12"
                    >
                      <option value="">Seleccionar género</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </label>

                <label className="form-field">
                  <span className="label">
                    Teléfono {form.phone && !isPhoneValid && <span className="text-error">❌</span>}
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={onChange}
                    placeholder="5512345678"
                    className={`input h-12 ${form.phone && !isPhoneValid ? "input-error" : ""}`}
                  />
                  <span className="caption text-muted">Se recomienda capturar 8-15 dígitos.</span>
                </label>

                <label className="form-field span-2">
                  <span className="label">Dirección</span>
                  <input
                    name="address"
                    value={form.address}
                    onChange={onChange}
                    placeholder="Dirección completa"
                    className="input h-12"
                  />
                </label>

                <label className="form-field span-2">
                  <span className="label">
                    Correo electrónico {form.email && !isEmailValid && <span className="text-error">❌</span>}
                  </span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="ejemplo@correo.com"
                    className={`input h-12 ${form.email && !isEmailValid ? "input-error" : ""}`}
                  />
                </label>
              </div>
            </div>

            {/* Historial médico */}
            <div className="card p-5 sm:p-6">
              <h2 className="section-title mb-4 sm:mb-6">Historial médico</h2>
              <div className="fields-stack">
                <label className="form-field">
                  <span className="label">Condiciones médicas previas</span>
                  <textarea
                    name="medicalConditions"
                    value={form.medicalConditions}
                    onChange={onChange}
                    placeholder="Liste condiciones relevantes…"
                    className="textarea"
                  />
                </label>
                <label className="form-field">
                  <span className="label">Alergias</span>
                  <textarea
                    name="allergies"
                    value={form.allergies}
                    onChange={onChange}
                    placeholder="Liste alergias conocidas…"
                    className="textarea"
                  />
                </label>
                <label className="form-field">
                  <span className="label">Medicamentos actuales</span>
                  <textarea
                    name="medications"
                    value={form.medications}
                    onChange={onChange}
                    placeholder="Liste medicamentos actuales…"
                    className="textarea"
                  />
                </label>
                <label className="form-field">
                  <span className="label">Notas adicionales</span>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={onChange}
                    placeholder="Añada cualquier nota adicional aquí…"
                    className="textarea"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* CTA inferior */}
        <div className="mt-6 flex-row-center" style={{ justifyContent: "center" }}>
          <button
            onClick={handleSave}
            disabled={!isValid || !orgId || !uid || saving}
            className="btn-primary"
            style={{
              minWidth: 220,
              height: 48,
              opacity: (!isValid || !orgId || !uid || saving) ? 0.6 : 1,
            }}
          >
            {saving ? "Guardando…" : "Registrar paciente"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
