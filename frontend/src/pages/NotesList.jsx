// src/pages/NotesList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import {
  collection,
  collectionGroup,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useDoctorProfile } from "../services/userDoctorProfile";

// ——— estilos embebidos
const pageCSS = `
  .page-pad { padding: 12px; }
  .maxw-7xl { max-width: 1120px; margin: 0 auto; }

  .pillbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .pillbar-left,.pillbar-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .pill { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; border:1px solid var(--line-soft,#e6ebf3); background:#fff; font-weight:600; }
  .pill-total { background:#f6f8fe; }
  .pill-filtered { background:#f2fbf6; }
  .pill-primary { background:var(--light-blue,#eaf2ff); border-color:transparent; }
  .pill-ghost { background:#fff; }
  .pill-search { width:100%; max-width:480px; }
  .pill-search input { border:0; outline:none; background:transparent; min-width:0; width:100%; }
  .pill-toggle { cursor:pointer; }

  .notes-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:14px; }
  .card { background:#fff; border:1px solid var(--line-soft,#e6ebf3); border-radius:16px; box-shadow:0 2px 10px rgba(0,0,0,.04); }
  .note-card .avatar { width:44px; height:44px; border-radius:999px; display:flex; align-items:center; justify-content:center; font-weight:900; color:#fff; }
  .id-pill { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid var(--line-soft,#e6ebf3); background:#f8fafc; font-size:12px; }

  /* Tablet */
  @media (max-width: 1024px) {
    .notes-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }

  /* Móvil */
  @media (max-width: 640px) {
    .page-pad { padding: 10px; }
    .pill { padding:6px 10px; font-size:12px; }
    .pillbar { gap:8px; }
    .notes-grid { grid-template-columns: 1fr; gap:10px; }
    .note-card .avatar { width:38px; height:38px; font-size:13px; }
    .note-card .title { font-size:14px; }
    .note-card .meta { font-size:12px; opacity:.8; }
    .note-card .preview { font-size:13px; }
    .id-pill { font-size:11px; padding:5px 8px; }
    .btn-xs { font-size:12px; padding:6px 10px; }
  }
`;

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
    noteId: after("notes"), // en sessions usaremos sessionId como "noteId"
  };
}

