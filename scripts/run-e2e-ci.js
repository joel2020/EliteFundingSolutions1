const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const bin = path.join(root, 'node_modules', '.bin');
const nextBin = path.join(bin, isWindows ? 'next.cmd' : 'next');
const playwrightBin = path.join(bin, isWindows ? 'playwright.cmd' : 'playwright');
const baseUrl = 'http://127.0.0.1:3000';

function waitForServer(url, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(attempt, 500);
      });
      request.setTimeout(3000, () => request.destroy());
    };
    attempt();
  });
}

function stopServer(server) {
  if (!server.pid || server.killed) return Promise.resolve();
  if (isWindows) {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
    });
  }
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    try {
      server.kill('SIGTERM');
    } catch {}
  }
  return Promise.resolve();
}

function spawnCommand(command, args, options) {
  if (!isWindows) return spawn(command, args, options);
  const quoted = [`"${command}"`, ...args].join(' ');
  return spawn(quoted, [], { ...options, shell: true });
}

function runTests() {
  return new Promise((resolve) => {
    const testProcess = spawnCommand(playwrightBin, ['test', '--reporter=line'], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, PLAYWRIGHT_SKIP_WEB_SERVER: '1' },
    });
    testProcess.on('close', (code) => resolve(code || 0));
    testProcess.on('error', () => resolve(1));
  });
}

(async () => {
  const server = spawnCommand(nextBin, ['start'], {
    cwd: root,
    stdio: 'inherit',
    detached: !isWindows,
    env: { ...process.env, E2E_AUTH_BYPASS: '1' },
  });

  const shutdown = async () => {
    await stopServer(server);
  };
  process.on('SIGINT', async () => {
    await shutdown();
    process.exit(130);
  });
  process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(143);
  });

  let exitCode = 1;
  try {
    await waitForServer(baseUrl);
    exitCode = await runTests();
  } catch (error) {
    console.error(error);
  } finally {
    await shutdown();
  }
  process.exit(exitCode);
})();
