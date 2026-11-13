"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

function ensure(ctx: Awaited<ReturnType<typeof requireAuth>>, perm: import("@/lib/permissions").Permission) {
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
}

const FieldSchema = z.object({
  entity: z.enum(["lead", "contact", "account", "task"]),
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers and underscores"),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "long_text", "number", "currency", "date", "datetime", "dropdown", "multi_select", "boolean", "formula", "lookup", "file"]),
  isRequired: z.boolean().default(false),
  isUnique: z.boolean().default(false),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional().nullable(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    maxLength: z.number().optional(),
    regex: z.string().optional(),
  }).optional().nullable(),
  formulaExpr: z.string().optional().nullable(),
  orderIndex: z.number().default(0),
});

export async function createFieldAction(input: z.infer<typeof FieldSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "field_definition:create");
  const data = FieldSchema.parse(input);

  await withTenant(ctx.tenantId, async (tx) => {
    await tx.fieldDefinition.create({
      data: {
        tenantId: ctx.tenantId,
        ...data,
        options: data.options ?? undefined,
        validation: data.validation ?? undefined,
      },
    });
  });
  revalidatePath("/admin/fields");
}

const UpdateFieldSchema = FieldSchema.partial().extend({ id: z.string().uuid() });

export async function updateFieldAction(input: z.infer<typeof UpdateFieldSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "field_definition:edit");
  const { id, ...rest } = UpdateFieldSchema.parse(input);

  await withTenant(ctx.tenantId, async (tx) => {
    await tx.fieldDefinition.update({
      where: { id },
      data: { ...rest, options: rest.options ?? undefined, validation: rest.validation ?? undefined },
    });
  });
  revalidatePath("/admin/fields");
}

export async function deleteFieldAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "field_definition:delete");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.fieldDefinition.delete({ where: { id: input.id } });
  });
  revalidatePath("/admin/fields");
}

export async function toggleFieldActiveAction(input: { id: string; isActive: boolean }) {
  const ctx = await requireAuth();
  ensure(ctx, "field_definition:edit");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.fieldDefinition.update({ where: { id: input.id }, data: { isActive: input.isActive } });
  });
  revalidatePath("/admin/fields");
}
