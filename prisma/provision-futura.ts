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

  const hrPasswordHash = await bcrypt.hash('123456789', 12);
  const hr = await prisma.user.upsert({
    where: { email: 'rh@futura-expert.com' },
    update: {
      tenantId: tenant.id,
      passwordHash: hrPasswordHash,
      firstName: 'Responsable',
      lastName: 'RH',
      role: UserRole.HR,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      tenantId: tenant.id,
      email: 'rh@futura-expert.com',
      passwordHash: hrPasswordHash,
      firstName: 'Responsable',
      lastName: 'RH',
      role: UserRole.HR,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: hr.id },
    update: {
      tenantId: tenant.id,
      employeeNumber: 'FE-RH-001',
      jobTitle: 'Responsable RH',
      contractType: 'CDI',
      hireDate: new Date('2026-01-01'),
      status: 'ACTIVE',
    },
    create: {
      tenantId: tenant.id,
      userId: hr.id,
      employeeNumber: 'FE-RH-001',
      jobTitle: 'Responsable RH',
      contractType: 'CDI',
      hireDate: new Date('2026-01-01'),
      annualLeaveBalance: 18,
      status: 'ACTIVE',
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
