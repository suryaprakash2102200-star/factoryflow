"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHydrated } from "@/lib/use-client-state";
import { Search, PanelLeft, ChevronsUpDown } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { visibleGroups, isActivePath, type NavItem } from "./nav";

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  onOpenSearch,
  permissions,
  modules,
  tenantName,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSearch: () => void;
  permissions: Permission[];
  modules: string[];
  tenantName: string;
  userName: string;
}) {
  const pathname = usePathname();
  const mounted = useHydrated();
  const groups = visibleGroups(permissions, modules);

  return (
    <>
      {mounted && open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:static md:inset-auto md:translate-x-0 ${collapsed ? "md:w-[60px]" : "md:w-60"}`}
      >
        {/* Brand */}
        <div className={`flex h-14 shrink-0 items-center gap-2.5 px-4 ${collapsed ? "md:justify-center md:px-0" : ""}`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[13px] font-bold text-white">
            F
          </div>
          <span className={`text-[15px] font-semibold tracking-tight text-foreground ${collapsed ? "md:hidden" : ""}`}>
            FactoryFlow
          </span>
        </div>

        {/* Search */}
        <div className={`px-3 pb-2 ${collapsed ? "md:px-2" : ""}`}>
          <button
            type="button"
            onClick={onOpenSearch}
            title="Search (Ctrl K)"
            className={`flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-background/40 px-2.5 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              collapsed ? "md:justify-center md:px-0" : ""
            }`}
          >
            <Search size={15} className="shrink-0" />
            <span className={`flex-1 text-left ${collapsed ? "md:hidden" : ""}`}>Search</span>
            <kbd
              className={`rounded border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px] ${collapsed ? "md:hidden" : ""}`}
            >
              Ctrl K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
          {groups.map((g) => (
            <div key={g.label} className="mt-3">
              <div className={`mb-1 px-2 text-[11px] font-medium text-muted-foreground ${collapsed ? "md:hidden" : ""}`}>
                {g.label}
              </div>
              {collapsed && <div className="mx-auto mb-2 hidden h-px w-6 bg-sidebar-border md:block" />}
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    collapsed={collapsed}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Workspace footer */}
        <div className="flex shrink-0 items-center gap-2 border-t border-sidebar-border p-3">
          <div className={`flex min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1 ${collapsed ? "md:hidden" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold text-foreground">
              {tenantName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-semibold text-foreground">{tenantName}</div>
              <div className="truncate text-[11px] text-muted-foreground">{userName}</div>
            </div>
            <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground md:inline-flex ${
              collapsed ? "md:mx-auto" : ""
            }`}
          >
            <PanelLeft size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  onClose,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClose: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition ${
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      } ${collapsed ? "md:justify-center md:px-0" : ""}`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconTone(item.href)}`}>
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
    </Link>
  );
}

/** Each menu entry gets its own colour so the list is easy to scan. */
const TONES: Record<string, string> = {
  "/": "bg-violet-500/15 text-violet-500",
  "/leads": "bg-sky-500/15 text-sky-500",
  "/contacts": "bg-pink-500/15 text-pink-500",
  "/accounts": "bg-emerald-500/15 text-emerald-500",
  "/reports": "bg-amber-500/15 text-amber-500",
  "/billing/quotes": "bg-indigo-500/15 text-indigo-500",
  "/orders": "bg-orange-500/15 text-orange-500",
  "/production": "bg-teal-500/15 text-teal-500",
  "/action-tracker": "bg-lime-500/15 text-lime-600",
  "/billing/invoices": "bg-rose-500/15 text-rose-500",
  "/admin/users": "bg-cyan-500/15 text-cyan-500",
  "/admin/roles": "bg-fuchsia-500/15 text-fuchsia-500",
  "/admin/stages": "bg-yellow-500/15 text-yellow-600",
  "/admin/fields": "bg-blue-500/15 text-blue-500",
  "/admin/masters": "bg-green-500/15 text-green-500",
  "/admin/modules": "bg-purple-500/15 text-purple-500",
  "/admin/tenant": "bg-slate-500/15 text-slate-500",
  "/admin/audit": "bg-red-500/15 text-red-500",
};
function iconTone(href: string) {
  return TONES[href] ?? "bg-violet-500/15 text-violet-500";
}
