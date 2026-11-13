import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Execute work inside a transaction where Postgres session GUC
 * `app.tenant_id` is set — activating RLS policies.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        tenantId,
      );
      return fn(tx);
    },
    { timeout: 30000, maxWait: 30000 },
  );
}
