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

const runOffsetDays = 420 + ((Math.floor(Date.now() / 1000) % 50_000) * 7);

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

  const payload = (await response.json()) as ApiEnvelope<T>;
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

  process.stdout.write('API critical tests passed\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCriticalApiTests().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
