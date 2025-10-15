#📖 API de OCR y Análisis de Emociones con Gemini Flash 2.0
##📝 Descripción General

Estos modulos implementa un flujo de procesamiento de texto desde imágenes mediante dos componentes principales:
OCR (Reconocimiento Óptico de Caracteres)
Se implementará con la API de Google Cloud Vision.
Recibe como entrada imágenes o PDF.
Devuelve como salida un JSON con el texto detectado, que servirá como entrada para el analizador de emociones.
Actualmente, los resultados se guardan en una carpeta local (Pruebas/ocr_resultados).

###➡️ En una versión futura, se almacenarán en un bucket de GCP nombrado con el ID del usuario.

##Analizador de Emociones (Gemini Flash 2.0 en Vertex AI)

Recibe el texto devuelto por el OCR.
Extrae 8 emociones principales:
😃 Alegría
😢 Tristeza
😡 Enojo
😱 Miedo
😲 Sorpresa
🤢 Disgusto
😖 Estrés
😌 Calma
aversión
anticipación

Para cada emoción, devuelve un porcentaje de certeza (0-100%) y una lista de entidades asociadas.
Los resultados también se guardan en carpeta local (pruebas_analisis) y después pasarán a bucket en GCP.

📌 Flujo del Sistema
flowchart TD
    A[Imagen o PDF] --> B[Endpoint OCR - Google Vision API]
    B -->|Texto en JSON| C[Endpoint Analizador de Emociones - Gemini Flash 2.0]
    C --> D[JSON con emociones + entidades]
    D --> E[Guardar en carpeta local / futuro bucket por usuario]

📂 Formatos de Entrada y Salida
🔹 Entrada esperada por el OCR
{
  "imagen": "archivo.jpg"
}

⚠️ El OCR procesará la imagen y extraerá el texto.

🔹 Salida del OCR
{
  "texto": "Me siento estresado en la escuela pero feliz con mis amigos."
}

🔹 Entrada esperada por el Analizador
{
  "texto": "Me siento estresado en la escuela pero feliz con mis amigos."
}

🔹 Salida del Analizador
{
  "mensaje": "Análisis completado",
  "resultado": {
    "estres": {
      "porcentaje": 90.0,
      "entidades": ["escuela"]
    },
    "alegria": {
      "porcentaje": 75.0,
      "entidades": ["amigos"]
    }
  },
  "archivo_guardado": "pruebas_analisis/emociones_20250903_162045.json"
}

##⚙️ Instalación y Ejecución
1️⃣ Instalar dependencias
pip install fastapi uvicorn google-cloud-aiplatform google-cloud-vision

2️⃣ Levantar el servidor FastAPI, ejecutar en la carpeta adecuada
uvicorn Analysis:app --reload --port 8001

La API estará disponible en:
http://127.0.0.1:8001

🚀 Probar el Analizador
🔹 En PowerShell
Invoke-RestMethod -Uri "http://127.0.0.1:8001/analizar_emociones" `
    -Method POST `
    -Headers @{ "Content-Type" = "application/json" } `
    -Body '{"texto": "Me siento estresado en la escuela pero feliz con mis amigos."}'

🔹 En CMD (símbolo del sistema)
curl -X POST "http://127.0.0.1:8001/analizar_emociones" -H "Content-Type: application/json" -d "{\"texto\":\"Me siento estresado en la escuela pero feliz con mis amigos.\"}"


#Orquestador
Este orquestador expone un único endpoint que:
1) **Crea la carpeta del usuario** (si no existe) bajo `data_local/<user_id|_public>/`.
2) Dentro genera las subcarpetas:
   - `pruebas_ocr/`
   - `pruebas_analisis/`
   - `fotos/`
3) **Guarda la fotografía** recibida en `fotos/` (con timestamp).
4) Llama secuencialmente a los microservicios:
   - **OCR** → `POST /ocr` (envía `file`)
   - **Análisis** → `POST /analizar_emociones` (envía `{"texto": ...}` desde el OCR)
5) Devuelve una **respuesta consolidada**. El guardado de JSON de OCR y análisis lo realizan **sus propios servicios**.

> En el futuro, el almacenamiento se migrará a **bucket por usuario** (usando el UID de Firebase).

correr con : uvicorn Orchestrator:app --reload --port 8080
Antes se debe de correr cada endpoint de microservciio (ocr y analsis) en su respectiva cmd.
OCR en el puerto 8002

Respuesta de Ejemplo:
{
  "mensaje": "Pipeline completado",
  "user_id": "JenniferMorales",
  "foto_guardada": "data_local/JenniferMorales/fotos/foto_20250922_141530.jpg",
  "ocr": {
    "texto": "Me siento estresado en la escuela pero feliz con mis amigos.",
    "archivo_guardado": "data_local/JenniferMorales/pruebas_ocr/ocr_20250922_141530.json"
  },
  "analisis": {
    "mensaje": "Análisis completado",
    "resultado": {
      "estres": { "porcentaje": 90.0, "entidades": ["escuela"] },
      "alegria": { "porcentaje": 75.0, "entidades": ["amigos"] }
    },
    "archivo_guardado": "data_local/JenniferMorales/pruebas_analisis/emociones_20250922_141531.json"
  }
}


Estructura de almacenamiento local
data_local/
  └── <UID | _public>/
      ├── fotos/
      │   └── foto_YYYYMMDD_HHMMSS.jpg
      ├── pruebas_ocr/
      │   └── ocr_YYYYMMDD_HHMMSS.json       # (creado por tu servicio OCR)
      └── pruebas_analisis/
          └── emociones_YYYYMMDD_HHMMSS.json # (creado por tu servicio de análisis)

Pruebas rápidas
Windows CMD
curl -X POST "http://localhost:8080/orquestar" -H "X-User-Id: JenniferMorales" -F "file=@Backend\\Microservices\\images\\Nota1.jpg"