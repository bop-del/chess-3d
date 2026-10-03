// Load time A/B: node tools/measure-load.mjs --a=<dist dir> --b=<dist dir> [--q=quality=high&intro=0] [--browsers=3] [--warm=3] [--port=5246]
// Serves two built dist folders in turn and measures navigation start to body.ready (the board is built) plus the 'textures'
// performance measure. Per variant and browser: one cold run (fresh profile) then --warm warm runs. Variants alternate so a
// drifting machine load hits both. One Chrome at a time through launchBrowser(). Prints a table of medians and spreads.
import { launchBrowser, sleep } from './_lib.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { loadavg } from 'node:os';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const Q = args.q || 'quality=high&intro=0';
const BROWSERS = Number(args.browsers || 3), WARM = Number(args.warm || 3), PORT = Number(args.port || 5246);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const f = (x) => (x / 1000).toFixed(2);
async function run(server, browser) {
  const page = await browser.newPage();
  try {
    await page.evaluateOnNewDocument(() => {
      const t = setInterval(() => { if (document.body && document.body.classList.contains('ready')) { window.__readyAt = performance.now(); clearInterval(t); } }, 10);
    });
    await page.goto(`${server.base}?manual=0&ai=0&${Q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction('window.__readyAt', { timeout: 300000, polling: 100 });
    return await page.evaluate(() => {
      const m = performance.getEntriesByName('textures')[0];
      const seen = new Set(); let bytes = 0, size = 0;
      window.__chess.gimbal.traverse((o) => { for (const mat of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) { const t = mat[k]; if (t && t.image && t.image.width >= 256 && !seen.has(t)) { seen.add(t); bytes += t.image.width * t.image.height * 4 * 1.33; size = Math.max(size, t.image.width); } } });
      return { ready: window.__readyAt, tex: m ? m.duration : NaN, mb: bytes / 1048576, size };
    });
  } finally { await page.close(); }
}
const res = { a: { cold: [], warm: [], texC: [], texW: [] }, b: { cold: [], warm: [], texC: [], texW: [] } };
const info = {};
// one static server on one port: /a/ and /b/ are the two dist folders (a vite preview per variant would need two ports)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const http = createServer((req, res) => {
  const [, v, ...rest] = new URL(req.url, 'http://x').pathname.split('/');
  const root = args[v] && resolve(args[v]);
  let file = root && join(root, rest.join('/') || 'index.html');
  if (file && !file.startsWith(root + '/')) file = null;
  if (file && !existsSync(file)) file = join(root, 'index.html');
  if (!file || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((ok) => http.listen(PORT, '127.0.0.1', ok));
const servers = { a: { base: `http://127.0.0.1:${PORT}/a/`, stop() {} }, b: { base: `http://127.0.0.1:${PORT}/b/`, stop() {} } };
console.log(`load before: ${loadavg()[0].toFixed(1)}`);
for (let i = 0; i < BROWSERS; i++) for (const v of i % 2 ? ['b', 'a'] : ['a', 'b']) {
  const browser = await launchBrowser({ w: 1440, h: 900 });
  try {
    for (let r = 0; r <= WARM; r++) {
      const x = await run(servers[v], browser);
      res[v][r ? 'warm' : 'cold'].push(x.ready); res[v][r ? 'texW' : 'texC'].push(x.tex); info[v] = x;
      console.log(`${v} browser ${i + 1} ${r ? 'warm' : 'cold'}: ready ${f(x.ready)} s, textures ${f(x.tex)} s, ${x.size} px, ${x.mb.toFixed(0)} MB, load ${loadavg()[0].toFixed(1)}`);
    }
  } finally { await browser.close(); await sleep(500); }
}
const line = (n, v) => `| ${n} | ${info[v].size} | ${info[v].mb.toFixed(0)} | ${f(med(res[v].cold))} (${f(Math.min(...res[v].cold))} to ${f(Math.max(...res[v].cold))}) | ${f(med(res[v].warm))} (${f(Math.min(...res[v].warm))} to ${f(Math.max(...res[v].warm))}) | ${f(med(res[v].texC))} | ${f(med(res[v].texW))} |`;
console.log('\n| variant | max px | texture MB | cold ready s median (range) | warm ready s median (range) | prepareTextures cold s | warm s |\n|---|---|---|---|---|---|---|');
console.log(line('A', 'a')); console.log(line('B', 'b'));
http.close();
console.log(`growth B minus A: cold ${f(med(res.b.cold) - med(res.a.cold))} s, warm ${f(med(res.b.warm) - med(res.a.warm))} s; load after ${loadavg()[0].toFixed(1)}`);
