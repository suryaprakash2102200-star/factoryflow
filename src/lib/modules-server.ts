import { cache } from "react";
import { withTenant } from "./tenant-context";
import { DEFAULT_MODULES, moduleEnabled, type ModuleKey } from "./modules";

/** Modules activated for a workspace (cached per request). */
export const getEnabledModules = cache(async (tenantId: string): Promise<string[]> => {
  // Must run inside the tenant context: row-level security hides the
  // organization row otherwise, and every module would look switched off.
  const org = await withTenant(tenantId, (tx) =>
    tx.organization.findUnique({ where: { id: tenantId }, select: { enabledModules: true } }),
  );
  return org?.enabledModules ?? [...DEFAULT_MODULES];
});

/** Throw when a module is switched off, so APIs/actions enforce it, not only the menu. */
export async function requireModule(tenantId: string, key: ModuleKey) {
  const enabled = await getEnabledModules(tenantId);
  if (!moduleEnabled(enabled, key)) throw new Error(`MODULE_DISABLED: ${key}`);
}
