import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { saveFinalNote } from "../services/orchestrator";

import AppLayout from "../components/AppLayout";
import LoadingOverlay from "../components/LoadingOverlay";

export default function ReviewText() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();

  const startingText = useMemo(
    () =>
      state?.initialText ??
      state?.textoInicial ??
      state?.ocr?.resultado?.texto ??
      state?.transcripcion?.resultado?.texto ??
      "",
    [state]
  );

  const [text, setText] = useState(startingText);
  const [busy, setBusy] = useState(false);
  const [showJSON, setShowJSON] = useState(false);

  const meta = {
    source: state?.source || "photo",
    orgId: state?.orgId || "",
    patientId: state?.patientId || "",
    sessionId: state?.sessionId || "",
    noteId: state?.noteId || "",
  };

  const canSave =
    meta.orgId &&
    meta.patientId &&
    meta.sessionId &&
    meta.noteId &&
    text.trim().length > 0;

  async function onConfirmAndSave() {
    if (!canSave) {
      alert(
        "Faltan datos (org/paciente/sesión/nota) o el texto está vacío."
      );
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
          text,
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

  const rightActions = (
    <div className="flex-row-center">
      <span className="caption text-muted">Revisión de texto</span>
      <button onClick={() => navigate(-1)} className="btn ghost h-10">
        Regresar
      </button>
    </div>
  );

  return (
    <AppLayout title="Revisar texto extraído" rightActions={rightActions}>
      <LoadingOverlay open={busy} message="Guardando…" />

      <div className="container-pad">
        <div className="maxw-5xl">
          {/* Encabezado */}
          <h1 className="h1 h1-tight">Revisar texto extraído</h1>

          {/* Chips compactos */}
          <div className="chips-row">
            <span className="chip chip-info chip-sm">
              <span className="material-symbols-outlined">business</span>
              <span className="label">Org:&nbsp;</span>
              <span className="value trunc">{meta.orgId || "—"}</span>
            </span>

            <span className="chip chip-green chip-sm">
              <span className="material-symbols-outlined">person</span>
              <span className="label">Paciente:&nbsp;</span>
              <span className="value trunc">{meta.patientId || "—"}</span>
            </span>

            <span className="chip chip-lilac chip-sm">
              <span className="material-symbols-outlined">photo_camera</span>
              <span className="label">Fuente:&nbsp;</span>
              <span className="value">{meta.source}</span>
            </span>

            <span className="chip chip-soft chip-sm">
              <span className="material-symbols-outlined">link</span>
              <span className="label">Sesión:&nbsp;</span>
              <span className="value trunc">{meta.sessionId || "—"}</span>
            </span>

            <span className="chip chip-id chip-sm">
              <span className="material-symbols-outlined">fingerprint</span>
              <span className="label">Nota:&nbsp;</span>
              <span className="value trunc">{meta.noteId || "—"}</span>
            </span>
          </div>

          {/* Card con toolbar */}
          <div className="card mt-4">
            <div className="review-toolbar review-toolbar-sm">
              <div className="review-toolbar-left">
                <span className="pill pill-ghost pill-sm">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                  >
                    description
                  </span>
                  <b>{words}</b>&nbsp;palabras
                </span>
                <span className="dot-sep">•</span>
                <span className="text-muted ts-sm">
                  {new Date().toLocaleString()}
                </span>
              </div>

              <div className="flex-row-center">
                <button
                  type="button"
                  onClick={() => setShowJSON((v) => !v)}
                  className="btn ghost h-9"
                >
                  {showJSON
                    ? "Ocultar análisis (JSON)"
                    : "Ver análisis (JSON)"}
                </button>
              </div>
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Aquí verás el texto extraído para corregir o confirmar…"
              className="textarea note-area"
            />
          </div>

          {/* Botones inferiores */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onConfirmAndSave}
              disabled={!canSave || busy}
              className={`btn primary h-12 px-6 ${
                !canSave || busy ? "is-disabled" : ""
              }`}
            >
              {busy ? "Guardando…" : "Confirmar y guardar (analizar)"}
            </button>

            <button onClick={() => navigate(-1)} className="btn ghost h-12 px-6">
              Regresar
            </button>
          </div>

          {/* JSON debug */}
          {showJSON && (
            <pre
              className="mt-6 app-muted rounded-xl p-4 text-xs"
              style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}
            >
              {JSON.stringify(debugJson, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

