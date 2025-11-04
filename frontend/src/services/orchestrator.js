// src/services/orchestrator.js
const DEV = import.meta.env.DEV;

// Define dos vars en tus .env:
//   VITE_ORCH_URL_DEV="http://localhost:8080"        # o el puerto donde corre FastAPI local
//   VITE_ORCH_URL_PROD="https://orchestrator-826777844588.us-central1.run.app"
const BASE_DEV  = import.meta.env.VITE_ORCH_URL_DEV  || "http://localhost:8080";
const BASE_PROD = import.meta.env.VITE_ORCH_URL_PROD || "https://orchestrator-826777844588.us-central1.run.app";

// Base final según entorno
const RAW_BASE = DEV ? BASE_DEV : BASE_PROD;

// Normaliza slashes para evitar dobles //
export const BASE = RAW_BASE.replace(/\/+$/, "");

function postMultipartXHR({ endpoint, formData, idToken, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, true);

    // Si NO usas cookies con el orquestador, mejor deja en false (default).
    // xhr.withCredentials = false;

    // Authorization (dispara preflight)
    xhr.setRequestHeader("Authorization", `Bearer ${idToken}`);

    xhr.onload = () => {
      const status = xhr.status;
      let json = {};
      try { json = JSON.parse(xhr.responseText || "{}"); } catch {}
      if (status >= 200 && status < 300) return resolve(json);
      const msg = json?.detail || xhr.statusText || `HTTP ${status}`;
      return reject(new Error(msg));
    };

    xhr.onerror = () => reject(new Error("Network error"));
    if (xhr.upload && typeof onProgress === "function") {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total));
      };
    }

    xhr.send(formData);
  });
}

function buildFormData({ org_id, patient_id, session_id, file, gcs_uri, analyze_now }) {
  const fd = new FormData();
  fd.append("org_id", org_id);
  fd.append("patient_id", patient_id);
  fd.append("session_id", session_id);
  fd.append("analyze_now", analyze_now ? "true" : "false");
  if (file) fd.append("file", file);
  else if (gcs_uri) fd.append("gcs_uri", gcs_uri);
  else throw new Error("Debes enviar file o gcs_uri");
  return fd;
}

export async function orchestratePhotoPre({ org_id, patient_id, session_id, file, gcs_uri, idToken, onProgress }) {
  const fd = buildFormData({ org_id, patient_id, session_id, file, gcs_uri, analyze_now: false });
  return await postMultipartXHR({ endpoint: "/orquestar_foto", formData: fd, idToken, onProgress });
}

export async function orchestrateAudioPre({ org_id, patient_id, session_id, file, gcs_uri, idToken, onProgress }) {
  const fd = buildFormData({ org_id, patient_id, session_id, file, gcs_uri, analyze_now: false });
  return await postMultipartXHR({ endpoint: "/orquestar_audio", formData: fd, idToken, onProgress });
}

export async function saveFinalNote({ org_id, patient_id, session_id, note_id, texto, idToken }) {
  const url = `${BASE}/guardar_nota`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ org_id, patient_id, session_id, note_id, texto }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || res.statusText);
  }
  return await res.json();
}

// (Opcional) Log para depurar qué base está usando el front:
if (DEV) {
  // eslint-disable-next-line no-console
  console.log("[ORCH] BASE =", BASE, "origin =", window.location.origin);
}
