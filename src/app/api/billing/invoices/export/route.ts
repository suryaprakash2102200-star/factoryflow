import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import * as XLSX from "xlsx";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("invoice:export")) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await withTenant(auth.tenantId, async (tx) => {
    const invoices = await tx.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { fullName: true } },
        account: { select: { name: true } },
        owner: { select: { fullName: true } },
      },
    });

    return invoices.map((inv) => ({
      number: inv.number,
      type: inv.type,
      status: inv.status,
      contactName: inv.contact?.fullName ?? "",
      accountName: inv.account?.name ?? "",
      ownerName: inv.owner?.fullName ?? "",
      issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : "",
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "",
      currency: inv.currency,
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      createdAt: inv.createdAt.toISOString(),
    }));
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
