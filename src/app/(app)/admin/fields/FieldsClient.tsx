"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createFieldAction, updateFieldAction, deleteFieldAction, toggleFieldActiveAction } from "./actions";

type FieldType = "text" | "long_text" | "number" | "currency" | "date" | "datetime" | "dropdown" | "multi_select" | "boolean" | "formula" | "lookup" | "file";
type EntityType = "lead" | "contact" | "account" | "task";

export interface FieldRow {
  id: string;
  entity: EntityType;
  key: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  isUnique: boolean;
  isActive: boolean;
  orderIndex: number;
  options: { value: string; label: string }[] | null;
  validation: { min?: number; max?: number; maxLength?: number; regex?: string } | null;
  formulaExpr: string | null;
  defaultValue: unknown;
  createdAt: string;
}

const FIELD_TYPES: { value: FieldType; label: string; desc: string }[] = [
  { value: "text", label: "Text", desc: "Single line text" },
  { value: "long_text", label: "Long Text", desc: "Multi-line text area" },
  { value: "number", label: "Number", desc: "Integer or decimal" },
  { value: "currency", label: "Currency", desc: "Monetary value (USD)" },
  { value: "date", label: "Date", desc: "Date picker" },
  { value: "datetime", label: "Date & Time", desc: "Date + time picker" },
  { value: "dropdown", label: "Dropdown", desc: "Single select from options" },
  { value: "multi_select", label: "Multi-Select", desc: "Multiple options" },
  { value: "boolean", label: "Checkbox", desc: "True / false toggle" },
  { value: "formula", label: "Formula", desc: "Computed expression (read-only)" },
  { value: "lookup", label: "Lookup", desc: "Reference another record" },
  { value: "file", label: "File", desc: "File attachment (S3 key)" },
];

const ENTITIES: { value: EntityType; label: string; color: string }[] = [
  { value: "lead", label: "Lead", color: "bg-violet-100 text-violet-700" },
  { value: "contact", label: "Contact", color: "bg-blue-100 text-blue-700" },
  { value: "account", label: "Account", color: "bg-amber-100 text-amber-700" },
  { value: "task", label: "Task", color: "bg-emerald-100 text-emerald-700" },
];

const TYPE_ICONS: Record<FieldType, string> = {
  text: "Tt", long_text: "¶", number: "#", currency: "$", date: "📅",
  datetime: "🕐", dropdown: "▾", multi_select: "☑", boolean: "⊙",
  formula: "ƒ", lookup: "⤴", file: "📎",
};

