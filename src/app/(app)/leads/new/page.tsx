import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { NewLeadClient } from "./NewLeadClient";
import type { FieldDefinition } from "@/types/dynamic-lead";

export default async function NewLeadPage() {
  const auth = await requireAuth();
  const { defs, stages, users } = await withTenant(auth.tenantId, async (tx) => ({
    defs: await tx.fieldDefinition.findMany({
      where: { entity: "lead", isActive: true },
      orderBy: { orderIndex: "asc" },
    }),
    stages: await tx.leadStage.findMany({ orderBy: { orderIndex: "asc" } }),
    users: await tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  }));

  return (
    <NewLeadClient
      definitions={defs as unknown as FieldDefinition[]}
      stages={stages.map((s) => ({ id: s.id, name: s.name }))}
      users={users}
      currentUserId={auth.userId}
    />
  );
}
