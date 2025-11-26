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

  // --- Overrides SOLO para este componente (stack vertical en móvil)
  const mobileCSS = `
  @media (max-width: 640px){
    .md-actions-stack{
      display: grid !important;
      grid-template-columns: 1fr !important; /* 1 columna en móvil */
      column-gap: 10px !important;
      row-gap: 12px !important;
      padding: 8px 0 !important;
    }
    .md-actions-stack .action-card{
      width: 100% !important;
      min-width: 0 !important;
      min-height: 100px !important;
      padding: 12px !important;
    }
    .md-actions-stack .icon-badge{
      width: 34px !important;
      height: 34px !important;
      margin: 6px 0 !important;
    }
    .md-actions-stack h3{
      font-size: 15px !important;
      line-height: 1.2 !important;
      margin: 0 !important;
    }
    .md-actions-stack .caption{
      font-size: 12px !important;
      margin: 0 0 6px !important;
    }
    .md-actions-stack .btn{
      height: 34px !important;
      padding: 0 12px !important;
      font-size: 13px !important;
      min-width: 88px !important;
    }
  }`;

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
  const statNotes = useMemo(() => notesCount ?? 0, [notesCount]);

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

  const rightActions = (
    <div className="header-actions">
      {/* En móvil ocultamos estos tres para no saturar el header */}
      <button
        onClick={() => go("/generate-progress-note")}
        className="btn ghost h-10 hidden sm:inline-flex"
      >
        Nueva nota
      </button>
      <button
        onClick={() => go("/patient-list")}
        className="btn ghost h-10 hidden sm:inline-flex"
      >
        Pacientes
      </button>
      <button
        onClick={() => go("/notes")}
        className="btn ghost h-10 hidden sm:inline-flex"
      >
        Notas
      </button>
      <button onClick={handleLogout} className="btn ghost h-10">
        Cerrar sesión
      </button>
    </div>
  );

  return (
    <>
      {/* Inyectamos los overrides específicos de esta vista */}
      <style>{mobileCSS}</style>

      <AppLayout
        title="TerappIA"
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
        <section className="container-pad maxw-7xl" style={{ paddingTop: 16 }}>
          <div className="card" style={{ padding: 16 }}>
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
              <div className="min-w-0">
                <h2
                  className="truncate"
                  style={{ margin: 0, fontSize: 18, lineHeight: 1.2, fontWeight: 800 }}
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

            {/* Stats (usa tus media queries globales + tipografía compacta) */}
            <div className="stats-grid" style={{ marginTop: 12 }}>
              <div className="stat">
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
                  {loadingStats ? "—" : statPatients}
                </div>
                <div className="caption text-muted">Pacientes</div>
              </div>
              <div className="stat">
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
                  {loadingStats ? "—" : statNotes}
                </div>
                <div className="caption text-muted">Notas</div>
              </div>
              <div className="stat">
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
                  {loadingStats ? "—" : Math.max(statNotes - 0, 0)}
                </div>
                <div className="caption text-muted">Sesiones (aprox.)</div>
              </div>
              <div className="stat">
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>—</div>
                <div className="caption text-muted">Archivos sesión</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Acciones (apiladas en móvil) ===== */}
        <section className="container-pad maxw-7xl" style={{ paddingTop: 10 }}>
          <div
            className="action-grid--fixed4 md-actions-stack"
            style={{
              // En desktop seguimos usando 4 columnas; el override móvil hará 1 columna
              columnGap: 16,
              rowGap: 16,
              padding: "12px 0",
              gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
            }}
          >
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
      <div className="icon-badge" style={{ width: 40, height: 40, margin: "8px 0" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
          {icon}
        </span>
      </div>
      <h3
        className="truncate"
        style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.2, maxWidth: "100%" }}
        title={title}
      >
        {title}
      </h3>
      <p className="caption text-muted" style={{ margin: "0 0 8px", lineHeight: 1.35, maxWidth: "100%" }}>
        {desc}
      </p>
      <button onClick={onClick} className="btn h-9" style={{ minWidth: 96, fontSize: 13 }}>
        Abrir
      </button>
    </div>
  );
}
