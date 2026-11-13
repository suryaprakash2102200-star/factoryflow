import type { Prisma } from "@prisma/client";

/**
 * Append an audit entry inside the caller's tenant transaction so the entry
 * commits (or rolls back) together with the change it describes.
 */
export async function audit(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; userId: string },
  entry: { action: string; entityType: string; entityId?: string | null; summary: string; meta?: Prisma.InputJsonValue },
) {
  await tx.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      meta: entry.meta ?? {},
    },
  });
}

/** Sequential per-tenant document numbers, e.g. ORD-0007. Unique index backs it. */
export async function nextNumber(
  count: () => Promise<number>,
  prefix: string,
): Promise<string> {
  const n = await count();
  return `${prefix}-${String(n + 1).padStart(4, "0")}`;
}
