import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import * as XLSX from "xlsx";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("account:export")) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await withTenant(auth.tenantId, async (tx) => {
    const accounts = await tx.account.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      industry: a.industry ?? "",
      website: a.website ?? "",
      phone: a.phone ?? "",
      city: "",
      country: "",
      contactCount: a._count.contacts,
      createdAt: a.createdAt.toISOString(),
    }));
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="accounts-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
