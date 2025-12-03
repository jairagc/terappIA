// src/pages/PatientList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import LoadingOverlay from "../components/LoadingOverlay";
import { useDoctorProfile } from "../services/userDoctorProfile";

// ——— helpers de color consistente
const getAltColorVar = (id) => {
  let hash = 0;
  if (!id) return "--alt1";
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash &= hash;
  }
  const idx = Math.abs(hash) % 3;
  return idx === 0 ? "--alt1" : idx === 1 ? "--alt2" : "--alt3";
};

// ——— estilos embebidos (responsive + centrado)
const pageCSS = `
  .page-pad {
    padding: 16px;
    display: flex;
    justify-content: center;
  }

  .page-inner {
    width: 100%;
    max-width: 1120px;
    margin-left:0px;
    margin-right:10px ;
  }

  .page-inner .card {
    margin-left: 0;
    margin-right: 0;
  }

  .pillbar {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    flex-wrap:wrap;
  }
  .pillbar-left,
  .pillbar-right {
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
  }

  .pill {
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:8px 12px;
    border-radius:999px;
    border:1px solid var(--line-soft,#e6ebf3);
    background:#fff;
    font-weight:600;
  }
  .pill-total { background:#f6f8fe; }
  .pill-filtered { background:#f2fbf6; }
  .pill-primary { background:var(--light-blue,#eaf2ff); border-color:transparent; }
  .pill-ghost { background:#fff; }
  .pill-input { background:#f9fafc; }

  .pill-search input {
    border:0;
    outline:none;
    background:transparent;
    min-width:180px;
  }
  .select {
    border:0;
    outline:none;
    background:transparent;
  }

  .patients-grid {
    display:grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap:16px;
    width: 100%;
  }

  .card {
    background:#fff;
    border:1px solid var(--line-soft,#e6ebf3);
    border-radius:16px;
    box-shadow:0 2px 10px rgba(0,0,0,.04);
  }
  .card.p-4 { padding:18px; }
  .card-empty {
    padding:24px 20px;
  }

  .item-title {
    font-weight:800;
    color:var(--primary-dark,#0a2a63);
    font-size:16px;
  }
  .item-meta {
    color:var(--text-muted,#6b7280);
    font-size:13px;
  }
  .item-avatar {
    width:48px;
    height:48px;
    border-radius:999px;
    display:flex;
    align-items:center;
    justify-content:center;
    font-weight:900;
  }
  .id-pill {
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:6px 10px;
    border-radius:999px;
    border:1px solid var(--line-soft,#e6ebf3);
    background:#f8fafc;
    font-size:12px;
  }

  .empty-text {
    margin-bottom: 16px;
    color: var(--text-muted,#6b7280);
  }

  .empty-actions {
    display:flex;
    justify-content:center;
  }

  .empty-actions .btn {
    min-width: 200px;
  }

  /* Ocultar en móvil */
  .mobile-hide { display:inline-flex; }

  /* Tablet */
  @media (max-width: 1024px) {
    .patients-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }

  /* Móvil */
  @media (max-width: 640px) {
    .page-pad { padding: 12px; }

    .page-inner {
      padding: 0 4px; /* un pelín de aire lateral en cel */
    }

    .pillbar { gap:8px; }
    .pill { padding:6px 10px; font-size:12px; }
    .pill-search input { min-width:110px; font-size:12px; }

    .patients-grid {
      grid-template-columns: 1fr;
      gap:12px;
    }

    .item-avatar {
      width:40px;
      height:40px;
      font-size:14px;
    }
    .item-title { font-size:14px; }
    .item-meta { font-size:12px; }
    .id-pill {
      font-size:11px;
      padding:5px 8px;
    }

    /* 👇 Oculta "Fecha" y "Aplicar filtros" solo en móvil */
    .mobile-hide { display:none !important; }
  }
`;

