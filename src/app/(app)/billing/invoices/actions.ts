"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import type { Permission } from "@/lib/permissions";

function ensure(ctx: Awaited<ReturnType<typeof requireAuth>>, perm: Permission) {
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
}

const ItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  amount: z.number().min(0),
  orderIndex: z.number().int().default(0),
});

const InvoiceSchema = z.object({
  type: z.enum(["invoice", "proforma"]).default("invoice"),
  contactId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  issueDate: z.string(),
  dueDate: z.string().nullable().optional(),
  currency: z.string().length(3).default("USD"),
  subtotal: z.number().min(0),
  discountAmt: z.number().min(0).default(0),
  taxAmt: z.number().min(0).default(0),
  total: z.number().min(0),
  notes: z.string().nullable().optional(),
  terms: z.string().nullable().optional(),
  items: z.array(ItemSchema),
});

function toDecimal(n: number) { return n.toFixed(2); }

export async function createInvoiceAction(input: z.infer<typeof InvoiceSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "invoice:create");
  const data = InvoiceSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    const count = await tx.invoice.count({ where: { tenantId: ctx.tenantId } });
    const prefix = data.type === "proforma" ? "PRO" : "INV";
    const number = `${prefix}-${String(count + 1).padStart(4, "0")}`;
    await tx.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        type: data.type,
        contactId: data.contactId ?? null,
        accountId: data.accountId ?? null,
        leadId: data.leadId ?? null,
        ownerId: data.ownerId ?? ctx.userId,
        issueDate: new Date(data.issueDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        currency: data.currency,
        subtotal: toDecimal(data.subtotal),
        discountAmt: toDecimal(data.discountAmt),
        taxAmt: toDecimal(data.taxAmt),
        total: toDecimal(data.total),
        notes: data.notes ?? null,
        terms: data.terms ?? null,
        items: {
          create: data.items.map((item, i) => ({
            description: item.description,
            quantity: toDecimal(item.quantity),
            unitPrice: toDecimal(item.unitPrice),
            discount: toDecimal(item.discount),
            taxRate: toDecimal(item.taxRate),
            amount: toDecimal(item.amount),
            orderIndex: i,
          })),
        },
      },
    });
  });
  revalidatePath("/billing/invoices");
}

const UpdateInvoiceSchema = InvoiceSchema.extend({ id: z.string().uuid() });

export async function updateInvoiceAction(input: z.infer<typeof UpdateInvoiceSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "invoice:edit");
  const { id, items, ...data } = UpdateInvoiceSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        contactId: data.contactId ?? null,
        accountId: data.accountId ?? null,
        leadId: data.leadId ?? null,
        ownerId: data.ownerId ?? null,
        issueDate: new Date(data.issueDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        currency: data.currency,
        subtotal: toDecimal(data.subtotal),
        discountAmt: toDecimal(data.discountAmt),
        taxAmt: toDecimal(data.taxAmt),
        total: toDecimal(data.total),
        notes: data.notes ?? null,
        terms: data.terms ?? null,
        items: {
          create: items.map((item, i) => ({
            description: item.description,
            quantity: toDecimal(item.quantity),
            unitPrice: toDecimal(item.unitPrice),
            discount: toDecimal(item.discount),
            taxRate: toDecimal(item.taxRate),
            amount: toDecimal(item.amount),
            orderIndex: i,
          })),
        },
      },
    });
  });
  revalidatePath("/billing/invoices");
  revalidatePath(`/billing/invoices/${id}`);
}

export async function updateInvoiceStatusAction(input: { id: string; status: "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial"; paidDate?: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "invoice:edit");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.invoice.update({
      where: { id: input.id },
      data: {
        status: input.status,
        paidDate: input.paidDate ? new Date(input.paidDate) : (input.status === "paid" ? new Date() : undefined),
      },
    });
  });
  revalidatePath("/billing/invoices");
  revalidatePath(`/billing/invoices/${input.id}`);
}

export async function deleteInvoiceAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "invoice:delete");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.invoice.delete({ where: { id: input.id } });
  });
  revalidatePath("/billing/invoices");
}
