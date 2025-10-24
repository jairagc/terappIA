import { useState } from "react";
import axios from "axios";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";

export default function HistoryViewer() {
  const [patientId, setPatientId] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    if (!patientId.trim()) return setError("Debes ingresar un ID de paciente.");
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`http://localhost:3001/history/${patientId}`);
      setHistory(response.data);
    } catch {
      setError("Error al obtener el historial.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-6 space-y-6">
      <h1 className="text-2xl font-bold text-blue-700">Historial de Análisis</h1>

      {/* Input para ID de paciente */}
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="ID del paciente..."
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="flex-1 border border-blue-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={fetchHistory}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          disabled={loading}
        >
          {loading ? "Consultando..." : "Consultar"}
        </button>
      </div>

      {/* Errores */}
      {error && <p className="text-red-500">{error}</p>}

      {/* Resultados */}
      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <p className="text-sm text-gray-600 mb-2">
                <strong>Fecha:</strong>{" "}
                {entry.timestamp
                  ? new Date(entry.timestamp._seconds * 1000).toLocaleString()
                  : "Sin fecha"}
              </p>
              <p className="mb-2">
                <strong>Texto original:</strong> {entry.text_original}
              </p>
              <p className="mb-2">
                <strong>Fuente:</strong> {entry.source}
              </p>
              <h3 className="text-blue-600 font-semibold mb-1">Resultado del análisis</h3>
              <JSONPretty data={entry.sentiment_result} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No hay resultados para mostrar.</p>
      )}
    </div>
  );
}
