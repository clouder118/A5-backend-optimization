import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const browserPath = path.join(workspaceRoot, '.cache', 'ms-playwright');
const outputDir = path.join(projectRoot, 'test-results', 'haru-motions');
const baseUrl = process.env.HARU_VERIFY_URL || 'http://127.0.0.1:5173';
const motionLimit = Number.parseInt(process.env.HARU_MOTION_LIMIT ?? '27', 10);

process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;

const { chromium } = await import('@playwright/test');
let browser;

const hardTimeout = setTimeout(() => {
  console.error('[verify-haru-motions] timed out after 60s');
  process.exit(1);
}, 60_000);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.error(`[verify-haru-motions] received ${signal}, cleaning up`);
    process.exit(130);
  });
}

function failIf(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

async function isReady(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForReady(url) {
  for (let index = 0; index < 20; index += 1) {
    if (await isReady(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not become ready`);
}

await mkdir(outputDir, { recursive: true });
console.log(`[verify-haru-motions] using ${baseUrl}`);
await waitForReady(baseUrl);

browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 640, height: 760 } });
page.setDefaultTimeout(15_000);
const shots = [];

try {
  await page.goto(`${baseUrl}/guide`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  await page.waitForFunction(() => Boolean(window.__live2dGuideDebug), null, { timeout: 10000 });

  const motionCount = await page.evaluate(() => window.__live2dGuideDebug?.getMotionGroupSize('All') ?? 0);
  failIf(motionCount !== 27, `Expected 27 Haru motions, got ${motionCount}`);

  const captureCount = Math.min(motionCount, Number.isFinite(motionLimit) ? motionLimit : motionCount);
  const avatar = page.locator('.avatar-stage-shell');
  for (let index = 0; index < captureCount; index += 1) {
    console.log(`[verify-haru-motions] capture ${index + 1}/${captureCount}`);
    const played = await page.evaluate(
      (motionIndex) => window.__live2dGuideDebug?.previewMotion('All', motionIndex, 1800) ?? false,
      index,
    );
    failIf(!played, `Could not play Haru motion index ${index}`);
    await page.waitForTimeout(900);
    const fileName = `${String(index).padStart(2, '0')}-haru-motion-${index}.png`;
    await avatar.screenshot({ path: path.join(outputDir, fileName) });
    shots.push(fileName);
  }

  const html = `<!doctype html>
<meta charset="utf-8">
<title>Haru motion contact sheet</title>
<style>
  body { margin: 24px; font-family: system-ui, sans-serif; background: #f6f8f4; color: #1f2a2a; }
  h1 { margin: 0 0 16px; font-size: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
  figure { margin: 0; padding: 10px; background: white; border: 1px solid #d9e4d6; border-radius: 8px; }
  img { display: block; width: 100%; height: auto; border-radius: 6px; }
  figcaption { margin-top: 8px; font-size: 13px; font-weight: 600; }
</style>
<h1>Haru motion contact sheet</h1>
<div class="grid">
${shots
  .map(
    (fileName, index) =>
      `<figure><img src="./${fileName}" alt="Haru motion ${index}"><figcaption>${index}: ${fileName}</figcaption></figure>`,
  )
  .join('\n')}
</div>`;
  await writeFile(path.join(outputDir, 'contact-sheet.html'), html, 'utf-8');

  const result = {
    ok: true,
    baseUrl,
    outputDir,
    motionCount,
    captureCount,
    shots,
    contactSheet: 'contact-sheet.html',
  };
  await writeFile(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2), 'utf-8');
  console.log(JSON.stringify(result, null, 2));
} finally {
  clearTimeout(hardTimeout);
  if (browser) {
    await browser.close();
  }
}
