import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.includes("user:view")) {
    return <div className="text-sm text-slate-500">No access.</div>;
  }

  const { users, roles } = await withTenant(ctx.tenantId, async (tx) => {
    const [users, roles] = await Promise.all([
      tx.user.findMany({
        orderBy: { createdAt: "desc" },
        include: { customRole: true },
      }),
      tx.role.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { users, roles };
  });

  return (
    <UsersClient
      permissions={ctx.permissions}
      currentUserId={ctx.userId}
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        roleId: u.roleId,
        roleName: u.customRole?.name ?? null,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      }))}
      roles={roles.map((r) => ({ id: r.id, name: r.name }))}
    />
  );
}
