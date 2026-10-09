// The Crystal and Mech figure sets (flag and Options row) in the real page (CHE-368): node test/piecesets-page.mjs [--port=5249] [--base=<server>]
// For crystal (three gem pairs) and mech (looks a and b): every piece on the board wears the set, heights follow the classic ranking, a click picks
// and selects a piece, an animated capture scene plays and ends clean, a theme change keeps the set, no page errors. Without the
// flag nothing changes: no forced style, the classic pieces. ai=0, manual=1, quality=low (the phone path: no transmission).
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5249)), BASE = opt('base', '').replace(/\/$/, '');
const R = reporter();
const OUT = '.tmp/piecesets-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const browser = await launchBrowser({ w: 1000, h: 700 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  await page.setViewport({ width: 1000, height: 700 });
  const load = async (query) => {
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0&intro=0${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.evaluate(() => { const c = window.__chess; c.game.finishAnimations(); c.step(1); c.draw(); });
  };
  const state = () => page.evaluate(() => {
    const c = window.__chess, st = window.__pieceStyle || null;
    const on = c.game.root.children.filter((o) => o.userData.piece);
    const H = {};
    for (const t of ['p', 'r', 'n', 'b', 'q', 'k']) H[t] = st ? +st.height(t, 'w').toFixed(3) : null;
    return { id: st?.id || null, styles: [...new Set(on.map((o) => o.userData.style))], n: on.length, H };
  });
  // a real click on the white e2 pawn: projected to the screen, through the page's own picking
  // from a steep camera, so no back rank piece in front covers the pawn (from the White view the e1 king's hit cylinder does)
  const clickE2 = () => page.evaluate(() => {
    const c = window.__chess, { THREE } = c, cam = c.stage.camera;
    c.controls.setCamera({ yaw: 0, pitch: 75 * Math.PI / 180, dist: 16 }); c.step(0.1); c.draw();
    c.gimbal.updateMatrixWorld(true);
    const o = c.game.root.children.find((g) => g.userData.piece?.type === 'p' && Math.abs(g.position.x - 0.5) < 0.01 && Math.abs(g.position.z - 2.5) < 0.01);
    const p = new THREE.Vector3(0, o.userData.height * 0.5, 0).applyMatrix4(o.matrixWorld).project(cam);
    const r = c.stage.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  });

  for (const [q, id] of [['&pieces=crystal', 'crystal'], ['&pieces=mech', 'mech']]) {
    await load(q);
    let s = await state();
    R.expect(`${q}: all 32 pieces wear the ${id} set`, s.id === id && s.n === 32 && s.styles.length === 1 && s.styles[0] === id, `${s.id} on ${s.n}`, JSON.stringify(s));
    const H = s.H;
    R.expect(`${q}: heights follow the classic ranking (pawn < rook < knight < bishop < queen < king)`, H.p < H.r && H.r < H.n && H.n < H.b && H.b < H.q && H.q < H.k, JSON.stringify(H), JSON.stringify(H));
    const xy = await clickE2();
    await page.mouse.click(xy.x, xy.y);
    const sel = await page.evaluate(() => window.__chess.game.getState().selected);
    R.expect(`${q}: a click on the e2 pawn selects it`, sel === 'e2', `selected ${sel}`, JSON.stringify({ xy, sel }));
    // an animated capture with the scene on: a white knight takes a black bishop
    const cap = await page.evaluate(async () => {
      const c = window.__chess;
      c.battle.settings.set({ mode: 'on' });
      c.game.loadFen('r2qk2r/ppp2ppp/2n5/3b4/8/2N5/PPP2PPP/R2QK2R w KQkq - 0 1');
      await c.battle.ready(); await c.stepAsync(0.5);
      c.game.move('c3', 'd5');
      let t = 0, saw = false;
      while (c.game.busy && t < 14) { await c.stepAsync(0.1); t += 0.1; if (c.battle.active) saw = true; }
      await c.stepAsync(0.6); c.draw();
      const st = c.game.getState();
      return { saw, busy: c.game.busy, captured: st.captured.b.length, audit: c.game.audit().length, t: +t.toFixed(1) };
    });
    R.expect(`${q}: the capture scene plays and ends clean`, cap.saw && !cap.busy && cap.audit === 0 && cap.captured === 1, `scene ${cap.saw}, ${cap.t} s`, JSON.stringify(cap));
    await page.evaluate(async () => { await window.__chess.themes.set('wood', { persist: false }); window.__chess.step(0.5); });
    s = await state();
    R.expect(`${q}: a theme change keeps the set`, s.styles.length === 1 && s.styles[0] === id, s.styles.join(','), JSON.stringify(s));
  }
  // the Options row (CHE-368): picking Crystal or Mech stores, reloads and applies; the flag beats the stored pick; Classic goes back; Pixelwelt keeps its own
  const waitReady = () => page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  await load('');
  await page.evaluate(() => { try { localStorage.removeItem('chess3d.pieces'); } catch (e) { /* none */ } });
  const rowIds = () => page.evaluate(() => [...document.querySelectorAll('[data-pieceset="row"] button')].map((b) => b.dataset.value).join());
  R.expect('options: the row lists classic, fantasy, animals, crystal, mech', (await rowIds()) === 'classic,fantasy,animals,crystal,mech', await rowIds(), await rowIds());
  for (const id of ['crystal', 'mech']) {
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }), page.evaluate((v) => document.querySelector(`[data-pieceset="row"] [data-value="${v}"]`).click(), id)]);
    await waitReady();
    await page.evaluate(() => { const c = window.__chess; c.game.finishAnimations(); c.step(1); c.draw(); });
    const s = await state(), stored = await page.evaluate(() => localStorage.getItem('chess3d.pieces'));
    const marked = await page.evaluate(() => document.querySelector('[data-pieceset="row"] .on')?.dataset.value);
    R.expect(`options: picking ${id} reloads with that set on all 32 pieces, stored and marked`, s.id === id && s.n === 32 && s.styles.join() === id && stored === id && marked === id, `${s.id} ${s.n} ${s.styles} ${stored} ${marked}`, JSON.stringify(s));
  }
  // stored mech, flag crystal: the flag wins and leaves the stored pick alone
  await load('&pieces=crystal');
  const sw = await state(), keep = await page.evaluate(() => localStorage.getItem('chess3d.pieces'));
  R.expect('options: ?pieces=crystal beats the stored mech pick and leaves it alone', sw.id === 'crystal' && keep === 'mech', `${sw.id} stored ${keep}`, JSON.stringify(sw));
  // Pixelwelt keeps its own figures over a stored Crystal pick
  await page.evaluate(async () => { await window.__chess.themes.set('pixel', { persist: false }); window.__chess.step(0.5); });
  const px = await state();
  R.expect('options: Pixelwelt keeps its own figures over a stored set', px.styles.length === 1 && px.styles[0] === 'pixel', px.styles.join(), JSON.stringify(px));
  await load('');
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }), page.evaluate(() => document.querySelector('[data-pieceset="row"] [data-value="classic"]').click())]);
  await waitReady();
  await page.evaluate(() => { const c = window.__chess; c.game.finishAnimations(); c.step(1); c.draw(); });
  // the default: no flag, no forced style (Classic picked above)
  const d = await state();
  R.expect('no flag: the classic pieces, no forced style', d.id === null && d.styles.length === 1 && d.styles[0] === null && d.n === 32, JSON.stringify(d.styles), JSON.stringify(d));
  R.expect('no page errors', w.errs.length === 0, `${w.errs.length}`, w.errs.slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close().catch(() => {});
  server.stop();
}
