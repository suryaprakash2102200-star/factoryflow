"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

const Schema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
});

export async function updateTaskStatusAction(input: z.infer<typeof Schema>) {
  const ctx = await requireAuth();
  if (!hasPerm(ctx, "task:edit")) throw new Error("FORBIDDEN: task:edit");
  const data = Schema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.task.update({
      where: { id: data.taskId },
      data: {
        status: data.status,
        completedAt: data.status === "done" ? new Date() : null,
      },
    });
  });
  revalidatePath("/action-tracker");
}
