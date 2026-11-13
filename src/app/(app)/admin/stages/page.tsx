import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { StagesClient } from "./StagesClient";

export const dynamic = "force-dynamic";

export default async function StagesPage() {
  const ctx = await requireAuth();
  const stages = await withTenant(ctx.tenantId, async (tx) =>
    tx.leadStage.findMany({ orderBy: { orderIndex: "asc" } })
  );

  return (
    <div className="px-4 py-8 sm:px-6 md:py-10 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Admin · Pipeline</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Pipeline Stages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure pipeline stages, probabilities, colors and SLA targets.
        </p>
      </div>
      <StagesClient initialStages={stages.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color ?? "#64748b",
        probability: s.probability ?? 0,
        isTerminal: s.isTerminal,
        slaHours: s.slaHours ?? null,
        orderIndex: s.orderIndex,
      }))} />
    </div>
  );
}
