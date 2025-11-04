// src/pages/CaptureAudio.jsx
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { orchestrateAudioPre } from "../services/orchestrator";
import { generateUtcSessionId } from "../utils/sessions";

export default function CaptureAudio() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();

  const orgId = state?.orgId || localStorage.getItem("orgId") || "";
  const patientId = state?.patientId || "";
  const [sessionId] = useState(state?.sessionId || generateUtcSessionId());

  // grabación
  const mediaRef = useRef(null);   // MediaRecorder
  const streamRef = useRef(null);  // MediaStream
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  // subir archivo existente
  const fileInputRef = useRef(null);
  const [pickedFile, setPickedFile] = useState(null);

  useEffect(() => {
    if (!patientId || !orgId) navigate(-1);
    return () => cleanup();
  }, [patientId, orgId, navigate]);

  function cleanup() {
    stopTimer();
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    const t0 = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.round((Date.now() - t0) / 1000));
    }, 250);
  }
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRef.current = mr;
      chunksRef.current = [];
      setBlob(null);
      setAudioUrl("");
      setDuration(0);

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const out = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(out);
        setAudioUrl(URL.createObjectURL(out));
        cleanup(); // libera mic
        setRecording(false);
        stopTimer();
      };

      mr.start(250);
      setRecording(true);
      startTimer();
    } catch (err) {
      alert(`No se pudo iniciar la grabación: ${err.message}`);
    }
  }
  function stopRecording() {
    try {
      if (mediaRef.current && mediaRef.current.state !== "inactive") {
        mediaRef.current.stop();
      }
    } catch {}
  }
  function discardRecording() {
    setBlob(null);
    setAudioUrl("");
    setDuration(0);
  }

  async function transcribeFile(file) {
    setBusy(true);
    setProgress(0);
    try {
      const idToken = await user.getIdToken(true);
      const resp = await orchestrateAudioPre({
        org_id: orgId,
        patient_id: patientId,
        session_id: sessionId,
        file,
        idToken,
        onProgress: (p) => setProgress(p),
      });

      const texto = resp?.transcripcion?.resultado?.texto || "";
      const noteId = resp?.note_id;

      navigate("/review-text", {
        state: {
          source: "audio",
          orgId,
          patientId,
          sessionId,
          noteId,
          initialText: texto,
          transcripcion: resp?.transcripcion ?? null,
          raw: resp ?? null,
        },
      });
    } catch (err) {
      alert(`Error subiendo/transcribiendo: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function uploadRecording() {
    if (!blob) return;
    const file = new File([blob], "recording.webm", { type: "audio/webm" });
    await transcribeFile(file);
  }

  async function uploadPickedFile() {
    if (!pickedFile) return;
    await transcribeFile(pickedFile);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Audio (Transcripción)</h1>

      {/* Opciones: grabar o subir */}
      {!recording && !blob && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={startRecording} className="px-4 py-3 rounded bg-indigo-600 text-white">
            Grabar audio
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-3 rounded border">
            Subir audio
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setPickedFile(e.target.files?.[0] || null)}
          />
          {pickedFile && (
            <button
              onClick={uploadPickedFile}
              disabled={busy}
              className="px-4 py-3 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              {busy ? "Subiendo…" : "Transcribir archivo"}
            </button>
          )}
        </div>
      )}

      {/* Grabación en curso */}
      {recording && (
        <div className="space-y-3">
          <div className="text-sm text-gray-600">Grabando… {duration}s</div>
          <button onClick={stopRecording} className="px-4 py-2 rounded bg-rose-600 text-white">
            Detener
          </button>
        </div>
      )}

      {/* Grabación lista para subir */}
      {blob && !recording && (
        <>
          <audio controls src={audioUrl} className="w-full" />
          <div className="text-sm text-gray-600">Duración aprox: {duration}s</div>

          <div className="flex gap-3">
            <button onClick={discardRecording} className="px-4 py-2 rounded border">
              Regrabar
            </button>
            <button
              onClick={uploadRecording}
              disabled={busy}
              className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              {busy ? "Subiendo…" : "Transcribir"}
            </button>
          </div>

          {busy && (
            <div className="w-full bg-gray-200 h-2 rounded">
              <div className="bg-emerald-600 h-2 rounded" style={{ width: `${progress}%` }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
