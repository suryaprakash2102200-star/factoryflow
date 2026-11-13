"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

function ensure(ctx: Awaited<ReturnType<typeof requireAuth>>, perm: import("@/lib/permissions").Permission) {
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
}

const StageSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  probability: z.number().int().min(0).max(100).default(0),
  isTerminal: z.boolean().default(false),
  slaHours: z.number().int().min(0).nullable().optional(),
  orderIndex: z.number().int().default(0),
});

export async function createStageAction(input: z.infer<typeof StageSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "stage:create");
  const data = StageSchema.parse(input);

  // Get or create the default pipeline
  await withTenant(ctx.tenantId, async (tx) => {
    const existing = await tx.leadStage.findFirst({ where: {} });
    const pipelineId = existing?.pipelineId ?? ctx.tenantId;
    await tx.leadStage.create({
      data: { tenantId: ctx.tenantId, pipelineId, ...data, slaHours: data.slaHours ?? null },
    });
  });
  revalidatePath("/admin/stages");
  revalidatePath("/leads");
}

const UpdateStageSchema = StageSchema.partial().extend({ id: z.string().uuid() });

export async function updateStageAction(input: z.infer<typeof UpdateStageSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "stage:edit");
  const { id, ...rest } = UpdateStageSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.leadStage.update({ where: { id }, data: rest });
  });
  revalidatePath("/admin/stages");
  revalidatePath("/leads");
}

export async function deleteStageAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "stage:delete");
  await withTenant(ctx.tenantId, async (tx) => {
    const count = await tx.lead.count({ where: { stageId: input.id } });
    if (count > 0) throw new Error(`Cannot delete: ${count} lead(s) are in this stage. Move them first.`);
    await tx.leadStage.delete({ where: { id: input.id } });
  });
  revalidatePath("/admin/stages");
  revalidatePath("/leads");
}

export async function reorderStagesAction(input: { ids: string[] }) {
  const ctx = await requireAuth();
  ensure(ctx, "stage:edit");
  await withTenant(ctx.tenantId, async (tx) => {
    await Promise.all(
      input.ids.map((id, idx) => tx.leadStage.update({ where: { id }, data: { orderIndex: idx } }))
    );
  });
  revalidatePath("/admin/stages");
  revalidatePath("/leads");
}
