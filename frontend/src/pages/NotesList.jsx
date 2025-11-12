import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, collectionGroup, getDocs, orderBy, query } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useDoctorProfile } from "../services/userDoctorProfile";

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

// 1. Lógica de color de avatar fuera del componente principal
const avatarColors = [
  "#7c3aed", // Violeta
  "#2563eb", // Azul
  "#059669", // Verde
  "#d97706", // Naranja
  "#db2777", // Rosa
];

const getAvatarStyle = (id) => {
  // Genera un color consistente basado en el ID
  let hash = 0;
  if (!id) return {};
  for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
  }
  const colorIndex = Math.abs(hash) % avatarColors.length;
  return { backgroundColor: avatarColors[colorIndex] };
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
  const [withEmotions, setWithEmotions] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all"); // all | text | photo | audio

  // Datos
  const [notes, setNotes] = useState([]);
  // Almacenamos el nombre y el ID del paciente, mapeado por patientId
  const [patientsMap, setPatientsMap] = useState({});

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
        // Almacenar el paciente completo para usar su ID para el color
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
      if (withEmotions) {
        const emo = n.data?.emotions ?? null;
        const hasE = !!emo && (Array.isArray(emo) ? emo.length > 0 : Object.keys(emo).length > 0);
        if (!hasE) return false;
      }
      if (typeFilter !== "all") {
        const t = (n.data?.type || "").toLowerCase();
        if (t !== typeFilter) return false;
      }
      return true;
    });
  }, [notes, search, onlyRecent7, withEmotions, typeFilter, patientsMap]);

  const initials = (name = "") =>
    name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "NT";

  const rightActions = (
    <div className="flex-row-center">
      <button onClick={() => navigate("/generate-progress-note")} className="btn ghost h-10">Nueva nota</button>
      <button onClick={() => navigate("/patient-list")} className="btn ghost h-10">Ver pacientes</button>
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

      {/* Banner de error rojo suave */}
      {/* MODIFICACIÓN: Aplicamos maxw-7xl al contenedor de banners y padding si es necesario */}
      <div className="px-4 sm:px-6 pt-5 maxw-7xl">
        {!orgId && (
          <div className="alert-warn mb-3">⚠️ Captura tu <b>Organización</b> en <b>Perfil</b> para ver tus notas.</div>
        )}
        {err && <div className="alert-error-banner mb-3">No se pudieron cargar las notas.</div>}
      </div>

      {/* PILLS de filtro */}
      <section className="px-4 sm:px-6 maxw-7xl">
        <div className="pillbar">
          <div className="pillbar-left">
            {/* MODIFICACIÓN: Cambiamos a clases definidas en CSS (pill-total/pill-filtered) */}
            <span className="pill pill-total">Total: {notes.length}</span>
            <span className="pill pill-filtered">Filtradas: {filtered.length}</span>

            <div
              className={`pill pill-toggle ${onlyRecent7 ? "pill-primary" : "pill-ghost"}`}
              onClick={() => setOnlyRecent7(v => !v)}
            >
              Últimos 7 días
              <span className="material-symbols-outlined">{onlyRecent7 ? "check" : "expand_more"}</span>
            </div>

            <div
              className={`pill pill-toggle ${withEmotions ? "pill-primary" : "pill-ghost"}`}
              onClick={() => setWithEmotions(v => !v)}
            >
              Con emociones
              <span className="material-symbols-outlined">{withEmotions ? "check" : "expand_more"}</span>
            </div>

            <div className="pill pill-input">
              <span className="label">Tipo</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="select no-border"
              >
                <option value="all">Todos</option>
                <option value="text">Texto</option>
                <option value="photo">Foto</option>
                <option value="audio">Audio</option>
              </select>
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>

          <div className="pillbar-right">
            <div className="pill pill-search">
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

      {/* Lista de notas */}
      {!loading && !err && (
        <section className="px-4 sm:px-6 pb-8 maxw-7xl">
          {filtered.length === 0 ? (
            <div className="mt-6 card p-8 text-center">
              <p className="text-[var(--alert-error-banner)]">
                {notes.length === 0 ? "No hay notas aún. Crea una nueva." : "No hay resultados con el filtro/búsqueda."}
              </p>
            </div>
          ) : (
            <div className="notes-grid mt-6">
              {filtered.map((n) => {
                // Usamos el objeto completo del paciente, si existe
                const patientData = patientsMap[n.meta.patientId];
                const pName = patientData?.fullName || n.meta.patientId;
                const pId = patientData?.id || n.meta.patientId; // Usamos el Patient ID para el color
                
                const ts = n.data?.processed_at || n.data?.created_at;
                const preview = (n.data?.ocr_text || "").slice(0, 160);
                const emo = n.data?.emotions?.resultado || n.data?.emotions;

                let emoChips = [];
                if (emo && typeof emo === "object" && !Array.isArray(emo)) {
                  emoChips = Object.entries(emo)
                    .map(([k, v]) => {
                      const raw = v?.porcentaje ?? v?.score ?? v?.valor ?? v?.pct ?? null;
                      const pct = raw == null ? null : Number(raw) <= 1 ? Math.round(Number(raw) * 100) : Math.round(Number(raw));
                      return { label: k, pct };
                    })
                    .filter((x) => x.label)
                    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
                    .slice(0, 2);
                }

                return (
                  <div key={n.meta.noteId} className="card note-card p-4">
                    <div className="flex items-center gap-4">
                     
                      <div 
                        className="avatar" 
                        title={pName} 
                        style={getAvatarStyle(pId)}
                      >
                        {initials(String(pName))}
                      </div>
                      <div className="min-w-0">
                        
                        <p className="text-sm font-semibold truncate">{pName}</p> {/* MODIFICACIÓN: Reducción de letra de metadata a 'text-xs' y nombre de clase */}
                        <p className="text-xs text-[var(--text-muted)]">{fmtDate(ts)} · {n.data?.type || "text"}</p>
                      </div>
                    </div>

                    {preview && (
                      
                      <p className="mt-3 text-sm text-[var(--text-muted)] line-clamp-3">
                        {preview}{preview.length >= 160 ? "…" : ""}
                      </p>
                    )}

                    {emoChips.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {emoChips.map((e) => (
                          <span key={`${n.meta.noteId}-${e.label}`} className="emochip">
                            {e.label} {e.pct != null ? `${e.pct}%` : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      
                      <span className="id-pill">
                        <span className="material-symbols-outlined">fingerprint</span>
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
                                analisis: n.data?.emotions || null,
                                text: n.data?.ocr_text || "",
                              },
                            })
                          }
                          className="pill pill-primary"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => navigate("/generate-progress-note", { state: { patientId: n.meta.patientId } })}
                          className="pill pill-ghost"
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
        </section>
      )}
    </AppLayout>
  );
}