// CHE-225: while a lesson or a puzzle runs the badges panel is hidden, only the lesson card stays; idle it is back.
// node test/lesson-clean.mjs [--port=5372] [--skip-build] [--base=<server>] [--shots=<dir>]
// Desktop 1440x900 and phone 390x844, today's menu and ?menu=a, Explain and a running puzzle. ai=0, quality=low, manual=1.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { reporter, launchBrowser, watchPage, startServer, build, settleUi } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5372));
const OUT = '.tmp/lesson-clean-dist';
const BASE = opt('base', '').replace(/\/$/, '');
const SHOTS = opt('shots', '');
const R = reporter();
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nlesson clean: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'LESSON CLEAN FAILED' : 'LESSON CLEAN OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

try {
  if (BASE) server = { base: BASE + '/', stop() {} };
  else {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  browser = await launchBrowser({ w: 1440, h: 900 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

const PHONE = ['phone', 390, 844, true], DESK = ['desktop', 1440, 900, false];
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
// the badges card exists and is not display:none (the rule under test); the strip of the Openings list is a different node
const cardShown = (page) => ev(page, () => { const c = document.querySelector('.card[data-card="badges"]'); return !!c && getComputedStyle(c).display !== 'none'; });
const step = (page) => ev(page, () => { window.__chess.step(0.5); window.__chess.draw(); });

async function load(page, [, w, h, phone], menu) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.goto(`${server.base}?quality=low&manual=1&ai=0&intro=0&open=openings${phone ? '&touch=1' : ''}${menu ? `&menu=${menu}` : ''}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await ev(page, () => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await settleUi(page);
}

async function checks(page, size, menu) {
  const tag = `${size[0]}${menu ? ' menu=' + menu : ''}`;
  const shot = async (n) => { if (SHOTS) { await step(page); await page.screenshot({ path: `${SHOTS}/lesson-clean-${size[0]}-${menu || 'default'}-${n}.png` }); } };
  await load(page, size, menu);
  R.expect(`${tag}: idle, the badges panel is there`, await cardShown(page));
  await shot('idle');
  R.expect(`${tag}: the Explain lesson starts`, await ev(page, () => window.__chess.openings.explain.start('italian-game')));
  await settleUi(page);
  R.expect(`${tag}: during Explain the badges panel is hidden`, !(await cardShown(page)));
  await shot('explain');
  await ev(page, () => window.__chess.openings.explain.stop());
  await settleUi(page);
  R.expect(`${tag}: after Explain the badges panel is back`, await cardShown(page));
  R.expect(`${tag}: a puzzle starts`, await ev(page, () => { window.__chess.puzzles.start(); return window.__chess.puzzles.state().phase !== 'idle'; }));
  await settleUi(page);
  R.expect(`${tag}: during a puzzle the badges panel is hidden`, !(await cardShown(page)));
  await shot('puzzle');
  await ev(page, () => window.__chess.puzzles.stop());
  await settleUi(page);
  R.expect(`${tag}: after the puzzle the badges panel is back`, await cardShown(page));
}

try {
  const page = await browser.newPage();
  const watch = await watchPage(page, ['127.0.0.1', 'localhost']);
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('chess3d.daily'); localStorage.removeItem('chess3d.puzzles'); localStorage.removeItem('chess3d.badges'); } catch (e) { /* ignore */ } });
  for (const size of [DESK, PHONE]) for (const menu of ['', 'a']) await checks(page, size, menu);
  R.expect('no console errors', !watch.errs.length, '', watch.errs.slice(0, 2).join(' | '));
  R.expect('no foreign requests', !watch.foreign.length, '', watch.foreign.slice(0, 2).join(' | '));
  await page.close();
} catch (e) {
  R.fail('lesson clean run', String(e && e.stack || e).split('\n').slice(0, 4).join(' | ').slice(0, 500));
}
await finish();
