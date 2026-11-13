import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { audit } from "@/lib/audit";
import { attachPerm, isAttachable, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

const UUID = /^[0-9a-f-]{36}$/i;

/** GET ?entityType=order&entityId=… → list (no file bodies). */
export async function GET(req: Request) {
  const ctx = await requireAuth();
  const url = new URL(req.url);
  const type = url.searchParams.get("entityType") ?? "";
  const id = url.searchParams.get("entityId") ?? "";
  if (!isAttachable(type) || !UUID.test(id)) return Response.json({ error: "Bad request" }, { status: 400 });
  if (!ctx.permissions.includes(attachPerm(type, "view"))) return Response.json({ error: "Forbidden" }, { status: 403 });
  const rows = await withTenant(ctx.tenantId, (tx) =>
    tx.attachment.findMany({
      where: { entityType: type, entityId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true, uploadedBy: { select: { fullName: true } } },
    }),
  );
  return Response.json(rows.map((r) => ({ ...r, uploadedBy: r.uploadedBy?.fullName ?? null })));
}

/** POST multipart: file, entityType, entityId. */
export async function POST(req: Request) {
  const ctx = await requireAuth();
  const form = await req.formData();
  const type = String(form.get("entityType") ?? "");
  const id = String(form.get("entityId") ?? "");
  const file = form.get("file");
  if (!isAttachable(type) || !UUID.test(id) || !(file instanceof File)) return Response.json({ error: "Bad request" }, { status: 400 });
  if (!ctx.permissions.includes(attachPerm(type, "edit"))) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (file.size === 0) return Response.json({ error: "The file is empty." }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) return Response.json({ error: "Files can be up to 5 MB." }, { status: 413 });
  const data = Buffer.from(await file.arrayBuffer());
  const name = file.name.replace(/[\/\r\n"]/g, "_").slice(0, 200) || "file";
  const row = await withTenant(ctx.tenantId, async (tx) => {
    const a = await tx.attachment.create({
      data: { tenantId: ctx.tenantId, entityType: type, entityId: id, fileName: name, mimeType: file.type || "application/octet-stream", size: file.size, data, uploadedById: ctx.userId },
      select: { id: true },
    });
    await audit(tx, ctx, { action: "attach", entityType: type, entityId: id, summary: `Attached ${name}` });
    return a;
  });
  return Response.json({ id: row.id });
}
