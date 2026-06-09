import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runCriticalApiTests } from './critical.test';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api';
const apiPort = new URL(API_URL).port || '4000';
const rootDir = process.cwd();
const pnpmBin = join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'pnpm.CMD' : 'pnpm');
const apiEntry = join(rootDir, 'backend', 'dist', 'main.js');

async function apiAvailable() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${API_URL}/health/live`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForApi() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await apiAvailable()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`API did not become ready on ${API_URL}`);
}

function runChecked(command: string, args: string[]) {
  const windows = process.platform === 'win32';
  const result = windows
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', command, ...args], {
        cwd: rootDir,
        env: process.env,
        stdio: 'inherit',
      })
    : spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    console.error(`${command} ${args.join(' ')} exited with ${result.status ?? 1}`);
    throw new Error(`${command} failed`);
  }
}

async function main() {
  let apiProcess: ReturnType<typeof spawn> | null = null;

  if (!(await apiAvailable())) {
    runChecked(pnpmBin, ['--filter', '@pointage360/api', 'run', 'build']);
    if (!existsSync(apiEntry)) {
      throw new Error(`API build entry not found: ${apiEntry}`);
    }

    apiProcess = spawn(process.execPath, [apiEntry], {
      cwd: rootDir,
      env: { ...process.env, PORT: apiPort },
      stdio: 'inherit',
    });

    await waitForApi();
  }

  try {
    await runCriticalApiTests();
  } finally {
    stopApiProcess(apiProcess);
  }
}

function stopApiProcess(apiProcess: ReturnType<typeof spawn> | null) {
  if (!apiProcess?.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(apiProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }

  apiProcess.kill('SIGTERM');
}

void main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
