import Link from "next/link";
import { randomUUID } from "node:crypto";
import { applyFactoryTemplate } from "@/lib/factory-template";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-context";
import { signIn, auth } from "@/lib/auth";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { PasswordInput } from "@/components/PasswordInput";

const SignupSchema = z.object({
  orgName: z.string().min(2).max(80),
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(120),
});

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (session?.user) redirect("/");

  async function signup(formData: FormData) {
    "use server";
    const parsed = SignupSchema.safeParse({
      orgName: formData.get("orgName"),
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      redirect(`/signup?error=${encodeURIComponent("invalid")}`);
    }
    const { orgName, fullName, email, password } = parsed.data;

    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      redirect(`/signup?error=${encodeURIComponent("email_taken")}`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const baseSlug = slugify(orgName);
    let slug = baseSlug;
    for (let i = 1; await prisma.organization.findUnique({ where: { slug } }); i++) {
      slug = `${baseSlug}-${i}`;
    }

    const org = await prisma.organization.create({
      data: { name: orgName, slug },
    });

    const rolesData = Object.entries(SYSTEM_ROLES).map(([name]) => ({
      tenantId: org.id,
      name,
      isSystem: true,
      description: `Default ${name} role`,
    }));

    await withTenant(org.id, async (tx) => {
      await tx.role.createMany({ data: rolesData });
      const roles = await tx.role.findMany({ where: { tenantId: org.id } });
      const permRows = roles.flatMap((r) =>
        (SYSTEM_ROLES[r.name as keyof typeof SYSTEM_ROLES] ?? []).map((p) => {
          const [resource, action] = p.split(":");
          return { tenantId: org.id, roleId: r.id, resource, action };
        }),
      );
      if (permRows.length)
        await tx.rolePermission.createMany({ data: permRows });
      await applyFactoryTemplate(tx, org.id, randomUUID());
      const ownerRole = roles.find((r) => r.name === "owner");
      await tx.user.create({
        data: {
          tenantId: org.id,
          email,
          passwordHash,
          fullName,
          role: "owner",
          roleId: ownerRole?.id,
        },
      });
    });

    await signIn("credentials", { email, password, redirectTo: "/" });
  }

  const errorMsg =
    sp.error === "email_taken"
      ? "That email is already in use."
      : sp.error === "invalid"
        ? "Check your inputs — password must be at least 8 characters."
        : null;

  return (
    <div>
      <h1 className="mb-2 text-center text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Hello there ✨
      </h1>
      <p className="mb-8 text-center text-sm text-slate-500">
        Create your FactoryFlow workspace
      </p>

      {errorMsg && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      <form action={signup} className="space-y-3">
        <input
          type="text"
          name="orgName"
          placeholder="Workspace name"
          required
          minLength={2}
          maxLength={80}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <input
          type="text"
          name="fullName"
          placeholder="Your full name"
          required
          minLength={2}
          maxLength={80}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <PasswordInput
          name="password"
          placeholder="Password (min. 8 characters)"
          required
          minLength={8}
          maxLength={120}
          autoComplete="new-password"
        />

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700"
        >
          Create workspace
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-blue-500 hover:text-blue-600"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
