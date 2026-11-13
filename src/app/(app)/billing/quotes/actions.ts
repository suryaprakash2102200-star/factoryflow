"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import type { Permission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

function ensure(ctx: Awaited<ReturnType<typeof requireAuth>>, perm: Permission) {
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
}

const ItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  amount: z.number().min(0),
  orderIndex: z.number().int().default(0),
});

const QuoteSchema = z.object({
  contactId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  issueDate: z.string(),
  expiryDate: z.string().nullable().optional(),
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

async function nextQuoteNumber(tx: Prisma.TransactionClient, tenantId: string) {
  const count = await tx.quote.count({ where: { tenantId } });
  return `QUO-${String(count + 1).padStart(4, "0")}`;
}

export async function createQuoteAction(input: z.infer<typeof QuoteSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "quote:create");
  const data = QuoteSchema.parse(input);
  const created = await withTenant(ctx.tenantId, async (tx) => {
    const number = await nextQuoteNumber(tx, ctx.tenantId);
    const q = await tx.quote.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        contactId: data.contactId ?? null,
        accountId: data.accountId ?? null,
        leadId: data.leadId ?? null,
        ownerId: data.ownerId ?? ctx.userId,
        issueDate: new Date(data.issueDate),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
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
    await audit(tx, ctx, { action: "create", entityType: "quote", entityId: q.id, summary: `Created quotation ${number}` });
    return { id: q.id, number };
  });
  revalidatePath("/billing/quotes");
  return created;
}

const UpdateQuoteSchema = QuoteSchema.extend({ id: z.string().uuid(), revisionReason: z.string().max(300).optional() });

export async function updateQuoteAction(input: z.infer<typeof UpdateQuoteSchema>) {
  const ctx = await requireAuth();
  ensure(ctx, "quote:edit");
  const { id, items, revisionReason, ...data } = UpdateQuoteSchema.parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    const current = await tx.quote.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { orderIndex: "asc" } }, _count: { select: { orders: true } } },
    });
    if (current._count.orders > 0) throw new Error("This quotation already has an order. Create a new quotation instead.");
    // Drafts are edited in place. Once a quote has gone to the customer, every edit
    // keeps the previous version as a revision and the quote goes back to draft.
    const revise = current.status !== "draft";
    if (revise) {
      const { items: oldItems, _count, ...head } = current;
      void _count;
      await tx.quoteRevision.create({
        data: {
          tenantId: ctx.tenantId,
          quoteId: id,
          revision: current.revision,
          total: current.total,
          reason: revisionReason?.trim() || null,
          createdById: ctx.userId,
          snapshot: JSON.parse(JSON.stringify({ ...head, items: oldItems })),
        },
      });
    }
    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    await tx.quote.update({
      where: { id },
      data: {
        ...(revise ? { revision: { increment: 1 }, status: "draft" as const } : {}),
        contactId: data.contactId ?? null,
        accountId: data.accountId ?? null,
        leadId: data.leadId ?? null,
        ownerId: data.ownerId ?? null,
        issueDate: new Date(data.issueDate),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
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
    await audit(tx, ctx, {
      action: revise ? "revise" : "update", entityType: "quote", entityId: id,
      summary: revise ? `${current.number}: revised to Rev ${current.revision + 1}${revisionReason ? ` (${revisionReason.trim()})` : ""}` : `Edited quotation ${current.number}`,
    });
  });
  revalidatePath("/billing/quotes");
  revalidatePath(`/billing/quotes/${id}`);
}

export async function listQuoteRevisionsAction(input: { quoteId: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "quote:view");
  const { quoteId } = z.object({ quoteId: z.string().uuid() }).parse(input);
  return withTenant(ctx.tenantId, async (tx) => {
    const rows = await tx.quoteRevision.findMany({
      where: { quoteId },
      orderBy: { revision: "desc" },
      include: { createdBy: { select: { fullName: true } } },
    });
    return rows.map((r) => {
      const snap = r.snapshot as { currency?: string; items?: { description: string; quantity: string; unitPrice: string; amount: string }[] };
      return {
        id: r.id,
        revision: r.revision,
        total: Number(r.total),
        currency: snap.currency ?? "USD",
        reason: r.reason,
        by: r.createdBy?.fullName ?? null,
        createdAt: r.createdAt.toISOString(),
        items: (snap.items ?? []).map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), amount: Number(i.amount) })),
      };
    });
  });
}

export async function updateQuoteStatusAction(input: { id: string; status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "invoiced" }) {
  const ctx = await requireAuth();
  ensure(ctx, "quote:edit");
  await withTenant(ctx.tenantId, async (tx) => {
    const before = await tx.quote.findUniqueOrThrow({ where: { id: input.id }, select: { status: true, number: true, ownerId: true } });
    await tx.quote.update({ where: { id: input.id }, data: { status: input.status } });
    await audit(tx, ctx, { action: "status", entityType: "quote", entityId: input.id, summary: `${before.number}: ${before.status} → ${input.status}` });
    if (input.status === "accepted" || input.status === "rejected")
      await notify(tx, ctx, [before.ownerId], {
        type: "quote_" + input.status,
        title: `${before.number} was ${input.status}`,
        body: input.status === "accepted" ? "Create the order from Quotations" : undefined,
        href: "/billing/quotes",
      });
  });
  revalidatePath("/billing/quotes");
  revalidatePath(`/billing/quotes/${input.id}`);
}

export async function deleteQuoteAction(input: { id: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "quote:delete");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.quote.delete({ where: { id: input.id } });
  });
  revalidatePath("/billing/quotes");
}

export async function convertQuoteToInvoiceAction(input: { quoteId: string; type: "invoice" | "proforma"; dueDate?: string }) {
  const ctx = await requireAuth();
  ensure(ctx, "invoice:create");
  let invoiceId = "";
  await withTenant(ctx.tenantId, async (tx) => {
    const quote = await tx.quote.findUniqueOrThrow({
      where: { id: input.quoteId },
      include: { items: true },
    });
    const count = await tx.invoice.count({ where: { tenantId: ctx.tenantId } });
    const prefix = input.type === "proforma" ? "PRO" : "INV";
    const number = `${prefix}-${String(count + 1).padStart(4, "0")}`;
    const inv = await tx.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        type: input.type,
        quoteId: quote.id,
        contactId: quote.contactId,
        accountId: quote.accountId,
        leadId: quote.leadId,
        ownerId: quote.ownerId,
        issueDate: new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        currency: quote.currency,
        subtotal: quote.subtotal,
        discountAmt: quote.discountAmt,
        taxAmt: quote.taxAmt,
        total: quote.total,
        notes: quote.notes,
        terms: quote.terms,
        items: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: (quote.items as any[]).map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            amount: item.amount,
            orderIndex: item.orderIndex,
          })),
        },
      },
    });
    await tx.quote.update({ where: { id: quote.id }, data: { status: "invoiced" } });
    invoiceId = inv.id;
  });
  revalidatePath("/billing/quotes");
  revalidatePath("/billing/invoices");
  return { invoiceId };
}
