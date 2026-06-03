export const demoCounters = {
  activeEmployees: 19,
  presentToday: 14,
  absentToday: 5,
  lateToday: 2,
  weeklyHours: 486.5,
  pendingTimesheets: 7,
  pendingLeave: 4,
  activeSites: 5,
};

export const demoEmployees = [
  {
    id: '1',
    employeeNumber: 'A-0004',
    jobTitle: 'Collaborateur',
    annualLeaveBalance: 18,
    status: 'ACTIVE',
    user: {
      id: 'u1',
      firstName: 'Omar',
      lastName: 'Mansouri',
      email: 'employee@societe-a.test',
      phone: '+212 661 100 004',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
    mainSite: { code: 'CH-001', name: 'Residence Palmier' },
  },
  {
    id: '2',
    employeeNumber: 'A-0003',
    jobTitle: 'Manager chantier',
    annualLeaveBalance: 18,
    status: 'ACTIVE',
    user: {
      id: 'u2',
      firstName: 'Youssef',
      lastName: 'Amrani',
      email: 'manager@societe-a.test',
      phone: '+212 661 100 003',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
    mainSite: { code: 'CH-002', name: 'Tour Atlas' },
  },
];

export const demoSites = [
  {
    id: 's1',
    code: 'CH-001',
    name: 'Residence Palmier',
    clientName: 'Palmier Invest',
    city: 'Casablanca',
    status: 'ACTIVE',
    progressPercent: 42,
    gpsRadiusMeters: 250,
    manager: { firstName: 'Youssef', lastName: 'Amrani' },
    _count: { assignments: 12 },
  },
  {
    id: 's2',
    code: 'CH-002',
    name: 'Tour Atlas',
    clientName: 'Atlas Offices',
    city: 'Casablanca',
    status: 'ACTIVE',
    progressPercent: 18,
    gpsRadiusMeters: 180,
    manager: { firstName: 'Youssef', lastName: 'Amrani' },
    _count: { assignments: 8 },
  },
];

export const demoTimesheets = [
  {
    id: 't1',
    periodStart: '2026-05-18T00:00:00.000Z',
    periodEnd: '2026-05-24T00:00:00.000Z',
    status: 'SUBMITTED',
    submittedAt: '2026-05-22T17:35:00.000Z',
    approvedAt: null,
    user: { firstName: 'Omar', lastName: 'Mansouri' },
    lines: [],
  },
  {
    id: 't2',
    periodStart: '2026-05-18T00:00:00.000Z',
    periodEnd: '2026-05-24T00:00:00.000Z',
    status: 'APPROVED',
    submittedAt: '2026-05-22T17:35:00.000Z',
    approvedAt: '2026-05-23T09:00:00.000Z',
    user: { firstName: 'Karim', lastName: 'Naciri' },
    lines: [],
  },
];

export const demoLeaveRequests = [
  {
    id: 'l1',
    startDate: '2026-06-03T00:00:00.000Z',
    endDate: '2026-06-05T00:00:00.000Z',
    durationDays: 3,
    status: 'SUBMITTED',
    leaveType: { name: '[MAR] Annual Leave' },
    user: { firstName: 'Omar', lastName: 'Mansouri' },
    updatedAt: '2026-05-22T10:30:00.000Z',
  },
];
