// Headless screenshot + console check, for checking your work visually.
// Usage:
//   node tools/shot.mjs <url> <out.png> [waitMs] [scriptFile.js] [width] [height]
// scriptFile (optional) is run in the page after load, as the body of an
// async function: e.g. `SMD.go('hq'); await new Promise(r => setTimeout(r, 1000));`
// Prints console errors and warnings, and page errors.
import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';

const [url, out, waitMs = '2500', scriptFile, w = '1440', h = '900'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node tools/shot.mjs <url> <out.png> [waitMs] [scriptFile] [width] [height]');
  process.exit(2);
}
const exe = process.env.EK_CHROME || `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1200);
if (scriptFile) {
  const body = await readFile(scriptFile, 'utf8');
  try {
    const r = await page.evaluate(`(async () => { ${body} })()`);
    if (r !== undefined) console.log('script result:', typeof r === 'string' ? r : JSON.stringify(r));
  } catch (e) {
    logs.push(`[script] ${e.message}`);
  }
}
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
