import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { InvoicesClient } from "./InvoicesClient";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const auth = await requireAuth();

  const { invoices, contacts, accounts, users } = await withTenant(auth.tenantId, async (tx) => ({
    invoices: await tx.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { id: true, fullName: true } },
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
        items: { orderBy: { orderIndex: "asc" } },
      },
    }),
    contacts: await tx.contact.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    accounts: await tx.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    users: await tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Billing</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Invoices · {invoices.length}
          </h1>
        </div>
        <InvoicesClient
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          invoices={(invoices as any[]).map((inv: any) => ({
            id: inv.id,
            number: inv.number,
            type: inv.type,
            status: inv.status,
            contactId: inv.contactId ?? null,
            contactName: inv.contact?.fullName ?? null,
            accountId: inv.accountId ?? null,
            accountName: inv.account?.name ?? null,
            ownerId: inv.ownerId ?? null,
            ownerName: inv.owner?.fullName ?? null,
            issueDate: inv.issueDate.toISOString(),
            dueDate: inv.dueDate?.toISOString() ?? null,
            paidDate: inv.paidDate?.toISOString() ?? null,
            currency: inv.currency,
            total: Number(inv.total),
            amountPaid: Number(inv.amountPaid),
            itemCount: inv.items.length,
            items: inv.items.map((it: any) => ({
              id: it.id,
              description: it.description,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              discount: Number(it.discount),
              taxRate: Number(it.taxRate),
              amount: Number(it.amount),
              orderIndex: it.orderIndex,
            })),
            notes: inv.notes ?? null,
            terms: inv.terms ?? null,
            createdAt: inv.createdAt.toISOString(),
          }))}
          contacts={contacts}
          accounts={accounts}
          users={users}
          canCreate={auth.permissions.includes("invoice:create")}
          canEdit={auth.permissions.includes("invoice:edit")}
          canDelete={auth.permissions.includes("invoice:delete")}
        />
      </div>
    </div>
  );
}
