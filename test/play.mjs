// Play view follow camera (smoke tier): build, serve, drive the real page at 390x844 (phone portrait, Play view).
// Usage: node test/play.mjs [--port=5363] [--skip-build] [--dev]
//   select       a piece and every legal target square are on screen (inside the free canvas area) once the glide ends
//   wide piece   a queen with targets on both wings: all targets still on screen
//   move         after the move the camera settles back to the home framing
//   reply        the computer's reply is followed (its from and to squares were on screen while it moved), then it settles
//   hint         a hint arrow far from the home framing is brought on screen
//   other views  with another view chosen the follow camera does nothing (focus stays home)
// Exit codes: 0 pass (warnings allowed), 1 a check failed, 2 setup error.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5363));
const OUT = '.tmp/play-dist';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');   // a server that is already up (test/smoke-groups.mjs)
const R = reporter();
const t0 = Date.now();
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nplay: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(s.nf ? 'PLAY FAILED' : s.nw ? 'PLAY OK WITH WARNINGS' : 'PLAY OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

try {
  if (BASE) server = { base: BASE + '/', stop() {} };
  else if (args.includes('--dev')) server = await startServer({ mode: 'dev', port: PORT });
  else {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  R.pass('server up', server.base);
  browser = await launchBrowser({ w: 390, h: 844 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

try {
  const page = await browser.newPage();
  const watch = await watchPage(page);
  await page.setUserAgent(IPHONE_UA);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const load = async (q) => {
    await page.goto(`${server.base}?quality=low&manual=1&touch=1&${q}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    // Until main.js owns the play view (the lead wires it), a dev run builds one here and ticks it with the frame step.
    await ev(async () => {
      const c = window.__chess;
      if (c.play) return;
      const { createPlayView } = await import('/src/views/play.js');
      const views = c.views || { current: () => 'play' };
      c.play = createPlayView({ controls: c.controls, game: c.game, views, device: {}, stage: c.stage });
      const step = c.step;
      c.step = (s, hz = 30) => { const n = Math.max(1, Math.round(s * hz)); for (let i = 0; i < n; i++) { step(1 / hz, hz); c.play.update(1 / hz); } };
    });
    return ev(() => !!window.__chess.views);
  };
  // Squares as screen rectangles against the free canvas area. Returns the names that are not fully inside.
  const offscreen = (names, tall) => ev((list, first) => {
    const c = window.__chess, T = c.THREE, f = c.controls.frame;
    c.gimbal.updateMatrixWorld(true); c.stage.camera.updateMatrixWorld(true);
    const w = innerWidth, h = innerHeight, bad = [];
    list.forEach((n, i) => {
      const sq = c.game.nameSq(n);
      const pts = [];
      for (const dx of [-0.4, 0.4]) for (const dz of [-0.4, 0.4]) { pts.push([dx, 0, dz]); if (first && i === 0) pts.push([dx * 0.3, 1.8, dz * 0.3]); }
      for (const [dx, y, dz] of pts) {
        const v = new T.Vector3((sq & 7) - 3.5 + dx, y, 3.5 - (sq >> 3) + dz);
        c.gimbal.localToWorld(v); v.project(c.stage.camera);
        const x = ((v.x + 1) / 2) * w, yy = ((1 - v.y) / 2) * h;
        if (x < f.left || x > w - f.right || yy < f.top || yy > h - f.bottom) { bad.push(n); break; }
      }
    });
    return bad;
  }, names, tall);
  const targets = (from) => ev((n) => { const g = window.__chess.game, f = g.nameSq(n), out = []; for (const m of g.chess.moves()) if (m.from === f && !out.includes(g.sqName(m.to))) out.push(g.sqName(m.to)); return out; }, from);
  const step = (s) => ev((x) => window.__chess.step(x), s);
  const focus = () => ev(() => { const f = window.__chess.controls.focus; return f ? Math.hypot(f.x, f.z) : -1; });
  // distance of the camera focus from the Play view's resting point (HOME_FOCUS in src/views/play.js)
  const fromHome = () => ev(() => { const f = window.__chess.controls.focus, h = window.__chess.play.home; return Math.hypot(f.x - h.x, f.z - h.z); });

  const owned = await load('view=play&ai=0&fen=' + encodeURIComponent('r3k2r/pppq1ppp/2n5/3pp3/3PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1'));
  if (!owned) R.warn('views registry not in the page yet', 'the Play view is assumed (dev fallback)');
  await step(1);
  for (const [name, from] of [['pawn a2', 'a2'], ['pawn h2', 'h2'], ['knight c3', 'c3'], ['queen d2 (wide)', 'd2'], ['rook a1', 'a1'], ['king e1', 'e1']]) {
    await ev((n) => window.__chess.game.selectSquare(n), from);
    await step(1.2);
    const list = [from, ...(await targets(from))];
    const bad = await offscreen(list, true);
    R.expect(`select ${name}: piece and ${list.length - 1} targets on screen`, bad.length === 0, '', 'off screen: ' + bad.join(' '));
    await ev(() => window.__chess.game.clickSquare(-1));   // deselect
    await step(1.2);
  }
  R.expect('deselect settles home', (await fromHome()) < 0.05, '', 'off home by ' + (await fromHome()));

  // a move: select, move, settle
  await ev(() => window.__chess.game.selectSquare('a2'));
  await step(1.2);
  await ev(() => window.__chess.game.move('a2', 'a4'));
  await step(0.3);
  const mid = await offscreen(['a2', 'a4'], false);
  R.expect('move squares stay on screen while the piece slides', mid.length === 0, '', 'off screen: ' + mid.join(' '));
  await step(2.5);
  R.expect('after the move the camera settles home', (await fromHome()) < 0.05, '', 'off home by ' + (await fromHome()));

  // computer reply
  await load('view=play&ai=2&moves=e2e4');
  await step(0.5);
  await ev(() => { const g = window.__chess.game; g.on('move', (r) => { window.__lastReply = [g.sqName(r.m.from), g.sqName(r.m.to)]; }); g.move('h2', 'h4'); });
  let seen = null;
  for (let i = 0; i < 60 && !seen; i++) {
    await step(0.2);
    const st = await ev(() => window.__chess.game.getState());
    if (st.moves.length >= 4 && !st.busy) seen = st.moves;
  }
  R.expect('computer replied', !!seen, '', 'no reply in 12 s');
  if (seen) {
    // the reply's squares stay framed for a moment after the piece has landed
    const sq = await ev(() => window.__lastReply);
    const bad = await offscreen(sq.map((n) => n), false);
    R.expect(`reply ${sq.join('-')} is on screen when it lands`, bad.length === 0, '', 'off screen: ' + bad.join(' '));
    await step(3);
    R.expect('after the reply the camera settles home', (await fromHome()) < 0.05, '', 'off home by ' + (await fromHome()));
  }

  // hint arrow far away from the home framing
  await load('view=play&ai=0');
  const hint = await ev(() => { const h = window.__chess.openings?.hint; if (!h) return false; h.enabled = true; h.show(0, 16); return true; });   // a1 to a3
  if (hint) {
    await step(1.5);
    const bad = await offscreen(['a1', 'a3'], false);
    R.expect('hint arrow squares on screen', bad.length === 0, '', 'off screen: ' + bad.join(' '));
  } else R.warn('no hint object in the page', 'skipped');

  // another view: no follow
  if (owned) {
    await ev(() => window.__chess.views.set('white'));
    await ev(() => window.__chess.game.selectSquare('a2'));
    await step(1.5);
    R.expect('other view: focus stays home', (await focus()) < 0.01, '', 'focus ' + (await focus()));
  }
  R.expect('no page errors', watch.errs.length === 0, '', watch.errs.slice(0, 2).join(' | '));
} catch (e) {
  R.fail('test run', String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').slice(0, 400));
} finally {
  await finish();
}
