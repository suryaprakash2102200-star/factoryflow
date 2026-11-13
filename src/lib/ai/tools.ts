import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { AuthContext } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { ORDER_STATUSES, JOB_STAGES } from "@/lib/factory";
import { dailySummary, businessReport } from "./data";
// Writes go through the same server actions the screens use, so permissions,
// module switches, audit log and notifications all apply to the assistant too.
import { createAccountAction } from "@/app/(app)/accounts/actions";
import { createLeadAction } from "@/app/(app)/leads/actions";
import { changeStageAction, addTaskAction, addNoteAction } from "@/app/(app)/leads/[id]/actions";
import { createQuoteAction, updateQuoteStatusAction } from "@/app/(app)/billing/quotes/actions";
import { convertQuoteToOrderAction, updateOrderStatusAction } from "@/app/(app)/orders/actions";
import { updateJobStageAction, recordOutputAction, updateJobAction } from "@/app/(app)/production/actions";

export type ActionLog = { label: string; href?: string };

const n = (d: unknown) => Number(d ?? 0);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const json = (v: unknown) => JSON.stringify(v);
const ENTITIES = ["enquiry", "customer", "quote", "order", "job", "invoice", "product", "machine"] as const;
const PERM: Record<(typeof ENTITIES)[number], string> = {
  enquiry: "lead:view", customer: "account:view", quote: "quote:view", order: "order:view",
  job: "production:view", invoice: "invoice:view", product: "master:view", machine: "master:view",
};

