import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";
import { ProductionBoard, type JobCard } from "./ProductionBoard";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("production:view") || !moduleEnabled(await getEnabledModules(auth.tenantId), "production")) notFound();

  const { jobs, users, orders } = await withTenant(auth.tenantId, async (tx) => ({
    jobs: await tx.productionJob.findMany({
      where: { stage: { not: "cancelled" } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: {
        assignee: { select: { id: true, fullName: true } },
        machine: { select: { code: true } },
        order: { select: { id: true, number: true, account: { select: { name: true } } } },
      },
    }),
    users: await tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    orders: await tx.order.findMany({
      where: { status: { in: ["confirmed", "in_production", "ready"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, account: { select: { name: true } } },
    }),
  }));

  const cards: JobCard[] = jobs.map((j) => ({
    id: j.id,
    number: j.number,
    title: j.title,
    stage: j.stage,
    priority: j.priority,
    assigneeId: j.assigneeId,
    assignee: j.assignee?.fullName ?? null,
    machine: j.machine?.code ?? null,
    orderId: j.order?.id ?? null,
    orderNumber: j.order?.number ?? null,
    customer: j.order?.account?.name ?? null,
    targetQty: Number(j.targetQty),
    outputQty: Number(j.outputQty),
    unit: j.unit,
    dueDate: j.dueDate?.toISOString() ?? null,
    completedAt: j.completedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col">
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operations</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Production · {cards.length} jobs</h1>
        </div>
        <ProductionBoard
          jobs={cards}
          users={users}
          orders={orders.map((o) => ({ id: o.id, label: `${o.number}${o.account ? ` · ${o.account.name}` : ""}` }))}
          meId={auth.userId}
          canCreate={auth.permissions.includes("production:create")}
          canEdit={auth.permissions.includes("production:edit")}
        />
      </div>
    </div>
  );
}
