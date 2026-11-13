import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { RolesClient } from "./RolesClient";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.includes("role:view")) {
    return <div className="text-sm text-slate-500">No access.</div>;
  }

  const { roles, permissionsByRole } = await withTenant(
    ctx.tenantId,
    async (tx) => {
      const roles = await tx.role.findMany({ orderBy: { name: "asc" } });
      const all = await tx.rolePermission.findMany();
      const byRole = new Map<string, string[]>();
      for (const p of all) {
        const key = `${p.resource}:${p.action}`;
        const arr = byRole.get(p.roleId) ?? [];
        arr.push(key);
        byRole.set(p.roleId, arr);
      }
      return {
        roles,
        permissionsByRole: Object.fromEntries(byRole),
      };
    },
  );

  return (
    <RolesClient
      permissions={ctx.permissions}
      roles={roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
      }))}
      permissionsByRole={permissionsByRole}
    />
  );
}
