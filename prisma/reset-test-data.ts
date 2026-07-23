import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_RESET_ALL_DATA !== 'YES') {
    throw new Error('Suppression annulée. Définissez CONFIRM_RESET_ALL_DATA=YES pour confirmer.');
  }

  const tenantSlug = process.env.RESET_TENANT_SLUG ?? 'futura-expertise';
  const hrEmail = (process.env.RESET_HR_EMAIL ?? 'a.elyoussefi@futura-expert.com').toLowerCase();
  const hrPassword = process.env.RESET_HR_PASSWORD ?? '12345678';
  const hrFirstName = process.env.RESET_HR_FIRST_NAME ?? 'El Youssefi';
  const hrLastName = process.env.RESET_HR_LAST_NAME ?? 'Abdelouahid';
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Entreprise introuvable : ${tenantSlug}`);

  const passwordHash = await bcrypt.hash(hrPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.approvalAction.deleteMany();
    await tx.notification.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.attendancePunch.deleteMany();
    await tx.timesheet.deleteMany();
    await tx.planning.deleteMany();
    await tx.leaveRequest.deleteMany();
    await tx.leaveBalance.deleteMany();
    await tx.siteAssignment.deleteMany();
    await tx.employeeProfile.deleteMany();
    await tx.site.deleteMany();
    await tx.project.deleteMany();
    await tx.holiday.deleteMany();
    await tx.user.deleteMany();

    await tx.tenantSettings.updateMany({
      data: {
        timesheetTaskTypes: [],
        siteRoleOptions: [],
        clientOptions: [],
        jobTitleOptions: [],
      },
    });

    await tx.tenantSettings.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        timesheetTaskTypes: [],
        siteRoleOptions: [],
        clientOptions: [],
        jobTitleOptions: [],
      },
      update: {
        timesheetTaskTypes: [],
        siteRoleOptions: [],
        clientOptions: [],
        jobTitleOptions: [],
      },
    });

    const hr = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: hrEmail,
        passwordHash,
        firstName: hrFirstName,
        lastName: hrLastName,
        role: UserRole.HR,
        status: UserStatus.ACTIVE,
      },
    });

    await tx.employeeProfile.create({
      data: {
        tenantId: tenant.id,
        userId: hr.id,
        employeeNumber: 'M101',
        jobTitle: 'Responsable des ressources humaines',
        contractType: 'CDI',
        hireDate: new Date(),
        annualLeaveBalance: 0,
        status: 'ACTIVE',
      },
    });
  }, { timeout: 120_000 });

  const leaveTypeCount = await prisma.leaveType.count();
  console.log(JSON.stringify({ reset: true, hrEmail, preservedLeaveTypes: leaveTypeCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
