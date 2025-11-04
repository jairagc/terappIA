// src/pages/GenerateProgressNote.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import AppSidebar from "../components/AppSidebar";
import ImageCaptureModal from "../components/ImageCapturalModal";
import AudioCaptureModal from "../components/AudioCaptureModel";
import { useDoctorProfile } from "../services/userDoctorProfile";

import { orchestratePhotoPre, orchestrateAudioPre } from "../services/orchestrator";

export default function GenerateProgressNote() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const uid = user?.uid || null;

  const { orgId, name: doctorName, photoURL } = useDoctorProfile(
    user?.uid, user?.displayName, user?.photoURL, user?.email
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");

  // Modales
  const [openImageModal, setOpenImageModal] = useState(false);
  const [openAudioModal, setOpenAudioModal] = useState(false);

  useEffect(() => {
    const fromState = location?.state?.patientId || "";
    if (fromState) setSelectedPatientId(fromState);
  }, [location?.state]);

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
      }
    }
    loadPatients();
    return () => { alive = false; };
  }, [uid, orgId]);

  const patientsCount = patients.length;
  const canUseActions = useMemo(() => !!selectedPatientId, [selectedPatientId]);

  // Helpers
  const genId = () => (crypto?.randomUUID ? crypto.randomUUID() : `s_${Date.now()}`);

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

  // IMAGE FLOW (del modal)
  const handleImagePicked = async (file) => {
    if (!orgId || !selectedPatientId) {
      alert("Selecciona un paciente y captura tu Organización en Perfil.");
      return;
    }
    const { sessionId, orgId: org, patientId } = buildSessionContext();
    const idToken = await user.getIdToken(true);

    const resp = await orchestratePhotoPre({
      org_id: org,
      patient_id: patientId,
      session_id: sessionId,
      file,
      idToken,
      onProgress: () => {},
    });

    const textoOCR = resp?.ocr?.resultado?.texto || "";
    const noteId = resp?.note_id;

    setOpenImageModal(false);

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
  };

  // AUDIO FLOW (del modal)
  const handleAudioPicked = async (file) => {
    if (!orgId || !selectedPatientId) {
      alert("Selecciona un paciente y captura tu Organización en Perfil.");
      return;
    }
    const { sessionId, orgId: org, patientId } = buildSessionContext();
    const idToken = await user.getIdToken(true);

    const resp = await orchestrateAudioPre({
      org_id: org,
      patient_id: patientId,
      session_id: sessionId,
      file,
      idToken,
      onProgress: () => {},
    });

    // intenta varios nombres de campo comunes para el texto transcrito
    const textoSTT =
      resp?.stt?.resultado?.texto ||
      resp?.asr?.resultado?.texto ||
      resp?.transcription?.text ||
      resp?.texto ||
      "";

    const noteId = resp?.note_id;

    setOpenAudioModal(false);

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
  };

  const onGenerateNote = () => {
    if (!orgId || !selectedPatientId) return;
    const ctx = buildSessionContext();
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

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark font-display">
      <AppSidebar collapsed={sidebarCollapsed} />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-[#0f1520] shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>

            <div className="flex items-center gap-2 text-primary dark:text-white">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined">neurology</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">TerappIA</h2>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-700 dark:text-gray-200">
            <span>Notas de evolución</span>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center rounded-full h-10 px-4 bg-primary text-white font-semibold"
            >
              Regresar
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Encabezado + tarjeta doctor */}
            <div className="flex flex-col-reverse lg:flex-row gap-6 lg:items-end lg:justify-between mb-8">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-[#0d121b] dark:text-white">
                  Seleccionar paciente
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-3 py-1 text-sm font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" className="w-4 h-4">
                      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            d="M3 21h18M5 21V5.25A2.25 2.25 0 017.25 3h5.5A2.25 2.25 0 0115 5.25V21M9 21V9m4 12v-6m4 6V9" />
                    </svg>
                    Org: {orgId || "—"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 px-3 py-1 text-sm font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
                    </svg>
                    Pacientes: {patientsCount}
                  </span>
                </div>
              </div>

              <div className="w-full lg:w-auto">
                <div className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121826] px-4 py-3 shadow-sm">
                  <img src={photoURL} alt="Doctor" className="h-12 w-12 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[#0d121b] dark:text-white">
                      {doctorName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Terapeuta / Clínico</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selector de paciente */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
              <div className="flex-1 max-w-xl">
                <label htmlFor="patient-select" className="sr-only">Seleccionar paciente</label>
                <div className="relative">
                  <select
                    id="patient-select"
                    value={selectedPatientId}
                    disabled={!orgId || loadingPatients || patients.length === 0}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full h-14 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#121826] text-gray-900 dark:text-gray-100 pl-4 pr-10 text-base focus:border-primary focus:ring-primary disabled:opacity-60"
                  >
                    <option value="">
                      {loadingPatients ? "Cargando pacientes…" : patients.length === 0 ? "No hay pacientes" : "Seleccionar paciente"}
                    </option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName || p.id}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                {patientsError && <p className="mt-2 text-sm text-red-600">{patientsError}</p>}
                {!orgId && (
                  <p className="mt-2 text-sm text-amber-700">
                    ⚠️ Ve a <b>Perfil</b> y captura tu <b>Organización</b> para ver tus pacientes.
                  </p>
                )}
              </div>

              <button
                onClick={() => navigate("/register-new-patient")}
                className="inline-flex items-center justify-center h-14 rounded-lg bg-primary text-white font-semibold px-5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                        d="M18 9v6m3-3h-6M10.5 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM3 20.25a7.5 7.5 0 0112-6.364" />
                </svg>
                Registrar nuevo paciente
              </button>
            </div>

            {/* Acciones (ahora abren modales) */}
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                disabled={!canUseActions}
                onClick={() => setOpenImageModal(true)}
                className={`relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left shadow-sm transition ${
                  canUseActions ? "bg-white hover:shadow-md dark:bg-[#121826] hover:border-primary/50"
                                 : "bg-white/70 dark:bg-[#121826]/70 cursor-not-allowed opacity-70"}`}
                title={canUseActions ? "Tomar/Seleccionar imagen" : "Selecciona un paciente primero"}
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" className="w-7 h-7 text-primary">
                      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            d="M15.75 6.75h-1.5l-.41-1.23A1.5 1.5 0 0012.4 4.5h-0.8a1.5 1.5 0 00-1.44 1.02L9.75 6.75H8.25A2.25 2.25 0 006 9v7.5A2.25 2.25 0 008.25 18.75h7.5A2.25 2.25 0 0018 16.5V9a2.25 2.25 0 00-2.25-2.25zM12 10.5a3 3 0 110 6 3 3 0 010-6z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0d121b] dark:text-white">Cámara / Imagen</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Toma una foto o elige de tu galería. Extraemos texto con OCR.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={!canUseActions}
                onClick={() => setOpenAudioModal(true)}
                className={`relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left shadow-sm transition ${
                  canUseActions ? "bg-white hover:shadow-md dark:bg-[#121826] hover:border-primary/50"
                                 : "bg-white/70 dark:bg-[#121826]/70 cursor-not-allowed opacity-70"}`}
                title={canUseActions ? "Grabar/Seleccionar audio" : "Selecciona un paciente primero"}
              >
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" className="w-7 h-7 text-primary">
                      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                            d="M12 15.75a3.75 3.75 0 003.75-3.75V7.5A3.75 3.75 0 0012 3.75v0A3.75 3.75 0 008.25 7.5v4.5A3.75 3.75 0 0012 15.75zM5.25 10.5v0A6.75 6.75 0 0012 17.25v0A6.75 6.75 0 0018.75 10.5M12 17.25V21" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0d121b] dark:text-white">Audio</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Graba o sube un audio. Transcribimos y lo revisas.</p>
                  </div>
                </div>
              </button>
            </div>

            {/* CTA manual */}
            <div className="mt-12 text-center">
              <button
                onClick={onGenerateNote}
                disabled={!canGenerateNote}
                className={`inline-flex min-w-[240px] items-center justify-center rounded-full h-14 px-8 text-lg font-bold shadow-md
                  ${canGenerateNote ? "bg-primary text-white hover:shadow-lg"
                                    : "bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-300"}`}
                title={canGenerateNote ? "Crear nota sin análisis" : "Selecciona un paciente primero"}
              >
                Generar nota de evolución
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-[#0f1520] border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-sm flex flex-col sm:flex-row items-center justify-between text-gray-600 dark:text-gray-400">
            <div className="flex gap-6 mb-2 sm:mb-0">
              <a href="#" className="hover:text-primary dark:hover:text-white">Contact Us</a>
              <a href="#" className="hover:text-primary dark:hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-primary dark:hover:text-white">Terms of Service</a>
            </div>
            <p>© 2024 MentalHealthNLP. All rights reserved.</p>
          </div>
        </footer>
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
    </div>
  );
}
