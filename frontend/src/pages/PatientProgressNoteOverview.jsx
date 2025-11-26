// src/pages/PatientProgressNoteOverview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import LoadingOverlay from "../components/LoadingOverlay";
import { finalizarSesionYGenerarNota } from "../services/orchestrator";

// --------------------------- UI helpers ---------------------------
const MessageBox = ({ message, type }) => {
  const base = "p-4 rounded-xl my-4";
  const t = {
    error: "bg-red-100 border border-red-400 text-red-700",
    success: "bg-green-100 border border-green-400 text-green-700",
    info: "bg-blue-50 border border-blue-200 text-blue-700",
  };
  return <div className={`${base} ${t[type] || "bg-gray-100"}`} role="alert"><p>{message}</p></div>;
};

function readSessionCtx() {
  try { return JSON.parse(sessionStorage.getItem("currentSession") || "{}"); } catch { return {}; }
}

// Fila SOAP: label + textarea en grid
const SoapRow = ({
  shortTag,               // "S.", "O.", "A.", "P."
  longLabel,              // Texto largo (aclaración)
  name, value, onChange,
  placeholder,
  rows = 6
}) => (
  <div className="soap-row">
    <div className="soap-label">
      <div className="soap-tag">{shortTag}</div>
      <div className="soap-long">{longLabel}</div>
    </div>
    <div className="soap-field">
      <textarea
        name={name}
        rows={rows}
        className="soap-textarea"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  </div>
);

