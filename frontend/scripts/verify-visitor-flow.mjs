import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const workspaceBrowserPath = path.join(workspaceRoot, '.cache', 'ms-playwright');
const browserPath = existsSync(workspaceBrowserPath)
  ? workspaceBrowserPath
  : process.platform === 'darwin'
    ? path.join(homedir(), 'Library', 'Caches', 'ms-playwright')
    : workspaceBrowserPath;
const browserExecutable = process.env.VISITOR_BROWSER_EXECUTABLE;
const outputDir = path.join(projectRoot, 'test-results', 'visitor-flow');
const baseUrl = process.env.VISITOR_VERIFY_URL || 'http://127.0.0.1:5176';
const localNodeBin = path.join(workspaceRoot, '.tools', 'node', 'bin');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : path.join(localNodeBin, 'npm');

const routes = [
  { path: '/', title: '灵山胜境景点导览', shot: '01-home-desktop.png' },
  { path: '/spots', title: null, shot: '02-spots-desktop.png' },
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

  const child = spawn(npmCommand, ['run', 'dev', '--', '--port', '5176'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${localNodeBin}${path.delimiter}${process.env.PATH ?? ''}`,
      PLAYWRIGHT_BROWSERS_PATH: browserPath,
      VITE_USE_MOCK_API: 'true',
    },
    shell: false,
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
  const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
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
      if (route.title) {
        failIf(!body.includes(route.title), `Missing expected text on ${route.path}: ${route.title}`);
      }
      failIf((await page.locator('main').count()) < 1, `Missing main content on ${route.path}`);
      if (route.path === '/') {
        await page.getByRole('button', { name: /OPS/ }).waitFor({ timeout: 5000 });
      }
      if (route.path === '/spots') {
        const reel = page.getByTestId('spot-reel');
        await reel.waitFor({ timeout: 5000 });
        failIf((await page.getByTestId('spot-reel-card').count()) !== 5, 'Mock scenic spots were not rendered in the reel');
        failIf(
          !(await page.locator('.spot-reel__image').first().evaluate((image) => image.complete && image.naturalWidth > 0)),
          'The active scenic image did not load',
        );
        const cardWidth = await reel.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).getPropertyValue('--reel-card-width')),
        );
        failIf(cardWidth > 155 || cardWidth < 94, `Scenic reel card width is outside its 50% size range: ${cardWidth}`);

        const rotor = page.getByTestId('spot-reel-rotor');
        const activeCaption = page.getByTestId('spot-reel-active-name');
        await activeCaption.waitFor({ timeout: 5000 });
        const activeLabel = await page.locator('.spot-reel__card[aria-current="true"]').getAttribute('aria-label');
        const initialCaption = (await activeCaption.innerText()).trim();
        failIf(activeLabel !== `查看${initialCaption}详情`, 'The scenic reel caption does not match the active scenic spot');
        const initialAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        await page.waitForTimeout(700);
        const autoAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        failIf(initialAngle === autoAngle, 'The scenic reel did not advance automatically');

        await reel.focus();
        const activeBeforeKeyboard = await page.locator('.spot-reel__card[aria-current="true"]').getAttribute('href');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(520);
        const activeAfterKeyboard = await page.locator('.spot-reel__card[aria-current="true"]').getAttribute('href');
        failIf(activeBeforeKeyboard === activeAfterKeyboard, 'Arrow navigation did not select the next scenic spot');
        const labelAfterKeyboard = await page.locator('.spot-reel__card[aria-current="true"]').getAttribute('aria-label');
        const captionAfterKeyboard = (await activeCaption.innerText()).trim();
        failIf(labelAfterKeyboard !== `查看${captionAfterKeyboard}详情`, 'The scenic reel caption did not follow keyboard selection');

        await reel.hover();
        const angleBeforeWheel = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(240);
        const angleAfterWheel = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        failIf(angleBeforeWheel === angleAfterWheel, 'Mouse wheel did not rotate the scenic reel');

        await page.waitForTimeout(3000);
        const hoverCooldownAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        await page.waitForTimeout(800);
        const hoverResumeAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        failIf(hoverCooldownAngle === hoverResumeAngle, 'The scenic reel did not resume while the mouse remained over it');

        await reel.focus();
        const focusStartAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        await page.waitForTimeout(800);
        const focusResumeAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        failIf(focusStartAngle === focusResumeAngle, 'The scenic reel paused indefinitely while it retained keyboard focus');

        const reelBox = await reel.boundingBox();
        if (!reelBox) {
          throw new Error('The scenic reel does not have a draggable bounding box');
        }
        await page.mouse.move(reelBox.x + reelBox.width / 2, reelBox.y + reelBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(reelBox.x + reelBox.width / 2 + 72, reelBox.y + reelBox.height / 2, { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(3000);
        const dragCooldownAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        await page.waitForTimeout(800);
        const dragResumeAngle = await rotor.evaluate((element) => element.style.getPropertyValue('--reel-rotation'));
        failIf(dragCooldownAngle === dragResumeAngle, 'The scenic reel did not resume after dragging while the mouse remained over it');

        const activeCard = page.locator('.spot-reel__card[aria-current="true"]');
        const activeHref = await activeCard.getAttribute('href');
        await activeCard.click();
        await page.waitForURL(`**${activeHref}`);
        await page.goBack({ waitUntil: 'networkidle' });
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
    await page.goto(`${baseUrl}/spots`, { waitUntil: 'networkidle' });
    await page.getByTestId('spot-reel').waitFor({ timeout: 5000 });
    await page.screenshot({ path: path.join(outputDir, '10-spots-mobile.png'), fullPage: true });

    failIf(consoleErrors.length > 0, `Browser console errors:\n${consoleErrors.join('\n')}`);
    failIf(pageErrors.length > 0, `Browser page errors:\n${pageErrors.join('\n')}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          browserPath,
          browserExecutable: browserExecutable ?? 'Playwright bundled Chromium',
          outputDir,
          checkedRoutes: routeResults,
          chatFlow: 'ok',
          screenshots: [
            ...routes.map((route) => route.shot),
            '06-guide-chat-result-desktop.png',
            '07-guide-fallback-desktop.png',
            '08-home-mobile.png',
            '09-guide-mobile.png',
            '10-spots-mobile.png',
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
