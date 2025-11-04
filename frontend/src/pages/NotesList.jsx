// src/pages/NotesList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import AppSidebar from "../components/AppSidebar";
import { useDoctorProfile } from "../services/userDoctorProfile";

/**
 * Utilidad: parsea el path de una nota para extraer orgId, doctorUid, patientId, sessionId, noteId
 * Path esperado:
 * orgs/{orgId}/doctors/{uid}/patients/{patientId}/sessions/{sessionId}/notes/{noteId}
 */
function parseNotePath(path) {
  // ej: ["orgs","{org}","doctors","{uid}","patients","{p}","sessions","{s}","notes","{n}"]
  const parts = String(path || "").split("/");
  const findAfter = (key) => {
    const i = parts.indexOf(key);
    return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
  };
  return {
    orgId: findAfter("orgs"),
    doctorUid: findAfter("doctors"),
    patientId: findAfter("patients"),
    sessionId: findAfter("sessions"),
    noteId: findAfter("notes"),
  };
}

/** Render amigable de Timestamp o Date */
function fmtDate(ts) {
  try {
    const d =
      ts && typeof ts.toDate === "function" ? ts.toDate() : ts instanceof Date ? ts : null;
    return d ? d.toLocaleString() : "—";
  } catch {
    return "—";
  }
}

