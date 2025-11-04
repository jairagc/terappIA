import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { orchestratePhotoPre } from "../services/orchestrator";
import { generateUtcSessionId } from "../utils/sessions";

/** Re-encode para quitar EXIF, corregir orientación y reducir tamaño */
function resizeAndCompress(file, maxSize = 2000, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error("Compression failed"));
          const outFile = new File([blob], `capture.jpg`, { type: "image/jpeg" });
          resolve(outFile);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = url;
  });
}

/** Modal genérico */
function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#121826] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Vista de cámara con getUserMedia + captura a canvas */
function CameraTab({ onConfirmFile }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [snapshotUrl, setSnapshotUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  useEffect(() => {
    let mounted = true;
    async function start() {
      if (!hasMedia) return;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!mounted) return;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn("getUserMedia failed:", e);
      }
    }
    start();
    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [hasMedia]);

  function takePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setSnapshotUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      },
      "image/jpeg",
      0.92
    );
  }

  function retake() {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    setSnapshotUrl("");
  }

  async function confirm() {
    if (!snapshotUrl) return;
    setBusy(true);
    try {
      const res = await fetch(snapshotUrl);
      const blob = await res.blob();
      // Re-encode/comprimir
      const file = await resizeAndCompress(new File([blob], "camera.jpg", { type: "image/jpeg" }), 2000, 0.85);
      onConfirmFile(file);
    } catch (e) {
      alert("No se pudo procesar la foto tomada.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasMedia) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-300">
        Tu navegador no soporta captura de cámara con getUserMedia. Usa la pestaña <b>Galería</b>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!snapshotUrl ? (
        <>
          <div className="rounded-lg overflow-hidden bg-black">
            <video ref={videoRef} className="w-full max-h-[60vh] object-contain" playsInline muted />
          </div>
          <div className="flex gap-3">
            <button onClick={takePhoto} className="px-4 py-2 rounded bg-primary text-white">
              Tomar foto
            </button>
          </div>
        </>
      ) : (
        <>
          <img src={snapshotUrl} alt="captura" className="rounded border max-h-[60vh] object-contain" />
          <div className="flex gap-3">
            <button onClick={retake} className="px-4 py-2 rounded border">
              Repetir
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              {busy ? "Procesando…" : "Confirmar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Pestaña de galería/archivos */
function GalleryTab({ onConfirmFile }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const compact = await resizeAndCompress(f, 2000, 0.85);
      setFile(compact);
      setPreview(URL.createObjectURL(compact));
    } catch (err) {
      alert(`Error preparando la imagen: ${err.message}`);
    }
  }

  function clear() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function confirm() {
    if (!file) return;
    setBusy(true);
    try {
      onConfirmFile(file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment" // en móviles sugiere cámara trasera o galería
        className="hidden"
        onChange={onPick}
      />
      {!file ? (
        <button onClick={() => inputRef.current?.click()} className="px-4 py-2 rounded bg-indigo-600 text-white">
          Elegir/Tomar foto
        </button>
      ) : (
        <>
          <img src={preview} alt="preview" className="rounded border max-h-[60vh] object-contain" />
          <div className="flex gap-3">
            <button onClick={clear} className="px-4 py-2 rounded border">
              Cambiar foto
            </button>
            <button
              onClick={confirm}
              disabled={busy}
              className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              {busy ? "Procesando…" : "Confirmar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CapturePhoto() {
  const navigate = useNavigate();
  const { state } = useLocation(); // viene desde GenerateProgressNote
  const { user } = useAuth();

  const orgId = state?.orgId || localStorage.getItem("orgId") || "";
  const patientId = state?.patientId || "";
  const [sessionId] = useState(state?.sessionId || generateUtcSessionId());

  // archivo final listo para subir (ya comprimido) + preview
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  // modal y pestañas
  const [openModal, setOpenModal] = useState(false);
  const [activeTab, setActiveTab] = useState("camera"); // 'camera' | 'gallery'
  const mediaSupported = useMemo(
    () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    []
  );

  useEffect(() => {
    if (!patientId || !orgId) navigate(-1);
  }, [patientId, orgId, navigate]);

  // si no hay getUserMedia, inicia la modal directamente en "gallery"
  useEffect(() => {
    if (!mediaSupported) setActiveTab("gallery");
  }, [mediaSupported]);

  function openPicker() {
    setOpenModal(true);
  }

  function onModalConfirm(selectedFile) {
    setOpenModal(false);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setProgress(0);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    try {
      const idToken = await user.getIdToken(true);

      // PRE-proceso: solo OCR → note_id y texto (sin análisis)
      const resp = await orchestratePhotoPre({
        org_id: orgId,
        patient_id: patientId,
        session_id: sessionId,
        file,
        idToken,
        onProgress: (p) => setProgress(p),
      });

      const textoOCR = resp?.ocr?.resultado?.texto || "";
      const noteId = resp?.note_id;

      navigate("/review-text", {
        state: {
          source: "photo",
          orgId,
          patientId,
          sessionId,
          noteId,
          initialText: textoOCR,
          ocr: resp?.ocr ?? null,
          raw: resp ?? null,
        },
      });
    } catch (err) {
      alert(`Error subiendo/analizando: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Captura de nota por imagen</h1>

      {!file ? (
        <>
          <p className="text-sm text-gray-600">
            Elige cómo quieres capturar: tomar una foto con la cámara o seleccionar una de tu galería.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={openPicker} className="px-4 py-3 rounded bg-indigo-600 text-white">
              Tomar o seleccionar foto
            </button>
          </div>
        </>
      ) : (
        <>
          <img src={preview} alt="preview" className="rounded border max-h-96 object-contain" />
          <div className="flex gap-3">
            <button onClick={retake} className="px-4 py-2 rounded border">
              Retomar
            </button>
            <button
              onClick={upload}
              disabled={busy}
              className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              {busy ? "Subiendo…" : "Extraer texto (OCR)"}
            </button>
          </div>
          {busy && (
            <div className="w-full bg-gray-200 h-2 rounded">
              <div className="bg-emerald-600 h-2 rounded" style={{ width: `${progress}%` }} />
            </div>
          )}
        </>
      )}

      {/* Modal emergente de captura */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Capturar imagen"
      >
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setActiveTab("camera")}
            disabled={!mediaSupported}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              activeTab === "camera"
                ? "bg-primary text-white border-primary"
                : "bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700"
            } ${!mediaSupported ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Cámara
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              activeTab === "gallery"
                ? "bg-primary text-white border-primary"
                : "bg-transparent text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700"
            }`}
          >
            Galería
          </button>
          {!mediaSupported && (
            <span className="text-xs text-amber-600 ml-2">
              (Tu navegador requiere seleccionar archivo)
            </span>
          )}
        </div>

        {activeTab === "camera" ? (
          <CameraTab onConfirmFile={onModalConfirm} />
        ) : (
          <GalleryTab onConfirmFile={onModalConfirm} />
        )}
      </Modal>
    </div>
  );
}