export default function PatientProgressNoteOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state } = useLocation();

  const sessionCtx = readSessionCtx();
  const orgId = state?.orgId || sessionCtx?.orgId || localStorage.getItem("orgId") || "";
  const patientId = state?.patientId || sessionCtx?.patientId || "";
  const sessionId = state?.sessionId || sessionCtx?.sessionId || "";
  const noteId = state?.noteId ?? sessionCtx?.noteId ?? null;

  const [patient, setPatient] = useState(null);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // SOAP
  const [soapForm, setSoapForm] = useState({
    subjetivo: "",
    observacion_clinica: "",
    analisis: "",
    plan: "",
  });
  const [successPdfUrl, setSuccessPdfUrl] = useState(null);

  const [showAnalysisJSON, setShowAnalysisJSON] = useState(false);
  const handleSoapChange = (e) => {
    const { name, value } = e.target;
    setSoapForm((prev) => ({ ...prev, [name]: value }));
  };

  // ---------- estilos responsivos locales ----------
  const pageCSS = `
    .page-wrap{ padding:16px; overflow-x:hidden; }
    .card-note{
      padding:20px; border-radius:16px;
      background:var(--card-bg,#fff);
      box-shadow:var(--shadow-lg,0 2px 10px rgba(0,0,0,.06));
      position:relative; overflow:hidden;
    }
    /* Asegura que TODO mida con border-box (evita 1–2px de desborde) */
    .card-note, .card-note *{ box-sizing:border-box; }

    .chips{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:12px; }
    .chip{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-size:13px; background:#f5f7fb; color:#223; }
    .chip-info{ background:#e8f1ff; color:#114; }
    .chip-success{ background:#e7f7ec; color:#123; }
    .chip-neutral{ background:#f3f4f6; color:#223; }

    .section-title{ font-weight:900; font-size:22px; margin:0 0 10px 0; }
    .section-sub{ margin-bottom:6px; color:var(--text-muted,#667085); font-size:13px; }
    .muted-box{ background:#f7f9fc; color:#475569; border:1px solid #e5e7eb; border-radius:12px; padding:14px; }

    /* --------- GRID SOAP ---------- */
    .soap-grid{
      width:100%;
      display:grid;
      grid-template-columns: 230px 1fr;
      gap:12px 18px;
      align-items:start;
    }
    .soap-row{ display:contents; }
    .soap-label{
      display:flex; align-items:center; gap:10px; padding-top:6px;
      min-width:0; /* clave para que no empuje el grid */
    }
    .soap-tag{ font-weight:900; color:#0a2a63; min-width:26px; }
    .soap-long{ color:#0a2a63; font-weight:700; line-height:1.25; }

    .soap-field{ width:100%; min-width:0; } /* <-- evita overflow horizontal */
    .soap-textarea{
      display:block;
      width:100%; max-width:100%; min-height:120px;
      resize:vertical;
      padding:12px 14px; border-radius:14px;
      border:1px solid #dbe2ee; outline:none;
      font-size:14px; line-height:1.45; background:#fff;
      box-shadow:0 1px 0 rgba(0,0,0,0.02);
      background-clip:padding-box; /* evita “sangrado” del borde en Safari */
    }
    .soap-textarea::placeholder{ color:#a0a6b1; }

    .footer-ctas{ display:flex; justify-content:center; gap:12px; margin-top:24px; flex-wrap:wrap; }

    /* --------- Tablet --------- */
    @media (max-width:1024px){
      .soap-grid{ grid-template-columns: 180px 1fr; gap:10px 14px; }
      .section-title{ font-size:20px; }
    }

    /* --------- Móvil --------- */
    @media (max-width:640px){
      .page-wrap{ padding:12px; }
      .card-note{ padding:12px; border-radius:14px; }
      .chips{ gap:6px; }
      .chip{ font-size:12px; padding:5px 8px; }

      .section-title{ font-size:18px; }
      .muted-box{ padding:10px; }

      .soap-grid{ grid-template-columns: 1fr; gap:8px; }
      .soap-label{ padding-top:2px; }
      .soap-tag{ min-width:auto; }
      .soap-long{ font-size:13px; }

      /* ↓↓↓ reduce tipografía y paddings en móvil */
      .soap-textarea{
        min-height:110px;
        font-size:12.5px; line-height:1.4;
        padding:10px 12px;
      }
    }
  `;


  // ---------- carga de datos ----------
  useEffect(() => {
    let alive = true;
    async function loadAll() {
      try {
        setLoading(true); setErr("");
        if (user?.uid && orgId && patientId) {
          const pRef = doc(db, "orgs", orgId, "doctors", user.uid, "patients", patientId);
          const pSnap = await getDoc(pRef);
          if (alive) setPatient(pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } : null);
        }
        if (user?.uid && orgId && patientId && sessionId) {
          const notesQuery = query(
            collection(db, "orgs", orgId, "doctors", user.uid, "patients", patientId, "sessions", sessionId, "notes"),
            orderBy("created_at", "desc"),
            limit(1)
          );
          const qs = await getDocs(notesQuery);
          if (alive && !qs.empty) setNote({ id: qs.docs[0].id, ...qs.docs[0].data() });
          else if (alive) setNote(null);
        }
      } catch (e) {
        console.error(e);
        if (alive) setErr("No se pudo cargar la nota/paciente.");
      } finally { if (alive) setLoading(false); }
    }
    loadAll(); return () => { alive = false; };
  }, [user?.uid, orgId, patientId, sessionId, noteId]);

  // ---------- normalización de análisis ----------
  const { emotions, analysisRaw, analysisSource } = useMemo(() => {
    const rawFromState = state?.analisis ?? null;
    const rawFromFS = note?.emotions ?? null;
    const raw = rawFromState ?? rawFromFS ?? null;
    const source = rawFromState ? "estado anterior" : rawFromFS ? "Firestore" : "ninguno";
    const resultado = raw?.resultado ?? raw ?? null;

    const pct = (v) => (v==null||isNaN(v)) ? null : (Number(v)<=1?Math.round(Number(v)*100):Math.round(Number(v)));
    let emos = [];

    if (resultado && typeof resultado === "object" && !Array.isArray(resultado)) {
      const entries = Object.entries(resultado);
      const looks = entries.every(([,v]) => v && typeof v === "object");
      if (looks) {
        emos = entries.map(([label,obj]) => ({ label, pct: pct(obj?.porcentaje) }))
                      .filter(e=>e.label);
      }
    }
    emos = emos.sort((a,b)=>(b.pct??0)-(a.pct??0));
    return { emotions: emos, analysisRaw: raw, analysisSource: source };
  }, [state?.analisis, note?.emotions]);

  const extractedText = useMemo(
    () => (state?.text || state?.texto || note?.ocr_text || "").trim(),
    [state?.text, state?.texto, note?.ocr_text]
  );

  // ---------- firmar + pdf ----------
  async function handleFinalizeAndSign() {
    if (!orgId || !patientId || !sessionId) { setErr("Faltan metadatos (Org/Paciente/Sesión) para firmar."); return; }
    if (!soapForm.subjetivo || !soapForm.observacion_clinica || !soapForm.analisis || !soapForm.plan) {
      setErr("Completa los cuatro campos del SOAP."); return;
    }
    setSaving(true); setErr(""); setSuccessPdfUrl(null);
    try {
      const pdfBlob = await finalizarSesionYGenerarNota(sessionId, orgId, patientId, {
        subjetivo: soapForm.subjetivo,
        observacion_clinica: soapForm.observacion_clinica,
        analisis: soapForm.analisis,
        plan: soapForm.plan,
      });
      const url = URL.createObjectURL(pdfBlob);
      setSuccessPdfUrl(url);
    } catch (e) {
      console.error(e);
      setErr(`Error al firmar y generar PDF: ${e.message}`);
    } finally { setSaving(false); }
  }

  const rightActions = (
    <div className="flex-row-center">
      <span className="chip">Fecha: {new Date().toLocaleDateString()}</span>
      <button onClick={() => navigate("/dashboard")} className="btn-ghost h-10">Regresar</button>
    </div>
  );

  if (err && !saving) {
    return (
      <AppLayout title="Nota del paciente" rightActions={rightActions}>
        <div className="page-wrap"><MessageBox message={err} type="error" /></div>
      </AppLayout>
    );
  }

  return (
    <>
      <style>{pageCSS}</style>

      <AppLayout title="Nota del paciente" rightActions={rightActions}>
        <LoadingOverlay open={loading} message="Cargando…" />
        <LoadingOverlay open={saving} message="Generando PDF y Firmando Nota…" />

        {err && <div className="page-wrap"><MessageBox message={err} type="error" /></div>}

        <div className="page-wrap">
          <div className="card-note">
            {/* Contexto */}
            <div className="chips">
              <span className="chip chip-neutral">Fuente análisis: {analysisSource}</span>
              {!!orgId && <span className="chip chip-info">Org: {orgId}</span>}
              {!!sessionId && <span className="chip chip-info">Sesión: {sessionId}</span>}
              <span className="chip chip-success">Paciente: {patient?.fullName || patientId || "—"}</span>
              {!!noteId && <span className="chip chip-neutral">Nota ID: {noteId}</span>}
            </div>

            {/* Texto extraído */}
            <div style={{ marginBottom: 16 }}>
              <h2 className="section-title">Texto extraído (Referencia OCR/Audio)</h2>
              <div className="muted-box" style={{ whiteSpace: "pre-wrap" }}>
                <p className="caption">{extractedText || "—"}</p>
              </div>
            </div>

            {/* Emociones */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>Emociones extraídas</h2>
                <button onClick={() => setShowAnalysisJSON(v => !v)} className="btn-ghost h-9">
                  {showAnalysisJSON ? "Ocultar JSON" : "Ver JSON"}
                </button>
              </div>

              {emotions.length === 0 ? (
                <div className="section-sub">Sin datos de emociones.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {emotions.map((e, i) => (
                    <span key={`${e.label}-${i}`} className="chip chip-info" title={e.pct != null ? `${e.pct}%` : "Sin score"}>
                      {e.label} {e.pct != null ? `${e.pct}%` : "—"}
                    </span>
                  ))}
                </div>
              )}

              {showAnalysisJSON && (
                <pre className="muted-box" style={{ marginTop: 10, overflowX: "auto", fontSize: 12, whiteSpace: "pre-wrap" }}>
{JSON.stringify(analysisRaw ?? {}, null, 2)}
                </pre>
              )}
            </div>

            {/* Éxito PDF */}
            {successPdfUrl && (
              <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-xl my-4 text-center">
                <p className="font-bold mb-3">¡Nota firmada y guardada!</p>
                <a
                  href={successPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-white bg-green-600 hover:bg-green-700 font-medium rounded-lg text-sm px-5 py-2.5 shadow-lg"
                >
                  Ver / Descargar PDF
                </a>
              </div>
            )}

            {/* ---------------- SOAP GRID ---------------- */}
            <h2 className="section-title" style={{ marginTop: 8 }}>Redacción de la Nota de Evolución (SOAP)</h2>
            <div className="soap-grid" style={{ marginTop: 8 }}>
              <SoapRow
                shortTag="S."
                longLabel="Subjetivo (Lo que el paciente Reporta)"
                name="subjetivo"
                value={soapForm.subjetivo}
                onChange={handleSoapChange}
                placeholder="El paciente refiere sentirse '...' o expresa que…"
                rows={6}
              />
              <SoapRow
                shortTag="O."
                longLabel="Objetivo (Observación y Datos IA)"
                name="observacion_clinica"
                value={soapForm.observacion_clinica}
                onChange={handleSoapChange}
                placeholder="Observación clínica del lenguaje corporal, actitud, y referencia a datos de IA (emociones, texto extraído)."
                rows={6}
              />
              <SoapRow
                shortTag="A."
                longLabel="Análisis / Evaluación (Diagnóstico y Cuadro Clínico)"
                name="analisis"
                value={soapForm.analisis}
                onChange={handleSoapChange}
                placeholder="Interpretación clínica, evolución del cuadro y justificación del tratamiento."
                rows={6}
              />
              <SoapRow
                shortTag="P."
                longLabel="Plan (Tratamiento y Próximos Pasos)"
                name="plan"
                value={soapForm.plan}
                onChange={handleSoapChange}
                placeholder="Indicaciones médicas, tareas asignadas, metas y pronóstico."
                rows={6}
              />
            </div>

            {/* Firmar */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                onClick={handleFinalizeAndSign}
                disabled={saving || !orgId || !patientId || !sessionId || !!successPdfUrl}
                className={`btn-primary h-11 px-6 font-bold text-lg ${saving ? "is-disabled" : ""}`}
                title={orgId && patientId && sessionId ? "Finalizar y firmar" : "Faltan metadatos"}
              >
                {saving ? "Firmando y Generando PDF..." : "Finalizar y Firmar Nota (PDF)"}
              </button>
            </div>

            {/* Acciones inferiores */}
            <div className="footer-ctas">
              <button onClick={() => navigate("/generate-progress-note")} className="btn-primary h-12 px-6">Nueva captura</button>
              <button onClick={() => navigate("/patient-list")} className="btn-ghost h-12 px-6">Ver pacientes</button>
            </div>
          </div>
        </div>
      </AppLayout>
    </>
  );
}
