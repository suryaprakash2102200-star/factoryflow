import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import * as XLSX from "xlsx";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.permissions.includes("contact:export")) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await withTenant(auth.tenantId, async (tx) => {
    const contacts = await tx.contact.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        account: { select: { name: true } },
        owner: { select: { fullName: true } },
      },
    });

    return contacts.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      jobTitle: c.jobTitle ?? "",
      accountName: c.account?.name ?? "",
      ownerName: c.owner?.fullName ?? "",
      createdAt: c.createdAt.toISOString(),
    }));
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
