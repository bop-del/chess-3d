// Shared UI fixes in the real page (these checks lived in the Blocks fixes page): node test/shared-fixes-page.mjs [--port=5353] [--base=<server>] [--shots=<dir>]
// The Captured text list of the desktop Play tab is always hidden (the captured pieces stand beside the board in 3D), and the
// game review strip leaves the lower board frame free (1440x900, three views).
// ai=0, manual=1, quality=low: time by __chess.step()/draw(). Exit codes: 0 pass, 1 a check failed.
import { mkdirSync } from 'node:fs';
import { reporter, launchBrowser, watchPage, startServer, build, settleUi } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5353)), BASE = opt('base', '').replace(/\/$/, ''), SHOTS = opt('shots', '');
const R = reporter();
const OUT = '.tmp/shared-fixes-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const DESK = { width: 1440, height: 900 };
const MOVES = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];   // fool's mate for the review strip
const browser = await launchBrowser({ w: 1440, h: 900 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  const load = async (vp, query = '') => {
    await page.setViewport(vp);
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0${vp.isMobile ? '&touch=1' : ''}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.waitForFunction("document.getElementById('loader').classList.contains('done')");
  };
  const settle = (s = 2) => page.evaluate((n) => { const c = window.__chess; for (let i = 0; i < 10; i++) c.step(n / 10); c.draw(); }, s);

  // ---- the Captured list (CHE-95a)
  const capVisible = () => page.evaluate(() => { const e = document.querySelector('.cap-sec'); return !!e && e.offsetParent !== null; });
  await load(DESK, '&theme=pixel');
  R.expect('desktop Play tab: the captured pieces stand beside the board, no Captured text list', !(await capVisible()), 'hidden');
  if (SHOTS) { await settle(1); await page.screenshot({ path: `${SHOTS}/captured-beside-board.png` }); }

  // ---- the review strip (CHE-95b): the lowest corner of the frame on screen is above the strip
  for (const [theme, view] of [['classic', 'white'], ['pixel', 'black'], ['pixel', 'iso']]) {
    await load(DESK, `&theme=${theme}&view=${view}`);
    await page.evaluate((mv) => { for (const [a, b] of mv) window.__chess.game.move(a, b); }, MOVES);
    for (let i = 0; i < 20 && !(await page.evaluate(() => !!document.getElementById('bn-review-game') && !document.getElementById('banner').hidden)); i++) await settle(0.5);
    await page.evaluate(() => document.getElementById('bn-review-game').click());
    await settle(3);
    await settleUi(page);
    const m = await page.evaluate(() => {
      const c = window.__chess, cam = c.stage.camera, V = c.THREE.Vector3; cam.updateMatrixWorld();
      const lows = [-5, 5].flatMap((x) => [-5, 5].map((z) => { const v = c.gimbal.localToWorld(new V(x, 0, z)).project(cam); return (1 - v.y) / 2 * innerHeight; }));
      const r = document.querySelector('.rv').getBoundingClientRect();
      return { low: Math.max(...lows), top: r.top, hidden: document.querySelector('.rv').hidden };
    });
    R.expect(`review strip ${theme} ${view} 1440x900: the lower frame edge stays above the strip`, !m.hidden && m.low <= m.top, `frame ${Math.round(m.low)} px, strip ${Math.round(m.top)} px`, JSON.stringify(m));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/review-${theme}-${view}.png` });
  }
  // closing the review gives the board its room back
  const fitDuring = await page.evaluate(() => window.__chess.controls.frame.bottom);
  await page.evaluate(() => document.querySelector('.rv-close').click());
  await settle(1);

  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
