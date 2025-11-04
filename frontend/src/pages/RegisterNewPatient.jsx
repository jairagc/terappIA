// src/pages/RegisterNewPatient.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function RegisterNewPatient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid || null;

  // orgId desde Profile (localStorage)
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    const cachedOrg = localStorage.getItem("orgId") || "";
    setOrgId(cachedOrg);
  }, []);

  // estado del formulario (controlado)
  const [form, setForm] = useState({
    fullName: "",
    age: "",
    gender: "",
    phone: "",
    address: "",
    email: "",
    medicalConditions: "",
    allergies: "",
    medications: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const isValid = useMemo(() => {
    return (
      orgId.trim().length > 0 &&
      !!uid &&
      form.fullName.trim().length > 0 &&
      String(form.age || "").length > 0
    );
  }, [orgId, uid, form.fullName, form.age]);

  const genId = () => {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return `p_${Date.now()}`;
  };

  const handleSave = async () => {
    setErr("");
    setMsg("");
    if (!uid) {
      setErr("No hay sesión activa.");
      return;
    }
    if (!orgId.trim()) {
      setErr("Debes capturar tu Organización en Perfil antes de registrar pacientes.");
      return;
    }
    if (!isValid) {
      setErr("Faltan campos obligatorios (Nombre completo y Edad).");
      return;
    }

    try {
      setSaving(true);
      const patientId = genId();
      const ref = doc(db, "orgs", orgId.trim(), "doctors", uid, "patients", patientId);

      await setDoc(
        ref,
        {
          patientId,
          fullName: form.fullName.trim(),
          age: Number(form.age) || null,
          gender: form.gender || "",
          phone: form.phone?.trim() || "",
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
        },
        { merge: true }
      );

      setMsg("Paciente registrado.");
      navigate("/patient-list", { replace: true });
    } catch (e) {
      console.error("Error guardando paciente:", e);
      setErr("No se pudo registrar el paciente (revisa consola y reglas).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#0d121b] dark:text-white">
      <div className="layout-container flex h-full grow flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white dark:bg-background-dark shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between whitespace-nowrap h-16">
              <div className="flex items-center gap-4 text-primary">
                <div className="size-8">
                  <svg className="text-primary" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z" fill="currentColor"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold leading-tight tracking-[-0.015em] text-primary">TerappIA</h2>
              </div>
              <button
                onClick={() => navigate("/generate-progress-note")}
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em]"
              >
                <span className="truncate">Regresar</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap justify-between gap-3 mb-8">
              <p className="text-4xl font-black leading-tight tracking-[-0.033em] text-[#0d121b] dark:text-white min-w-72">
                Registrar paciente
              </p>
            </div>

            {/* Mensajes */}
            {(err || msg || !orgId) && (
              <div className="mb-6">
                {!orgId && (
                  <div className="rounded-md bg-yellow-50 p-3 text-yellow-800">
                    ⚠️ Debes capturar tu <strong>Organización</strong> en la página de <strong>Perfil</strong> antes de registrar pacientes.
                  </div>
                )}
                {err && <div className="mt-2 rounded-md bg-red-50 p-3 text-red-700">{err}</div>}
                {msg && <div className="mt-2 rounded-md bg-green-50 p-3 text-green-700">{msg}</div>}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-8">
                {/* Patient data */}
                <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
                  <h2 className="text-[#0d121b] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-6">
                    Datos del paciente
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Nombre completo *
                      </p>
                      <input
                        name="fullName"
                        value={form.fullName}
                        onChange={onChange}
                        placeholder="Nombre completo"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                        required
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Edad *
                      </p>
                      <input
                        type="number"
                        name="age"
                        value={form.age}
                        onChange={onChange}
                        placeholder="Edad"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                        required
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Género
                      </p>
                      <select
                        name="gender"
                        value={form.gender}
                        onChange={onChange}
                        className="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      >
                        <option value="">Seleccionar género</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Teléfono
                      </p>
                      <input
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={onChange}
                        placeholder="Número de teléfono"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col md:col-span-2">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Dirección
                      </p>
                      <input
                        name="address"
                        value={form.address}
                        onChange={onChange}
                        placeholder="Dirección completa"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col md:col-span-2">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Correo electrónico
                      </p>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={onChange}
                        placeholder="ejemplo@correo.com"
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-12 placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>
                  </div>
                </div>

                {/* Medical history */}
                <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
                  <h2 className="text-[#0d121b] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] mb-6">
                    Historial médico
                  </h2>

                  <div className="grid grid-cols-1 gap-6">
                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Condiciones médicas previas
                      </p>
                      <textarea
                        name="medicalConditions"
                        value={form.medicalConditions}
                        onChange={onChange}
                        placeholder="Liste condiciones relevantes..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Alergias
                      </p>
                      <textarea
                        name="allergies"
                        value={form.allergies}
                        onChange={onChange}
                        placeholder="Liste alergias conocidas..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Medicamentos actuales
                      </p>
                      <textarea
                        name="medications"
                        value={form.medications}
                        onChange={onChange}
                        placeholder="Liste medicamentos actuales..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>

                    <label className="flex flex-col">
                      <p className="text-[#0d121b] dark:text-white text-base font-medium leading-normal pb-2">
                        Notas adicionales
                      </p>
                      <textarea
                        name="notes"
                        value={form.notes}
                        onChange={onChange}
                        placeholder="Añada cualquier nota adicional aquí..."
                        className="form-textarea flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#0d121b] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark min-h-[120px] placeholder:text-gray-400 dark:placeholder-gray-500 p-3 text-base font-normal"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-1">
                <div className="sticky top-24">
                  <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
                    <h3 className="text-[#0d121b] dark:text-white text-lg font-bold mb-4">
                      Adjuntar documentos
                    </h3>
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark">
                      <span className="material-symbols-outlined text-5xl text-gray-400 dark:text-gray-500">
                        description
                      </span>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Arrastra y suelta archivos o
                      </p>
                      <button
                        type="button"
                        disabled
                        className="mt-4 flex min-w-[84px] max-w-[480px] cursor-not-allowed items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary/60 text-white text-sm font-bold leading-normal tracking-[0.015em]"
                        title="Conectamos a GCS en el siguiente paso"
                      >
                        <span className="truncate">Seleccionar archivos</span>
                      </button>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                        Se guardarán en: <code>gs://{orgId || "org"}/{uid || "doctor"}/{"{patientId}"}/sessions/...</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="mt-12 flex justify-center">
              <button
                onClick={handleSave}
                disabled={!isValid || !orgId || !uid || saving}
                className="flex min-w-[200px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] disabled:opacity-60"
              >
                <span className="truncate">{saving ? "Guardando..." : "Registrar paciente"}</span>
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-background-dark/50 mt-auto border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 dark:text-gray-400">
              <div className="flex space-x-4 mb-4 sm:mb-0">
                <a href="#" className="hover:text-primary">Contact Us</a>
                <a href="#" className="hover:text-primary">Privacy Policy</a>
                <a href="#" className="hover:text-primary">Terms of Service</a>
              </div>
              <p>© 2024 MentalHealthNLP. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
