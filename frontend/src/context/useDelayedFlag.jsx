// src/hooks/useDelayedFlag.js
import { useEffect, useState } from "react";

export default function useDelayedFlag(active, delay = 300) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [active, delay]);
  return show;
}
