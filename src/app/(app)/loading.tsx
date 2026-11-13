export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <div className="text-sm font-medium text-slate-500">Loading…</div>
      </div>
    </div>
  );
}
