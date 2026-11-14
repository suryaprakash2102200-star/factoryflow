"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import {
  ACTIONS,
  RESOURCES,
  type Permission,
} from "@/lib/permissions";

function ensure(ctx: Awaited<ReturnType<typeof requireAuth>>, perm: Permission) {
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
}

/* -------------------- USERS -------------------- */
const CreateUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(80),
  password: z.string().min(8).max(120),
  roleId: z.string().uuid().optional(),
  role: z.enum(["owner", "admin", "manager", "agent", "viewer"]).default("agent"),
});

export async function createUserAction(input: z.infer<typeof CreateUserSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "user:create");
  const data = CreateUserSchema.parse(input);
  const passwordHash = await bcrypt.hash(data.password, 10);
  await withTenant(ctx.tenantId, (tx) =>
    tx.user.create({
      data: {
        tenantId: ctx.tenantId,
        email: data.email,
        fullName: data.fullName,
        passwordHash,
        role: data.role,
        roleId: data.roleId,
      },
    }),
  );
  revalidatePath("/admin/users");
}

const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(2).max(80).optional(),
  roleId: z.string().uuid().nullable().optional(),
  role: z.enum(["owner", "admin", "manager", "agent", "viewer"]).optional(),
  isActive: z.boolean().optional(),
});

export async function updateUserAction(input: z.infer<typeof UpdateUserSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "user:edit");
  const data = UpdateUserSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.user.update({
      where: { id: data.id },
      data: {
        fullName: data.fullName,
        roleId: data.roleId,
        role: data.role,
        isActive: data.isActive,
      },
    });
  });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "user:delete");
  if (input.id === ctx.userId) throw new Error("Cannot delete yourself");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.user.delete({ where: { id: input.id } });
  });
  revalidatePath("/admin/users");
}

/* -------------------- ROLES -------------------- */
const CreateRoleSchema = z.object({
  name: z.string().min(2).max(40),
  description: z.string().max(200).optional(),
});

export async function createRoleAction(input: z.infer<typeof CreateRoleSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "role:create");
  const data = CreateRoleSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.role.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        description: data.description,
        isSystem: false,
      },
    });
  });
  revalidatePath("/admin/roles");
}

const UpdateRolePermsSchema = z.object({
  roleId: z.string().uuid(),
  permissions: z.array(z.string()),
});

export async function updateRolePermissionsAction(
  input: z.infer<typeof UpdateRolePermsSchema>,
) {
  const ctx = await requireAuth();
  ensure(ctx, "role:edit");
  const data = UpdateRolePermsSchema.parse(input);
  const allowed = new Set<string>();
  for (const r of RESOURCES) for (const a of ACTIONS) allowed.add(`${r}:${a}`);
  const clean = data.permissions.filter((p) => allowed.has(p));
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: data.roleId } });
    if (clean.length) {
      await tx.rolePermission.createMany({
        data: clean.map((p) => {
          const [resource, action] = p.split(":");
          return { tenantId: ctx.tenantId, roleId: data.roleId, resource, action };
        }),
      });
    }
  });
  revalidatePath("/admin/roles");
}

export async function deleteRoleAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "role:delete");
  await withTenant(ctx.tenantId, async (tx) => {
    const role = await tx.role.findUnique({ where: { id: input.id } });
    if (!role) return;
    if (role.isSystem) throw new Error("Cannot delete system role");
    await tx.user.updateMany({
      where: { roleId: input.id },
      data: { roleId: null },
    });
    await tx.role.delete({ where: { id: input.id } });
  });
  revalidatePath("/admin/roles");
}

/* -------------------- TENANT -------------------- */
const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(80),
});

export async function updateTenantAction(
  input: z.infer<typeof UpdateTenantSchema>,
) {
  const ctx = await requireAuth();
  ensure(ctx, "tenant:edit");
  const data = UpdateTenantSchema.parse(input);
  await withTenant(ctx.tenantId, (tx) =>
    tx.organization.update({ where: { id: ctx.tenantId }, data: { name: data.name } }),
  );
  revalidatePath("/admin/tenant");
}
