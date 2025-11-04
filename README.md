## Levantamiento de servicios:
# OCR (puerto 8002)
uvicorn OCR:app --host 0.0.0.0 --port 8002 --reload


# Análisis (puerto 8001)
uvicorn Analysis:app --host 0.0.0.0 --port 8001 --reload


# Transcriptor de audio (puerto 8003)
uvicorn Audio_transcriber:app --host 0.0.0.0 --port 8003 --reload

# in /backend/orquestador
uvicorn orchestrator:app --host 0.0.0.0 --port 8080 --reload


Pruebas rápidas
Windows CMD, par ala imagen (OCR)
curl -X POST "http://localhost:8080/orquestar" -H "X-User-Id: JenniferMorales" -F "file=@Backend\\Microservices\\images\\Nota1.jpg"

Windows CMD, para el audio
curl -X POST "http://localhost:8080/orquestar_audio" -H "X-User-Id: JenniferMorales" -F "file=@Backend\\Microservices\\audio\\nota1.m4a"

## prueba con gcs  , uri
OCR 
curl -X POST "http://localhost:8080/orquestar_foto" ^  -H "Authorization: Bearer <ID_TOKEN>" ^  -H "X-User-Id: JenniferMorales" ^  -F "gcs_uri=gs://ceroooooo/Nota1.jpg"

AUDIO
>curl -X POST "http://localhost:8080/orquestar_audio" ^  -H "Authorization: Bearer <ID_TOKEN>" ^  -H "X-User-Id: JenniferMorales" ^  -F "gcs_uri=gs://ceroooooo/AudioPrueba.m4a"

## Modificaciones Recientes y Arquitectura de Datos

El sistema ha sido refactorizado para pasar de un prototipo de pruebas a una arquitectura segura y estructurada, lista para producción.

### 1. Autenticación Centralizada 💂
Toda la seguridad ahora se centraliza en el **Orquestador**, que actúa como el único punto de entrada (Gateway).

* **Se eliminó el uso de `X-User-Id`** para la autenticación, ya que era inseguro.
* Se implementó la verificación de **Tokens de Identidad de Firebase (JWT)**. Cada petición a un endpoint protegido debe incluir el encabezado `Authorization: Bearer <token>`.
* El Orquestador verifica el token, extrae el `uid` del doctor (doctor_uid) de forma segura y lo pasa a los servicios internos a través del encabezado `X-User-Id`, que ahora solo se usa para comunicación interna de confianza.

### 2. Estructura de Datos en GCS 🗃️
El almacenamiento en Google Cloud Storage ha sido reestructurado para seguir el esquema de datos definido. Los archivos ya no se guardan en carpetas genéricas, sino en una ruta jerárquica y predecible.

### 3. Limpieza y Refactorización 🧹
Para preparar el sistema para producción y eliminar el desorden:

* **Se eliminaron las copias locales redundantes** en el Orquestador (`save_uploaded`, `save_json_copy`).
* El guardado local de archivos en los servicios de OCR, Audio y Análisis ahora es **opcional** y está controlado por una **bandera de depuración** (variable de entorno `SAVE_LOCAL_RESULTS`). Por defecto, está desactivado.

---
## Estructura Final del Bucket en GCS

Todos los archivos generados por el sistema se organizan en GCS siguiendo esta estructura, asegurando que cada dato esté asociado a una organización, doctor, paciente y sesión específicos.

gs://{nombre-del-bucket}/
└── {org_id}/
    └── {doctor_uid}/
        └── {patient_id}/
            └── sessions/
                └── {session_id}/
                    ├── raw/
                    │   ├── {note_id}.jpg      # Imagen original subida
                    │   └── {note_id}.m4a      # Audio original subido
                    │
                    └── derived/
                        ├── ocr/
                        │   └── {note_id}.json # Resultado del OCR
                        ├── transcription/
                        │   └── {note_id}.json # Resultado de la transcripción
                        └── analisis/
                            └── {note_id}.json # Resultado del análisis de emociones

## Cómo Realizar Pruebas Autenticadas 🚀

Para probar los endpoints protegidos, necesitas obtener un token de un usuario de prueba.

### Paso 1: Crear un Usuario de Prueba en Firebase
Ve a tu **Consola de Firebase → Authentication → Users** y haz clic en **"Add user"**. Crea un usuario con un correo y contraseña.

### Paso 2: Obtener tu Web API Key
En la **Consola de Firebase**, ve a **Project Settings ⚙️ → General**. En la sección "Your apps", busca y copia la **Web API Key**.

### Paso 3: Ejecutar el Script `get_token.py`

    Instala `requests` si no lo tienes (`pip install requests`) y ejecuta el script: `python get_token.py`.

### Paso 4: Usar el Token para Probar

Copia el token largo que te devuelve el script.

**Opción A: Con FastAPI Docs (Swagger UI)**

1.  Ve a `http://localhost:8000/docs`.
2.  Haz clic en el botón **Authorize** en la esquina superior derecha.
3.  En el campo "Value" tu token. 
4.  Haz clic en "Authorize". Ahora todas tus peticiones desde esa página estarán autenticadas.

**Opción B: Con `curl`**

Usa el token en el encabezado `Authorization` para hacer peticiones desde la terminal.

```bash
curl -X POST "http://localhost:8000/orquestar_foto" \
     -H "Authorization: Bearer TU_TOKEN_AQUI" \
     -F "file=@/ruta/a/tu/imagen.jpg" \
     -F "org_id=clinica_demo" \
     -F "patient_id=paciente_001" \
     -F "session_id=sesion_abc"
```

## comandos:
gcloud builds submit --tag us-central1-docker.pkg.dev/terapia-471517/terappia/frontend:latest .
gcloud builds submit --tag us-central1-docker.pkg.dev/terapia-471517/terappia/orchestrator:latest .
