"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { requireModule } from "@/lib/modules-server";
import { notify } from "@/lib/notify";
import { audit, nextNumber } from "@/lib/audit";
import { JOB_STAGE, JOB_STAGES, type JobStage } from "@/lib/factory";
import type { Permission } from "@/lib/permissions";

type Ctx = Awaited<ReturnType<typeof requireAuth>>;

async function guard(perm: Permission): Promise<Ctx> {
  const ctx = await requireAuth();
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
  await requireModule(ctx.tenantId, "production");
  return ctx;
}

const qty = (n: number) => n.toFixed(2);

function refresh(orderId?: string | null, jobId?: string) {
  revalidatePath("/production");
  if (jobId) revalidatePath(`/production/${jobId}`);
  if (orderId) revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
}

const JobSchema = z.object({
  title: z.string().trim().min(1, "Job name is required"),
  orderId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  machineId: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  targetQty: z.number().positive(),
  unit: z.string().trim().min(1).default("pcs"),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  specification: z.string().nullable().optional(),
  materialNotes: z.string().nullable().optional(),
  drawingUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
});

async function newJobNumber(tx: Prisma.TransactionClient) {
  return nextNumber(() => tx.productionJob.count(), "JOB");
}

/** Move a confirmed order into production the first time work is planned for it. */
async function markOrderInProduction(tx: Prisma.TransactionClient, ctx: Ctx, orderId: string, note: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (order?.status !== "confirmed") return;
  await tx.order.update({ where: { id: orderId }, data: { status: "in_production" } });
  await tx.orderStatusHistory.create({
    data: { tenantId: ctx.tenantId, orderId, fromStatus: "confirmed", toStatus: "in_production", note, changedById: ctx.userId },
  });
}

export async function createJobAction(input: z.input<typeof JobSchema>) {
  const ctx = await guard("production:create");
  const d = JobSchema.parse(input);
  const id = await withTenant(ctx.tenantId, async (tx) => {
    const number = await newJobNumber(tx);
    const job = await tx.productionJob.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        title: d.title,
        orderId: d.orderId ?? null,
        assigneeId: d.assigneeId ?? null,
        machineId: d.machineId ?? null,
        priority: d.priority,
        targetQty: qty(d.targetQty),
        unit: d.unit,
        startDate: d.startDate ? new Date(d.startDate) : null,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        specification: d.specification || null,
        materialNotes: d.materialNotes || null,
        drawingUrl: d.drawingUrl || null,
        updates: { create: { tenantId: ctx.tenantId, toStage: "planned", note: "Job created", createdById: ctx.userId } },
      },
    });
    if (d.orderId) await markOrderInProduction(tx, ctx, d.orderId, `Job ${number} planned`);
    await audit(tx, ctx, { action: "create", entityType: "production_job", entityId: job.id, summary: `Created job ${number}: ${d.title}` });
    await notify(tx, ctx, [d.assigneeId], { type: "job_assigned", title: `Job ${number} assigned to you`, body: d.title, href: `/production/${job.id}` });
    return job.id;
  });
  refresh(d.orderId, id);
  return { id };
}

/** One job card per order line item. */
export async function createJobsFromOrderAction(input: { orderId: string; assigneeId?: string | null }) {
  const ctx = await guard("production:create");
  const { orderId, assigneeId } = z.object({ orderId: z.string().uuid(), assigneeId: z.string().uuid().nullable().optional() }).parse(input);
  const created = await withTenant(ctx.tenantId, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { orderBy: { orderIndex: "asc" } } },
    });
    if (order.status === "draft") throw new Error("Confirm the order before planning production.");
    if (["dispatched", "closed", "cancelled"].includes(order.status)) throw new Error("This order is already finished.");
    if (!order.items.length) throw new Error("This order has no line items.");
    let n = await tx.productionJob.count();
    for (const it of order.items) {
      n += 1;
      await tx.productionJob.create({
        data: {
          tenantId: ctx.tenantId,
          number: `JOB-${String(n).padStart(4, "0")}`,
          title: it.description,
          orderId,
          assigneeId: assigneeId ?? null,
          targetQty: it.quantity,
          unit: it.unit,
          dueDate: order.dueDate,
          updates: { create: { tenantId: ctx.tenantId, toStage: "planned", note: `Planned from ${order.number}`, createdById: ctx.userId } },
        },
      });
    }
    await markOrderInProduction(tx, ctx, orderId, `${order.items.length} job(s) planned`);
    await audit(tx, ctx, { action: "create", entityType: "production_job", entityId: orderId, summary: `Planned ${order.items.length} job(s) for ${order.number}` });
    return order.items.length;
  });
  refresh(orderId);
  return { created };
}

