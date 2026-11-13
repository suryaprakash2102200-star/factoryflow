import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { MastersClient } from "./MastersClient";

export const dynamic = "force-dynamic";

export default async function MastersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireAuth();
  if (!ctx.permissions.includes("master:view")) return <div className="text-sm text-slate-500">No access.</div>;
  const { tab } = await searchParams;

  const { products, machines, values } = await withTenant(ctx.tenantId, async (tx) => ({
    products: await tx.product.findMany({ orderBy: [{ isActive: "desc" }, { code: "asc" }] }),
    machines: await tx.machine.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { jobs: { where: { stage: { in: ["planned", "in_progress", "paused", "quality_check"] } } } } } } }),
    values: await tx.masterValue.findMany({ orderBy: [{ kind: "asc" }, { orderIndex: "asc" }] }),
  }));

  return (
    <MastersClient
      initialTab={tab === "machines" || tab === "lists" ? tab : "products"}
      canEdit={ctx.permissions.includes("master:edit")}
      products={products.map((p) => ({
        id: p.id, code: p.code, name: p.name, description: p.description, category: p.category, unit: p.unit,
        hsnCode: p.hsnCode, gstRate: Number(p.gstRate), price: Number(p.price), material: p.material, isActive: p.isActive,
      }))}
      machines={machines.map((m) => ({ id: m.id, code: m.code, name: m.name, type: m.type, location: m.location, isActive: m.isActive, openJobs: m._count.jobs }))}
      values={values.map((v) => ({ id: v.id, kind: v.kind, value: v.value, label: v.label, isDefault: v.isDefault }))}
    />
  );
}
