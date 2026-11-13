import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";
import { ORDER_STATUS } from "@/lib/factory";
import * as XLSX from "xlsx";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("order:export") || !moduleEnabled(await getEnabledModules(auth.tenantId), "orders")) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await withTenant(auth.tenantId, async (tx) => {
    const orders = await tx.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        account: { select: { name: true } },
        contact: { select: { fullName: true } },
        owner: { select: { fullName: true } },
        quote: { select: { number: true } },
        _count: { select: { jobs: true } },
      },
    });
    const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
    return orders.map((o) => ({
      number: o.number,
      status: ORDER_STATUS[o.status].label,
      customer: o.account?.name ?? "",
      contact: o.contact?.fullName ?? "",
      owner: o.owner?.fullName ?? "",
      quotation: o.quote?.number ?? "",
      customerPO: o.poReference ?? "",
      orderDate: day(o.orderDate),
      dueDate: day(o.dueDate),
      dispatchedAt: o.dispatchedAt ? o.dispatchedAt.toISOString() : "",
      currency: o.currency,
      total: Number(o.total),
      productionJobs: o._count.jobs,
    }));
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
