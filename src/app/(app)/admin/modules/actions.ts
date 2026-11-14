"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth, hasPerm } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { audit } from "@/lib/audit";
import { MODULES } from "@/lib/modules";

export async function setModulesAction(input: { modules: string[] }) {
  const ctx = await requireAuth();
  if (!hasPerm(ctx, "tenant:edit")) throw new Error("FORBIDDEN: tenant:edit");
  const requested = z.array(z.string()).parse(input.modules);
  // Only modules that exist and are built can be switched on; core modules always stay on.
  const allowed = MODULES.filter((m) => m.core || (m.available && requested.includes(m.key))).map((m) => m.key as string);

  const before = await withTenant(ctx.tenantId, async (tx) => {
    const b = await tx.organization.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { enabledModules: true } });
    await tx.organization.update({ where: { id: ctx.tenantId }, data: { enabledModules: allowed } });
    return b;
  });

  const on = allowed.filter((k) => !before.enabledModules.includes(k));
  const off = before.enabledModules.filter((k) => !allowed.includes(k));
  if (on.length || off.length) {
    await withTenant(ctx.tenantId, (tx) =>
      audit(tx, ctx, {
        action: "modules",
        entityType: "workspace",
        entityId: ctx.tenantId,
        summary: [on.length && `Enabled ${on.join(", ")}`, off.length && `Disabled ${off.join(", ")}`].filter(Boolean).join(" · "),
        meta: { on, off },
      }),
    );
  }
  revalidatePath("/", "layout");
}
