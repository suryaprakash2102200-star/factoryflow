"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { GripVertical, Pencil, Trash2, Plus, Trophy, Clock } from "lucide-react";
import { createStageAction, updateStageAction, deleteStageAction, reorderStagesAction } from "./actions";

export interface StageRow {
  id: string;
  name: string;
  color: string;
  probability: number;
  isTerminal: boolean;
  slaHours: number | null;
  orderIndex: number;
}

const PRESET_COLORS = [
  "#64748b","#3b82f6","#8b5cf6","#ec4899","#f59e0b",
  "#10b981","#06b6d4","#ef4444","#f97316","#84cc16",
];

export function StagesClient({ initialStages }: { initialStages: StageRow[] }) {
  const [stages, setStages] = useState(initialStages);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StageRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function handleDelete(s: StageRow) {
    if (!confirm(`Delete stage "${s.name}"? Stages with leads cannot be deleted.`)) return;
    startTransition(async () => {
      try {
        await deleteStageAction({ id: s.id });
        setStages(prev => prev.filter(x => x.id !== s.id));
        toast.success("Stage deleted");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  function onDragStart(idx: number) { setDragIdx(idx); }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOver(idx); }
  function onDrop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOver(null); return; }
    const reordered = [...stages];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((s, i) => ({ ...s, orderIndex: i }));
    setStages(updated);
    setDragIdx(null);
    setDragOver(null);
    startTransition(async () => {
      try {
        await reorderStagesAction({ ids: updated.map(s => s.id) });
        toast.success("Order saved");
      } catch {
        toast.error("Failed to reorder");
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus size={15} /> Add Stage
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {stages.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm">No stages yet. Add your first pipeline stage.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Probability</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">SLA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stages.map((s, idx) => (
                <tr
                  key={s.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={() => onDrop(idx)}
                  onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
                  className={`group transition ${dragOver === idx ? "bg-blue-50" : "hover:bg-slate-50"} ${dragIdx === idx ? "opacity-40" : ""}`}
                >
                  <td className="px-3 py-3 text-slate-300 cursor-grab">
                    <GripVertical size={16} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="font-medium text-slate-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${s.probability}%` }} />
                      </div>
                      <span className="text-slate-600 text-xs">{s.probability}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {s.slaHours ? (
                      <span className="inline-flex items-center gap-1 text-xs"><Clock size={12} />{s.slaHours}h</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {s.isTerminal ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Trophy size={10} /> Terminal
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => { setEditing(s); setShowModal(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(s)} disabled={isPending} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-400">Drag rows to reorder. Changes save automatically.</p>

      {showModal && (
        <StageModal
          stage={editing}
          onClose={() => setShowModal(false)}
          onSave={(saved) => {
            if (editing) setStages(prev => prev.map(s => s.id === saved.id ? saved : s));
            else setStages(prev => [...prev, saved]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function StageModal({ stage, onClose, onSave }: {
  stage: StageRow | null;
  onClose: () => void;
  onSave: (s: StageRow) => void;
}) {
  const [name, setName] = useState(stage?.name ?? "");
  const [color, setColor] = useState(stage?.color ?? "#64748b");
  const [probability, setProbability] = useState(stage?.probability ?? 0);
  const [isTerminal, setIsTerminal] = useState(stage?.isTerminal ?? false);
  const [slaHours, setSlaHours] = useState(stage?.slaHours?.toString() ?? "");
  const [orderIndex, setOrderIndex] = useState(stage?.orderIndex ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload = { name, color, probability, isTerminal, slaHours: slaHours ? Number(slaHours) : null, orderIndex };
      if (stage) {
        await updateStageAction({ id: stage.id, ...payload });
        onSave({ ...stage, ...payload });
        toast.success("Stage updated");
      } else {
        await createStageAction(payload);
        onSave({ id: crypto.randomUUID(), ...payload });
        toast.success("Stage created");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{stage ? "Edit Stage" : "New Stage"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded"><Plus size={18} className="rotate-45" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Stage Name *</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Qualification"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full transition ring-offset-2 ${color === c ? "ring-2 ring-blue-500" : ""}`}
                  style={{ background: c }} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="h-6 w-10 rounded cursor-pointer border border-slate-200" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: color }} />
              <span className="text-xs text-slate-500 font-mono">{color}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Win Probability ({probability}%)</label>
              <input type="range" min={0} max={100} value={probability} onChange={e => setProbability(Number(e.target.value))}
                className="w-full accent-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">SLA Hours (optional)</label>
              <input type="number" min={0} value={slaHours} onChange={e => setSlaHours(e.target.value)} placeholder="e.g. 48"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Order</label>
              <input type="number" value={orderIndex} onChange={e => setOrderIndex(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isTerminal} onChange={e => setIsTerminal(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600" />
                <span className="text-sm text-slate-700">Terminal (Won/Lost)</span>
              </label>
            </div>
          </div>

          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-blue-400">
              {saving ? "Saving…" : stage ? "Save Changes" : "Create Stage"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
