import { PrismaClient, TenantStatus, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const password = process.env.DEMO_PASSWORD ?? 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  const enterprise = await prisma.subscriptionPlan.upsert({
    where: { name: 'Enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      maxUsers: 5000,
      maxSites: 1000,
      priceMonthly: 499,
      features: ['Multi-sites avance', 'SLA', 'API', 'Exports paie'],
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'futura-expertise' },
    update: {
      name: 'Futura Expertise',
      email: 'contact@futura-expert.com',
      city: 'Casablanca',
      country: 'Maroc',
      status: TenantStatus.ACTIVE,
      subscriptionPlanId: enterprise.id,
      deletedAt: null,
    },
    create: {
      name: 'Futura Expertise',
      slug: 'futura-expertise',
      email: 'contact@futura-expert.com',
      city: 'Casablanca',
      country: 'Maroc',
      status: TenantStatus.ACTIVE,
      subscriptionPlanId: enterprise.id,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'a.elyoussefi@futura-expert.com' },
    update: {
      tenantId: tenant.id,
      passwordHash,
      firstName: 'Abdelouahed',
      lastName: 'El Youssefi',
      role: UserRole.RESOURCE_MANAGER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      email: 'a.elyoussefi@futura-expert.com',
      passwordHash,
      firstName: 'Abdelouahed',
      lastName: 'El Youssefi',
      role: UserRole.RESOURCE_MANAGER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(
    JSON.stringify({
      tenant: tenant.name,
      slug: tenant.slug,
      user: user.email,
      role: user.role,
      password,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
