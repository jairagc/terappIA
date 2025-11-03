// src/pages/Profile.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebaseConfig"; // debe existir: export const db = getFirestore(app)
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Profile() {
  const { user, loading } = useAuth();
  const uid = user?.uid || null;

  // orgId debe ser escrito por el usuario (no listamos nada)
  const [orgId, setOrgId] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", role: "" });

  // estados UI
  const [ready, setReady] = useState(false);   // controla render inicial
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Prefill de nombre con displayName si existe
  const initial = useMemo(
    () => ({ name: user?.displayName || "", phone: "", role: "" }),
    [user]
  );

  // Render inmediato (no esperar Firestore) y prefill básico
  useEffect(() => {
    setForm((prev) => ({ ...initial, ...prev }));
    // si tienes un orgId persistido en localStorage, podrías levantarlo aquí
    const cachedOrg = localStorage.getItem("orgId") || "";
    if (cachedOrg) setOrgId(cachedOrg);
    setReady(true);
  }, [initial]);

  // Cargar perfil solo si ya hay uid + orgId
  useEffect(() => {
    let alive = true;
    async function loadFromFirestore() {
      if (!uid || !orgId) return; // sin org o uid, no intentamos leer
      try {
        const ref = doc(db, "orgs", orgId, "doctors", uid);
        const snap = await getDoc(ref);
        if (!alive) return;
        if (snap.exists()) {
          const data = snap.data();
          setForm({
            name: data?.name ?? initial.name,
            phone: data?.phone ?? "",
            role: data?.role ?? "",
          });
          setMsg("Perfil cargado de Firestore.");
        } else {
          setMsg("No había perfil en Firestore. Puedes capturarlo y guardar.");
        }
      } catch (e) {
        console.error("Error al cargar perfil:", e);
        setErr("No se pudo cargar tu perfil (revisa la consola).");
      }
    }
    loadFromFirestore();
    return () => { alive = false; };
  }, [uid, orgId, db]); // eslint-disable-line

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!uid) {
      setErr("No hay sesión activa.");
      return;
    }
    if (!orgId.trim()) {
      setErr("Debes escribir tu Organización / Institución.");
      return;
    }

    try {
      setSaving(true);
      const ref = doc(db, "orgs", orgId.trim(), "doctors", uid);
      await setDoc(
        ref,
        {
          ...form,
          email: user?.email ?? null,
          orgId: orgId.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // si quieres recordar org localmente para próximos arranques
      localStorage.setItem("orgId", orgId.trim());
      setMsg("Perfil guardado.");
    } catch (e) {
      console.error("Error al guardar perfil:", e);
      setErr("No se pudo guardar el perfil (revisa la consola y reglas).");
    } finally {
      setSaving(false);
    }
  };

  // Si el AuthContext aún está resolviendo, mostramos algo simple
  if (loading || !ready) {
    return <div className="p-8">Cargando…</div>;
  }

  // Render del formulario (nunca en blanco)
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1>Perfil</h1>
      <p style={{ marginBottom: 12 }}>
        Ruta de guardado: <code>orgs/{orgId || "{orgId}"}/doctors/{uid || "{uid}"}</code>
      </p>

      {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

      <form onSubmit={onSubmit}>
        {/* Organización: el usuario la escribe sí o sí */}
        <div style={{ marginBottom: 12 }}>
          <label>Organización / Institución *</label>
          <input
            type="text"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Ej. docker1, miClinica, etc."
            required
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Correo (solo lectura)</label>
          <input
            type="email"
            value={user?.email || ""}
            readOnly
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Nombre *</label>
          <input
            name="name"
            type="text"
            value={form.name}
            onChange={onChange}
            required
            placeholder="Tu nombre"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Teléfono</label>
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={onChange}
            placeholder="+52 ..."
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Rol / Puesto</label>
          <input
            name="role"
            type="text"
            value={form.role}
            onChange={onChange}
            placeholder="Terapeuta, Admin…"
            style={{ width: "100%" }}
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </div>
  );
}
