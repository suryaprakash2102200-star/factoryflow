"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import { Search, X, ClipboardList } from "lucide-react";
import { updateTaskStatusAction } from "./actions";

export interface TaskRow {
  id: string;
  item: string;
  status: string;
  effectiveStatus: string;
  priority: string;
  ecd: string | null;
  assigneeName: string | null;
  leadId: string | null;
  leadTitle: string | null;
}

const STATUSES = ["open", "in_progress", "done", "cancelled", "overdue"] as const;
const STATUS_COLOR: Record<string, string> = {
  open: "#64748b",
  in_progress: "#3b82f6",
  done: "#10b981",
  cancelled: "#94a3b8",
  overdue: "#ef4444",
};
const DROPPABLE: Record<string, boolean> = {
  open: true,
  in_progress: true,
  done: true,
  cancelled: true,
  overdue: false,
};
const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  critical: "bg-rose-50 text-rose-700",
};

type View = "kanban" | "list";

export function ActionTrackerClient({
  tasks,
  canEdit,
}: {
  tasks: TaskRow[];
  canEdit: boolean;
}) {
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks.filter((t) => {
      const matchStatus = statusFilter === "all" || t.effectiveStatus === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      const matchSearch =
        !q ||
        t.item.toLowerCase().includes(q) ||
        (t.assigneeName ?? "").toLowerCase().includes(q) ||
        (t.leadTitle ?? "").toLowerCase().includes(q);
      return matchStatus && matchPriority && matchSearch;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <Toggle active={view === "kanban"} onClick={() => setView("kanban")} label="Kanban" />
          <Toggle active={view === "list"} onClick={() => setView("list")} label="List" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Priority filter */}
        <div className="flex flex-wrap gap-1.5">
          {["all", "low", "medium", "high", "critical"].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p === priorityFilter ? "all" : p)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition border ${
                priorityFilter === p
                  ? p === "all"
                    ? "bg-slate-800 text-white border-slate-800"
                    : p === "critical"
                    ? "bg-rose-600 text-white border-rose-600"
                    : p === "high"
                    ? "bg-amber-500 text-white border-amber-500"
                    : p === "medium"
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-slate-500 text-white border-slate-500"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p === "all" ? "All priority" : p}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm focus:border-blue-400 focus:outline-none"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>

        {/* Count */}
        {(search || statusFilter !== "all" || priorityFilter !== "all") && (
          <span className="text-xs text-slate-400 ml-auto">
            {filtered.length} of {tasks.length}
          </span>
        )}
      </div>

      {view === "kanban" ? (
        <KanbanView tasks={filtered} canEdit={canEdit} />
      ) : (
        <ListView tasks={filtered} />
      )}
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function KanbanView({ tasks, canEdit }: { tasks: TaskRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const effective = (t: TaskRow) => optimistic[t.id] ?? t.effectiveStatus;

  const byStatus = new Map<string, TaskRow[]>();
  for (const s of STATUSES) byStatus.set(s, []);
  for (const t of tasks) byStatus.get(effective(t))?.push(t);

  function onDragStart(e: React.DragEvent, taskId: string) {
    if (!canEdit) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  }

  function onDrop(e: React.DragEvent, toStatus: string) {
    e.preventDefault();
    setDragOver(null);
    setDraggingId(null);
    if (!canEdit || !DROPPABLE[toStatus]) return;
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (!task || effective(task) === toStatus) return;
    setOptimistic((prev) => ({ ...prev, [taskId]: toStatus }));
    startTransition(async () => {
      try {
        await updateTaskStatusAction({ taskId, status: toStatus as "open" | "in_progress" | "done" | "cancelled" });
        router.refresh();
      } catch {
        setOptimistic((prev) => { const { [taskId]: _r, ...rest } = prev; return rest; });
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
      {STATUSES.map((s) => {
        const items = byStatus.get(s) ?? [];
        const isOver = dragOver === s;
        const droppable = DROPPABLE[s];
        return (
          <div
            key={s}
            onDragOver={(e) => {
              if (!canEdit || !droppable) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOver(s);
            }}
            onDragLeave={() => setDragOver((c) => (c === s ? null : c))}
            onDrop={(e) => onDrop(e, s)}
            className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 transition ${
              isOver ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                <span className="text-sm font-medium capitalize text-slate-900">{s.replace("_", " ")}</span>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{items.length}</span>
            </div>
            <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
              {items.map((t) => (
                <div
                  key={t.id}
                  draggable={canEdit && t.effectiveStatus !== "overdue"}
                  onDragStart={(e) => onDragStart(e, t.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow ${
                    canEdit ? "cursor-grab active:cursor-grabbing" : ""
                  } ${draggingId === t.id ? "opacity-50" : ""} ${isPending && optimistic[t.id] ? "opacity-60" : ""}`}
                >
                  <Link
                    href={t.leadId ? `/leads/${t.leadId}` : "#"}
                    className="block"
                    onClick={(e) => { if (draggingId) e.preventDefault(); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900 leading-snug">{t.item}</div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PRIORITY_STYLE[t.priority] ?? "bg-slate-100 text-slate-600"}`}>
                        {t.priority}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>{t.assigneeName ?? "Unassigned"}</span>
                      {t.ecd && (
                        <span className={t.effectiveStatus === "overdue" ? "font-medium text-rose-600" : ""}>
                          {new Date(t.ecd).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {t.leadTitle && (
                      <div className="mt-1 truncate text-xs text-slate-400">{t.leadTitle}</div>
                    )}
                  </Link>
                </div>
              ))}
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  {isOver ? "Drop here" : "Empty"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <tr key={t.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{t.item}</td>
                <td className="px-4 py-3">
                  {t.leadId ? (
                    <Link href={`/leads/${t.leadId}`} className="text-slate-700 hover:underline">
                      {t.leadTitle}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{t.assigneeName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PRIORITY_STYLE[t.priority] ?? "bg-slate-100 text-slate-600"}`}>
                    {t.priority}
                  </span>
                </td>
                <td className={`px-4 py-3 text-sm ${t.effectiveStatus === "overdue" ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                  {t.ecd ? new Date(t.ecd).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                    style={{ background: `${STATUS_COLOR[t.effectiveStatus]}20`, color: STATUS_COLOR[t.effectiveStatus] }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[t.effectiveStatus] }} />
                    {t.effectiveStatus.replace("_", " ")}
                  </span>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardList size={32} className="text-slate-300" />
                    <p className="text-sm text-slate-400">No tasks match your filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
