import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';

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

type Tenant = {
  id: string;
  slug: string;
  status: string;
};

type EmployeeProfile = {
  id: string;
  tenantId: string;
  user: { email: string; tenantId?: string | null };
};

type LeaveType = {
  id: string;
  name: string;
};

type LeaveRequest = {
  id: string;
  status: string;
};

type AttendancePunch = {
  id: string;
  status: string;
};

type Timesheet = {
  id: string;
  status: string;
};

type Site = {
  id: string;
  code: string;
  name: string;
};

type Project = {
  id: string;
  code: string;
  projectManagerId: string;
};

type HealthPayload = {
  status: 'ok' | 'degraded';
  dependencies: Record<string, { status: 'up' | 'down'; error?: string }>;
};

type DashboardSummary = {
  counters: {
    activeEmployees: number;
    activeSites: number;
    pendingTimesheets: number;
    pendingLeave: number;
  };
  latestPunches: Array<{ user?: { firstName: string; lastName: string } }>;
  pendingLeaveRequests: unknown[];
  timesheetsToApprove: unknown[];
};

const runOffsetDays = 365 + ((Math.floor(Date.now() / 1000) % 300_000) * 7);
const sessionCache = new Map<string, Session>();

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    expected?: number | number[];
  } = {},
  attempt = 0,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
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
    throw new Error(
      `API unavailable on ${API_URL}. Start the platform with "pnpm.cmd dev". ${String(error)}`,
    );
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  const expected = options.expected ?? (options.method === 'POST' ? [200, 201] : 200);
  const expectedStatuses = Array.isArray(expected) ? expected : [expected];
  if (response.status === 429 && !expectedStatuses.includes(429) && attempt < 1) {
    const retryAfterSeconds = Number(response.headers.get('retry-after') ?? 60);
    await new Promise((resolve) => setTimeout(resolve, (retryAfterSeconds + 1) * 1000));
    return request<T>(path, options, attempt + 1);
  }

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

