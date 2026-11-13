"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Upload, Trash2, FileText, Image as ImageIcon, Download } from "lucide-react";
import type { AttachableType } from "@/lib/attachments";

type Row = { id: string; fileName: string; mimeType: string; size: number; createdAt: string; uploadedBy: string | null };

function size(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

/** Files panel for any record: drawings, customer POs, photos. Uses /api/attachments. */
export function Attachments({
  entityType, entityId, canEdit, title = "Files & drawings",
}: { entityType: AttachableType; entityId: string; canEdit: boolean; title?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  }, [entityType, entityId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      if (res.ok) toast.success(`Uploaded ${f.name}`);
      else toast.error((await res.json().catch(() => null))?.error ?? `Couldn't upload ${f.name}`);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    load();
  }

  async function remove(r: Row) {
    if (!confirm(`Remove ${r.fileName}?`)) return;
    const res = await fetch(`/api/attachments/${r.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("File removed"); load(); }
    else toast.error("Couldn't remove the file");
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Paperclip size={15} className="text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {rows && rows.length > 0 && <span className="text-xs text-slate-400">{rows.length}</span>}
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Upload size={13} /> {busy ? "Uploading…" : "Upload"}
            </button>
            <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
          </>
        )}
      </header>
      <div
        className="p-2"
        onDragOver={(e) => { if (canEdit) e.preventDefault(); }}
        onDrop={(e) => { if (canEdit) { e.preventDefault(); upload(e.dataTransfer.files); } }}
      >
        {rows === null ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">
            No files yet.{canEdit && " Upload drawings, POs or photos (max 5 MB each), or drop them here."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-2 py-2 text-sm">
                {r.mimeType.startsWith("image/") ? <ImageIcon size={15} className="shrink-0 text-slate-400" /> : <FileText size={15} className="shrink-0 text-slate-400" />}
                <a href={`/api/attachments/${r.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-slate-800 hover:underline">
                  {r.fileName}
                </a>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{size(r.size)} · {r.uploadedBy ?? "—"}</span>
                <a href={`/api/attachments/${r.id}?download`} aria-label={`Download ${r.fileName}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <Download size={13} />
                </a>
                {canEdit && (
                  <button onClick={() => remove(r)} aria-label={`Remove ${r.fileName}`} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
