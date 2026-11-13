"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

function ensure(ctx: Awaited<ReturnType<typeof requireAuth>>, perm: import("@/lib/permissions").Permission) {
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
}

const ContactSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  jobTitle: z.string().max(100).nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  customValues: z.record(z.string(), z.unknown()).optional(),
});

export async function createContactAction(input: z.infer<typeof ContactSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "contact:create");
  const data = ContactSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.contact.create({
      data: {
        tenantId: ctx.tenantId,
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        jobTitle: data.jobTitle ?? null,
        accountId: data.accountId ?? null,
        ownerId: data.ownerId ?? ctx.userId,
        customValues: (data.customValues ?? {}) as object,
      },
    });
  });
  revalidatePath("/contacts");
}

const UpdateContactSchema = ContactSchema.extend({ id: z.string().uuid() });

export async function updateContactAction(input: z.infer<typeof UpdateContactSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "contact:edit");
  const { id, ...data } = UpdateContactSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.contact.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        jobTitle: data.jobTitle ?? null,
        accountId: data.accountId ?? null,
        ownerId: data.ownerId ?? null,
        customValues: (data.customValues ?? {}) as object,
      },
    });
  });
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
}

export async function deleteContactAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "contact:delete");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.contact.delete({ where: { id: input.id } });
  });
  revalidatePath("/contacts");
}
