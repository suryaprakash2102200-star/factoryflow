"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { UNITS } from "@/lib/factory";
import { createOrderAction, updateOrderAction } from "./actions";

type Item = { description: string; quantity: number; unit: string; unitPrice: number };

export type OrderFormValues = {
  id?: string;
  accountId: string | null;
  contactId: string | null;
  ownerId: string | null;
  orderDate: string;
  dueDate: string | null;
  poReference: string | null;
  currency: string;
  notes: string | null;
  items: Item[];
};

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"];
const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const label = "mb-1 block text-xs font-medium text-slate-600";

export function OrderForm({
  initial, accounts, contacts, users, onDone,
}: {
  initial?: OrderFormValues;
  accounts: { id: string; name: string }[];
  contacts: { id: string; fullName: string }[];
  users: { id: string; fullName: string }[];
  onDone: (id?: string) => void;
}) {
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    accountId: initial?.accountId ?? "",
    contactId: initial?.contactId ?? "",
    ownerId: initial?.ownerId ?? "",
    orderDate: initial?.orderDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate: initial?.dueDate?.slice(0, 10) ?? "",
    poReference: initial?.poReference ?? "",
    currency: initial?.currency ?? "USD",
    notes: initial?.notes ?? "",
  });
  const [items, setItems] = useState<Item[]>(initial?.items ?? [{ description: "", quantity: 1, unit: "pcs", unitPrice: 0 }]);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setItem = (i: number, k: keyof Item, v: string | number) =>
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const total = items.reduce((s, r) => s + r.quantity * r.unitPrice, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = items.filter((i) => i.description.trim());
    if (!clean.length) return toast.error("Add at least one line item");
    const payload = {
      accountId: f.accountId || null,
      contactId: f.contactId || null,
      ownerId: f.ownerId || null,
      orderDate: f.orderDate,
      dueDate: f.dueDate || null,
      poReference: f.poReference || null,
      currency: f.currency,
      notes: f.notes || null,
      items: clean,
    };
    start(async () => {
      try {
        if (initial?.id) {
          await updateOrderAction({ id: initial.id, ...payload });
          toast.success("Order updated");
          onDone(initial.id);
        } else {
          const { id } = await createOrderAction(payload);
          toast.success("Order created");
          onDone(id);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={label}>Customer</span>
          <select value={f.accountId} onChange={(e) => set("accountId", e.target.value)} className={input}>
            <option value="">—</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Contact</span>
          <select value={f.contactId} onChange={(e) => set("contactId", e.target.value)} className={input}>
            <option value="">—</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Owner</span>
          <select value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)} className={input}>
            <option value="">Me</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={label}>Order date</span>
          <input type="date" required value={f.orderDate} onChange={(e) => set("orderDate", e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Delivery due</span>
          <input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Customer PO</span>
            <input value={f.poReference} onChange={(e) => set("poReference", e.target.value)} className={input} placeholder="PO-123" />
          </label>
          <label className="block">
            <span className={label}>Currency</span>
            <select value={f.currency} onChange={(e) => set("currency", e.target.value)} className={input}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="w-24 px-3 py-2 text-right">Qty</th>
              <th className="w-24 px-3 py-2 text-left">Unit</th>
              <th className="w-32 px-3 py-2 text-right">Unit price</th>
              <th className="w-28 px-3 py-2 text-right">Amount</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5">
                  <input value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} placeholder="Product / job description" className={input} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min={0} step="any" value={it.quantity} onChange={(e) => setItem(i, "quantity", Number(e.target.value))} className={`${input} text-right`} />
                </td>
                <td className="px-2 py-1.5">
                  <select value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} className={input}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min={0} step="any" value={it.unitPrice} onChange={(e) => setItem(i, "unitPrice", Number(e.target.value))} className={`${input} text-right`} />
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{(it.quantity * it.unitPrice).toFixed(2)}</td>
                <td className="px-1 py-1.5">
                  <button type="button" onClick={() => setItems((r) => r.filter((_, idx) => idx !== i))} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove item">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
          <button type="button" onClick={() => setItems((r) => [...r, { description: "", quantity: 1, unit: "pcs", unitPrice: 0 }])} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
            <Plus size={14} /> Add item
          </button>
          <span className="text-sm font-semibold text-slate-900 tabular-nums">Total {total.toFixed(2)} {f.currency}</span>
        </div>
      </div>

      <label className="block">
        <span className={label}>Notes</span>
        <textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} className={input} placeholder="Delivery instructions, packing, etc." />
      </label>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={() => onDone()} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? "Saving…" : initial?.id ? "Save changes" : "Create order"}
        </button>
      </div>
    </form>
  );
}
