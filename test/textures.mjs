// Board texture start-up checks: node test/textures.mjs [--port=5360] [--base=url]
// Phone (touch, 390x844): textures are 512 px, the first load makes them in Workers and fills the IndexedDB cache, the second
// load is a cache hit (no Worker started), and the loading progress moves in steps while they are made. Desktop: 1024 px, Workers, no cache.
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5360').slice(7));
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
const R = reporter();
const OUT = '.tmp/textures-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const browser = await launchBrowser({ w: 390, h: 844 });
const url = (q) => `${BASE || `http://127.0.0.1:${PORT}`}/?manual=1&ai=0&${q}`;
const idbCount = () => new Promise((res) => { const rq = indexedDB.open('chess3d-textures', 1); rq.onerror = () => res(0); rq.onupgradeneeded = () => { rq.result.close(); res(0); }; rq.onsuccess = () => { try { const c = rq.result.transaction('maps').objectStore('maps').count(); c.onsuccess = () => res(c.result); c.onerror = () => res(0); } catch (e) { res(0); } }; });
try {
  const load = async (page, q) => {
    if (q.includes('touch=1')) await page.evaluateOnNewDocument(() => { for (const [k, v] of [['width', 390], ['height', 844]]) Object.defineProperty(screen, k, { get: () => v }); });   // device.phone reads screen, not the viewport
    await page.evaluateOnNewDocument(() => {
      window.__workers = 0;
      const W = window.Worker; window.Worker = function (...a) { window.__workers++; return new W(...a); };
    });
    await page.goto(url(q), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('document.body.classList.contains("ready")', { timeout: 300000, polling: 200 });
    return page.evaluate(() => {
      let size = 0; window.__chess.gimbal.traverse((o) => { const m = o.material; if (m && m.name === 'marble-white') size = m.map.image.width; });
      return { size, workers: window.__workers, bar: [...new Set(window.__chessProgress)].filter((x) => x >= 30 && x <= 40) };
    });
  };
  // phone, first visit
  let page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });
  let w = await watchPage(page);
  let r = await load(page, 'quality=medium&touch=1');
  R.expect('phone: textures are 512 px', r.size === 512, `${r.size}`);
  R.expect('phone, first load: Workers made them', r.workers > 0, `${r.workers} workers`);
  R.expect('phone, first load: the progress moves while they are made', r.bar.length >= 4, `bar values 30..40: ${r.bar.join(',')}`);
  R.expect('phone, first load: the cache holds all six', (await page.evaluate(idbCount)) === 6, 'six entries');
  R.expect('phone: no console error or foreign request', !w.errs.length && !w.foreign.length, '', [...w.errs, ...w.foreign].join(' | '));
  await page.close();
  // phone, second visit (same profile): cache hit
  page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, hasTouch: true });
  w = await watchPage(page);
  r = await load(page, 'quality=medium&touch=1');
  R.expect('phone, second load: cache hit, no Worker started', r.workers === 0 && r.size === 512, `${r.workers} workers, ${r.size} px`);
  await page.close();
  // desktop: 1024, Workers, nothing cached
  const b2 = await launchBrowser({ w: 1280, h: 720 });
  try {
    page = await b2.newPage();
    w = await watchPage(page);
    r = await load(page, 'quality=high');
    R.expect('desktop: textures are 1024 px, made in Workers', r.size === 1024 && r.workers > 0, `${r.size} px, ${r.workers} workers`);
    R.expect('desktop: nothing is cached', (await page.evaluate(idbCount)) === 0, 'cache empty');
    R.expect('desktop: no console error or foreign request', !w.errs.length && !w.foreign.length, '', [...w.errs, ...w.foreign].join(' | '));
  } finally { await b2.close(); }
} catch (e) { R.fail('textures run', 'threw: ' + String(e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.stop(); }
const { nf } = R.summary();
console.log(nf ? 'TEXTURES FAILED' : 'TEXTURES OK');
process.exit(nf ? 1 : 0);
