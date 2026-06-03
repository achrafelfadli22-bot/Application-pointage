import { expect, Page, test } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type Session = {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
};

type Tenant = {
  id: string;
  slug: string;
};

type LeaveType = {
  id: string;
};

type LeaveRequest = {
  id: string;
  status: string;
};

type AttendancePunch = {
  id: string;
  status: string;
};

const runOffsetDays = 180 + (Date.now() % 2000);
const sessionCache = new Map<string, Session>();

async function waitForApi() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health/live`);
      if (response.ok) {
        return;
      }
    } catch {
      // The runner may still be starting the API.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`API is unavailable on ${API_URL}`);
}

async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
  attempt = 0,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (response.status === 429 && attempt < 1) {
    const retryAfterSeconds = Number(response.headers.get('retry-after') ?? 60);
    await new Promise((resolve) => setTimeout(resolve, (retryAfterSeconds + 1) * 1000));
    return apiRequest<T>(path, options, attempt + 1);
  }

  expect(response.ok, `${options.method ?? 'GET'} ${path}: ${payload.error ?? response.status}`).toBeTruthy();
  return payload.data as T;
}

async function loginApi(email: string) {
  const cached = sessionCache.get(email);
  if (cached) {
    return cached;
  }

  const session = await apiRequest<Session>('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  sessionCache.set(email, session);
  return session;
}

async function loginUi(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /^mot de passe$/i }).fill(PASSWORD);
  await page.getByRole('button', { name: /connect/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
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

function displayDate(value: Date) {
  return dateOnly(value).split('-').reverse().join('/');
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rowPattern(parts: string[]) {
  return new RegExp(parts.map(escapeRegex).join('.*'));
}

async function ensureDemoTenantActive() {
  const superAdmin = await loginApi('superadmin@pointage360.test');
  const tenants = await apiRequest<Tenant[]>('/tenants', { token: superAdmin.accessToken });
  const alpha = tenants.find((tenant) => tenant.slug === 'societe-alpha-btp');
  expect(alpha, 'Demo tenant societe-alpha-btp not found').toBeTruthy();
  await apiRequest(`/tenants/${alpha!.id}/reactivate`, {
    method: 'PATCH',
    token: superAdmin.accessToken,
  });
}

test.beforeAll(async () => {
  await waitForApi();
});

test.beforeEach(async () => {
  await ensureDemoTenantActive();
});

test('login employee opens dashboard', async ({ page }) => {
  await loginUi(page, 'employee@societe-a.test');
  await expect(page.getByText(/pointage/i).first()).toBeVisible();
});

test('pointage flow is usable', async ({ page }) => {
  await loginUi(page, 'employee@societe-a.test');
  const employee = await loginApi('employee@societe-a.test');
  await apiRequest('/attendance/check-out', {
    method: 'POST',
    token: employee.accessToken,
    body: { employeeComment: 'E2E cleanup' },
  }).catch(() => undefined);

  const checkedIn = await apiRequest<AttendancePunch>('/attendance/check-in', {
    method: 'POST',
    token: employee.accessToken,
    body: { workLocation: 'OFFICE', employeeComment: 'E2E pointage check-in' },
  });
  const checkedOut = await apiRequest<AttendancePunch>('/attendance/check-out', {
    method: 'POST',
    token: employee.accessToken,
    body: { employeeComment: 'E2E pointage check-out' },
  });

  expect(checkedOut.id).toBe(checkedIn.id);
  await page.goto('/attendance');
  await expect(page.getByText(/Pointage enregistr/i).first()).toBeVisible();
});

test('employee can request leave', async ({ page }) => {
  await loginUi(page, 'employee@societe-a.test');
  await page.goto('/time-off/requests');

  const employee = await loginApi('employee@societe-a.test');
  const leaveTypes = await apiRequest<LeaveType[]>('/leave/types', { token: employee.accessToken });
  expect(leaveTypes.length).toBeGreaterThan(0);
  const start = nextMonday(runOffsetDays + 120);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  const leave = await apiRequest<LeaveRequest>('/leave/requests', {
    method: 'POST',
    token: employee.accessToken,
    body: {
      leaveTypeId: leaveTypes[0].id,
      startDate: dateOnly(start),
      endDate: dateOnly(end),
      comment: 'E2E demande conge',
    },
  });
  const submitted = await apiRequest<LeaveRequest>(`/leave/requests/${leave.id}/submit`, {
    method: 'POST',
    token: employee.accessToken,
  });

  expect(submitted.status).toBe('SUBMITTED');
  await page.reload();
  await expect(
    page.getByRole('row', { name: rowPattern([displayDate(start), displayDate(end), 'En attente']) }),
  ).toBeVisible();
});

test('manager validates a leave request', async ({ page }) => {
  const employee = await loginApi('employee@societe-a.test');
  const leaveTypes = await apiRequest<LeaveType[]>('/leave/types', { token: employee.accessToken });
  const start = nextMonday(runOffsetDays + 150);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  const leave = await apiRequest<LeaveRequest>('/leave/requests', {
    method: 'POST',
    token: employee.accessToken,
    body: {
      leaveTypeId: leaveTypes[0].id,
      startDate: dateOnly(start),
      endDate: dateOnly(end),
      comment: 'E2E validation manager',
    },
  });
  await apiRequest<LeaveRequest>(`/leave/requests/${leave.id}/submit`, {
    method: 'POST',
    token: employee.accessToken,
  });

  await loginUi(page, 'manager@societe-a.test');
  await page.goto('/time-off/requests');
  await page.getByRole('button', { name: /approuver/i }).first().click();
  await page.getByRole('button', { name: /^approuver$/i }).click();

  const manager = await loginApi('manager@societe-a.test');
  const requests = await apiRequest<LeaveRequest[]>('/leave/requests?status=APPROVED', {
    token: manager.accessToken,
  });
  expect(requests.some((request) => request.id === leave.id)).toBeTruthy();
});
