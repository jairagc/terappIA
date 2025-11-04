// src/pages/PatientProgressNoteOverview.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import AppSidebar from "../components/AppSidebar";

// Fallback desde sessionStorage cuando no llega por state
function readSessionCtx() {
  try {
    return JSON.parse(sessionStorage.getItem("currentSession") || "{}");
  } catch {
    return {};
  }
}

export default function PatientProgressNoteOverview() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { state } = useLocation();

  const sessionCtx = readSessionCtx();

  // Meta del flujo (ahora tolerante a faltantes)
  const orgId =
    state?.orgId || sessionCtx?.orgId || localStorage.getItem("orgId") || "";
  const patientId = state?.patientId || sessionCtx?.patientId || "";
  const sessionId = state?.sessionId || sessionCtx?.sessionId || "";
  const noteId = state?.noteId ?? sessionCtx?.noteId ?? null; // <- puede ser null

  // UI
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Datos Firestore
  const [patient, setPatient] = useState(null);
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Nota de evolución (la redacta el médico)
  const [evolutionNote, setEvolutionNote] = useState("");

  // Toggle JSON análisis
  const [showAnalysisJSON, setShowAnalysisJSON] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      try {
        setLoading(true);
        setErr("");

        // Paciente (si tenemos orgId/uid/patientId)
        if (user?.uid && orgId && patientId) {
          const pRef = doc(db, "orgs", orgId, "doctors", user.uid, "patients", patientId);
          const pSnap = await getDoc(pRef);
          if (alive) setPatient(pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } : null);
        }

        // Nota (solo si tenemos TODOS los ids)
        if (user?.uid && orgId && patientId && sessionId && noteId) {
          const nRef = doc(
            db,
            "orgs", orgId,
            "doctors", user.uid,
            "patients", patientId,
            "sessions", sessionId,
            "notes", noteId
          );
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
    loadAll();
    return () => { alive = false; };
  }, [user?.uid, orgId, patientId, sessionId, noteId]);

  // Texto extraído (referencia; no prellena la nota clínica)
  const extractedText = useMemo(() => {
    return (
      state?.text ||
      state?.texto ||
      note?.ocr_text ||
      "" // manual
    ).trim();
  }, [state?.text, state?.texto, note?.ocr_text]);

  /** ---------- Normalización robusta de emociones/entidades ---------- **/
  const {
    emotions,
    entities,
    analysisRaw,
    analysisSource, // "state" | "firestore" | "none"
  } = useMemo(() => {
    const rawFromState = state?.analisis ?? null;
    const rawFromFS = note?.emotions ?? null;
    const raw = rawFromState ?? rawFromFS ?? null;
    const source = rawFromState ? "state" : rawFromFS ? "firestore" : "none";
    const resultado = raw?.resultado ?? raw ?? null;

    const normPct = (v) => {
      if (v == null || isNaN(v)) return null;
      const n = Number(v);
      return n <= 1 ? Math.round(n * 100) : Math.round(n);
    };

    let emos = [];
    let ents = [];

    if (resultado && typeof resultado === "object" && !Array.isArray(resultado)) {
      // Formato: { alegria:{porcentaje, entidades:[]}, ... }
      const entries = Object.entries(resultado);
      const looks = entries.every(
        ([, v]) => v && typeof v === "object" && ("porcentaje" in v || "entidades" in v)
      );
      if (looks) {
        emos = entries.map(([label, obj]) => ({
          label,
          pct: normPct(obj?.porcentaje),
          ents: Array.isArray(obj?.entidades) ? obj.entidades : [],
        }));
        ents = emos.flatMap((e) => (e.ents || []).map((t) => ({ text: t, type: e.label, pct: e.pct })));
      }
    }

    if (emos.length === 0 && resultado) {
      if (Array.isArray(resultado)) {
        emos = resultado
          .map((x) => ({
            label: String(x.label ?? x.emotion ?? x.nombre ?? ""),
            pct: normPct(x.score ?? x.valor ?? x.pct),
            ents: Array.isArray(x.entidades) ? x.entidades : [],
          }))
          .filter((e) => e.label);
      } else if (resultado.emociones) {
        if (Array.isArray(resultado.emociones)) {
          emos = resultado.emociones
            .map((x) => ({
              label: String(x.label ?? x.emotion ?? x.nombre ?? ""),
              pct: normPct(x.score ?? x.valor ?? x.pct),
              ents: Array.isArray(x.entidades) ? x.entidades : [],
            }))
            .filter((e) => e.label);
        } else if (typeof resultado.emociones === "object") {
          emos = Object.entries(resultado.emociones).map(([k, v]) => ({
            label: String(k),
            pct: normPct(v),
            ents: [],
          }));
        }
      }
      const srcEnt =
        resultado.entidades ?? resultado.entities ?? resultado.ents ?? resultado.keywords ?? null;
      if (srcEnt) {
        if (Array.isArray(srcEnt)) {
          ents = srcEnt.map((e) =>
            typeof e === "string" ? { text: e, type: null, pct: null } : {
              text: String(e.texto ?? e.text ?? e.keyword ?? ""),
              type: e.tipo ?? e.type ?? null,
              pct: normPct(e.score ?? e.confidence ?? e.pct),
            }
          );
        } else if (typeof srcEnt === "object") {
          ents = Object.entries(srcEnt).map(([k, v]) => ({
            text: String(k),
            type: null,
            pct: normPct(v),
          }));
        }
      }
    }

    emos = emos.filter((e) => e.label).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
    return { emotions: emos, entities: ents, analysisRaw: raw, analysisSource: source };
  }, [state?.analisis, note?.emotions]);

  const handleLogout = async () => {
    try { await logout(); navigate("/login", { replace: true }); } catch {}
  };

  async function handleGenerateNote() {
    const payload = {
      org_id: orgId,
      doctor_uid: user?.uid,
      patient_id: patientId,
      session_id: sessionId,
      note_id: noteId,          // puede ser null por ahora
      evolution_note: evolutionNote,
      baseline_text: extractedText,
      analysis: analysisRaw,
    };
    console.log("[GENERAR NOTA] payload:", payload);
    alert("Generar nota: aún sin endpoint. Payload en consola.");
  }

  if (loading) return <div className="p-8">Cargando…</div>;
  if (err) return <div className="p-8 text-red-600">{err}</div>;

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark font-display text-[#0d121b] dark:text-white">
      {/* Sidebar con tu estilo */}
      <AppSidebar collapsed={sidebarCollapsed} />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col">
        {/* Header con botón para retraer la barra (mismo patrón que GenerateProgressNote) */}
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
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Nota del paciente</h1>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-700 dark:text-gray-200">
            <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-3 py-1 rounded-full">
              Paciente: {patient?.fullName || patientId || "—"}
            </span>
            <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-3 py-1 rounded-full">
              Fecha: {new Date().toLocaleDateString()}
            </span>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center rounded-full h-10 px-4 bg-primary text-white font-semibold"
            >
              Regresar
            </button>
          </div>
        </header>

        {/* Main (mantiene tus colores/estructura) */}
        <main className="flex-1 p-6">
          <div className="bg-white dark:bg-background-dark/50 rounded-xl shadow-sm p-6">
            {/* Chips secundarios (incluye fuente del análisis) */}
            <div className="flex flex-wrap gap-2 mb-6 items-center">
              <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded">
                fuente análisis: {analysisSource}
              </span>
              {orgId && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                  Org: {orgId}
                </span>
              )}
              {sessionId && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                  Sesión: {sessionId}
                </span>
              )}
            </div>

            {/* Texto extraído (referencia) */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Texto extraído (referencia)</h2>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-inner">
                <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                  {extractedText || "—"}
                </p>
              </div>
            </div>

            {/* Emociones + botón ver JSON */}
            <div className="mb-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-lg font-semibold">Emociones extraídas</h2>
                <button
                  onClick={() => setShowAnalysisJSON((v) => !v)}
                  className="px-3 py-1.5 rounded border text-sm"
                >
                  {showAnalysisJSON ? "Ocultar análisis (JSON)" : "Ver análisis (JSON)"}
                </button>
              </div>

              {emotions.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Sin datos de emociones. (Abre el JSON para revisar el formato).
                </div>
              ) : (
                <div className="space-y-2">
                  {emotions.map((e, i) => {
                    const palette = [
                      "bg-yellow-100 text-yellow-800",
                      "bg-blue-100 text-blue-800",
                      "bg-rose-100 text-rose-800",
                      "bg-emerald-100 text-emerald-800",
                      "bg-purple-100 text-purple-800",
                      "bg-teal-100 text-teal-800",
                    ];
                    const cls = palette[i % palette.length];
                    return (
                      <div key={`${e.label}-${i}`}>
                        <span
                          className={`inline-block ${cls} text-xs font-semibold px-2.5 py-1 rounded-full`}
                          title={e.pct != null ? `${e.pct}%` : "Sin score"}
                        >
                          {e.label} {e.pct != null ? `${e.pct}%` : "—"}
                        </span>
                        {e.ents && e.ents.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 pl-1">
                            {e.ents.map((t, j) => (
                              <span
                                key={`${e.label}-ent-${j}`}
                                className="inline-block bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-[11px] font-medium px-2 py-[2px] rounded"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {showAnalysisJSON && (
                <pre className="mt-4 bg-gray-100 dark:bg-gray-800 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(analysisRaw ?? {}, null, 2)}
                </pre>
              )}
            </div>

            {/* Nota de evolución (redacta el doctor) */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-2">Nota de evolución (redactada por el doctor)</h2>
              <textarea
                value={evolutionNote}
                onChange={(e) => setEvolutionNote(e.target.value)}
                placeholder="Escribe aquí tu nota clínica final…"
                className="w-full min-h-[180px] rounded-lg border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark p-4"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleGenerateNote}
                  className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold"
                >
                  Generar nota
                </button>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => navigate("/generate-progress-note")}
                className="flex min-w-[160px] items-center justify-center rounded-lg h-12 px-6 bg-primary text-white text-base font-bold"
              >
                Nueva captura
              </button>
              <button
                onClick={() => navigate("/patient-list")}
                className="flex min-w-[160px] items-center justify-center rounded-lg h-12 px-6 bg-gray-200 dark:bg-gray-700 text-base font-bold"
              >
                Ver pacientes
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
