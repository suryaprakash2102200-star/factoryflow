"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, X, Package, ArrowRightLeft, Download } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ORDER_STATUS, ORDER_STATUSES, type OrderStatus } from "@/lib/factory";
import { convertQuoteToOrderAction } from "./actions";
import { OrderForm } from "./OrderForm";

export type OrderRow = {
  id: string;
  number: string;
  status: OrderStatus;
  customer: string | null;
  quoteNumber: string | null;
  orderDate: string;
  dueDate: string | null;
  poReference: string | null;
  currency: string;
  total: number;
  itemCount: number;
  jobCount: number;
};

export function fmtMoney(currency: string, amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS[status].color}`}>
      {ORDER_STATUS[status].label}
    </span>
  );
}

const OPEN: OrderStatus[] = ["confirmed", "in_production", "ready"];

export function OrdersClient({
  orders, accounts, contacts, users, acceptedQuotes, canCreate,
}: {
  orders: OrderRow[];
  accounts: { id: string; name: string }[];
  contacts: { id: string; fullName: string }[];
  users: { id: string; fullName: string }[];
  acceptedQuotes: { id: string; number: string; label: string; total: number; currency: string }[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "" | "open">("");
  const [modal, setModal] = useState<"create" | "convert" | null>(null);
  const [quoteId, setQuoteId] = useState("");
  const [isPending, startTransition] = useTransition();

  const [now] = useState(() => Date.now());
  const filtered = useMemo(() => {
    let rows = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.number, r.customer, r.poReference, r.quoteNumber].some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    if (status === "open") rows = rows.filter((r) => OPEN.includes(r.status));
    else if (status) rows = rows.filter((r) => r.status === status);
    return rows;
  }, [orders, search, status]);

  const counts = useMemo(() => ({
    open: orders.filter((o) => OPEN.includes(o.status)).length,
    overdue: orders.filter((o) => OPEN.includes(o.status) && o.dueDate && new Date(o.dueDate).getTime() < now).length,
    ready: orders.filter((o) => o.status === "ready").length,
    value: orders.filter((o) => OPEN.includes(o.status)).reduce((s, o) => s + o.total, 0),
  }), [orders, now]);

  function convert() {
    if (!quoteId) return;
    startTransition(async () => {
      try {
        const { id } = await convertQuoteToOrderAction({ quoteId });
        toast.success("Order created from quotation");
        setModal(null);
        router.push(`/orders/${id}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  const currency = orders[0]?.currency ?? "USD";

  return (
    <>
      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Open orders", value: counts.open },
          { label: "Overdue", value: counts.overdue },
          { label: "Ready for dispatch", value: counts.ready },
          { label: "Open order value", value: fmtMoney(currency, counts.value) },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, customer, PO…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus | "" | "open")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="open">Open (confirmed → ready)</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <a href="/api/orders/export" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            <Download size={15} /> Export
          </a>
          {canCreate && (
            <>
              <button
                onClick={() => setModal("convert")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowRightLeft size={15} /> From quotation
              </button>
              <button
                onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={16} /> New order
              </button>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Package size={40} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">{search || status ? "No orders match your filters" : "No orders yet"}</p>
          {!search && !status && (
            <p className="mt-1 text-xs text-slate-400">Convert an accepted quotation, or create a direct order.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {["Order", "Customer", "Order date", "Due", "PO ref", "Jobs"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => {
                  const overdue = OPEN.includes(o.status) && o.dueDate && new Date(o.dueDate).getTime() < now;
                  return (
                    <tr key={o.id} className="cursor-pointer transition-colors hover:bg-slate-50/60" onClick={() => router.push(`/orders/${o.id}`)}>
                      <td className="px-4 py-3">
                        <Link href={`/orders/${o.id}`} className="font-medium text-slate-900 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {o.number}
                        </Link>
                        {o.quoteNumber && <div className="text-xs text-slate-400">from {o.quoteNumber}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{o.customer ?? <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(o.orderDate).toLocaleDateString()}</td>
                      <td className={`px-4 py-3 ${overdue ? "font-medium text-rose-600" : "text-slate-500"}`}>
                        {o.dueDate ? new Date(o.dueDate).toLocaleDateString() : "—"}
                        {overdue && <span className="ml-1 text-xs">overdue</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{o.poReference ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">{o.jobCount}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums">{fmtMoney(o.currency, o.total)}</td>
                      <td className="px-4 py-3"><OrderStatusPill status={o.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal === "create"} onClose={() => setModal(null)} title="New order" size="xl">
        <OrderForm
          accounts={accounts}
          contacts={contacts}
          users={users}
          onDone={(id) => { setModal(null); if (id) router.push(`/orders/${id}`); }}
        />
      </Modal>

      <Modal open={modal === "convert"} onClose={() => setModal(null)} title="Create order from quotation" size="md">
        <div className="space-y-4 p-5">
          {acceptedQuotes.length === 0 ? (
            <p className="text-sm text-slate-500">
              No accepted quotations waiting. Mark a quotation as <b>Accepted</b> in Quotations first.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Accepted quotation</span>
                <select
                  value={quoteId}
                  onChange={(e) => setQuoteId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a quotation…</option>
                  {acceptedQuotes.map((q) => (
                    <option key={q.id} value={q.id}>{q.label} · {fmtMoney(q.currency, q.total)}</option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">Line items, customer and total are copied. The order starts as Confirmed.</p>
            </>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={() => setModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button
              onClick={convert}
              disabled={!quoteId || isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create order"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

