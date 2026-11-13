import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// RLS setup needs the owner login, not the app role.
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });

async function main() {
  const sql = readFileSync(join(__dirname, "rls.sql"), "utf8");
  const statements = sql
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const stmt of statements) {
    const clean = stmt.replace(/^--.*$/gm, "").trim();
    if (!clean) continue;
    try {
      await prisma.$executeRawUnsafe(clean);
      console.log("✔", clean.split("\n")[0].slice(0, 80));
    } catch (e) {
      console.error("✗", clean.split("\n")[0].slice(0, 80), "→", (e as Error).message);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
