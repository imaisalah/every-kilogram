// Rebuilds the character GLBs in assets/models/characters/ from the Quaternius
// source packs (see docs/CREDITS.md, "Characters").
//
//   node assets/models/characters/build/run.mjs <extracted-packs-folder>
//
// The folder holds the unzipped "Universal Base Characters[Standard]" and
// "Universal Animation Library[Standard]" packs. A tiny static server serves
// the game folder plus the packs under /src/, headless Chromium runs
// build.html (three.js GLTFLoader -> trim -> GLTFExporter) and the GLBs it
// returns are written next to this folder. Needs tools/node_modules
// (playwright-core) and the Chromium that tools/shot.mjs uses.
import http from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../../../..');
const src = resolve(process.argv[2] || '');
const out = resolve(here, '..');
const { chromium } = await import(pathToFileURL(join(root, 'tools/node_modules/playwright-core/index.mjs')).href);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
const server = http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const base = path.startsWith('/src/') ? src : root;
    const file = normalize(join(base, path.startsWith('/src/') ? path.slice(5) : path));
    if (!file.startsWith(normalize(base))) throw new Error('outside');
    await stat(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch (e) {
    console.log('404', req.url);
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const exe = process.env.EK_CHROME || `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/assets/models/characters/build/build.html`);
await page.waitForFunction(() => window.buildDone, null, { timeout: 120000 });
const files = await page.evaluate(() => window.buildOut);
for (const [name, b64] of Object.entries(files || {})) {
  const buf = Buffer.from(b64, 'base64');
  await writeFile(join(out, name), buf);
  console.log(name, (buf.length / 1024).toFixed(0), 'KB');
}
await browser.close();
server.close();
