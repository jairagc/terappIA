import { useState } from "react";
import axios from "axios";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";

export default function SentimentTester() {
  const [patientId, setPatientId] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Análisis de texto manual
  const analyzeText = async () => {
    if (!text.trim() || !patientId.trim()) {
      return setError("Debes ingresar texto y un ID de paciente.");
    }
    setError("");
    setLoading(true);
    try {
      const response = await axios.post("http://localhost:3001/sentiment", {
        text,
        patient_id: patientId,
      });
      setResult(response.data);
    } catch (err) {
      setError("Error al analizar el texto.");
    } finally {
      setLoading(false);
    }
  };

  // Análisis con OCR
  const analyzeImage = async () => {
    if (!file || !patientId.trim()) {
      return setError("Debes seleccionar una imagen y un ID de paciente.");
    }
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("patient_id", patientId);

      const response = await axios.post("http://localhost:3001/ocr", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(response.data);
    } catch (err) {
      setError("Error al analizar la imagen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 space-y-6">
      <h1 className="text-2xl font-bold text-blue-700">Analizador de Sentimientos</h1>

      {/* Input para ID del paciente */}
      <div>
        <label className="block text-gray-700 font-semibold mb-2">
          ID del paciente:
        </label>
        <input
          type="text"
          placeholder="Ejemplo: paciente001"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="w-full border border-blue-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Entrada de texto manual */}
      <div>
        <label className="block text-gray-700 font-semibold mb-2">
          Texto a analizar:
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows="4"
          placeholder="Escribe el texto aquí..."
          className="w-full border border-blue-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={analyzeText}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {loading ? "Analizando..." : "Analizar Texto"}
        </button>
      </div>

      {/* Subida de imagen */}
      <div>
        <label className="block text-gray-700 font-semibold mb-2">
          Imagen para OCR:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full"
        />
        <button
          onClick={analyzeImage}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {loading ? "Procesando..." : "Analizar Imagen"}
        </button>
      </div>

      {/* Errores */}
      {error && <p className="text-red-500">{error}</p>}

      {/* Resultados */}
      {result && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-xl font-semibold text-blue-600 mb-2">Resultado</h2>
          <JSONPretty data={result} />
        </div>
      )}
    </div>
  );
}
