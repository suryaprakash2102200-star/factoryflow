import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { AccountsClient } from "./AccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const auth = await requireAuth();

  const { accounts, users, defs } = await withTenant(auth.tenantId, async (tx) => ({
    accounts: await tx.account.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, fullName: true } },
        _count: { select: { contacts: true } },
      },
    }),
    users: await tx.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    defs: await tx.fieldDefinition.findMany({
      where: { entity: "account", isActive: true },
      orderBy: { orderIndex: "asc" },
    }),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">CRM</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Customers · {accounts.length}
            </h1>
          </div>
        </div>
        <AccountsClient
          accounts={accounts.map(a => ({
            id: a.id,
            name: a.name,
            domain: a.domain ?? null,
            industry: a.industry ?? null,
            website: a.website ?? null,
            phone: a.phone ?? null,
            ownerId: a.ownerId ?? null,
            ownerName: a.owner?.fullName ?? null,
            contactCount: a._count.contacts,
            customValues: a.customValues as Record<string, unknown>,
            createdAt: a.createdAt.toISOString(),
          }))}
          users={users}
          defs={defs.map(d => ({ id: d.id, key: d.key, label: d.label, type: d.type }))}
          canCreate={auth.permissions.includes("account:create")}
          canEdit={auth.permissions.includes("account:edit")}
          canDelete={auth.permissions.includes("account:delete")}
        />
      </div>
    </div>
  );
}
