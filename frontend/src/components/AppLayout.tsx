// src/components/AppLayout.tsx
import React, { useState, useMemo } from "react";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import AppSidebar from "./AppSidebar";

export default function AppLayout({ children, rightActions = null, title = null }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const headerProps = useMemo(
    () => ({
      onToggleSidebar: () => setSidebarOpen((v) => !v),
      rightActions,
      title,
    }),
    [rightActions, title]
  );

  return (
    <div style={{minHeight: "100vh", display:"flex", flexDirection:"column", background:"var(--bg)", color:"var(--text)"}}>
      <AppHeader {...headerProps} />

      <div className="app-shell">
        <AppSidebar collapsed={!sidebarOpen} />
        <main className="app-main">{children}</main>
      </div>

      <AppFooter />
    </div>
  );
}
