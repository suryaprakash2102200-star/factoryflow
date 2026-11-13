import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";
import { OrdersClient, type OrderRow } from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("order:view") || !moduleEnabled(await getEnabledModules(auth.tenantId), "orders")) notFound();

  const { orders, accounts, contacts, users, acceptedQuotes } = await withTenant(auth.tenantId, async (tx) => ({
    orders: await tx.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        account: { select: { name: true } },
        contact: { select: { fullName: true } },
        quote: { select: { number: true } },
        _count: { select: { items: true, jobs: true } },
      },
    }),
    accounts: await tx.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    contacts: await tx.contact.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    users: await tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    acceptedQuotes: await tx.quote.findMany({
      where: { status: { in: ["accepted", "invoiced"] }, orders: { none: {} } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, number: true, total: true, currency: true, account: { select: { name: true } }, contact: { select: { fullName: true } } },
    }),
  }));

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    customer: o.account?.name ?? o.contact?.fullName ?? null,
    quoteNumber: o.quote?.number ?? null,
    orderDate: o.orderDate.toISOString(),
    dueDate: o.dueDate?.toISOString() ?? null,
    poReference: o.poReference,
    currency: o.currency,
    total: Number(o.total),
    itemCount: o._count.items,
    jobCount: o._count.jobs,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Operations</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Orders · {rows.length}</h1>
        </div>
        <OrdersClient
          orders={rows}
          accounts={accounts}
          contacts={contacts}
          users={users}
          acceptedQuotes={acceptedQuotes.map((q) => ({
            id: q.id,
            number: q.number,
            label: `${q.number} · ${q.account?.name ?? q.contact?.fullName ?? "No customer"}`,
            total: Number(q.total),
            currency: q.currency,
          }))}
          canCreate={auth.permissions.includes("order:create")}
        />
      </div>
    </div>
  );
}