async function login(email: string) {
  const cached = sessionCache.get(email);
  if (cached) {
    return cached;
  }

  const session = await request<Session>('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  sessionCache.set(email, session);
  return session;
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

async function getAlphaTenant(superAdminToken: string) {
  const tenants = await request<Tenant[]>('/tenants', { token: superAdminToken });
  const tenant = tenants.find((item) => item.slug === 'societe-alpha-btp');
  assert.ok(tenant, 'Demo tenant societe-alpha-btp not found');
  return tenant;
}

async function reactivateAlpha(superAdminToken: string, tenantId: string) {
  await request<Tenant>(`/tenants/${tenantId}/reactivate`, {
    method: 'PATCH',
    token: superAdminToken,
  });
}

export async function runCriticalApiTests() {
  const superAdmin = await login('superadmin@pointage360.test');
  let alpha = await getAlphaTenant(superAdmin.accessToken);
  await reactivateAlpha(superAdmin.accessToken, alpha.id);

  try {
    await withStep('health DB Redis MinIO', async () => {
      const health = await request<HealthPayload>('/health');
      assert.equal(health.dependencies.database.status, 'up', 'Database health must be up');
      assert.ok(health.dependencies.redis, 'Redis health is missing');
      assert.ok(health.dependencies.minio, 'MinIO health is missing');
      assert.match(health.status, /^(ok|degraded)$/);
    });

    await withStep('auth login and rejection', async () => {
      await request('/auth/login', {
        method: 'POST',
        body: { email: 'employee@societe-a.test', password: 'wrong-password' },
        expected: 401,
      });
      const employee = await login('employee@societe-a.test');
      assert.equal(employee.role, 'EMPLOYEE');
      assert.equal(employee.tenant?.status, 'ACTIVE');
    });

    await withStep('tenant guard blocks suspended tenant', async () => {
      alpha = await getAlphaTenant(superAdmin.accessToken);
      await request<Tenant>(`/tenants/${alpha.id}/suspend`, {
        method: 'PATCH',
        token: superAdmin.accessToken,
      });
      const employee = await login('employee@societe-a.test');
      await request('/dashboard/summary', {
        token: employee.accessToken,
        expected: 403,
      });
      await reactivateAlpha(superAdmin.accessToken, alpha.id);
      const activeEmployee = await login('employee@societe-a.test');
      await request('/dashboard/summary', { token: activeEmployee.accessToken });
    });

    await withStep('multi-tenant isolation on employees', async () => {
      const alphaAdmin = await login('admin@societe-a.test');
      const atlasAdmin = await login('admin@atlas-construction.test');

      const alphaEmployees = await request<EmployeeProfile[]>('/employees', { token: alphaAdmin.accessToken });
      const atlasEmployees = await request<EmployeeProfile[]>('/employees', { token: atlasAdmin.accessToken });

      assert.ok(alphaEmployees.length > 0, 'Alpha tenant should have demo employees');
      assert.ok(atlasEmployees.length > 0, 'Atlas tenant should have demo employees');
      assert.ok(
        alphaEmployees.every((employee) => employee.tenantId === alphaAdmin.user.tenantId),
        'Alpha admin received employee data outside its tenant',
      );
      assert.ok(
        atlasEmployees.every((employee) => employee.tenantId === atlasAdmin.user.tenantId),
        'Atlas admin received employee data outside its tenant',
      );

      const atlasEmployee = atlasEmployees[0]!;
      await request(`/employees/${atlasEmployee.id}`, {
        token: alphaAdmin.accessToken,
        expected: 404,
      });
    });

    await withStep('role escalation and employee dashboard scope', async () => {
      const admin = await login('admin@societe-a.test');
      const employee = await login('employee@societe-a.test');

      await request('/users', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          email: `blocked.super.${runOffsetDays}@societe-a.test`,
          password: PASSWORD,
          firstName: 'Blocked',
          lastName: 'Super',
          role: 'SUPER_ADMIN',
        },
        expected: 403,
      });

      const summary = await request<DashboardSummary>('/dashboard/summary', { token: employee.accessToken });
      assert.equal(summary.counters.activeEmployees, 1, 'Employee dashboard should be scoped to the employee only');
    });

    await withStep('conges create submit approve', async () => {
      const employee = await login('employee@societe-a.test');
      const admin = await login('admin@societe-a.test');
      const leaveTypes = await request<LeaveType[]>('/leave/types', { token: employee.accessToken });
      assert.ok(leaveTypes.length > 0, 'No demo leave type available');

      const start = nextMonday(runOffsetDays + 60);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 1);

      const created = await request<LeaveRequest>('/leave/requests', {
        method: 'POST',
        token: employee.accessToken,
        body: {
          leaveTypeId: leaveTypes[0].id,
          startDate: dateOnly(start),
          endDate: dateOnly(end),
          comment: 'API critical test',
        },
      });
      const submitted = await request<LeaveRequest>(`/leave/requests/${created.id}/submit`, {
        method: 'POST',
        token: employee.accessToken,
      });
      assert.equal(submitted.status, 'SUBMITTED');
      const approved = await request<LeaveRequest>(`/leave/requests/${created.id}/approve`, {
        method: 'POST',
        token: admin.accessToken,
      });
      assert.equal(approved.status, 'APPROVED');
      await request(`/leave/requests/${created.id}/cancel`, {
        method: 'POST',
        token: employee.accessToken,
        expected: 400,
      });
    });

    await withStep('pointage check-in check-out submit approve', async () => {
      const employee = await login('employee@societe-a.test');
      const admin = await login('admin@societe-a.test');
      await request('/attendance/check-out', {
        method: 'POST',
        token: employee.accessToken,
        body: { employeeComment: 'Close stale punch before critical test' },
        expected: 400,
      }).catch(() => undefined);

      const checkedIn = await request<AttendancePunch>('/attendance/check-in', {
        method: 'POST',
        token: employee.accessToken,
        body: { workLocation: 'OFFICE', employeeComment: 'API critical test check-in' },
      });
      assert.ok(checkedIn.id);

      const checkedOut = await request<AttendancePunch>('/attendance/check-out', {
        method: 'POST',
        token: employee.accessToken,
        body: { employeeComment: 'API critical test check-out' },
      });
      assert.equal(checkedOut.id, checkedIn.id);

      const submitted = await request<AttendancePunch>(`/attendance/${checkedIn.id}/submit`, {
        method: 'POST',
        token: employee.accessToken,
      });
      assert.equal(submitted.status, 'SUBMITTED');

      const approved = await request<AttendancePunch>(`/attendance/${checkedIn.id}/approve`, {
        method: 'POST',
        token: admin.accessToken,
      });
      assert.equal(approved.status, 'APPROVED');
      await request(`/attendance/${checkedIn.id}/submit`, {
        method: 'POST',
        token: employee.accessToken,
        expected: 400,
      });
    });

    await withStep('timesheets create update submit approve', async () => {
      const employee = await login('employee@societe-a.test');
      const admin = await login('admin@societe-a.test');
      const projectManager = await login('project.manager@societe-a.test');
      const manager = await login('manager@societe-a.test');
      const sites = await request<Site[]>('/sites', { token: admin.accessToken });
      assert.ok(sites.length > 0, 'No demo site available for timesheet validation');
      const project = await request<Project>('/projects', {
        method: 'POST',
        token: admin.accessToken,
        body: {
          code: `API-N2-${runOffsetDays}`,
          name: 'API critical N+2 project',
          projectManagerId: projectManager.user.id,
        },
      });
      await request<Site>(`/sites/${sites[0]!.id}`, {
        method: 'PUT',
        token: admin.accessToken,
        body: { projectId: project.id },
      });
      const employeeProjects = await request<Project[]>('/projects', { token: employee.accessToken });
      const employeeSites = await request<Site[]>('/sites', { token: employee.accessToken });
      assert.ok(employeeProjects.length > 0, 'Employee should see assigned projects in timesheet dropdown');
      assert.ok(employeeSites.length > 0, 'Employee should see assigned sites in timesheet dropdown');
      const start = nextMonday(runOffsetDays + 90);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);

      const created = await request<Timesheet>('/timesheets', {
        method: 'POST',
        token: employee.accessToken,
        body: {
          periodStart: dateOnly(start),
          periodEnd: dateOnly(end),
        },
      });
      assert.ok(created.id);

      await request<Timesheet>(`/timesheets/${created.id}`, {
        method: 'PUT',
        token: employee.accessToken,
        body: {
          lines: [
            {
              siteId: sites[0]!.id,
              taskName: 'API critical test',
              billingType: 'BILLABLE',
              workLocation: 'OFFICE',
              entries: [
                {
                  entryDate: dateOnly(start),
                  hours: 1,
                  comment: 'API critical test',
                },
              ],
            },
          ],
        },
      });

      const submitted = await request<Timesheet>(`/timesheets/${created.id}/submit`, {
        method: 'POST',
        token: employee.accessToken,
      });
      assert.equal(submitted.status, 'SUBMITTED');

      const managerTimesheets = await request<Timesheet[]>('/timesheets', {
        token: manager.accessToken,
      });
      assert.ok(
        managerTimesheets.some((timesheet) => timesheet.id === created.id),
        'Manager should see all tenant timesheets awaiting validation',
      );

      const approved = await request<Timesheet>(`/timesheets/${created.id}/approve`, {
        method: 'POST',
        token: manager.accessToken,
      });
      assert.equal(approved.status, 'N1_APPROVED');

      const finalApproved = await request<Timesheet>(`/timesheets/${created.id}/approve`, {
        method: 'POST',
        token: projectManager.accessToken,
      });
      assert.equal(finalApproved.status, 'APPROVED');
      await request(`/timesheets/${created.id}/submit`, {
        method: 'POST',
        token: employee.accessToken,
        expected: 400,
      });
    });
  } finally {
    await reactivateAlpha(superAdmin.accessToken, alpha.id);
  }

  process.stdout.write('API critical tests passed\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCriticalApiTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
