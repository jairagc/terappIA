import React from "react";

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{fontSize:13, opacity:.85}}>
          <div>contacto@terappia.com</div>
          <div>+1 (234) 567-890</div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <a className="btn icon" href="#" aria-label="X/Twitter" title="X/Twitter">
            <span className="material-symbols-outlined">public</span>
          </a>
          <a className="btn icon" href="#" aria-label="Instagram" title="Instagram">
            <span className="material-symbols-outlined">camera</span>
          </a>
          <a className="btn icon" href="#" aria-label="LinkedIn" title="LinkedIn">
            <span className="material-symbols-outlined">work</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
