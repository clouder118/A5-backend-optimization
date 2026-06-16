import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const browserPath = path.join(workspaceRoot, '.cache', 'ms-playwright');
const outputDir = path.join(projectRoot, 'test-results', 'visitor-flow');
const baseUrl = process.env.VISITOR_VERIFY_URL || 'http://127.0.0.1:5176';

const routes = [
  { path: '/', title: '灵山胜境景点导览', shot: '01-home-desktop.png' },
  { path: '/spots', title: '灵山胜境景点', shot: '02-spots-desktop.png' },
  { path: '/spots/yuanxiang-hall', title: '远香堂', shot: '03-spot-detail-desktop.png' },
  { path: '/routes', title: '个性化路线推荐', shot: '04-routes-desktop.png' },
  { path: '/guide', title: '灵山胜境 AI 导游', shot: '05-guide-desktop.png' },
];

async function isServerReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let i = 0; i < 30; i += 1) {
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

  const child = spawn('npm.cmd run dev -- --port 5176', {
    cwd: projectRoot,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: browserPath,
      VITE_USE_MOCK_API: 'true',
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

async function main() {
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
  const { chromium } = await import('@playwright/test');
  await mkdir(outputDir, { recursive: true });

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    const routeResults = [];

    for (const route of routes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
      const body = await page.locator('body').innerText();
      failIf(!body.includes(route.title), `Missing expected text on ${route.path}: ${route.title}`);
      failIf((await page.locator('main').count()) < 1, `Missing main content on ${route.path}`);
      if (route.path === '/') {
        await page.getByRole('button', { name: /管理后台/ }).waitFor({ timeout: 5000 });
      }
      await page.screenshot({ path: path.join(outputDir, route.shot), fullPage: true });
      routeResults.push({ path: route.path, ok: true, screenshot: route.shot });
    }

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.locator('a[href="/guide"]').first().click();
    await page.waitForURL('**/guide');
    await page.locator('.chat-input-row textarea, .chat-input-row input').first().fill('远香堂有什么历史故事？');
    await page.locator('.chat-input-row button.ant-btn-primary').click();
    await page.locator('.source-card').first().waitFor({ timeout: 5000 });
    failIf((await page.locator('.chat-bubble.assistant').count()) < 2, 'AI guide answer was not rendered');
    failIf((await page.locator('.source-card').count()) < 1, 'AI guide source card was not rendered');
    await page.screenshot({ path: path.join(outputDir, '06-guide-chat-result-desktop.png'), fullPage: true });

    await page.locator('.chat-input-row textarea, .chat-input-row input').first().fill('模拟失败');
    await page.locator('.chat-input-row button.ant-btn-primary').click();
    await page.getByText('兜底回答').last().waitFor({ timeout: 5000 });
    await page.getByText('AI 服务暂时不可用，已为你保留基础游览建议。').waitFor({ timeout: 5000 });
    await page.screenshot({ path: path.join(outputDir, '07-guide-fallback-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outputDir, '08-home-mobile.png'), fullPage: true });
    await page.goto(`${baseUrl}/guide`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outputDir, '09-guide-mobile.png'), fullPage: true });

    failIf(consoleErrors.length > 0, `Browser console errors:\n${consoleErrors.join('\n')}`);
    failIf(pageErrors.length > 0, `Browser page errors:\n${pageErrors.join('\n')}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          browserPath,
          outputDir,
          checkedRoutes: routeResults,
          chatFlow: 'ok',
          screenshots: [
            ...routes.map((route) => route.shot),
            '06-guide-chat-result-desktop.png',
            '07-guide-fallback-desktop.png',
            '08-home-mobile.png',
            '09-guide-mobile.png',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    if (server) {
      server.kill();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
