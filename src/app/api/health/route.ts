import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Deployment check. Reports which settings exist (never their values) and
 * whether the database answers. Safe to open in a browser: /api/health
 */
export async function GET() {
  const has = (k: string) => !!process.env[k]?.trim();
  const db = process.env.DATABASE_URL ?? "";
  let host = "";
  let port = "";
  let user = "";
  let quoted = false;
  try {
    quoted = /^["']|["']$/.test(db.trim());
    const u = new URL(db.trim().replace(/^["']|["']$/g, ""));
    host = u.hostname;
    port = u.port;
    user = decodeURIComponent(u.username).split(".")[0]; // role only, not the project ref
  } catch { /* reported below */ }

  const checks: Record<string, unknown> = {
    region: process.env.VERCEL_REGION ?? null,
    env: {
      DATABASE_URL: has("DATABASE_URL"),
      DIRECT_URL: has("DIRECT_URL"),
      AUTH_SECRET: has("AUTH_SECRET"),
      AUTH_URL: process.env.AUTH_URL ?? null, // a URL, not a secret; must not be localhost in production
      AUTH_GOOGLE_ID: has("AUTH_GOOGLE_ID"),
      NVIDIA_API_KEY: has("NVIDIA_API_KEY"),
      ANTHROPIC_API_KEY: has("ANTHROPIC_API_KEY"),
    },
    databaseUrl: { parses: !!host, wrappedInQuotes: quoted, host, port, role: user, pgbouncerFlag: db.includes("pgbouncer=true") },
  };

  const problems: string[] = [];
  if (!has("DATABASE_URL")) problems.push("DATABASE_URL is missing");
  else if (!host) problems.push("DATABASE_URL is not a valid URL");
  if (quoted) problems.push("DATABASE_URL is wrapped in quotes — remove them");
  if (port === "6543" && !db.includes("pgbouncer=true")) problems.push("Port 6543 needs &pgbouncer=true&connection_limit=1");
  if (!has("AUTH_SECRET")) problems.push("AUTH_SECRET is missing");
  if (process.env.AUTH_URL?.includes("localhost")) problems.push("AUTH_URL points to localhost — change it to the live URL or delete it");

  const t = Date.now();
  try {
    await prisma.$queryRawUnsafe("select 1");
    checks.database = { ok: true, ms: Date.now() - t };
  } catch (e) {
    const msg = (e as Error).message;
    checks.database = { ok: false, ms: Date.now() - t, error: msg.split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 200) };
    problems.push("Database connection failed — see database.error");
  }

  return Response.json({ ok: problems.length === 0, problems, ...checks }, { status: problems.length ? 500 : 200 });
}