export default function NotesList() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const uid = user?.uid || null;

  // Perfil (org preferente desde Firestore, si no, localStorage)
  const { orgId: orgFromProfile, name: doctorName } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );
  const [orgId, setOrgId] = useState("");

  // UI
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  // Datos
  const [notes, setNotes] = useState([]); // [{meta,path,docData,patientName},...]
  const [patientsMap, setPatientsMap] = useState({}); // {patientId: fullName}

  // orgId desde perfil o localStorage
  useEffect(() => {
    const cached = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cached);
  }, [orgFromProfile]);

  // Cargar pacientes -> para mostrar nombre en tarjetas
  useEffect(() => {
    let alive = true;
    async function loadPatients() {
      if (!uid || !orgId) return;
      try {
        const colRef = collection(db, "orgs", orgId, "doctors", uid, "patients");
        const snap = await getDocs(colRef);
        if (!alive) return;
        const map = {};
        snap.forEach((d) => (map[d.id] = d.data()?.fullName || d.id));
        setPatientsMap(map);
      } catch (e) {
        console.warn("No se pudieron cargar pacientes para map:", e);
      }
    }
    loadPatients();
    return () => {
      alive = false;
    };
  }, [uid, orgId]);

  // Cargar notas (collectionGroup) y filtrar por path del doctor/org
  useEffect(() => {
    let alive = true;
    async function loadNotes() {
      try {
        setLoading(true);
        setErr("");
        setNotes([]);
        if (!uid || !orgId) {
          setLoading(false);
          return;
        }

        // collectionGroup permite traer todas las "notes" bajo cualquier rama
        // Luego filtramos por path para quedarnos solo con /orgs/{orgId}/doctors/{uid}/...
        // (asumimos que las reglas de seguridad ya limitan acceso)
        const cg = collectionGroup(db, "notes");
        // Tip: si quieres ordenar globalmente por processed_at/created_at, añade índices compuestos
        const qy = query(cg, orderBy("processed_at", "desc"));
        const snap = await getDocs(qy);

        if (!alive) return;

        const rows = [];
        snap.forEach((d) => {
          const meta = parseNotePath(d.ref.path);
          // Filtro client-side por org y doctor
          if (meta.orgId === orgId && meta.doctorUid === uid) {
            rows.push({
              id: d.id,
              path: d.ref.path,
              meta,
              data: d.data(),
            });
          }
        });

        // Orden secundario si falta processed_at
        rows.sort((a, b) => {
          const ad = a.data?.processed_at || a.data?.created_at;
          const bd = b.data?.processed_at || b.data?.created_at;
          const av = ad?.toMillis ? ad.toMillis() : ad?.seconds ? ad.seconds * 1000 : 0;
          const bv = bd?.toMillis ? bd.toMillis() : bd?.seconds ? bd.seconds * 1000 : 0;
          return bv - av;
        });

        setNotes(rows);
      } catch (e) {
        console.error(e);
        setErr("No se pudieron cargar las notas.");
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
    return () => {
      alive = false;
    };
  }, [uid, orgId]);

  const headerTitle = useMemo(
    () => (orgId ? `Notas de evolución — ${orgId}` : "Notas de evolución"),
    [orgId]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => {
      const pName = patientsMap[n.meta.patientId] || n.meta.patientId || "";
      const text = [
        n.meta.noteId,
        n.meta.patientId,
        n.meta.sessionId,
        n.data?.type,
        pName,
        n.data?.ocr_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [notes, search, patientsMap]);

  const initials = (name = "") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "NT";

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {}
  };

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
              onClick={() => navigate("/patient-list")}
              className="inline-flex items-center rounded-full h-10 px-4 bg-gray-200 dark:bg-gray-700 font-semibold"
            >
              Ver pacientes
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
          {!orgId && (
            <div className="mb-4 rounded-md bg-yellow-50 p-3 text-yellow-800">
              ⚠️ Captura tu <strong>Organización</strong> en <strong>Perfil</strong> para ver tus notas.
            </div>
          )}
          {err && <div className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{err}</div>}

          {/* Barra de acciones */}
          <section className="rounded-xl bg-[#f5f5f5] dark:bg-gray-800 p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-3 py-1 text-sm font-medium">
                  Total: {notes.length}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 px-3 py-1 text-sm font-medium">
                  Filtradas: {filtered.length}
                </span>
              </div>

              <div className="relative w-full sm:w-96">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  search
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por paciente, ID, tipo, contenido…"
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-[#0d121b] dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {["Tipo", "Últimos 7 días", "Con emociones"].map((label) => (
                <button
                  key={label}
                  className="flex h-9 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-gray-700 px-4 text-sm text-[#0d121b] dark:text-white"
                  type="button"
                >
                  {label}
                  <span className="material-symbols-outlined text-base">expand_more</span>
                </button>
              ))}
            </div>
          </section>

          {/* Estados */}
          {loading && (
            <div className="mt-6 text-gray-600 dark:text-gray-300">Cargando notas…</div>
          )}

          {/* Lista */}
          {!loading && !err && (
            <>
              {filtered.length === 0 ? (
                <div className="mt-6 rounded-xl bg-white dark:bg-gray-800 p-8 text-center">
                  <p className="text-gray-700 dark:text-gray-300">
                    {notes.length === 0
                      ? "No hay notas aún. Crea una nueva."
                      : "No hay resultados con el filtro/búsqueda."}
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((n) => {
                    const pName = patientsMap[n.meta.patientId] || n.meta.patientId;
                    const topText = (n.data?.ocr_text || "").slice(0, 120);
                    const ts = n.data?.processed_at || n.data?.created_at;
                    const emo = n.data?.emotions?.resultado || n.data?.emotions;
                    // construir chips de emociones rápidas (top 2 por porcentaje si vienen en tu formato)
                    let emoChips = [];
                    if (emo && typeof emo === "object" && !Array.isArray(emo)) {
                      emoChips = Object.entries(emo)
                        .map(([k, v]) => {
                          const pctRaw =
                            v?.porcentaje ?? v?.score ?? v?.valor ?? v?.pct ?? null;
                          const pct =
                            pctRaw == null
                              ? null
                              : Number(pctRaw) <= 1
                              ? Math.round(Number(pctRaw) * 100)
                              : Math.round(Number(pctRaw));
                          return { label: k, pct };
                        })
                        .filter((x) => x.label)
                        .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
                        .slice(0, 2);
                    }

                    return (
                      <div
                        key={n.meta.noteId}
                        className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="rounded-full size-12 flex items-center justify-center text-white font-bold"
                            style={{ background: "#475569" }}
                            title={pName}
                          >
                            {initials(String(pName))}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[#0d121b] dark:text-white text-base font-bold truncate">
                              {pName}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 text-xs">
                              {fmtDate(ts)} · {n.data?.type || "text"}
                            </p>
                          </div>
                        </div>

                        {topText && (
                          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                            {topText}
                            {topText.length >= 120 ? "…" : ""}
                          </p>
                        )}

                        {/* Chips de emociones rápidas */}
                        {emoChips.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {emoChips.map((e, i) => {
                              const palette = [
                                "bg-yellow-100 text-yellow-800",
                                "bg-blue-100 text-blue-800",
                                "bg-rose-100 text-rose-800",
                                "bg-emerald-100 text-emerald-800",
                                "bg-purple-100 text-purple-800",
                              ];
                              const cls = palette[i % palette.length];
                              return (
                                <span
                                  key={`${n.meta.noteId}-${e.label}`}
                                  className={`inline-block ${cls} text-xs font-semibold px-2.5 py-1 rounded-full`}
                                >
                                  {e.label} {e.pct != null ? `${e.pct}%` : ""}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs">
                            Nota: {n.meta.noteId}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                navigate("/patient-progress-note-overview", {
                                  state: {
                                    orgId: n.meta.orgId,
                                    patientId: n.meta.patientId,
                                    sessionId: n.meta.sessionId,
                                    noteId: n.meta.noteId,
                                    // puedes pasar analisis si quieres precargarlo:
                                    analisis: n.data?.emotions || null,
                                    text: n.data?.ocr_text || "",
                                  },
                                })
                              }
                              className="rounded-lg h-9 px-3 bg-[#e7ebf3] dark:bg-gray-700 text-[#0d121b] dark:text-white text-sm font-medium"
                            >
                              Abrir
                            </button>
                            <button
                              onClick={() =>
                                navigate("/generate-progress-note", {
                                  state: { patientId: n.meta.patientId },
                                })
                              }
                              className="rounded-lg h-9 px-3 bg-gray-100 dark:bg-gray-600 text-sm"
                            >
                              Nueva captura
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
