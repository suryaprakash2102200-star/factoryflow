"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Search, X, Plus, Globe, Phone, Building2, UserCircle2, Trash2, Pencil, Users, Layers, Download } from "lucide-react";
import { createAccountAction, updateAccountAction, deleteAccountAction } from "./actions";

type FieldDef = { id: string; key: string; label: string; type: string };
type UserOption = { id: string; fullName: string };

export type AccountRow = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  ownerId: string | null;
  ownerName: string | null;
  contactCount: number;
  customValues: Record<string, unknown>;
  createdAt: string;
};

type Props = {
  accounts: AccountRow[];
  users: UserOption[];
  defs: FieldDef[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Retail", "Manufacturing",
  "Education", "Real Estate", "Media", "Consulting", "Other",
];

function Logo({ name, domain }: { name: string; domain: string | null }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
  const color = colors[name.charCodeAt(0) % colors.length];

  if (domain) {
    return (
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${color} shrink-0`}>
        {initials}
      </div>
    );
  }
  return (
    <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${color} shrink-0`}>
      {initials}
    </div>
  );
}

type ModalProps = {
  account?: AccountRow;
  users: UserOption[];
  defs: FieldDef[];
  onClose: () => void;
};

function AccountModal({ account, users, defs, onClose }: ModalProps) {
  const isEdit = !!account;
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: account?.name ?? "",
    domain: account?.domain ?? "",
    industry: account?.industry ?? "",
    website: account?.website ?? "",
    phone: account?.phone ?? "",
    ownerId: account?.ownerId ?? "",
    customValues: account?.customValues ?? {} as Record<string, unknown>,
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function setCustom(key: string, val: string) {
    setForm(f => ({ ...f, customValues: { ...f.customValues, [key]: val } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Customer name is required"); return; }
    startTransition(async () => {
      try {
        const payload = {
          name: form.name.trim(),
          domain: form.domain.trim() || null,
          industry: form.industry || null,
          website: form.website.trim() || null,
          phone: form.phone.trim() || null,
          ownerId: form.ownerId || null,
          customValues: form.customValues,
        };
        if (isEdit) {
          await updateAccountAction({ id: account!.id, ...payload });
          toast.success("Customer updated");
        } else {
          await createAccountAction(payload);
          toast.success("Customer created");
        }
        onClose();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? "Edit customer" : "New customer"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Account Name <span className="text-rose-500">*</span></label>
              <input
                value={form.name}
                onChange={e => set("name", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corporation"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Domain</label>
              <input
                value={form.domain}
                onChange={e => set("domain", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="acme.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Industry</label>
              <select
                value={form.industry}
                onChange={e => set("industry", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select industry —</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Website</label>
              <input
                value={form.website}
                onChange={e => set("website", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://acme.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
              <input
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+1 555-0100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Owner</label>
              <select
                value={form.ownerId}
                onChange={e => set("ownerId", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>

            {defs.map(def => (
              <div key={def.id} className={def.type === "long_text" ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{def.label}</label>
                {def.type === "long_text" ? (
                  <textarea
                    value={(form.customValues[def.key] as string) ?? ""}
                    onChange={e => setCustom(def.key, e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                ) : (
                  <input
                    type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
                    value={(form.customValues[def.key] as string) ?? ""}
                    onChange={e => setCustom(def.key, e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AccountsClient({ accounts: initial, users, defs, canCreate, canEdit, canDelete }: Props) {
  const [accounts, setAccounts] = useState<AccountRow[]>(initial);
  useEffect(() => { setAccounts(initial); }, [initial]);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [modal, setModal] = useState<"create" | AccountRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const industries = useMemo(() => {
    const set = new Set(accounts.map(a => a.industry).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [accounts]);

  const filtered = useMemo(() => {
    let rows = accounts;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.domain ?? "").toLowerCase().includes(q) ||
        (a.industry ?? "").toLowerCase().includes(q) ||
        (a.website ?? "").toLowerCase().includes(q)
      );
    }
    if (industryFilter) {
      rows = rows.filter(a => a.industry === industryFilter);
    }
    return rows;
  }, [accounts, search, industryFilter]);

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteAccountAction({ id });
        setAccounts(prev => prev.filter(a => a.id !== id));
        toast.success("Customer deleted");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <>
      {/* Header actions */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {industries.length > 0 && (
          <select
            value={industryFilter}
            onChange={e => setIndustryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All industries</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/accounts/export"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Download size={15} /> Export Excel
          </a>
          {canCreate && (
            <button
              onClick={() => setModal("create")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus size={16} />
              New customer
            </button>
          )}
        </div>
      </div>

      {/* Grid / Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Building2 size={40} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {search || industryFilter ? "No customers match your filters" : "No customers yet"}
          </p>
          {canCreate && !search && !industryFilter && (
            <button
              onClick={() => setModal("create")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <Plus size={14} /> Add your first customer
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => (
            <div key={a.id} className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              {/* Card header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Logo name={a.name} domain={a.domain} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{a.name}</p>
                    {a.domain && (
                      <p className="text-xs text-slate-500 truncate">{a.domain}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEdit && (
                    <button
                      onClick={() => setModal(a)}
                      className="rounded-md p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(a.id, a.name)}
                      disabled={isPending}
                      className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                {a.industry && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Layers size={12} className="text-slate-400 shrink-0" />
                    <span>{a.industry}</span>
                  </div>
                )}
                {a.website && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Globe size={12} className="text-slate-400 shrink-0" />
                    <a href={a.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                      {a.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {a.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone size={12} className="text-slate-400 shrink-0" />
                    <a href={`tel:${a.phone}`} className="hover:text-blue-600">{a.phone}</a>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-slate-400" />
                  <span>{a.contactCount} contact{a.contactCount !== 1 ? "s" : ""}</span>
                </div>
                {a.ownerName && (
                  <div className="flex items-center gap-1.5">
                    <UserCircle2 size={12} className="text-slate-400" />
                    <span>{a.ownerName}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary bar */}
      {filtered.length > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          Showing {filtered.length} of {accounts.length} customer{accounts.length !== 1 ? "s" : ""}
        </p>
      )}

      {modal && (
        <AccountModal
          account={modal === "create" ? undefined : modal}
          users={users}
          defs={defs}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
