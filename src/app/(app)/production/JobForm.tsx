"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { UNITS } from "@/lib/factory";
import { createJobAction, updateJobAction, listMachinesAction } from "./actions";

export type JobFormValues = {
  id?: string;
  title: string;
  orderId: string | null;
  assigneeId: string | null;
  machineId?: string | null;
  priority: "low" | "medium" | "high" | "critical";
  targetQty: number;
  unit: string;
  startDate: string | null;
  dueDate: string | null;
  specification: string | null;
  materialNotes: string | null;
  drawingUrl: string | null;
};

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const label = "mb-1 block text-xs font-medium text-slate-600";

export function JobForm({
  initial, users, orders, onDone,
}: {
  initial?: JobFormValues;
  users: { id: string; fullName: string }[];
  orders: { id: string; label: string }[];
  onDone: (id?: string) => void;
}) {
  const [pending, start] = useTransition();
  const [machines, setMachines] = useState<{ id: string; code: string; name: string }[]>([]);
  useEffect(() => {
    let live = true;
    listMachinesAction().then((m) => { if (live) setMachines(m); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    orderId: initial?.orderId ?? "",
    assigneeId: initial?.assigneeId ?? "",
    machineId: initial?.machineId ?? "",
    priority: initial?.priority ?? "medium",
    targetQty: String(initial?.targetQty ?? 1),
    unit: initial?.unit ?? "pcs",
    startDate: initial?.startDate?.slice(0, 10) ?? "",
    dueDate: initial?.dueDate?.slice(0, 10) ?? "",
    specification: initial?.specification ?? "",
    materialNotes: initial?.materialNotes ?? "",
    drawingUrl: initial?.drawingUrl ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: f.title,
      orderId: f.orderId || null,
      assigneeId: f.assigneeId || null,
      machineId: f.machineId || null,
      priority: f.priority as JobFormValues["priority"],
      targetQty: Number(f.targetQty),
      unit: f.unit,
      startDate: f.startDate || null,
      dueDate: f.dueDate || null,
      specification: f.specification || null,
      materialNotes: f.materialNotes || null,
      drawingUrl: f.drawingUrl || null,
    };
    if (!(payload.targetQty > 0)) return toast.error("Target quantity must be more than 0");
    start(async () => {
      try {
        if (initial?.id) {
          await updateJobAction({ id: initial.id, ...payload });
          toast.success("Job updated");
          onDone(initial.id);
        } else {
          const { id } = await createJobAction(payload);
          toast.success("Job created");
          onDone(id);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <label className="block">
        <span className={label}>Product / job name</span>
        <input required value={f.title} onChange={(e) => set("title", e.target.value)} className={input} placeholder="e.g. MS bracket 40×40, powder coated" />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!initial?.id && (
          <label className="block">
            <span className={label}>Linked order</span>
            <select value={f.orderId} onChange={(e) => set("orderId", e.target.value)} className={input}>
              <option value="">No order (stock / internal)</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className={label}>Machine / work centre</span>
          <select value={f.machineId} onChange={(e) => set("machineId", e.target.value)} className={input}>
            <option value="">Not set</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Operator / assignee</span>
          <select value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)} className={input}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Target qty</span>
            <input type="number" min={0} step="any" required value={f.targetQty} onChange={(e) => set("targetQty", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Unit</span>
            <select value={f.unit} onChange={(e) => set("unit", e.target.value)} className={input}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className={label}>Priority</span>
          <select value={f.priority} onChange={(e) => set("priority", e.target.value)} className={input}>
            {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Start date</span>
          <input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Due date</span>
          <input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={input} />
        </label>
      </div>
      <label className="block">
        <span className={label}>Job specification</span>
        <textarea rows={3} value={f.specification} onChange={(e) => set("specification", e.target.value)} className={input} placeholder="Dimensions, tolerances, finish, process stages…" />
      </label>
      <label className="block">
        <span className={label}>Material notes</span>
        <textarea rows={2} value={f.materialNotes} onChange={(e) => set("materialNotes", e.target.value)} className={input} placeholder="Free text. Stock is not tracked until Inventory is enabled." />
      </label>
      <label className="block">
        <span className={label}>Drawing link</span>
        <input type="url" value={f.drawingUrl} onChange={(e) => set("drawingUrl", e.target.value)} className={input} placeholder="https://… (Drive, Dropbox, etc.)" />
      </label>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={() => onDone()} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? "Saving…" : initial?.id ? "Save changes" : "Create job"}
        </button>
      </div>
    </form>
  );
}
