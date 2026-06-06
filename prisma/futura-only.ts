import { PrismaClient, TenantStatus, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const password = process.env.DEMO_PASSWORD ?? 'Password123!';
const FUTURA_SLUG = 'futura-expertise';
const FUTURA_EMAIL = 'contact@futura-expert.com';
const RESOURCE_MANAGER_EMAIL = 'a.elyoussefi@futura-expert.com';

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  const enterprise = await prisma.subscriptionPlan.upsert({
    where: { name: 'Enterprise' },
    update: {
      maxUsers: 5000,
      maxSites: 1000,
      priceMonthly: 499,
      features: ['Multi-sites avance', 'SLA', 'API', 'Exports paie'],
    },
    create: {
      name: 'Enterprise',
      maxUsers: 5000,
      maxSites: 1000,
      priceMonthly: 499,
      features: ['Multi-sites avance', 'SLA', 'API', 'Exports paie'],
    },
  });

  const futura = await prisma.tenant.upsert({
    where: { slug: FUTURA_SLUG },
    update: {
      name: 'Futura Expertise',
      email: FUTURA_EMAIL,
      city: 'Casablanca',
      country: 'Maroc',
      status: TenantStatus.ACTIVE,
      subscriptionPlanId: enterprise.id,
      deletedAt: null,
    },
    create: {
      name: 'Futura Expertise',
      slug: FUTURA_SLUG,
      email: FUTURA_EMAIL,
      city: 'Casablanca',
      country: 'Maroc',
      status: TenantStatus.ACTIVE,
      subscriptionPlanId: enterprise.id,
    },
  });

  const tenantsToDelete = await prisma.tenant.findMany({
    where: { slug: { not: FUTURA_SLUG } },
    select: { id: true, name: true, slug: true },
  });

  const deleteResult = await prisma.tenant.deleteMany({
    where: { slug: { not: FUTURA_SLUG } },
  });

  const resourceManager = await prisma.user.upsert({
    where: { email: RESOURCE_MANAGER_EMAIL },
    update: {
      tenantId: futura.id,
      passwordHash,
      firstName: 'Abdelouahed',
      lastName: 'El Youssefi',
      role: UserRole.RESOURCE_MANAGER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      tenantId: futura.id,
      email: RESOURCE_MANAGER_EMAIL,
      passwordHash,
      firstName: 'Abdelouahed',
      lastName: 'El Youssefi',
      role: UserRole.RESOURCE_MANAGER,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: resourceManager.id },
    update: {
      tenantId: futura.id,
      employeeNumber: 'FE-RM-001',
      jobTitle: 'Ressource Manager',
      contractType: 'CDI',
      hireDate: new Date('2026-01-01'),
      status: 'ACTIVE',
    },
    create: {
      tenantId: futura.id,
      userId: resourceManager.id,
      employeeNumber: 'FE-RM-001',
      jobTitle: 'Ressource Manager',
      contractType: 'CDI',
      hireDate: new Date('2026-01-01'),
      annualLeaveBalance: 18,
      status: 'ACTIVE',
    },
  });

  await prisma.tenantSettings.upsert({
    where: { tenantId: futura.id },
    update: {},
    create: { tenantId: futura.id },
  });

  const tenantsLeft = await prisma.tenant.findMany({
    select: { name: true, slug: true, status: true, _count: { select: { users: true, sites: true, projects: true } } },
    orderBy: { name: 'asc' },
  });

  console.log(
    JSON.stringify(
      {
        keptTenant: futura.slug,
        deletedTenants: tenantsToDelete,
        deletedTenantCount: deleteResult.count,
        resourceManager: resourceManager.email,
        tenantsLeft,
      },
      null,
      2,
    ),
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
