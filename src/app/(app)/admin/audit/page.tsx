import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const PAGE = 50;

const LINK: Record<string, (id: string) => string> = {
  order: (id) => `/orders/${id}`,
  production_job: (id) => `/production/${id}`,
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  const ctx = await requireAuth();
  if (!ctx.permissions.includes("audit:view")) {
    return <div className="text-sm text-slate-500">No access.</div>;
  }
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const type = sp.type && /^[a-z_]+$/.test(sp.type) ? sp.type : undefined;

  const { rows, total, types } = await withTenant(ctx.tenantId, async (tx) => {
    const where = type ? { entityType: type } : {};
    const [rows, total, types] = await Promise.all([
      tx.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
        include: { actor: { select: { fullName: true } } },
      }),
      tx.auditLog.count({ where }),
      tx.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true } }),
    ]);
    return { rows, total, types: types.map((t) => t.entityType) };
  });
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number, t = type) => `/admin/audit?page=${p}${t ? `&type=${t}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audit log</h2>
          <p className="mt-1 text-sm text-slate-500">Who changed what, newest first. Entries cannot be edited or deleted.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-sm">
          <Link href={href(1, undefined)} className={`rounded-lg px-3 py-1.5 ${!type ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>All</Link>
          {types.map((t) => (
            <Link key={t} href={href(1, t)} className={`rounded-lg px-3 py-1.5 ${type === t ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {t.replace("_", " ")}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          No audit entries yet. Changes to orders, production jobs and modules are recorded here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Who</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const to = r.entityId && LINK[r.entityType]?.(r.entityId);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{r.createdAt.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.actor?.fullName ?? "System"}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{r.action}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-800">
                        {to ? <Link href={to} className="hover:underline">{r.summary}</Link> : r.summary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page > 1 && <Link href={href(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Previous</Link>}
          {page < pages && <Link href={href(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Next</Link>}
        </div>
      )}
    </div>
  );
}
