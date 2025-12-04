// src/pages/GenerateProgressNote.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import AppSidebar from "../components/AppSidebar";
import LoadingOverlay from "../components/LoadingOverlay";

import ImageCaptureModal from "../components/ImageCapturalModal";
import AudioCaptureModal from "../components/AudioCaptureModel";
import { useDoctorProfile } from "../services/userDoctorProfile";
import { orchestratePhotoPre, orchestrateAudioPre } from "../services/orchestrator";

export default function GenerateProgressNote() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const uid = user?.uid || null;

  const { orgId, name: doctorName, photoURL } = useDoctorProfile(
    user?.uid,
    user?.displayName,
    user?.photoURL,
    user?.email
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [busyMsg, setBusyMsg] = useState("");
  const [busyPct, setBusyPct] = useState(null);

  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");

  const [openImageModal, setOpenImageModal] = useState(false);
  const [openAudioModal, setOpenAudioModal] = useState(false);

  /* ============================
     CSS embebido solo para esta vista
     ============================ */
  const pageCSS = `
    /* Contenedor central tipo Settings */
    .note-page-wrap {
      max-width: 1120px;
      margin: 0 auto;
      padding: 20px 20px 40px;
    }
    .note-main-card {
      background: var(--card);
      border: 1px solid var(--ring);
      border-radius: var(--radius-card);
      box-shadow: var(--elev-1);
      padding: 20px 20px 24px;
    }

    /* Encabezado parecido a Settings (usa section-title) */
    .note-main-title {
      margin: 0 0 18px 0;
    }

    /* KPIs arriba */
    .note-kpi-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    .note-kpi {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: var(--radius-pill);
      padding: 6px 10px;
      font-weight: 700;
      font-size: 13px;
      border: 1px solid var(--ring);
      box-shadow: var(--elev-1);
      background: color-mix(in oklab, var(--alt3) 24%, white);
    }
    .note-kpi .material-symbols-outlined {
      font-size: 18px;
    }
    .note-kpi.brand {
      background: color-mix(in oklab, var(--alt1) 24%, white);
    }
    .note-kpi.success {
      background: color-mix(in oklab, var(--alt4) 18%, white);
    }

    /* Card del doctor, truncando nombre */
    .note-doctor-card {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 20px 12px;
      margin-top: 20px;
      margin-bottom: 20px;
      border-radius: var(--radius-card);
      border: 1px solid var(--ring);
      background: var(--surface-2);
      box-shadow: var(--elev-1);
      max-width: 360px;
    }
    .note-doctor-card img {
      width: 40px;
      height: 40px;
      border-radius: 999px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .note-doctor-name {
      font-weight: 700;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Fila selector + botón */
    .note-form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 12px;
      align-items: flex-end;
    }
    .note-patient-select-wrap {
      flex: 1 1 520px;
      max-width: 620px;
    }
    .note-select {
      width: 100%;
      height: 44px;
      border-radius: var(--radius-input);
      border: 1px solid var(--ring);
      background: var(--card);
      padding: 0 12px;
    }

    /* Botón registrar paciente tipo pill */
    .note-btn-pill {
      border-radius: var(--radius-pill);
      height: 44px;
      margin-top: 20px;
      margin-bottom: 20px;
      padding: 0px 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      border: 1px solid var(--ring);
      background: var(--primary);
      color: #fff;
      box-shadow: var(--elev-1);
      white-space: nowrap;
    }
    .note-btn-pill.is-disabled {
      opacity: .6;
      pointer-events: none;
    }

    /* Tarjetas de acción */
    .note-actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-top: 20px;
    }
    .note-mini-card {
      background: var(--muted);
      border: 1px solid var(--ring);
      border-radius: var(--radius-card);
      padding: 14px;
      display: flex;
      gap: 8px;
      align-items: center;
      box-shadow: var(--elev-1);
      transition: transform .08s ease, box-shadow .12s ease;
    }
    .note-mini-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px rgba(0,0,0,.10);
    }
    .note-mini-card.is-disabled {
      opacity: .55;
      pointer-events: none;
      transform: none;
      box-shadow: var(--elev-1);
    }
    .note-mini-badge {
      width: 40px;
      height: 40px;
      border-radius: 999px;
      border: 1px solid var(--ring);
      background: var(--card);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /* CTA final */
    .note-cta {
      margin-top: 20px;
      text-align: center;
    }
    .note-main-cta {
      border-radius: var(--radius-pill);
      height: 46px;
      padding: 0 24px;
      font-weight: 700;
    }

    /* MOBILE */
    @media (max-width: 640px) {
      .note-page-wrap {
        padding: 12px 12px 20px;
      }
      .note-main-card {
        padding: 14px 12px 18px;
      }
      .note-main-title {
        font-size: 20px;
        line-height: 1.2;
      }
      .note-kpi-row {
        gap: 6px;
        margin-top: 4px;
      }
      .note-kpi {
        padding: 4px 8px;
        font-size: 12px;
      }
      .note-doctor-card {
        max-width: 100%;
        padding: 8px 10px;
      }
      .note-doctor-name {
        font-size: 13px;
      }
      .note-form-row {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        margin-top: 12px;
      }
      .note-patient-select-wrap {
        flex: 1 1 auto;
        max-width: 100%;
      }
      .note-select {
        height: 42px;
        font-size: 14px;
      }
      .note-btn-pill {
        width: 100%;
        justify-content: center;
      }
      .note-actions-grid {
        grid-template-columns: 1fr;
        gap: 10px;
        margin-top: 14px;
      }
      .note-mini-card {
        min-height: 72px;
      }
      .note-main-cta {
        width: 100%;
      }
    }
  `;

  // Preselección si venimos de otra vista
  useEffect(() => {
    const fromState = location?.state?.patientId || "";
    if (fromState) setSelectedPatientId(fromState);
  }, [location?.state]);

  // Cargar pacientes
  useEffect(() => {
    let alive = true;
    async function loadPatients() {
      setLoadingPatients(true);
      setPatientsError("");
      setPatients([]);
      try {
        if (!uid || !orgId) {
          setLoadingPatients(false);
          return;
        }
        setBusyMsg("Cargando pacientes…");
        const colRef = collection(
          db,
          "orgs",
          orgId,
          "doctors",
          uid,
          "patients"
        );
        const qy = query(colRef, orderBy("fullName"));
        const snap = await getDocs(qy);
        if (!alive) return;
        setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error cargando pacientes:", e);
        if (alive) setPatientsError("No se pudieron cargar los pacientes.");
      } finally {
        if (alive) setLoadingPatients(false);
        setBusyMsg("");
      }
    }
    loadPatients();
    return () => {
      alive = false;
    };
  }, [uid, orgId]);

  const patientsCount = patients.length;
  const canUseActions = useMemo(
    () => !!selectedPatientId,
    [selectedPatientId]
  );
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const genId = () =>
    crypto?.randomUUID ? crypto.randomUUID() : `s_${Date.now()}`;

  const buildSessionContext = () => {
    const sessionId = genId();
    const ctx = {
      orgId,
      doctorUid: uid,
      doctorEmail: user?.email || null,
      patientId: selectedPatientId,
      sessionId,
      gcsBase: `gs://${orgId}/${uid}/${selectedPatientId}/sessions/${sessionId}`,
    };
    sessionStorage.setItem("currentSession", JSON.stringify(ctx));
    return ctx;
  };

  const handleImagePicked = async (file) => {
    if (!orgId || !selectedPatientId) {
      alert(
        "Selecciona un paciente y captura tu Organización en Perfil."
      );
      return;
    }
    try {
      const { sessionId, orgId: org, patientId } = buildSessionContext();
      const idToken = await user.getIdToken(true);
      setBusyPct(0);
      setBusyMsg("Procesando imagen…");
      const resp = await orchestratePhotoPre({
        org_id: org,
        patient_id: patientId,
        session_id: sessionId,
        file,
        idToken,
        onProgress: (p) => setBusyPct(Math.round(p)),
      });
      const textoOCR = resp?.ocr?.resultado?.texto || "";
      const noteId = resp?.note_id;
      setOpenImageModal(false);
      setBusyMsg("");
      setBusyPct(null);
      navigate("/review-text", {
        state: {
          source: "photo",
          orgId: org,
          patientId,
          sessionId,
          noteId,
          initialText: textoOCR,
          ocr: resp?.ocr ?? null,
          raw: resp ?? null,
        },
      });
    } catch (e) {
      console.error(e);
      alert(`Error subiendo/analizando: ${e.message}`);
      setBusyMsg("");
      setBusyPct(null);
    }
  };

  const handleAudioPicked = async (file) => {
    if (!orgId || !selectedPatientId) {
      alert(
        "Selecciona un paciente y captura tu Organización en Perfil."
      );
      return;
    }
    try {
      const { sessionId, orgId: org, patientId } = buildSessionContext();
      const idToken = await user.getIdToken(true);
      setBusyPct(0);
      setBusyMsg("Procesando audio…");
      const resp = await orchestrateAudioPre({
        org_id: org,
        patient_id: patientId,
        session_id: sessionId,
        file,
        idToken,
        onProgress: (p) => setBusyPct(Math.round(p)),
      });
      const textoSTT =
        resp?.stt?.resultado?.texto ||
        resp?.asr?.resultado?.texto ||
        resp?.transcription?.text ||
        resp?.texto ||
        "";
      const noteId = resp?.note_id;
      setOpenAudioModal(false);
      setBusyMsg("");
      setBusyPct(null);
      navigate("/review-text", {
        state: {
          source: "audio",
          orgId: org,
          patientId,
          sessionId,
          noteId,
          initialText: textoSTT,
          stt: resp?.stt ?? resp?.asr ?? null,
          raw: resp ?? null,
        },
      });
    } catch (e) {
      console.error(e);
      alert(`Error subiendo/analizando: ${e.message}`);
      setBusyMsg("");
      setBusyPct(null);
    }
  };

  const onGenerateNote = () => {
    if (!orgId || !selectedPatientId) return;
    const ctx = buildSessionContext();
    setBusyMsg("Abriendo editor…");
    navigate("/patient-progress-note-overview", {
      state: {
        orgId: ctx.orgId,
        patientId: ctx.patientId,
        sessionId: ctx.sessionId,
        noteId: null,
        analisis: null,
        initialText: "",
        source: "manual",
      },
    });
  };

  const canGenerateNote = !!orgId && !!selectedPatientId;

  const leftActions = (
    <button
      onClick={() => setSidebarCollapsed((v) => !v)}
      className="btn-ghost h-9"
      title={sidebarCollapsed ? "Expandir" : "Contraer"}
    >
      <span className="material-symbols-outlined">menu</span>
    </button>
  );

  const handleLogout = async () => {
    try {
      setBusyMsg("Cerrando sesión…");
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyMsg("");
    }
  };

  // Header como en las otras vistas: logo + TerappIA, solo botón Cerrar sesión
  const rightActions = (
    <button
      onClick={handleLogout}
      className="btn h-10"
      data-variant="ghost"
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
        leftActions={leftActions}
        rightActions={rightActions}
        sidebar={
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((v) => !v)}
          />
        }
      >
        <LoadingOverlay
          open={loadingPatients || !!busyMsg}
          message={busyMsg || "Cargando…"}
          progress={busyPct != null ? busyPct : undefined}
        />

        <div className="note-page-wrap">
          <section className="note-main-card">
            {/* Top: título + KPIs + doctor */}
            <div className="top-block flex flex-col-reverse lg:flex-row gap-5 lg:items-end lg:justify-between">
              <div>
                {/* mismo estilo que Settings: section-title */}
                <h1 className="section-title note-main-title">
                  Seleccionar paciente
                </h1>
                <div className="note-kpi-row">
                  <span className="note-kpi brand">
                    <span className="material-symbols-outlined">domain</span>
                    Org: {orgId || "—"}
                  </span>
                  <span className="note-kpi">
                    <span className="material-symbols-outlined">badge</span>
                    Paciente: {selectedPatient?.fullName || "—"}
                  </span>
                  <span className="note-kpi success">
                    <span className="material-symbols-outlined">groups</span>
                    Pacientes: {patientsCount}
                  </span>
                </div>
              </div>

              <div className="w-full lg:w-auto">
                <div className="note-doctor-card">
                  <img src={photoURL} alt="Doctor" />
                  <div className="min-w-0">
                    <p className="note-doctor-name" title={doctorName || ""}>
                      {doctorName || "—"}
                    </p>
                    <p className="caption text-muted">
                      Terapeuta / Clínico
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selector + CTA registrar */}
            <div className="note-form-row">
              <div className="note-patient-select-wrap">
                <select
                  id="patient-select"
                  value={selectedPatientId}
                  disabled={
                    !orgId || loadingPatients || patients.length === 0
                  }
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="note-select"
                >
                  <option value="">
                    {loadingPatients
                      ? "Cargando pacientes…"
                      : patients.length === 0
                      ? "No hay pacientes"
                      : "Seleccionar paciente"}
                  </option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName || p.id}
                    </option>
                  ))}
                </select>

                {patientsError && (
                  <p className="caption text-error mt-2">
                    {patientsError}
                  </p>
                )}
                {!orgId && (
                  <p className="caption text-warning mt-2">
                    ⚠️ Ve a <b>Perfil</b> y captura tu{" "}
                    <b>Organización</b> para ver tus pacientes.
                  </p>
                )}
              </div>

              <button
                onClick={() => navigate("/register-new-patient")}
                className="note-btn-pill"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ marginRight: 6 }}
                >
                  person_add
                </span>
                Registrar nuevo paciente
              </button>
            </div>

            {/* Tarjetas de acción */}
            <div className="note-actions-grid">
              <button
                type="button"
                disabled={!canUseActions}
                onClick={() => setOpenImageModal(true)}
                className={`note-mini-card ${
                  !canUseActions ? "is-disabled" : ""
                }`}
                title={
                  canUseActions
                    ? "Tomar/Seleccionar imagen"
                    : "Selecciona un paciente primero"
                }
              >
                <div className="note-mini-badge">
                  <span className="material-symbols-outlined">
                    photo_camera
                  </span>
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    Cámara / Imagen
                  </h3>
                  <p
                    className="caption text-muted"
                    style={{ marginTop: 4 }}
                  >
                    Toma una foto o elige de tu galería. Extraemos texto
                    con OCR.
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={!canUseActions}
                onClick={() => setOpenAudioModal(true)}
                className={`note-mini-card ${
                  !canUseActions ? "is-disabled" : ""
                }`}
                title={
                  canUseActions
                    ? "Grabar/Seleccionar audio"
                    : "Selecciona un paciente primero"
                }
              >
                <div className="note-mini-badge">
                  <span className="material-symbols-outlined">
                    keyboard_voice
                  </span>
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    Audio
                  </h3>
                  <p
                    className="caption text-muted"
                    style={{ marginTop: 4 }}
                  >
                    Graba o sube un audio. Transcribimos y lo revisas.
                  </p>
                </div>
              </button>
            </div>

            {/* CTA principal */}
            <div className="note-cta">
              <button
                onClick={onGenerateNote}
                disabled={!canGenerateNote}
                className={`btn-primary note-main-cta ${
                  !canGenerateNote ? "is-disabled" : ""
                }`}
                title={
                  canGenerateNote
                    ? "Crear nota sin análisis"
                    : "Selecciona un paciente primero"
                }
              >
                Generar nota de evolución
              </button>
            </div>
          </section>
        </div>

        {/* Modales */}
        <ImageCaptureModal
          open={openImageModal}
          onClose={() => setOpenImageModal(false)}
          onPicked={handleImagePicked}
          title="Capturar imagen"
        />
        <AudioCaptureModal
          open={openAudioModal}
          onClose={() => setOpenAudioModal(false)}
          onPicked={handleAudioPicked}
          title="Capturar audio"
        />
      </AppLayout>
    </>
  );
}
