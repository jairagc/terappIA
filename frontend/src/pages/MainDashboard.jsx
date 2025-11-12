import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";
import { useDoctorProfile } from "../services/userDoctorProfile";

export default function MainDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(true);
  const [orgId, setOrgId] = useState(() => localStorage.getItem("orgId") || "");
  const { name, photoURL } = useDoctorProfile(user?.uid, user?.displayName, user?.photoURL);

  const [patientsCount, setPatientsCount] = useState(null);
  const [notesCount, setNotesCount] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [busyMsg, setBusyMsg] = useState("");

  useEffect(() => setOrgId(localStorage.getItem("orgId") || ""), []);

  useEffect(() => {
    let alive = true;
    async function loadStats() {
      if (!user?.uid || !orgId) { setPatientsCount(0); setNotesCount(0); setLoadingStats(false); return; }
      setLoadingStats(true);
      try {
        const patientsCol = collection(db, "orgs", orgId, "doctors", user.uid, "patients");
        const patientsSnap = await getDocs(patientsCol);
        if (!alive) return;
        setPatientsCount(patientsSnap.size);

        let totalNotes = 0;
        for (const pDoc of patientsSnap.docs) {
          const sessionsCol = collection(db, "orgs", orgId, "doctors", user.uid, "patients", pDoc.id, "sessions");
          const sessionsSnap = await getDocs(sessionsCol);
          for (const sDoc of sessionsSnap.docs) {
            const notesCol = collection(db, "orgs", orgId, "doctors", user.uid, "patients", pDoc.id, "sessions", sDoc.id, "notes");
            const notesSnap = await getDocs(notesCol);
            totalNotes += notesSnap.size;
          }
        }
        if (!alive) return;
        setNotesCount(totalNotes);
      } catch (e) {
        console.error("Error leyendo métricas:", e);
        if (!alive) return;
        setPatientsCount(0); setNotesCount(0);
      } finally { if (alive) setLoadingStats(false); }
    }
    loadStats();
    return () => { alive = false; };
  }, [user?.uid, orgId]);

  const statPatients = useMemo(() => patientsCount ?? 0, [patientsCount]);
  const statNotes    = useMemo(() => notesCount ?? 0, [notesCount]);

  const handleLogout = async () => {
    try { setBusyMsg("Cerrando sesión…"); await logout(); navigate("/login", { replace: true }); }
    catch (e) { console.error("Logout failed:", e); }
    finally { setBusyMsg(""); }
  };
  const go = (path) => { setBusyMsg("Abriendo…"); navigate(path); };

  const rightActions = (
    <div className="header-actions">
      <button onClick={() => go("/generate-progress-note")} className="btn ghost h-10">Nueva nota</button>
      <button onClick={() => go("/patient-list")} className="btn ghost h-10">Pacientes</button>
      <button onClick={() => go("/notes")} className="btn ghost h-10">Notas</button>
      <button onClick={handleLogout} className="btn ghost h-10">Cerrar sesión</button>
    </div>
  );

  return (
    <AppLayout
      title="TerappIA"
      rightActions={rightActions}
      leftActions={
        <button onClick={() => setCollapsed((c) => !c)} className="btn icon" title={collapsed ? "Expandir" : "Contraer"}>
          <span className="material-symbols-outlined">menu</span>
        </button>
      }
      sidebar={<AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />}
    >
      <LoadingOverlay open={loadingStats || !!busyMsg} message={busyMsg || "Cargando…"} />

      {/* ===== Perfil + métricas ===== */}
      <section className="container-pad maxw-7xl" style={{paddingTop:24}}>
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <img src={photoURL} alt="Foto" style={{width:56, height:56, borderRadius:9999, objectFit:"cover"}} />
            <div className="min-w-0">
              <h2 className="truncate" style={{margin:0, fontSize:22}}>Morales Anaya Jennifer Alejandra</h2>
              <p className="caption text-muted" style={{margin:0}}>Org: {orgId || "Sin organización"}</p>
            </div>
          </div>

          {/* 4 stats */}
          <div className="stats-grid" style={{marginTop:16}}>
            <div className="stat">
              <div style={{fontSize:28, fontWeight:900, lineHeight:1}}>{loadingStats ? "—" : statPatients}</div>
              <div className="caption text-muted">Pacientes</div>
            </div>
            <div className="stat">
              <div style={{fontSize:28, fontWeight:900, lineHeight:1}}>{loadingStats ? "—" : statNotes}</div>
              <div className="caption text-muted">Notas</div>
            </div>
            <div className="stat">
              <div style={{fontSize:28, fontWeight:900, lineHeight:1}}>{loadingStats ? "—" : Math.max(statNotes - 0, 0)}</div>
              <div className="caption text-muted">Sesiones (aprox.)</div>
            </div>
            <div className="stat">
              <div style={{fontSize:28, fontWeight:900, lineHeight:1}}>—</div>
              <div className="caption text-muted">Archivos sesión</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Acciones (4 en horizontal) ===== */}
      <section className="container-pad maxw-7xl" style={{paddingTop:12}}>
        <div className="action-grid--fixed4">
          <ActionCard
            icon="add_notes"
            title="Nueva nota"
            desc="Inicia una nota de evolución por OCR o audio."
            onClick={() => go("/generate-progress-note")}
          />
          <ActionCard
            icon="group"
            title="Lista de pacientes"
            desc="Consulta y gestiona tus pacientes."
            onClick={() => go("/patient-list")}
          />
          <ActionCard
            icon="notes"
            title="Lista de notas"
            desc="Revisa tus notas guardadas y el análisis."
            onClick={() => go("/notes")}
          />
          <ActionCard
            icon="folder_open"
            title="Archivos de sesiones"
            desc="(Próximamente) Explora imágenes y audios."
            onClick={() => setBusyMsg("Cargando…")}
          />
        </div>
      </section>
    </AppLayout>
  );
}

function ActionCard({ icon, title, desc, onClick }) {
  return (
    <div className="action-card">
      <div className="icon-badge">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h3 style={{margin:"0 0 6px", fontSize:18, fontWeight:800}}>{title}</h3>
      <p className="caption text-muted" style={{margin:"0 0 12px"}}>{desc}</p>
      <button onClick={onClick} className="btn h-10" style={{minWidth:96}}>Abrir</button>
    </div>
  );
}