export async function updateJobStageAction(input: { id: string; stage: JobStage; note?: string }) {
  const ctx = await guard("production:edit");
  const d = z.object({ id: z.string().uuid(), stage: z.enum(JOB_STAGES), note: z.string().optional() }).parse(input);
  const orderId = await withTenant(ctx.tenantId, async (tx) => {
    const job = await tx.productionJob.findUniqueOrThrow({ where: { id: d.id }, select: { stage: true, number: true, title: true, orderId: true, startDate: true, order: { select: { number: true, ownerId: true } } } });
    if (job.stage === d.stage) return job.orderId;
    if (job.stage === "completed" || job.stage === "cancelled") {
      if (!hasPerm(ctx, "production:delete")) throw new Error("Only a manager can reopen a finished job.");
    }
    await tx.productionJob.update({
      where: { id: d.id },
      data: {
        stage: d.stage,
        completedAt: d.stage === "completed" ? new Date() : null,
        ...(d.stage === "in_progress" && !job.startDate ? { startDate: new Date() } : {}),
      },
    });
    await tx.jobUpdate.create({
      data: { tenantId: ctx.tenantId, jobId: d.id, fromStage: job.stage, toStage: d.stage, note: d.note?.trim() || null, createdById: ctx.userId },
    });
    if (job.orderId && d.stage === "in_progress") await markOrderInProduction(tx, ctx, job.orderId, `Job ${job.number} started`);
    await audit(tx, ctx, {
      action: "stage", entityType: "production_job", entityId: d.id,
      summary: `${job.number}: ${JOB_STAGE[job.stage].label} → ${JOB_STAGE[d.stage].label}`,
    });
    if (d.stage === "completed" && job.orderId && job.order) {
      const open = await tx.productionJob.count({ where: { orderId: job.orderId, stage: { notIn: ["completed", "cancelled"] } } });
      await notify(tx, ctx, [job.order.ownerId], open === 0
        ? { type: "order_jobs_done", title: `All jobs done for ${job.order.number}`, body: "Ready to mark for dispatch", href: `/orders/${job.orderId}` }
        : { type: "job_completed", title: `${job.number} completed`, body: `${job.title} · ${open} job(s) still open on ${job.order.number}`, href: `/orders/${job.orderId}` });
    }
    return job.orderId;
  });
  refresh(orderId, d.id);
}

export async function recordOutputAction(input: { id: string; output: number; reject?: number; note?: string }) {
  const ctx = await guard("production:edit");
  const d = z.object({
    id: z.string().uuid(),
    output: z.number().min(0),
    reject: z.number().min(0).default(0),
    note: z.string().optional(),
  }).parse(input);
  if (d.output === 0 && d.reject === 0) throw new Error("Enter a good or rejected quantity.");
  const orderId = await withTenant(ctx.tenantId, async (tx) => {
    const job = await tx.productionJob.update({
      where: { id: d.id },
      data: { outputQty: { increment: qty(d.output) }, rejectQty: { increment: qty(d.reject) } },
      select: { number: true, orderId: true, unit: true },
    });
    await tx.jobUpdate.create({
      data: {
        tenantId: ctx.tenantId, jobId: d.id, outputDelta: qty(d.output), rejectDelta: qty(d.reject),
        note: d.note?.trim() || null, createdById: ctx.userId,
      },
    });
    await audit(tx, ctx, {
      action: "output", entityType: "production_job", entityId: d.id,
      summary: `${job.number}: +${d.output} ${job.unit} good${d.reject ? `, ${d.reject} rejected` : ""}`,
    });
    return job.orderId;
  });
  refresh(orderId, d.id);
}

export async function updateJobAction(input: z.input<typeof JobSchema> & { id: string }) {
  const ctx = await guard("production:edit");
  const { id, ...rest } = input;
  const d = JobSchema.parse(rest);
  z.string().uuid().parse(id);
  await withTenant(ctx.tenantId, async (tx) => {
    const before = await tx.productionJob.findUniqueOrThrow({ where: { id }, select: { assigneeId: true } });
    const job = await tx.productionJob.update({
      where: { id },
      data: {
        title: d.title,
        assigneeId: d.assigneeId ?? null,
        machineId: d.machineId ?? null,
        priority: d.priority,
        targetQty: qty(d.targetQty),
        unit: d.unit,
        startDate: d.startDate ? new Date(d.startDate) : null,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        specification: d.specification || null,
        materialNotes: d.materialNotes || null,
        drawingUrl: d.drawingUrl || null,
      },
      select: { number: true },
    });
    await audit(tx, ctx, { action: "update", entityType: "production_job", entityId: id, summary: `Edited job ${job.number}` });
    if (d.assigneeId && d.assigneeId !== before.assigneeId)
      await notify(tx, ctx, [d.assigneeId], { type: "job_assigned", title: `Job ${job.number} assigned to you`, body: d.title, href: `/production/${id}` });
  });
  refresh(null, id);
}

export async function deleteJobAction(input: { id: string }) {
  const ctx = await guard("production:delete");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const orderId = await withTenant(ctx.tenantId, async (tx) => {
    const job = await tx.productionJob.findUniqueOrThrow({ where: { id }, select: { stage: true, number: true, orderId: true, outputQty: true } });
    if (Number(job.outputQty) > 0) throw new Error("This job has recorded output. Cancel it instead of deleting.");
    await tx.productionJob.delete({ where: { id } });
    await audit(tx, ctx, { action: "delete", entityType: "production_job", entityId: id, summary: `Deleted job ${job.number}` });
    return job.orderId;
  });
  refresh(orderId);
}

/** Active machines for the job form's dropdown. */
export async function listMachinesAction() {
  const ctx = await guard("production:view");
  return withTenant(ctx.tenantId, (tx) =>
    tx.machine.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  );
}
