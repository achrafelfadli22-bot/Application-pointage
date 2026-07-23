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
    employeeNumber: 'FE-004',
    jobTitle: 'Technicien',
    annualLeaveBalance: 18,
    status: 'ACTIVE',
    user: {
      id: 'u1',
      firstName: 'Omar',
      lastName: 'Mansouri',
      email: 'o.mansouri@futura-expert.com',
      phone: '+212 661 100 004',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
    mainSite: { code: 'MPH', name: 'MPH' },
  },
  {
    id: '2',
    employeeNumber: 'FE-002',
    jobTitle: 'Chef de site',
    annualLeaveBalance: 18,
    status: 'ACTIVE',
    user: {
      id: 'u2',
      firstName: 'Mohammed',
      lastName: 'Sermoun',
      email: 'm.sermoun@futura-expert.com',
      phone: '+212 661 100 003',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
    mainSite: { code: 'SAFI', name: 'SAFI' },
  },
];

export const demoSites = [
  {
    id: 's1',
    code: 'MPH',
    name: 'MPH',
    clientName: 'Futura Expertise',
    city: 'Casablanca',
    status: 'ACTIVE',
    progressPercent: 42,
    manager: { firstName: 'Mohammed', lastName: 'Sermoun' },
    _count: { assignments: 12 },
  },
  {
    id: 's2',
    code: 'SAFI',
    name: 'SAFI',
    clientName: 'Futura Expertise',
    city: 'Casablanca',
    status: 'ACTIVE',
    progressPercent: 18,
    manager: { firstName: 'Mohammed', lastName: 'Sermoun' },
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
