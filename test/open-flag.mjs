// The ?open=<id> flag (smoke tier): node test/open-flag.mjs [--port=5369] [--skip-build] [--base=<server>]
// ai=0, quality=low, manual=1, intro=0. Every value on desktop and on a phone in portrait and landscape: the target is on screen,
// not collapsed, and the right tab is selected. An unknown value changes nothing and prints nothing. open combines with view.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5369));
const OUT = '.tmp/open-flag-dist';
const BASE = opt('base', '').replace(/\/$/, '');
const R = reporter();
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nopen: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'OPEN FAILED' : 'OPEN OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

try {
  if (BASE) server = { base: BASE + '/', stop() {} };
  else {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  browser = await launchBrowser({ w: 1280, h: 720 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

// what each value must show: a selector that is visible and, for a Learn value, the selected tab
const CASES = [
  ['learn', { tab: 'openings', see: '.xtab[aria-selected="true"]' }],
  ['openings', { tab: 'openings', see: '.xtab[aria-selected="true"]' }],
  ['mine', { tab: 'mine', see: '.xtab[aria-selected="true"]' }],
  ['drill', { tab: 'practise', see: '.xtab[aria-selected="true"]' }],
  ['practise', { tab: 'practise', see: '.xtab[aria-selected="true"]' }],
  ['puzzles', { tab: 'puzzles', see: '.xtab[aria-selected="true"]' }],
  ['settings', { see: '.card[data-card="scene"] .body' }],
  ['music', { see: '.music-settings [data-music-on]' }],
  ['scene', { see: '.card[data-card="scene"] .body' }],
  ['moves', { see: '.card[data-card="moves"] .body' }],
];
const SIZES = [['desktop', 1280, 720, false], ['phone portrait', 390, 844, true], ['phone landscape', 844, 390, true]];

// seeded: one adopted opening, so the Practise tab is not locked
const SEED = JSON.stringify({ version: 1, ever: true, adopted: ['italian-game'], cards: {} });

async function load(page, [, w, h, phone], query) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.goto(`${server.base}?quality=low&manual=1&ai=0&intro=0${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await page.evaluate(() => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await new Promise((r) => setTimeout(r, 700));   // the sheet slide (0.3 s of CSS, real time even with manual=1)
}

// the element exists, has a size, is on screen and no ancestor card is collapsed or sheet closed
const shown = (page, sel) => page.evaluate((sel) => {
  const e = document.querySelector(sel);
  if (!e) return 'missing';
  const r = e.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return `no size ${r.width}x${r.height}`;
  const st = getComputedStyle(e);
  if (st.visibility === 'hidden' || st.display === 'none') return 'hidden';
  const sheet = e.closest('.psheet');
  if (sheet && !sheet.classList.contains('open')) return 'sheet closed';
  const fully = r.top >= -1 && r.left >= -1 && r.left < innerWidth && r.top < innerHeight;
  return fully ? 'ok' : `off screen at ${Math.round(r.left)},${Math.round(r.top)}`;
}, sel);

try {
  const seen = { errs: [], foreign: [] };   // over all sizes
  for (const size of SIZES) {
    // a fresh page per size: device.phone reads the screen, which the page gets from the viewport it is created with
    const page = await browser.newPage();
    const watch = await watchPage(page, ['127.0.0.1', 'localhost']);
    await page.setViewport({ width: size[1], height: size[2], deviceScaleFactor: 1, isMobile: size[3], hasTouch: size[3] });
    await page.evaluateOnNewDocument((seed, w, h, phone) => {
      try { if (!localStorage.getItem('chess3d.train')) localStorage.setItem('chess3d.train', seed); } catch (e) { /* ignore */ }
      if (phone) for (const [k, v] of [['width', w], ['height', h]]) Object.defineProperty(screen, k, { get: () => v });
    }, SEED, size[1], size[2], size[3]);
    const phoneRun = size[3];
    for (const [id, want] of CASES) {
      if (phoneRun && size[0] === 'phone landscape' && ['learn', 'mine', 'drill'].includes(id)) continue;   // same code path as portrait: keep the group short
      await load(page, size, `&open=${id}`);
      const scope = phoneRun ? '.psheet.open ' : '';   // other panels keep hidden copies of cards and tabs: look only inside the open sheet
      const s = await shown(page, scope + want.see);
      const tab = want.tab ? await page.evaluate((q) => document.querySelector(q)?.dataset.tab, scope + '.xtab[aria-selected="true"]') : null;
      const ok = s === 'ok' && (!want.tab || tab === want.tab);
      R.expect(`${size[0]}: open=${id}`, ok, want.tab ? `tab ${tab}` : 'visible', `${s}${want.tab ? `, tab ${tab}` : ''}`);
    }
    // unknown values: nothing opens, no console output, and the page is the plain page
    for (const bad of ['nope', '', '__proto__', 'constructor', '<b>']) {
      watch.errs.length = 0; watch.warns.length = 0;
      let logs = 0;
      const on = () => { logs++; };
      page.on('console', on);
      await load(page, size, `&open=${encodeURIComponent(bad)}`);
      page.off('console', on);
      const open = await page.evaluate(() => !!document.querySelector('.psheet.open'));
      R.expect(`${size[0]}: open=${JSON.stringify(bad)} is ignored`, !open && !watch.errs.length && !watch.warns.length && logs === 0, 'nothing opened, silent', `sheet ${open}, errs ${watch.errs.join('|')}, warns ${watch.warns.join('|')}, console ${logs}`);
    }
    seen.errs.push(...watch.errs); seen.foreign.push(...watch.foreign);
    await page.close();
  }
  // combines with the other flags
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const watch = await watchPage(page, ['127.0.0.1', 'localhost']);
  await load(page, SIZES[0], '&view=tokens&open=puzzles');
  const combo = await page.evaluate(() => ({ view: window.__chess.views.current(), tab: document.querySelector('.xtab[aria-selected="true"]')?.dataset.tab }));
  R.expect('open=puzzles combines with view=tokens', combo.view === 'tokens' && combo.tab === 'puzzles', 'tokens + puzzles', JSON.stringify(combo));
  R.expect('no console error, no foreign request', !seen.errs.length && !watch.errs.length && !seen.foreign.length && !watch.foreign.length, 'clean', seen.errs.concat(watch.errs, seen.foreign, watch.foreign).join(' | '));
} catch (e) {
  R.fail('open flag run', String(e && e.stack || e).slice(0, 400));
}
await finish();