export function FieldsClient({ initialFields }: { initialFields: FieldRow[] }) {
  const [fields, setFields] = useState(initialFields);
  const [showModal, setShowModal] = useState(false);
  const [editField, setEditField] = useState<FieldRow | null>(null);
  const [filterEntity, setFilterEntity] = useState<EntityType | "all">("all");
  const [isPending, startTransition] = useTransition();

  const filtered = filterEntity === "all" ? fields : fields.filter(f => f.entity === filterEntity);
  const grouped = ENTITIES.map(e => ({
    ...e,
    fields: filtered.filter(f => f.entity === e.value),
  })).filter(g => filterEntity === "all" ? true : g.value === filterEntity);

  function handleToggle(field: FieldRow) {
    startTransition(async () => {
      try {
        await toggleFieldActiveAction({ id: field.id, isActive: !field.isActive });
        setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: !f.isActive } : f));
        toast.success(field.isActive ? "Field deactivated" : "Field activated");
      } catch {
        toast.error("Failed to update field status");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this field? This will not remove existing data from records.")) return;
    startTransition(async () => {
      try {
        await deleteFieldAction({ id });
        setFields(prev => prev.filter(f => f.id !== id));
        toast.success("Field deleted");
      } catch {
        toast.error("Failed to delete field");
      }
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <FilterBtn active={filterEntity === "all"} onClick={() => setFilterEntity("all")}>All</FilterBtn>
          {ENTITIES.map(e => (
            <FilterBtn key={e.value} active={filterEntity === e.value} onClick={() => setFilterEntity(e.value)}>
              {e.label}
            </FilterBtn>
          ))}
        </div>
        <button
          onClick={() => { setEditField(null); setShowModal(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
        >
          <span className="text-lg leading-none">+</span> Add Field
        </button>
      </div>

      {/* Field groups */}
      <div className="space-y-6">
        {grouped.map(group => (
          <div key={group.value}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${group.color}`}>{group.label}</span>
              <span className="text-xs text-slate-400">{group.fields.length} field{group.fields.length !== 1 ? "s" : ""}</span>
            </div>
            {group.fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                No {group.label.toLowerCase()} fields yet.{" "}
                <button onClick={() => { setEditField(null); setShowModal(true); }} className="text-blue-500 hover:underline">Add one →</button>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Field</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Key</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Flags</th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-2.5 px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {group.fields.map(field => (
                      <tr key={field.id} className={`group hover:bg-slate-50 transition ${!field.isActive ? "opacity-50" : ""}`}>
                        <td className="py-3 px-4 font-medium text-slate-900">{field.label}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{field.key}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                            <span className="font-mono">{TYPE_ICONS[field.type]}</span>
                            {FIELD_TYPES.find(t => t.value === field.type)?.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {field.isRequired && <Badge color="red">Required</Badge>}
                            {field.isUnique && <Badge color="blue">Unique</Badge>}
                            {field.options && field.options.length > 0 && <Badge color="slate">{field.options.length} opts</Badge>}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggle(field)}
                            disabled={isPending}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${field.isActive ? "bg-blue-600" : "bg-slate-200"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${field.isActive ? "translate-x-4.5" : "translate-x-0.5"}`} />
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={() => { setEditField(field); setShowModal(true); }}
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(field.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <FieldModal
          field={editField}
          onClose={() => setShowModal(false)}
          onSave={(saved) => {
            if (editField) {
              setFields(prev => prev.map(f => f.id === saved.id ? saved : f));
            } else {
              setFields(prev => [...prev, saved]);
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
    >
      {children}
    </button>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors[color]}`}>{children}</span>;
}

// ---- Modal ----
type FormState = {
  entity: EntityType;
  key: string;
  label: string;
  type: FieldType;
  isRequired: boolean;
  isUnique: boolean;
  orderIndex: number;
  formulaExpr: string;
  options: { value: string; label: string }[];
  validationMin: string;
  validationMax: string;
  validationMaxLength: string;
  validationRegex: string;
};

function FieldModal({ field, onClose, onSave }: {
  field: FieldRow | null;
  onClose: () => void;
  onSave: (saved: FieldRow) => void;
}) {
  const [form, setForm] = useState<FormState>({
    entity: field?.entity ?? "lead",
    key: field?.key ?? "",
    label: field?.label ?? "",
    type: field?.type ?? "text",
    isRequired: field?.isRequired ?? false,
    isUnique: field?.isUnique ?? false,
    orderIndex: field?.orderIndex ?? 0,
    formulaExpr: field?.formulaExpr ?? "",
    options: field?.options ?? [],
    validationMin: field?.validation?.min?.toString() ?? "",
    validationMax: field?.validation?.max?.toString() ?? "",
    validationMaxLength: field?.validation?.maxLength?.toString() ?? "",
    validationRegex: field?.validation?.regex ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newOption, setNewOption] = useState({ value: "", label: "" });

  const needsOptions = form.type === "dropdown" || form.type === "multi_select";
  const needsFormula = form.type === "formula";
  const needsValidation = ["text", "long_text", "number", "currency"].includes(form.type);

  // Auto-generate key from label
  function handleLabelChange(val: string) {
    const autoKey = !field ? val.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 64) : form.key;
    setForm(f => ({ ...f, label: val, key: field ? f.key : autoKey }));
  }

  function addOption() {
    if (!newOption.value || !newOption.label) return;
    setForm(f => ({ ...f, options: [...f.options, { ...newOption }] }));
    setNewOption({ value: "", label: "" });
  }

  function removeOption(i: number) {
    setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        entity: form.entity,
        key: form.key,
        label: form.label,
        type: form.type,
        isRequired: form.isRequired,
        isUnique: form.isUnique,
        orderIndex: form.orderIndex,
        formulaExpr: form.formulaExpr || null,
        options: needsOptions ? form.options : null,
        validation: needsValidation ? {
          min: form.validationMin ? Number(form.validationMin) : undefined,
          max: form.validationMax ? Number(form.validationMax) : undefined,
          maxLength: form.validationMaxLength ? Number(form.validationMaxLength) : undefined,
          regex: form.validationRegex || undefined,
        } : null,
      };

      if (field) {
        await updateFieldAction({ id: field.id, ...payload });
        onSave({ ...field, ...payload, options: payload.options ?? null, validation: payload.validation ?? null });
        toast.success("Field updated");
      } else {
        await createFieldAction(payload);
        // Refresh page to get new field with id
        onSave({
          id: crypto.randomUUID(),
          ...payload,
          options: payload.options ?? null,
          validation: payload.validation ?? null,
          defaultValue: null,
          isActive: true,
          createdAt: new Date().toISOString(),
        } as FieldRow);
        toast.success("Field created");
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message || "Failed to save field");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-100 z-10">
          <h2 className="text-lg font-semibold text-slate-900">{field ? "Edit Field" : "New Custom Field"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Entity + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Entity *</label>
              <select
                value={form.entity}
                onChange={e => setForm(f => ({ ...f, entity: e.target.value as EntityType }))}
                disabled={!!field}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {ENTITIES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Field Type *</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as FieldType, options: [] }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">{FIELD_TYPES.find(t => t.value === form.type)?.desc}</p>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Label *</label>
            <input
              type="text"
              required
              value={form.label}
              onChange={e => handleLabelChange(e.target.value)}
              placeholder="e.g. Property Size"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Key * <span className="font-normal text-slate-400">(programmatic, snake_case)</span></label>
            <input
              type="text"
              required
              disabled={!!field}
              value={form.key}
              onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
              placeholder="e.g. property_size"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isRequired} onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))} className="rounded border-slate-300 text-blue-600" />
              <span className="text-sm text-slate-700">Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isUnique} onChange={e => setForm(f => ({ ...f, isUnique: e.target.checked }))} className="rounded border-slate-300 text-blue-600" />
              <span className="text-sm text-slate-700">Unique</span>
            </label>
          </div>

          {/* Options (dropdown/multi_select) */}
          {needsOptions && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Options</label>
              <div className="space-y-1.5 mb-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-50 text-sm">
                    <span className="font-mono text-slate-400 text-xs">{opt.value}</span>
                    <span className="flex-1 text-slate-700">{opt.label}</span>
                    <button type="button" onClick={() => removeOption(i)} className="text-slate-400 hover:text-red-500 ml-auto">×</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="value"
                  value={newOption.value}
                  onChange={e => setNewOption(o => ({ ...o, value: e.target.value }))}
                  className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Label"
                  value={newOption.label}
                  onChange={e => setNewOption(o => ({ ...o, label: e.target.value }))}
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button type="button" onClick={addOption} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs hover:bg-slate-200">Add</button>
              </div>
            </div>
          )}

          {/* Formula */}
          {needsFormula && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Formula Expression</label>
              <input
                type="text"
                value={form.formulaExpr}
                onChange={e => setForm(f => ({ ...f, formulaExpr: e.target.value }))}
                placeholder="e.g. {estimated_value} * 0.1"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Validation */}
          {needsValidation && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Validation <span className="font-normal text-slate-400">(optional)</span></label>
              <div className="grid grid-cols-2 gap-2">
                {(form.type === "number" || form.type === "currency") && (
                  <>
                    <input type="number" placeholder="Min value" value={form.validationMin} onChange={e => setForm(f => ({ ...f, validationMin: e.target.value }))} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="number" placeholder="Max value" value={form.validationMax} onChange={e => setForm(f => ({ ...f, validationMax: e.target.value }))} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </>
                )}
                {(form.type === "text" || form.type === "long_text") && (
                  <>
                    <input type="number" placeholder="Max length" value={form.validationMaxLength} onChange={e => setForm(f => ({ ...f, validationMaxLength: e.target.value }))} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="text" placeholder="Regex pattern" value={form.validationRegex} onChange={e => setForm(f => ({ ...f, validationRegex: e.target.value }))} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Order */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Order</label>
            <input
              type="number"
              value={form.orderIndex}
              onChange={e => setForm(f => ({ ...f, orderIndex: Number(e.target.value) }))}
              className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-blue-400">
              {saving ? "Saving…" : field ? "Save Changes" : "Create Field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
