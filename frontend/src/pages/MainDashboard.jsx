// src/pages/MainDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import AppSidebar from "../components/AppSidebar";
import { useDoctorProfile } from "../services/userDoctorProfile";

export default function MainDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [orgId, setOrgId] = useState(() => localStorage.getItem("orgId") || "");

  const { name, photoURL } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL
  );

  const [patientsCount, setPatientsCount] = useState(null);
  const [notesCount, setNotesCount] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

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
    return () => { alive = false; };
  }, [user?.uid, orgId]);

  const statPatients = useMemo(() => patientsCount ?? 0, [patientsCount]);
  const statNotes = useMemo(() => notesCount ?? 0, [notesCount]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background-light dark:bg-background-dark font-display text-text-primary">
      {/* Header */}
      <header className="flex h-16 w-full items-center justify-between bg-dark-navy px-4 sm:px-6 text-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center justify-center rounded hover:bg-white/10 p-1"
            title={collapsed ? "Expandir" : "Contraer"}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="material-symbols-outlined text-white text-3xl">
            neurology
          </span>
          <h1 className="text-lg sm:text-xl font-bold">TerappIA</h1>
        </div>

        <button
          onClick={handleLogout}
          className="text-sm font-medium hover:underline focus:outline-none"
          aria-label="Cerrar sesión"
        >
          Cerrar sesión
        </button>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Reusable Sidebar */}
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Doctor panel (sin correo) */}
          <section className="p-6 sm:p-8">
            <div className="rounded-xl bg-white dark:bg-[#0d121b] shadow-subtle p-6">
              <div className="flex items-center gap-4">
                <img
                  src={photoURL}
                  alt="Foto"
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-dark-navy dark:text-white truncate">
                    {name}
                  </h2>
                  <p className="text-sm text-text-secondary dark:text-gray-300 truncate">
                    {orgId ? `Org: ${orgId}` : "Sin organización"}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg bg-calm-blue p-4">
                  <div className="text-3xl font-extrabold text-dark-navy">
                    {loadingStats ? "—" : statPatients}
                  </div>
                  <div className="text-sm text-text-secondary">Pacientes</div>
                </div>
                <div className="rounded-lg bg-calm-blue p-4">
                  <div className="text-3xl font-extrabold text-dark-navy">
                    {loadingStats ? "—" : statNotes}
                  </div>
                  <div className="text-sm text-text-secondary">Notas</div>
                </div>
                <div className="rounded-lg bg-calm-blue p-4">
                  <div className="text-3xl font-extrabold text-dark-navy">
                    {loadingStats ? "—" : Math.max(statNotes - 0, 0)}
                  </div>
                  <div className="text-sm text-text-secondary">Sesiones (aprox.)</div>
                </div>
                <div className="rounded-lg bg-calm-blue p-4">
                  <div className="text-3xl font-extrabold text-dark-navy">—</div>
                  <div className="text-sm text-text-secondary">Archivos sesión</div>
                </div>
              </div>
            </div>
          </section>

          {/* Action cards */}
          <section className="px-6 sm:px-8 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <Card
                icon="add_notes"
                title="Nueva nota"
                desc="Inicia una nota de evolución por OCR o audio."
                onClick={() => navigate("/generate-progress-note")}
              />
              <Card
                icon="group"
                title="Lista de pacientes"
                desc="Consulta y gestiona tus pacientes."
                onClick={() => navigate("/patient-list")}
              />
              <Card
                icon="notes"
                title="Lista de notas"
                desc="Revisa tus notas guardadas y el análisis."
                onClick={() => navigate("/notes")}
              />
              <Card
                icon="folder_open"
                title="Archivos de sesiones"
                desc="(Próximamente) Explora imágenes y audios."
                onClick={() => alert("Próximamente")}
              />
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between bg-dark-navy p-4 text-white">
        <div className="text-sm">
          <p>contacto@terappia.com</p>
          <p>+1 (234) 567-890</p>
        </div>
        <div className="flex space-x-4">
          <a href="#" className="text-white hover:text-gray-300" aria-label="X/Twitter">
            <span className="material-symbols-outlined">public</span>
          </a>
          <a href="#" className="text-white hover:text-gray-300" aria-label="Instagram">
            <span className="material-symbols-outlined">camera</span>
          </a>
          <a href="#" className="text-white hover:text-gray-300" aria-label="LinkedIn">
            <span className="material-symbols-outlined">work</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

function Card({ icon, title, desc, onClick }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-calm-blue p-6 text-center shadow-subtle">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white">
        <span className="material-symbols-outlined text-3xl text-dark-navy">{icon}</span>
      </div>
      <h3 className="mb-1 text-lg font-bold text-dark-navy">{title}</h3>
      <p className="mb-4 text-text-secondary text-sm">{desc}</p>
      <button
        onClick={onClick}
        className="flex min-w-[84px] items-center justify-center rounded-lg bg-dark-navy px-4 py-2 text-white font-semibold"
      >
        Abrir
      </button>
    </div>
  );
}
