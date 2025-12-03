// src/components/AppLayout.tsx
import React, { useState, useMemo, ReactNode } from "react";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import AppSidebar from "./AppSidebar";

type AppLayoutProps = {
  children: ReactNode;
  title?: ReactNode;
  rightActions?: ReactNode;
};

export default function AppLayout({
  children,
  rightActions = null,
  title = null,
}: AppLayoutProps) {
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
    <div className="app-root">
      {/* HEADER */}
      <AppHeader {...headerProps} />

      {/* SHELL PRINCIPAL */}
      <div className="app-shell">
        {/* SIDEBAR */}
        <AppSidebar
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        {/* CONTENIDO */}
        <main className="app-main">{children}</main>
      </div>

      {/* FOOTER */}
      <AppFooter />

      {/* BACKDROP MOBILE */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
    </div>
  );
}
