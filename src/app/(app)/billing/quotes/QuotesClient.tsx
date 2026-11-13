"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { History } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Search, X, Trash2, Pencil, FileText,
  Send, CheckCircle2, XCircle, ArrowRight, GripVertical, Download, Package,
} from "lucide-react";
import Link from "next/link";
import { convertQuoteToOrderAction } from "../../orders/actions";
import {
  createQuoteAction, updateQuoteAction, updateQuoteStatusAction,
  deleteQuoteAction, convertQuoteToInvoiceAction, listQuoteRevisionsAction,
} from "./actions";

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "invoiced";

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "bg-slate-100 text-slate-600" },
  sent:     { label: "Sent",     color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", color: "bg-rose-100 text-rose-700" },
  expired:  { label: "Expired",  color: "bg-amber-100 text-amber-700" },
  invoiced: { label: "Invoiced", color: "bg-violet-100 text-violet-700" },
};

type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  amount: number;
  orderIndex: number;
};

export type ProductOption = { code: string; name: string; unit: string; price: number; gstRate: number };
export type TermOption = { label: string; isDefault: boolean };

type QuoteRow = {
  id: string;
  number: string;
  revision: number;
  leadId: string | null;
  status: QuoteStatus;
  contactId: string | null;
  contactName: string | null;
  accountId: string | null;
  accountName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  issueDate: string;
  expiryDate: string | null;
  currency: string;
  total: number;
  itemCount: number;
  items: LineItem[];
  notes: string | null;
  terms: string | null;
  createdAt: string;
  orderId?: string | null;
  orderNumber?: string | null;
};

