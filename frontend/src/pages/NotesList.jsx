// src/pages/NotesList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, collectionGroup, getDocs, orderBy, query } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useDoctorProfile } from "../services/userDoctorProfile";

// --- Utils ---
function parseNotePath(path) {
  const parts = String(path || "").split("/");
  const after = (key) => {
    const i = parts.indexOf(key);
    return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
  };
  return {
    orgId: after("orgs"),
    doctorUid: after("doctors"),
    patientId: after("patients"),
    sessionId: after("sessions"),
    noteId: after("notes"),
  };
}

function fmtDate(ts) {
  try {
    const d =
      ts && typeof ts.toDate === "function" ? ts.toDate() :
      ts instanceof Date ? ts :
      null;
    return d ? d.toLocaleString() : "—";
  } catch {
    return "—";
  }
}

// Avatar color helpers
const avatarColors = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#db2777"];
const getAvatarStyle = (id) => {
  let hash = 0;
  if (!id) return {};
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const idx = Math.abs(hash) % avatarColors.length;
  return { backgroundColor: avatarColors[idx] };
};

export default function NotesList() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const uid = user?.uid || null;

  const { orgId: orgFromProfile } = useDoctorProfile(
    user?.uid, user?.displayName, user?.photoURL, user?.email
  );
  const [orgId, setOrgId] = useState("");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyMsg, setBusyMsg] = useState("");
  const [err, setErr] = useState("");

  // Filtros
  const [search, setSearch] = useState("");
  const [onlyRecent7, setOnlyRecent7] = useState(false);

  // Datos
  const [notes, setNotes] = useState([]);
  const [patientsMap, setPatientsMap] = useState({});

  // API base (orquestador)
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

  useEffect(() => {
    const cached = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cached);
  }, [orgFromProfile]);

  useEffect(() => {
    let alive = true;
    async function loadPatients() {
      if (!uid || !orgId) return;
      try {
        const colRef = collection(db, "orgs", orgId, "doctors", uid, "patients");
        const snap = await getDocs(colRef);
        if (!alive) return;
        const map = {};
        snap.forEach((d) => (map[d.id] = { fullName: d.data()?.fullName || d.id, id: d.id }));
        setPatientsMap(map);
      } catch {/* noop */}
    }
    loadPatients();
    return () => { alive = false; };
  }, [uid, orgId]);

  useEffect(() => {
    let alive = true;
    async function loadNotes() {
      try {
        setLoading(true);
        setErr("");
        setNotes([]);
        if (!uid || !orgId) { setLoading(false); return; }

        const cg = collectionGroup(db, "notes");
        const qy = query(cg, orderBy("processed_at", "desc"));
        const snap = await getDocs(qy);
        if (!alive) return;

        const rows = [];
        snap.forEach((d) => {
          const meta = parseNotePath(d.ref.path);
          if (meta.orgId === orgId && meta.doctorUid === uid) {
            rows.push({ id: d.id, path: d.ref.path, meta, data: d.data() });
          }
        });

        rows.sort((a, b) => {
          const ad = a.data?.processed_at || a.data?.created_at;
          const bd = b.data?.processed_at || b.data?.created_at;
          const av = ad?.toMillis ? ad.toMillis() : ad?.seconds ? ad.seconds * 1000 : 0;
          const bv = bd?.toMillis ? bd.toMillis() : bd?.seconds ? bd.seconds * 1000 : 0;
          return bv - av;
        });

        setNotes(rows);
      } catch (e) {
        console.error("Load notes error:", e);
        setErr("No se pudieron cargar las notas.");
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
    return () => { alive = false; };
  }, [uid, orgId]);

  const headerTitle = useMemo(
    () => (orgId ? `Notas de evolución — ${orgId}` : "Notas de evolución"),
    [orgId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const recent7Start = now - 7 * 24 * 60 * 60 * 1000;

    return notes.filter((n) => {
      if (q) {
        const pName = patientsMap[n.meta.patientId]?.fullName || n.meta.patientId || "";
        const haystack = [
          n.meta.noteId, n.meta.patientId, n.meta.sessionId,
          n.data?.type, pName, n.data?.ocr_text,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (onlyRecent7) {
        const ts = n.data?.processed_at || n.data?.created_at;
        const ms = ts?.toMillis ? ts.toMillis() : ts?.seconds ? ts.seconds * 1000 : null;
        if (ms && ms < recent7Start) return false;
      }
      return true;
    });
  }, [notes, search, onlyRecent7, patientsMap]);

  const initials = (name = "") =>
    name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "NT";

  // Abrir PDF con URL firmada
  async function openSignedPdf({ orgId, patientId, sessionId }) {
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch(`${API_BASE}/signed_pdf_url`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ org_id: orgId, patient_id: patientId, session_id: sessionId }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${txt}`);
      }
      const { url } = await resp.json();
      window.open(url, "_blank");
    } catch (e) {
      console.error("PDF error:", e);
      alert("No se pudo abrir el PDF (verifica que la sesión tenga nota final y permisos).");
    }
  }

  const rightActions = (
    <div className="flex-row-center">
      <button onClick={() => navigate("/generate-progress-note")} className="btn ghost h-10 hidden sm:inline-flex">Nueva nota</button>
      <button onClick={() => navigate("/patient-list")} className="btn ghost h-10 hidden sm:inline-flex">Ver pacientes</button>
      <button
        onClick={async () => { try { setBusyMsg("Cerrando sesión…"); await logout(); navigate("/login", { replace: true }); } finally { setBusyMsg(""); } }}
        className="btn ghost h-10"
      >
        Cerrar sesión
      </button>
    </div>
  );

  return (
    <AppLayout
      title={headerTitle}
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
      sidebar={<AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />}
    >
      <LoadingOverlay open={loading || !!busyMsg} message={busyMsg || "Cargando…"} />

      {/* Mensajes/errores */}
      <div className="px-3 sm:px-6 pt-4 maxw-7xl">
        {!orgId && (
          <div className="alert-warn mb-3 text-sm sm:text-base">
            ⚠️ Captura tu <b>Organización</b> en <b>Perfil</b> para ver tus notas.
          </div>
        )}
        {err && <div className="alert-error-banner mb-3 text-sm sm:text-base">No se pudieron cargar las notas.</div>}
      </div>

      {/* Filtros compactos: solo 7 días + búsqueda (móvil friendly) */}
      <section className="px-3 sm:px-6 maxw-7xl">
        <div className="pillbar" style={{ gap: 8, padding: "10px 12px" }}>
          <div className="pillbar-left" style={{ gap: "8px 12px" }}>
            <span className="pill pill-total text-xs sm:text-sm">Total: {notes.length}</span>
            <span className="pill pill-filtered text-xs sm:text-sm">Filtradas: {filtered.length}</span>

            <div
              className={`pill pill-toggle text-xs sm:text-sm ${onlyRecent7 ? "pill-primary" : "pill-ghost"}`}
              onClick={() => setOnlyRecent7(v => !v)}
              title="Mostrar solo últimos 7 días"
            >
              Últimos 7 días
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {onlyRecent7 ? "check" : "expand_more"}
              </span>
            </div>
          </div>

          <div className="pillbar-right" style={{ width: "100%", maxWidth: 480 }}>
            <div className="pill pill-search" style={{ minWidth: 0, width: "100%" }}>
              <span className="material-symbols-outlined">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por paciente, ID, tipo, contenido…"
                aria-label="Buscar notas"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Lista */}
      {!loading && !err && (
        <section className="px-3 sm:px-6 pb-8 maxw-7xl">
          {filtered.length === 0 ? (
            <div className="mt-4 card p-5 text-center">
              <p className="text-sm sm:text-base">
                {notes.length === 0 ? "No hay notas aún. Crea una nueva." : "No hay resultados con el filtro/búsqueda."}
              </p>
            </div>
          ) : (
            <div className="notes-grid mt-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))"
              }}
            >
              {filtered.map((n) => {
                const patientData = patientsMap[n.meta.patientId];
                const pName = patientData?.fullName || n.meta.patientId;
                const pId = patientData?.id || n.meta.patientId;

                const ts = n.data?.processed_at || n.data?.created_at;
                const preview = (n.data?.ocr_text || "").slice(0, 160);

                return (
                  <div key={n.meta.noteId} className="card note-card p-4">
                    {/* Header card */}
                    <div className="flex items-center gap-3">
                      <div
                        className="avatar"
                        title={pName}
                        style={{
                          ...getAvatarStyle(pId),
                          width: 40, height: 40,
                          borderRadius: 999,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, color: "#fff", flexShrink: 0
                        }}
                      >
                        {pName ? pName.split(" ").slice(0, 2).map(s => s[0]?.toUpperCase()).join("") : "NT"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm sm:text-base">{pName}</p>
                        <p className="text-[12px] opacity-80">{fmtDate(ts)} · {n.data?.type || "text"}</p>
                      </div>
                    </div>

                    {/* Body */}
                    {preview && (
                      <p className="mt-3 text-[13px] sm:text-sm opacity-80 line-clamp-3">
                        {preview}{preview.length >= 160 ? "…" : ""}
                      </p>
                    )}

                    {/* Footer actions */}
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="id-pill text-[12px] sm:text-sm">
                        <span className="material-symbols-outlined">fingerprint</span>
                        Nota: {n.meta.noteId}
                      </span>
                      <div className="flex gap-2">
                        {/* Abrir PDF firmado */}
                        <button
                          onClick={() =>
                            openSignedPdf({
                              orgId: n.meta.orgId,
                              patientId: n.meta.patientId,
                              sessionId: n.meta.sessionId,
                            })
                          }
                          className="pill pill-ghost text-xs sm:text-sm"
                          title="Abrir PDF firmado"
                        >
                          <span className="material-symbols-outlined">picture_as_pdf</span>
                          PDF
                        </button>

                        {/* Abrir detalle */}
                        <button
                          onClick={() =>
                            navigate("/patient-progress-note-overview", {
                              state: {
                                orgId: n.meta.orgId,
                                patientId: n.meta.patientId,
                                sessionId: n.meta.sessionId,
                                noteId: n.meta.noteId,
                                analisis: n.data?.emotions || null,
                                text: n.data?.ocr_text || "",
                              },
                            })
                          }
                          className="pill pill-primary text-xs sm:text-sm"
                        >
                          Abrir
                        </button>

                        {/* Nueva captura (misma paciente) */}
                        <button
                          onClick={() => navigate("/generate-progress-note", { state: { patientId: n.meta.patientId } })}
                          className="pill pill-ghost text-xs sm:text-sm"
                        >
                          Nueva
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </AppLayout>
  );
}
