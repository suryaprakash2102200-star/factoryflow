import { PrismaClient } from "@prisma/client";
import { SYSTEM_ROLES } from "../src/lib/permissions";

const p = new PrismaClient();

async function main() {
  const orgs = await p.organization.findMany();
  for (const org of orgs) {
    await p.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.tenant_id', $1, true)`,
          org.id,
        );
        for (const [name, perms] of Object.entries(SYSTEM_ROLES)) {
          const existing = await tx.role.findFirst({
            where: { tenantId: org.id, name },
          });
          const role =
            existing ??
            (await tx.role.create({
              data: {
                tenantId: org.id,
                name,
                isSystem: true,
                description: `Default ${name} role`,
              },
            }));
          await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
          await tx.rolePermission.createMany({
            data: perms.map((perm) => {
              const [resource, action] = perm.split(":");
              return {
                tenantId: org.id,
                roleId: role.id,
                resource,
                action,
              };
            }),
          });
        }
      },
      { timeout: 120000, maxWait: 120000 },
    );
    console.log(`seeded ${org.name}`);
  }

  // link first user of each tenant to owner role
  const users = await p.user.findMany();
  for (const u of users) {
    if (u.roleId) continue;
    const owner = await p.role.findFirst({
      where: { tenantId: u.tenantId, name: "owner" },
    });
    if (owner) {
      await p.user.update({
        where: { id: u.id },
        data: { roleId: owner.id },
      });
      console.log(`  -> linked ${u.email} to owner role`);
    }
  }
}

main()
  .then(() => p.$disconnect())
  .catch((e) => {
    console.error(e);
    p.$disconnect();
    process.exit(1);
  });
