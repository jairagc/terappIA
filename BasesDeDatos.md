# 🧠 TerappIA – Esquema de Datos y Almacenamiento

Arquitectura para almacenar y procesar información de doctores, pacientes, notas, análisis de emociones y notas de evolución.  
Integra **Firebase Auth + Firestore + GCS + BigQuery**.
---
## 🧩 Identidades y Llaves

| Campo | Tipo | Descripción |
|-------|------|--------------|
| `org_id` | STRING | Identificador de la clínica o institución |
| `doctor_uid` | STRING | UID de Firebase Auth del doctor |
| `patient_id` | STRING (ULID/UUIDv7) | ID único del paciente |
| `session_id` | STRING (ULID/UUIDv7) | ID único por sesión |
| `note_id` | STRING (ULID/UUIDv7) | ID único por nota (imagen/texto) |

---

## 🔥 Firestore (Metadatos y Relaciones)

Estructura jerárquica:
/orgs/{org_id}
/orgs/{org_id}/doctors/{doctor_uid}
/orgs/{org_id}/doctors/{doctor_uid}/patients/{patient_id}
/orgs/{org_id}/doctors/{doctor_uid}/patients/{patient_id}/sessions/{session_id}
/orgs/{org_id}/doctors/{doctor_uid}/patients/{patient_id}/sessions/{session_id}/notes/{note_id}

### Ejemplo de Documentos
**Doctor**
```json
{
  "doctor_uid": "...",
  "org_id": "clinica_azul",
  "name": "Dra. X",
  "specialty": "Psicoterapia",
  "created_at": "<timestamp>",
  "status": "active"
} 
```
**Patient**
```json
{
  "patient_id": "...",
  "doctor_uid": "...",
  "org_id": "clinica_azul",
  "display_code": "PX-0137",
  "pii_ref": "bq://.../patients_pii.patient_row_id",
  "dob": "YYYY-MM-DD",
  "sex": "F/M/X/NA",
  "created_at": "<timestamp>",
  "active": true
}
```

**session**
```json
{
  "session_id": "...",
  "date": "YYYY-MM-DD",
  "start_ts": "<timestamp>",
  "end_ts": "<timestamp>",
  "gcs_folder": "gs://terappia-prod/clinica_azul/{doctor_uid}/{patient_id}/sessions/{session_id}/",
  "status_pipeline": "done|processing|error",
  "evolution_note_txt": "Texto redactado por el doctor",
  "evolution_note_md_uri": "gs://.../evolution_note.md",
  "created_at": "<timestamp>"
} 
```

**note**
```json
{
  "note_id": "...",
  "type": "image|text",
  "source": "upload|gcs_uri",
  "gcs_uri": "gs://.../notes/{note_id}.png|.txt|.json",
  "ocr_text": "...",
  "nlp_model": "gemini-2.5-flash-l",
  "emotions": { "joy": 0.21, "sadness": 0.53, "anger": 0.07, "fear": 0.12, "neutral": 0.35 },
  "entities": [{ "text": "madre", "type": "PERSON_REL", "salience": 0.18 }],
  "language": "es",
  "created_at": "<timestamp>",
  "processed_at": "<timestamp>"
}
```

## Google Cloud Storage  (archivos multimedia)
```bash
gs://terappia-{env}/
  {org_id}/{doctor_uid}/{patient_id}/
    sessions/{session_id}/
      raw/
        img_001.png
        audio_001.wav
      derived/
        ocr/ocr_img_001.json
        emotions/emotions_img_001.json
        text/note_001.txt
        evolution/evolution_note.md
BigQuery (Reporting y Analytics)
```
## BigQuery (Reporting y Analytics)
Particionar por ds, clusterizar por org_id, doctor_uid, patient_id.

### Tablas Principales

*patients*
```sql
patient_id STRING,
org_id STRING,
doctor_uid STRING,
display_code STRING,
created_ts TIMESTAMP,
created_ds DATE
```
*patients_pii*
```sql
patient_id STRING,
org_id STRING,
doctor_uid STRING,
full_name STRING,
dob DATE,
sex STRING,
contact_phone STRING,
contact_email STRING,
created_ts TIMESTAMP,
created_ds DATE
```
*sessions*
```sql
session_id STRING,
patient_id STRING,
doctor_uid STRING,
org_id STRING,
ds DATE,
start_ts TIMESTAMP,
end_ts TIMESTAMP,
gcs_folder STRING,
evolution_note_txt STRING,
model_version STRING,
status_pipeline STRING,
created_ts TIMESTAMP
```
*notes*
```sql
note_id STRING,
session_id STRING,
patient_id STRING,
doctor_uid STRING,
org_id STRING,
ds DATE,
type STRING,
gcs_uri STRING,
language STRING,
ocr_text STRING,
created_ts TIMESTAMP,
processed_ts TIMESTAMP
```
*notes_emotions*
```sql
note_id STRING,
session_id STRING,
patient_id STRING,
doctor_uid STRING,
org_id STRING,
ds DATE,
nlp_model STRING,
emotion STRING,
score FLOAT64,
extra JSON,
created_ts TIMESTAMP
```
*evolution_notes*
```sql
session_id STRING,
patient_id STRING,
doctor_uid STRING,
org_id STRING,
ds DATE,
note_md_uri STRING,
note_txt STRING,
created_ts TIMESTAMP
```

### Seguridad y Gobierno
*Firestore Security Rules*
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /orgs/{orgId}/doctors/{doctorUid}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == doctorUid;
    }
  }
}
```
*GCS*
Acceso mediante Signed URLs
Prefijos por usuario y paciente
Opcional: VPC-SC + CMEK

*BigQuery*
Row-Level Security (ejemplo):
```sql
CREATE OR REPLACE ROW ACCESS POLICY rlp_doctor
ON `terappia_prod.sessions`
GRANT TO ("user:app-sa@project.iam.gserviceaccount.com")
FILTER USING (doctor_uid = SESSION_USER());
```

⚙️ Flujo de Procesamiento

1. Upload (móvil/web) → GCS raw/…
2. Firestore crea documento note (status=processing)
3. Cloud Run / Cloud Function:
    OCR / STT → guarda JSON en derived/ocr/
    Análisis emocional → guarda JSON en derived/emotions/
4. Ingesta a BigQuery
    notes y notes_emotions
5. Redacción de evolución
    Doctor escribe → guarda en derived/evolution/
    Copia a Firestore + BQ
6. Status final
    Firestore: status_pipeline = "done"

## Rutas y URIs Ejemplo
```bash
gs://terappia/clinica_azul/{doctor_uid}/{patient_id}/sessions/{session_id}/
  raw/img_001.png
  derived/ocr/ocr_img_001.json
  derived/emotions/emotions_img_001.json
  text/note_001.txt
  evolution/evolution_note.md
```