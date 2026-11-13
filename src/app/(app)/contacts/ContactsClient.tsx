"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Search, X, Plus, Mail, Phone, Briefcase, Building2, UserCircle2, Trash2, Pencil, Users, Download } from "lucide-react";
import { createContactAction, updateContactAction, deleteContactAction } from "./actions";

type FieldDef = { id: string; key: string; label: string; type: string };
type AccountOption = { id: string; name: string };
type UserOption = { id: string; fullName: string };

export type ContactRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  accountId: string | null;
  accountName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  customValues: Record<string, unknown>;
  createdAt: string;
};

type Props = {
  contacts: ContactRow[];
  accounts: AccountOption[];
  users: UserOption[];
  defs: FieldDef[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-cyan-100 text-cyan-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${color} shrink-0`}>
      {initials}
    </span>
  );
}

type ModalProps = {
  contact?: ContactRow;
  accounts: AccountOption[];
  users: UserOption[];
  defs: FieldDef[];
  onClose: () => void;
};

function ContactModal({ contact, accounts, users, defs, onClose }: ModalProps) {
  const isEdit = !!contact;
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    fullName: contact?.fullName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    jobTitle: contact?.jobTitle ?? "",
    accountId: contact?.accountId ?? "",
    ownerId: contact?.ownerId ?? "",
    customValues: contact?.customValues ?? {} as Record<string, unknown>,
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function setCustom(key: string, val: string) {
    setForm(f => ({ ...f, customValues: { ...f.customValues, [key]: val } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { toast.error("Name is required"); return; }
    startTransition(async () => {
      try {
        const payload = {
          fullName: form.fullName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          jobTitle: form.jobTitle.trim() || null,
          accountId: form.accountId || null,
          ownerId: form.ownerId || null,
          customValues: form.customValues,
        };
        if (isEdit) {
          await updateContactAction({ id: contact!.id, ...payload });
          toast.success("Contact updated");
        } else {
          await createContactAction(payload);
          toast.success("Contact created");
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
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? "Edit Contact" : "New Contact"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name <span className="text-rose-500">*</span></label>
              <input
                value={form.fullName}
                onChange={e => set("fullName", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="jane@example.com"
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

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Job Title</label>
              <input
                value={form.jobTitle}
                onChange={e => set("jobTitle", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Product Manager"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Account</label>
              <select
                value={form.accountId}
                onChange={e => set("accountId", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— No customer —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
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
                ) : def.type === "select" ? (
                  <input
                    value={(form.customValues[def.key] as string) ?? ""}
                    onChange={e => setCustom(def.key, e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ContactsClient({ contacts: initial, accounts, users, defs, canCreate, canEdit, canDelete }: Props) {
  const [contacts, setContacts] = useState<ContactRow[]>(initial);
  useEffect(() => { setContacts(initial); }, [initial]);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [modal, setModal] = useState<"create" | ContactRow | null>(null);
  const [isPending, startTransition] = useTransition();


  const filtered = useMemo(() => {
    let rows = contacts;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(c =>
        c.fullName.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.jobTitle ?? "").toLowerCase().includes(q) ||
        (c.accountName ?? "").toLowerCase().includes(q)
      );
    }
    if (accountFilter) {
      rows = rows.filter(c => c.accountId === accountFilter);
    }
    return rows;
  }, [contacts, search, accountFilter]);

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteContactAction({ id });
        setContacts(prev => prev.filter(c => c.id !== id));
        toast.success("Contact deleted");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <>
      {/* Header actions */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Account filter */}
        {accounts.length > 0 && (
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All customers</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/contacts/export"
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
              New Contact
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <Users size={40} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">
            {search || accountFilter ? "No contacts match your filters" : "No contacts yet"}
          </p>
          {canCreate && !search && !accountFilter && (
            <button
              onClick={() => setModal("create")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <Plus size={14} /> Add your first contact
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Job Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                  {(canEdit || canDelete) && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.fullName} />
                        <span className="font-medium text-slate-900">{c.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                          <Mail size={13} className="shrink-0" />
                          {c.email}
                        </a>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-600">
                          <Phone size={13} className="shrink-0" />
                          {c.phone}
                        </a>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.jobTitle ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Briefcase size={13} className="text-slate-400 shrink-0" />
                          {c.jobTitle}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.accountName ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          {c.accountName}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.ownerName ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <UserCircle2 size={13} className="text-slate-400 shrink-0" />
                          {c.ownerName}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              onClick={() => setModal(c)}
                              className="rounded-md p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(c.id, c.fullName)}
                              disabled={isPending}
                              className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            {filtered.length} of {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ContactModal
          contact={modal === "create" ? undefined : modal}
          accounts={accounts}
          users={users}
          defs={defs}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
