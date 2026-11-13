import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";
import Link from "next/link";
import {
  Plus, RefreshCcw, ArrowRight, Phone, Mail, Users, MapPin, FileText,
  UserCheck, MessageCircle, Trophy,
} from "lucide-react";

export const dynamic = "force-dynamic";

const RANGES = [7, 14, 30, 90] as const;
type Range = (typeof RANGES)[number];

const DAY = 86_400_000;

function pctChange(cur: number, prev: number, days: number): string {
  if (prev === 0) return cur > 0 ? `None in the previous ${days}d` : "No earlier data";
  const p = ((cur - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(0)}% vs previous ${days}d`;
}

// ── Building blocks ───────────────────────────────────────────────────────────
function Panel({
  title, action, children, className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col rounded-xl border border-border bg-card ${className}`}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-3 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </>
  );
  const cls = "flex items-center justify-between px-4 py-2.5 text-sm";
  return href ? (
    <Link href={href} className={`${cls} transition hover:bg-accent/50`}>{inner}</Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Empty({ title, body, cta }: { title: string; body?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body && <p className="text-xs text-muted-foreground">{body}</p>}
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}

/** Two-series daily line chart, server-rendered SVG. */
function DailyChart({
  days, a, b,
}: {
  days: Date[];
  a: number[];
  b: number[];
}) {
  const W = 640, H = 200, PL = 28, PB = 22, PT = 10;
  const max = Math.max(1, ...a, ...b);
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const x = (i: number) => PL + (i / Math.max(days.length - 1, 1)) * (W - PL - 8);
  const y = (v: number) => PT + (1 - v / niceMax) * (H - PT - PB);
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, niceMax / 2, niceMax];
  const labelEvery = Math.ceil(days.length / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full" preserveAspectRatio="none" role="img" aria-label="New enquiries and activities per day">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={W - 8} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x={PL - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">{t}</text>
        </g>
      ))}
      {days.map((d, i) =>
        i % labelEvery === 0 || i === days.length - 1 ? (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
            {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        ) : null,
      )}
      <path d={path(b)} fill="none" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={path(a)} fill="none" className="stroke-foreground" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  call: Phone, email: Mail, meeting: Users, visit: MapPin, note: FileText,
  stage_change: RefreshCcw, assignment: UserCheck, other: MessageCircle,
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const range: Range = (RANGES as readonly number[]).includes(Number(sp.range)) ? (Number(sp.range) as Range) : 14;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - (range - 1) * DAY);
  const prevStart = new Date(start.getTime() - range * DAY);
  const now = new Date();
  const modules = await getEnabledModules(ctx.tenantId);
  const ordersOn = moduleEnabled(modules, "orders") && ctx.permissions.includes("order:view");
  const productionOn = moduleEnabled(modules, "production") && ctx.permissions.includes("production:view");

  const data = await withTenant(ctx.tenantId, async (tx) => {
    const ops = {
      ordersByStatus: ordersOn ? await tx.order.groupBy({ by: ["status"], _count: { _all: true } }) : [],
      ordersOverdue: ordersOn ? await tx.order.count({ where: { status: { in: ["confirmed", "in_production", "ready"] }, dueDate: { lt: today } } }) : 0,
      dispatchedInRange: ordersOn ? await tx.order.count({ where: { dispatchedAt: { gte: start } } }) : 0,
      jobsByStage: productionOn ? await tx.productionJob.groupBy({ by: ["stage"], _count: { _all: true } }) : [],
      jobsOverdue: productionOn ? await tx.productionJob.count({ where: { stage: { notIn: ["completed", "cancelled"] }, dueDate: { lt: today } } }) : 0,
      quotesAwaiting: await tx.quote.count({ where: { status: "sent" } }),
    };
    const [stages, leads, tasks, activities, recentActivities, contactCount, newContacts, accountCount, paidInvoices, openQuotes, users] =
      await Promise.all([
        tx.leadStage.findMany({ orderBy: { orderIndex: "asc" } }),
        tx.lead.findMany({
          select: { id: true, stageId: true, estimatedValue: true, createdAt: true, updatedAt: true, ownerId: true },
        }),
        tx.task.findMany({ select: { status: true, ecd: true, completedAt: true, createdAt: true } }),
        tx.activity.findMany({ where: { createdAt: { gte: prevStart } }, select: { createdAt: true } }),
        tx.activity.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { lead: { select: { id: true, title: true } }, createdBy: { select: { fullName: true } } },
        }),
        tx.contact.count(),
        tx.contact.count({ where: { createdAt: { gte: start } } }),
        tx.account.count(),
        tx.invoice.findMany({ where: { status: "paid" }, select: { total: true } }),
        tx.quote.count({ where: { status: { in: ["draft", "sent"] } } }),
        tx.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true } }),
      ]);
    return { stages, leads, tasks, activities, recentActivities, contactCount, newContacts, accountCount, paidInvoices, openQuotes, users, ops };
  });

  const { stages, leads, tasks, activities, recentActivities, contactCount, newContacts, accountCount, paidInvoices, openQuotes, users, ops } = data;
  const orderCount = (...s: string[]) => ops.ordersByStatus.filter((o) => s.includes(o.status)).reduce((a, o) => a + o._count._all, 0);
  const jobCount = (...s: string[]) => ops.jobsByStage.filter((j) => s.includes(j.stage)).reduce((a, j) => a + j._count._all, 0);

  const inRange = (d: Date, from: Date, to?: Date) => d >= from && (!to || d < to);
  const terminal = new Set(stages.filter((s) => s.isTerminal).map((s) => s.id));
  // "Won" = a closed stage with 100% probability; closed-lost stages must not count as wins.
  const wonStages = new Set(stages.filter((s) => s.isTerminal && (s.probability ?? 0) >= 100).map((s) => s.id));

  // KPIs
  const newLeads = leads.filter((l) => inRange(l.createdAt, start)).length;
  const newLeadsPrev = leads.filter((l) => inRange(l.createdAt, prevStart, start)).length;
  const openLeads = leads.filter((l) => !terminal.has(l.stageId));
  const pipelineValue = openLeads.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  const wonInRange = leads.filter((l) => wonStages.has(l.stageId) && inRange(l.updatedAt, start));
  const wonValue = wonInRange.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const overdue = tasks.filter((t) => t.ecd && t.ecd < now && t.status !== "done" && t.status !== "cancelled").length;
  const doneInRange = tasks.filter((t) => t.status === "done" && t.completedAt && inRange(t.completedAt, start)).length;
  const collected = paidInvoices.reduce((s, i) => s + Number(i.total), 0);
  const forecast = stages
    .filter((s) => !s.isTerminal)
    .reduce((sum, s) => sum + leads.filter((l) => l.stageId === s.id).reduce((a, l) => a + (l.estimatedValue ?? 0), 0) * ((s.probability ?? 0) / 100), 0);

  // Chart series
  const days = Array.from({ length: range }, (_, i) => new Date(start.getTime() + i * DAY));
  const bucket = (dates: Date[]) => {
    const out = new Array(range).fill(0);
    for (const d of dates) {
      const i = Math.floor((d.getTime() - start.getTime()) / DAY);
      if (i >= 0 && i < range) out[i]++;
    }
    return out;
  };
  const leadSeries = bucket(leads.map((l) => l.createdAt));
  const activitySeries = bucket(activities.map((a) => a.createdAt));
  const activityTotal = activitySeries.reduce((a, b) => a + b, 0);

  // Pipeline by stage
  const funnel = stages.map((s) => {
    const sl = leads.filter((l) => l.stageId === s.id);
    return { stage: s, count: sl.length, value: sl.reduce((a, l) => a + (l.estimatedValue ?? 0), 0) };
  });
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  // Leaderboard
  const performers = users
    .map((u) => ({
      id: u.id,
      name: u.fullName ?? "—",
      count: leads.filter((l) => l.ownerId === u.id).length,
      won: leads.filter((l) => l.ownerId === u.id && wonStages.has(l.stageId)).length,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.won - a.won || b.count - a.count)
    .slice(0, 5);

  const leadTrend = pctChange(newLeads, newLeadsPrev, range);
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground transition hover:bg-accent";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-6 sm:px-6 md:py-8">
      {/* Setup banner */}
      {stages.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Set up your pipeline to start</p>
            <p className="text-xs text-muted-foreground">Enquiries, forecasts and win rates need at least one pipeline stage.</p>
          </div>
          <Link href="/admin/stages" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
            Add stages
          </Link>
        </div>
      )}

      {/* Title + range */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enquiries, orders, production and billing at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/?range=${r}`}
                aria-current={r === range ? "true" : undefined}
                className={`inline-flex h-full items-center rounded-md px-3 text-sm transition ${
                  r === range ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}d
              </Link>
            ))}
          </div>
          <Link href={`/?range=${range}`} className={`${btn} w-9 justify-center px-0`} aria-label="Refresh" title="Refresh">
            <RefreshCcw size={15} />
          </Link>
          <Link href="/leads/new" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90">
            <Plus size={15} /> New enquiry
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="New enquiries"
          value={newLeads.toLocaleString()}
          sub={leadTrend}
        />
        <Kpi label="Open pipeline" value={formatCurrency(pipelineValue)} sub={`${openLeads.length} open enquiries`} />
        <Kpi
          label="Won this period"
          value={formatCurrency(wonValue)}
          sub={wonInRange.length ? `${wonInRange.length} enquir${wonInRange.length === 1 ? "y" : "ies"} won` : "No enquiries won in this period"}
        />
        <Kpi
          label="Open tasks"
          value={openTasks.toLocaleString()}
          sub={overdue ? `${overdue} overdue, ${doneInRange} done` : `None overdue, ${doneInRange} done`}
        />
      </div>

      {/* Chart + pipeline */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel
          title="Enquiries per day"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-foreground" />New enquiries</span>
              <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-muted-foreground" />Activities</span>
            </div>
          }
        >
          {newLeads === 0 && activityTotal === 0 ? (
            <Empty title="No enquiries or activity in this period" body="New enquiries and logged calls, emails and meetings appear here." />
          ) : (
            <div className="px-3 pt-3">
              <DailyChart days={days} a={leadSeries} b={activitySeries} />
            </div>
          )}
          <p className="mt-auto px-4 pb-3 pt-2 text-xs text-muted-foreground">
            {newLeads} new enquiries, {activityTotal} activities in the last {range} days.
          </p>
        </Panel>

        <Panel
          title="Pipeline by stage"
          action={<Link href="/leads" className="text-xs text-muted-foreground hover:text-foreground">All enquiries</Link>}
        >
          {funnel.length === 0 ? (
            <Empty title="No stages yet" cta={<Link href="/admin/stages" className={btn}>Add stages</Link>} />
          ) : (
            <ul className="space-y-3 px-4 py-4">
              {funnel.map(({ stage, count, value }) => (
                <li key={stage.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color ?? "#71717a" }} />
                      <span className="truncate text-foreground">{stage.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {count} · {formatCurrency(value)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(count / funnelMax) * 100}%`, backgroundColor: stage.color ?? "#71717a" }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto border-t border-border">
            <Row label="Weighted forecast" value={formatCurrency(forecast)} />
          </div>
        </Panel>
      </div>

      {/* Activity + side panels */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel
          title="Recent activity"
          className="lg:col-span-2"
          action={<Link href="/leads" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">All enquiries <ArrowRight size={12} /></Link>}
        >
          {recentActivities.length === 0 ? (
            <Empty title="No activity yet" body="Log calls, emails or meetings on an enquiry to see them here." />
          ) : (
            <ul className="divide-y divide-border">
              {recentActivities.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] ?? MessageCircle;
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.lead ? (
                          <Link href={`/leads/${a.lead.id}`} className="hover:text-foreground hover:underline">{a.lead.title}</Link>
                        ) : (
                          a.type.replace("_", " ")
                        )}
                        {a.createdBy?.fullName ? ` · ${a.createdBy.fullName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeDate(a.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-3">
          {(ordersOn || productionOn) && (
            <Panel title="Operations">
              <div className="divide-y divide-border">
                <Row label="Quotes awaiting reply" value={ops.quotesAwaiting} href="/billing/quotes" />
                {ordersOn && (
                  <>
                    <Row label="Active orders" value={orderCount("confirmed", "in_production", "ready")} href="/orders" />
                    <Row label="Ready for dispatch" value={orderCount("ready")} href="/orders" />
                    <Row label="Orders overdue" value={<span className={ops.ordersOverdue ? "text-rose-500" : ""}>{ops.ordersOverdue}</span>} href="/orders" />
                    <Row label="Dispatched this period" value={ops.dispatchedInRange} />
                  </>
                )}
                {productionOn && (
                  <>
                    <Row label="Jobs running" value={jobCount("in_progress")} href="/production" />
                    <Row label="Jobs overdue" value={<span className={ops.jobsOverdue ? "text-rose-500" : ""}>{ops.jobsOverdue}</span>} href="/production" />
                  </>
                )}
              </div>
            </Panel>
          )}
          <Panel title="Audience">
            <div className="divide-y divide-border">
              <Row label="Contacts" value={contactCount.toLocaleString()} href="/contacts" />
              <Row label="New contacts" value={newContacts.toLocaleString()} />
              <Row label="Customers" value={accountCount.toLocaleString()} href="/accounts" />
              <Row label="Open leads" value={openLeads.length.toLocaleString()} href="/leads" />
            </div>
          </Panel>
          <Panel title="Billing">
            <div className="divide-y divide-border">
              <Row label="Collected" value={formatCurrency(collected)} href="/billing/invoices" />
              <Row label="Open quotes" value={openQuotes.toLocaleString()} href="/billing/quotes" />
              <Row
                label="Win rate"
                value={leads.length ? `${Math.round((leads.filter((l) => wonStages.has(l.stageId)).length / Math.max(1, leads.filter((l) => terminal.has(l.stageId)).length)) * 100)}%` : "–"}
              />
            </div>
          </Panel>
        </div>
      </div>

      {/* Team */}
      <Panel title="Team leaderboard" action={<Trophy size={14} className="text-muted-foreground" />}>
        {performers.length === 0 ? (
          <Empty title="No assigned enquiries yet" body="Assign enquiries to teammates to rank them here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 text-right font-medium">Enquiries</th>
                  <th className="px-4 py-2.5 text-right font-medium">Won</th>
                  <th className="px-4 py-2.5 text-right font-medium">Win rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border border-t border-border">
                {performers.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-foreground">
                          {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-foreground">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{p.count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{p.won}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{Math.round((p.won / p.count) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
