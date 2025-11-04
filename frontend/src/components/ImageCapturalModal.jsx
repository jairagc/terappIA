import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onPicked: fn(File)  // devuelve el File seleccionado/capturado
 *  - title?: string
 */
export default function ImageCaptureModal({ open, onClose, onPicked, title = "Capturar imagen" }) {
  const inputCameraRef = useRef(null);   // nativa (sugiere cámara)
  const inputGalleryRef = useRef(null);  // galería
  const [useInlineCam, setUseInlineCam] = useState(false); // fallback WebRTC

  // Mostrar la opción de cámara integrada solo si hay soporte WebRTC
  const canInlineCamera = useMemo(
    () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    []
  );

  useEffect(() => {
    if (!open) {
      setUseInlineCam(false);
    }
  }, [open]);

  if (!open) return null;

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) onPicked(f);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white dark:bg-[#121826] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-[#0d121b] dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* Botón principal: Tomar foto (nativa) */}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Opción recomendada en móvil: <b>usar la cámara del dispositivo</b>.
            </p>
            <button
              className="h-11 px-5 rounded-lg bg-indigo-600 text-white font-semibold"
              onClick={() => inputCameraRef.current?.click()}
            >
              Tomar foto
            </button>
            <input
              ref={inputCameraRef}
              type="file"
              accept="image/*"
              capture="environment"   // <- sugiere cámara trasera (Android y Safari iOS)
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Botón secundario: Galería */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              O bien, <b>elegir desde tu galería</b>.
            </p>
            <button
              className="h-11 px-5 rounded-lg border font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => inputGalleryRef.current?.click()}
            >
              Elegir de galería
            </button>
            <input
              ref={inputGalleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Fallback WebRTC (solo si hay soporte) */}
          {canInlineCamera && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <details open={useInlineCam} onToggle={(e) => setUseInlineCam(e.currentTarget.open)}>
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-300">
                  ¿No te deja abrir la cámara? Prueba la <b>cámara integrada en el navegador</b>.
                </summary>
                <InlineCamera onPicked={onPicked} />
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mini cámara WebRTC como fallback */
function InlineCamera({ onPicked }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!active) return;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        console.error("getUserMedia:", e);
      }
    }
    start();
    return () => {
      active = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line

  async function snap() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
    if (blob) onPicked(new File([blob], "capture.jpg", { type: "image/jpeg" }));
  }

  return (
    <div className="mt-3 space-y-3">
      <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black/40" />
      <canvas ref={canvasRef} className="hidden" />
      <button onClick={snap} className="h-10 px-4 rounded-lg bg-primary text-white font-semibold">
        Capturar foto
      </button>
    </div>
  );
}
