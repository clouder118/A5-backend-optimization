import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopProcessTree } from './process-tree.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'test-results', 'visitor-auth-gating');
const baseUrl = process.env.VISITOR_VERIFY_URL || 'http://127.0.0.1:5177';

async function isServerReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    if (await isServerReady()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Vite server did not become ready at ${baseUrl}`);
}

async function ensureServer() {
  if (await isServerReady()) {
    return undefined;
  }

  const child = spawn('npm.cmd run dev:visitor -- --port 5177', {
    cwd: projectRoot,
    env: {
      ...process.env,
      VITE_USE_MOCK_API: 'true',
      VITE_API_BASE_URL: 'http://127.0.0.1:8001',
    },
    shell: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  await waitForServer();
  return child;
}

function failIf(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

async function headerText(page) {
  return page.locator('.visitor-header').innerText();
}

async function main() {
  const { chromium } = await import('@playwright/test');
  await mkdir(outputDir, { recursive: true });

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!text.includes('401 (Unauthorized)')) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.route('**/api/auth/me', async (route) => {
    const authorization = route.request().headers().authorization || '';
    if (authorization === 'Bearer valid-visitor-token') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', username: 'visitor_001', role: 'visitor' }),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: '登录状态无效', code: 'AUTH_TOKEN_INVALID', status: 401 }),
    });
  });

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    const guestHeader = await headerText(page);
    failIf(!guestHeader.includes('[ 首页 ]'), 'Guest header should show HOME');
    failIf(!guestHeader.includes('[ 登录 ]'), 'Guest header should show LOGIN');
    failIf(!guestHeader.includes('[ 注册 ]'), 'Guest header should show REGISTER');
    failIf(guestHeader.includes('[ 景点 ]'), 'Guest header should hide SPOTS');
    failIf(guestHeader.includes('[ 路线 ]'), 'Guest header should hide ROUTES');
    failIf(guestHeader.includes('[ 导游 ]'), 'Guest header should hide GUIDE');
    failIf(guestHeader.includes('[ OPS ]'), 'Guest header should hide OPS');
    failIf((await page.locator('a[href="/guide"], a[href="/spots"], a[href="/routes"]').count()) > 0, 'Guest HOME should not link to protected visitor functions');
    await page.screenshot({ path: path.join(outputDir, '01-guest-home.png'), fullPage: true });

    await page.goto(`${baseUrl}/guide`, { waitUntil: 'networkidle' });
    await page.waitForURL(`${baseUrl}/`);
    failIf(page.url() !== `${baseUrl}/`, 'Guest should be redirected from /guide to HOME');

    await page.evaluate(() => {
      localStorage.setItem('a5_visitor_token', 'valid-visitor-token');
    });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    const userHeader = await headerText(page);
    failIf(!userHeader.includes('[ 景点 ]'), 'Signed-in header should show SPOTS');
    failIf(!userHeader.includes('[ 路线 ]'), 'Signed-in header should show ROUTES');
    failIf(!userHeader.includes('[ 导游 ]'), 'Signed-in header should show GUIDE');
    failIf(!userHeader.includes('visitor_001'), 'Signed-in header should show username');
    failIf(!userHeader.includes('[ 退出 ]'), 'Signed-in header should show LOG OUT');
    failIf(userHeader.includes('[ OPS ]'), 'Signed-in visitor header should hide OPS');
    await page.goto(`${baseUrl}/guide`, { waitUntil: 'networkidle' });
    failIf(!page.url().endsWith('/guide'), 'Signed-in visitor should be able to open /guide');
    await page.screenshot({ path: path.join(outputDir, '02-signed-in-guide.png'), fullPage: true });

    await page.locator('.visitor-header').getByRole('button', { name: /\[ 退出 \]/ }).click();
    await page.waitForURL(`${baseUrl}/`);
    const afterLogoutHeader = await headerText(page);
    failIf(afterLogoutHeader.includes('[ 景点 ]'), 'LOG OUT should return to guest navigation');
    failIf(await page.evaluate(() => localStorage.getItem('a5_visitor_token') !== null), 'LOG OUT should clear visitor token');

    await page.evaluate(() => {
      localStorage.setItem('a5_visitor_token', 'invalid-visitor-token');
    });
    await page.goto(`${baseUrl}/spots`, { waitUntil: 'networkidle' });
    await page.waitForURL(`${baseUrl}/`);
    const invalidTokenHeader = await headerText(page);
    failIf(invalidTokenHeader.includes('[ SPOTS ]'), 'Invalid token should return to guest navigation');
    failIf(await page.evaluate(() => localStorage.getItem('a5_visitor_token') !== null), 'Invalid token should be cleared');

    failIf(consoleErrors.length > 0, `Browser console errors:\n${consoleErrors.join('\n')}`);
    failIf(pageErrors.length > 0, `Browser page errors:\n${pageErrors.join('\n')}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          outputDir,
          screenshots: ['01-guest-home.png', '02-signed-in-guide.png'],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    if (server) {
      stopProcessTree(server);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
