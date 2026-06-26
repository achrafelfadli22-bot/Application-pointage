import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';
const RESOURCE_MANAGER_EMAIL = 'a.elyoussefi@futura-expert.com';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
};

type Session = {
  accessToken: string;
  user: { id: string; email: string; role: string; tenantId: string | null };
  tenant?: { id: string; slug: string; status: string } | null;
  role: string;
};

type HealthPayload = {
  status: 'ok' | 'degraded';
  dependencies: Record<string, { status: 'up' | 'down'; error?: string }>;
};

type Timesheet = {
  id: string;
  status: string;
};

type AttendancePunch = {
  id: string;
  status: string;
};

type EmployeeProfile = {
  id: string;
  userId: string;
  user: { id: string; email: string; role: string; status: string };
};

type Site = {
  id: string;
  code: string;
  managerId: string | null;
};

const runOffsetDays = 420 + ((Math.floor(Date.now() / 1000) % 50_000) * 7);
const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    expected?: number | number[];
  } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new Error(`API unavailable on ${API_URL}. Start the platform with "pnpm.cmd dev". ${String(error)}`);
  }

  const rawBody = await response.text();
  let payload: ApiEnvelope<T>;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as ApiEnvelope<T>) : ({ success: response.ok } as ApiEnvelope<T>);
  } catch {
    payload = {
      success: false,
      error: rawBody || response.statusText,
      statusCode: response.status,
    };
  }
  const expected = options.expected ?? (options.method === 'POST' ? [200, 201] : 200);
  const expectedStatuses = Array.isArray(expected) ? expected : [expected];

  assert.ok(
    expectedStatuses.includes(response.status),
    `${options.method ?? 'GET'} ${path} expected ${expectedStatuses.join('/')} got ${response.status}: ${payload.error ?? ''}`,
  );

  if (response.ok) {
    assert.equal(payload.success, true, `${path} should return success envelope`);
    return payload.data as T;
  }

  assert.equal(payload.success, false, `${path} should return error envelope`);
  return payload;
}

async function login(email = RESOURCE_MANAGER_EMAIL) {
  return request<Session>('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
}

async function createEmployee(token: string, role: string, index: number, overrides: Record<string, unknown> = {}) {
  const normalizedRole = role.toLowerCase().replaceAll('_', '-');

  return request<EmployeeProfile>('/employees', {
    method: 'POST',
    token,
    body: {
      email: `critical-${normalizedRole}-${runId}-${index}@futura-expert.com`,
      password: PASSWORD,
      firstName: `Critical ${role}`,
      lastName: String(index),
      role,
      employeeNumber: `CRT-${runId}-${index}`,
      jobTitle: role === 'MANAGER' ? 'Chef de site' : role,
      contractType: 'CDI',
      hireDate: '2026-01-01',
      annualLeaveBalance: 18,
      status: 'ACTIVE',
      ...overrides,
    },
  });
}

async function withStep(name: string, fn: () => Promise<void>) {
  process.stdout.write(`- ${name}... `);
  await fn();
  process.stdout.write('ok\n');
}

function isoDate(daysFromNow: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + daysFromNow);
  return value.toISOString().slice(0, 10);
}

