import { cache } from "react";
import { prisma } from "./prisma";
import { DEFAULT_MODULES, moduleEnabled, type ModuleKey } from "./modules";

/** Modules activated for a workspace (cached per request). */
export const getEnabledModules = cache(async (tenantId: string): Promise<string[]> => {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { enabledModules: true },
  });
  return org?.enabledModules ?? [...DEFAULT_MODULES];
});

/** Throw when a module is switched off, so APIs/actions enforce it, not only the menu. */
export async function requireModule(tenantId: string, key: ModuleKey) {
  const enabled = await getEnabledModules(tenantId);
  if (!moduleEnabled(enabled, key)) throw new Error(`MODULE_DISABLED: ${key}`);
}
