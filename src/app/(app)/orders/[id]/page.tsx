import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";
import { OrderDetailClient } from "./OrderDetailClient";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  const modules = await getEnabledModules(auth.tenantId);
  if (!auth.permissions.includes("order:view") || !moduleEnabled(modules, "orders")) notFound();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const data = await withTenant(auth.tenantId, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, phone: true, email: true } },
        owner: { select: { fullName: true } },
        quote: { select: { id: true, number: true } },
        items: { orderBy: { orderIndex: "asc" } },
        history: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { fullName: true } } } },
        jobs: { orderBy: { createdAt: "asc" }, include: { assignee: { select: { fullName: true } } } },
      },
    });
    if (!order) return null;
    const [accounts, contacts, users] = await Promise.all([
      tx.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      tx.contact.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
      tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    ]);
    return { order, accounts, contacts, users };
  });
  if (!data) notFound();
  const { order, accounts, contacts, users } = data;

  return (
    <OrderDetailClient
      order={{
        id: order.id,
        number: order.number,
        status: order.status,
        accountId: order.accountId,
        accountName: order.account?.name ?? null,
        contactId: order.contactId,
        contact: order.contact,
        ownerId: order.ownerId,
        ownerName: order.owner?.fullName ?? null,
        quote: order.quote,
        orderDate: order.orderDate.toISOString(),
        dueDate: order.dueDate?.toISOString() ?? null,
        dispatchedAt: order.dispatchedAt?.toISOString() ?? null,
        poReference: order.poReference,
        currency: order.currency,
        total: Number(order.total),
        notes: order.notes,
        items: order.items.map((it) => ({
          id: it.id, description: it.description, quantity: Number(it.quantity), unit: it.unit,
          unitPrice: Number(it.unitPrice), amount: Number(it.amount),
        })),
        history: order.history.map((h) => ({
          id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, note: h.note,
          by: h.changedBy?.fullName ?? null, at: h.changedAt.toISOString(),
        })),
        jobs: order.jobs.map((j) => ({
          id: j.id, number: j.number, title: j.title, stage: j.stage, assignee: j.assignee?.fullName ?? null,
          targetQty: Number(j.targetQty), outputQty: Number(j.outputQty), unit: j.unit, dueDate: j.dueDate?.toISOString() ?? null,
        })),
      }}
      accounts={accounts}
      contacts={contacts}
      users={users}
      canEdit={auth.permissions.includes("order:edit")}
      canDelete={auth.permissions.includes("order:delete")}
      canCreateJob={auth.permissions.includes("production:create") && moduleEnabled(modules, "production")}
    />
  );
}
