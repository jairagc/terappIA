import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import LoadingOverlay from "../components/LoadingOverlay";
import { useDoctorProfile } from "../services/userDoctorProfile";

// --- LÓGICA DE COLOR TEMÁTICO CONSISTENTE ---
// Esta función mapea un ID (string) a una de las 3 variables CSS de acento (alt1, alt2, alt3)
const getAltColorVar = (id) => {
    let hash = 0;
    if (id.length === 0) return '--alt1'; // Fallback
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const colorIndex = Math.abs(hash) % 3; // 0, 1, o 2
    return colorIndex === 0 ? '--alt1' : colorIndex === 1 ? '--alt2' : '--alt3';
};
// ------------------------------------------

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

  // Overlay para acciones
  const [busyMsg, setBusyMsg] = useState("");

  // Filtros (coinciden con la UI de tu mock)
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
        if (!uid || !orgId) {
          setLoading(false);
          return;
        }
        const colRef = collection(db, "orgs", orgId, "doctors", uid, "patients");
        const qy = query(colRef, orderBy("fullName"));
        const snap = await getDocs(qy);
        if (!alive) return;
        setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error cargando pacientes:", e);
        if (alive) setErr("No se pudieron cargar los pacientes.");
      } finally {
        alive && setLoading(false);
      }
    }
    loadPatients();
    return () => { alive = false; };
  }, [uid, orgId]);

  const handleLogout = async () => {
    try { setBusyMsg("Cerrando sesión…"); await logout(); navigate("/login", { replace: true }); }
    catch (e) { console.error("Logout failed:", e); }
    finally { setBusyMsg(""); }
  };

  const initials = (name = "") =>
    name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "P";

  const headerTitle = useMemo(() => (orgId ? `Pacientes — ${orgId}` : "Pacientes"), [orgId]);

  const toMillis = (v) => {
    if (!v) return null;
    try {
      if (typeof v?.toMillis === "function") return v.toMillis();
      if (typeof v === "number") return v;
      if (typeof v === "string") return Date.parse(v);
      if (v?.seconds) return v.seconds * 1000;
      return null;
    } catch { return null; }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = dateFrom ? Date.parse(dateFrom + "T00:00:00") : null;
    const now = Date.now();
    const recent7Start = now - 7 * 24 * 60 * 60 * 1000;

    return patients.filter((p) => {
      if (q) {
        const haystack = [p.fullName, p.email, p.phone, p.address, p.id]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (onlyImportant && p.important !== true) return false;

      const createdMs = toMillis(p.createdAt);
      if (onlyRecent7 && createdMs && createdMs < recent7Start) return false;
      if (fromMs && createdMs && createdMs < fromMs) return false;

      return true;
    });
  }, [patients, search, onlyRecent7, onlyImportant, dateFrom]);

  // Header (derecha)
  const rightActions = (
    <div className="flex-row-center">
      <button onClick={() => { setBusyMsg("Abriendo…"); navigate("/generate-progress-note"); }} className="btn ghost h-10">Nueva nota</button>
      <button onClick={() => { setBusyMsg("Abriendo…"); navigate("/register-new-patient"); }} className="btn ghost h-10">Agregar paciente</button>
      <button onClick={handleLogout} className="btn ghost h-10">Cerrar sesión</button>
    </div>
  );

  return (
    <AppLayout rightActions={rightActions} title={headerTitle}>
      <LoadingOverlay open={loading || !!busyMsg} message={busyMsg || "Cargando…"} />

      {/* MODIFICACIÓN: Agregamos 'maxw-7xl' para limitar el ancho y centrar */}
      <section className="px-4 sm:px-6 pt-5 maxw-7xl">
        {/* FILTROS EN PASTILLAS (como el mock) */}
        <div className="pillbar">
          {/* Chips contadores */}
          <div className="pillbar-left">
            {/* MODIFICACIÓN: Cambiamos a pill-total/pill-filtered que sí están en CSS */}
            <span className="pill pill-total">Total: {patients.length}</span>
            <span className="pill pill-filtered">Filtrados: {filtered.length}</span>

            <button
              type="button"
              onClick={() => setOnlyRecent7(v => !v)}
              className={onlyRecent7 ? "pill pill-primary" : "pill pill-ghost"}
            >
              Últimos 7 días
              <span className="material-symbols-outlined ml-1">{onlyRecent7 ? "check" : "expand_more"}</span>
            </button>

            <div className="pill pill-input">
              <span className="label">Fecha:</span>
              
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Fecha"
              />
            </div>

            <button
              type="button"
              className="pill pill-ghost"
              onClick={() => { setOnlyRecent7(false); setOnlyImportant(false); setDateFrom(""); }}
            >
              Aplicar filtros
            </button>
          </div>

          {/* Buscador a la derecha */}
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
      </section>

      {/* Lista */}
      {!loading && !err && (
        
        <section className="px-4 sm:px-6 pb-8 maxw-7xl">
          {filtered.length === 0 ? (
            <div className="mt-6 card p-8 text-center">
              <p className="text-[var(--text-muted)]">
                {patients.length === 0
                  ? "No hay pacientes. Agrega uno con el botón “Agregar paciente”."
                  : "No hay resultados con el filtro/búsqueda."}
              </p>
            </div>
          ) : (

            <div className="patients-grid mt-6">
              {filtered.map((p) => (
                <div key={p.id} className="card p-4">
                  <div className="flex items-center gap-4">
                    {/* AVATAR: Fondo Oscuro para texto blanco (Contraste) */}
                    <div 
                      className="item-avatar" 
                      title={p.fullName} 
                      style={{ 
                          // 1. Asignamos la variable CSS dinámica
                          '--avatar-color-var': `var(${getAltColorVar(p.id)})`,
                          
                          // 2. Fondo oscuro (color dinámico + negro) y texto blanco
                          'background': `color-mix(in oklab, var(--avatar-color-var) 70%, black 30%)`,
                          'color': '#fff', 
                          'border': 'none',
                      }}
                    >
                      {initials(p.fullName)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* MODIFICACIÓN: Usamos 'item-title' y 'item-meta' para consistencia con el CSS */}
                      <p className="item-title truncate">{p.fullName || p.id}</p>
                      <p className="item-meta truncate">
                        {p.email || p.phone || p.address
                          ? [p.email, p.phone, p.address].filter(Boolean).join(" · ")
                          : "Sin datos de contacto"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                    {/* ID PILL: Fondo Claro y Texto Oscuro (Contraste) */}
                    <span 
                        className="id-pill"
                        style={{
                            // 1. Asignamos la variable CSS dinámica
                            '--pill-color-var': `var(${getAltColorVar(p.id)})`,
                            
                            // 2. Fondo claro (color dinámico + blanco)
                            'background': `color-mix(in oklab, var(--pill-color-var) 30%, white 82%)`,
                            // 3. Color de texto oscuro
                            'color': `color-mix(in oklab, var(--pill-color-var) 55%, black 45%)`,
                            // 4. Borde basado en el color dinámico
                            'borderColor': `color-mix(in oklab, var(--pill-color-var) 36%, white 64%)`
                        }}
                    >
                      <span className="material-symbols-outlined text-sm">fingerprint</span>
                      <span className="label">ID: {p.id}</span>
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setBusyMsg("Abriendo…"); navigate("/generate-progress-note", { state: { patientId: p.id } }); }}
                        className="pill pill-ghost"
                      >
                        Ver/crear nota
                      </button>
                      <button
                        onClick={() => {
                          setBusyMsg("Abriendo…");
                          navigate("/patient-progress-note-overview", {
                            state: { orgId, patientId: p.id, sessionId: null, noteId: null, source: "manual" },
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
        </section>
      )}
    </AppLayout>
  );
}