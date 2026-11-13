import { requireAuth } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules-server";
import { MODULES, moduleEnabled } from "@/lib/modules";
import { ModulesClient } from "./ModulesClient";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.includes("tenant:view")) {
    return <div className="text-sm text-slate-500">No access.</div>;
  }
  const enabled = await getEnabledModules(ctx.tenantId);
  return (
    <ModulesClient
      modules={MODULES.map((m) => ({
        key: m.key,
        label: m.label,
        description: m.description,
        core: m.core,
        available: m.available,
        on: moduleEnabled(enabled, m.key),
      }))}
      canEdit={ctx.permissions.includes("tenant:edit")}
    />
  );
}
