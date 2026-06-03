import {
  AttendanceStatus,
  BillingType,
  LeaveRequestStatus,
  ProjectStatus,
  PrismaClient,
  SiteStatus,
  TenantStatus,
  TimesheetStatus,
  UserRole,
  UserStatus,
  WorkLocation,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const password = process.env.DEMO_PASSWORD ?? 'Password123!';

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function time(value: string) {
  return new Date(`${value}.000Z`);
}

function addDays(input: Date, days: number) {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}

async function resetDatabase() {
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.approvalAction.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.timesheetDayEntry.deleteMany();
  await prisma.timesheetLine.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.attendancePunch.deleteMany();
  await prisma.siteAssignment.deleteMany();
  await prisma.employeeProfile.deleteMany();
  await prisma.site.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
}

async function main() {
  await resetDatabase();

  const passwordHash = await bcrypt.hash(password, 12);

  const trial = await prisma.subscriptionPlan.create({
    data: {
      name: 'Trial',
      maxUsers: 25,
      maxSites: 5,
      priceMonthly: 0,
      features: ['Pointage', 'Timesheets', 'Conges', 'Rapports de base'],
    },
  });

  const pro = await prisma.subscriptionPlan.create({
    data: {
      name: 'Pro',
      maxUsers: 250,
      maxSites: 50,
      priceMonthly: 149,
      features: ['RBAC', 'Exports CSV', 'Anomalies GPS', 'Approvals'],
    },
  });

  const enterprise = await prisma.subscriptionPlan.create({
    data: {
      name: 'Enterprise',
      maxUsers: 5000,
      maxSites: 1000,
      priceMonthly: 499,
      features: ['Multi-sites avance', 'SLA', 'API', 'Exports paie'],
    },
  });

  const [alpha, atlas, futura] = await Promise.all([
    prisma.tenant.create({
      data: {
        name: 'Societe Alpha BTP',
        slug: 'societe-alpha-btp',
        email: 'contact@societe-a.test',
        phone: '+212 522 000 100',
        address: '12 Avenue Hassan II',
        city: 'Casablanca',
        country: 'Maroc',
        status: TenantStatus.ACTIVE,
        subscriptionPlanId: pro.id,
      },
    }),
    prisma.tenant.create({
      data: {
        name: 'Societe Atlas Construction',
        slug: 'societe-atlas-construction',
        email: 'contact@atlas-construction.test',
        phone: '+212 537 000 200',
        address: '24 Rue Mohammed V',
        city: 'Rabat',
        country: 'Maroc',
        status: TenantStatus.TRIAL,
        subscriptionPlanId: trial.id,
      },
    }),
    prisma.tenant.create({
      data: {
        name: 'Futura Expertise',
        slug: 'futura-expertise',
        email: 'contact@futura-expert.com',
        city: 'Casablanca',
        country: 'Maroc',
        status: TenantStatus.ACTIVE,
        subscriptionPlanId: enterprise.id,
      },
    }),
  ]);

  await prisma.user.create({
    data: {
      email: 'superadmin@pointage360.test',
      passwordHash,
      firstName: 'Nadia',
      lastName: 'Platform',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const futuraResourceManager = await prisma.user.create({
    data: {
      tenantId: futura.id,
      email: 'a.elyoussefi@futura-expert.com',
      passwordHash,
      firstName: 'Abdelouahed',
      lastName: 'El Youssefi',
      role: UserRole.RESOURCE_MANAGER,
      status: UserStatus.ACTIVE,
    },
  });

  const alphaUsers = await Promise.all([
    prisma.user.create({
      data: {
        tenantId: alpha.id,
        email: 'admin@societe-a.test',
        passwordHash,
        firstName: 'Samir',
        lastName: 'Benali',
        phone: '+212 661 100 001',
        role: UserRole.RESOURCE_MANAGER,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: alpha.id,
        email: 'hr@societe-a.test',
        passwordHash,
        firstName: 'Imane',
        lastName: 'El Fassi',
        phone: '+212 661 100 002',
        role: UserRole.HR,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: alpha.id,
        email: 'project.manager@societe-a.test',
        passwordHash,
        firstName: 'Rim',
        lastName: 'Bennani',
        phone: '+212 661 100 005',
        role: UserRole.PROJECT_MANAGER,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: alpha.id,
        email: 'manager@societe-a.test',
        passwordHash,
        firstName: 'Youssef',
        lastName: 'Amrani',
        phone: '+212 661 100 003',
        role: UserRole.MANAGER,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: alpha.id,
        email: 'employee@societe-a.test',
        passwordHash,
        firstName: 'Omar',
        lastName: 'Mansouri',
        phone: '+212 661 100 004',
        role: UserRole.EMPLOYEE,
      },
    }),
  ]);

  const [alphaAdmin, alphaHr, alphaProjectManager, alphaManager, alphaEmployee] = alphaUsers;

  const extraNames = [
    ['Amal', 'Tahiri', 'Cheffe de chantier'],
    ['Karim', 'Naciri', 'Chef electricien'],
    ['Hajar', 'Berrada', 'Assistante RH'],
    ['Mehdi', 'Kabbaj', 'Conducteur travaux'],
    ['Salma', 'Rami', 'Comptable chantier'],
    ['Reda', 'Bennani', 'Technicien'],
    ['Sara', 'Moutawakil', 'Ingenieure planning'],
    ['Bilal', 'Slaoui', 'Ouvrier specialise'],
    ['Leila', 'Kettani', 'Controle qualite'],
    ['Anas', 'Ziani', 'Magasinier'],
    ['Noura', 'Idrissi', 'Responsable paie'],
    ['Hamza', 'Alaoui', 'Technicien securite'],
    ['Meryem', 'Saidi', 'Coordinatrice site'],
    ['Ilyas', 'Tazi', 'Operateur'],
    ['Dina', 'Cherkaoui', 'Assistante projet'],
  ] as const;

  const extraEmployees = await Promise.all(
    extraNames.map(([firstName, lastName], index) =>
      prisma.user.create({
        data: {
          tenantId: alpha.id,
          email: `employee${index + 1}@societe-a.test`,
          passwordHash,
          firstName,
          lastName,
          phone: `+212 661 200 ${String(index + 1).padStart(3, '0')}`,
          role: index === 0 || index === 3 ? UserRole.MANAGER : UserRole.EMPLOYEE,
        },
      }),
    ),
  );

  const atlasAdmin = await prisma.user.create({
    data: {
      tenantId: atlas.id,
      email: 'admin@atlas-construction.test',
      passwordHash,
      firstName: 'Amina',
      lastName: 'Atlas',
      role: UserRole.RESOURCE_MANAGER,
    },
  });

  const atlasProjectManager = await prisma.user.create({
    data: {
      tenantId: atlas.id,
      email: 'project.manager@atlas-construction.test',
      passwordHash,
      firstName: 'Nabil',
      lastName: 'Atlas',
      role: UserRole.PROJECT_MANAGER,
    },
  });

  const atlasManager = await prisma.user.create({
    data: {
      tenantId: atlas.id,
      email: 'manager@atlas-construction.test',
      passwordHash,
      firstName: 'Rachid',
      lastName: 'Ait Omar',
      role: UserRole.MANAGER,
    },
  });

  const alphaProject = await prisma.project.create({
    data: {
      tenantId: alpha.id,
      code: 'PRJ-ALPHA-001',
      name: 'Programme Casablanca 2026',
      clientName: 'Portefeuille Alpha BTP',
      projectManagerId: alphaProjectManager.id,
      startDate: date('2026-01-01'),
      plannedEndDate: date('2027-04-15'),
      status: ProjectStatus.ACTIVE,
    },
  });

  const atlasProject = await prisma.project.create({
    data: {
      tenantId: atlas.id,
      code: 'PRJ-ATLAS-001',
      name: 'Programme Atlas 2026',
      clientName: 'Atlas Construction',
      projectManagerId: atlasProjectManager.id,
      startDate: date('2026-01-01'),
      plannedEndDate: date('2026-12-31'),
      status: ProjectStatus.ACTIVE,
    },
  });

  const alphaSites = await Promise.all([
    prisma.site.create({
      data: {
        tenantId: alpha.id,
        projectId: alphaProject.id,
        code: 'CH-001',
        name: 'Residence Palmier',
        clientName: 'Palmier Invest',
        address: 'Quartier Californie',
        city: 'Casablanca',
        country: 'Maroc',
        managerId: alphaManager.id,
        startDate: date('2026-01-06'),
        plannedEndDate: date('2026-11-30'),
        status: SiteStatus.ACTIVE,
        progressPercent: 42,
        latitude: 33.533333,
        longitude: -7.583333,
        gpsRadiusMeters: 250,
      },
    }),
    prisma.site.create({
      data: {
        tenantId: alpha.id,
        projectId: alphaProject.id,
        code: 'CH-002',
        name: 'Tour Atlas',
        clientName: 'Atlas Offices',
        address: 'Boulevard Zerktouni',
        city: 'Casablanca',
        country: 'Maroc',
        managerId: alphaManager.id,
        startDate: date('2026-02-01'),
        plannedEndDate: date('2027-04-15'),
        status: SiteStatus.ACTIVE,
        progressPercent: 18,
        latitude: 33.589886,
        longitude: -7.603869,
        gpsRadiusMeters: 180,
      },
    }),
    prisma.site.create({
      data: {
        tenantId: alpha.id,
        projectId: alphaProject.id,
        code: 'CH-003',
        name: 'Villa Projet Nord',
        clientName: 'Client Prive',
        address: 'Route de Kenitra',
        city: 'Rabat',
        country: 'Maroc',
        managerId: extraEmployees[0]?.id,
        startDate: date('2026-03-15'),
        plannedEndDate: date('2026-09-15'),
        status: SiteStatus.ACTIVE,
        progressPercent: 31,
        latitude: 34.020882,
        longitude: -6.84165,
        gpsRadiusMeters: 200,
      },
    }),
  ]);

  const atlasSites = await Promise.all([
    prisma.site.create({
      data: {
        tenantId: atlas.id,
        projectId: atlasProject.id,
        code: 'CH-004',
        name: 'Entrepot Logistique',
        clientName: 'Logis Maroc',
        address: 'Zone Industrielle',
        city: 'Tanger',
        country: 'Maroc',
        managerId: atlasManager.id,
        startDate: date('2026-04-01'),
        plannedEndDate: date('2026-12-31'),
        status: SiteStatus.ACTIVE,
        progressPercent: 24,
        latitude: 35.759465,
        longitude: -5.833954,
        gpsRadiusMeters: 300,
      },
    }),
    prisma.site.create({
      data: {
        tenantId: atlas.id,
        projectId: atlasProject.id,
        code: 'CH-005',
        name: 'Bureau Siege',
        clientName: 'Atlas Construction',
        address: 'Agdal',
        city: 'Rabat',
        country: 'Maroc',
        managerId: atlasManager.id,
        startDate: date('2026-01-01'),
        status: SiteStatus.ACTIVE,
        progressPercent: 65,
        latitude: 34.006264,
        longitude: -6.849813,
        gpsRadiusMeters: 120,
      },
    }),
  ]);

  const allAlphaEmployees = [alphaAdmin, alphaHr, alphaProjectManager, alphaManager, alphaEmployee, ...extraEmployees];
  for (const [index, user] of allAlphaEmployees.entries()) {
    const site = alphaSites[index % alphaSites.length];
    await prisma.employeeProfile.create({
      data: {
        tenantId: alpha.id,
        userId: user.id,
        employeeNumber: `A-${String(index + 1).padStart(4, '0')}`,
        jobTitle:
          user.role === UserRole.PROJECT_MANAGER
            ? 'Chef de projet'
            : user.role === UserRole.MANAGER
              ? 'Manager chantier'
              : extraNames[index - 5]?.[2] ?? 'Collaborateur',
        contractType: 'CDI',
        hireDate: date(`202${index % 5 + 1}-0${(index % 8) + 1}-15`),
        mainSiteId: site?.id,
        annualLeaveBalance: 18,
        hourlyRate: user.role === UserRole.PROJECT_MANAGER ? 160 : user.role === UserRole.MANAGER ? 140 : 85,
      },
    });

    await prisma.siteAssignment.create({
      data: {
        tenantId: alpha.id,
        siteId: site!.id,
        userId: user.id,
        startDate: date('2026-05-01'),
        roleOnSite:
          user.role === UserRole.PROJECT_MANAGER
            ? 'Chef de projet'
            : user.role === UserRole.MANAGER
              ? 'Responsable chantier'
              : 'Equipe chantier',
      },
    });
  }

  for (const [index, user] of [atlasAdmin, atlasProjectManager, atlasManager].entries()) {
    const site = atlasSites[index % atlasSites.length];
    await prisma.employeeProfile.create({
      data: {
        tenantId: atlas.id,
        userId: user.id,
        employeeNumber: `AT-${String(index + 1).padStart(4, '0')}`,
        jobTitle:
          user.role === UserRole.PROJECT_MANAGER
            ? 'Chef de projet'
            : user.role === UserRole.MANAGER
              ? 'Manager chantier'
              : 'Ressource Manager',
        contractType: 'CDI',
        hireDate: date('2024-02-15'),
        mainSiteId: site?.id,
        annualLeaveBalance: 20,
        hourlyRate: 120,
      },
    });
  }

  const leaveTypeData = [
    ['MAR-ANNUAL', '[MAR] Annual Leave', 18],
    ['MAR-CIRCUMCISION', '[MAR] Circumcision Leave', 2],
    ['MAR-DEATH-FAMILY', '[MAR] Death of a family member', 3],
    ['MAR-DEATH-PARENTS', '[MAR] Death of family members and parents', 3],
    ['MAR-MARRIAGE', '[MAR] Marriage Leave', 4],
    ['MAR-PATERNITY', '[MAR] Paternity Leave', 15],
    ['MAR-RECOVERY', '[MAR] Recovery Leave', 5],
    ['MAR-RESIGNATION', '[MAR] Resignation Leave', 0],
    ['MAR-SICK', '[MAR] Sick Leave', 10],
    ['MAR-SURGERY', '[MAR] Surgical operation leave', 10],
  ] as const;

  async function createLeaveSetup(tenantId: string, users: { id: string }[]) {
    const types = [];
    for (const [code, name, annualAllowanceDays] of leaveTypeData) {
      types.push(
        await prisma.leaveType.create({
          data: {
            tenantId,
            code,
            name,
            annualAllowanceDays,
            isPaid: code !== 'MAR-RESIGNATION',
            requiresApproval: true,
          },
        }),
      );
    }

    const annual = types[0]!;
    for (const user of users) {
      await prisma.leaveBalance.create({
        data: {
          tenantId,
          userId: user.id,
          leaveTypeId: annual.id,
          year: 2026,
          openingBalance: 18,
          accruedDays: 7.5,
          usedDays: 2,
          pendingDays: 1,
          remainingDays: 22.5,
        },
      });
    }

    return types;
  }

  const alphaLeaveTypes = await createLeaveSetup(alpha.id, allAlphaEmployees);
  await createLeaveSetup(atlas.id, [atlasAdmin, atlasProjectManager, atlasManager]);

  for (const tenant of [alpha, atlas]) {
    await prisma.holiday.createMany({
      data: [
        { tenantId: tenant.id, name: 'Manifeste de l independance', date: date('2026-01-11'), country: 'MA', isRecurring: true },
        { tenantId: tenant.id, name: 'Fete du travail', date: date('2026-05-01'), country: 'MA', isRecurring: true },
        { tenantId: tenant.id, name: 'Fete du Trone', date: date('2026-07-30'), country: 'MA', isRecurring: true },
        { tenantId: tenant.id, name: 'Fete de la jeunesse', date: date('2026-08-21'), country: 'MA', isRecurring: true },
      ],
    });
  }

  const weekStart = date('2026-05-18');
  const weekEnd = date('2026-05-24');

  async function createTimesheetForUser(user: { id: string }, status: TimesheetStatus, siteIndex = 0) {
    const timesheet = await prisma.timesheet.create({
      data: {
        tenantId: alpha.id,
        userId: user.id,
        periodStart: weekStart,
        periodEnd: weekEnd,
        status,
        submittedAt: status === TimesheetStatus.DRAFT ? null : time('2026-05-22T17:35:00'),
        approvedById: status === TimesheetStatus.APPROVED ? alphaHr.id : null,
        approvedAt: status === TimesheetStatus.APPROVED ? time('2026-05-23T09:00:00') : null,
      },
    });

    const line = await prisma.timesheetLine.create({
      data: {
        tenantId: alpha.id,
        timesheetId: timesheet.id,
        siteId: alphaSites[siteIndex % alphaSites.length]!.id,
        taskName: 'Travaux chantier',
        billingType: BillingType.BILLABLE,
        activity: 'Execution',
        workLocation: WorkLocation.SITE,
        placeOfWork: alphaSites[siteIndex % alphaSites.length]!.name,
      },
    });

    await prisma.timesheetDayEntry.createMany({
      data: [0, 1, 2, 3, 4].map((day) => ({
        tenantId: alpha.id,
        timesheetLineId: line.id,
        entryDate: addDays(weekStart, day),
        hours: day === 4 ? 7 : 8,
        comment: day === 4 ? 'Depart anticipe valide' : null,
      })),
    });

    return timesheet;
  }

  const submittedTimesheet = await createTimesheetForUser(alphaEmployee, TimesheetStatus.SUBMITTED, 0);
  const approvedTimesheet = await createTimesheetForUser(extraEmployees[1]!, TimesheetStatus.APPROVED, 1);
  await createTimesheetForUser(extraEmployees[2]!, TimesheetStatus.DRAFT, 2);

  for (const [index, user] of [alphaEmployee, extraEmployees[1]!, extraEmployees[2]!, extraEmployees[3]!].entries()) {
    for (let day = 0; day < 5; day++) {
      const checkIn = time(`2026-05-${18 + day}T08:${index === 3 && day === 2 ? '31' : '00'}:00`);
      const checkOut = time(`2026-05-${18 + day}T17:00:00`);
      await prisma.attendancePunch.create({
        data: {
          tenantId: alpha.id,
          userId: user.id,
          siteId: alphaSites[index % alphaSites.length]!.id,
          punchDate: addDays(weekStart, day),
          checkInAt: checkIn,
          checkOutAt: checkOut,
          durationMinutes: Math.round((checkOut.getTime() - checkIn.getTime()) / 60000),
          workLocation: WorkLocation.SITE,
          checkInLatitude: index === 2 && day === 1 ? 34.0 : Number(alphaSites[index % alphaSites.length]!.latitude),
          checkInLongitude: index === 2 && day === 1 ? -6.0 : Number(alphaSites[index % alphaSites.length]!.longitude),
          checkOutLatitude: Number(alphaSites[index % alphaSites.length]!.latitude),
          checkOutLongitude: Number(alphaSites[index % alphaSites.length]!.longitude),
          isGpsAnomaly: index === 2 && day === 1,
          employeeComment: index === 2 && day === 1 ? 'Pointage depuis entree secondaire' : null,
          status: day < 3 ? AttendanceStatus.APPROVED : AttendanceStatus.SUBMITTED,
          approvedById: day < 3 ? alphaHr.id : null,
          approvedAt: day < 3 ? time(`2026-05-${18 + day}T18:00:00`) : null,
        },
      });
    }
  }

  const submittedLeave = await prisma.leaveRequest.create({
    data: {
      tenantId: alpha.id,
      userId: alphaEmployee.id,
      leaveTypeId: alphaLeaveTypes[0]!.id,
      startDate: date('2026-06-03'),
      endDate: date('2026-06-05'),
      durationDays: 3,
      comment: 'Conges familiaux',
      status: LeaveRequestStatus.SUBMITTED,
      submittedAt: time('2026-05-22T10:30:00'),
    },
  });

  const approvedLeave = await prisma.leaveRequest.create({
    data: {
      tenantId: alpha.id,
      userId: extraEmployees[4]!.id,
      leaveTypeId: alphaLeaveTypes[8]!.id,
      startDate: date('2026-05-20'),
      endDate: date('2026-05-20'),
      durationDays: 1,
      comment: 'Repos medical',
      status: LeaveRequestStatus.APPROVED,
      submittedAt: time('2026-05-19T08:00:00'),
      approvedById: alphaHr.id,
      approvedAt: time('2026-05-19T11:00:00'),
    },
  });

  await prisma.approvalAction.createMany({
    data: [
      {
        tenantId: alpha.id,
        entityType: 'TIMESHEET',
        entityId: submittedTimesheet.id,
        actionById: alphaEmployee.id,
        oldStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
        comment: 'Soumission hebdomadaire',
      },
      {
        tenantId: alpha.id,
        entityType: 'TIMESHEET',
        entityId: approvedTimesheet.id,
        actionById: alphaHr.id,
        oldStatus: 'SUBMITTED',
        newStatus: 'APPROVED',
        comment: 'OK pour paie',
      },
      {
        tenantId: alpha.id,
        entityType: 'LEAVE_REQUEST',
        entityId: submittedLeave.id,
        actionById: alphaEmployee.id,
        oldStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
        comment: 'Demande envoyee',
      },
      {
        tenantId: alpha.id,
        entityType: 'LEAVE_REQUEST',
        entityId: approvedLeave.id,
        actionById: alphaHr.id,
        oldStatus: 'SUBMITTED',
        newStatus: 'APPROVED',
        comment: 'Justificatif valide',
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: alpha.id,
        userId: alphaAdmin.id,
        action: 'employee.created',
        entityType: 'User',
        entityId: alphaEmployee.id,
        metadata: { email: alphaEmployee.email },
      },
      {
        tenantId: alpha.id,
        userId: alphaManager.id,
        action: 'timesheet.approved',
        entityType: 'Timesheet',
        entityId: approvedTimesheet.id,
        metadata: { periodStart: weekStart.toISOString(), periodEnd: weekEnd.toISOString() },
      },
      {
        tenantId: alpha.id,
        userId: alphaHr.id,
        action: 'leave.approved',
        entityType: 'LeaveRequest',
        entityId: approvedLeave.id,
        metadata: { durationDays: 1 },
      },
      {
        tenantId: atlas.id,
        userId: atlasAdmin.id,
        action: 'tenant.seeded',
        entityType: 'Tenant',
        entityId: atlas.id,
        metadata: { plan: trial.name },
      },
      {
        tenantId: futura.id,
        userId: futuraResourceManager.id,
        action: 'tenant.seeded',
        entityType: 'Tenant',
        entityId: futura.id,
        metadata: { plan: enterprise.name, emptyAccount: true },
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        tenantId: alpha.id,
        userId: alphaManager.id,
        title: 'Timesheet a approuver',
        message: `${fullName(alphaEmployee.firstName, alphaEmployee.lastName)} a soumis une timesheet.`,
        type: 'TIMESHEET_SUBMITTED',
      },
      {
        tenantId: alpha.id,
        userId: alphaEmployee.id,
        title: 'Demande de conge recue',
        message: 'Votre demande est en attente de validation RH.',
        type: 'LEAVE_SUBMITTED',
      },
      {
        tenantId: alpha.id,
        userId: extraEmployees[1]!.id,
        title: 'Timesheet approuvee',
        message: 'Votre timesheet de la semaine a ete approuvee.',
        type: 'TIMESHEET_APPROVED',
        isRead: true,
      },
    ],
  });

  console.log('Seed complete');
  console.log('Test password:', password);
  console.log(
    'Users: superadmin@pointage360.test, admin@societe-a.test, hr@societe-a.test, project.manager@societe-a.test, manager@societe-a.test, employee@societe-a.test, a.elyoussefi@futura-expert.com',
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
