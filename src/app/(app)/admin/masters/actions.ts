"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { audit } from "@/lib/audit";
import { MASTER_KIND_KEYS } from "@/lib/masters";

async function guard() {
  const ctx = await requireAuth();
  if (!hasPerm(ctx, "master:edit")) throw new Error("You don't have permission to change masters.");
  return ctx;
}
const done = () => { revalidatePath("/admin/masters"); revalidatePath("/billing/quotes"); revalidatePath("/production"); };
const friendly = (e: unknown): never => {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new Error("That code already exists.");
  throw e;
};

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(20),
  hsnCode: z.string().max(20).optional().nullable(),
  gstRate: z.number().min(0).max(100),
  price: z.number().min(0),
  material: z.string().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function saveProductAction(input: z.input<typeof ProductSchema>) {
  const ctx = await guard();
  const { id, ...d } = ProductSchema.parse(input);
  const data = { ...d, description: d.description || null, category: d.category || null, hsnCode: d.hsnCode || null, material: d.material || null };
  await withTenant(ctx.tenantId, async (tx) => {
    const row = id
      ? await tx.product.update({ where: { id }, data })
      : await tx.product.create({ data: { ...data, tenantId: ctx.tenantId } });
    await audit(tx, ctx, { action: id ? "update" : "create", entityType: "product", entityId: row.id, summary: `${id ? "Edited" : "Added"} product ${d.code} ${d.name}` });
  }).catch(friendly);
  done();
}

const MachineSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  type: z.string().max(60).optional().nullable(),
  location: z.string().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function saveMachineAction(input: z.input<typeof MachineSchema>) {
  const ctx = await guard();
  const { id, ...d } = MachineSchema.parse(input);
  const data = { ...d, type: d.type || null, location: d.location || null };
  await withTenant(ctx.tenantId, async (tx) => {
    const row = id
      ? await tx.machine.update({ where: { id }, data })
      : await tx.machine.create({ data: { ...data, tenantId: ctx.tenantId } });
    await audit(tx, ctx, { action: id ? "update" : "create", entityType: "machine", entityId: row.id, summary: `${id ? "Edited" : "Added"} machine ${d.code} ${d.name}` });
  }).catch(friendly);
  done();
}

const ValueSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(MASTER_KIND_KEYS as [string, ...string[]]),
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  isDefault: z.boolean().default(false),
});

export async function saveMasterValueAction(input: z.input<typeof ValueSchema>) {
  const ctx = await guard();
  const { id, ...d } = ValueSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    if (d.isDefault) await tx.masterValue.updateMany({ where: { kind: d.kind, isDefault: true }, data: { isDefault: false } });
    if (id) await tx.masterValue.update({ where: { id }, data: d });
    else {
      const orderIndex = await tx.masterValue.count({ where: { kind: d.kind } });
      await tx.masterValue.create({ data: { ...d, orderIndex, tenantId: ctx.tenantId } });
    }
  }).catch(friendly);
  done();
}

export async function deleteMasterValueAction(input: { id: string }) {
  const ctx = await guard();
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  await withTenant(ctx.tenantId, (tx) => tx.masterValue.delete({ where: { id } }));
  done();
}
