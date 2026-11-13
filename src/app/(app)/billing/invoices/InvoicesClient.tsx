"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, X, Trash2, Pencil, FileText, Send, CheckCircle2, AlertCircle, GripVertical, Download } from "lucide-react";
import { createInvoiceAction, updateInvoiceAction, updateInvoiceStatusAction, deleteInvoiceAction } from "./actions";

type InvoiceType = "invoice" | "proforma";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft:     { label: "Draft",     color: "bg-slate-100 text-slate-600" },
  sent:      { label: "Sent",      color: "bg-blue-100 text-blue-700" },
  paid:      { label: "Paid",      color: "bg-emerald-100 text-emerald-700" },
  overdue:   { label: "Overdue",   color: "bg-rose-100 text-rose-700" },
  cancelled: { label: "Cancelled", color: "bg-slate-200 text-slate-500" },
  partial:   { label: "Partial",   color: "bg-amber-100 text-amber-700" },
};

type LineItem = { description: string; quantity: number; unitPrice: number; discount: number; taxRate: number; amount: number; orderIndex: number };

type InvoiceRow = {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  contactId: string | null;
  contactName: string | null;
  accountId: string | null;
  accountName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
  currency: string;
  total: number;
  amountPaid: number;
  itemCount: number;
  items: LineItem[];
  notes: string | null;
  terms: string | null;
  createdAt: string;
};

type Props = {
  invoices: InvoiceRow[];
  contacts: { id: string; fullName: string }[];
  accounts: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "CAD"];

function calcItem(item: LineItem): number {
  const base = item.quantity * item.unitPrice;
  const afterDiscount = base - (base * item.discount) / 100;
  const withTax = afterDiscount + (afterDiscount * item.taxRate) / 100;
  return Math.round(withTax * 100) / 100;
}

