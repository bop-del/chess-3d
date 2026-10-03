// The ?open=<id> flag (smoke tier): node test/open-flag.mjs [--port=5369] [--skip-build] [--base=<server>]
// ai=0, quality=low, manual=1, intro=0. Every value on desktop and on a phone in portrait and landscape: the target is on screen,
// not collapsed, and the right tab is selected. An unknown value changes nothing and prints nothing. open combines with view.
// --part=i/n runs every n-th unit. Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5369));
const OUT = '.tmp/open-flag-dist';
const BASE = opt('base', '').replace(/\/$/, '');
const [PI, PN] = opt('part', '0/1').split('/').map(Number);   // --part=i/n runs every n-th unit (a size, the badge panel per size, the wins, the combination): separate browsers, see test/smoke-group-list.mjs
let unitNo = 0;
const mine = () => unitNo++ % PN === PI;
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
  ['clock', { see: '.clock-settings #sel-clock' }],
  ['daily', { see: '.dailycard' }],
  ['badges', { see: '.badges .bdgrid' }],
];
// desktop: the one right panel, so Settings and Moves are tabs, not cards
const DESKTOP_SEE = { settings: '#tp-settings #presets', scene: '#tp-settings #presets', moves: '#tp-play #moves', clock: '#tp-settings #sel-clock' };
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
    if (!mine()) continue;
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
      const s = await shown(page, phoneRun ? scope + want.see : (DESKTOP_SEE[id] || want.see));
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
  // the badge panel: ?open=badges shows the whole grid at both sizes, and a seeded badge gives one toast, once
  for (const size of [SIZES[0], SIZES[1]]) {
    if (!mine()) continue;
    const bp = await browser.newPage();
    const bw = await watchPage(bp, ['127.0.0.1', 'localhost']);
    await bp.setViewport({ width: size[1], height: size[2], deviceScaleFactor: 1, isMobile: size[3], hasTouch: size[3] });
    // a clean slate on every load: no badges, no opening in My openings (the earlier pages of this run share the storage)
    await bp.evaluateOnNewDocument((w, h, phone) => {
      try { localStorage.removeItem('chess3d.badges'); localStorage.removeItem('chess3d.train'); localStorage.removeItem('chess3d.puzzles'); localStorage.removeItem('chess3d.daily'); } catch (e) { /* ignore */ }
      if (phone) for (const [k, v] of [['width', w], ['height', h]]) Object.defineProperty(screen, k, { get: () => v });
    }, size[1], size[2], size[3]);
    for (const variant of ['a', 'b', 'c']) {
      await load(bp, size, `&open=badges&variant=${variant}`);
      const g = await bp.evaluate(() => {
        const root = document.querySelector('.badges');
        const cells = [...document.querySelectorAll('.badges .bdg')];
        const art = cells.map((c) => c.querySelector('.bd').getBoundingClientRect());
        const within = cells.every((c) => { const r = c.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; });
        return { variant: root && root.dataset.variant, cells: cells.length, locked: cells.filter((c) => c.dataset.earned === 'false').length, fams: document.querySelectorAll('.badges .bdfam').length,
          minArt: Math.round(Math.min(...art.map((r) => Math.min(r.width, r.height)))), within, svgs: document.querySelectorAll('.badges svg.bd').length, firstLeft: cells[0] && cells[0].querySelector('.bdsub').textContent };
      });
      R.expect(`${size[0]}: badges grid, variant ${variant}`, g.variant === variant && g.cells === 13 && g.locked === 13 && g.fams === 4 && g.svgs === 13 && g.minArt >= 44 && g.within, '13 locked badges in 4 families, art at least 44 px, inside the screen', JSON.stringify(g));
    }
    await load(bp, size, '&open=badges');
    const t = await bp.evaluate(async () => {
      const toast = document.getElementById('toast'), b = window.__chess.badges;
      toast.textContent = ''; toast.classList.remove('show');
      b.earn('daily-3');
      await Promise.resolve(); await new Promise((r) => setTimeout(r, 30));
      const first = { text: toast.textContent, shown: toast.classList.contains('show'), earned: document.querySelector('.bdg[data-id="daily-3"]')?.dataset.earned, fresh: document.querySelector('.bdg[data-id="daily-3"]')?.classList.contains('fresh') };
      toast.textContent = ''; toast.classList.remove('show');
      b.earn('daily-3'); b.evaluate();
      await new Promise((r) => setTimeout(r, 30));
      return { first, again: toast.textContent };
    });
    R.expect(`${size[0]}: a seeded badge shows one toast, with a glint, and not a second time`, t.first.text === 'New badge: 3 days in a row' && t.first.shown && t.first.earned === 'true' && t.first.fresh && t.again === '', 'toast once', JSON.stringify(t));
    seen.errs.push(...bw.errs); seen.foreign.push(...bw.foreign);
    await bp.close();
  }
  // a win at game over: mate in one against the computer records that level and gives the badge; two players give nothing
  for (const [query, want] of mine() ? [['the computer on (Easy)', { wins: ['easy'], earned: ['win-easy'] }], ['two players', { wins: [], earned: [] }]] : []) {
    const wp = await browser.newPage();
    await wp.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await wp.evaluateOnNewDocument(() => { try { for (const k of ['chess3d.badges', 'chess3d.train', 'chess3d.puzzles', 'chess3d.daily']) localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    await load(wp, SIZES[0], `&fen=${encodeURIComponent('k7/8/1K6/8/8/8/8/7R w - - 0 1')}`);
    const w = await wp.evaluate(async (vs) => {
      const c = window.__chess, g = c.game;
      if (vs) g.setVsComputer(true, { color: 'b', level: 'easy' });
      g.clickSquare(g.nameSq('h1')); g.clickSquare(g.nameSq('h8'));
      for (let i = 0; i < 12; i++) c.step(0.5);
      await new Promise((r) => setTimeout(r, 100));
      return { over: !!g.getState().over, wins: Object.keys(c.badges.store.wins()), earned: Object.keys(c.badges.store.earned()) };
    }, query !== 'two players');
    R.expect(`a mate in one, ${query}, ${want.wins.length ? 'records the win and earns the badge' : 'records nothing'}`, w.over && w.wins.join() === want.wins.join() && w.earned.join() === want.earned.join(), JSON.stringify(want), JSON.stringify(w));
    await wp.close();
  }
  // combines with the other flags
  if (mine()) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const watch = await watchPage(page, ['127.0.0.1', 'localhost']);
    await load(page, SIZES[0], '&view=tokens&open=puzzles');
    const combo = await page.evaluate(() => ({ view: window.__chess.views.current(), tab: document.querySelector('.xtab[aria-selected="true"]')?.dataset.tab }));
    R.expect('open=puzzles combines with view=tokens', combo.view === 'tokens' && combo.tab === 'puzzles', 'tokens + puzzles', JSON.stringify(combo));
    seen.errs.push(...watch.errs); seen.foreign.push(...watch.foreign);
  }
  R.expect('no console error, no foreign request', !seen.errs.length && !seen.foreign.length, 'clean', seen.errs.concat(seen.foreign).join(' | '));
} catch (e) {
  R.fail('open flag run', String(e && e.stack || e).slice(0, 400));
}
await finish();
