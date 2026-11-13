"use client";

import { useState } from "react";
import { useHydrated } from "@/lib/use-client-state";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, LogOut, ChevronRight, Sun, Moon } from "lucide-react";
import { signOutAction } from "./signout-action";
import { pageLabel } from "./nav";
import { NotificationBell } from "./NotificationBell";

export function Header({
  onToggleSidebar,
  userName,
  tenantName,
  userEmail,
}: {
  onToggleSidebar: () => void;
  userName: string;
  tenantName: string;
  userEmail: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHydrated();
  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onToggleSidebar}
        aria-label="Open menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
      >
        <Menu size={18} />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden truncate text-muted-foreground sm:inline">{tenantName}</span>
        <ChevronRight size={14} className="hidden shrink-0 text-muted-foreground/60 sm:inline" />
        <span className="truncate font-medium text-foreground">{pageLabel(pathname)}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Light theme" : "Dark theme"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 items-center gap-2 rounded-lg border border-border px-1.5 text-sm transition hover:bg-accent sm:pr-3"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold text-background">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden font-medium text-foreground sm:block">{userName}</span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
                <div className="border-b border-border px-4 py-3">
                  <div className="text-sm font-semibold">{userName}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{userEmail}</div>
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