function nextMonday(daysFromNow = 45) {
  const value = new Date(`${isoDate(daysFromNow)}T00:00:00.000Z`);
  const day = value.getUTCDay();
  const offset = (8 - day) % 7 || 7;
  value.setUTCDate(value.getUTCDate() + offset);
  return value;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function runCriticalApiTests() {
  await withStep('health DB Redis MinIO', async () => {
    const health = await request<HealthPayload>('/health');
    assert.equal(health.dependencies.database.status, 'up', 'Database health must be up');
    assert.ok(health.dependencies.redis, 'Redis health is missing');
    assert.ok(health.dependencies.minio, 'MinIO health is missing');
    assert.match(health.status, /^(ok|degraded)$/);
  });

  await withStep('auth protects API routes', async () => {
    await request('/dashboard/summary', { expected: 401 });
    await request('/auth/login', {
      method: 'POST',
      body: { email: RESOURCE_MANAGER_EMAIL, password: 'wrong-password' },
      expected: 401,
    });
  });

  const resourceManager = await login();

  await withStep('Futura resource manager can log in', async () => {
    assert.equal(resourceManager.role, 'RESOURCE_MANAGER');
    assert.equal(resourceManager.tenant?.slug, 'futura-expertise');
    assert.equal(resourceManager.user.email, RESOURCE_MANAGER_EMAIL);
  });

  await withStep('site manager N+1 can approve attendance for main-site team member', async () => {
    const manager = await createEmployee(resourceManager.accessToken, 'MANAGER', 10);
    const site = await request<Site>('/sites', {
      method: 'POST',
      token: resourceManager.accessToken,
      body: {
        code: `CRT-SITE-${runId}`,
        name: 'Critical N1 attendance site',
        clientName: 'Futura Expertise',
        managerId: manager.user.id,
        status: 'ACTIVE',
      },
    });

    const employee = await createEmployee(resourceManager.accessToken, 'EMPLOYEE', 11, { mainSiteId: site.id });
    const employeeSession = await login(employee.user.email);
    const managerSession = await login(manager.user.email);

    const punch = await request<AttendancePunch>('/attendance/check-in', {
      method: 'POST',
      token: employeeSession.accessToken,
      body: {
        workLocation: 'OFFICE',
        employeeComment: 'Critical N1 approval fallback',
      },
    });

    const submitted = await request<AttendancePunch>(`/attendance/${punch.id}/submit`, {
      method: 'POST',
      token: employeeSession.accessToken,
    });
    assert.equal(submitted.status, 'SUBMITTED');

    const n1Approved = await request<AttendancePunch>(`/attendance/${punch.id}/approve`, {
      method: 'POST',
      token: managerSession.accessToken,
    });
    assert.equal(n1Approved.status, 'N1_APPROVED');
  });

  await withStep('empty timesheets cannot be submitted', async () => {
    const start = nextMonday(runOffsetDays);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    const created = await request<Timesheet>('/timesheets', {
      method: 'POST',
      token: resourceManager.accessToken,
      body: {
        periodStart: dateOnly(start),
        periodEnd: dateOnly(end),
      },
    });

    await request(`/timesheets/${created.id}/submit`, {
      method: 'POST',
      token: resourceManager.accessToken,
      expected: 400,
    });
  });

  await withStep('filled timesheets can be submitted but not validated by Resource Manager', async () => {
    const start = nextMonday(runOffsetDays + 14);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    const created = await request<Timesheet>('/timesheets', {
      method: 'POST',
      token: resourceManager.accessToken,
      body: {
        periodStart: dateOnly(start),
        periodEnd: dateOnly(end),
      },
    });

    await request<Timesheet>(`/timesheets/${created.id}`, {
      method: 'PUT',
      token: resourceManager.accessToken,
      body: {
        lines: [
          {
            taskName: 'API critical Futura test',
            billingType: 'BILLABLE',
            activity: 'EXECUTION',
            workLocation: 'OFFICE',
            placeOfWork: 'Bureau Futura',
            entries: [{ entryDate: dateOnly(start), hours: 1 }],
          },
        ],
      },
    });

    const submitted = await request<Timesheet>(`/timesheets/${created.id}/submit`, {
      method: 'POST',
      token: resourceManager.accessToken,
    });
    assert.equal(submitted.status, 'SUBMITTED');

    await request(`/timesheets/${created.id}/approve`, {
      method: 'POST',
      token: resourceManager.accessToken,
      expected: 403,
    });
  });

  await withStep('timesheets expose approved leave, holidays, and overtime metrics', async () => {
    const employee = await createEmployee(resourceManager.accessToken, 'EMPLOYEE', 21);
    const employeeSession = await login(employee.user.email);
    const start = nextMonday(runOffsetDays + 21);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const leaveDate = new Date(start);
    leaveDate.setUTCDate(start.getUTCDate() + 1);

    const leaveType = await request<{ id: string }>('/settings/leave-types', {
      method: 'POST',
      token: resourceManager.accessToken,
      body: {
        code: `CRT-LV-${runId}`,
        name: `Critical Leave ${runId}`,
        isPaid: true,
        annualAllowanceDays: 0,
        requiresApproval: true,
        status: 'ACTIVE',
      },
    });

    await request('/settings/holidays', {
      method: 'POST',
      token: resourceManager.accessToken,
      body: {
        name: `Critical Holiday ${runId}`,
        date: dateOnly(start),
        country: 'MA',
        isRecurring: false,
      },
    });

    const leave = await request<{ id: string; status: string }>('/leave/requests', {
      method: 'POST',
      token: employeeSession.accessToken,
      body: {
        leaveTypeId: leaveType.id,
        startDate: dateOnly(leaveDate),
        endDate: dateOnly(leaveDate),
        comment: 'Critical approved leave marker',
      },
    });
    await request(`/leave/requests/${leave.id}/submit`, { method: 'POST', token: employeeSession.accessToken });
    const approvedLeave = await request<{ status: string }>(`/leave/requests/${leave.id}/approve`, {
      method: 'POST',
      token: resourceManager.accessToken,
    });
    assert.equal(approvedLeave.status, 'APPROVED');

    const timesheet = await request<Timesheet>('/timesheets', {
      method: 'POST',
      token: employeeSession.accessToken,
      body: {
        periodStart: dateOnly(start),
        periodEnd: dateOnly(end),
      },
    });

    await request<Timesheet>(`/timesheets/${timesheet.id}`, {
      method: 'PUT',
      token: employeeSession.accessToken,
      body: {
        lines: [
          {
            taskName: 'Overtime report marker',
            billingType: 'BILLABLE',
            activity: 'EXECUTION',
            workLocation: 'OFFICE',
            placeOfWork: 'Bureau Futura',
            entries: [{ entryDate: dateOnly(start), hours: 10 }],
          },
        ],
      },
    });

    const detail = await request<{
      calendarEvents: {
        holidays: Array<{ date: string; label: string }>;
        approvedLeaves: Array<{ date: string; label: string }>;
      };
    }>(`/timesheets/${timesheet.id}`, { token: employeeSession.accessToken });
    assert.ok(detail.calendarEvents.holidays.some((holiday) => holiday.date === dateOnly(start)));
    assert.ok(detail.calendarEvents.approvedLeaves.some((leaveEvent) => leaveEvent.date === dateOnly(leaveDate)));

    const reportRows = await request<Array<{ id: string; metrics: Record<string, number> }>>(
      `/reports/timesheets?userId=${employee.user.id}&startDate=${dateOnly(start)}&endDate=${dateOnly(end)}`,
      { token: resourceManager.accessToken },
    );
    const reportRow = reportRows.find((row) => row.id === timesheet.id);
    assert.ok(reportRow, 'Created timesheet must be present in report');
    assert.equal(reportRow.metrics.totalHours, 10);
    assert.equal(reportRow.metrics.normalHours, Math.min(10, reportRow.metrics.overtimeTriggerHours));
    assert.equal(reportRow.metrics.overtimeHours, Math.max(0, 10 - reportRow.metrics.overtimeTriggerHours));
    assert.equal(reportRow.metrics.billableHours, 10);
    assert.ok(reportRow.metrics.leaveDays >= 1);
    assert.equal(reportRow.metrics.publicHolidays, 1);
  });

  await withStep('draft timesheets can be deleted only by their owner', async () => {
    const start = nextMonday(runOffsetDays + 28);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    const created = await request<Timesheet>('/timesheets', {
      method: 'POST',
      token: resourceManager.accessToken,
      body: {
        periodStart: dateOnly(start),
        periodEnd: dateOnly(end),
      },
    });

    const deleted = await request<{ id: string; deleted: boolean }>(`/timesheets/${created.id}`, {
      method: 'DELETE',
      token: resourceManager.accessToken,
    });

    assert.deepEqual(deleted, { id: created.id, deleted: true });
  });

  await withStep('submitted timesheets cannot be deleted by their owner', async () => {
    const start = nextMonday(runOffsetDays + 42);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    const created = await request<Timesheet>('/timesheets', {
      method: 'POST',
      token: resourceManager.accessToken,
      body: {
        periodStart: dateOnly(start),
        periodEnd: dateOnly(end),
      },
    });

    await request<Timesheet>(`/timesheets/${created.id}`, {
      method: 'PUT',
      token: resourceManager.accessToken,
      body: {
        lines: [
          {
            taskName: 'Delete guard test',
            billingType: 'BILLABLE',
            activity: 'EXECUTION',
            workLocation: 'OFFICE',
            placeOfWork: 'Bureau Futura',
            entries: [{ entryDate: dateOnly(start), hours: 1 }],
          },
        ],
      },
    });

    await request<Timesheet>(`/timesheets/${created.id}/submit`, {
      method: 'POST',
      token: resourceManager.accessToken,
    });

    await request(`/timesheets/${created.id}`, {
      method: 'DELETE',
      token: resourceManager.accessToken,
      expected: 400,
    });
  });

  await withStep('managers cannot approve their own submitted timesheets', async () => {
    const manager = await createEmployee(resourceManager.accessToken, 'MANAGER', 1);
    const managerSession = await login(manager.user.email);
    const start = nextMonday(runOffsetDays + 56);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    const created = await request<Timesheet>('/timesheets', {
      method: 'POST',
      token: managerSession.accessToken,
      body: {
        periodStart: dateOnly(start),
        periodEnd: dateOnly(end),
      },
    });

    await request<Timesheet>(`/timesheets/${created.id}`, {
      method: 'PUT',
      token: managerSession.accessToken,
      body: {
        lines: [
          {
            taskName: 'Self validation guard',
            billingType: 'BILLABLE',
            activity: 'EXECUTION',
            workLocation: 'OFFICE',
            placeOfWork: 'Bureau Futura',
            entries: [{ entryDate: dateOnly(start), hours: 1 }],
          },
        ],
      },
    });

    await request<Timesheet>(`/timesheets/${created.id}/submit`, {
      method: 'POST',
      token: managerSession.accessToken,
    });

    await request(`/timesheets/${created.id}/approve`, {
      method: 'POST',
      token: managerSession.accessToken,
      expected: 403,
    });
  });

  await withStep('resource manager can deactivate employees and managers only', async () => {
    const employee = await createEmployee(resourceManager.accessToken, 'EMPLOYEE', 2);
    const deletedEmployee = await request<{ id: string; status: string }>(`/employees/${employee.id}`, {
      method: 'DELETE',
      token: resourceManager.accessToken,
    });
    assert.equal(deletedEmployee.id, employee.user.id);
    assert.equal(deletedEmployee.status, 'INACTIVE');

    const hr = await createEmployee(resourceManager.accessToken, 'HR', 3);
    await request(`/employees/${hr.id}`, {
      method: 'DELETE',
      token: resourceManager.accessToken,
      expected: 403,
    });
  });

  process.stdout.write('API critical tests passed\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCriticalApiTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
