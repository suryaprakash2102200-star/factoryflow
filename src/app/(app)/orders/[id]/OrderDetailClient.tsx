"use client";

import { Attachments } from "@/components/Attachments";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Factory, Check, Clock } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ORDER_STATUS, ORDER_TRANSITIONS, JOB_STAGE, type OrderStatus, type JobStage } from "@/lib/factory";
import { updateOrderStatusAction, deleteOrderAction } from "../actions";
import { createJobsFromOrderAction } from "../../production/actions";
import { OrderForm } from "../OrderForm";
import { OrderStatusPill, fmtMoney } from "../OrdersClient";

type Detail = {
  id: string;
  number: string;
  status: OrderStatus;
  accountId: string | null;
  accountName: string | null;
  contactId: string | null;
  contact: { id: string; fullName: string; phone: string | null; email: string | null } | null;
  ownerId: string | null;
  ownerName: string | null;
  quote: { id: string; number: string } | null;
  orderDate: string;
  dueDate: string | null;
  dispatchedAt: string | null;
  poReference: string | null;
  currency: string;
  total: number;
  notes: string | null;
  items: { id: string; description: string; quantity: number; unit: string; unitPrice: number; amount: number }[];
  history: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; by: string | null; at: string }[];
  jobs: { id: string; number: string; title: string; stage: JobStage; assignee: string | null; targetQty: number; outputQty: number; unit: string; dueDate: string | null }[];
};

const FLOW: OrderStatus[] = ["draft", "confirmed", "in_production", "ready", "dispatched", "closed"];
const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  in_production: "Start production",
  ready: "Mark ready for dispatch",
  dispatched: "Mark dispatched",
  closed: "Close order",
  cancelled: "Cancel order",
};

