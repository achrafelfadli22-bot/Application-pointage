import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api';
const explicitWebUrl = Boolean(process.env.E2E_BASE_URL);
let webUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const apiPort = new URL(API_URL).port || '4000';
const apiProxyUrl = (() => {
  const parsed = new URL(API_URL);
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
})();
const rootDir = process.cwd();
const webDir = join(rootDir, 'frontend');
const pnpmBin = join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'pnpm.CMD' : 'pnpm');
const playwrightBin = join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.CMD' : 'playwright');
const nextBin = join(webDir, 'node_modules', '.bin', process.platform === 'win32' ? 'next.CMD' : 'next');
const apiEntry = join(rootDir, 'backend', 'dist', 'main.js');

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
    if (await urlAvailable(url)) {
      return;
    }

    if (childProcess && childProcess.exitCode !== null) {
      throw new Error(`${name} process exited with ${childProcess.exitCode}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${name} did not become ready on ${url}`);
}

async function portIsFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function resolveWebUrl() {
  if (explicitWebUrl && (await urlAvailable(webUrl))) {
    return webUrl;
  }

  const parsed = new URL(webUrl);
  const initialPort = Number(parsed.port || 3000);
  if (await portIsFree(initialPort)) {
    return webUrl;
  }

  for (let port = initialPort + 1; port <= initialPort + 20; port += 1) {
    if (await portIsFree(port)) {
      parsed.port = String(port);
      webUrl = parsed.toString().replace(/\/$/, '');
      return webUrl;
    }
  }

  throw new Error(`No free web port found near ${initialPort}`);
}

function spawnCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env, cwd = rootDir) {
  const windows = process.platform === 'win32';
  return windows
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', command, ...args], {
        cwd,
        env,
        stdio: 'inherit',
      })
    : spawn(command, args, {
        cwd,
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

    webUrl = await resolveWebUrl();
    if (!(await urlAvailable(webUrl))) {
      const webPort = new URL(webUrl).port || '3000';
      webProcess = spawnCommand(
        nextBin,
        ['dev', '--port', webPort],
        {
          ...process.env,
          API_PROXY_URL: apiProxyUrl,
          NEXT_PUBLIC_API_URL: '/api',
        },
        webDir,
      );
      try {
        await waitFor('web app', webUrl, webProcess);
      } catch (error) {
        if (!(await urlAvailable(webUrl))) {
          throw error;
        }

        stopProcess(webProcess);
        webProcess = null;
      }
    }

    runChecked(playwrightBin, ['test'], {
      ...process.env,
      API_URL,
      E2E_BASE_URL: webUrl,
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
