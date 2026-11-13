import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { ContactsClient } from "./ContactsClient";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const auth = await requireAuth();

  const { contacts, accounts, users, defs } = await withTenant(auth.tenantId, async (tx) => ({
    contacts: await tx.contact.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: { select: { id: true, fullName: true } }, account: { select: { id: true, name: true } } },
    }),
    accounts: await tx.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    users: await tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    defs: await tx.fieldDefinition.findMany({ where: { entity: "contact", isActive: true }, orderBy: { orderIndex: "asc" } }),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">CRM</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Contacts · {contacts.length}
            </h1>
          </div>
        </div>
        <ContactsClient
          contacts={contacts.map(c => ({
            id: c.id,
            fullName: c.fullName,
            email: c.email ?? null,
            phone: c.phone ?? null,
            jobTitle: c.jobTitle ?? null,
            accountId: c.accountId ?? null,
            accountName: c.account?.name ?? null,
            ownerId: c.ownerId ?? null,
            ownerName: c.owner?.fullName ?? null,
            customValues: c.customValues as Record<string, unknown>,
            createdAt: c.createdAt.toISOString(),
          }))}
          accounts={accounts}
          users={users}
          defs={defs.map(d => ({ id: d.id, key: d.key, label: d.label, type: d.type }))}
          canCreate={auth.permissions.includes("contact:create")}
          canEdit={auth.permissions.includes("contact:edit")}
          canDelete={auth.permissions.includes("contact:delete")}
        />
      </div>
    </div>
  );
}
