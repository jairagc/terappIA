// src/hooks/useDoctorProfile.js
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

/**
 * Lee el perfil del doctor en: orgs/{orgId}/doctors/{uid}
 * Campos sugeridos en Firestore: displayName, photoURL, role, email (opcional)
 * Prioriza displayName de Firestore; si no existe, usa fallback de Auth.
 */
export function useDoctorProfile(uid, fallbackDisplayName, fallbackPhotoURL, fallbackEmail) {
  const [orgId, setOrgId] = useState(() => localStorage.getItem("orgId") || "");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => setOrgId(localStorage.getItem("orgId") || ""), []);

  useEffect(() => {
    let alive = true;
    async function fetchProfile() {
      if (!uid || !orgId) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const ref = doc(db, "orgs", orgId, "doctors", uid);
        const snap = await getDoc(ref);
        if (!alive) return;
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch (e) {
        console.error("useDoctorProfile() error:", e);
        if (alive) setProfile(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchProfile();
    return () => { alive = false; };
  }, [uid, orgId]);

  const name = useMemo(
    () => (profile?.displayName || "").trim() || (fallbackDisplayName || "Doctor/a"),
    [profile?.displayName, fallbackDisplayName]
  );

  const photoURL = useMemo(
    () =>
      profile?.photoURL ||
      fallbackPhotoURL ||
      "https://ui-avatars.com/api/?name=Dr&background=0D8ABC&color=fff&rounded=true",
    [profile?.photoURL, fallbackPhotoURL]
  );

  const email = useMemo(
    () => (profile?.email || "").trim() || (fallbackEmail || ""),
    [profile?.email, fallbackEmail]
  );

  return { orgId, name, photoURL, role: profile?.role || "", email, profile, loading };
}
