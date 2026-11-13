"use client";

import { useEffect, useState, Suspense } from "react";
import { useLocalFlag } from "@/lib/use-client-state";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { NavProgress } from "./NavProgress";
import { CommandPalette } from "./CommandPalette";
import { AiAssistant } from "./AiAssistant";
import type { Permission } from "@/lib/permissions";

export function AppShell({
  children,
  userName,
  userEmail,
  tenantName,
  permissions,
  modules,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  tenantName: string;
  permissions: Permission[];
  modules: string[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalFlag("sidebar-collapsed");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapse() {
    setCollapsed(!collapsed);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onOpenSearch={() => setSearchOpen(true)}
        permissions={permissions}
        modules={modules}
        tenantName={tenantName}
        userName={userName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onToggleSidebar={() => setMobileOpen((o) => !o)}
          userName={userName}
          userEmail={userEmail}
          tenantName={tenantName}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">{children}</main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} permissions={permissions} modules={modules} />
      {modules.includes("ai") && <AiAssistant />}
    </div>
  );
}