export function OrderDetailClient({
  order, accounts, contacts, users, canEdit, canDelete, canCreateJob,
}: {
  order: Detail;
  accounts: { id: string; name: string }[];
  contacts: { id: string; fullName: string }[];
  users: { id: string; fullName: string }[];
  canEdit: boolean;
  canDelete: boolean;
  canCreateJob: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [move, setMove] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");

  const next = ORDER_TRANSITIONS[order.status];
  const flowIdx = FLOW.indexOf(order.status);
  const editable = canEdit && (order.status === "draft" || order.status === "confirmed");
  const produced = order.jobs.reduce((s, j) => s + j.outputQty, 0);
  const target = order.jobs.reduce((s, j) => s + j.targetQty, 0);
  const jobsDone = order.jobs.filter((j) => j.stage === "completed").length;
  const overdue = order.dueDate && !["dispatched", "closed", "cancelled"].includes(order.status) && new Date(order.dueDate) < new Date();

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 md:py-8">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{order.number}</h1>
            <OrderStatusPill status={order.status} />
            {overdue && <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">Overdue</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {order.accountName ?? order.contact?.fullName ?? "No customer"}
            {order.quote && (
              <> · from <Link href="/billing/quotes" className="hover:underline">{order.quote.number}</Link></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Pencil size={14} /> Edit
            </button>
          )}
          {canDelete && (order.status === "draft" || order.status === "cancelled") && (
            <button
              onClick={() => {
                if (!confirm(`Delete ${order.number}? This cannot be undone.`)) return;
                run(() => deleteOrderAction({ id: order.id }), "Order deleted", () => router.push("/orders"));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          {canEdit && next.filter((s) => s !== "cancelled").map((s, i) => (
            <button
              key={s}
              disabled={pending}
              onClick={() => { setNote(""); setMove(s); }}
              className={
                i === 0
                  ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              }
            >
              {s === "in_production" && order.status === "ready" ? "Back to production" : ACTION_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Stepper */}
      {order.status !== "cancelled" ? (
        <ol className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-6">
          {FLOW.map((s, i) => {
            const done = i < flowIdx || order.status === "closed";
            const current = i === flowIdx && order.status !== "closed";
            return (
              <li key={s} className="flex items-center gap-2 text-xs">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    done ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-blue-600 text-blue-600" : "border-slate-300 text-slate-400"
                  }`}
                >
                  {done ? <Check size={12} /> : i + 1}
                </span>
                <span className={current ? "font-semibold text-slate-900" : done ? "text-slate-600" : "text-slate-400"}>{ORDER_STATUS[s].label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">This order was cancelled.</div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Items */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Line items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit price</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-4 py-2.5 text-slate-800">{it.description}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{it.quantity} {it.unit}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(order.currency, it.unitPrice)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{fmtMoney(order.currency, it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={3} className="px-4 py-2.5 text-right text-sm font-semibold text-slate-900">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-slate-900">{fmtMoney(order.currency, order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Production */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Production</h2>
              {order.jobs.length > 0 && (
                <span className="text-xs text-slate-500">{jobsDone}/{order.jobs.length} jobs done · {produced}/{target} produced</span>
              )}
            </div>
            {order.jobs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <Factory size={28} className="text-slate-300" />
                <p className="text-sm text-slate-500">No production jobs yet.</p>
                {canCreateJob && order.status !== "draft" && !["dispatched", "closed", "cancelled"].includes(order.status) && (
                  <button
                    disabled={pending}
                    onClick={() => run(() => createJobsFromOrderAction({ orderId: order.id }), "Jobs planned from line items")}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Plan jobs from line items
                  </button>
                )}
                {order.status === "draft" && <p className="text-xs text-slate-400">Confirm the order to plan production.</p>}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {order.jobs.map((j) => {
                  const pct = j.targetQty ? Math.min(100, Math.round((j.outputQty / j.targetQty) * 100)) : 0;
                  return (
                    <li key={j.id}>
                      <Link href={`/production/${j.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-slate-50/60">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{j.number} · {j.title}</p>
                          <p className="text-xs text-slate-500">{j.assignee ?? "Unassigned"}{j.dueDate ? ` · due ${new Date(j.dueDate).toLocaleDateString()}` : ""}</p>
                          <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">{j.outputQty}/{j.targetQty} {j.unit}</span>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${JOB_STAGE[j.stage].color}`}>{JOB_STAGE[j.stage].label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Details</h2>
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                ["Customer", order.accountName ?? "—"],
                ["Contact", order.contact ? [order.contact.fullName, order.contact.phone].filter(Boolean).join(" · ") : "—"],
                ["Owner", order.ownerName ?? "—"],
                ["Order date", new Date(order.orderDate).toLocaleDateString()],
                ["Delivery due", order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "—"],
                ["Customer PO", order.poReference ?? "—"],
                ["Dispatched", order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleString() : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            {order.notes && <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600 whitespace-pre-line">{order.notes}</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Status history</h2>
            <ol className="space-y-3 px-4 py-3">
              {order.history.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <Clock size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-slate-800">
                      {h.fromStatus ? `${ORDER_STATUS[h.fromStatus].label} → ` : ""}{ORDER_STATUS[h.toStatus].label}
                    </p>
                    {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                    <p className="text-xs text-slate-400">{h.by ?? "System"} · {new Date(h.at).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <Attachments entityType="order" entityId={order.id} canEdit={canEdit} title="Files (PO, drawings)" />

          {canEdit && next.includes("cancelled") && (
            <button onClick={() => { setNote(""); setMove("cancelled"); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
              Cancel order
            </button>
          )}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${order.number}`} size="xl">
        <OrderForm
          initial={{
            id: order.id, accountId: order.accountId, contactId: order.contactId, ownerId: order.ownerId,
            orderDate: order.orderDate, dueDate: order.dueDate, poReference: order.poReference, currency: order.currency,
            notes: order.notes, items: order.items.map(({ description, quantity, unit, unitPrice }) => ({ description, quantity, unit, unitPrice })),
          }}
          accounts={accounts}
          contacts={contacts}
          users={users}
          onDone={() => { setEditing(false); router.refresh(); }}
        />
      </Modal>

      <Modal open={!!move} onClose={() => setMove(null)} title={move ? ACTION_LABEL[move] : ""} size="sm">
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600">
            {ORDER_STATUS[order.status].label} → <b>{move ? ORDER_STATUS[move].label : ""}</b>
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={move === "dispatched" ? "Vehicle / LR number, courier…" : move === "cancelled" ? "Reason for cancelling" : ""}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setMove(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Back</button>
            <button
              disabled={pending}
              onClick={() => move && run(() => updateOrderStatusAction({ id: order.id, status: move, note }), `Order ${ORDER_STATUS[move].label.toLowerCase()}`, () => setMove(null))}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${move === "cancelled" ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {pending ? "Saving…" : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
