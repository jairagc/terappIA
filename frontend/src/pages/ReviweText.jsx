// src/pages/ReviewText.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { saveFinalNote } from "../services/orchestrator";

export default function ReviewText() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();

  // Texto inicial robusto (photo/audio y compat viejo)
  const startingText = useMemo(() => {
    return (
      state?.initialText ??
      state?.textoInicial ??
      state?.ocr?.resultado?.texto ??
      state?.transcripcion?.resultado?.texto ??
      ""
    );
  }, [state]);

  const [text, setText] = useState(startingText);
  const [busy, setBusy] = useState(false);
  const [showJSON, setShowJSON] = useState(false);

  const meta = {
    source: state?.source || "photo",
    orgId: state?.orgId,
    patientId: state?.patientId,
    sessionId: state?.sessionId,
    noteId: state?.noteId,
  };

  const canSave =
    !!meta.orgId &&
    !!meta.patientId &&
    !!meta.sessionId &&
    !!meta.noteId &&
    !!text.trim();

  async function onConfirmAndSave() {
    if (!canSave) {
      alert("Faltan datos (org/paciente/sesión/nota) o el texto está vacío.");
      return;
    }
    try {
      setBusy(true);
      const idToken = await user.getIdToken(true);
      const resp = await saveFinalNote({
        idToken,
        org_id: meta.orgId,
        patient_id: meta.patientId,
        session_id: meta.sessionId,
        note_id: meta.noteId,
        texto: text,
      });
      navigate("/patient-progress-note-overview", {
        state: {
          orgId: meta.orgId,
          patientId: meta.patientId,
          sessionId: meta.sessionId,
          noteId: meta.noteId,
          analisis: resp?.analisis ?? null,
          text, // para mostrar como referencia
        },
      });
    } catch (e) {
      alert(`Error guardando/analizando: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const debugJson = useMemo(
    () => ({
      ...meta,
      initialText: state?.initialText ?? null,
      textoInicial: state?.textoInicial ?? null,
      ocr: state?.ocr ?? null,
      transcripcion: state?.transcripcion ?? null,
      analisis: state?.analisis ?? null,
      raw: state ?? null,
    }),
    [meta, state]
  );

  const words = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background-light dark:bg-background-dark font-display text-[#0d121b] dark:text-white">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-[#0f1520] shadow-sm">
        <div className="flex items-center gap-2 text-primary dark:text-white">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined">neurology</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">TerappIA</h2>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-sm">
          <span className="text-gray-700 dark:text-gray-300">Revisión de texto</span>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center rounded-full h-10 px-4 bg-primary text-white font-semibold"
          >
            Regresar
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Título + chips */}
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight">
              Revisar texto extraído
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-3 py-1 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V5.25A2.25 2.25 0 017.25 3h5.5A2.25 2.25 0 0115 5.25V21M9 21V9m4 12v-6m4 6V9"/>
                </svg>
                Org: {meta.orgId || "—"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 px-3 py-1 text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0"/>
                </svg>
                Paciente: {meta.patientId || "—"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-3 py-1 text-sm font-medium">
                Sesión: {meta.sessionId || "—"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-3 py-1 text-sm font-medium">
                Nota: {meta.noteId || "—"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 px-3 py-1 text-sm font-medium">
                Fuente: {meta.source}
              </span>
            </div>
          </div>

          {/* Editor */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#121826] shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1">
                  <span className="material-symbols-outlined text-base">description</span>
                  <b>{words}</b> palabras
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  {new Date().toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setText((t) => t.trim())}
                  className="rounded-lg px-3 py-2 text-sm border hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Limpiar espacios
                </button>
                <button
                  type="button"
                  onClick={() => setShowJSON((v) => !v)}
                  className="rounded-lg px-3 py-2 text-sm border hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {showJSON ? "Ocultar análisis (JSON)" : "Ver análisis (JSON)"}
                </button>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Aquí verás el texto extraído para corregir/confirmar…"
              className="w-full min-h-[320px] bg-transparent px-4 py-4 outline-none resize-y text-[15px] leading-6"
            />
          </div>

          {/* Acciones */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              onClick={onConfirmAndSave}
              disabled={!canSave || busy}
              className={`inline-flex items-center justify-center rounded-full h-12 px-6 text-base font-bold shadow-md
                ${canSave && !busy
                  ? "bg-primary text-white hover:shadow-lg"
                  : "bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-300"}`}
              title={canSave ? "Guardar y analizar" : "Completa datos y texto"}
            >
              {busy ? "Guardando…" : "Confirmar y guardar (analizar)"}
            </button>

            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center rounded-full h-12 px-6 border text-base font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Regresar
            </button>
          </div>

          {/* JSON Debug */}
          {showJSON && (
            <pre className="mt-5 bg-gray-100 dark:bg-gray-800 rounded-xl p-4 whitespace-pre-wrap text-xs overflow-x-auto">
{JSON.stringify(debugJson, null, 2)}
            </pre>
          )}
        </div>
      </main>
    </div>
  );
}
