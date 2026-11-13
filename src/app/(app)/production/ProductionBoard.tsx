"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, X, Factory, ChevronRight, ChevronLeft } from "lucide-react";
import { Modal } from "@/components/Modal";
import { BOARD_STAGES, JOB_STAGE, type JobStage } from "@/lib/factory";
import { updateJobStageAction } from "./actions";
import { JobForm } from "./JobForm";

export type JobCard = {
  id: string;
  number: string;
  title: string;
  stage: JobStage;
  priority: "low" | "medium" | "high" | "critical";
  assigneeId: string | null;
  assignee: string | null;
  machine?: string | null;
  orderId: string | null;
  orderNumber: string | null;
  customer: string | null;
  targetQty: number;
  outputQty: number;
  unit: string;
  dueDate: string | null;
  completedAt: string | null;
};

const PRIORITY_DOT: Record<JobCard["priority"], string> = {
  low: "bg-slate-300", medium: "bg-blue-400", high: "bg-amber-500", critical: "bg-rose-500",
};

/** Default left/right move on the board. Paused and QC are side states. */
const NEXT: Partial<Record<JobStage, JobStage>> = { planned: "in_progress", in_progress: "quality_check", paused: "in_progress", quality_check: "completed" };
const PREV: Partial<Record<JobStage, JobStage>> = { in_progress: "planned", quality_check: "in_progress", completed: "quality_check" };

export function ProductionBoard({
  jobs: initial, users, orders, meId, canCreate, canEdit,
}: {
  jobs: JobCard[];
  users: { id: string; fullName: string }[];
  orders: { id: string; label: string }[];
  meId: string;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    // server sent fresh data (router.refresh): drop optimistic state
    setSeen(initial);
    setJobs(initial);
  }
  const [search, setSearch] = useState("");
  const [who, setWho] = useState<"" | "me" | "none">("");
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();

  const [now] = useState(() => Date.now());
  const weekAgo = now - 7 * 86_400_000;
  const filtered = useMemo(() => {
    let rows = jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((j) => [j.number, j.title, j.orderNumber, j.customer, j.assignee].some((v) => (v ?? "").toLowerCase().includes(q)));
    }
    if (who === "me") rows = rows.filter((j) => j.assigneeId === meId);
    if (who === "none") rows = rows.filter((j) => !j.assigneeId);
    // keep the Completed column short: last 7 days only
    return rows.filter((j) => j.stage !== "completed" || !j.completedAt || new Date(j.completedAt).getTime() >= weekAgo);
  }, [jobs, search, who, meId, weekAgo]);

  const overdue = jobs.filter((j) => j.stage !== "completed" && j.dueDate && new Date(j.dueDate).getTime() < now).length;
  const active = jobs.filter((j) => j.stage === "in_progress").length;

  function moveTo(job: JobCard, stage: JobStage) {
    const before = jobs;
    setJobs((rows) => rows.map((r) => (r.id === job.id ? { ...r, stage } : r)));
    start(async () => {
      try {
        await updateJobStageAction({ id: job.id, stage });
        toast.success(`${job.number} → ${JOB_STAGE[stage].label}`);
        router.refresh();
      } catch (e) {
        setJobs(before);
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job, order, customer…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={who} onChange={(e) => setWho(e.target.value as typeof who)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Everyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
        </select>
        <span className="text-sm text-slate-500">{active} running · <span className={overdue ? "font-medium text-rose-600" : ""}>{overdue} overdue</span></span>
        {canCreate && (
          <button onClick={() => setCreating(true)} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
            <Plus size={16} /> New job
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Factory size={40} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No production jobs yet</p>
          <p className="mt-1 text-xs text-slate-400">Plan jobs from a confirmed order, or create one here.</p>
        </div>
      ) : (
        <div className="-mx-4 flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {BOARD_STAGES.map((stage) => {
            const col = filtered.filter((j) => j.stage === stage);
            return (
              <section key={stage} className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50">
                <header className="flex items-center gap-2 px-3 py-2.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: JOB_STAGE[stage].dot }} />
                  <h2 className="text-sm font-semibold text-slate-800">{JOB_STAGE[stage].label}</h2>
                  <span className="ml-auto text-xs tabular-nums text-slate-500">{col.length}</span>
                </header>
                <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {col.map((j) => {
                    const pct = j.targetQty ? Math.min(100, Math.round((j.outputQty / j.targetQty) * 100)) : 0;
                    const late = j.stage !== "completed" && j.dueDate && new Date(j.dueDate).getTime() < now;
                    return (
                      <article key={j.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <Link href={`/production/${j.id}`} className="block">
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[j.priority]}`} title={`${j.priority} priority`} />
                            {j.number}
                            {j.orderNumber && <span>· {j.orderNumber}</span>}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{j.title}</p>
                          {j.customer && <p className="truncate text-xs text-slate-500">{j.customer}</p>}
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-xs">
                            <span className="tabular-nums text-slate-500">{j.outputQty}/{j.targetQty} {j.unit}</span>
                            {j.dueDate && (
                              <span className={late ? "font-medium text-rose-600" : "text-slate-500"}>
                                {late ? "Late · " : ""}{new Date(j.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">{j.assignee ?? "Unassigned"}{j.machine && <span className="ml-1 rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-600">{j.machine}</span>}</p>
                        </Link>
                        {canEdit && (
                          <div className="mt-2 flex items-center gap-1 border-t border-slate-100 pt-2">
                            {PREV[j.stage] && (
                              <button disabled={pending} onClick={() => moveTo(j, PREV[j.stage]!)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Move back to ${JOB_STAGE[PREV[j.stage]!].label}`} title={`Back to ${JOB_STAGE[PREV[j.stage]!].label}`}>
                                <ChevronLeft size={14} />
                              </button>
                            )}
                            {j.stage === "in_progress" && (
                              <button disabled={pending} onClick={() => moveTo(j, "paused")} className="rounded-md px-2 py-0.5 text-xs text-slate-500 hover:bg-amber-50 hover:text-amber-700">Pause</button>
                            )}
                            {NEXT[j.stage] && (
                              <button disabled={pending} onClick={() => moveTo(j, NEXT[j.stage]!)} className="ml-auto inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                                {j.stage === "planned" ? "Start" : j.stage === "paused" ? "Resume" : JOB_STAGE[NEXT[j.stage]!].label}
                                <ChevronRight size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">No jobs</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New production job" size="lg">
        <JobForm users={users} orders={orders} onDone={(id) => { setCreating(false); if (id) router.push(`/production/${id}`); }} />
      </Modal>
    </>
  );
}
