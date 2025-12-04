// src/pages/MainDashboard.jsx
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
  const { name, photoURL } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL
  );

  const [patientsCount, setPatientsCount] = useState(null);
  const [notesCount, setNotesCount] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [busyMsg, setBusyMsg] = useState("");

  /* ========= CSS solo para este dashboard ========= */
  const pageCSS = `
    /* Contenedor común para centrar contenido como en PatientList */
    .md-page {
      padding: 16px;
      display: flex;
      justify-content: center;
    }
    .md-page-inner {
      width: 100%;
      max-width: 1120px;
    }

    /* Nombre del doctor – que nunca desborde */
    .md-dashboard-name{
      display:block;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width:100%;
    }

    /* Card de perfil / métricas
       - full width dentro de md-page-inner en desktop
       - SIN margin-left global de .card
    */
    .md-profile-card{
      width:100%;
      margin-left:0px;
      margin-right:5px;
    }

    .md-profile-stats .stat{
      padding:10px;
    }

    /* Grid de acciones: desktop 4 cols, tablet 2, móvil 1 */
    .md-actions-stack{
      display:grid;
      grid-template-columns:repeat(4, minmax(150px, 1fr));
      column-gap:50px;
      row-gap:24px;
      padding:10px 0;
    }

    @media (max-width:1024px){
      .md-actions-stack{
        grid-template-columns:repeat(2, minmax(150px, 1fr));
        column-gap:20px;
        row-gap:18px;
      }
    }

    @media (max-width:640px){
      .md-page {
        padding: 12px;
      }

      .md-page-inner {
        padding: 0 4px;      /* aire a ambos lados en cel */
      }

      .md-profile-card{
        max-width: 260px;    
        margin: 12px auto 8px;
      }

      .md-profile-name{
        font-size:16px !important;
      }
      .md-profile-stats .stat{
        padding:8px;
      }

      .md-actions-stack{
        grid-template-columns:1fr;
        column-gap:14px;
        row-gap:11px;
        padding:8px 0;
      }
      .md-actions-stack .action-card{
        width:90% !important;
        min-width:0 !important;
        min-height:100px !important;
        padding:12px !important;
      }
      .md-actions-stack .icon-badge{
        width:34px !important;
        height:34px !important;
        margin:6px 0 !important;
      }
      .md-actions-stack h3{
        font-size:15px !important;
        line-height:1.2 !important;
        margin:0 !important;
      }
      .md-actions-stack .caption{
        font-size:12px !important;
        margin:0 0 6px !important;
      }
      .md-actions-stack .btn{
        height:34px !important;
        padding:0 12px !important;
        font-size:13px !important;
        min-width:88px !important;
      }
    }
  `;

  useEffect(() => setOrgId(localStorage.getItem("orgId") || ""), []);

  useEffect(() => {
    let alive = true;
    async function loadStats() {
      if (!user?.uid || !orgId) {
        setPatientsCount(0);
        setNotesCount(0);
        setLoadingStats(false);
        return;
      }
      setLoadingStats(true);
      try {
        const patientsCol = collection(
          db,
          "orgs",
          orgId,
          "doctors",
          user.uid,
          "patients"
        );
        const patientsSnap = await getDocs(patientsCol);
        if (!alive) return;
        setPatientsCount(patientsSnap.size);

        let totalNotes = 0;
        for (const pDoc of patientsSnap.docs) {
          const sessionsCol = collection(
            db,
            "orgs",
            orgId,
            "doctors",
            user.uid,
            "patients",
            pDoc.id,
            "sessions"
          );
          const sessionsSnap = await getDocs(sessionsCol);
          for (const sDoc of sessionsSnap.docs) {
            const notesCol = collection(
              db,
              "orgs",
              orgId,
              "doctors",
              user.uid,
              "patients",
              pDoc.id,
              "sessions",
              sDoc.id,
              "notes"
            );
            const notesSnap = await getDocs(notesCol);
            totalNotes += notesSnap.size;
          }
        }
        if (!alive) return;
        setNotesCount(totalNotes);
      } catch (e) {
        console.error("Error leyendo métricas:", e);
        if (!alive) return;
        setPatientsCount(0);
        setNotesCount(0);
      } finally {
        if (alive) setLoadingStats(false);
      }
    }
    loadStats();
    return () => {
      alive = false;
    };
  }, [user?.uid, orgId]);

  const statPatients = useMemo(() => patientsCount ?? 0, [patientsCount]);
  const statNotes   = useMemo(() => notesCount ?? 0, [notesCount]);

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

  const go = (path) => {
    setBusyMsg("Abriendo…");
    navigate(path);
  };

  // Header igual que en otras vistas
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
    <>
      <style>{pageCSS}</style>

      <AppLayout
        rightActions={rightActions}
        leftActions={
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="btn icon"
            title={collapsed ? "Expandir" : "Contraer"}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        }
        sidebar={
          <AppSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
          />
        }
      >
        <LoadingOverlay
          open={loadingStats || !!busyMsg}
          message={busyMsg || "Cargando…"}
        />

        {/* ===== Perfil + métricas ===== */}
        <section className="md-page">
          <div className="md-page-inner">
            <div className="card md-profile-card" style={{ padding: 16 }}>
              <div className="flex items-center gap-3">
                <img
                  src={photoURL}
                  alt="Foto"
                  className="sidebar-avatar"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 9999,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h2
                    className="md-dashboard-name md-profile-name"
                    style={{
                      margin: 0,
                      fontSize: 18,
                      lineHeight: 1.2,
                      fontWeight: 800,
                    }}
                    title={name || user?.displayName || "Usuario"}
                  >
                    {name || user?.displayName || "Usuario"}
                  </h2>
                  <p
                    className="caption text-muted truncate"
                    style={{ margin: 0, maxWidth: "100%" }}
                  >
                    Org: {orgId || "Sin organización"}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div
                className="stats-grid md-profile-stats"
                style={{ marginTop: 12 }}
              >
                <div className="stat">
                  <div
                    style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}
                  >
                    {loadingStats ? "—" : statPatients}
                  </div>
                  <div className="caption text-muted">Pacientes</div>
                </div>
                <div className="stat">
                  <div
                    style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}
                  >
                    {loadingStats ? "—" : statNotes}
                  </div>
                  <div className="caption text-muted">Notas</div>
                </div>
                <div className="stat">
                  <div
                    style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}
                  >
                    {loadingStats ? "—" : Math.max(statNotes - 0, 0)}
                  </div>
                  <div className="caption text-muted">
                    Sesiones (aprox.)
                  </div>
                </div>
                <div className="stat">
                  <div
                    style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}
                  >
                    —
                  </div>
                  <div className="caption text-muted">Archivos sesión</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Acciones (grid responsivo) ===== */}
        <section className="md-page">
          <div className="md-page-inner">
            <div className="md-actions-stack">
              <ActionCard
                icon="add_notes"
                title="Nueva nota"
                desc="Inicia una nota de evolución por OCR o audio."
                onClick={() => go("/generate-progress-note")}
              />
              <ActionCard
                icon="group"
                title="Pacientes"
                desc="Consulta y gestiona tus pacientes."
                onClick={() => go("/patient-list")}
              />
              <ActionCard
                icon="notes"
                title="Notas"
                desc="Revisa tus notas guardadas y el análisis."
                onClick={() => go("/notes")}
              />
              <ActionCard
                icon="folder_open"
                title="Archivos"
                desc="(Próximamente) Explora imágenes y audios."
                onClick={() => {}}
              />
            </div>
          </div>
        </section>
      </AppLayout>
    </>
  );
}

function ActionCard({ icon, title, desc, onClick }) {
  return (
    <div
      className="action-card"
      style={{
        minHeight: 120,
        padding: 14,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 6,
      }}
    >
      <div
        className="icon-badge"
        style={{ width: 40, height: 40, margin: "8px 0" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
          {icon}
        </span>
      </div>
      <h3
        className="truncate"
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 800,
          lineHeight: 1.2,
          maxWidth: "100%",
        }}
        title={title}
      >
        {title}
      </h3>
      <p
        className="caption text-muted"
        style={{ margin: "0 0 8px", lineHeight: 1.35, maxWidth: "100%" }}
      >
        {desc}
      </p>
      <button
        onClick={onClick}
        className="btn h-9"
        style={{ minWidth: 96, fontSize: 13 }}
      >
        Abrir
      </button>
    </div>
  );
}
