import type { Prisma } from "@prisma/client";

/**
 * Queue in-app notifications inside the caller's tenant transaction.
 * The actor never notifies themselves; duplicates and nulls are dropped.
 */
export async function notify(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; userId: string },
  userIds: (string | null | undefined)[],
  n: { type: string; title: string; body?: string; href?: string },
) {
  const to = [...new Set(userIds.filter((u): u is string => !!u && u !== ctx.userId))];
  if (!to.length) return;
  await tx.notification.createMany({
    data: to.map((userId) => ({ tenantId: ctx.tenantId, userId, type: n.type, title: n.title, body: n.body, href: n.href })),
  });
}
