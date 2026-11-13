import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("lead:import")) redirect("/leads");

  return (
    <div className="px-4 py-8 sm:px-6 md:py-10 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Enquiries · Import</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">CSV Import</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV file to bulk-create leads. Required column: <code className="bg-slate-100 px-1 rounded text-xs">title</code>.
          Optional: <code className="bg-slate-100 px-1 rounded text-xs">source</code>, <code className="bg-slate-100 px-1 rounded text-xs">estimatedValue</code>, <code className="bg-slate-100 px-1 rounded text-xs">stage</code>.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
