"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireAuth, hasPerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { withTenant } from "@/lib/tenant-context";
import {
  DynamicFieldValidator,
  ValidationError,
  type FieldDefinitionDTO,
} from "@/modules/leads/domain/dynamic-field.validator";

const NoteSchema = z.object({
  leadId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

export async function addNoteAction(input: z.infer<typeof NoteSchema>) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "note:create")) throw new Error("You don't have permission to do that.");
  const parsed = NoteSchema.parse(input);
  await withTenant(auth.tenantId, async (tx) => {
    await tx.note.create({
      data: {
        tenantId: auth.tenantId,
        leadId: parsed.leadId,
        body: parsed.body,
        createdById: auth.userId,
      },
    });
    await tx.activity.create({
      data: {
        tenantId: auth.tenantId,
        leadId: parsed.leadId,
        type: "note",
        title: "Note added",
        body: parsed.body.slice(0, 200),
        createdById: auth.userId,
      },
    });
    await tx.lead.update({
      where: { id: parsed.leadId },
      data: { lastActivityAt: new Date() },
    });
  });
  revalidatePath(`/leads/${parsed.leadId}`);
}

const ActivitySchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["call", "email", "meeting", "visit", "other"]),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
});

export async function addActivityAction(input: z.infer<typeof ActivitySchema>) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "activity:create")) throw new Error("You don't have permission to do that.");
  const parsed = ActivitySchema.parse(input);
  await withTenant(auth.tenantId, async (tx) => {
    await tx.activity.create({
      data: {
        tenantId: auth.tenantId,
        leadId: parsed.leadId,
        type: parsed.type,
        title: parsed.title,
        body: parsed.body,
        createdById: auth.userId,
      },
    });
    await tx.lead.update({
      where: { id: parsed.leadId },
      data: { lastActivityAt: new Date() },
    });
  });
  revalidatePath(`/leads/${parsed.leadId}`);
}

const StageSchema = z.object({
  leadId: z.string().uuid(),
  toStageId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export async function changeStageAction(input: z.infer<typeof StageSchema>) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "lead:edit")) throw new Error("You don't have permission to do that.");
  const parsed = StageSchema.parse(input);
  await withTenant(auth.tenantId, async (tx) => {
    const lead = await tx.lead.findUniqueOrThrow({
      where: { id: parsed.leadId },
    });
    if (lead.stageId === parsed.toStageId) return;

    const [fromStage, toStage] = await Promise.all([
      tx.leadStage.findUnique({ where: { id: lead.stageId } }),
      tx.leadStage.findUniqueOrThrow({ where: { id: parsed.toStageId } }),
    ]);

    await tx.stageHistory.create({
      data: {
        tenantId: auth.tenantId,
        leadId: parsed.leadId,
        fromStageId: lead.stageId,
        toStageId: parsed.toStageId,
        changedById: auth.userId,
        reason: parsed.reason,
      },
    });
    await tx.activity.create({
      data: {
        tenantId: auth.tenantId,
        leadId: parsed.leadId,
        type: "stage_change",
        title: `Stage: ${fromStage?.name ?? "—"} → ${toStage.name}`,
        body: parsed.reason,
        createdById: auth.userId,
      },
    });
    await tx.lead.update({
      where: { id: parsed.leadId },
      data: {
        stageId: parsed.toStageId,
        lastActivityAt: new Date(),
      },
    });
    await audit(tx, auth, { action: "stage", entityType: "lead", entityId: parsed.leadId, summary: `${lead.title}: ${fromStage?.name ?? "—"} → ${toStage.name}` });
  });
  revalidatePath(`/leads/${parsed.leadId}`);
  revalidatePath(`/leads`);
}

const TaskSchema = z.object({
  leadId: z.string().uuid(),
  item: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  ecd: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
});

export async function addTaskAction(input: z.infer<typeof TaskSchema>) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "task:create")) throw new Error("You don't have permission to do that.");
  const parsed = TaskSchema.parse(input);
  await withTenant(auth.tenantId, async (tx) => {
    await tx.task.create({
      data: {
        tenantId: auth.tenantId,
        leadId: parsed.leadId,
        item: parsed.item,
        description: parsed.description,
        priority: parsed.priority,
        ecd: parsed.ecd ? new Date(parsed.ecd) : undefined,
        assigneeId: parsed.assigneeId ?? auth.userId,
        createdById: auth.userId,
      },
    });
  });
  revalidatePath(`/leads/${parsed.leadId}`);
  revalidatePath(`/action-tracker`);
}

const UpdateLeadSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().min(1).max(200),
  source: z.string().max(100).nullable().optional(),
  estimatedValue: z.number().int().nullable().optional(),
  currency: z.string().length(3).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  customValues: z.record(z.string(), z.unknown()).optional(),
});

export async function updateLeadAction(
  input: z.infer<typeof UpdateLeadSchema>,
) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "lead:edit")) throw new Error("You don't have permission to do that.");
  const parsed = UpdateLeadSchema.parse(input);
  try {
    await withTenant(auth.tenantId, async (tx) => {
      const defs = await tx.fieldDefinition.findMany({
        where: { entity: "lead", isActive: true },
        orderBy: { orderIndex: "asc" },
      });
      const validated = DynamicFieldValidator.validate(
        parsed.customValues ?? {},
        defs as unknown as FieldDefinitionDTO[],
      );
      await tx.lead.update({
        where: { id: parsed.leadId },
        data: {
          title: parsed.title,
          source: parsed.source ?? null,
          estimatedValue: parsed.estimatedValue ?? null,
          currency: parsed.currency ?? "USD",
          ...(parsed.ownerId !== undefined ? { ownerId: parsed.ownerId } : {}),
          customValues: validated as Prisma.InputJsonValue,
          lastActivityAt: new Date(),
        },
      });
    });
  } catch (e) {
    if (e instanceof ValidationError) {
      return { ok: false as const, errors: e.errors };
    }
    throw e;
  }
  revalidatePath(`/leads/${parsed.leadId}`);
  revalidatePath(`/leads`);
  return { ok: true as const };
}

const DeleteLeadSchema = z.object({ leadId: z.string().uuid() });

export async function deleteLeadAction(
  input: z.infer<typeof DeleteLeadSchema>,
) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "lead:delete")) throw new Error("You don't have permission to do that.");
  const parsed = DeleteLeadSchema.parse(input);
  await withTenant(auth.tenantId, async (tx) => {
    const gone = await tx.lead.delete({ where: { id: parsed.leadId }, select: { title: true } });
    await audit(tx, auth, { action: "delete", entityType: "lead", entityId: parsed.leadId, summary: `Deleted enquiry ${gone.title}` });
  });
  revalidatePath(`/leads`);
  revalidatePath(`/`);
  return { ok: true as const };
}
