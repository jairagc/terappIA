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

  // ====== OVERRIDES MÓVIL súper compactos ======
  const mobileCSS = `
  @media (max-width: 640px){
    .page-note{ padding:12px !important; }
    .page-note .top-block{ margin-bottom:4px !important; }
    .page-note .h1{ font-size:20px !important; line-height:1.2 !important; margin:0 !important; }

    .page-note .kpi-row{ gap:6px !important; margin:6px 0 0 0 !important; }
    .page-note .kpi{ padding:4px 8px !important; font-size:12px !important; }

    .page-note .doctor-card{ padding:8px 10px !important; gap:8px !important; }
    .page-note .doctor-card img{ width:34px !important; height:34px !important; }

    /* <<< EL FIX DEL AIRE >>> */
    .page-note .form-row{ display:flex !important; flex-direction:column !important; gap:8px !important; margin:4px 0 0 0 !important; }
    .page-note .patient-select-wrap{ margin-top:0 !important; }  /* anula el inline antiguo */
    .page-note .form-row .select{ width:100% !important; font-size:14px !important; height:42px !important; margin:0 !important; }
    .page-note .form-row .pointer-events-none{ display:none !important; }
    .page-note .form-row .caption{ margin:0 !important; }

    .page-note .btn-pill{ height:40px !important; padding:0 14px !important; font-size:14px !important; width:100% !important; }

    .page-note .cards-2{ display:grid !important; grid-template-columns:1fr !important; gap:10px !important; margin-top:8px !important; }
    .page-note .mini-card{ padding:12px !important; gap:10px !important; min-height:80px !important; align-items:flex-start !important; }
    .page-note .mini-card .icon-badge{ width:34px !important; height:34px !important; }
    .page-note .mini-card .material-symbols-outlined{ font-size:22px !important; }
    .page-note .mini-card h3{ font-size:16px !important; }
    .page-note .mini-card .caption{ font-size:12px !important; }

    .page-note .cta-wrap{ margin-top:12px !important; text-align:center; }
    .page-note .btn-primary.pill{ height:42px !important; padding:0 16px !important; font-size:14px !important; }

    .page-note *{ min-width:0; max-width:100%; }
  }`;

  // Preselección si venimos desde otra vista
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
        if (!uid || !orgId) { setLoadingPatients(false); return; }
        setBusyMsg("Cargando pacientes…");
        const colRef = collection(db, "orgs", orgId, "doctors", uid, "patients");
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
    return () => { alive = false; };
  }, [uid, orgId]);

  const patientsCount = patients.length;
  const canUseActions = useMemo(() => !!selectedPatientId, [selectedPatientId]);
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const genId = () => (crypto?.randomUUID ? crypto.randomUUID() : `s_${Date.now()}`);

  const buildSessionContext = () => {
    const sessionId = genId();
    const ctx = {
      orgId, doctorUid: uid, doctorEmail: user?.email || null,
      patientId: selectedPatientId, sessionId,
      gcsBase: `gs://${orgId}/${uid}/${selectedPatientId}/sessions/${sessionId}`,
    };
    sessionStorage.setItem("currentSession", JSON.stringify(ctx));
    return ctx;
  };

  const handleImagePicked = async (file) => {
    if (!orgId || !selectedPatientId) { alert("Selecciona un paciente y captura tu Organización en Perfil."); return; }
    try {
      const { sessionId, orgId: org, patientId } = buildSessionContext();
      const idToken = await user.getIdToken(true);
      setBusyPct(0); setBusyMsg("Procesando imagen…");
      const resp = await orchestratePhotoPre({ org_id: org, patient_id: patientId, session_id: sessionId, file, idToken, onProgress: (p) => setBusyPct(Math.round(p)) });
      const textoOCR = resp?.ocr?.resultado?.texto || ""; const noteId = resp?.note_id;
      setOpenImageModal(false); setBusyMsg(""); setBusyPct(null);
      navigate("/review-text", { state: { source: "photo", orgId: org, patientId, sessionId, noteId, initialText: textoOCR, ocr: resp?.ocr ?? null, raw: resp ?? null } });
    } catch (e) { console.error(e); alert(`Error subiendo/analizando: ${e.message}`); setBusyMsg(""); setBusyPct(null); }
  };

  const handleAudioPicked = async (file) => {
    if (!orgId || !selectedPatientId) { alert("Selecciona un paciente y captura tu Organización en Perfil."); return; }
    try {
      const { sessionId, orgId: org, patientId } = buildSessionContext();
      const idToken = await user.getIdToken(true);
      setBusyPct(0); setBusyMsg("Procesando audio…");
      const resp = await orchestrateAudioPre({ org_id: org, patient_id: patientId, session_id: sessionId, file, idToken, onProgress: (p) => setBusyPct(Math.round(p)) });
      const textoSTT = resp?.stt?.resultado?.texto || resp?.asr?.resultado?.texto || resp?.transcription?.text || resp?.texto || "";
      const noteId = resp?.note_id;
      setOpenAudioModal(false); setBusyMsg(""); setBusyPct(null);
      navigate("/review-text", { state: { source: "audio", orgId: org, patientId, sessionId, noteId, initialText: textoSTT, stt: resp?.stt ?? resp?.asr ?? null, raw: resp ?? null } });
    } catch (e) { console.error(e); alert(`Error subiendo/analizando: ${e.message}`); setBusyMsg(""); setBusyPct(null); }
  };

  const onGenerateNote = () => {
    if (!orgId || !selectedPatientId) return;
    const ctx = buildSessionContext();
    setBusyMsg("Abriendo editor…");
    navigate("/patient-progress-note-overview", { state: { orgId: ctx.orgId, patientId: ctx.patientId, sessionId: ctx.sessionId, noteId: null, analisis: null, initialText: "", source: "manual" } });
  };

  const canGenerateNote = !!orgId && !!selectedPatientId;

  const leftActions = (
    <button onClick={() => setSidebarCollapsed((v) => !v)} className="btn-ghost h-9" title={sidebarCollapsed ? "Expandir" : "Contraer"}>
      <span className="material-symbols-outlined">menu</span>
    </button>
  );

  const handleLogout = async () => {
    try { setBusyMsg("Cerrando sesión…"); await logout(); navigate("/login", { replace: true }); }
    catch (e) { console.error(e); }
    finally { setBusyMsg(""); }
  };

  const rightActions = (
    <div className="header-actions">
      <button onClick={() => navigate("/dashboard")} className="btn h-10" data-variant="ghost">
        <span className="material-symbols-outlined">arrow_back</span> Regresar
      </button>
      <button onClick={handleLogout} className="btn h-10" data-variant="ghost">Cerrar sesión</button>
    </div>
  );

  return (
    <>
      <style>{mobileCSS}</style>

      <AppLayout
        title="Notas de evolución"
        leftActions={leftActions}
        rightActions={rightActions}
        sidebar={<AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />}
      >
        <LoadingOverlay open={loadingPatients || !!busyMsg} message={busyMsg || "Cargando…"} progress={busyPct != null ? busyPct : undefined} />

        <div className="page-note">
          {/* Top */}
          <div className="top-block flex flex-col-reverse lg:flex-row gap-5 lg:items-end lg:justify-between">
            <div>
              <h1 className="h1">Seleccionar paciente</h1>
              <div className="kpi-row">
                <span className="kpi brand"><span className="material-symbols-outlined">domain</span>Org: {orgId || "—"}</span>
                <span className="kpi"><span className="material-symbols-outlined">badge</span>Paciente: {selectedPatient?.fullName || "—"}</span>
                <span className="kpi success"><span className="material-symbols-outlined">groups</span>Pacientes: {patientsCount}</span>
              </div>
            </div>

            <div className="w-full lg:w-auto">
              <div className="card doctor-card">
                <img src={photoURL} alt="Doctor" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{doctorName}</p>
                  <p className="caption text-muted">Terapeuta / Clínico</p>
                </div>
              </div>
            </div>
          </div>

          {/* Selector + CTA */}
          <div className="form-row">
            <div className="patient-select-wrap" style={{ flex: "1 1 520px", maxWidth: 620 }}>
              <div className="relative">
                <select
                  id="patient-select"
                  value={selectedPatientId}
                  disabled={!orgId || loadingPatients || patients.length === 0}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="select h-11 pr-10"
                >
                  <option value="">
                    {loadingPatients ? "Cargando pacientes…" : patients.length === 0 ? "No hay pacientes" : "Seleccionar paciente"}
                  </option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.fullName || p.id}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="material-symbols-outlined text-muted">expand_more</span>
                </div>
              </div>

              {patientsError && <p className="caption text-error mt-2">{patientsError}</p>}
              {!orgId && (
                <p className="caption text-warning mt-2">
                  ⚠️ Ve a <b>Perfil</b> y captura tu <b>Organización</b> para ver tus pacientes.
                </p>
              )}
            </div>

            <button onClick={() => navigate("/register-new-patient")} className="btn-primary btn-pill">
              <span className="material-symbols-outlined mr-2">person_add</span>
              Registrar nuevo paciente
            </button>
          </div>

          {/* Tarjetas de acción */}
          <div className="cards-2">
            <button
              type="button"
              disabled={!canUseActions}
              onClick={() => setOpenImageModal(true)}
              className={`mini-card ${!canUseActions ? "is-disabled" : ""}`}
              title={canUseActions ? "Tomar/Seleccionar imagen" : "Selecciona un paciente primero"}
            >
              <div className="icon-badge"><span className="material-symbols-outlined">photo_camera</span></div>
              <div>
                <h3 className="h3" style={{ margin: 0 }}>Cámara / Imagen</h3>
                <p className="caption text-muted" style={{ marginTop: 4 }}>Toma una foto o elige de tu galería. Extraemos texto con OCR.</p>
              </div>
            </button>

            <button
              type="button"
              disabled={!canUseActions}
              onClick={() => setOpenAudioModal(true)}
              className={`mini-card ${!canUseActions ? "is-disabled" : ""}`}
              title={canUseActions ? "Grabar/Seleccionar audio" : "Selecciona un paciente primero"}
            >
              <div className="icon-badge"><span className="material-symbols-outlined">keyboard_voice</span></div>
              <div>
                <h3 className="h3" style={{ margin: 0 }}>Audio</h3>
                <p className="caption text-muted" style={{ marginTop: 4 }}>Graba o sube un audio. Transcribimos y lo revisas.</p>
              </div>
            </button>
          </div>

          <div className="cta-wrap">
            <button
              onClick={onGenerateNote}
              disabled={!canGenerateNote}
              className={`btn-primary pill ${!canGenerateNote ? "is-disabled" : ""}`}
              title={canGenerateNote ? "Crear nota sin análisis" : "Selecciona un paciente primero"}
            >
              Generar nota de evolución
            </button>
          </div>
        </div>

        {/* Modales */}
        <ImageCaptureModal open={openImageModal} onClose={() => setOpenImageModal(false)} onPicked={handleImagePicked} title="Capturar imagen" />
        <AudioCaptureModal open={openAudioModal} onClose={() => setOpenAudioModal(false)} onPicked={handleAudioPicked} title="Capturar audio" />
      </AppLayout>
    </>
  );
}
