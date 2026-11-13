import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The connection string comes from DATABASE_URL via prisma/schema.prisma.
// Not passing it here lets `next build` load this module even when the
// variable isn't available at build time; it's only read on the first query.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
