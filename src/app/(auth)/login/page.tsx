import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, auth } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (session?.user) redirect(sp.next ?? "/");

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/");
    try {
      await signIn("credentials", { email, password, redirectTo: next });
    } catch (err) {
      if (err instanceof AuthError) {
        const code = err.type === "CredentialsSignin" ? "CredentialsSignin" : "AuthError";
        redirect(`/login?error=${code}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
      }
      throw err;
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-center text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Hi there 👋
      </h1>
      <p className="mb-8 text-center text-sm text-slate-500">
        Welcome back to Kairo CRM
      </p>

      {sp.error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {sp.error === "CredentialsSignin"
            ? "Invalid email or password."
            : "Sign-in failed. Try again."}
        </div>
      )}

      <form action={login} className="space-y-3">
        <input type="hidden" name="next" value={sp.next ?? "/"} />
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
          placeholder="Password"
          required
          autoComplete="current-password"
        />

        <div className="flex justify-end">
          <Link
            href="#"
            className="text-xs font-medium text-blue-500 hover:text-blue-600"
          >
            Forgot password ?
          </Link>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          disabled
          title="Coming soon"
        >
          <GoogleIcon />
          Login with Google
        </button>

        <button
          type="submit"
          className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700"
        >
          Login
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-blue-500 hover:text-blue-600"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-13l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5 0 9.6-1.9 13-5l-6-5.2a12 12 0 0 1-17-6.3l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.8l6 5.2c-.4.4 6.6-4.8 6.6-15 0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}
