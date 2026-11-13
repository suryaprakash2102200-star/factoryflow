import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";

export const dynamic = "force-dynamic";

const RANGES = [30, 90, 180, 365] as const;
const DAY = 86_400_000;

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "–";
}
function money(cur: string, n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Bars({ rows, fmt }: { rows: { label: string; value: number; extra?: string }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No data in this period.</p>;
  return (
    <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-slate-700">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-slate-100">
            <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-slate-900">
            {fmt(r.value)}
            {r.extra && <span className="ml-1 text-xs text-slate-500">{r.extra}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireAuth();
  const modules = await getEnabledModules(ctx.tenantId);
  if (!moduleEnabled(modules, "reports")) notFound();
  const can = (p: string) => ctx.permissions.includes(p as never);
  const showSales = can("lead:view") && can("quote:view");
  const showOrders = can("order:view") && moduleEnabled(modules, "orders");
  const showProd = can("production:view") && moduleEnabled(modules, "production");

  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.range) ?? 90;
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY);

  const d = await withTenant(ctx.tenantId, async (tx) => {
    const inRange = { gte: since };
    const [enquiries, quotes, orders, dispatched, openOrders, updates, jobsDone, lateJobs] = await Promise.all([
      showSales ? tx.lead.count({ where: { createdAt: inRange } }) : 0,
      showSales ? tx.quote.findMany({ where: { createdAt: inRange }, select: { status: true, total: true, currency: true, leadId: true } }) : [],
      showOrders ? tx.order.findMany({ where: { orderDate: inRange, status: { not: "cancelled" } }, select: { total: true, currency: true, quoteId: true, account: { select: { name: true } } } }) : [],
      showOrders ? tx.order.findMany({ where: { dispatchedAt: inRange }, select: { orderDate: true, dueDate: true, dispatchedAt: true } }) : [],
      showOrders ? tx.order.findMany({ where: { status: { in: ["confirmed", "in_production", "ready"] } }, select: { total: true, dueDate: true } }) : [],
      showProd ? tx.jobUpdate.findMany({ where: { createdAt: inRange, OR: [{ outputDelta: { gt: 0 } }, { rejectDelta: { gt: 0 } }] }, select: { outputDelta: true, rejectDelta: true, createdBy: { select: { fullName: true } } } }) : [],
      showProd ? tx.productionJob.findMany({ where: { completedAt: inRange }, select: { dueDate: true, completedAt: true } }) : [],
      showProd ? tx.productionJob.count({ where: { stage: { notIn: ["completed", "cancelled"] }, dueDate: { lt: now } } }) : 0,
    ]);
    return { enquiries, quotes, orders, dispatched, openOrders, updates, jobsDone, lateJobs };
  });

  const cur = d.orders[0]?.currency ?? d.quotes[0]?.currency ?? "INR";

  // Sales funnel
  const quotesSent = d.quotes.filter((q) => q.status !== "draft").length;
  const won = d.quotes.filter((q) => q.status === "accepted" || q.status === "invoiced");
  const lost = d.quotes.filter((q) => q.status === "rejected" || q.status === "expired").length;
  const quotedValue = d.quotes.reduce((s, q) => s + Number(q.total), 0);
  const wonValue = won.reduce((s, q) => s + Number(q.total), 0);

  // Orders
  const orderValue = d.orders.reduce((s, o) => s + Number(o.total), 0);
  const withDue = d.dispatched.filter((o) => o.dueDate && o.dispatchedAt);
  const onTime = withDue.filter((o) => o.dispatchedAt!.getTime() <= o.dueDate!.getTime() + DAY).length;
  const leadDays = d.dispatched.filter((o) => o.dispatchedAt).map((o) => (o.dispatchedAt!.getTime() - o.orderDate.getTime()) / DAY);
  const avgLead = leadDays.length ? (leadDays.reduce((a, b) => a + b, 0) / leadDays.length).toFixed(1) : "–";
  const openValue = d.openOrders.reduce((s, o) => s + Number(o.total), 0);
  const overdueOrders = d.openOrders.filter((o) => o.dueDate && o.dueDate < now).length;
  const byCustomer = new Map<string, number>();
  for (const o of d.orders) byCustomer.set(o.account?.name ?? "No customer", (byCustomer.get(o.account?.name ?? "No customer") ?? 0) + Number(o.total));
  const topCustomers = [...byCustomer].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));

  // Production
  const good = d.updates.reduce((s, u) => s + Number(u.outputDelta), 0);
  const rejects = d.updates.reduce((s, u) => s + Number(u.rejectDelta), 0);
  const byOperator = new Map<string, { good: number; rej: number }>();
  for (const u of d.updates) {
    const k = u.createdBy?.fullName ?? "Unknown";
    const v = byOperator.get(k) ?? { good: 0, rej: 0 };
    v.good += Number(u.outputDelta);
    v.rej += Number(u.rejectDelta);
    byOperator.set(k, v);
  }
  const operators = [...byOperator].sort((a, b) => b[1].good - a[1].good).map(([label, v]) => ({ label, value: v.good, extra: v.rej ? `· ${v.rej} rej.` : undefined }));
  const jobsOnTime = d.jobsDone.filter((j) => j.dueDate && j.completedAt && j.completedAt.getTime() <= j.dueDate.getTime() + DAY).length;
  const jobsWithDue = d.jobsDone.filter((j) => j.dueDate).length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reports</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Reports &amp; analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Read straight from enquiries, quotations, orders and production — nothing to re-enter.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r} href={`/reports?range=${r}`} className={`rounded-md px-3 py-1 ${r === days ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {r === 365 ? "1y" : `${r}d`}
            </Link>
          ))}
        </div>
      </div>

      {showSales && (
        <Section title="Sales: enquiry to order" hint={`Records created in the last ${days} days.`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Enquiries" value={d.enquiries} />
            <Stat label="Quotations sent" value={quotesSent} sub={`${pct(d.quotes.filter((q) => q.leadId).length, d.enquiries)} of enquiries quoted`} />
            <Stat label="Quotes won" value={won.length} sub={`Win rate ${pct(won.length, won.length + lost)}`} />
            <Stat label="Quoted value" value={money(cur, quotedValue)} />
            <Stat label="Won value" value={money(cur, wonValue)} sub={pct(wonValue, quotedValue) + " of quoted"} />
          </div>
        </Section>
      )}

      {showOrders && (
        <Section title="Orders & delivery">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Orders booked" value={d.orders.length} sub={money(cur, orderValue)} />
            <Stat label="Dispatched" value={d.dispatched.length} />
            <Stat label="On-time dispatch" value={pct(onTime, withDue.length)} sub={withDue.length ? `${onTime} of ${withDue.length} with a due date` : "No due dates set"} />
            <Stat label="Avg. order → dispatch" value={avgLead === "–" ? "–" : `${avgLead} days`} />
            <Stat label="Open order book" value={money(cur, openValue)} sub={`${d.openOrders.length} open · ${overdueOrders} overdue`} />
          </div>
          <h3 className="pt-2 text-sm font-medium text-slate-700">Top customers by order value</h3>
          <Bars rows={topCustomers} fmt={(n) => money(cur, n)} />
        </Section>
      )}

      {showProd && (
        <Section title="Production">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Good output" value={good.toLocaleString()} sub="units recorded" />
            <Stat label="Rejected" value={rejects.toLocaleString()} sub={`Reject rate ${pct(rejects, good + rejects)}`} />
            <Stat label="Jobs completed" value={d.jobsDone.length} />
            <Stat label="Jobs on time" value={pct(jobsOnTime, jobsWithDue)} sub={jobsWithDue ? `${jobsOnTime} of ${jobsWithDue} with a due date` : "No due dates set"} />
            <Stat label="Jobs overdue now" value={d.lateJobs} />
          </div>
          <h3 className="pt-2 text-sm font-medium text-slate-700">Output by person who recorded it</h3>
          <Bars rows={operators} fmt={(n) => n.toLocaleString()} />
        </Section>
      )}

      {!showSales && !showOrders && !showProd && (
        <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
          Your role doesn&apos;t include any of the modules these reports read from.
        </p>
      )}
    </div>
  );
}
