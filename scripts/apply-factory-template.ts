import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { applyFactoryTemplate } from "../src/lib/factory-template";

const p = new PrismaClient();

async function main() {
  for (const org of await p.organization.findMany()) {
    await p.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, org.id);
      const anyStage = await tx.leadStage.findFirst({ where: { tenantId: org.id } });
      await applyFactoryTemplate(tx, org.id, anyStage?.pipelineId ?? crypto.randomUUID());
    });
    console.log("factory template applied:", org.name);
  }
}
main().finally(() => p.$disconnect());
