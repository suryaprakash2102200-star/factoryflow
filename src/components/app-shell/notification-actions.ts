"use server";

import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

export type NotificationItem = { id: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string };

export async function listNotificationsAction(): Promise<{ unread: number; items: NotificationItem[] }> {
  const ctx = await requireAuth();
  return withTenant(ctx.tenantId, async (tx) => {
    const [unread, rows] = await Promise.all([
      tx.notification.count({ where: { userId: ctx.userId, readAt: null } }),
      tx.notification.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return {
      unread,
      items: rows.map((r) => ({ id: r.id, title: r.title, body: r.body, href: r.href, read: !!r.readAt, createdAt: r.createdAt.toISOString() })),
    };
  });
}

export async function markNotificationsReadAction(ids?: string[]) {
  const ctx = await requireAuth();
  await withTenant(ctx.tenantId, (tx) =>
    tx.notification.updateMany({
      where: { userId: ctx.userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    }),
  );
}
