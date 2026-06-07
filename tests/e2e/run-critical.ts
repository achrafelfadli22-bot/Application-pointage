import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api';
const WEB_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const apiPort = new URL(API_URL).port || '4000';
const rootDir = process.cwd();
const pnpmBin = join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'pnpm.CMD' : 'pnpm');
const playwrightBin = join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.CMD' : 'playwright');
const apiEntry = join(rootDir, 'apps', 'api', 'dist', 'main.js');

type ChildProcess = ReturnType<typeof spawn>;

async function urlAvailable(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitFor(name: string, url: string, childProcess?: ChildProcess, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (childProcess && childProcess.exitCode !== null) {
      throw new Error(`${name} process exited with ${childProcess.exitCode}`);
    }

    if (await urlAvailable(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${name} did not become ready on ${url}`);
}

function spawnCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const windows = process.platform === 'win32';
  return windows
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', command, ...args], {
        cwd: rootDir,
        env,
        stdio: 'inherit',
      })
    : spawn(command, args, {
        cwd: rootDir,
        env,
        stdio: 'inherit',
      });
}

function runChecked(command: string, args: string[], env: NodeJS.ProcessEnv = process.env, timeoutMs = 600_000) {
  const windows = process.platform === 'win32';
  const result = windows
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', command, ...args], {
        cwd: rootDir,
        env,
        stdio: 'inherit',
        timeout: timeoutMs,
      })
    : spawnSync(command, args, {
        cwd: rootDir,
        env,
        stdio: 'inherit',
        timeout: timeoutMs,
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    console.error(`${command} ${args.join(' ')} exited with ${result.status ?? 1}`);
    throw new Error(`${command} failed`);
  }
}

function stopProcess(childProcess: ChildProcess | null) {
  if (!childProcess?.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }

  childProcess.kill('SIGTERM');
}

async function main() {
  let apiProcess: ChildProcess | null = null;
  let webProcess: ChildProcess | null = null;

  try {
    if (!(await urlAvailable(`${API_URL}/health/live`))) {
      runChecked(pnpmBin, ['--filter', '@pointage360/api', 'run', 'build'], process.env, 120_000);
      if (!existsSync(apiEntry)) {
        throw new Error(`API build entry not found: ${apiEntry}`);
      }

      apiProcess = spawn(process.execPath, [apiEntry], {
        cwd: rootDir,
        env: { ...process.env, PORT: apiPort },
        stdio: 'inherit',
      });
      await waitFor('API', `${API_URL}/health/live`, apiProcess, 60_000);
    }

    if (!(await urlAvailable(WEB_URL))) {
      webProcess = spawnCommand(pnpmBin, ['--filter', '@pointage360/web', 'run', 'dev'], {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_URL,
      });
      try {
        await waitFor('web app', WEB_URL, webProcess);
      } catch (error) {
        if (!(await urlAvailable(WEB_URL))) {
          throw error;
        }

        stopProcess(webProcess);
        webProcess = null;
      }
    }

    runChecked(playwrightBin, ['test'], {
      ...process.env,
      API_URL,
      E2E_BASE_URL: WEB_URL,
      PLAYWRIGHT_SKIP_WEB_SERVER: 'true',
    });
  } finally {
    stopProcess(webProcess);
    stopProcess(apiProcess);
  }
}

void main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
