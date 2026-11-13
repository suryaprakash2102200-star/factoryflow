import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { SYSTEM_ROLES } from "../src/lib/permissions";
import { applyFactoryTemplate } from "../src/lib/factory-template";

const prisma = new PrismaClient();

async function main() {
  // Organizations table has no RLS — create first.
  const org = await prisma.organization.upsert({
    where: { slug: "acme-realty" },
    update: {},
    create: { name: "Acme Engineering Works", slug: "acme-realty" },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  // For all tenant-scoped inserts, run inside a tx with the GUC set.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.tenant_id', $1, true)`,
      org.id,
    );

    // Seed system roles + permissions (idempotent)
    for (const [name, perms] of Object.entries(SYSTEM_ROLES)) {
      const role = await tx.role.upsert({
        where: { tenantId_name: { tenantId: org.id, name } },
        update: {},
        create: {
          tenantId: org.id,
          name,
          isSystem: true,
          description: `Default ${name} role`,
        },
      });
      await tx.rolePermission.deleteMany({ where: { tenantId: org.id, roleId: role.id } });
      if (perms.length) {
        await tx.rolePermission.createMany({
          data: perms.map((p) => {
            const [resource, action] = p.split(":");
            return { tenantId: org.id, roleId: role.id, resource, action };
          }),
        });
      }
    }

    const ownerRole = await tx.role.findUnique({
      where: { tenantId_name: { tenantId: org.id, name: "owner" } },
    });

    const user = await tx.user.upsert({
      where: { tenantId_email: { tenantId: org.id, email: "admin@acme.test" } },
      update: { roleId: ownerRole?.id },
      create: {
        tenantId: org.id,
        email: "admin@acme.test",
        fullName: "Admin User",
        passwordHash,
        role: "owner",
        roleId: ownerRole?.id,
      },
    });

    // Second test login (agent role) for checking assignments and notifications.
    const agentRole = await tx.role.findUnique({ where: { tenantId_name: { tenantId: org.id, name: "agent" } } });
    await tx.user.upsert({
      where: { tenantId_email: { tenantId: org.id, email: "operator@acme.test" } },
      update: {},
      create: { tenantId: org.id, email: "operator@acme.test", fullName: "Ravi Operator", passwordHash, role: "agent", roleId: agentRole?.id },
    });

    const pipelineId = crypto.randomUUID();
    await applyFactoryTemplate(tx, org.id, pipelineId);

    console.log("Seeded:");
    console.log("  Login:   admin@acme.test / password123 (owner), operator@acme.test / password123 (agent)");
    console.log("  Org:    ", org.id, org.slug);
    console.log("  User:   ", user.id, user.email);
    console.log("  Pipeline:", pipelineId);
    console.log("\nAdd to .env for dev auth:");
    console.log(`  DEV_TENANT_ID=${org.id}`);
    console.log(`  DEV_USER_ID=${user.id}`);
  }, { timeout: 60000, maxWait: 60000 });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
