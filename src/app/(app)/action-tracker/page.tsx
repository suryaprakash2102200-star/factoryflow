import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { ActionTrackerClient } from "./ActionTrackerClient";

export const dynamic = "force-dynamic";

export default async function ActionTrackerPage() {
  const auth = await requireAuth();

  const tasks = await withTenant(auth.tenantId, async (tx) =>
    tx.task.findMany({
      orderBy: { createdAt: "desc" },
      include: { assignee: true, lead: true },
    }),
  );

  const now = Date.now();
  const decorated = tasks.map((t) => ({
    id: t.id,
    item: t.item,
    status: t.status,
    effectiveStatus:
      t.status === "open" && t.ecd && t.ecd.getTime() < now
        ? "overdue"
        : t.status,
    priority: t.priority,
    ecd: t.ecd?.toISOString() ?? null,
    assigneeName: t.assignee?.fullName ?? null,
    leadId: t.leadId ?? null,
    leadTitle: t.lead?.title ?? null,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Operations
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Tasks · {tasks.length}
            </h1>
          </div>
        </div>

        <ActionTrackerClient
          tasks={decorated}
          canEdit={auth.permissions.includes("task:edit")}
        />
      </div>
    </div>
  );
}
