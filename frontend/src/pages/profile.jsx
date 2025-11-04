// src/pages/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import AppSidebar from "../components/AppSidebar";
import { useDoctorProfile } from "../services/userDoctorProfile";

export default function Profile() {
  const { user, loading } = useAuth();
  const uid = user?.uid || null;

  // Perfil leído (para prefill org y nombre si ya existen)
  const { orgId: orgFromProfile } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );

  // UI
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Campos del form
  const [orgId, setOrgId] = useState("");
  const [firstNames, setFirstNames] = useState(""); // Nombres
  const [lastNameFather, setLastNameFather] = useState(""); // Apellido paterno
  const [lastNameMother, setLastNameMother] = useState(""); // Apellido materno
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [cedula, setCedula] = useState("");

  // Nombre inicial de referencia (si no hay perfil guardado aún)
  const initialDisplay = useMemo(() => user?.displayName || "", [user?.displayName]);

  // Carga inicial: org desde perfil o localStorage, y prefill básico
  useEffect(() => {
    const cachedOrg = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cachedOrg);

    // Si el displayName trae “Nombre Apellido…”, deja sólo en Nombres para no asumir apellidos
    if (initialDisplay && !firstNames) setFirstNames(initialDisplay);

    setReady(true);
  }, [orgFromProfile, initialDisplay]); // eslint-disable-line

  // Cuando ya hay uid+org, carga perfil desde Firestore
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid || !orgId) return;
      try {
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
        } else {
          setMsg("No había perfil en Firestore. Captura tus datos y guarda.");
        }
      } catch (e) {
        console.error("Error al cargar perfil:", e);
        setErr("No se pudo cargar tu perfil. Revisa la consola.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, orgId]); // eslint-disable-line

  // Validaciones
  const cleanDigits = (s) => (s || "").replace(/\D+/g, "");
  const isPhoneValid = phone && cleanDigits(phone).length === 10; // 10 dígitos MX
  const isOrgValid = !!orgId?.trim();
  const isNameValid = !!firstNames?.trim() || !!(lastNameFather?.trim() || lastNameMother?.trim());

  const prettyName = useMemo(() => {
    const fn = (firstNames || "").trim();
    const ap = (lastNameFather || "").trim();
    const am = (lastNameMother || "").trim();
    return [fn, ap, am].filter(Boolean).join(" ");
  }, [firstNames, lastNameFather, lastNameMother]);

  const canSubmit = !!uid && isOrgValid && isNameValid && (!phone || isPhoneValid);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

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

    try {
      setSaving(true);
      const ref = doc(db, "orgs", orgId.trim(), "doctors", uid);
      await setDoc(
        ref,
        {
          email: user?.email ?? null,
          orgId: orgId.trim(),

          // Campos segmentados
          firstNames: firstNames.trim(),
          lastNameFather: lastNameFather.trim(),
          lastNameMother: lastNameMother.trim(),

          // Campo compuesto para mostrar en otras pantallas
          name: prettyName,

          // Otros
          phone: cleanDigits(phone), // guardamos solo dígitos
          role: role.trim(),
          cedula: cedula.trim(),

          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      localStorage.setItem("orgId", orgId.trim());
      setMsg("Perfil guardado.");
    } catch (e) {
      console.error("Error al guardar perfil:", e);
      setErr("No se pudo guardar el perfil. Revisa la consola y reglas.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !ready) return <div className="p-8">Cargando…</div>;

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark font-display">
      {/* Sidebar unificado */}
      <AppSidebar collapsed={sidebarCollapsed} />

      {/* Columna principal */}
      <div className="flex-1 flex flex-col">
        {/* Header con el mismo toggle */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-[#0f1520] shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Perfil del doctor
            </h1>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
          {/* Ruta */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Ruta: <code>orgs/{orgId || "{orgId}"}/doctors/{uid || "{uid}"}</code>
          </p>

          {/* Mensajes */}
          {err && (
            <div className="mb-4 rounded-md bg-red-50 dark:bg-rose-900/30 p-3 text-red-700 dark:text-rose-200">
              {err}
            </div>
          )}
          {msg && (
            <div className="mb-4 rounded-md bg-emerald-50 dark:bg-emerald-900/30 p-3 text-emerald-700 dark:text-emerald-200">
              {msg}
            </div>
          )}

          {/* Tarjeta del formulario */}
          <div className="bg-white dark:bg-[#121826] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6">
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organización */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Organización / Institución *</label>
                <input
                  type="text"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  placeholder="Ej. docker1, miClinica, etc."
                  required
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0d121b] dark:text-white"
                />
              </div>

              {/* Email (solo lectura) */}
              <div>
                <label className="block text-sm font-medium mb-1">Correo (solo lectura)</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  className="w-full h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                />
              </div>

              {/* Cédula profesional */}
              <div>
                <label className="block text-sm font-medium mb-1">Cédula profesional</label>
                <input
                  type="text"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="Ej. 1234567"
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0d121b] dark:text-white"
                />
              </div>

              {/* Nombres */}
              <div>
                <label className="block text-sm font-medium mb-1">Nombres *</label>
                <input
                  type="text"
                  value={firstNames}
                  onChange={(e) => setFirstNames(e.target.value)}
                  required
                  placeholder="María Fernanda"
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0d121b] dark:text-white"
                />
              </div>

              {/* Apellido paterno */}
              <div>
                <label className="block text-sm font-medium mb-1">Apellido paterno</label>
                <input
                  type="text"
                  value={lastNameFather}
                  onChange={(e) => setLastNameFather(e.target.value)}
                  placeholder="García"
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0d121b] dark:text-white"
                />
              </div>

              {/* Apellido materno */}
              <div>
                <label className="block text-sm font-medium mb-1">Apellido materno</label>
                <input
                  type="text"
                  value={lastNameMother}
                  onChange={(e) => setLastNameMother(e.target.value)}
                  placeholder="Hernández"
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0d121b] dark:text-white"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Teléfono {phone ? (isPhoneValid ? "✅" : "❌ 10 dígitos") : ""}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => {
                    // Solo dígitos, máx 10
                    const digits = e.target.value.replace(/\D+/g, "").slice(0, 10);
                    setPhone(digits);
                  }}
                  placeholder="5512345678"
                  className={`w-full h-11 px-3 rounded-lg border ${
                    phone && !isPhoneValid
                      ? "border-rose-500 focus:border-rose-500"
                      : "border-gray-300 dark:border-gray-600"
                  } bg-white dark:bg-gray-700 text-[#0d121b] dark:text-white`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se guardará como 10 dígitos (sin espacios).
                </p>
              </div>

              {/* Rol / Puesto */}
              <div>
                <label className="block text-sm font-medium mb-1">Rol / Puesto</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Terapeuta, Admin…"
                  className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[#0d121b] dark:text-white"
                />
              </div>

              {/* Botón guardar */}
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className={`inline-flex items-center rounded-full h-12 px-6 text-white font-semibold ${
                    canSubmit && !saving
                      ? "bg-primary hover:shadow-md"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>

            {/* Vista previa del nombre que se guardará */}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <b>Nombre de correo:</b> {prettyName || "—"}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