export default function PatientList() {
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
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyMsg, setBusyMsg] = useState("");

  // filtros
  const [search, setSearch] = useState("");
  const [onlyRecent7, setOnlyRecent7] = useState(false);
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [dateFrom, setDateFrom] = useState("");

  useEffect(() => {
    const cachedOrg = localStorage.getItem("orgId") || "";
    setOrgId(orgFromProfile || cachedOrg);
  }, [orgFromProfile]);

  useEffect(() => {
    let alive = true;
    async function loadPatients() {
      try {
        setLoading(true);
        setErr("");
        setPatients([]);
        if (!uid || !orgId) { setLoading(false); return; }
        const colRef = collection(db, "orgs", orgId, "doctors", uid, "patients");
        const qy = query(colRef, orderBy("fullName"));
        const snap = await getDocs(qy);
        if (!alive) return;
        setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error cargando pacientes:", e);
        if (alive) setErr("No se pudieron cargar los pacientes.");
      } finally { alive && setLoading(false); }
    }
    loadPatients();
    return () => { alive = false; };
  }, [uid, orgId]);

  const handleLogout = async () => {
    try {
      setBusyMsg("Cerrando sesión…");
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      setBusyMsg("");
    }
  };

  const initials = (name = "") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "P";

  const toMillis = (v) => {
    if (!v) return null;
    try {
      if (typeof v?.toMillis === "function") return v.toMillis();
      if (typeof v === "number") return v;
      if (typeof v === "string") return Date.parse(v);
      if (v?.seconds) return v.seconds * 1000;
      return null;
    } catch {
      return null;
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = dateFrom ? Date.parse(dateFrom + "T00:00:00") : null;
    const now = Date.now();
    const recent7Start = now - 7 * 24 * 60 * 60 * 1000;

    return patients.filter((p) => {
      if (q) {
        const haystack = [p.fullName, p.email, p.phone, p.address, p.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (onlyImportant && p.important !== true) return false;

      const createdMs = toMillis(p.createdAt);
      if (onlyRecent7 && createdMs && createdMs < recent7Start) return false;
      if (fromMs && createdMs && createdMs < fromMs) return false;

      return true;
    });
  }, [patients, search, onlyRecent7, onlyImportant, dateFrom]);

  // Header: solo cerrar sesión con icono
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

  return (
    <AppLayout rightActions={rightActions}>
      <style>{pageCSS}</style>

      <LoadingOverlay
        open={loading || !!busyMsg}
        message={busyMsg || "Cargando…"}
      />

      {/* Filtros */}
      <section className="page-pad">
        <div className="page-inner">
          <div className="pillbar">
            <div className="pillbar-left">
              <span className="pill pill-total">Total: {patients.length}</span>
              <span className="pill pill-filtered">
                Filtrados: {filtered.length}
              </span>

              <button
                type="button"
                onClick={() => setOnlyRecent7((v) => !v)}
                className={onlyRecent7 ? "pill pill-primary" : "pill pill-ghost"}
                title="Últimos 7 días"
              >
                Últimos 7 días
                <span className="material-symbols-outlined ml-1">
                  {onlyRecent7 ? "check" : "expand_more"}
                </span>
              </button>

              {/* Fecha — oculto en móvil con .mobile-hide */}
              <div className="pill pill-input mobile-hide">
                <span className="label">Fecha:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Fecha"
                />
              </div>

              {/* Limpiar filtros — oculto en móvil */}
              <button
                type="button"
                className="pill pill-ghost mobile-hide"
                onClick={() => {
                  setOnlyRecent7(false);
                  setOnlyImportant(false);
                  setDateFrom("");
                }}
                title="Limpiar filtros"
              >
                Aplicar filtros
              </button>
            </div>

            <div className="pillbar-right">
              <div className="pill pill-search">
                <span className="material-symbols-outlined">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, email, teléfono…"
                  aria-label="Buscar"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lista / vacío */}
      {!loading && !err && (
        <section className="page-pad">
          <div className="page-inner">
            {filtered.length === 0 ? (
              <div className="mt-4 card card-empty text-center">
                <p className="empty-text">
                  {patients.length === 0
                    ? "No hay pacientes registrados. Puedes agregar uno con el botón de abajo."
                    : "No hay resultados con el filtro/búsqueda actual."}
                </p>

                {/* Botón para agregar paciente debajo del mensaje */}
                {patients.length === 0 && (
                  <div className="empty-actions">
                    <button
                      type="button"
                      className="btn primary h-11"
                      onClick={() => navigate("/register-new-patient")}
                    >
                      Agregar paciente
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="patients-grid mt-4">
                {filtered.map((p) => (
                  <div key={p.id} className="card p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="item-avatar"
                        title={p.fullName}
                        style={{
                          "--avatar-color-var": `var(${getAltColorVar(p.id)})`,
                          background: `color-mix(in oklab, var(--avatar-color-var) 70%, black 30%)`,
                          color: "#fff",
                          border: "none",
                        }}
                      >
                        {initials(p.fullName)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="item-title truncate">
                          {p.fullName || p.id}
                        </p>
                        <p className="item-meta truncate">
                          {p.email || p.phone || p.address
                            ? [p.email, p.phone, p.address]
                                .filter(Boolean)
                                .join(" · ")
                            : "Sin datos de contacto"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                      <span
                        className="id-pill"
                        style={{
                          "--pill-color-var": `var(${getAltColorVar(p.id)})`,
                          background: `color-mix(in oklab, var(--pill-color-var) 30%, white 82%)`,
                          color: `color-mix(in oklab, var(--pill-color-var) 55%, black 45%)`,
                          borderColor: `color-mix(in oklab, var(--pill-color-var) 36%, white 64%)`,
                        }}
                      >
                        <span className="material-symbols-outlined text-sm">
                          fingerprint
                        </span>
                        <span className="label">ID: {p.id}</span>
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setBusyMsg("Abriendo…");
                            navigate("/generate-progress-note", {
                              state: { patientId: p.id },
                            });
                          }}
                          className="pill pill-ghost"
                        >
                          Ver/crear nota
                        </button>
                        <button
                          onClick={() => {
                            setBusyMsg("Abriendo…");
                            navigate("/patient-progress-note-overview", {
                              state: {
                                orgId,
                                patientId: p.id,
                                sessionId: null,
                                noteId: null,
                                source: "manual",
                              },
                            });
                          }}
                          className="pill pill-ghost"
                        >
                          Abrir detalle
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </AppLayout>
  );
}
