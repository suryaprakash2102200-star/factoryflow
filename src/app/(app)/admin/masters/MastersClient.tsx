"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Star } from "lucide-react";
import { Modal } from "@/components/Modal";
import { MASTER_KINDS, MASTER_KIND_KEYS, type MasterKind } from "@/lib/masters";
import { saveProductAction, saveMachineAction, saveMasterValueAction, deleteMasterValueAction } from "./actions";

type Product = { id: string; code: string; name: string; description: string | null; category: string | null; unit: string; hsnCode: string | null; gstRate: number; price: number; material: string | null; isActive: boolean };
type Machine = { id: string; code: string; name: string; type: string | null; location: string | null; isActive: boolean; openJobs: number };
type Value = { id: string; kind: string; value: string; label: string; isDefault: boolean };

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const th = "px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500";
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function MastersClient({ initialTab, canEdit, products, machines, values }: {
  initialTab: "products" | "machines" | "lists";
  canEdit: boolean;
  products: Product[];
  machines: Machine[];
  values: Value[];
}) {
  const [tab, setTab] = useState(initialTab);
  const list = (k: MasterKind) => values.filter((v) => v.kind === k);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Masters</h2>
        <p className="mt-1 text-sm text-slate-500">Set these up once. They fill the dropdowns in quotations, orders and production.</p>
      </div>
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm w-fit">
        {([["products", `Items (${products.length})`], ["machines", `Machines (${machines.length})`], ["lists", "Lists & terms"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 ${tab === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>
      {tab === "products" && <Products rows={products} canEdit={canEdit} units={list("unit")} gst={list("gst_rate")} categories={list("product_category")} materials={list("material")} />}
      {tab === "machines" && <Machines rows={machines} canEdit={canEdit} types={list("machine_type")} />}
      {tab === "lists" && <Lists values={values} canEdit={canEdit} />}
    </div>
  );
}

// ── Items ────────────────────────────────────────────────────────────────────

function Products({ rows, canEdit, units, gst, categories, materials }: { rows: Product[]; canEdit: boolean; units: Value[]; gst: Value[]; categories: Value[]; materials: Value[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState<Product | "new" | null>(null);
  const shown = useMemo(() => rows.filter((r) =>
    (!cat || r.category === cat) &&
    (!q.trim() || [r.code, r.name, r.hsnCode, r.material].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())))), [rows, q, cat]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name, HSN, material…" className={`${input} pl-9`} />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${input} w-auto`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.value}>{c.label}</option>)}
        </select>
        {canEdit && <button onClick={() => setEdit("new")} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} /> New item</button>}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50"><tr>
              <th className={th}>Code</th><th className={th}>Item</th><th className={th}>Category</th><th className={th}>Unit</th><th className={th}>HSN</th>
              <th className={`${th} text-right`}>GST</th><th className={`${th} text-right`}>Price</th><th className="px-4 py-3" />
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{p.code}</td>
                  <td className="px-4 py-2.5"><div className="font-medium text-slate-900">{p.name}</div>{p.material && <div className="text-xs text-slate-500">{p.material}</div>}</td>
                  <td className="px-4 py-2.5 text-slate-600">{categories.find((c) => c.value === p.category)?.label ?? p.category ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.unit}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.hsnCode ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{p.gstRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{inr(p.price)}</td>
                  <td className="px-4 py-2.5 text-right">{canEdit && <button onClick={() => setEdit(p)} aria-label={`Edit ${p.code}`} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Pencil size={14} /></button>}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No items match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {edit && <ProductForm row={edit === "new" ? null : edit} units={units} gst={gst} categories={categories} materials={materials} onClose={() => setEdit(null)} />}
    </>
  );
}

function ProductForm({ row, units, gst, categories, materials, onClose }: { row: Product | null; units: Value[]; gst: Value[]; categories: Value[]; materials: Value[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    code: row?.code ?? "", name: row?.name ?? "", description: row?.description ?? "", category: row?.category ?? "",
    unit: row?.unit ?? (units.find((u) => u.isDefault)?.value ?? "pcs"), hsnCode: row?.hsnCode ?? "",
    gstRate: String(row?.gstRate ?? (gst.find((g) => g.isDefault)?.value ?? "18")), price: String(row?.price ?? ""),
    material: row?.material ?? "", isActive: row?.isActive ?? true,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  function save() {
    start(async () => {
      try {
        await saveProductAction({ id: row?.id, ...f, gstRate: Number(f.gstRate), price: Number(f.price || 0) });
        toast.success(row ? "Item updated" : "Item added");
        onClose(); router.refresh();
      } catch (e) { toast.error((e as Error).message); }
    });
  }
  return (
    <Modal open onClose={onClose} title={row ? `Edit ${row.code}` : "New item"} size="lg">
      <div className="grid grid-cols-2 gap-4 p-5">
        <Field label="Item code *"><input value={f.code} onChange={(e) => set("code", e.target.value)} className={input} placeholder="BRK-4040-MS" /></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => set("category", e.target.value)} className={input}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.value}>{c.label}</option>)}</select></Field>
        <div className="col-span-2"><Field label="Item name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={input} placeholder="MS angle bracket 40×40×5" /></Field></div>
        <Field label="Unit"><select value={f.unit} onChange={(e) => set("unit", e.target.value)} className={input}>{units.map((u) => <option key={u.id} value={u.value}>{u.label}</option>)}</select></Field>
        <Field label="Material / grade"><input list="mat-list" value={f.material} onChange={(e) => set("material", e.target.value)} className={input} /><datalist id="mat-list">{materials.map((m) => <option key={m.id} value={m.label} />)}</datalist></Field>
        <Field label="HSN code"><input value={f.hsnCode} onChange={(e) => set("hsnCode", e.target.value)} className={input} placeholder="7326" /></Field>
        <Field label="GST rate"><select value={f.gstRate} onChange={(e) => set("gstRate", e.target.value)} className={input}>{gst.map((g) => <option key={g.id} value={g.value}>{g.label}</option>)}</select></Field>
        <Field label="Default price (₹, before GST)"><input type="number" min={0} step="0.01" value={f.price} onChange={(e) => set("price", e.target.value)} className={input} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>
        <div className="col-span-2"><Field label="Description / spec"><textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} className={input} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
        <button onClick={save} disabled={pending || !f.code.trim() || !f.name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}

// ── Machines ─────────────────────────────────────────────────────────────────

function Machines({ rows, canEdit, types }: { rows: Machine[]; canEdit: boolean; types: Value[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Machine | "new" | null>(null);
  const [pending, start] = useTransition();
  const row = edit === "new" ? null : edit;
  const [f, setF] = useState({ code: "", name: "", type: "", location: "", isActive: true });
  function open(m: Machine | "new") {
    setEdit(m);
    setF(m === "new" ? { code: "", name: "", type: "", location: "", isActive: true } : { code: m.code, name: m.name, type: m.type ?? "", location: m.location ?? "", isActive: m.isActive });
  }
  function save() {
    start(async () => {
      try { await saveMachineAction({ id: row?.id, ...f }); toast.success("Machine saved"); setEdit(null); router.refresh(); }
      catch (e) { toast.error((e as Error).message); }
    });
  }
  return (
    <>
      {canEdit && <div className="flex"><button onClick={() => open("new")} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} /> New machine</button></div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((m) => (
          <div key={m.id} className={`rounded-xl border border-slate-200 bg-white p-4 ${m.isActive ? "" : "opacity-50"}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-slate-500">{m.code}</p>
                <p className="font-medium text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-500">{[types.find((t) => t.value === m.type)?.label ?? m.type, m.location].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              {canEdit && <button onClick={() => open(m)} aria-label={`Edit ${m.code}`} className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Pencil size={14} /></button>}
            </div>
            <p className={`mt-3 text-xs ${m.openJobs ? "font-medium text-blue-700" : "text-slate-400"}`}>{m.openJobs ? `${m.openJobs} open job${m.openJobs > 1 ? "s" : ""}` : "Idle"}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">No machines yet.</p>}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={row ? `Edit ${row.code}` : "New machine"} size="md">
          <div className="grid grid-cols-2 gap-4 p-5">
            <Field label="Code *"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={input} placeholder="CNC-01" /></Field>
            <Field label="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={input}><option value="">—</option>{types.map((t) => <option key={t.id} value={t.value}>{t.label}</option>)}</select></Field>
            <div className="col-span-2"><Field label="Name *"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} placeholder="Haas VF-2 vertical machining centre" /></Field></div>
            <Field label="Location / bay"><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} className={input} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> In use</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button onClick={() => setEdit(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={save} disabled={pending || !f.code.trim() || !f.name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Pick-lists ───────────────────────────────────────────────────────────────

function Lists({ values, canEdit }: { values: Value[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, { value: string; label: string }>>({});
  const run = (fn: () => Promise<unknown>, ok: string) => start(async () => {
    try { await fn(); toast.success(ok); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {MASTER_KIND_KEYS.map((k) => {
        const rows = values.filter((v) => v.kind === k);
        const d = draft[k] ?? { value: "", label: "" };
        return (
          <section key={k} className="rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">{MASTER_KINDS[k].label}</h3>
              <p className="text-xs text-slate-500">{MASTER_KINDS[k].hint}</p>
            </header>
            <ul className="divide-y divide-slate-100">
              {rows.map((v) => (
                <li key={v.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="flex-1 text-slate-800">{v.label}{v.label !== v.value && <span className="ml-2 font-mono text-xs text-slate-400">{v.value}</span>}</span>
                  {v.isDefault ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Default</span>
                    : canEdit && <button disabled={pending} onClick={() => run(() => saveMasterValueAction({ ...v, kind: k, isDefault: true }), "Default set")} title="Make default" className="rounded p-1 text-slate-300 hover:text-amber-500"><Star size={13} /></button>}
                  {canEdit && <button disabled={pending} onClick={() => run(() => deleteMasterValueAction({ id: v.id }), "Removed")} aria-label={`Remove ${v.label}`} className="rounded p-1 text-slate-300 hover:text-rose-600"><Trash2 size={13} /></button>}
                </li>
              ))}
              {rows.length === 0 && <li className="px-4 py-3 text-xs text-slate-400">Empty</li>}
            </ul>
            {canEdit && (
              <form
                className="flex gap-2 border-t border-slate-100 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = d.value.trim() || d.label.trim();
                  if (!value) return;
                  run(() => saveMasterValueAction({ kind: k, value, label: d.label.trim() || value }), "Added");
                  setDraft({ ...draft, [k]: { value: "", label: "" } });
                }}
              >
                <input value={d.label} onChange={(e) => setDraft({ ...draft, [k]: { ...d, label: e.target.value } })} placeholder="Add…" className={`${input} py-1.5`} />
                {(k === "gst_rate" || k === "unit") && <input value={d.value} onChange={(e) => setDraft({ ...draft, [k]: { ...d, value: e.target.value } })} placeholder={k === "gst_rate" ? "%" : "code"} className={`${input} w-20 py-1.5`} />}
                <button disabled={pending} className="rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50"><Plus size={14} /></button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
