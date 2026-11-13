"use client";

import { Attachments } from "@/components/Attachments";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, ExternalLink, Clock } from "lucide-react";
import { Modal } from "@/components/Modal";
import { JOB_STAGE, JOB_STAGES, type JobStage } from "@/lib/factory";
import { updateJobStageAction, recordOutputAction, deleteJobAction } from "../actions";
import { JobForm } from "../JobForm";

type Job = {
  id: string;
  number: string;
  title: string;
  stage: JobStage;
  priority: "low" | "medium" | "high" | "critical";
  assigneeId: string | null;
  machineId?: string | null;
  machine?: string | null;
  assignee: string | null;
  order: { id: string; number: string; customer: string | null } | null;
  targetQty: number;
  outputQty: number;
  rejectQty: number;
  unit: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  specification: string | null;
  materialNotes: string | null;
  drawingUrl: string | null;
  updates: { id: string; fromStage: JobStage | null; toStage: JobStage | null; outputDelta: number; rejectDelta: number; note: string | null; by: string | null; at: string }[];
};

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export function JobDetailClient({
  job, users, canEdit, canDelete,
}: {
  job: Job;
  users: { id: string; fullName: string }[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [out, setOut] = useState({ output: "", reject: "", note: "" });

  const pct = job.targetQty ? Math.min(100, Math.round((job.outputQty / job.targetQty) * 100)) : 0;
  const remaining = Math.max(0, job.targetQty - job.outputQty);
  const finished = job.stage === "completed" || job.stage === "cancelled";
  const late = !finished && job.dueDate && new Date(job.dueDate) < new Date();

  function run(fn: () => Promise<unknown>, ok: string, after?: () => void) {
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        after?.();
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function submitOutput(e: React.FormEvent) {
    e.preventDefault();
    const output = Number(out.output || 0);
    const reject = Number(out.reject || 0);
    run(
      () => recordOutputAction({ id: job.id, output, reject, note: out.note }),
      "Output recorded",
      () => setOut({ output: "", reject: "", note: "" }),
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 md:py-8">
      <Link href="/production" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Production
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{job.number}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{job.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${JOB_STAGE[job.stage].color}`}>{JOB_STAGE[job.stage].label}</span>
            {late && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">Late</span>}
          </div>
          {job.order && (
            <p className="mt-1 text-sm text-slate-500">
              <Link href={`/orders/${job.order.id}`} className="hover:underline">{job.order.number}</Link>
              {job.order.customer ? ` · ${job.order.customer}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Pencil size={14} /> Edit
            </button>
          )}
          {canDelete && job.outputQty === 0 && (
            <button
              onClick={() => {
                if (!confirm(`Delete ${job.number}? This cannot be undone.`)) return;
                run(() => deleteJobAction({ id: job.id }), "Job deleted", () => router.push("/production"));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Stage switcher */}
      {canEdit && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5" role="group" aria-label="Job stage">
          {JOB_STAGES.map((s) => (
            <button
              key={s}
              disabled={pending || s === job.stage}
              onClick={() => run(() => updateJobStageAction({ id: job.id, stage: s }), `Moved to ${JOB_STAGE[s].label}`)}
              aria-pressed={s === job.stage}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                s === job.stage ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {JOB_STAGE[s].label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Progress */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500">Good output</p>
                <p className="text-3xl font-semibold tabular-nums text-slate-900">
                  {job.outputQty} <span className="text-base font-normal text-slate-500">/ {job.targetQty} {job.unit}</span>
                </p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>{pct}% done</p>
                <p>{remaining} {job.unit} left · {job.rejectQty} rejected</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>

            {canEdit && !finished && (
              <form onSubmit={submitOutput} className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_2fr_auto]">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Good qty</span>
                  <input type="number" min={0} step="any" value={out.output} onChange={(e) => setOut({ ...out, output: e.target.value })} className={input} placeholder="0" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Rejected</span>
                  <input type="number" min={0} step="any" value={out.reject} onChange={(e) => setOut({ ...out, reject: e.target.value })} className={input} placeholder="0" />
                </label>
                <label className="col-span-2 block sm:col-span-1">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Note</span>
                  <input value={out.note} onChange={(e) => setOut({ ...out, note: e.target.value })} className={input} placeholder="Shift, machine, reason for reject…" />
                </label>
                <button type="submit" disabled={pending} className="col-span-2 self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:col-span-1">
                  Record
                </button>
              </form>
            )}
          </section>

          {(job.specification || job.materialNotes || job.drawingUrl) && (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              {job.specification && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">Specification</h2>
                  <p className="whitespace-pre-line text-sm text-slate-600">{job.specification}</p>
                </div>
              )}
              {job.materialNotes && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">Material notes</h2>
                  <p className="whitespace-pre-line text-sm text-slate-600">{job.materialNotes}</p>
                </div>
              )}
              {job.drawingUrl && (
                <a href={job.drawingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                  Open drawing <ExternalLink size={13} />
                </a>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Work updates</h2>
            <ol className="divide-y divide-slate-100">
              {job.updates.map((u) => (
                <li key={u.id} className="flex gap-3 px-4 py-3 text-sm">
                  <Clock size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-slate-800">
                      {u.toStage
                        ? `${u.fromStage ? `${JOB_STAGE[u.fromStage].label} → ` : ""}${JOB_STAGE[u.toStage].label}`
                        : `+${u.outputDelta} ${job.unit} good${u.rejectDelta ? `, ${u.rejectDelta} rejected` : ""}`}
                    </p>
                    {u.note && <p className="text-xs text-slate-500">{u.note}</p>}
                    <p className="text-xs text-slate-400">{u.by ?? "System"} · {new Date(u.at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="h-fit rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Details</h2>
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ["Operator", job.assignee ?? "Unassigned"],
              ["Machine", job.machine ?? "—"],
              ["Priority", job.priority[0].toUpperCase() + job.priority.slice(1)],
              ["Start", job.startDate ? new Date(job.startDate).toLocaleDateString() : "—"],
              ["Due", job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "—"],
              ["Completed", job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <div className="lg:col-start-3">
          <Attachments entityType="production_job" entityId={job.id} canEdit={canEdit} />
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${job.number}`} size="lg">
        <JobForm
          initial={{
            id: job.id, title: job.title, orderId: job.order?.id ?? null, assigneeId: job.assigneeId, machineId: job.machineId ?? null, priority: job.priority,
            targetQty: job.targetQty, unit: job.unit, startDate: job.startDate, dueDate: job.dueDate,
            specification: job.specification, materialNotes: job.materialNotes, drawingUrl: job.drawingUrl,
          }}
          users={users}
          orders={[]}
          onDone={() => { setEditing(false); router.refresh(); }}
        />
      </Modal>
    </div>
  );
}
