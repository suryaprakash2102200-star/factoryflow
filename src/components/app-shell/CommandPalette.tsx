"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Plus } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { visibleGroups } from "./nav";

interface Entry {
  label: string;
  group: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export function CommandPalette({
  open,
  onClose,
  permissions,
  modules,
}: {
  open: boolean;
  onClose: () => void;
  permissions: Permission[];
  modules: string[];
}) {
  // Mounting only while open gives a fresh query/selection every time.
  if (!open) return null;
  return <Palette onClose={onClose} permissions={permissions} modules={modules} />;
}

function Palette({
  onClose,
  permissions,
  modules,
}: {
  onClose: () => void;
  permissions: Permission[];
  modules: string[];
}) {
  const router = useRouter();
  const [q, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const setQ = (v: string) => {
    setQuery(v);
    setIdx(0);
  };

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const g of visibleGroups(permissions, modules))
      for (const i of g.items) out.push({ label: i.label, group: g.label, href: i.href, icon: i.icon });
    if (permissions.includes("lead:create")) out.push({ label: "New enquiry", group: "Actions", href: "/leads/new", icon: Plus });
    if (permissions.includes("order:create") && modules.includes("orders"))
      out.push({ label: "New order", group: "Actions", href: "/orders", icon: Plus });
    return out;
  }, [permissions, modules]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? entries.filter((e) => e.label.toLowerCase().includes(s)) : entries;
  }, [q, entries]);

  function go(e?: Entry) {
    if (!e) return;
    onClose();
    router.push(e.href);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={16} className="text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") go(results[idx]);
            }}
            placeholder="Jump to a page or action…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</li>}
          {results.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={e.href + e.label}>
                <button
                  type="button"
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(e)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    i === idx ? "bg-accent text-accent-foreground" : "text-foreground/90"
                  }`}
                >
                  <Icon size={16} className="text-muted-foreground" />
                  <span className="flex-1">{e.label}</span>
                  <span className="text-[11px] text-muted-foreground">{e.group}</span>
                  {i === idx && <CornerDownLeft size={13} className="text-muted-foreground" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
