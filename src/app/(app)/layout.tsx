import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell/AppShell";
import { SYSTEM_ROLES, type Permission } from "@/lib/permissions";
import { DEFAULT_MODULES } from "@/lib/modules";
import { getEnabledModules } from "@/lib/modules-server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    // Middleware normally handles this, but fall back to the dev context
    // when running without a real session for quick local iteration.
    if (process.env.NODE_ENV === "production") redirect("/login");
    return (
      <AppShell
        userName="Dev User"
        userEmail="dev@local"
        tenantName="Dev Workspace"
        permissions={SYSTEM_ROLES.owner}
        modules={[...DEFAULT_MODULES]}
      >
        {children}
      </AppShell>
    );
  }

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? "User"}
      userEmail={session.user.email ?? ""}
      tenantName={session.user.tenantName ?? "Workspace"}
      permissions={(session.user.permissions as Permission[]) ?? []}
      modules={await getEnabledModules(session.user.tenantId)}
    >
      {children}
    </AppShell>
  );
}
