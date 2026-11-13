"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { listNotificationsAction, markNotificationsReadAction, type NotificationItem } from "./notification-actions";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: NotificationItem[] }>({ unread: 0, items: [] });

  const load = useCallback(() => {
    listNotificationsAction().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.read) await markNotificationsReadAction([n.id]);
    load();
    if (n.href) router.push(n.href);
  }

  async function readAll() {
    await markNotificationsReadAction();
    load();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <Bell size={16} />
        {data.unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold">Notifications</span>
              {data.unread > 0 && (
                <button onClick={readAll} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {data.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
              {data.items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-accent">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-blue-500"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read ? "text-muted-foreground" : "font-medium text-foreground"}`}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
