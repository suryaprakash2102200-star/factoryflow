import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import * as XLSX from "xlsx";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("quote:export")) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await withTenant(auth.tenantId, async (tx) => {
    const quotes = await tx.quote.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        contact: { select: { fullName: true } },
        account: { select: { name: true } },
        owner: { select: { fullName: true } },
      },
    });

    return quotes.map((q) => ({
      number: q.number,
      status: q.status,
      contactName: q.contact?.fullName ?? "",
      accountName: q.account?.name ?? "",
      ownerName: q.owner?.fullName ?? "",
      issueDate: q.issueDate ? new Date(q.issueDate).toISOString().slice(0, 10) : "",
      expiryDate: q.expiryDate ? new Date(q.expiryDate).toISOString().slice(0, 10) : "",
      currency: q.currency,
      total: Number(q.total),
      createdAt: q.createdAt.toISOString(),
    }));
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quotes-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
