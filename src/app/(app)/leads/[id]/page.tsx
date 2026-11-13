import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { LeadDetailClient } from "./LeadDetailClient";
import type { FieldDefinition } from "@/types/dynamic-lead";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requireAuth();

  const data = await withTenant(auth.tenantId, async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id },
      include: { stage: true, owner: true },
    });
    if (!lead) return null;

    const [stages, defs, activities, notes, history, tasks, users] = await Promise.all([
      tx.leadStage.findMany({ orderBy: { orderIndex: "asc" } }),
      tx.fieldDefinition.findMany({
        where: { entity: "lead", isActive: true },
        orderBy: { orderIndex: "asc" },
      }),
      tx.activity.findMany({
        where: { leadId: id },
        orderBy: { createdAt: "desc" },
        include: { createdBy: true },
      }),
      tx.note.findMany({
        where: { leadId: id },
        orderBy: { createdAt: "desc" },
        include: { createdBy: true },
      }),
      tx.stageHistory.findMany({
        where: { leadId: id },
        orderBy: { changedAt: "desc" },
        include: { changedBy: true },
        take: 20,
      }),
      tx.task.findMany({
        where: { leadId: id },
        orderBy: { createdAt: "desc" },
        include: { assignee: true },
        take: 20,
      }),
      tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    ]);

    return { lead, stages, defs, activities, notes, history, tasks, users };
  });

  if (!data) notFound();

  return (
    <LeadDetailClient
      lead={{
        ...data.lead,
        createdAt: data.lead.createdAt.toISOString(),
        updatedAt: data.lead.updatedAt.toISOString(),
        lastActivityAt: data.lead.lastActivityAt?.toISOString() ?? null,
      }}
      stages={data.stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color ?? "#64748b",
        orderIndex: s.orderIndex,
      }))}
      defs={data.defs as unknown as FieldDefinition[]}
      activities={data.activities.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        body: a.body,
        createdAt: a.createdAt.toISOString(),
        createdByName: a.createdBy?.fullName ?? "System",
      }))}
      notes={data.notes.map((n) => ({
        id: n.id,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
        createdByName: n.createdBy?.fullName ?? "Unknown",
      }))}
      tasks={data.tasks.map((t) => ({
        id: t.id,
        item: t.item,
        status: t.status,
        priority: t.priority,
        ecd: t.ecd?.toISOString() ?? null,
        assigneeName: t.assignee?.fullName ?? null,
      }))}
      users={data.users}
      canEdit={auth.permissions.includes("lead:edit")}
      canDelete={auth.permissions.includes("lead:delete")}
    />
  );
}