function fmtDate(ts) {
  try {
    const d =
      ts && typeof ts.toDate === "function"
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : null;
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
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
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
  const [notes, setNotes] = useState([]); // cada "note" = una sesión con PDF
  const [patientsMap, setPatientsMap] = useState({});

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

  // orgId desde perfil / localStorage
  useEffect(() => {
    const cached = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cached);
  }, [orgFromProfile]);

  // mapa de pacientes (id -> { fullName, id })
  useEffect(() => {
    let alive = true;
    async function loadPatients() {
      if (!uid || !orgId) return;
      try {
        const colRef = collection(db, "orgs", orgId, "doctors", uid, "patients");
        const snap = await getDocs(colRef);
        if (!alive) return;
        const map = {};
        snap.forEach((d) => {
          map[d.id] = {
            fullName: d.data()?.fullName || d.id,
            id: d.id,
          };
        });
        setPatientsMap(map);
      } catch {
        // noop
      }
    }
    loadPatients();
    return () => {
      alive = false;
    };
  }, [uid, orgId]);

  // cargar sesiones con PDF (evolution_note_md_uri)
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

        // Traemos todas las sessions y filtramos por org/doctor en frontend
        const cg = collectionGroup(db, "sessions");
        const snap = await getDocs(cg);
        if (!alive) return;

        const rows = [];
        snap.forEach((d) => {
          const data = d.data();
          const meta = parseNotePath(d.ref.path);

          // Solo sesiones del doctor actual en esta org
          if (meta.orgId !== orgId || meta.doctorUid !== uid) return;

          // Solo sesiones que ya tienen PDF firmado
          if (!data?.evolution_note_md_uri) return;

          rows.push({
            id: d.id,
            path: d.ref.path,
            meta: {
              ...meta,
              noteId: d.id, // usamos sessionId como id visible
            },
            data,
          });
        });

        // Ordenamos por fecha de firma / procesado
        rows.sort((a, b) => {
          const ad =
            a.data?.signed_at_ts ||
            a.data?.processed_at ||
            a.data?.created_at;
          const bd =
            b.data?.signed_at_ts ||
            b.data?.processed_at ||
            b.data?.created_at;
          const av = ad?.toMillis
            ? ad.toMillis()
            : ad?.seconds
            ? ad.seconds * 1000
            : 0;
          const bv = bd?.toMillis
            ? bd.toMillis()
            : bd?.seconds
            ? bd.seconds * 1000
            : 0;
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
    return () => {
      alive = false;
    };
  }, [uid, orgId]);

  const headerTitle = useMemo(
    () => (orgId ? `Notas de evolución — ${orgId}` : "Notas de evolución"),
    [orgId]
  );

  // aplicar filtros (search, últimos 7 días)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const recent7Start = now - 7 * 24 * 60 * 60 * 1000;

    return notes.filter((n) => {
      const patientData = patientsMap[n.meta.patientId];
      const pName = patientData?.fullName || n.meta.patientId || "";

      if (q) {
        const haystack = [
          n.meta.noteId,
          n.meta.patientId,
          n.meta.sessionId,
          pName,
          n.data?.evolution_note_txt, // texto SOAP+IA
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      if (onlyRecent7) {
        const ts =
          n.data?.signed_at_ts ||
          n.data?.processed_at ||
          n.data?.created_at;
        const ms = ts?.toMillis
          ? ts.toMillis()
          : ts?.seconds
          ? ts.seconds * 1000
          : null;
        if (ms && ms < recent7Start) return false;
      }

      return true;
    });
  }, [notes, search, onlyRecent7, patientsMap]);

  // agrupar por paciente
  const groupedByPatient = useMemo(() => {
    const groups = {};
    filtered.forEach((n) => {
      const pid = n.meta.patientId;
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(n);
    });

    // ordenar cada grupo por fecha desc (por si acaso)
    Object.values(groups).forEach((arr) => {
      arr.sort((a, b) => {
        const ad =
          a.data?.signed_at_ts ||
          a.data?.processed_at ||
          a.data?.created_at;
        const bd =
          b.data?.signed_at_ts ||
          b.data?.processed_at ||
          b.data?.created_at;
        const av = ad?.toMillis
          ? ad.toMillis()
          : ad?.seconds
          ? ad.seconds * 1000
          : 0;
        const bv = bd?.toMillis
          ? bd.toMillis()
          : bd?.seconds
          ? bd.seconds * 1000
          : 0;
        return bv - av;
      });
    });

    return groups;
  }, [filtered]);

  // Abrir PDF con URL firmada
  async function openSignedPdf({ orgId, patientId, sessionId }) {
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch(`${API_BASE}/signed_pdf_url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: orgId,
          patient_id: patientId,
          session_id: sessionId,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${txt}`);
      }
      const { url } = await resp.json();
      window.open(url, "_blank");
    } catch (e) {
      console.error("PDF error:", e);
      alert(
        "No se pudo abrir el PDF (verifica que la sesión tenga nota final y permisos)."
      );
    }
  }

  const rightActions = (
    <div className="flex-row-center">
      <button
        onClick={() => navigate("/generate-progress-note")}
        className="btn ghost h-10 hidden sm:inline-flex"
      >
        Nueva nota
      </button>
      <button
        onClick={() => navigate("/patient-list")}
        className="btn ghost h-10 hidden sm:inline-flex"
      >
        Ver pacientes
      </button>
      <button
        onClick={async () => {
          try {
            setBusyMsg("Cerrando sesión…");
            await logout();
            navigate("/login", { replace: true });
          } finally {
            setBusyMsg("");
          }
        }}
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
      sidebar={
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
      }
    >
      <style>{pageCSS}</style>

      <LoadingOverlay
        open={loading || !!busyMsg}
        message={busyMsg || "Cargando…"}
      />

      {/* Mensajes/errores */}
      <div className="page-pad maxw-7xl">
        {!orgId && (
          <div className="alert-warn mb-3 text-sm sm:text-base">
            ⚠️ Captura tu <b>Organización</b> en <b>Perfil</b> para ver tus
            notas.
          </div>
        )}
        {err && (
          <div className="alert-error-banner mb-3 text-sm sm:text-base">
            No se pudieron cargar las notas.
          </div>
        )}
      </div>

      {/* Filtros */}
      <section className="page-pad maxw-7xl">
        <div className="pillbar">
          <div className="pillbar-left">
            <span className="pill pill-total text-xs sm:text-sm">
              Total sesiones con PDF: {notes.length}
            </span>
            <span className="pill pill-filtered text-xs sm:text-sm">
              Mostradas: {filtered.length}
            </span>

            <div
              className={`pill pill-toggle text-xs sm:text-sm ${
                onlyRecent7 ? "pill-primary" : "pill-ghost"
              }`}
              onClick={() => setOnlyRecent7((v) => !v)}
              title="Mostrar solo últimos 7 días"
            >
              Últimos 7 días
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18 }}
              >
                {onlyRecent7 ? "check" : "expand_more"}
              </span>
            </div>
          </div>

          <div
            className="pillbar-right"
            style={{ width: "100%", maxWidth: 480 }}
          >
            <div className="pill pill-search">
              <span className="material-symbols-outlined">search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por paciente, sesión, contenido…"
                aria-label="Buscar notas"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Lista agrupada por paciente */}
      {!loading && !err && (
        <section className="page-pad maxw-7xl">
          {filtered.length === 0 ? (
            <div className="mt-4 card p-5 text-center">
              <p className="text-sm sm:text-base">
                {notes.length === 0
                  ? "No hay notas firmadas aún. Genera una desde una sesión."
                  : "No hay resultados con el filtro/búsqueda."}
              </p>
            </div>
          ) : (
            Object.entries(groupedByPatient).map(([patientId, patientNotes]) => {
              const patientData = patientsMap[patientId];
              const pName = patientData?.fullName || patientId;
              const pId = patientData?.id || patientId;

              return (
                <div key={patientId} className="mb-8">
                  {/* Encabezado del paciente */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="avatar"
                      style={{
                        ...getAvatarStyle(pId),
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {pName
                        ? pName
                            .split(" ")
                            .slice(0, 2)
                            .map((s) => s[0]?.toUpperCase())
                            .join("")
                        : "PT"}
                    </div>
                    <div>
                      <h2 className="font-semibold text-base sm:text-lg">
                        {pName}
                      </h2>
                      <p className="text-xs text-gray-500">
                        ID paciente: {pId} · Sesiones: {patientNotes.length}
                      </p>
                    </div>
                  </div>

                  {/* Cards de sesiones de este paciente */}
                  <div className="notes-grid">
                    {patientNotes.map((n) => {
                      const ts =
                        n.data?.signed_at_ts ||
                        n.data?.processed_at ||
                        n.data?.created_at;
                      const preview = (
                        n.data?.evolution_note_txt || ""
                      ).slice(0, 160);

                      return (
                        <div key={n.meta.sessionId} className="card note-card p-4">
                          <div className="min-w-0">
                            <p className="title truncate font-semibold text-sm sm:text-base">
                              Sesión {n.meta.sessionId}
                            </p>
                            <p className="meta text-xs text-gray-500">
                              {fmtDate(ts)}
                            </p>
                          </div>

                          {preview && (
                            <p className="preview mt-3 line-clamp-3 text-sm">
                              {preview}
                              {preview.length >= 160 ? "…" : ""}
                            </p>
                          )}

                          <div className="mt-4 flex items-center justify-between gap-2">
                            <span className="id-pill">
                              <span className="material-symbols-outlined">
                                fingerprint
                              </span>
                              Sesión: {n.meta.sessionId}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  openSignedPdf({
                                    orgId: n.meta.orgId,
                                    patientId: n.meta.patientId,
                                    sessionId: n.meta.sessionId,
                                  })
                                }
                                className="pill pill-ghost btn-xs"
                                title="Abrir PDF firmado"
                              >
                                <span className="material-symbols-outlined">
                                  picture_as_pdf
                                </span>
                                PDF
                              </button>

                              <button
                                onClick={() =>
                                  navigate("/patient-progress-note-overview", {
                                    state: {
                                      orgId: n.meta.orgId,
                                      patientId: n.meta.patientId,
                                      sessionId: n.meta.sessionId,
                                      // Si quieres mostrar emociones, aquí aún no las tenemos.
                                      // Podrías hacer un fetch extra a Firestore dentro de esa vista.
                                      noteId: n.meta.sessionId,
                                      analisis: null,
                                      text: n.data?.evolution_note_txt || "",
                                    },
                                  })
                                }
                                className="pill pill-primary btn-xs"
                              >
                                Ver detalle
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}
    </AppLayout>
  );
}
