// src/pages/PatientList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

// Sidebar reutilizable y perfil del doctor
import AppSidebar from "../components/AppSidebar";
import { useDoctorProfile } from "../services/userDoctorProfile";

export default function PatientList() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const uid = user?.uid || null;

  // Perfil (trae orgId preferentemente de Firestore)
  const { orgId: orgFromProfile } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );

  const [orgId, setOrgId] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // UI
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  // orgId: perfil ➜ localStorage
  useEffect(() => {
    const cachedOrg = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cachedOrg);
  }, [orgFromProfile]);

  // Cargar pacientes
  useEffect(() => {
    let alive = true;
    async function loadPatients() {
      try {
        setLoading(true);
        setErr("");
        setPatients([]);
        if (!uid || !orgId) {
          setLoading(false);
          return;
        }
        const colRef = collection(db, "orgs", orgId, "doctors", uid, "patients");
        const qy = query(colRef, orderBy("fullName"));
        const snap = await getDocs(qy);
        if (!alive) return;
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPatients(rows);
      } catch (e) {
        console.error("Error cargando pacientes:", e);
        if (alive) setErr("No se pudieron cargar los pacientes.");
      } finally {
        alive && setLoading(false);
      }
    }
    loadPatients();
    return () => {
      alive = false;
    };
  }, [uid, orgId]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const initials = (name = "") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "P";

  const headerTitle = useMemo(
    () => (orgId ? `Pacientes — ${orgId}` : "Pacientes"),
    [orgId]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter((p) => {
      const haystack = [
        p.fullName,
        p.email,
        p.phone,
        p.address,
        p.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [patients, search]);

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark font-display">
      {/* Sidebar unificado */}
      <AppSidebar collapsed={sidebarCollapsed} />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col">
        {/* Header con toggle, mantiene tu estética */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-[#0f1520] shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                />
              </svg>
            </button>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              {headerTitle}
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => navigate("/generate-progress-note")}
              className="inline-flex items-center rounded-full h-10 px-4 bg-primary text-white font-semibold"
            >
              Nueva nota
            </button>
            <button
              onClick={() => navigate("/register-new-patient")}
              className="inline-flex items-center rounded-full h-10 px-4 bg-primary text-white font-semibold"
            >
              Agregar paciente
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center rounded-full h-10 px-4 bg-gray-200 dark:bg-gray-700 font-semibold"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
          {/* Avisos org */}
          {!orgId && (
            <div className="mb-4 rounded-md bg-yellow-50 p-3 text-yellow-800">
              ⚠️ Primero captura tu <strong>Organización</strong> en <strong>Perfil</strong>.
            </div>
          )}
          {err && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{err}</div>
          )}

          {/* Barra de acciones / filtros */}
          <section className="rounded-xl bg-[#f5f5f5] dark:bg-gray-800 p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-3 py-1 text-sm font-medium">
                  Total: {patients.length}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 px-3 py-1 text-sm font-medium">
                  Filtrados: {filtered.length}
                </span>
              </div>

              <div className="relative w-full sm:w-80">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  search
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, email, teléfono…"
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-[#0d121b] dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {["Búsqueda avanzada", "Últimos 7 días", "Importancia"].map(
                (label) => (
                  <button
                    key={label}
                    className="flex h-9 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-gray-700 px-4 text-sm text-[#0d121b] dark:text-white"
                    type="button"
                  >
                    {label}
                    <span className="material-symbols-outlined text-base">
                      expand_more
                    </span>
                  </button>
                )
              )}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-[#0d121b] dark:text-white">
                  Fecha:
                </label>
                <input
                  type="date"
                  className="h-9 rounded-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm px-3"
                />
              </div>
              <button
                type="button"
                className="flex h-9 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-gray-700 px-4 text-sm text-[#0d121b] dark:text-white"
              >
                Aplicar filtros
              </button>

            </div>
          </section>

          {/* Estados */}
          {loading && (
            <div className="mt-6 text-gray-600 dark:text-gray-300">
              Cargando pacientes…
            </div>
          )}

          {/* Lista / vacíos */}
          {!loading && !err && (
            <>
              {filtered.length === 0 ? (
                <div className="mt-6 rounded-xl bg-white dark:bg-gray-800 p-8 text-center">
                  <p className="text-gray-700 dark:text-gray-300">
                    {patients.length === 0
                      ? "No hay pacientes. Agrega uno con el botón “Agregar paciente”."
                      : "No hay resultados con el filtro/búsqueda."}
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="rounded-full size-12 flex items-center justify-center text-white font-bold"
                          style={{ background: "#475569" }}
                          title={p.fullName}
                        >
                          {initials(p.fullName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#0d121b] dark:text-white text-base font-bold truncate">
                            {p.fullName || p.id}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
                            {p.email || p.phone || p.address
                              ? [p.email, p.phone, p.address]
                                  .filter(Boolean)
                                  .join(" · ")
                              : "Sin datos de contacto"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs">
                          ID: {p.id}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              navigate("/generate-progress-note", {
                                state: { patientId: p.id },
                              })
                            }
                            className="rounded-lg h-9 px-3 bg-[#e7ebf3] dark:bg-gray-700 text-[#0d121b] dark:text-white text-sm font-medium"
                          >
                            Ver/crear nota
                          </button>
                          <button
                            onClick={() => navigate("/patient-progress-note-overview", {
                              state: {
                                orgId,
                                patientId: p.id,
                                sessionId: null,
                                noteId: null,
                                source: "manual",
                              },
                            })}
                            className="rounded-lg h-9 px-3 bg-gray-100 dark:bg-gray-600 text-sm"
                          >
                            Abrir detalle
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
