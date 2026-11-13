"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { requireModule } from "@/lib/modules-server";
import { notify } from "@/lib/notify";
import { audit, nextNumber } from "@/lib/audit";
import { ORDER_STATUS, ORDER_TRANSITIONS, ORDER_STATUSES, type OrderStatus } from "@/lib/factory";
import type { Permission } from "@/lib/permissions";

type Ctx = Awaited<ReturnType<typeof requireAuth>>;

async function guard(perm: Permission): Promise<Ctx> {
  const ctx = await requireAuth();
  if (!hasPerm(ctx, perm)) throw new Error(`FORBIDDEN: ${perm}`);
  await requireModule(ctx.tenantId, "orders");
  return ctx;
}

const money = (n: number) => n.toFixed(2);

const ItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).default("pcs"),
  unitPrice: z.number().min(0),
});

const OrderSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  orderDate: z.string().min(1),
  dueDate: z.string().nullable().optional(),
  poReference: z.string().trim().nullable().optional(),
  currency: z.string().length(3).default("USD"),
  notes: z.string().nullable().optional(),
  items: z.array(ItemSchema).min(1, "Add at least one line item"),
});

function itemRows(items: z.infer<typeof ItemSchema>[]) {
  return items.map((it, i) => ({
    description: it.description,
    quantity: money(it.quantity),
    unit: it.unit,
    unitPrice: money(it.unitPrice),
    amount: money(it.quantity * it.unitPrice),
    orderIndex: i,
  }));
}

export async function createOrderAction(input: z.infer<typeof OrderSchema>) {
  const ctx = await guard("order:create");
  const data = OrderSchema.parse(input);
  const total = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const id = await withTenant(ctx.tenantId, async (tx) => {
    const number = await nextNumber(() => tx.order.count(), "ORD");
    const order = await tx.order.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        accountId: data.accountId ?? null,
        contactId: data.contactId ?? null,
        ownerId: data.ownerId ?? ctx.userId,
        orderDate: new Date(data.orderDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        poReference: data.poReference || null,
        currency: data.currency,
        total: money(total),
        notes: data.notes ?? null,
        items: { create: itemRows(data.items) },
        history: { create: { tenantId: ctx.tenantId, toStatus: "draft", changedById: ctx.userId, note: "Order created" } },
      },
    });
    await audit(tx, ctx, { action: "create", entityType: "order", entityId: order.id, summary: `Created order ${number}` });
    return order.id;
  });
  revalidatePath("/orders");
  return { id };
}

/** Turn an accepted quotation into a confirmed order, copying its line items. */
export async function convertQuoteToOrderAction(input: { quoteId: string }) {
  const ctx = await guard("order:create");
  const { quoteId } = z.object({ quoteId: z.string().uuid() }).parse(input);
  const id = await withTenant(ctx.tenantId, async (tx) => {
    const quote = await tx.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { items: { orderBy: { orderIndex: "asc" } }, orders: { select: { id: true, number: true } } },
    });
    if (quote.status !== "accepted" && quote.status !== "invoiced")
      throw new Error("Only accepted quotations can become orders.");
    if (quote.orders.length) throw new Error(`Already converted to ${quote.orders[0].number}.`);
    const number = await nextNumber(() => tx.order.count(), "ORD");
    const order = await tx.order.create({
      data: {
        tenantId: ctx.tenantId,
        number,
        status: "confirmed",
        quoteId: quote.id,
        accountId: quote.accountId,
        contactId: quote.contactId,
        ownerId: quote.ownerId ?? ctx.userId,
        orderDate: new Date(),
        currency: quote.currency,
        total: quote.total,
        notes: quote.notes,
        items: {
          create: quote.items.map((it, i) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.amount,
            orderIndex: i,
          })),
        },
        history: {
          create: { tenantId: ctx.tenantId, toStatus: "confirmed", changedById: ctx.userId, note: `Converted from quotation ${quote.number}` },
        },
      },
    });
    await audit(tx, ctx, {
      action: "convert", entityType: "order", entityId: order.id,
      summary: `Converted quotation ${quote.number} to order ${number}`, meta: { quoteId: quote.id },
    });
    return order.id;
  });
  revalidatePath("/orders");
  revalidatePath("/billing/quotes");
  return { id };
}

export async function updateOrderStatusAction(input: { id: string; status: OrderStatus; note?: string }) {
  const ctx = await guard("order:edit");
  const data = z.object({ id: z.string().uuid(), status: z.enum(ORDER_STATUSES), note: z.string().optional() }).parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: data.id }, select: { status: true, number: true, ownerId: true } });
    if (!ORDER_TRANSITIONS[order.status].includes(data.status))
      throw new Error(`Can't move from ${ORDER_STATUS[order.status].label} to ${ORDER_STATUS[data.status].label}.`);
    await tx.order.update({
      where: { id: data.id },
      data: { status: data.status, ...(data.status === "dispatched" ? { dispatchedAt: new Date() } : {}) },
    });
    await tx.orderStatusHistory.create({
      data: {
        tenantId: ctx.tenantId, orderId: data.id, fromStatus: order.status, toStatus: data.status,
        note: data.note?.trim() || null, changedById: ctx.userId,
      },
    });
    await audit(tx, ctx, {
      action: "status", entityType: "order", entityId: data.id,
      summary: `${order.number}: ${ORDER_STATUS[order.status].label} → ${ORDER_STATUS[data.status].label}`,
    });
    await notify(tx, ctx, [order.ownerId], {
      type: "order_status", title: `${order.number} is now ${ORDER_STATUS[data.status].label}`,
      body: data.note?.trim() || undefined, href: `/orders/${data.id}`,
    });
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${data.id}`);
}

const UpdateSchema = OrderSchema.extend({ id: z.string().uuid() });

/** Edit details/items while the order is still a draft or just confirmed. */
export async function updateOrderAction(input: z.infer<typeof UpdateSchema>) {
  const ctx = await guard("order:edit");
  const { id, items, ...data } = UpdateSchema.parse(input);
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  await withTenant(ctx.tenantId, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id }, select: { status: true, number: true } });
    if (order.status !== "draft" && order.status !== "confirmed")
      throw new Error("Orders can only be edited while Draft or Confirmed.");
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.order.update({
      where: { id },
      data: {
        accountId: data.accountId ?? null,
        contactId: data.contactId ?? null,
        ownerId: data.ownerId ?? null,
        orderDate: new Date(data.orderDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        poReference: data.poReference || null,
        currency: data.currency,
        total: money(total),
        notes: data.notes ?? null,
        items: { create: itemRows(items) },
      },
    });
    await audit(tx, ctx, { action: "update", entityType: "order", entityId: id, summary: `Edited order ${order.number}` });
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

export async function deleteOrderAction(input: { id: string }) {
  const ctx = await guard("order:delete");
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  await withTenant(ctx.tenantId, async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id }, select: { status: true, number: true, _count: { select: { jobs: true } } } });
    if (order.status !== "draft" && order.status !== "cancelled")
      throw new Error("Only Draft or Cancelled orders can be deleted. Cancel it first.");
    if (order._count.jobs) throw new Error("This order has production jobs. Cancel instead of deleting.");
    await tx.order.delete({ where: { id } });
    await audit(tx, ctx, { action: "delete", entityType: "order", entityId: id, summary: `Deleted order ${order.number}` });
  });
  revalidatePath("/orders");
}
