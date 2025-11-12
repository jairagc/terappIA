import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ImageCaptureModal({ open, onClose, onPicked, title = "Capturar imagen" }) {
  const inputCameraRef = useRef(null);
  const inputGalleryRef = useRef(null);

  const isMobile = useMemo(
    () => /android|iphone|ipad|ipod|mobile/i.test(navigator?.userAgent || ""),
    []
  );
  const canInlineCamera = useMemo(
    () => !!(navigator?.mediaDevices && navigator.mediaDevices.getUserMedia),
    []
  );

  const [useInlineCam, setUseInlineCam] = useState(false);
  useEffect(() => {
    setUseInlineCam(open && !isMobile && canInlineCamera);
  }, [open, isMobile, canInlineCamera]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) onPicked(f);
  }

  if (!open) return null;

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={title}>
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
          {isMobile ? (
            <>
              <p className="caption text-muted" style={{ marginBottom: 8 }}>
                Recomendado en móvil: <b>usar la cámara del dispositivo</b>.
              </p>

              <div className="hover-surface pill-block">
                <button className="btn primary h-11" onClick={() => inputCameraRef.current?.click()}>
                  Tomar foto
                </button>
                <input
                  ref={inputCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleFile}
                />
              </div>

              <div className="file-block">
                <button className="btn outline h-11" onClick={() => inputGalleryRef.current?.click()}>
                  Elegir de galería
                </button>
                <input
                  ref={inputGalleryRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFile}
                />
              </div>
            </>
          ) : (
            <>
              {canInlineCamera && (
                <details
                  className="inline-details"
                  open={useInlineCam}
                  onToggle={(e) => setUseInlineCam(e.currentTarget.open)}
                >
                  <summary className="caption text-muted summary-hover">
                    Cámara integrada del navegador
                  </summary>
                  <div className="cam-surface">
                    <InlineCamera onPicked={onPicked} />
                  </div>
                </details>
              )}

              <div className="file-block">
                <button className="btn outline h-11" onClick={() => inputGalleryRef.current?.click()}>
                  Elegir archivo…
                </button>
                <input
                  ref={inputGalleryRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFile}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn outline h-10">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineCamera({ onPicked }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        setStarting(true);
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (!active) return;
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        console.error("getUserMedia:", e);
      } finally {
        setStarting(false);
      }
    }
    start();
    return () => {
      active = false;
      try { stream?.getTracks?.().forEach((t) => t.stop()); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function snap() {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
    if (blob) onPicked(new File([blob], "capture.jpg", { type: "image/jpeg" }));
  }

  return (
    <div className="cam-grid">
      <div className="cam-video-wrap">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="cam-video"
          style={{ aspectRatio: "16/9" }}
        />
        {starting && (
          <div className="cam-overlay">
            <div className="spinner-md" />
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="cam-actions">
        <button onClick={snap} className="btn primary h-10">
          Capturar foto
        </button>
      </div>
    </div>
  );
}
