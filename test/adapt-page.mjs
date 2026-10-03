// The adaptive quality governor in the real page (smoke tier): node test/adapt-page.mjs [--port=5245] [--skip-build] [--base=<server>] [--shots=<dir>]
// Phone 390x844 with touch (Medium start), no manual flag, intro=0, ai=0, German. The test feeds frame times through
// window.__chess.adapt.feed: 200 frames of 45 ms drop Medium to Low and show the toast once (German text), 400 frames of 12 ms lock without
// a step and without a toast, a quality choice in the HUD locks it, ?adapt=0, ?manual=1, an explicit ?quality= and desktop without
// ?adapt=1 ignore the feed; ?adapt=1 on desktop (High start) steps down to Medium. The toast is photographed (--shots).
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { mkdirSync } from 'node:fs';
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5245)), OUT = '.tmp/adapt-dist', BASE = opt('base', '').replace(/\/$/, ''), SHOTS = opt('shots', '.tmp/adapt');
const R = reporter();
R.check = (n, ok, d = '') => R.expect(n, ok, '', d);
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nadapt: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'ADAPT FAILED' : 'ADAPT OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });
try {
  if (BASE) server = { base: BASE + '/', stop() {} };
  else {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  browser = await launchBrowser({ w: 390, h: 844 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}
mkdirSync(SHOTS, { recursive: true });

let page = null;
const watchers = [];
async function load(query, { phone = true, lang = 'de' } = {}) {
  if (page) await page.close();
  page = await browser.newPage();
  watchers.push(await watchPage(page));
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 720 });
  await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('chess3d.lang', l); } catch (e) { /* ignore */ } }, lang);
  await page.goto(`${server.base}?intro=0&ai=0${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess?.adapt', { timeout: 90000 });
}
const state = () => page.evaluate(() => ({ ...window.__chess.adapt.state(), quality: window.__chess.stage.quality }));
// real frames also feed the adapter; wait for the warm up to be over so the fed frames are measured at once
const settled = () => page.waitForFunction('!window.__chess.adapt.state().holding', { timeout: 20000, polling: 100 });
// feeds in one synchronous call (no real frame can interleave) and counts how often the toast was shown
const feed = (ms, n) => page.evaluate((m, c) => {
  const toast = document.getElementById('toast');
  let shows = 0, text = '';
  const mo = new MutationObserver(() => { if (toast.classList.contains('show')) { shows++; text = toast.textContent; } });
  mo.observe(toast, { attributes: true, attributeFilter: ['class'] });
  for (let i = 0; i < c; i++) window.__chess.adapt.feed(m);
  return new Promise((res) => setTimeout(() => { mo.disconnect(); res({ shows, text, now: toast.classList.contains('show') }); }, 300));
}, ms, n);

try {
  // ---- phone, touch: slow frames step Medium down to Low, one toast
  await load('');
  let s = await state();
  R.check('touch device starts on Medium with the adapter running', s.quality === 'medium' && !s.locked && s.armed, JSON.stringify(s));
  await settled();
  const slow = await feed(45, 200);
  s = await state();
  R.check('200 frames of 45 ms: Medium drops to Low, locked at the last level', s.quality === 'low' && s.steps === 1 && s.locked, JSON.stringify(s));
  R.check('the chip follows (the quality select shows Niedrig)', await page.evaluate(() => document.getElementById('sel-quality').value) === 'low');
  R.check('one toast, in German, naming the level', slow.shows === 1 && slow.text === 'Grafik auf Niedrig gestellt, damit alles flüssig läuft', JSON.stringify(slow));
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `${SHOTS}/toast-390x844.png` });
  const box = await page.evaluate(() => { const r = document.getElementById('toast').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth }; });
  R.check('the toast fits the 390 px screen', box.l >= 0 && box.r <= box.w, JSON.stringify(box));
  await feed(45, 400);
  R.check('after the lock nothing steps again (still Low, one step)', (await state()).steps === 1);

  // ---- healthy frames lock without a step
  await load('');
  await settled();
  const fine = await feed(12, 400);
  s = await state();
  R.check('400 frames of 12 ms: locked as stable, still Medium, no toast', s.locked && s.why === 'stable' && s.steps === 0 && s.quality === 'medium' && fine.shows === 0, JSON.stringify({ s, fine }));

  // ---- a quality choice in the HUD locks the adapter at once
  await load('');
  await settled();
  await page.evaluate(() => { const sel = document.getElementById('sel-quality'); sel.value = 'high'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  s = await state();
  R.check('choosing a quality locks the adapter (reason user), the choice stands', s.quality === 'high' && s.locked && s.why === 'user', JSON.stringify(s));
  await feed(45, 400);
  R.check('slow frames after a manual choice change nothing', (await state()).quality === 'high');

  // ---- switched off
  for (const [label, query, opts] of [
    ['?adapt=0 on touch', '&adapt=0', {}],
    ['explicit ?quality=high with ?adapt=1', '&quality=high&adapt=1', {}],
    ['?manual=1 with ?adapt=1', '&manual=1&adapt=1', {}],
    ['desktop without ?adapt=1', '', { phone: false }],
    ['desktop, explicit quality with ?adapt=1', '&quality=high&adapt=1', { phone: false }],
  ]) {
    await load(query, opts);
    const before = (await state()).quality;
    await feed(45, 400);
    s = await state();
    R.check(`${label}: feeding is ignored (locked off, quality stays ${before})`, s.locked && s.why === 'off' && s.steps === 0 && s.quality === before, JSON.stringify(s));
  }

  // ---- desktop, forced on: High steps to Medium after two windows, then the next pair of windows to Low
  await load('&adapt=1', { phone: false });
  s = await state();
  R.check('desktop ?adapt=1 starts on High with the adapter running', s.quality === 'high' && !s.locked, JSON.stringify(s));
  await settled();
  await feed(45, 100);
  R.check('first slow window steps High to Medium', (await state()).quality === 'medium');
  await page.waitForFunction('!window.__chess.adapt.state().holding', { timeout: 20000, polling: 100 });
  await feed(45, 100);
  s = await state();
  R.check('later slow window steps Medium to Low (second and last step), locked', s.quality === 'low' && s.steps === 2 && s.locked, JSON.stringify(s));

  R.check('no console or page errors, no foreign requests', watchers.every((w) => !w.errs.length && !w.foreign.length), watchers.flatMap((w) => [...w.errs, ...w.foreign]).slice(0, 3).join(' | '));
} catch (e) {
  R.fail('adapt page test', String(e && e.stack || e).slice(0, 400));
}
await finish();
