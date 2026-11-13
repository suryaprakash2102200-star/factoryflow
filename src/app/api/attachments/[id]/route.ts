import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { audit } from "@/lib/audit";
import { attachPerm, isAttachable } from "@/lib/attachments";

const INLINE = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;
  const a = await withTenant(ctx.tenantId, (tx) => tx.attachment.findUnique({ where: { id } })).catch(() => null);
  if (!a || !isAttachable(a.entityType)) return new Response("Not found", { status: 404 });
  if (!ctx.permissions.includes(attachPerm(a.entityType, "view"))) return new Response("Forbidden", { status: 403 });
  const inline = INLINE.test(a.mimeType) && new URL(req.url).searchParams.get("download") === null;
  return new Response(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Length": String(a.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${a.fileName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=0",
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;
  const ok = await withTenant(ctx.tenantId, async (tx) => {
    const a = await tx.attachment.findUnique({ where: { id }, select: { entityType: true, entityId: true, fileName: true } });
    if (!a || !isAttachable(a.entityType) || !ctx.permissions.includes(attachPerm(a.entityType, "edit"))) return false;
    await tx.attachment.delete({ where: { id } });
    await audit(tx, ctx, { action: "detach", entityType: a.entityType, entityId: a.entityId, summary: `Removed file ${a.fileName}` });
    return true;
  }).catch(() => false);
  return ok ? Response.json({ ok: true }) : new Response("Forbidden", { status: 403 });
}
