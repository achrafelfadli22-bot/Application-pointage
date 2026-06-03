import { PrismaClient, TenantStatus, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const password = process.env.DEMO_PASSWORD ?? 'Password123!';

const demoUsers = [
  'superadmin@pointage360.test',
  'admin@societe-a.test',
  'hr@societe-a.test',
  'project.manager@societe-a.test',
  'manager@societe-a.test',
  'employee@societe-a.test',
  'admin@atlas-construction.test',
  'project.manager@atlas-construction.test',
  'manager@atlas-construction.test',
  'a.elyoussefi@futura-expert.com',
];

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  const alpha = await prisma.tenant.update({
    where: { slug: 'societe-alpha-btp' },
    data: { status: TenantStatus.ACTIVE, deletedAt: null },
  });

  await prisma.user.upsert({
    where: { email: 'project.manager@societe-a.test' },
    update: {
      tenantId: alpha.id,
      passwordHash,
      firstName: 'Rim',
      lastName: 'Bennani',
      role: UserRole.PROJECT_MANAGER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      tenantId: alpha.id,
      email: 'project.manager@societe-a.test',
      passwordHash,
      firstName: 'Rim',
      lastName: 'Bennani',
      role: UserRole.PROJECT_MANAGER,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.updateMany({
    where: { email: { in: demoUsers } },
    data: { passwordHash, status: UserStatus.ACTIVE, deletedAt: null },
  });

  console.log(`Demo ready: ${alpha.name} is ${alpha.status}`);
  console.log(`Users active: ${demoUsers.join(', ')}`);
  console.log(`Demo password: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
