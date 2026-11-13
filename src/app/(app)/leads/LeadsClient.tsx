"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import { Search, X, LayoutGrid, List } from "lucide-react";
import { changeStageAction } from "./[id]/actions";

export interface LeadRow {
  id: string;
  title: string;
  stageId: string;
  stageName: string;
  stageColor: string;
  ownerName: string | null;
  estimatedValue: number | null;
  createdAt: string;
  customValues: Record<string, unknown>;
}
export interface StageRow {
  id: string;
  name: string;
  color: string;
}
export interface FieldDef {
  id: string;
  key: string;
  label: string;
  type: string;
}

type View = "kanban" | "list";

export function LeadsClient({
  leads,
  stages,
  defs,
  canEditLead,
}: {
  leads: LeadRow[];
  stages: StageRow[];
  defs: FieldDef[];
  canEditLead: boolean;
}) {
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return leads.filter((l) => {
      const matchStage = stageFilter === "all" || l.stageId === stageFilter;
      const matchSearch =
        !q ||
        l.title.toLowerCase().includes(q) ||
        (l.ownerName ?? "").toLowerCase().includes(q);
      return matchStage && matchSearch;
    });
  }, [leads, search, stageFilter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <ToggleButton active={view === "kanban"} onClick={() => setView("kanban")} label="Kanban" icon={<LayoutGrid size={14} />} />
          <ToggleButton active={view === "list"} onClick={() => setView("list")} label="List" icon={<List size={14} />} />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads…"
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

        {/* Stage filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStageFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              stageFilter === "all"
                ? "bg-slate-800 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => setStageFilter(stageFilter === s.id ? "all" : s.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                stageFilter === s.id
                  ? "text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              style={stageFilter === s.id ? { backgroundColor: s.color } : {}}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageFilter === s.id ? "rgba(255,255,255,0.7)" : s.color }} />
              {s.name}
            </button>
          ))}
        </div>

        {/* Result count */}
        {(search || stageFilter !== "all") && (
          <span className="text-xs text-slate-400 ml-auto">
            {filtered.length} of {leads.length}
          </span>
        )}
      </div>

      {view === "kanban" ? (
        <KanbanView
          leads={filtered}
          stages={stageFilter === "all" ? stages : stages.filter(s => s.id === stageFilter)}
          allStages={stages}
          canEditLead={canEditLead}
        />
      ) : (
        <ListView leads={filtered} defs={defs} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function KanbanView({
  leads,
  stages,
  allStages,
  canEditLead,
}: {
  leads: LeadRow[];
  stages: StageRow[];
  allStages: StageRow[];
  canEditLead: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const effectiveStageId = (l: LeadRow) => optimistic[l.id] ?? l.stageId;

  const byStage = new Map<string, LeadRow[]>();
  for (const s of allStages) byStage.set(s.id, []);
  for (const l of leads) byStage.get(effectiveStageId(l))?.push(l);

  function onDragStart(e: React.DragEvent, leadId: string) {
    if (!canEditLead) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(leadId);
  }

  function onDrop(e: React.DragEvent, toStageId: string) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("text/plain");
    setDragOverStage(null);
    setDraggingId(null);
    if (!leadId || !canEditLead) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || effectiveStageId(lead) === toStageId) return;
    setOptimistic((prev) => ({ ...prev, [leadId]: toStageId }));
    startTransition(async () => {
      try {
        await changeStageAction({ leadId, toStageId });
        router.refresh();
      } catch {
        setOptimistic((prev) => { const { [leadId]: _r, ...rest } = prev; return rest; });
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
      {stages.map((s) => {
        const items = byStage.get(s.id) ?? [];
        const isOver = dragOverStage === s.id;
        const colValue = items.reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
        return (
          <div
            key={s.id}
            onDragOver={(e) => {
              if (!canEditLead) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverStage(s.id);
            }}
            onDragLeave={() => setDragOverStage((c) => (c === s.id ? null : c))}
            onDrop={(e) => onDrop(e, s.id)}
            className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 transition ${
              isOver ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-sm font-medium text-slate-900">{s.name}</span>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {items.length}
              </span>
            </div>
            {colValue > 0 && (
              <div className="mb-2.5 text-xs font-medium text-slate-400">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" }).format(colValue)}
              </div>
            )}
            <div className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
              {items.map((l) => (
                <div
                  key={l.id}
                  draggable={canEditLead}
                  onDragStart={(e) => onDragStart(e, l.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={`group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow ${
                    canEditLead ? "cursor-grab active:cursor-grabbing" : ""
                  } ${draggingId === l.id ? "opacity-50" : ""} ${
                    isPending && optimistic[l.id] ? "opacity-60" : ""
                  }`}
                >
                  <Link
                    href={`/leads/${l.id}`}
                    className="block"
                    onClick={(e) => { if (draggingId) e.preventDefault(); }}
                  >
                    <div className="text-sm font-medium text-slate-900 leading-snug">
                      {l.title}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <span className="text-xs text-slate-500 truncate">
                        {l.ownerName ?? "Unassigned"}
                      </span>
                      {l.estimatedValue != null && l.estimatedValue > 0 && (
                        <span className="shrink-0 text-xs font-semibold text-emerald-600">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(l.estimatedValue)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </div>
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

function ListView({ leads, defs }: { leads: LeadRow[]; defs: FieldDef[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Value</th>
              {defs.slice(0, 3).map((d) => (
                <th key={d.id} className="px-4 py-3">{d.label}</th>
              ))}
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} className="transition hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${l.id}`} className="font-medium text-slate-900 hover:underline">
                    {l.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.stageColor }} />
                    {l.stageName}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.ownerName ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-emerald-700">
                  {l.estimatedValue != null && l.estimatedValue > 0
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(l.estimatedValue)
                    : <span className="text-slate-400 font-normal">—</span>}
                </td>
                {defs.slice(0, 3).map((d) => (
                  <td key={d.id} className="px-4 py-3 text-slate-600">
                    {formatValue(l.customValues[d.key], d.type)}
                  </td>
                ))}
                <td className="px-4 py-3 text-slate-500">
                  {new Date(l.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5 + Math.min(defs.length, 3)} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={32} className="text-slate-300" />
                    <p className="text-sm text-slate-400">No leads match your search.</p>
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

function formatValue(v: unknown, type: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "currency" || type === "number")
    return typeof v === "number" ? v.toLocaleString() : String(v);
  if (type === "date" || type === "datetime")
    return new Date(String(v)).toLocaleDateString();
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}
