import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const startBat = path.join(root, 'start-local.bat');
const stopBat = path.join(root, 'stop-local.bat');

const urls = [
  'http://127.0.0.1:8001/health',
  'http://127.0.0.1:5173/',
  'http://127.0.0.1:5174/',
];

const requiredLogs = [
  path.join(root, 'backend', 'backend-local-server-8001.log'),
  path.join(root, 'frontend', 'frontend-visitor-local-server-5173.log'),
  path.join(root, 'frontend', 'frontend-admin-local-server-5174.log'),
];

function run(file, args) {
  return new Promise((resolve) => {
    const command = file.endsWith('.bat') ? ['cmd.exe', ['/d', '/c', 'call', file, ...args]] : [file, args];
    execFile(command[0], command[1], { cwd: root, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code ?? 0, stdout, stderr });
    });
  });
}

async function waitUrl(url, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status >= 200 && response.status < 500) {
        return true;
      }
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  return false;
}

async function isPortListening(port) {
  const result = await run('netstat.exe', ['-ano']);
  return result.stdout.includes(`:${port}`) && result.stdout.includes('LISTENING');
}

async function stopAll() {
  await run(stopBat, ['nopause']);
}

async function main() {
  await stopAll();

  const start = spawn('cmd.exe', ['/d', '/c', 'call', startBat, 'nopause'], {
    cwd: root,
    shell: false,
    stdio: 'pipe',
    windowsHide: true,
  });
  const output = [];
  start.stdout.on('data', (chunk) => output.push(chunk.toString()));
  start.stderr.on('data', (chunk) => output.push(chunk.toString()));
  const exitCode = await new Promise((resolve) => start.on('exit', resolve));

  try {
    if (exitCode !== 0) {
      throw new Error(`start-local.bat failed with code ${exitCode}\n${output.join('')}`);
    }

    const readiness = await Promise.all(urls.map((url) => waitUrl(url, 30)));
    if (readiness.some((ready) => !ready)) {
      throw new Error(`Expected one-click start to serve all URLs: ${JSON.stringify({ urls, readiness })}`);
    }

    const missingLogs = requiredLogs.filter((filePath) => !existsSync(filePath));
    if (missingLogs.length > 0) {
      throw new Error(`Missing expected log files: ${missingLogs.join(', ')}`);
    }
  } finally {
    await stopAll();
  }

  const stillListening = [];
  for (const port of [8001, 5173, 5174]) {
    if (await isPortListening(port)) {
      stillListening.push(port);
    }
  }
  if (stillListening.length > 0) {
    throw new Error(`stop-local.bat did not clear ports: ${stillListening.join(', ')}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        urls,
        logs: requiredLogs,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
