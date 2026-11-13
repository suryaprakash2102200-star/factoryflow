import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { QuotesClient } from "./QuotesClient";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const auth = await requireAuth();

  const { quotes, contacts, accounts, users, leads, products, paymentTerms } = await withTenant(auth.tenantId, async (tx) => ({
    quotes: await tx.quote.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { id: true, fullName: true } },
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        items: { orderBy: { orderIndex: "asc" } },
        orders: { select: { id: true, number: true }, take: 1 },
      },
    }),
    contacts: await tx.contact.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    accounts: await tx.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    users: await tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    leads: await tx.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, title: true } }),
    products: await tx.product.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { code: true, name: true, unit: true, price: true, gstRate: true } }),
    paymentTerms: await tx.masterValue.findMany({ where: { kind: "payment_term" }, orderBy: { orderIndex: "asc" }, select: { label: true, isDefault: true } }),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Billing</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Quotations · {quotes.length}
          </h1>
        </div>
        <QuotesClient
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          quotes={(quotes as any[]).map((q: any) => ({
            id: q.id,
            number: q.number,
            revision: q.revision,
            leadId: q.leadId ?? null,
            status: q.status,
            contactId: q.contactId ?? null,
            contactName: q.contact?.fullName ?? null,
            accountId: q.accountId ?? null,
            accountName: q.account?.name ?? null,
            ownerId: q.ownerId ?? null,
            ownerName: q.owner?.fullName ?? null,
            issueDate: q.issueDate.toISOString(),
            expiryDate: q.expiryDate?.toISOString() ?? null,
            currency: q.currency,
            total: Number(q.total),
            itemCount: q.items.length,
            items: q.items.map((it: any) => ({
              id: it.id,
              description: it.description,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              discount: Number(it.discount),
              taxRate: Number(it.taxRate),
              amount: Number(it.amount),
              orderIndex: it.orderIndex,
            })),
            notes: q.notes ?? null,
            terms: q.terms ?? null,
            createdAt: q.createdAt.toISOString(),
            orderId: q.orders?.[0]?.id ?? null,
            orderNumber: q.orders?.[0]?.number ?? null,
          }))}
          contacts={contacts}
          accounts={accounts}
          users={users}
          leads={leads}
          products={products.map((x) => ({ ...x, price: Number(x.price), gstRate: Number(x.gstRate) }))}
          paymentTerms={paymentTerms}
          canCreate={auth.permissions.includes("quote:create")}
          canEdit={auth.permissions.includes("quote:edit")}
          canDelete={auth.permissions.includes("quote:delete")}
          canCreateInvoice={auth.permissions.includes("invoice:create")}
          canCreateOrder={auth.permissions.includes("order:create") && moduleEnabled(await getEnabledModules(auth.tenantId), "orders")}
        />
      </div>
    </div>
  );
}
