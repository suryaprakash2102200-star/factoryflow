"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

const RowSchema = z.object({
  title: z.string().min(1).max(200),
  source: z.string().max(100).optional(),
  estimatedValue: z.coerce.number().int().nullable().optional(),
  stageName: z.string().optional(),
});

export type ImportRow = z.infer<typeof RowSchema>;

export async function importLeadsAction(rows: ImportRow[]) {
  const auth = await requireAuth();
  if (!hasPerm(auth, "lead:import")) throw new Error("FORBIDDEN: lead:import");

  let imported = 0;
  let skipped = 0;

  await withTenant(auth.tenantId, async (tx) => {
    const stages = await tx.leadStage.findMany({ orderBy: { orderIndex: "asc" } });
    const defaultStage = stages[0];
    if (!defaultStage) throw new Error("No pipeline stages configured. Create at least one stage first.");

    for (const raw of rows) {
      const parsed = RowSchema.safeParse(raw);
      if (!parsed.success || !parsed.data.title?.trim()) { skipped++; continue; }
      const { title, source, estimatedValue, stageName } = parsed.data;

      const stage = stageName
        ? stages.find(s => s.name.toLowerCase() === stageName.toLowerCase()) ?? defaultStage
        : defaultStage;

      await tx.lead.create({
        data: {
          tenantId: auth.tenantId,
          pipelineId: stage.pipelineId,
          stageId: stage.id,
          ownerId: auth.userId,
          title: title.trim(),
          source: source?.trim() || null,
          estimatedValue: estimatedValue ?? null,
          currency: "USD",
          lastActivityAt: new Date(),
        },
      });
      imported++;
    }
  });

  revalidatePath("/leads");
  revalidatePath("/");
  return { imported, skipped };
}
