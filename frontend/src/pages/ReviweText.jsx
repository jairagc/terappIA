// src/pages/ReviewText.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { saveFinalNote } from "../services/orchestrator";

import AppLayout from "../components/AppLayout";
import LoadingOverlay from "../components/LoadingOverlay";

const pageCSS = `
  .review-root {
    padding: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  .maxw-7xl {
    max-width: 1120px;
    margin: 0 auto;
  }

  .review-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid var(--line-soft, #e6ebf3);
    box-shadow: 0 2px 10px rgba(0,0,0,.04);
    padding: 16px 18px;
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: stretch; /* <- textarea se estira a todo el ancho */
    margin:20px 0px 20px 0px;
  }

  .review-title {
    font-size: 24px;
    font-weight: 800;
    margin: 0 0 10px;
  }

  .chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .chip-sm {
    font-size: 11px;
    padding: 4px 8px;
  }

  .chip-sm .material-symbols-outlined {
    font-size: 16px;
  }

  .review-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 0 10px;
    border-bottom: 1px dashed rgba(0,0,0,.06);
  }

  .review-toolbar-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    min-width: 0;
  }

  .ts-sm {
    font-size: 12px;
  }

  .dot-sep {
    color: rgba(0,0,0,.35);
  }

  .pill-sm {
    font-size: 11px;
    padding-inline: 8px;
    height: 26px;
  }

  .note-area {
    width: 100%px;
    max-width: 100%;           /* <- quita el límite de ancho */
    box-sizing: border-box;
    border-radius: 12px;
    border: 1px solid var(--line-soft, #e6ebf3);
    padding: 10px 12px;
    min-height: 220px;
    resize: vertical;
    font-size: 14px;
    line-height: 1.45;
    margin: 12px 30px 10px 0px;        /* <- nada de margin auto */
    text-align: left;
  }

  .note-area:focus {
    outline: 2px solid var(--accent-blue, #2156e6);
    outline-offset: 1px;
  }
  @media (max-width: 640px) {
    .review-root {
      padding: 12px;
    }

    .review-title {
      font-size: 18px;
      margin-bottom: 8px;
    }

    .chips-row {
      gap: 4px;
    }

    .chip-sm {
      font-size: 10px;
      padding: 3px 6px;
    }

    .review-card {
      padding: 12px 12px 14px 14px;
      border-radius: 14px;
      margin:12px 0px 14px 0px;
    }

    .review-toolbar {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .review-toolbar-left {
      font-size: 12px;
    }

    .note-area {
      min-height: 180px;
      min-width: 100%;
      font-size: 13px;
    }

    .review-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .review-actions .btn {
      width: 100%;
      justify-content: center;
      align-items: center;
      height: 44px;
      font-size: 14px;
      
      margin-bottom:13px;
    }

    .review-json {
      font-size: 1px;
      padding: 5px 10px;
    }
  }

`;


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
      <span className="caption text-muted hidden sm:inline">
        Revisión de texto
      </span>
      <button onClick={() => navigate(-1)} className="btn ghost h-10">
        Regresar
      </button>
    </div>
  );

  return (
    <AppLayout title="Revisar texto extraído" rightActions={rightActions}>
      <style>{pageCSS}</style>
      <LoadingOverlay open={busy} message="Guardando…" />

      <div className="review-root maxw-7xl">
        <h1 className="review-title">Revisar texto extraído</h1>

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

        {/* Card principal */}
        <div className="review-card">
          <div className="review-toolbar">
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
                className="btn ghost text-xs sm:ts-sm"
                style={{ fontSize: 11 }}
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
        <div className="mt-6 flex flex-wrap gap-3 review-actions">
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
            className="mt-6 app-muted rounded-xl p-4 text-xs review-json"
            style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}
          >
            {JSON.stringify(debugJson, null, 2)}
          </pre>
        )}
      </div>
    </AppLayout>
  );
}
