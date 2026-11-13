"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

function ensure(ctx: Awaited<ReturnType<typeof requireAuth>>, perm: import("@/lib/permissions").Permission) {
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
}

const AccountSchema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().max(120).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  website: z.string().url().nullable().optional().or(z.literal("")),
  phone: z.string().max(50).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  customValues: z.record(z.string(), z.unknown()).optional(),
});

export async function createAccountAction(input: z.infer<typeof AccountSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "account:create");
  const data = AccountSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    const created = await tx.account.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        domain: data.domain ?? null,
        industry: data.industry ?? null,
        website: data.website || null,
        phone: data.phone ?? null,
        ownerId: data.ownerId ?? ctx.userId,
        customValues: (data.customValues ?? {}) as object,
      },
    });
    await audit(tx, ctx, { action: "create", entityType: "account", entityId: created.id, summary: `Created customer ${data.name}` });
  });
  revalidatePath("/accounts");
}

const UpdateAccountSchema = AccountSchema.extend({ id: z.string().uuid() });

export async function updateAccountAction(input: z.infer<typeof UpdateAccountSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "account:edit");
  const { id, ...data } = UpdateAccountSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.account.update({
      where: { id },
      data: {
        name: data.name,
        domain: data.domain ?? null,
        industry: data.industry ?? null,
        website: data.website || null,
        phone: data.phone ?? null,
        ownerId: data.ownerId ?? null,
        customValues: (data.customValues ?? {}) as object,
      },
    });
    await audit(tx, ctx, { action: "update", entityType: "account", entityId: id, summary: `Edited customer ${data.name}` });
  });
  revalidatePath("/accounts");
  revalidatePath(`/accounts/${id}`);
}

export async function deleteAccountAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "account:delete");
  await withTenant(ctx.tenantId, async (tx) => {
    const gone = await tx.account.delete({ where: { id: input.id }, select: { name: true } });
    await audit(tx, ctx, { action: "delete", entityType: "account", entityId: input.id, summary: `Deleted customer ${gone.name}` });
  });
  revalidatePath("/accounts");
}
