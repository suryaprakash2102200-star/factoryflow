"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { importLeadsAction, type ImportRow } from "./actions";

type ParsedRow = ImportRow & { _raw: string[] };

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) { result.push(cur); cur = ""; }
      else cur += c;
    }
    result.push(cur);
    return result;
  }

  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).filter(l => l.trim()).map(l => parseLine(l));
  return { headers, rows };
}

function mapRows(headers: string[], rows: string[][]): ParsedRow[] {
  const idx = (candidates: string[]) => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i >= 0) return i;
    }
    return -1;
  };

  const titleIdx = idx(["title", "name", "lead_title", "lead"]);
  const sourceIdx = idx(["source", "lead_source"]);
  const valueIdx = idx(["estimated_value", "estimatedvalue", "value", "amount"]);
  const stageIdx = idx(["stage", "stage_name", "stagename"]);

  return rows.map(row => ({
    title: titleIdx >= 0 ? row[titleIdx]?.trim() ?? "" : "",
    source: sourceIdx >= 0 ? row[sourceIdx]?.trim() : undefined,
    estimatedValue: valueIdx >= 0 && row[valueIdx]?.trim() ? Number(row[valueIdx]) || null : null,
    stageName: stageIdx >= 0 ? row[stageIdx]?.trim() : undefined,
    _raw: row,
  }));
}

export function ImportClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  function processFile(file: File) {
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a .csv file"); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (!headers.length) { toast.error("Could not parse CSV — check the file format"); return; }
      const mapped = mapRows(headers, rows);
      setParsed({ headers, rows: mapped });
    };
    reader.readAsText(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleImport() {
    if (!parsed) return;
    const valid = parsed.rows.filter(r => r.title.trim());
    if (!valid.length) { toast.error("No valid rows found. Check that 'title' column exists."); return; }

    startTransition(async () => {
      try {
        const res = await importLeadsAction(valid.map(({ _raw: _, ...r }) => r));
        setResult(res);
        toast.success(`Imported ${res.imported} lead${res.imported !== 1 ? "s" : ""}`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  if (result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <CheckCircle size={40} className="mx-auto text-emerald-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Import Complete</h2>
        <p className="text-slate-500 mb-6">
          <span className="font-semibold text-emerald-700">{result.imported}</span> leads imported
          {result.skipped > 0 && <>, <span className="font-semibold text-amber-700">{result.skipped}</span> rows skipped</>}.
        </p>
        <button onClick={() => router.push("/leads")} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition">
          View Leads →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      {!parsed ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-16 text-center transition ${
            dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <Upload size={36} className={`mx-auto mb-3 ${dragging ? "text-blue-400" : "text-slate-300"}`} />
          <p className="text-sm font-medium text-slate-700">Drop your CSV file here, or click to browse</p>
          <p className="mt-1 text-xs text-slate-400">Supports .csv — max ~10,000 rows</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>
      ) : (
        /* Preview */
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <FileText size={16} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-900">{fileName}</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{parsed.rows.length} rows</span>
            </div>
            <button onClick={() => { setParsed(null); setFileName(""); }} className="text-slate-400 hover:text-slate-600 p-1 rounded">
              <X size={16} />
            </button>
          </div>

          {/* Column mapping info */}
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Detected columns: <span className="font-mono font-medium">{parsed.headers.join(", ")}</span>.
              Rows missing a <span className="font-mono font-medium">title</span> will be skipped.
            </p>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Title</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Source</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Value</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Stage</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {parsed.rows.slice(0, 10).map((r, i) => {
                  const valid = !!r.title?.trim();
                  return (
                    <tr key={i} className={valid ? "hover:bg-slate-50" : "bg-red-50"}>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{r.title || <span className="text-red-400 italic">empty</span>}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.source || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.estimatedValue != null ? `$${r.estimatedValue.toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{r.stageName || "— default —"}</td>
                      <td className="px-4 py-2.5">
                        {valid
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle size={12} /> Valid</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertCircle size={12} /> Skip</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 10 && (
            <div className="px-5 py-2.5 text-xs text-slate-400 border-t border-slate-100 bg-slate-50">
              Showing first 10 of {parsed.rows.length} rows
            </div>
          )}
        </div>
      )}

      {parsed && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{parsed.rows.filter(r => r.title?.trim()).length}</span> valid rows will be imported
          </p>
          <button
            onClick={handleImport}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isPending ? "Importing…" : "Import enquiries"}
          </button>
        </div>
      )}

      {/* Template download */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-600 mb-2">CSV Template</p>
        <p className="text-xs text-slate-500 mb-3">Download this template and fill in your leads:</p>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent("title,source,estimatedValue,stage\n\"Acme Corp Deal\",Referral,50000,Qualification\n\"Beta Ltd\",Website,25000,\n")}`}
          download="leads-import-template.csv"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
        >
          <FileText size={13} /> Download template
        </a>
      </div>
    </div>
  );
}