function fmt(currency: string, amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function LineItemsEditor({ items, currency, onChange }: { items: LineItem[]; currency: string; onChange: (items: LineItem[]) => void }) {
  function addRow() { onChange([...items, { description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, amount: 0, orderIndex: 0 }]); }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function update(i: number, field: keyof LineItem, val: number | string) {
    const next = items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      updated.amount = calcItem(updated);
      return updated;
    });
    onChange(next);
  }
  const subtotal = items.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const discountAmt = items.reduce((s, r) => { const b = r.quantity * r.unitPrice; return s + (b * r.discount) / 100; }, 0);
  const taxAmt = items.reduce((s, r) => { const b = r.quantity * r.unitPrice; const a = b - (b * r.discount) / 100; return s + (a * r.taxRate) / 100; }, 0);
  const total = items.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Description</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-20">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-28">Unit Price</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-20">Disc%</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-20">Tax%</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-28">Amount</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {items.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-2 py-1.5 text-slate-300"><GripVertical size={14} /></td>
                <td className="px-2 py-1.5">
                  <input value={item.description} onChange={e => update(i, "description", e.target.value)} placeholder="Item description…"
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min={0} value={item.quantity} onChange={e => update(i, "quantity", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min={0} step="0.01" value={item.unitPrice} onChange={e => update(i, "unitPrice", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min={0} max={100} value={item.discount} onChange={e => update(i, "discount", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min={0} max={100} value={item.taxRate} onChange={e => update(i, "taxRate", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md" />
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-slate-700">{fmt(currency, item.amount)}</td>
                <td className="px-2 py-1.5">
                  <button type="button" onClick={() => remove(i)} className="rounded p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"><X size={14} /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">No items yet — add your first line item</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-start justify-between gap-4">
        <button type="button" onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition">
          <Plus size={13} /> Add line item
        </button>
        <div className="space-y-1 text-sm min-w-[200px]">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(currency, subtotal)}</span></div>
          {discountAmt > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{fmt(currency, discountAmt)}</span></div>}
          {taxAmt > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>+{fmt(currency, taxAmt)}</span></div>}
          <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1 mt-1"><span>Total</span><span>{fmt(currency, total)}</span></div>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({ invoice, contacts, accounts, users, onClose }: {
  invoice?: InvoiceRow; contacts: { id: string; fullName: string }[];
  accounts: { id: string; name: string }[]; users: { id: string; fullName: string }[]; onClose: () => void;
}) {
  const isEdit = !!invoice;
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<InvoiceType>(invoice?.type ?? "invoice");
  const [currency, setCurrency] = useState(invoice?.currency ?? "USD");
  const [items, setItems] = useState<LineItem[]>(
    invoice?.items?.length ? invoice.items : [{ description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, amount: 0, orderIndex: 0 }]
  );
  const [form, setForm] = useState({
    contactId: invoice?.contactId ?? "",
    accountId: invoice?.accountId ?? "",
    ownerId: invoice?.ownerId ?? "",
    issueDate: invoice?.issueDate ? invoice.issueDate.slice(0, 10) : today(),
    dueDate: invoice?.dueDate ? invoice.dueDate.slice(0, 10) : addDays(30),
    notes: invoice?.notes ?? "",
    terms: invoice?.terms ?? "Payment due on receipt.",
  });
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const subtotal = items.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const discountAmt = items.reduce((s, r) => { const b = r.quantity * r.unitPrice; return s + (b * r.discount) / 100; }, 0);
  const taxAmt = items.reduce((s, r) => { const b = r.quantity * r.unitPrice; const a = b - (b * r.discount) / 100; return s + (a * r.taxRate) / 100; }, 0);
  const total = items.reduce((s, r) => s + r.amount, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length || items.every(i => !i.description.trim())) { toast.error("Add at least one line item"); return; }
    startTransition(async () => {
      try {
        const payload = {
          type,
          ...form,
          contactId: form.contactId || null,
          accountId: form.accountId || null,
          ownerId: form.ownerId || null,
          dueDate: form.dueDate || null,
          currency, subtotal, discountAmt, taxAmt, total,
          notes: form.notes || null,
          terms: form.terms || null,
          items: items.filter(i => i.description.trim()),
        };
        if (isEdit) {
          await updateInvoiceAction({ id: invoice!.id, ...payload });
          toast.success("Invoice updated");
        } else {
          await createInvoiceAction(payload);
          toast.success("Invoice created");
        }
        onClose();
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? `Edit ${invoice!.number}` : "New Invoice"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Type selector */}
          {!isEdit && (
            <div className="flex gap-3">
              {(["invoice", "proforma"] as InvoiceType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${type === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {t === "proforma" ? "Proforma Invoice" : "Invoice"}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Contact</label>
              <select value={form.contactId} onChange={e => set("contactId", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— None —</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Account</label>
              <select value={form.accountId} onChange={e => set("accountId", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— None —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Owner</label>
              <select value={form.ownerId} onChange={e => set("ownerId", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Issue Date</label>
              <input type="date" value={form.issueDate} onChange={e => set("issueDate", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Line Items</p>
            <LineItemsEditor items={items} currency={currency} onChange={setItems} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Notes for the client…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Terms & Conditions</label>
              <textarea value={form.terms} onChange={e => set("terms", e.target.value)} rows={3} placeholder="Payment terms…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InvoicesClient({ invoices: initial, contacts, accounts, users, canCreate, canEdit, canDelete }: Props) {
  const [invoices, setInvoices] = useState(initial);
  // Sync when RSC re-fetches on navigation
  useEffect(() => { setInvoices(initial); }, [initial]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "">("");
  const [modal, setModal] = useState<"create" | InvoiceRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let rows = invoices;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.number.toLowerCase().includes(q) || (r.contactName ?? "").toLowerCase().includes(q) || (r.accountName ?? "").toLowerCase().includes(q));
    }
    if (statusFilter) rows = rows.filter(r => r.status === statusFilter);
    if (typeFilter) rows = rows.filter(r => r.type === typeFilter);
    return rows;
  }, [invoices, search, statusFilter, typeFilter]);

  function changeStatus(id: string, status: InvoiceStatus) {
    startTransition(async () => {
      try {
        await updateInvoiceStatusAction({ id, status });
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
        toast.success(`Invoice marked as ${STATUS_CONFIG[status].label}`);
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  function handleDelete(id: string, number: string) {
    if (!confirm(`Delete ${number}? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteInvoiceAction({ id });
        setInvoices(prev => prev.filter(inv => inv.id !== id));
        toast.success("Invoice deleted");
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  // Summary stats
  const totalOutstanding = invoices.filter(i => i.status === "sent" || i.status === "overdue" || i.status === "partial").reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const cur = invoices[0]?.currency ?? "INR";
  const draftTotal = invoices.filter(i => i.status === "draft").reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const overdue = invoices.filter(i => i.status === "overdue").length;

  return (
    <>
      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Outstanding</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{fmt(cur, totalOutstanding)}</p>{draftTotal > 0 && <p className="text-xs text-slate-400">+ {fmt(cur, draftTotal)} in drafts (not sent yet)</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Collected</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{fmt(cur, totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Overdue</p>
          <p className="mt-1 text-xl font-semibold text-rose-600">{overdue}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as InvoiceStatus | "")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_CONFIG) as InvoiceStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as InvoiceType | "")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All types</option>
          <option value="invoice">Invoice</option>
          <option value="proforma">Proforma</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/billing/invoices/export"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Download size={15} /> Export Excel
          </a>
          {canCreate && (
            <button onClick={() => setModal("create")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition">
              <Plus size={16} /> New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <FileText size={40} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">{search || statusFilter || typeFilter ? "No invoices match your filters" : "No invoices yet"}</p>
          {canCreate && !search && !statusFilter && !typeFilter && (
            <button onClick={() => setModal("create")} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
              <Plus size={14} /> Create first invoice
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Issue Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{inv.number}</span>
                        {inv.type === "proforma" && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Proforma</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.contactName || inv.accountName || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(inv.issueDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {inv.dueDate ? (
                        <span className={inv.status === "overdue" ? "text-rose-600 font-medium" : ""}>
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-slate-900">{fmt(inv.currency, inv.total)}</span>
                      {inv.amountPaid > 0 && inv.amountPaid < inv.total && (
                        <div className="text-xs text-slate-400">{fmt(inv.currency, inv.total - inv.amountPaid)} due</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[inv.status].color}`}>
                        {STATUS_CONFIG[inv.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && inv.status === "draft" && (
                          <button onClick={() => changeStatus(inv.id, "sent")} title="Mark Sent" disabled={isPending}
                            className="rounded-md p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"><Send size={14} /></button>
                        )}
                        {canEdit && (inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") && (
                          <button onClick={() => changeStatus(inv.id, "paid")} title="Mark Paid" disabled={isPending}
                            className="rounded-md p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"><CheckCircle2 size={14} /></button>
                        )}
                        {canEdit && inv.status === "sent" && (
                          <button onClick={() => changeStatus(inv.id, "overdue")} title="Mark Overdue" disabled={isPending}
                            className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"><AlertCircle size={14} /></button>
                        )}
                        <a
                          href={`/api/billing/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download PDF"
                          className="rounded-md p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"
                        >
                          <Download size={14} />
                        </a>
                        {canEdit && (
                          <button onClick={() => setModal(inv)} title="Edit"
                            className="rounded-md p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"><Pencil size={14} /></button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(inv.id, inv.number)} disabled={isPending} title="Delete"
                            className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            {filtered.length} of {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {modal && (
        <InvoiceModal
          invoice={modal === "create" ? undefined : modal}
          contacts={contacts} accounts={accounts} users={users}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
