import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { FieldsClient } from "./FieldsClient";

export const dynamic = "force-dynamic";

export default async function FieldsPage() {
  const ctx = await requireAuth();

  const fields = await withTenant(ctx.tenantId, async (tx) =>
    tx.fieldDefinition.findMany({
      orderBy: [{ entity: "asc" }, { orderIndex: "asc" }, { createdAt: "asc" }],
    })
  );

  return (
    <div className="px-4 py-8 sm:px-6 md:py-10 max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Admin · Schema</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Schema Builder</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define custom fields for Leads, Contacts, Accounts and Tasks. Fields are stored as structured JSONB on each record.
        </p>
      </div>
      <FieldsClient initialFields={fields.map(f => ({
        ...f,
        options: f.options as { value: string; label: string }[] | null,
        validation: f.validation as { min?: number; max?: number; maxLength?: number; regex?: string } | null,
        defaultValue: f.defaultValue as unknown,
        createdAt: f.createdAt.toISOString(),
      }))} />
    </div>
  );
}
