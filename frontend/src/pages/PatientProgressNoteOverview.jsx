// src/pages/PatientProgressNoteOverview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import LoadingOverlay from "../components/LoadingOverlay";
import { BASE, finalizarSesionYGenerarNota } from "../services/orchestrator";

// Componente para manejar los campos SOAP
const SoapTextarea = ({ label, id, value, onChange, placeholder = "Escribe aquí la nota..." }) => (
  <div className="mb-6">
    <label htmlFor={id} className="h4 block mb-2 font-semibold">
      {label}
    </label>
    <textarea
      id={id}
      name={id}
      rows={4}
      className="form-control w-full p-3 border border-gray-300 rounded-xl shadow-sm"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{minHeight:100}}
    />
  </div>
);

// Componente para mostrar mensajes (reemplaza alert)
const MessageBox = ({ message, type }) => {
  const baseClasses = "p-4 rounded-xl my-4";
  const typeClasses = {
    error: "bg-red-100 border border-red-400 text-red-700",
    success: "bg-green-100 border border-green-400 text-green-700",
  };
  return (
    <div className={`${baseClasses} ${typeClasses[type] || 'bg-gray-100'}`} role="alert">
      <p>{message}</p>
    </div>
  );
};


function readSessionCtx() {
  try { return JSON.parse(sessionStorage.getItem("currentSession") || "{}"); } catch { return {}; }
}

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
  const [evolutionNote, setEvolutionNote] = useState("");
  
  // --- ESTADO LOCAL PARA LOS CAMPOS SOAP ---
  const [soapForm, setSoapForm] = useState({
    subjetivo: '',
    observacion_clinica: '', // Añadido
    analisis: '',           // Añadido
    plan: '',               // Añadido
  });
  const [successPdfUrl, setSuccessPdfUrl] = useState(null);
  // --- FIN ESTADO SOAP ---
  const [showAnalysisJSON, setShowAnalysisJSON] = useState(false);
  const handleSoapChange = (e) => {
    const { name, value } = e.target;
    setSoapForm(prev => ({ ...prev, [name]: value }));
  };


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
        
        // Carga la última nota de IA para referencia
        if (user?.uid && orgId && patientId && sessionId) {
          const notesQuery = query(
            collection(db, 'orgs', orgId, 'doctors', user.uid, 'patients', patientId, 'sessions', sessionId, 'notes'),
            orderBy('created_at', 'desc'),
            limit(1)
          );

          const querySnapshot = await getDocs(notesQuery);
          if (alive && !querySnapshot.empty) {
            setNote({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
          } else {
             // Si noteId existe pero no hay nota, se usará la que está en el estado de location
             setNote(null);
          }
        }
      } catch (e) {
        console.error(e);
        if (alive) setErr("No se pudo cargar la nota/paciente.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadAll(); return () => { alive = false; };
  }, [user?.uid, orgId, patientId, sessionId, noteId]);

  const { emotions, entities, analysisRaw, analysisSource } = useMemo(() => {
    const rawFromState = state?.analisis ?? null;
    const rawFromFS = note?.emotions ?? null;
    const raw = rawFromState ?? rawFromFS ?? null;
    const source = rawFromState ? "estado anterior" : rawFromFS ? "Firestore" : "ninguno";
    const resultado = raw?.resultado ?? raw ?? null;
    const normPct = (v) => (v==null||isNaN(v)) ? null : (Number(v)<=1?Math.round(Number(v)*100):Math.round(Number(v)));
    let emos = [], ents = [];
    if (resultado && typeof resultado === "object" && !Array.isArray(resultado)) {
      const entries = Object.entries(resultado);
      const looks = entries.every(([,v]) => v && typeof v === "object" && ("porcentaje" in v || "entidades" in v));
      if (looks) {
        emos = entries.map(([label,obj])=>({label, pct:normPct(obj?.porcentaje), ents:Array.isArray(obj?.entidades)?obj.entidades:[]}));
        ents = emos.flatMap(e => (e.ents||[]).map(t => ({ text:t, type:e.label, pct:e.pct })));
      }
    }
    if (emos.length===0 && resultado) {
      if (Array.isArray(resultado)) {
        emos = resultado.map(x=>({label:String(x.label??x.emotion??x.nombre??""), pct:normPct(x.score??x.valor??x.pct), ents:Array.isArray(x.entidades)?x.entidades:[]}))
                       .filter(e=>e.label);
      } else if (resultado.emociones) {
        if (Array.isArray(resultado.emociones)) {
          emos = resultado.emociones.map(x=>({label:String(x.label??x.emotion??x.nombre??""), pct:normPct(x.score??x.valor??x.pct), ents:Array.isArray(x.entidades)?x.entidades:[]}))
                                 .filter(e=>e.label);
        } else if (typeof resultado.emociones==="object") {
          emos = Object.entries(resultado.emociones).map(([k,v])=>({label:String(k), pct:normPct(v), ents:[]}));
        }
      }
      const srcEnt = resultado.entidades ?? resultado.entities ?? resultado.ents ?? resultado.keywords ?? null;
      if (srcEnt) {
        if (Array.isArray(srcEnt)) {
          ents = srcEnt.map(e => typeof e==="string" ? ({text:e,type:null,pct:null}) :
            ({ text:String(e.texto??e.text??e.keyword??""), type:e.tipo??e.type??null, pct:normPct(e.score??e.confidence??e.pct)}));
        } else if (typeof srcEnt==="object") {
          ents = Object.entries(srcEnt).map(([k,v])=>({text:String(k), type:null, pct:normPct(v)}));
        }
      }
    }
    emos = emos.filter(e=>e.label).sort((a,b)=>(b.pct??0)-(a.pct??0));
    return { emotions: emos, entities: ents, analysisRaw: raw, analysisSource: source };
  }, [state?.analisis, note?.emotions]);
  
  const extractedText = useMemo(() => (state?.text || state?.texto || note?.ocr_text || "").trim(), [state?.text, state?.texto, note?.ocr_text]);


  // --- NUEVA FUNCIÓN PARA GENERAR Y FIRMAR EL PDF (REEMPLAZA handleGenerateNote) ---
  async function handleFinalizeAndSign() {
    // 1. Validación
    if (!orgId || !patientId || !sessionId) {
      setErr("Faltan metadatos (Org/Paciente/Sesión) para firmar.");
      return;
    }
    if (!soapForm.subjetivo || !soapForm.observacion_clinica || !soapForm.analisis || !soapForm.plan) {
      setErr("Por favor, completa los cuatro campos obligatorios del SOAP.");
      return;
    }

    setSaving(true);
    setErr("");
    setSuccessPdfUrl(null); // Limpiar URL anterior

    try {
        // El payload SOAP que necesita el backend
        const soapInput = {
            subjetivo: soapForm.subjetivo,
            observacion_clinica: soapForm.observacion_clinica,
            analisis: soapForm.analisis,
            plan: soapForm.plan,
        };

        // Llama al nuevo endpoint /sesion/finalizar_y_firmar/{sessionId}
        const pdfBlob = await finalizarSesionYGenerarNota(
            sessionId,
            orgId,
            patientId,
            soapInput
        );

        // Abre el PDF en una nueva pestaña (como lo hacía tu función anterior)
        const url = URL.createObjectURL(pdfBlob);
        setSuccessPdfUrl(url); // Guarda la URL para mostrar el enlace de éxito.
        
        // Se puede hacer la descarga directa, pero mostrar la URL de éxito es más limpio
        /*
        const a = document.createElement("a");
        a.href = url;
        a.download = `Nota_Evolucion_${sessionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        */

    } catch (e) { 
        console.error("Error al finalizar/firmar PDF:", e); 
        setErr(`Error al firmar y generar PDF: ${e.message}`); 
    } finally { 
        setSaving(false); 
    }
  }

  // --- FUNCIÓN ANTIGUA ELIMINADA ---
  /*
  async function handleGenerateNote() {
    // ESTA FUNCIÓN HA SIDO REEMPLAZADA POR handleFinalizeAndSign
    // ...
  }
  */

  const rightActions = (
    <div className="flex-row-center">
      <span className="chip">Fecha: {new Date().toLocaleDateString()}</span>
      <button onClick={() => navigate("/dashboard")} className="btn-ghost h-10">Regresar</button>
    </div>
  );

  if (err && !saving) { // Muestra errores si no está guardando
    return (
      <AppLayout title="Nota del paciente" rightActions={rightActions}>
        <div className="container-pad">
          <div className="alert alert-error">{err}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Nota del paciente" rightActions={rightActions}>
      <LoadingOverlay open={loading} message="Cargando…" />
      <LoadingOverlay open={saving} message="Generando PDF y Firmando Nota…" />
      
      {err && <MessageBox message={err} type="error" />} {/* Muestra errores */}

      <div className="container-pad">
        <div className="card p-6">
          {/* Contexto */}
          <div className="mb-6" style={{display:"flex", flexWrap:"wrap", gap:8, alignItems:"center"}}>
            <span className="chip chip-neutral">Fuente análisis: {analysisSource}</span>
            {!!orgId && <span className="chip chip-info">Org: {orgId}</span>}
            {!!sessionId && <span className="chip chip-info">Sesión: {sessionId}</span>}
            <span className="chip chip-success">Paciente: {patient?.fullName || patientId || "—"}</span>
            {!!noteId && <span className="chip chip-neutral">Nota ID: {noteId}</span>}
          </div>

          {/* Texto extraído (referencia) */}
          <div className="mb-6">
            <h2 className="h3 mb-2">Texto extraído (Referencia OCR/Audio)</h2>
            <div className="app-muted rounded-xl p-6">
              <p className="caption text-muted" style={{whiteSpace:"pre-wrap"}}>{extractedText || "—"}</p>
            </div>
          </div>

          {/* Emociones + JSON */}
          <div className="mb-6">
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:8}}>
              <h2 className="h3">Emociones extraídas</h2>
              <button onClick={()=>setShowAnalysisJSON(v=>!v)} className="btn-ghost h-9">
                {showAnalysisJSON ? "Ocultar análisis (JSON)" : "Ver análisis (JSON)"}
              </button>
            </div>

            {emotions.length === 0 ? (
              <div className="caption text-muted">Sin datos de emociones.</div>
            ) : (
              <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
                {emotions.map((e,i)=>(
                  <span key={`${e.label}-${i}`} className="chip chip-brand" title={e.pct!=null?`${e.pct}%`:"Sin score"}>
                    {e.label} {e.pct!=null?`${e.pct}%`:"—"}
                  </span>
                ))}
              </div>
            )}

            {showAnalysisJSON && (
              <pre className="mt-4 app-muted rounded-xl p-3 text-xs overflow-x-auto" style={{whiteSpace:"pre-wrap"}}>
{JSON.stringify(analysisRaw ?? {}, null, 2)}
              </pre>
            )}
          </div>

          {/* MENSAJE DE ÉXITO Y LINK A PDF */}
          {successPdfUrl && (
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-xl my-6 text-center">
              <p className="font-bold mb-3">¡Nota Firmada! El proceso de guardado en GCS y Firestore ha finalizado.</p>
              <a 
                href={successPdfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 inline-block text-white bg-green-600 hover:bg-green-700 font-medium rounded-lg text-sm px-5 py-2.5 shadow-lg"
              >
                Ver/Descargar PDF
              </a>
            </div>
          )}

          {/* FORMULARIO SOAP */}
          <div className="mb-6">
            <h2 className="h2 mb-4">Redacción de la Nota de Evolución (SOAP)</h2>

            <SoapTextarea
              label="S. Subjetivo (Lo que el paciente Reporta)"
              id="subjetivo"
              name="subjetivo"
              value={soapForm.subjetivo}
              onChange={handleSoapChange}
              placeholder="El paciente refiere sentirse '...' o expresa que..."
            />
            
            <SoapTextarea
              label="O. Objetivo (Observación y Datos IA)"
              id="observacion_clinica"
              name="observacion_clinica"
              value={soapForm.observacion_clinica}
              onChange={handleSoapChange}
              placeholder="Observación clínica del lenguaje corporal, actitud y referencia a los datos de IA (emociones, texto extraído)."
            />
            
            <SoapTextarea
              label="A. Análisis / Evaluación (Diagnóstico y Cuadro Clínico)"
              id="analisis"
              name="analisis"
              value={soapForm.analisis}
              onChange={handleSoapChange}
              placeholder="Interpretación clínica, evolución del cuadro y justificación del tratamiento."
            />
            
            <SoapTextarea
              label="P. Plan (Tratamiento y Próximos Pasos)"
              id="plan"
              name="plan"
              value={soapForm.plan}
              onChange={handleSoapChange}
              placeholder="Indicaciones médicas, tareas asignadas, metas y pronóstico."
            />
            
            {/* BOTÓN DE FIRMA */}
            <div style={{marginTop:24, display:"flex", justifyContent:"flex-end"}}>
              <button
                onClick={handleFinalizeAndSign}
                disabled={saving || !orgId || !patientId || !sessionId || !!successPdfUrl}
                className={`btn-primary h-11 px-6 font-bold text-lg ${saving ? "is-disabled" : ""}`}
                title={orgId && patientId && sessionId ? "Finalizar y firmar" : "Faltan metadatos"}
              >
                {saving ? "Firmando y Generando PDF..." : "Finalizar y Firmar Nota (PDF)"}
              </button>
            </div>
          </div>

          {/* Acciones inferiores */}
          <div style={{display:"flex", justifyContent:"center", gap:16, marginTop:32}}>
            <button onClick={()=>navigate("/generate-progress-note")} className="btn-primary h-12 px-6">Nueva captura</button>
            <button onClick={()=>navigate("/patient-list")} className="btn-ghost h-12 px-6">Ver pacientes</button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}