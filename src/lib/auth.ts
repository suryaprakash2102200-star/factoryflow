import NextAuth, { type DefaultSession } from "next-auth";
import { withTenant } from "@/lib/tenant-context";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  SYSTEM_ROLES,
  type Permission,
} from "./permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      tenantName?: string;
      role: string;
      roleId?: string | null;
      permissions: Permission[];
    } & DefaultSession["user"];
  }
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function resolvePermissions(
  tenantId: string,
  roleEnum: string,
  roleId: string | null,
): Promise<Permission[]> {
  if (roleId) {
    const perms = await withTenant(tenantId, (tx) =>
      tx.rolePermission.findMany({
        where: { tenantId, roleId },
        select: { resource: true, action: true },
      }),
    );
    if (perms.length > 0)
      return perms.map((p) => `${p.resource}:${p.action}` as Permission);
  }
  return (SYSTEM_ROLES as Record<string, Permission[]>)[roleEnum] ?? [];
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // Use the host the request came in on (Vercel, custom domain) instead of a fixed URL.
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findFirst({
          where: { email: parsed.data.email, isActive: true },
          include: { tenant: true },
        });
        if (!user) return null;
        const ok = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          role: user.role,
          roleId: user.roleId,
        };
      },
    }),
    // Google sign-in is only offered when AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are set.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
  ],
  callbacks: {
    /** Google can only sign in people who already have an active user (same email) in a workspace. */
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email || profile.email_verified === false) return "/login?error=GoogleEmail";
      const u = await prisma.user.findFirst({ where: { email: { equals: profile.email, mode: "insensitive" }, isActive: true }, select: { id: true } });
      return u ? true : "/login?error=NoAccount";
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google") {
        const u = await prisma.user.findFirst({
          where: { email: { equals: user.email ?? "", mode: "insensitive" }, isActive: true },
          include: { tenant: true },
        });
        if (!u) return null;
        Object.assign(user, { id: u.id, tenantId: u.tenantId, tenantName: u.tenant.name, role: u.role, roleId: u.roleId, name: u.fullName, email: u.email });
      }
      if (user) {
        token.id = (user as { id: string }).id;
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.tenantName = (user as { tenantName?: string }).tenantName;
        token.role = (user as { role: string }).role;
        token.roleId = (user as { roleId: string | null }).roleId;
        token.permissions = await resolvePermissions(
          token.tenantId as string,
          token.role as string,
          (token.roleId as string | null) ?? null,
        );
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.tenantId = token.tenantId as string;
      session.user.tenantName = token.tenantName as string | undefined;
      session.user.role = token.role as string;
      session.user.roleId = (token.roleId as string | null) ?? null;
      session.user.permissions =
        (token.permissions as Permission[] | undefined) ?? [];
      return session;
    },
  },
});

export interface AuthContext {
  tenantId: string;
  userId: string;
  role: string;
  permissions: Permission[];
}

export async function getAuth(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user) {
    const tenantId = process.env.DEV_TENANT_ID;
    const userId = process.env.DEV_USER_ID;
    if (tenantId && userId && process.env.NODE_ENV !== "production") {
      return {
        tenantId,
        userId,
        role: "owner",
        permissions: SYSTEM_ROLES.owner,
      };
    }
    return null;
  }
  return {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!ctx) throw new Error("UNAUTHORIZED");
  return ctx;
}

export function hasPerm(
  ctx: AuthContext | null | undefined,
  perm: Permission,
): boolean {
  if (!ctx) return false;
  return ctx.permissions.includes(perm);
}
