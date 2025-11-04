import React, { useMemo, useRef, useState } from "react";

/**
 * Props:
 *  - open, onClose, onPicked(file: File), title?
 */
export default function AudioCaptureModal({ open, onClose, onPicked, title = "Capturar audio" }) {
  const inputMicRef = useRef(null);
  const inputFileRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const [chunks, setChunks] = useState([]);

  const canInlineRecorder = useMemo(
    () => !!(navigator.mediaDevices && window.MediaRecorder),
    []
  );

  if (!open) return null;

  async function startRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const localChunks = [];
      rec.ondataavailable = (e) => e.data && localChunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(localChunks, { type: "audio/webm" });
        onPicked(new File([blob], "grabacion.webm", { type: "audio/webm" }));
        setChunks([]);
      };
      rec.start();
      setRecorder(rec);
      setChunks(localChunks);
      setRecording(true);
    } catch (e) {
      alert("No se pudo acceder al micrófono.");
      console.error(e);
    }
  }

  function stopRecord() {
    if (recorder && recording) recorder.stop();
    setRecording(false);
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) onPicked(f);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white dark:bg-[#121826] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-[#0d121b] dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Opción recomendada (móvil): grabar con input nativo */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Opción recomendada en móvil: <b>micrófono nativo</b>.
            </p>
            <button
              className="h-11 px-5 rounded-lg bg-indigo-600 text-white font-semibold"
              onClick={() => inputMicRef.current?.click()}
            >
              Grabar con micrófono
            </button>
            <input
              ref={inputMicRef}
              type="file"
              accept="audio/*"
              capture="microphone"  // pista para móvil
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Elegir archivo de audio existente */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Elegir archivo de audio existente.</p>
            <button
              className="h-11 px-5 rounded-lg border font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => inputFileRef.current?.click()}
            >
              Elegir archivo
            </button>
            <input
              ref={inputFileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Grabadora integrada como fallback */}
          {canInlineRecorder && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                ¿Problemas con el nativo? Usa la <b>grabadora integrada del navegador</b>.
              </p>
              {!recording ? (
                <button onClick={startRecord} className="h-10 px-4 rounded-lg bg-primary text-white font-semibold">
                  Iniciar grabación
                </button>
              ) : (
                <button onClick={stopRecord} className="h-10 px-4 rounded-lg bg-rose-600 text-white font-semibold">
                  Detener y usar grabación
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
