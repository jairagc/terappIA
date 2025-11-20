// @ts-check-
import { getAuth } from "firebase/auth";

// El bloque de variables de entorno existente
const DEV = import.meta.env.DEV;
const BASE_DEV  = import.meta.env.VITE_ORCH_URL_DEV  || "http://localhost:8080";
const BASE_PROD = import.meta.env.VITE_ORCH_URL_PROD || "https://orchestrator-826777844588.us-central1.run.app";
const RAW_BASE = DEV ? BASE_DEV : BASE_PROD;
// Base final según entorno
export const BASE = RAW_BASE.replace(/\/+$/, "");


/**
 * Obtiene el token de autenticación de Firebase del usuario actual.
 * @returns {Promise<string>} El token de autenticación.
 * @throws {Error} Si el usuario no está autenticado.
 */
const getAuthToken = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Usuario no autenticado.");
  }
  return await user.getIdToken();
};

/**
 * Realiza una petición POST multipart usando XMLHttpRequest.
 * @param {object} params
 * @param {string} params.endpoint - La ruta del API (ej: /orquestar_foto).
 * @param {FormData} params.formData - El cuerpo de datos multipart.
 * @param {string} params.idToken - El token de autorización del usuario.
 * @param {(loaded: number) => void} [params.onProgress] - Callback opcional para el progreso de la subida.
 * @returns {Promise<object>} La respuesta JSON del API.
 */
function postMultipartXHR({ endpoint, formData, idToken, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, true);

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

/**
 * Construye el objeto FormData para las peticiones multipart.
 * @param {object} params
 * @param {string} params.org_id
 * @param {string} params.patient_id
 * @param {string} params.session_id
 * @param {File | null} params.file
 * @param {string | null} params.gcs_uri
 * @param {boolean} params.analyze_now
 * @returns {FormData}
 */
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

/**
 * Orquesta el pipeline de OCR sin análisis inmediato.
 * @param {object} params
 * @param {string} params.org_id
 * @param {string} params.patient_id
 * @param {string} params.session_id
 * @param {File | null} params.file
 * @param {string | null} params.gcs_uri
 * @param {string} params.idToken
 * @param {(loaded: number) => void} [params.onProgress]
 * @returns {Promise<object>}
 */
export async function orchestratePhotoPre({ org_id, patient_id, session_id, file, gcs_uri, idToken, onProgress }) {
  const fd = buildFormData({ org_id, patient_id, session_id, file, gcs_uri, analyze_now: false });
  return await postMultipartXHR({ endpoint: "/orquestar_foto", formData: fd, idToken, onProgress });
}

/**
 * Orquesta el pipeline de Transcripción de Audio sin análisis inmediato.
 * @param {object} params
 * @param {string} params.org_id
 * @param {string} params.patient_id
 * @param {string} params.session_id
 * @param {File | null} params.file
 * @param {string | null} params.gcs_uri
 * @param {string} params.idToken
 * @param {(loaded: number) => void} [params.onProgress]
 * @returns {Promise<object>}
 */
export async function orchestrateAudioPre({ org_id, patient_id, session_id, file, gcs_uri, idToken, onProgress }) {
  const fd = buildFormData({ org_id, patient_id, session_id, file, gcs_uri, analyze_now: false });
  return await postMultipartXHR({ endpoint: "/orquestar_audio", formData: fd, idToken, onProgress });
}

/**
 * Guarda la nota final (texto editado) y solicita el análisis final.
 * @param {object} params
 * @param {string} params.org_id
 * @param {string} params.patient_id
 * @param {string} params.session_id
 * @param {string} params.note_id
 * @param {string} params.texto
 * @param {string} params.idToken
 * @returns {Promise<object>}
 */
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

// --- FUNCIÓN FINALIZAR SESIÓN (ADAPTADA) ---

/**
 * Envía la nota SOAP final del doctor para generar el PDF firmado,
 * usando el patrón de llamada fetch/JSON.
 * @param {string} sessionId El ID de la sesión a finalizar.
 * @param {string} orgId El ID de la organización.
 * @param {string} patientId El ID del paciente.
 * @param {object} soapInput Objeto con { subjetivo, observacion_clinica, analisis, plan }.
 * @returns {Promise<Blob>} El PDF generado como un Blob.
 * @throws {Error} Si la respuesta no es OK o no es un PDF.
 */
export const finalizarSesionYGenerarNota = async (sessionId, orgId, patientId, soapInput) => {
  const token = await getAuthToken();
  const endpoint = `/sesion/finalizar_y_firmar/${sessionId}`;

  // Se incluyen los tres IDs principales y el SOAP en el body JSON
  const payload = {
    org_id: orgId,
    patient_id: patientId,
    soap_input: soapInput,
  };

  const response = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/pdf', // Pedimos un PDF de vuelta
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Si el error no es JSON (ej. 500), devuelve el texto
    const errorBody = await response.text();
    // Intenta parsear el JSON si existe para obtener el detalle
    try {
        const errorJson = JSON.parse(errorBody);
        throw new Error(errorJson.detail || `Error al finalizar la sesión: ${response.status}`);
    } catch (e) {
        // Si no es JSON, lanza el error de estado
        throw new Error(`Error al finalizar la sesión (HTTP ${response.status}): ${response.statusText}`);
    }
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    // Devolvemos el PDF como un Blob
    return response.blob();
  } else {
    // Fallback si la respuesta fue 200 OK pero sin el header de PDF
    const responseText = await response.text();
    throw new Error(`Error inesperado: Se esperaba un PDF, se recibió ${contentType}. Respuesta: ${responseText.substring(0, 50)}...`);
  }
};


// (Opcional) Log para depurar qué base está usando el front:
if (DEV) {
  // eslint-disable-next-line no-console
  console.log("[ORCH] BASE =", BASE, "origin =", window.location.origin);
}