type Props = {
  quotes: QuoteRow[];
  contacts: { id: string; fullName: string }[];
  accounts: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
  leads: { id: string; title: string }[];
  products?: ProductOption[];
  paymentTerms?: TermOption[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreateInvoice: boolean;
  canCreateOrder?: boolean;
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Line items editor ────────────────────────────────────────────────────────

function LineItemsEditor({
  items, currency, onChange, products = [],
}: { items: LineItem[]; currency: string; onChange: (items: LineItem[]) => void; products?: ProductOption[] }) {
  const byLabel = new Map(products.map((p) => [`${p.code} · ${p.name}`, p]));
  /** Picking an item from the master fills name, price and GST. */
  function pick(i: number, text: string) {
    const p = byLabel.get(text);
    if (!p) return update(i, "description", text);
    onChange(items.map((item, idx) => {
      if (idx !== i) return item;
      const next = { ...item, description: `${p.name} (${p.code})`, unitPrice: p.price, taxRate: p.gstRate };
      next.amount = calcItem(next);
      return next;
    }));
  }
  function addRow() {
    onChange([...items, { description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, amount: 0, orderIndex: 0 }]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function update(i: number, field: keyof LineItem, val: string | number) {
    const next = items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      updated.amount = calcItem(updated);
      return updated;
    });
    onChange(next);
  }

  const subtotal = items.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const discountAmt = items.reduce((s, r) => {
    const base = r.quantity * r.unitPrice;
    return s + (base * r.discount) / 100;
  }, 0);
  const taxAmt = items.reduce((s, r) => {
    const base = r.quantity * r.unitPrice;
    const afterDisc = base - (base * r.discount) / 100;
    return s + (afterDisc * r.taxRate) / 100;
  }, 0);
  const total = items.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <datalist id="quote-products">
        {products.map((p) => <option key={p.code} value={`${p.code} · ${p.name}`}>{`₹${p.price} / ${p.unit} · GST ${p.gstRate}%`}</option>)}
      </datalist>
      {products.length > 0 && <p className="mb-2 text-xs text-slate-500">Start typing an item code or name to pick from the item master — price and GST fill in automatically.</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-8" />
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
                <td className="px-2 py-1.5 text-slate-300">
                  <GripVertical size={14} />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={item.description}
                    onChange={e => pick(i, e.target.value)}
                    list="quote-products"
                    placeholder="Item description…"
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={e => update(i, "quantity", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={e => update(i, "unitPrice", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.discount}
                    onChange={e => update(i, "discount", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.taxRate}
                    onChange={e => update(i, "taxRate", Number(e.target.value))}
                    className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded-md"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-slate-700">
                  {fmt(currency, item.amount)}
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                  No items yet — add your first line item
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition"
        >
          <Plus size={13} /> Add line item
        </button>
        <div className="space-y-1 text-sm min-w-[200px]">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span><span>{fmt(currency, subtotal)}</span>
          </div>
          {discountAmt > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span><span>−{fmt(currency, discountAmt)}</span>
            </div>
          )}
          {taxAmt > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Tax</span><span>+{fmt(currency, taxAmt)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1 mt-1">
            <span>Total</span><span>{fmt(currency, total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quote Modal ──────────────────────────────────────────────────────────────

type ModalProps = {
  quote?: QuoteRow & { items?: LineItem[] };
  contacts: { id: string; fullName: string }[];
  accounts: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
  leads: { id: string; title: string }[];
  products: ProductOption[];
  paymentTerms: TermOption[];
  onClose: () => void;
};

function QuoteModal({ quote, contacts, accounts, users, leads, products, paymentTerms, onClose }: ModalProps) {
  const revising = !!quote && quote.status !== "draft";
  const [reason, setReason] = useState("");
  const isEdit = !!quote;
  const [isPending, startTransition] = useTransition();
  const [currency, setCurrency] = useState(quote?.currency ?? (products.length ? "INR" : "USD"));
  const [items, setItems] = useState<LineItem[]>(quote?.items ?? [
    { description: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 0, amount: 0, orderIndex: 0 },
  ]);
  const [form, setForm] = useState({
    leadId: quote?.leadId ?? "",
    contactId: quote?.contactId ?? "",
    accountId: quote?.accountId ?? "",
    ownerId: quote?.ownerId ?? "",
    issueDate: quote?.issueDate ? quote.issueDate.slice(0, 10) : today(),
    expiryDate: quote?.expiryDate ? quote.expiryDate.slice(0, 10) : addDays(30),
    notes: quote?.notes ?? "",
    terms: quote?.terms ?? (paymentTerms.find((t) => t.isDefault)?.label ?? "Payment due within 30 days of acceptance."),
  });

  const subtotal = items.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const discountAmt = items.reduce((s, r) => {
    const base = r.quantity * r.unitPrice;
    return s + (base * r.discount) / 100;
  }, 0);
  const taxAmt = items.reduce((s, r) => {
    const base = r.quantity * r.unitPrice;
    const afterDisc = base - (base * r.discount) / 100;
    return s + (afterDisc * r.taxRate) / 100;
  }, 0);
  const total = items.reduce((s, r) => s + r.amount, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length || items.every(i => !i.description.trim())) {
      toast.error("Add at least one line item"); return;
    }
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          leadId: form.leadId || null,
          contactId: form.contactId || null,
          accountId: form.accountId || null,
          ownerId: form.ownerId || null,
          expiryDate: form.expiryDate || null,
          currency,
          subtotal,
          discountAmt,
          taxAmt,
          total,
          notes: form.notes || null,
          terms: form.terms || null,
          items: items.filter(i => i.description.trim()),
        };
        if (isEdit) {
          await updateQuoteAction({ id: quote!.id, ...payload, revisionReason: reason || undefined });
          toast.success(revising ? `Saved as Rev ${quote!.revision + 1}` : "Quote updated");
        } else {
          await createQuoteAction(payload);
          toast.success("Quote created");
        }
        onClose();
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? `Edit ${quote!.number}${revising ? ` · new revision (Rev ${quote!.revision + 1})` : ""}` : "New Quotation"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {revising && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This quotation was already {quote!.status}. Saving keeps Rev {quote!.revision} in the history, creates Rev {quote!.revision + 1} and sets it back to Draft so you can send it again.
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for revision, e.g. customer asked for a lower price"
                className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Enquiry</label>
              <select value={form.leadId} onChange={e => set("leadId", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— None —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
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
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Valid Until</label>
              <input type="date" value={form.expiryDate} onChange={e => set("expiryDate", e.target.value)}
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

          {/* Line items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Line Items</p>
            <LineItemsEditor items={items} currency={currency} onChange={setItems} products={products} />
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3}
                placeholder="Additional notes for the client…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                Terms & Conditions
                {paymentTerms.length > 0 && (
                  <select value="" onChange={e => e.target.value && set("terms", e.target.value)} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-normal">
                    <option value="">Use payment term…</option>
                    {paymentTerms.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
                  </select>
                )}
              </label>
              <textarea value={form.terms} onChange={e => set("terms", e.target.value)} rows={3}
                placeholder="Payment terms, validity…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={isPending}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Convert to Invoice dialog ────────────────────────────────────────────────

function ConvertDialog({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<"invoice" | "proforma">("invoice");
  const [dueDate, setDueDate] = useState(addDays(30));

  function handleConvert() {
    startTransition(async () => {
      try {
        await convertQuoteToInvoiceAction({ quoteId, type, dueDate });
        toast.success(`${type === "proforma" ? "Proforma invoice" : "Invoice"} created`);
        onClose();
        router.push(`/billing/invoices`);
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Convert to Invoice</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Document Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["invoice", "proforma"] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${type === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                  {t === "proforma" ? "Proforma Invoice" : "Invoice"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleConvert} disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50">
            <ArrowRight size={15} /> {isPending ? "Creating…" : "Convert"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function QuotesClient({ quotes: initial, contacts, accounts, users, leads, products = [], paymentTerms = [], canCreate, canEdit, canDelete, canCreateInvoice, canCreateOrder = false }: Props) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initial);
  // Sync when RSC re-fetches on navigation
  useEffect(() => { setQuotes(initial); }, [initial]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "">("");
  const [modal, setModal] = useState<"create" | QuoteRow | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<QuoteRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let rows = quotes;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.number.toLowerCase().includes(q) || (r.contactName ?? "").toLowerCase().includes(q) || (r.accountName ?? "").toLowerCase().includes(q));
    }
    if (statusFilter) rows = rows.filter(r => r.status === statusFilter);
    return rows;
  }, [quotes, search, statusFilter]);

  function changeStatus(id: string, status: QuoteStatus) {
    startTransition(async () => {
      try {
        await updateQuoteStatusAction({ id, status });
        setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q));
        toast.success(`Quote marked as ${STATUS_CONFIG[status].label}`);
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  function handleDelete(id: string, number: string) {
    if (!confirm(`Delete ${number}? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteQuoteAction({ id });
        setQuotes(prev => prev.filter(q => q.id !== id));
        toast.success("Quote deleted");
      } catch (e) { toast.error((e as Error).message); }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotes…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as QuoteStatus | "")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_CONFIG) as QuoteStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/billing/quotes/export"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Download size={15} /> Export Excel
          </a>
          {canCreate && (
            <button onClick={() => setModal("create")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition">
              <Plus size={16} /> New Quote
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <FileText size={40} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">{search || statusFilter ? "No quotes match your filters" : "No quotations yet"}</p>
          {canCreate && !search && !statusFilter && (
            <button onClick={() => setModal("create")} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
              <Plus size={14} /> Create first quote
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Valid Until</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {q.number}
                      {q.revision > 1 && (
                        <button onClick={() => setHistoryFor(q)} title="Revision history" className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200">Rev {q.revision}</button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{q.contactName || q.accountName || <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(q.issueDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-500">{q.expiryDate ? new Date(q.expiryDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{fmt(q.currency, q.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[q.status].color}`}>
                        {STATUS_CONFIG[q.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && q.status === "draft" && (
                          <button onClick={() => changeStatus(q.id, "sent")} title="Mark as Sent" disabled={isPending}
                            className="rounded-md p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition">
                            <Send size={14} />
                          </button>
                        )}
                        {canEdit && q.status === "sent" && (
                          <>
                            <button onClick={() => changeStatus(q.id, "accepted")} title="Accept" disabled={isPending}
                              className="rounded-md p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
                              <CheckCircle2 size={14} />
                            </button>
                            <button onClick={() => changeStatus(q.id, "rejected")} title="Reject" disabled={isPending}
                              className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {q.orderId ? (
                          <Link href={`/orders/${q.orderId}`} title={`Order ${q.orderNumber}`}
                            className="rounded-md px-1.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition">
                            {q.orderNumber}
                          </Link>
                        ) : canCreateOrder && (q.status === "accepted" || q.status === "invoiced") && (
                          <button title="Create order" disabled={isPending}
                            onClick={() => startTransition(async () => {
                              try { const { id } = await convertQuoteToOrderAction({ quoteId: q.id }); toast.success("Order created"); router.push(`/orders/${id}`); }
                              catch (e) { toast.error((e as Error).message); }
                            })}
                            className="rounded-md p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
                            <Package size={14} />
                          </button>
                        )}
                        {canCreateInvoice && (q.status === "accepted" || q.status === "sent") && (
                          <button onClick={() => setConvertId(q.id)} title="Convert to Invoice"
                            className="rounded-md p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition">
                            <ArrowRight size={14} />
                          </button>
                        )}
                        <a
                          href={`/api/billing/quotes/${q.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download PDF"
                          className="rounded-md p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"
                        >
                          <Download size={14} />
                        </a>
                        {canEdit && !q.orderId && (
                          <button onClick={() => setModal(q)} title={q.status === "draft" ? "Edit" : "Revise"}
                            className="rounded-md p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition">
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(q.id, q.number)} disabled={isPending} title="Delete"
                            className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            {filtered.length} of {quotes.length} quotation{quotes.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {modal && (
        <QuoteModal
          quote={modal === "create" ? undefined : modal}
          contacts={contacts} accounts={accounts} users={users} leads={leads} products={products} paymentTerms={paymentTerms}
          onClose={() => setModal(null)}
        />
      )}
      {historyFor && <RevisionHistory quote={historyFor} onClose={() => setHistoryFor(null)} />}
      {convertId && <ConvertDialog quoteId={convertId} onClose={() => setConvertId(null)} />}
    </>
  );
}

// ── Revision history ─────────────────────────────────────────────────────────

type Revision = Awaited<ReturnType<typeof listQuoteRevisionsAction>>[number];

function RevisionHistory({ quote, onClose }: { quote: QuoteRow; onClose: () => void }) {
  const [rows, setRows] = useState<Revision[] | null>(null);
  useEffect(() => {
    let live = true;
    listQuoteRevisionsAction({ quoteId: quote.id })
      .then(r => { if (live) setRows(r); })
      .catch(e => toast.error((e as Error).message));
    return () => { live = false; };
  }, [quote.id]);
  return (
    <Modal open onClose={onClose} title={`${quote.number} · revision history`} size="lg">
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <History size={14} className="text-blue-600" />
          <span className="font-medium text-slate-900">Rev {quote.revision} (current)</span>
          <span className="ml-auto font-medium text-slate-900">{fmt(quote.currency, quote.total)}</span>
        </div>
        {rows === null && <p className="py-6 text-center text-sm text-slate-500">Loading…</p>}
        {rows?.map(r => (
          <details key={r.id} className="rounded-lg border border-slate-200">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">Rev {r.revision}</span>
              <span className="text-xs text-slate-500">{r.by ?? "—"} · {new Date(r.createdAt).toLocaleString()}</span>
              <span className="ml-auto font-medium text-slate-700">{fmt(r.currency, r.total)}</span>
            </summary>
            <div className="border-t border-slate-100 px-3 py-2 text-sm">
              {r.reason && <p className="mb-2 text-slate-600">Changed because: {r.reason}</p>}
              <table className="w-full text-xs">
                <tbody>
                  {r.items.map((i, k) => (
                    <tr key={k} className="text-slate-600">
                      <td className="py-1">{i.description}</td>
                      <td className="py-1 text-right">{i.quantity} × {fmt(r.currency, i.unitPrice)}</td>
                      <td className="py-1 text-right font-medium">{fmt(r.currency, i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </Modal>
  );
}
