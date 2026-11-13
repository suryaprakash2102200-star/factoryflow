import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";
import { JobDetailClient } from "./JobDetailClient";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.permissions.includes("production:view") || !moduleEnabled(await getEnabledModules(auth.tenantId), "production")) notFound();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const data = await withTenant(auth.tenantId, async (tx) => {
    const job = await tx.productionJob.findUnique({
      where: { id },
      include: {
        assignee: { select: { fullName: true } },
        machine: { select: { code: true, name: true } },
        order: { select: { id: true, number: true, status: true, account: { select: { name: true } } } },
        updates: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { fullName: true } } } },
      },
    });
    if (!job) return null;
    const users = await tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
    return { job, users };
  });
  if (!data) notFound();
  const { job, users } = data;

  return (
    <JobDetailClient
      job={{
        id: job.id,
        number: job.number,
        title: job.title,
        stage: job.stage,
        priority: job.priority,
        assigneeId: job.assigneeId,
        assignee: job.assignee?.fullName ?? null,
        machineId: job.machineId,
        machine: job.machine ? `${job.machine.code} · ${job.machine.name}` : null,
        order: job.order ? { id: job.order.id, number: job.order.number, customer: job.order.account?.name ?? null } : null,
        targetQty: Number(job.targetQty),
        outputQty: Number(job.outputQty),
        rejectQty: Number(job.rejectQty),
        unit: job.unit,
        startDate: job.startDate?.toISOString() ?? null,
        dueDate: job.dueDate?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        specification: job.specification,
        materialNotes: job.materialNotes,
        drawingUrl: job.drawingUrl,
        updates: job.updates.map((u) => ({
          id: u.id,
          fromStage: u.fromStage,
          toStage: u.toStage,
          outputDelta: Number(u.outputDelta),
          rejectDelta: Number(u.rejectDelta),
          note: u.note,
          by: u.createdBy?.fullName ?? null,
          at: u.createdAt.toISOString(),
        })),
      }}
      users={users}
      canEdit={auth.permissions.includes("production:edit")}
      canDelete={auth.permissions.includes("production:delete")}
    />
  );
}
