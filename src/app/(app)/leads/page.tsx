import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { PermissionButton } from "@/components/PermissionButton";
import { LeadsClient } from "./LeadsClient";
import { NewLeadButton } from "./NewLeadButton";
import type { FieldDefinition } from "@/types/dynamic-lead";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const auth = await requireAuth();

  const { leads, stages, defs } = await withTenant(auth.tenantId, async (tx) => ({
    leads: await tx.lead.findMany({
      orderBy: { createdAt: "desc" },
      include: { stage: true, owner: true },
    }),
    stages: await tx.leadStage.findMany({ orderBy: { orderIndex: "asc" } }),
    defs: await tx.fieldDefinition.findMany({
      where: { entity: "lead", isActive: true },
      orderBy: { orderIndex: "asc" },
    }),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              CRM
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Enquiries · {leads.length}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {auth.permissions.includes("lead:create") && (
              <NewLeadButton
                definitions={defs as unknown as FieldDefinition[]}
                stages={stages.map((s) => ({ id: s.id, name: s.name }))}
              />
            )}
            <PermissionButton
              permissions={auth.permissions}
              required="lead:import"
              href="/leads/import"
            >
              Import
            </PermissionButton>
            <PermissionButton
              permissions={auth.permissions}
              required="lead:export"
              href="/api/leads/export"
            >
              Export
            </PermissionButton>
          </div>
        </div>

        <LeadsClient
          canEditLead={auth.permissions.includes("lead:edit")}
          leads={leads.map((l) => ({
            id: l.id,
            title: l.title,
            stageId: l.stageId,
            stageName: l.stage.name,
            stageColor: l.stage.color ?? "#64748b",
            ownerName: l.owner?.fullName ?? null,
            estimatedValue: l.estimatedValue ?? null,
            createdAt: l.createdAt.toISOString(),
            customValues: l.customValues as Record<string, unknown>,
          }))}
          stages={stages.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color ?? "#64748b",
          }))}
          defs={defs.map((d) => ({
            id: d.id,
            key: d.key,
            label: d.label,
            type: d.type,
          }))}
        />
      </div>
    </div>
  );
}
