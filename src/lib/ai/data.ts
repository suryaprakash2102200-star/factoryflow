import type { Prisma } from "@prisma/client";

const DAY = 86_400_000;
const n = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Things that need attention today. Read-only; caller has set the tenant. */
export async function dailySummary(tx: Prisma.TransactionClient, perms: string[]) {
  const now = new Date();
  const has = (p: string) => perms.includes(p);
  const out: Record<string, unknown> = { today: day(now) };

  if (has("order:view")) {
    const open = await tx.order.findMany({
      where: { status: { in: ["confirmed", "in_production", "ready"] } },
      select: { number: true, status: true, dueDate: true, total: true, account: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    });
    out.ordersOverdue = open.filter((o) => o.dueDate && o.dueDate < now).map((o) => ({ number: o.number, customer: o.account?.name, status: o.status, due: day(o.dueDate), daysLate: Math.floor((now.getTime() - o.dueDate!.getTime()) / DAY) }));
    out.ordersDueNext7Days = open.filter((o) => o.dueDate && o.dueDate >= now && o.dueDate.getTime() < now.getTime() + 7 * DAY).map((o) => ({ number: o.number, customer: o.account?.name, status: o.status, due: day(o.dueDate) }));
    out.readyToDispatch = open.filter((o) => o.status === "ready").map((o) => ({ number: o.number, customer: o.account?.name }));
  }
  if (has("production:view")) {
    const jobs = await tx.productionJob.findMany({
      where: { stage: { notIn: ["completed", "cancelled"] } },
      select: { number: true, title: true, stage: true, dueDate: true, targetQty: true, outputQty: true, unit: true, assignee: { select: { fullName: true } }, machine: { select: { code: true } }, order: { select: { number: true } } },
    });
    out.jobsOverdue = jobs.filter((j) => j.dueDate && j.dueDate < now).map((j) => ({ number: j.number, title: j.title, order: j.order?.number, stage: j.stage, due: day(j.dueDate), progress: `${n(j.outputQty)}/${n(j.targetQty)} ${j.unit}`, operator: j.assignee?.fullName ?? "unassigned" }));
    out.jobsPaused = jobs.filter((j) => j.stage === "paused").map((j) => ({ number: j.number, title: j.title, operator: j.assignee?.fullName }));
    out.jobsUnassigned = jobs.filter((j) => !j.assignee).length;
    out.jobsRunning = jobs.filter((j) => j.stage === "in_progress").length;
  }
  if (has("quote:view")) {
    const sent = await tx.quote.findMany({ where: { status: "sent" }, select: { number: true, issueDate: true, total: true, account: { select: { name: true } }, owner: { select: { fullName: true } } } });
    out.quotesAwaitingReplyOver7Days = sent.filter((q) => now.getTime() - q.issueDate.getTime() > 7 * DAY).map((q) => ({ number: q.number, customer: q.account?.name, sent: day(q.issueDate), total: n(q.total), owner: q.owner?.fullName }));
  }
  if (has("lead:view")) {
    const fresh = await tx.lead.findMany({
      where: { stage: { isTerminal: false }, quotes: { none: {} }, createdAt: { lt: new Date(now.getTime() - 3 * DAY) } },
      select: { id: true, title: true, createdAt: true, owner: { select: { fullName: true } }, stage: { select: { name: true } } },
      take: 15,
    });
    out.enquiriesNotQuotedAfter3Days = fresh.map((l) => ({ id: l.id, title: l.title, stage: l.stage.name, received: day(l.createdAt), owner: l.owner?.fullName }));
  }
  if (has("invoice:view")) {
    const inv = await tx.invoice.findMany({ where: { status: { in: ["sent", "overdue", "partial"] } }, select: { number: true, dueDate: true, total: true, amountPaid: true, account: { select: { name: true } } } });
    const overdue = inv.filter((i) => i.dueDate && i.dueDate < now);
    out.invoicesOverdue = overdue.map((i) => ({ number: i.number, customer: i.account?.name, due: day(i.dueDate), outstanding: n(i.total) - n(i.amountPaid) }));
    out.outstandingTotal = inv.reduce((s, i) => s + n(i.total) - n(i.amountPaid), 0);
  }
  if (has("task:view")) {
    const tasks = await tx.task.findMany({ where: { status: { in: ["open", "in_progress"] }, ecd: { lt: new Date(now.getTime() + DAY) } }, select: { item: true, ecd: true, assignee: { select: { fullName: true } }, lead: { select: { title: true } } }, take: 20 });
    out.tasksDueOrOverdue = tasks.map((t) => ({ task: t.item, due: day(t.ecd), who: t.assignee?.fullName, enquiry: t.lead?.title }));
  }
  return out;
}

/** Period metrics, same definitions as the Reports page. */
export async function businessReport(tx: Prisma.TransactionClient, perms: string[], days: number) {
  const since = new Date(Date.now() - days * DAY);
  const has = (p: string) => perms.includes(p);
  const out: Record<string, unknown> = { periodDays: days, from: day(since), to: day(new Date()) };
  if (has("lead:view") && has("quote:view")) {
    const [enq, quotes] = await Promise.all([
      tx.lead.count({ where: { createdAt: { gte: since } } }),
      tx.quote.findMany({ where: { createdAt: { gte: since } }, select: { status: true, total: true } }),
    ]);
    const won = quotes.filter((q) => q.status === "accepted" || q.status === "invoiced");
    const lost = quotes.filter((q) => q.status === "rejected" || q.status === "expired");
    out.sales = { enquiries: enq, quotations: quotes.length, won: won.length, lost: lost.length, winRatePct: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null, quotedValue: quotes.reduce((s, q) => s + n(q.total), 0), wonValue: won.reduce((s, q) => s + n(q.total), 0) };
  }
  if (has("order:view")) {
    const [orders, dispatched] = await Promise.all([
      tx.order.findMany({ where: { orderDate: { gte: since }, status: { not: "cancelled" } }, select: { total: true, account: { select: { name: true } } } }),
      tx.order.findMany({ where: { dispatchedAt: { gte: since } }, select: { orderDate: true, dueDate: true, dispatchedAt: true } }),
    ]);
    const withDue = dispatched.filter((o) => o.dueDate);
    const onTime = withDue.filter((o) => o.dispatchedAt!.getTime() <= o.dueDate!.getTime() + DAY).length;
    const byCust = new Map<string, number>();
    for (const o of orders) byCust.set(o.account?.name ?? "—", (byCust.get(o.account?.name ?? "—") ?? 0) + n(o.total));
    out.orders = {
      booked: orders.length, bookedValue: orders.reduce((s, o) => s + n(o.total), 0), dispatched: dispatched.length,
      onTimeDispatchPct: withDue.length ? Math.round((onTime / withDue.length) * 100) : null,
      avgOrderToDispatchDays: dispatched.length ? +(dispatched.reduce((s, o) => s + (o.dispatchedAt!.getTime() - o.orderDate.getTime()) / DAY, 0) / dispatched.length).toFixed(1) : null,
      topCustomers: [...byCust].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
    };
  }
  if (has("production:view")) {
    const ups = await tx.jobUpdate.findMany({ where: { createdAt: { gte: since } }, select: { outputDelta: true, rejectDelta: true, createdBy: { select: { fullName: true } } } });
    const good = ups.reduce((s, u) => s + n(u.outputDelta), 0);
    const rej = ups.reduce((s, u) => s + n(u.rejectDelta), 0);
    const byOp = new Map<string, number>();
    for (const u of ups) if (n(u.outputDelta)) byOp.set(u.createdBy?.fullName ?? "—", (byOp.get(u.createdBy?.fullName ?? "—") ?? 0) + n(u.outputDelta));
    out.production = { goodOutput: good, rejected: rej, rejectRatePct: good + rej ? +((rej / (good + rej)) * 100).toFixed(1) : null, outputByPerson: Object.fromEntries(byOp) };
  }
  return out;
}