/** Builds the assistant's tools for one signed-in user. `log` collects what was changed. */
export function buildTools(ctx: AuthContext, log: ActionLog[]) {
  const can = (p: string) => ctx.permissions.includes(p as never);
  const db = <T,>(fn: Parameters<typeof withTenant<T>>[1]) => withTenant<T>(ctx.tenantId, fn);
  const guard = async (fn: () => Promise<string>) => {
    try { return await fn(); } catch (e) { return json({ error: (e as Error).message }); }
  };

  const findAccount = (name: string) => db((tx) => tx.account.findFirst({ where: { name: { contains: name, mode: "insensitive" } }, select: { id: true, name: true, contacts: { select: { id: true }, take: 1 } } }));
  const findUser = (name: string) => db((tx) => tx.user.findFirst({ where: { isActive: true, fullName: { contains: name, mode: "insensitive" } }, select: { id: true, fullName: true } }));

  const search = betaZodTool({
    name: "search_records",
    description: "List or search records. Use for questions like 'which orders are late', 'quotes for Deccan', 'jobs on CNC-01'. Returns at most `limit` rows, newest first. Statuses — order: draft, confirmed, in_production, ready, dispatched, closed, cancelled; quote: draft, sent, accepted, rejected, expired, invoiced; job stage: planned, in_progress, paused, quality_check, completed, cancelled; invoice: draft, sent, paid, overdue, partial, cancelled.",
    inputSchema: z.object({
      entity: z.enum(ENTITIES),
      query: z.string().optional().describe("Text to match against number, title, customer, item or person"),
      status: z.string().optional().describe("Status / stage filter, see description"),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    run: ({ entity, query, status, limit = 20 }) => guard(async () => {
      if (!can(PERM[entity])) return json({ error: `You don't have access to ${entity} records.` });
      const q = query?.trim();
      const ci = (v: string) => ({ contains: v, mode: "insensitive" as const });
      return db(async (tx) => {
        switch (entity) {
          case "enquiry": {
            const rows = await tx.lead.findMany({ where: { ...(q ? { OR: [{ title: ci(q) }] } : {}), ...(status ? { stage: { name: ci(status) } } : {}) }, take: limit, orderBy: { createdAt: "desc" }, select: { id: true, title: true, estimatedValue: true, createdAt: true, customValues: true, stage: { select: { name: true } }, owner: { select: { fullName: true } } } });
            return json(rows.map((r) => ({ id: r.id, title: r.title, stage: r.stage.name, value: r.estimatedValue, owner: r.owner?.fullName, received: day(r.createdAt), fields: r.customValues, link: `/leads/${r.id}` })));
          }
          case "customer": {
            const rows = await tx.account.findMany({ where: q ? { OR: [{ name: ci(q) }, { industry: ci(q) }] } : {}, take: limit, orderBy: { name: "asc" }, select: { id: true, name: true, industry: true, phone: true, customValues: true, owner: { select: { fullName: true } }, _count: { select: { orders: true, quotes: true } }, contacts: { select: { fullName: true, phone: true, email: true }, take: 2 } } });
            return json(rows.map((r) => ({ id: r.id, name: r.name, industry: r.industry, city: (r.customValues as Record<string, unknown>)?.city, phone: r.phone, owner: r.owner?.fullName, orders: r._count.orders, quotes: r._count.quotes, contacts: r.contacts })));
          }
          case "quote": {
            const rows = await tx.quote.findMany({ where: { ...(q ? { OR: [{ number: ci(q) }, { account: { name: ci(q) } }] } : {}), ...(status ? { status: status as never } : {}) }, take: limit, orderBy: { createdAt: "desc" }, select: { id: true, number: true, revision: true, status: true, issueDate: true, total: true, currency: true, account: { select: { name: true } }, owner: { select: { fullName: true } }, orders: { select: { number: true }, take: 1 } } });
            return json(rows.map((r) => ({ number: r.number, rev: r.revision, status: r.status, customer: r.account?.name, date: day(r.issueDate), total: n(r.total), currency: r.currency, owner: r.owner?.fullName, order: r.orders[0]?.number ?? null, link: "/billing/quotes" })));
          }
          case "order": {
            const rows = await tx.order.findMany({ where: { ...(q ? { OR: [{ number: ci(q) }, { poReference: ci(q) }, { account: { name: ci(q) } }] } : {}), ...(status ? { status: status as never } : {}) }, take: limit, orderBy: { orderDate: "desc" }, select: { id: true, number: true, status: true, orderDate: true, dueDate: true, dispatchedAt: true, total: true, poReference: true, account: { select: { name: true } }, _count: { select: { jobs: true } } } });
            const now = Date.now();
            return json(rows.map((r) => ({ number: r.number, status: r.status, customer: r.account?.name, po: r.poReference, ordered: day(r.orderDate), due: day(r.dueDate), late: !!(r.dueDate && !r.dispatchedAt && r.dueDate.getTime() < now && !["closed", "cancelled"].includes(r.status)), dispatched: day(r.dispatchedAt), total: n(r.total), jobs: r._count.jobs, link: `/orders/${r.id}` })));
          }
          case "job": {
            const rows = await tx.productionJob.findMany({ where: { ...(q ? { OR: [{ number: ci(q) }, { title: ci(q) }, { order: { number: ci(q) } }, { machine: { code: ci(q) } }, { assignee: { fullName: ci(q) } }] } : {}), ...(status ? { stage: status as never } : {}) }, take: limit, orderBy: { createdAt: "desc" }, select: { id: true, number: true, title: true, stage: true, dueDate: true, targetQty: true, outputQty: true, rejectQty: true, unit: true, assignee: { select: { fullName: true } }, machine: { select: { code: true } }, order: { select: { number: true } } } });
            return json(rows.map((r) => ({ number: r.number, title: r.title, stage: r.stage, order: r.order?.number, machine: r.machine?.code, operator: r.assignee?.fullName, due: day(r.dueDate), output: `${n(r.outputQty)}/${n(r.targetQty)} ${r.unit}`, rejected: n(r.rejectQty), link: `/production/${r.id}` })));
          }
          case "invoice": {
            const rows = await tx.invoice.findMany({ where: { ...(q ? { OR: [{ number: ci(q) }, { account: { name: ci(q) } }] } : {}), ...(status ? { status: status as never } : {}) }, take: limit, orderBy: { issueDate: "desc" }, select: { number: true, status: true, issueDate: true, dueDate: true, total: true, amountPaid: true, account: { select: { name: true } } } });
            return json(rows.map((r) => ({ number: r.number, status: r.status, customer: r.account?.name, issued: day(r.issueDate), due: day(r.dueDate), total: n(r.total), paid: n(r.amountPaid), link: "/billing/invoices" })));
          }
          case "product": {
            const rows = await tx.product.findMany({ where: { isActive: true, ...(q ? { OR: [{ code: ci(q) }, { name: ci(q) }, { material: ci(q) }, { category: ci(q) }] } : {}) }, take: limit, orderBy: { code: "asc" }, select: { code: true, name: true, unit: true, price: true, gstRate: true, hsnCode: true, material: true, category: true } });
            return json(rows.map((r) => ({ ...r, price: n(r.price), gstRate: n(r.gstRate) })));
          }
          case "machine": {
            const rows = await tx.machine.findMany({ where: q ? { OR: [{ code: ci(q) }, { name: ci(q) }, { type: ci(q) }] } : {}, take: limit, select: { code: true, name: true, type: true, location: true, isActive: true, jobs: { where: { stage: { in: ["planned", "in_progress", "paused", "quality_check"] } }, select: { number: true, stage: true } } } });
            return json(rows);
          }
        }
      });
    }),
  });

  const getRecord = betaZodTool({
    name: "get_record",
    description: "Full details of one record by its number (ORD-0012, QUO-0004, JOB-0031, INV-0007) or, for enquiries/customers, by id or exact name.",
    inputSchema: z.object({ entity: z.enum(["enquiry", "customer", "quote", "order", "job"]), ref: z.string() }),
    run: ({ entity, ref }) => guard(async () => {
      if (!can(PERM[entity])) return json({ error: `You don't have access to ${entity} records.` });
      const isId = /^[0-9a-f-]{36}$/i.test(ref);
      return db(async (tx) => {
        if (entity === "order") {
          const o = await tx.order.findFirst({ where: isId ? { id: ref } : { number: { equals: ref, mode: "insensitive" } }, include: { account: { select: { name: true } }, contact: { select: { fullName: true, phone: true } }, owner: { select: { fullName: true } }, quote: { select: { number: true } }, items: { orderBy: { orderIndex: "asc" } }, jobs: { select: { number: true, title: true, stage: true, outputQty: true, targetQty: true, unit: true } }, history: { orderBy: { changedAt: "asc" }, select: { toStatus: true, note: true, changedAt: true } } } });
          if (!o) return json({ error: "Order not found" });
          return json({ ...o, total: n(o.total), items: o.items.map((i) => ({ description: i.description, qty: n(i.quantity), unit: i.unit, price: n(i.unitPrice) })), jobs: o.jobs.map((j) => ({ ...j, outputQty: n(j.outputQty), targetQty: n(j.targetQty) })), link: `/orders/${o.id}` });
        }
        if (entity === "quote") {
          const q = await tx.quote.findFirst({ where: isId ? { id: ref } : { number: { equals: ref, mode: "insensitive" } }, include: { account: { select: { name: true } }, items: { orderBy: { orderIndex: "asc" } }, revisions: { select: { revision: true, total: true, reason: true } }, orders: { select: { number: true } } } });
          if (!q) return json({ error: "Quotation not found" });
          return json({ number: q.number, rev: q.revision, status: q.status, customer: q.account?.name, total: n(q.total), currency: q.currency, terms: q.terms, items: q.items.map((i) => ({ description: i.description, qty: n(i.quantity), price: n(i.unitPrice), discount: n(i.discount), tax: n(i.taxRate) })), revisions: q.revisions.map((r) => ({ ...r, total: n(r.total) })), order: q.orders[0]?.number ?? null });
        }
        if (entity === "job") {
          const j = await tx.productionJob.findFirst({ where: isId ? { id: ref } : { number: { equals: ref, mode: "insensitive" } }, include: { order: { select: { number: true } }, assignee: { select: { fullName: true } }, machine: { select: { code: true, name: true } }, updates: { orderBy: { createdAt: "desc" }, take: 10, select: { toStage: true, outputDelta: true, rejectDelta: true, note: true, createdAt: true } } } });
          if (!j) return json({ error: "Job not found" });
          return json({ ...j, targetQty: n(j.targetQty), outputQty: n(j.outputQty), rejectQty: n(j.rejectQty), updates: j.updates.map((u) => ({ ...u, outputDelta: n(u.outputDelta), rejectDelta: n(u.rejectDelta) })), link: `/production/${j.id}` });
        }
        if (entity === "enquiry") {
          const l = await tx.lead.findFirst({ where: isId ? { id: ref } : { title: { contains: ref, mode: "insensitive" } }, include: { stage: { select: { name: true } }, owner: { select: { fullName: true } }, quotes: { select: { number: true, status: true, total: true } }, activities: { orderBy: { createdAt: "desc" }, take: 5, select: { type: true, title: true, createdAt: true } } } });
          if (!l) return json({ error: "Enquiry not found" });
          return json({ id: l.id, title: l.title, stage: l.stage.name, owner: l.owner?.fullName, fields: l.customValues, quotes: l.quotes.map((q) => ({ ...q, total: n(q.total) })), recent: l.activities, link: `/leads/${l.id}` });
        }
        const a = await tx.account.findFirst({ where: isId ? { id: ref } : { name: { contains: ref, mode: "insensitive" } }, include: { contacts: { select: { fullName: true, phone: true, email: true } }, orders: { orderBy: { orderDate: "desc" }, take: 5, select: { number: true, status: true, total: true, orderDate: true } }, quotes: { orderBy: { createdAt: "desc" }, take: 5, select: { number: true, status: true, total: true } } } });
        if (!a) return json({ error: "Customer not found" });
        return json({ ...a, orders: a.orders.map((o) => ({ ...o, total: n(o.total) })), quotes: a.quotes.map((q) => ({ ...q, total: n(q.total) })) });
      });
    }),
  });

  const summary = betaZodTool({
    name: "daily_summary",
    description: "What needs attention today: overdue / due-soon orders, ready to dispatch, overdue or paused jobs, quotes with no reply after 7 days, enquiries not yet quoted, overdue invoices, tasks due.",
    inputSchema: z.object({}),
    run: () => guard(() => db(async (tx) => json(await dailySummary(tx, ctx.permissions)))),
  });

  const report = betaZodTool({
    name: "business_report",
    description: "Metrics for the last N days: enquiries, quotations, win rate, quoted/won value, orders booked, on-time dispatch, order-to-dispatch days, top customers, good output, rejects, output by person.",
    inputSchema: z.object({ days: z.number().int().min(1).max(730).describe("Look-back window, e.g. 7, 30, 90") }),
    run: ({ days }) => guard(() => db(async (tx) => json(await businessReport(tx, ctx.permissions, days)))),
  });

  // ── writes ────────────────────────────────────────────────────────────────

  const createCustomer = betaZodTool({
    name: "create_customer",
    description: "Add a customer company (and optionally its first contact). Check with search_records first that it doesn't already exist.",
    inputSchema: z.object({ name: z.string(), industry: z.string().optional(), city: z.string().optional(), phone: z.string().optional() }),
    run: (i) => guard(async () => {
      await createAccountAction({ name: i.name, industry: i.industry, phone: i.phone, customValues: i.city ? { city: i.city } : {} } as never);
      const a = await findAccount(i.name);
      log.push({ label: `Created customer ${i.name}`, href: "/accounts" });
      return json({ ok: true, id: a?.id, name: a?.name });
    }),
  });

  const createEnquiry = betaZodTool({
    name: "create_enquiry",
    description: "Log a new customer enquiry (RFQ). Use when the user pastes an email/WhatsApp message or describes a request.",
    inputSchema: z.object({
      title: z.string().describe("Short title, e.g. 'Deccan Conveyor – 200 conveyor rollers Ø89'"),
      product_required: z.string(),
      quantity: z.number().optional(),
      material: z.string().optional(),
      required_by: z.string().optional().describe("YYYY-MM-DD"),
      drawing_ref: z.string().optional(),
      source: z.enum(["phone", "email", "whatsapp", "visit", "referral", "tradeshow"]).optional(),
      requirements: z.string().optional().describe("Anything else from the message"),
      owner_name: z.string().optional(),
    }),
    run: (i) => guard(async () => {
      const stage = await db((tx) => tx.leadStage.findFirst({ orderBy: { orderIndex: "asc" }, select: { id: true } }));
      if (!stage) return json({ error: "No enquiry stages are set up." });
      const owner = i.owner_name ? await findUser(i.owner_name) : null;
      const cv: Record<string, unknown> = { product_required: i.product_required };
      if (i.quantity != null) cv.quantity = i.quantity;
      if (i.material) cv.material = i.material;
      if (i.required_by) cv.required_by = i.required_by;
      if (i.drawing_ref) cv.drawing_ref = i.drawing_ref;
      if (i.source) cv.enquiry_source = i.source;
      if (i.requirements) cv.requirements = i.requirements;
      const r = await createLeadAction({ title: i.title, stageId: stage.id, ownerId: owner?.id, customValues: cv });
      if (!r.ok) return json({ error: "Validation failed", details: r.errors });
      log.push({ label: `Logged enquiry “${i.title}”`, href: `/leads/${r.lead.id}` });
      return json({ ok: true, id: r.lead.id, link: `/leads/${r.lead.id}` });
    }),
  });

  const moveEnquiry = betaZodTool({
    name: "update_enquiry",
    description: "Move an enquiry to another stage (New enquiry, Qualified, Quoted, Negotiation, Won, Lost) and/or add a note or a follow-up task.",
    inputSchema: z.object({
      enquiry_id: z.string(),
      stage: z.string().optional(),
      reason: z.string().optional(),
      note: z.string().optional(),
      task: z.object({ title: z.string(), due: z.string().describe("YYYY-MM-DD"), assignee_name: z.string().optional() }).optional(),
    }),
    run: (i) => guard(async () => {
      const done: string[] = [];
      if (i.stage) {
        const st = await db((tx) => tx.leadStage.findFirst({ where: { name: { equals: i.stage!, mode: "insensitive" } }, select: { id: true, name: true } }));
        if (!st) return json({ error: `No stage called ${i.stage}` });
        await changeStageAction({ leadId: i.enquiry_id, toStageId: st.id, reason: i.reason });
        done.push(`moved to ${st.name}`);
      }
      if (i.note) { await addNoteAction({ leadId: i.enquiry_id, body: i.note } as never); done.push("note added"); }
      if (i.task) {
        const who = i.task.assignee_name ? await findUser(i.task.assignee_name) : null;
        await addTaskAction({ leadId: i.enquiry_id, item: i.task.title, ecd: new Date(i.task.due + "T12:00:00Z").toISOString(), assigneeId: who?.id, priority: "medium" });
        done.push(`task “${i.task.title}” due ${i.task.due}`);
      }
      log.push({ label: `Enquiry updated: ${done.join(", ")}`, href: `/leads/${i.enquiry_id}` });
      return json({ ok: true, done });
    }),
  });

  const createQuote = betaZodTool({
    name: "create_quote",
    description: "Create a DRAFT quotation. Prefer product_code from the item master (search_records entity=product) so price and GST come from the master; unit_price overrides the master price. Currency INR unless told otherwise.",
    inputSchema: z.object({
      customer: z.string().describe("Customer name as stored"),
      enquiry_id: z.string().optional(),
      items: z.array(z.object({
        product_code: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().positive(),
        unit_price: z.number().min(0).optional(),
        discount_pct: z.number().min(0).max(100).optional(),
        gst_pct: z.number().min(0).max(100).optional(),
      })).min(1),
      payment_terms: z.string().optional(),
      valid_days: z.number().int().optional(),
      notes: z.string().optional(),
    }),
    run: (i) => guard(async () => {
      const acc = await findAccount(i.customer);
      if (!acc) return json({ error: `No customer matching “${i.customer}”. Create it first.` });
      const codes = i.items.map((x) => x.product_code).filter(Boolean) as string[];
      const prods = await db((tx) => tx.product.findMany({ where: { code: { in: codes } } }));
      const lines = [];
      for (const [k, it] of i.items.entries()) {
        const p = it.product_code ? prods.find((x) => x.code.toLowerCase() === it.product_code!.toLowerCase()) : undefined;
        if (it.product_code && !p) return json({ error: `Unknown item code ${it.product_code}` });
        const price = it.unit_price ?? n(p?.price);
        const disc = it.discount_pct ?? 0;
        const tax = it.gst_pct ?? (p ? n(p.gstRate) : 18);
        const after = it.quantity * price * (1 - disc / 100);
        lines.push({ description: p ? `${p.name} (${p.code})` : it.description || "Item", quantity: it.quantity, unitPrice: price, discount: disc, taxRate: tax, amount: +(after * (1 + tax / 100)).toFixed(2), orderIndex: k, _base: it.quantity * price, _after: after });
      }
      const subtotal = lines.reduce((s, l) => s + l._base, 0);
      const after = lines.reduce((s, l) => s + l._after, 0);
      const total = lines.reduce((s, l) => s + l.amount, 0);
      const terms = i.payment_terms ?? (await db((tx) => tx.masterValue.findFirst({ where: { kind: "payment_term", isDefault: true } })))?.label ?? null;
      const today = new Date();
      const q = await createQuoteAction({
        accountId: acc.id, contactId: acc.contacts[0]?.id ?? null, leadId: i.enquiry_id ?? null, ownerId: ctx.userId,
        issueDate: today.toISOString().slice(0, 10), expiryDate: new Date(today.getTime() + (i.valid_days ?? 30) * 86_400_000).toISOString().slice(0, 10),
        currency: "INR", subtotal: +subtotal.toFixed(2), discountAmt: +(subtotal - after).toFixed(2), taxAmt: +(total - after).toFixed(2), total: +total.toFixed(2),
        notes: i.notes ?? null, terms,
        items: lines.map(({ _base, _after, ...l }) => (void _base, void _after, l)),
      });
      log.push({ label: `Drafted quotation ${q.number} for ${acc.name} (₹${total.toLocaleString("en-IN", { maximumFractionDigits: 0 })})`, href: "/billing/quotes" });
      return json({ ok: true, number: q.number, total: +total.toFixed(2), status: "draft", link: "/billing/quotes" });
    }),
  });

  const quoteStatus = betaZodTool({
    name: "update_quote",
    description: "Change a quotation's status (sent, accepted, rejected, expired) or turn an accepted quotation into an order (convert_to_order: true).",
    inputSchema: z.object({ number: z.string(), status: z.enum(["sent", "accepted", "rejected", "expired"]).optional(), convert_to_order: z.boolean().optional() }),
    run: (i) => guard(async () => {
      const q = await db((tx) => tx.quote.findFirst({ where: { number: { equals: i.number, mode: "insensitive" } }, select: { id: true, number: true } }));
      if (!q) return json({ error: "Quotation not found" });
      const out: Record<string, unknown> = {};
      if (i.status) { await updateQuoteStatusAction({ id: q.id, status: i.status }); out.status = i.status; log.push({ label: `${q.number} marked ${i.status}`, href: "/billing/quotes" }); }
      if (i.convert_to_order) {
        const { id } = await convertQuoteToOrderAction({ quoteId: q.id });
        const o = await db((tx) => tx.order.findUnique({ where: { id }, select: { number: true } }));
        out.order = o?.number; out.link = `/orders/${id}`;
        log.push({ label: `Created order ${o?.number} from ${q.number}`, href: `/orders/${id}` });
      }
      return json({ ok: true, ...out });
    }),
  });

  const orderStatus = betaZodTool({
    name: "update_order_status",
    description: "Move an order to its next status. Allowed: draft→confirmed/cancelled; confirmed→in_production/ready/cancelled; in_production→ready/cancelled; ready→dispatched/in_production; dispatched→closed.",
    inputSchema: z.object({ number: z.string(), status: z.enum(ORDER_STATUSES), note: z.string().optional() }),
    run: (i) => guard(async () => {
      const o = await db((tx) => tx.order.findFirst({ where: { number: { equals: i.number, mode: "insensitive" } }, select: { id: true, number: true } }));
      if (!o) return json({ error: "Order not found" });
      await updateOrderStatusAction({ id: o.id, status: i.status, note: i.note });
      log.push({ label: `${o.number} → ${i.status.replace("_", " ")}`, href: `/orders/${o.id}` });
      return json({ ok: true, link: `/orders/${o.id}` });
    }),
  });

  const updateJob = betaZodTool({
    name: "update_job",
    description: "Update a production job: change stage, record good/rejected output, or reassign operator.",
    inputSchema: z.object({
      number: z.string(),
      stage: z.enum(JOB_STAGES).optional(),
      add_good: z.number().min(0).optional(),
      add_rejected: z.number().min(0).optional(),
      note: z.string().optional(),
      operator_name: z.string().optional(),
    }),
    run: (i) => guard(async () => {
      const j = await db((tx) => tx.productionJob.findFirst({ where: { number: { equals: i.number, mode: "insensitive" } } }));
      if (!j) return json({ error: "Job not found" });
      const done: string[] = [];
      if (i.add_good || i.add_rejected) { await recordOutputAction({ id: j.id, output: i.add_good ?? 0, reject: i.add_rejected ?? 0, note: i.note }); done.push(`+${i.add_good ?? 0} good, ${i.add_rejected ?? 0} rejected`); }
      if (i.stage) { await updateJobStageAction({ id: j.id, stage: i.stage, note: i.note }); done.push(`stage ${i.stage}`); }
      if (i.operator_name) {
        const u = await findUser(i.operator_name);
        if (!u) return json({ error: `No user called ${i.operator_name}` });
        await updateJobAction({ id: j.id, title: j.title, orderId: j.orderId, assigneeId: u.id, machineId: j.machineId, priority: j.priority, targetQty: n(j.targetQty), unit: j.unit, startDate: j.startDate?.toISOString() ?? null, dueDate: j.dueDate?.toISOString() ?? null, specification: j.specification, materialNotes: j.materialNotes, drawingUrl: j.drawingUrl });
        done.push(`assigned to ${u.fullName}`);
      }
      log.push({ label: `${j.number}: ${done.join(", ")}`, href: `/production/${j.id}` });
      return json({ ok: true, done });
    }),
  });

  return [search, getRecord, summary, report, createCustomer, createEnquiry, moveEnquiry, createQuote, quoteStatus, orderStatus, updateJob];
}
