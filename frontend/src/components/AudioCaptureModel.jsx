import React, { useEffect, useMemo, useRef, useState } from "react";

export default function AudioCaptureModal({ open, onClose, onPicked, title = "Capturar audio" }) {
  const inputFileRef = useRef(null);

  const canInlineRecorder = useMemo(
    () => !!(navigator?.mediaDevices && window?.MediaRecorder),
    []
  );

  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const [mimeType, setMimeType] = useState("audio/webm");
  const [errMsg, setErrMsg] = useState("");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);
  const [stream, setStream] = useState(null);

  // Mime type
  useEffect(() => {
    if (!window?.MediaRecorder) return;
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    for (const c of candidates) {
      if (window.MediaRecorder.isTypeSupported?.(c)) { setMimeType(c); return; }
    }
    setMimeType("audio/webm");
  }, []);

  // Limpieza al cerrar
  useEffect(() => {
    if (!open) {
      stopTimer();
      try { if (recorder && recording) recorder.stop(); } catch {}
      try { stream?.getTracks?.().forEach(t => t.stop()); } catch {}
      setStream(null);
      setRecording(false); setRecorder(null); setErrMsg(""); setSeconds(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc / accesos rápidos
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
      if (e.key === " " || e.key === "Spacebar") {
        // espacio: toggle grabación si hay grabadora
        if (canInlineRecorder) {
          e.preventDefault();
          if (!recording) startRecord();
          else stopRecord();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canInlineRecorder, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  function startTimer() {
    stopTimer(); setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  function fmt(s) {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  async function startRecord() {
    setErrMsg("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      const rec = new MediaRecorder(s, { mimeType });
      const chunks = [];
      rec.ondataavailable = (e) => e.data && chunks.push(e.data);
      rec.onstop = () => {
        try { s.getTracks().forEach(t => t.stop()); } catch {}
        const type = mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        onPicked(new File([blob], `grabacion_${Date.now()}.${ext}`, { type }));
      };
      rec.start();
      setRecorder(rec); setRecording(true); startTimer();
    } catch (e) {
      console.error(e);
      setErrMsg("No se pudo acceder al micrófono. Revisa permisos del navegador.");
    }
  }
  function stopRecord() {
    try { recorder?.stop(); } catch {}
    stopTimer(); setRecording(false);
  }
  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) onPicked(f);
  }

  if (!open) return null;

  return (
    <div
      className="modal-root"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-card hover-elevate">
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="btn icon modal-close" aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <p className="caption text-muted" style={{marginBottom:8}}>
            Usa la <b>grabadora integrada</b> o sube un archivo de audio.
          </p>

          {canInlineRecorder && (
            <div className="recorder-strip hover-surface">
              <div className="recorder-left">
                <span className={`rec-dot ${recording ? "is-on" : ""}`} />
                <span className="rec-status">
                  {recording ? `Grabando… ${fmt(seconds)}` : "Listo para grabar"}
                </span>
              </div>
              {!recording ? (
                <button onClick={startRecord} className="btn primary h-10">Iniciar</button>
              ) : (
                <button onClick={stopRecord} className="btn outline h-10">Detener & usar</button>
              )}
            </div>
          )}

          {errMsg && (
            <div className="inline-alert">
              <span>{errMsg}</span>
            </div>
          )}

          <div className="file-block">
            <button className="btn outline h-11" onClick={() => inputFileRef.current?.click()}>
              Elegir archivo…
            </button>
            <input
              ref={inputFileRef}
              type="file"
              accept="audio/*"
              style={{display:"none"}}
              onChange={handleFile}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn outline h-10">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
