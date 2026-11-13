/**
 * Creates the `crm_app` database login the app runs as. Unlike `postgres`, it
 * cannot bypass row-level security, so workspace isolation is enforced.
 *
 * - Connects with the owner URL (DIRECT_URL, or DATABASE_URL on first run).
 * - Generates a random password and writes both URLs into .env:
 *     DIRECT_URL   = owner login (used for db push / RLS / migrations)
 *     DATABASE_URL = crm_app login (used by the running app)
 * - Never prints the password. Safe to re-run: it rotates the password.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const ROLE = "crm_app";
const envPath = ".env";
const env = readFileSync(envPath, "utf8");

const get = (k: string) => env.match(new RegExp(`^${k}="?([^"\\n]+)"?`, "m"))?.[1];
const ownerUrl = get("DIRECT_URL") ?? get("DATABASE_URL");
if (!ownerUrl) throw new Error("No DATABASE_URL in .env");
const owner = new URL(ownerUrl);
if (decodeURIComponent(owner.username).startsWith(ROLE)) throw new Error("DATABASE_URL is already the app role; set DIRECT_URL to the owner login first.");

const password = randomBytes(24).toString("base64url");
const p = new PrismaClient({ datasourceUrl: ownerUrl });

async function main() {
  const exists = await p.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM pg_roles WHERE rolname = '${ROLE}'`);
  const verb = exists[0].n ? "ALTER" : "CREATE";
  // password is base64url (no quotes), safe to inline
  await p.$executeRawUnsafe(`${verb} ROLE ${ROLE} WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);
  for (const sql of [
    `GRANT USAGE ON SCHEMA public TO ${ROLE}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`,
    `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${ROLE}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLE}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ROLE}`,
  ]) await p.$executeRawUnsafe(sql);

  // Supabase pooler logins look like "<role>.<project-ref>"
  const ownerUser = decodeURIComponent(owner.username);
  const ref = ownerUser.includes(".") ? ownerUser.split(".").slice(1).join(".") : "";
  const app = new URL(ownerUrl!);
  app.username = ref ? `${ROLE}.${ref}` : ROLE;
  app.password = password;

  copyFileSync(envPath, ".env.before-app-role.bak");
  let next = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${app.toString()}"`);
  next = /^DIRECT_URL=/m.test(next)
    ? next.replace(/^DIRECT_URL=.*$/m, `DIRECT_URL="${ownerUrl}"`)
    : next.replace(/^DATABASE_URL=.*$/m, (l) => `${l}\n# Owner login: schema changes, RLS setup. The app itself uses DATABASE_URL (${ROLE}, cannot bypass RLS).\nDIRECT_URL="${ownerUrl}"`);
  writeFileSync(envPath, next);
  console.log(`${verb === "CREATE" ? "Created" : "Updated"} role ${ROLE}; .env updated (backup: .env.before-app-role.bak).`);
}

main().finally(() => p.$disconnect());
