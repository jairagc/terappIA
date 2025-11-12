export default function LoadingOverlay({ open, message }) {
  if (!open) return null;
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,.4)"
    }}>
      <div style={{
        display:"flex", alignItems:"center", gap:12,
        padding:14, borderRadius:12,
        background:"var(--card)", border:"1px solid var(--ring)"
      }}>
        <span className="spinner-md" />
        <span>{message || "Cargando…"}</span>
      </div>
    </div>
  );
}
