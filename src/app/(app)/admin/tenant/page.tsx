import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { updateTenantAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function TenantPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.includes("tenant:view")) {
    return <div className="text-sm text-slate-500">No access.</div>;
  }
  const org = await withTenant(ctx.tenantId, (tx) =>
    tx.organization.findUniqueOrThrow({ where: { id: ctx.tenantId } }),
  );
  const canEdit = ctx.permissions.includes("tenant:edit");

  async function save(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "");
    await updateTenantAction({ name });
  }

  return (
    <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Workspace profile
      </h2>
      <form action={save} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Workspace name
          </label>
          <input
            name="name"
            defaultValue={org.name}
            disabled={!canEdit}
            required
            minLength={2}
            maxLength={80}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Slug
          </label>
          <input
            value={org.slug}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Tenant ID
          </label>
          <input
            value={org.id}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500"
          />
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
