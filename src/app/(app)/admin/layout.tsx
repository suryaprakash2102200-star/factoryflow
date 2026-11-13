import Link from "next/link";
import { requireAuth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAuth();
  const canUsers = ctx.permissions.includes("user:view");
  const canRoles = ctx.permissions.includes("role:view");
  const canTenant = ctx.permissions.includes("tenant:view");
  const canAudit = ctx.permissions.includes("audit:view");

  const tabs = [
    canUsers && { href: "/admin/users", label: "Users" },
    canRoles && { href: "/admin/roles", label: "Roles" },
    canTenant && { href: "/admin/tenant", label: "Workspace" },
    ctx.permissions.includes("master:view") && { href: "/admin/masters", label: "Masters" },
    canTenant && { href: "/admin/modules", label: "Modules" },
    canAudit && { href: "/admin/audit", label: "Audit log" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="px-4 py-6 sm:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Administration
        </div>
        <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Workspace settings
        </h1>
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="relative whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              {t.label}
            </Link>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
