// src/pages/PatientProgressNoteOverview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

import AppLayout from "../components/AppLayout";
import LoadingOverlay from "../components/LoadingOverlay";
import { BASE } from "../services/orchestrator";

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
  const [showAnalysisJSON, setShowAnalysisJSON] = useState(false);

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
        if (user?.uid && orgId && patientId && sessionId && noteId) {
          const nRef = doc(db, "orgs", orgId, "doctors", user.uid, "patients", patientId, "sessions", sessionId, "notes", noteId);
          const nSnap = await getDoc(nRef);
          if (alive) setNote(nSnap.exists() ? { id: nSnap.id, ...nSnap.data() } : null);
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

  const extractedText = useMemo(() => (state?.text || state?.texto || note?.ocr_text || "").trim(), [state?.text, state?.texto, note?.ocr_text]);

  const { emotions, entities, analysisRaw, analysisSource } = useMemo(() => {
    const rawFromState = state?.analisis ?? null;
    const rawFromFS = note?.emotions ?? null;
    const raw = rawFromState ?? rawFromFS ?? null;
    const source = rawFromState ? "state" : rawFromFS ? "firestore" : "none";
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

  async function handleGenerateNote() {
    const payload = { org_id:orgId, patient_id:patientId, session_id:sessionId, note_id:noteId, evolution_note:evolutionNote, baseline_text:extractedText, analysis:analysisRaw };
    try {
      setSaving(true);
      const idToken = await user.getIdToken(true);
      const res = await fetch(`${BASE}/generar_reporte_pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err?.detail || res.statusText); }
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `Nota_${noteId || sessionId}.pdf`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
    } catch (e) { console.error("Error generando PDF:", e); alert(`Error generando PDF: ${e.message}`); }
    finally { setSaving(false); }
  }

  const rightActions = (
    <div className="flex-row-center">
      <span className="chip">Fecha: {new Date().toLocaleDateString()}</span>
      <button onClick={() => navigate("/dashboard")} className="btn-ghost h-10">Regresar</button>
    </div>
  );

  if (err) {
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
      <LoadingOverlay open={saving} message="Generando PDF…" />

      <div className="container-pad">
        <div className="card p-6">
          {/* Contexto */}
          <div className="mb-6" style={{display:"flex", flexWrap:"wrap", gap:8, alignItems:"center"}}>
            <span className="chip chip-neutral">Fuente análisis: {analysisSource}</span>
            {!!orgId && <span className="chip chip-info">Org: {orgId}</span>}
            {!!sessionId && <span className="chip chip-info">Sesión: {sessionId}</span>}
            <span className="chip chip-success">Paciente: {patient?.fullName || patientId || "—"}</span>
            {!!noteId && <span className="chip chip-neutral">Nota: {noteId}</span>}
          </div>

          {/* Texto extraído */}
          <div className="mb-6">
            <h2 className="h3 mb-2">Texto extraído (referencia)</h2>
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
              <div className="caption text-muted">Sin datos de emociones. (Abre el JSON para revisar el formato).</div>
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

          {/* Nota de evolución */}
          <div className="mb-6">
            <h2 className="h3 mb-2">Nota de evolución (redactada por el doctor)</h2>
            <textarea
              value={evolutionNote}
              onChange={(e)=>setEvolutionNote(e.target.value)}
              placeholder="Escribe aquí tu nota clínica final…"
              className="form-control"
              style={{minHeight:180}}
            />
            <div style={{marginTop:12, display:"flex", justifyContent:"flex-end"}}>
              <button
                onClick={handleGenerateNote}
                disabled={saving || !orgId || !patientId || !sessionId}
                className={`btn-primary h-11 px-5 ${saving ? "is-disabled" : ""}`}
                title={orgId && patientId && sessionId ? "Generar PDF" : "Faltan metadatos"}
              >
                {saving ? "Generando…" : "Generar nota (PDF)"}
              </button>
            </div>
          </div>

          {/* Acciones inferiores */}
          <div style={{display:"flex", justifyContent:"center", gap:16}}>
            <button onClick={()=>navigate("/generate-progress-note")} className="btn-primary h-12 px-6">Nueva captura</button>
            <button onClick={()=>navigate("/patient-list")} className="btn-ghost h-12 px-6">Ver pacientes</button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
