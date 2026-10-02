// Real touch tier: build, serve, drive the page as an iPhone with CDP Input.dispatchTouchEvent (real touch events, no synthetic DOM events).
// Usage: node test/touch.mjs [--port=5305] [--skip-build]
//   per size (portrait 390x844, landscape 844x390; dpr 3, isMobile, hasTouch, iPhone user agent, ?touch=1, quality=low, manual=1, ai=0):
//   tap to select and tap to move  a few legal moves by finger taps on projected squares, checked against window.__chess.game
//   illegal tap                    a tap on an illegal target moves nothing
//   pinch on the board             two fingers apart and together change the camera distance (controls.camera.dist)
//   page zoom blocked              visualViewport.scale stays 1 through a pinch off the board and a double tap on the board, and device.js
//                                  calls preventDefault on the second tap of a double tap and on a two finger move off the canvas
//   HUD buttons                    New game, the Controls drawer and a view preset respond to taps
// Exit codes: 0 pass (warnings allowed), 1 a check failed, 2 setup error.
import { ROOT, reporter, launchBrowser, watchPage, startServer, build, sleep } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5305));
const OUT = '.tmp/touch-dist';
const SIZES = [{ name: 'portrait', w: 390, h: 844 }, { name: 'landscape', w: 844, h: 390 }];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const URLQ = '?quality=low&manual=1&ai=0&touch=1';
const R = reporter();
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';

let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\ntouch: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail (${secs()})`);
  console.log(s.nf ? 'TOUCH FAILED' : s.nw ? 'TOUCH OK WITH WARNINGS' : 'TOUCH OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });
const guard = async (name, fn) => { try { await fn(); } catch (e) { R.fail(name, 'threw: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').slice(0, 300)); } };

try {
  if (!args.includes('--skip-build')) {
    const tb = Date.now();
    build(OUT);
    R.pass('vite build', `${((Date.now() - tb) / 1000).toFixed(1)}s`);
  }
  server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  R.pass('vite preview up', server.base);
  browser = await launchBrowser({ w: 844, h: 390 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

async function runSize(size) {
  const tag = `${size.name} ${size.w}x${size.h}`;
  const page = await browser.newPage();
  try {
    const watch = await watchPage(page, ['127.0.0.1', 'localhost']);
    await page.setUserAgent(IPHONE_UA);
    await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: size.w > size.h });
    await page.goto(server.base + URLQ, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    const cdp = await page.createCDPSession();
    const ev = (fn, ...a) => page.evaluate(fn, ...a);
    const step = (s) => ev((x) => window.__chess.step(x), s);
    const state = () => ev(() => { const g = window.__chess.game, s = g.getState(); return { moves: s.moves.slice(), turn: s.turn, selected: s.selected, audit: g.audit(), dist: window.__chess.controls.camera.dist, pitch: window.__chess.controls.camera.pitch, scale: window.visualViewport ? window.visualViewport.scale : 1 }; });

    // ---- real touch helpers: Input.dispatchTouchEvent takes the finger that changes
    const pts = new Map();
    const send = (type, id, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x: p.x, y: p.y, id, radiusX: 8, radiusY: 8, force: 1 }] });
    const down = async (id, x, y) => { pts.set(id, { x, y }); await send('touchStart', id, pts.get(id)); };
    const moveTo = async (id, x, y, n = 8) => {
      const p = { ...pts.get(id) };
      for (let i = 1; i <= n; i++) { const q = { x: p.x + ((x - p.x) * i) / n, y: p.y + ((y - p.y) * i) / n }; pts.set(id, q); await send('touchMove', id, q); await sleep(16); }
    };
    const up = async (id) => { const p = pts.get(id); pts.delete(id); await send('touchEnd', id, p); };
    const tap = async (x, y) => { await down(1, x, y); await sleep(40); await up(1); await sleep(60); };

    const sqXY = (name) => ev((n) => {
      const c = window.__chess, T = c.THREE, sq = c.game.nameSq(n);
      c.gimbal.updateMatrixWorld(true); c.stage.camera.updateMatrixWorld(true);
      const r = c.stage.renderer.domElement.getBoundingClientRect();
      for (const [dx, dz] of [[0, 0], [0, -0.2], [0, 0.2], [-0.2, 0], [0.2, 0], [0, -0.35], [0.3, 0.3], [-0.3, 0.3]]) {
        for (const y of [0.3, 0.6, 0.15, 0.9, 0.05, 1.2]) {
          const v = new T.Vector3((sq & 7) - 3.5 + dx, y, 3.5 - (sq >> 3) + dz);
          c.gimbal.localToWorld(v); v.project(c.stage.camera);
          const x = r.left + ((v.x + 1) / 2) * r.width, y2 = r.top + ((1 - v.y) / 2) * r.height;
          if (x < 0 || y2 < 0 || x > innerWidth || y2 > innerHeight) continue;
          const top = document.elementFromPoint(x, y2);
          if (!top || top.id !== 'stage') continue;
          if (c.pick(x, y2) === sq) return { x, y: y2, found: true };
        }
      }
      return { found: false };
    }, name);
    const tapSq = async (name) => {
      const p = await sqXY(name);
      if (!p.found) throw new Error(`no free point on the canvas picks square ${name}`);
      await tap(p.x, p.y);
    };
    const play = async (from, to) => { await tapSq(from); await tapSq(to); await step(2.5); };
    /** centre of an element, only when it is visible and not covered */
    const centre = (sel) => ev((s) => {
      const el = document.querySelector(s); if (!el) return null;
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return null;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return top && (top === el || el.contains(top)) ? { x, y } : null;
    }, sel);
    const tapEl = async (sel) => { const c = await centre(sel); if (!c) return false; await tap(c.x, c.y); return true; };
    /** a spot on the canvas that is not under the HUD, near the middle of the screen */
    const freeSpots = () => ev(() => {
      const out = [];
      for (let fy = 0.15; fy <= 0.85; fy += 0.05) for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
        const x = innerWidth * fx, y = innerHeight * fy, t = document.elementFromPoint(x, y);
        if (t && t.id === 'stage') out.push({ x, y });
      }
      return out;
    });

    await step(0.5);
    let s = await state();
    // Known app problem: with the Controls drawer closed, its cards are invisible (opacity 0) but still pointer-events: auto, so they
    // swallow taps meant for the board. Reported as a WARN until M3 fixes it; the board checks below park the drawer with a style tag.
    const blockers = await ev(() => {
      const bad = [];
      for (let fy = 0.1; fy <= 0.9; fy += 0.1) for (let fx = 0.1; fx <= 0.9; fx += 0.1) {
        const t = document.elementFromPoint(innerWidth * fx, innerHeight * fy);
        const tools = t && t.closest && t.closest('#tools');
        if (tools && getComputedStyle(tools).opacity === '0') bad.push(`${Math.round(fx * 100)}%,${Math.round(fy * 100)}%`);
      }
      return bad;
    });
    if (blockers.length) R.warn(`${tag}: invisible drawer cards swallow taps on the board`, `${blockers.length} of 81 probe points, for example ${blockers.slice(0, 3).join(' ')}`);
    else R.pass(`${tag}: no invisible element sits over the board`);
    R.expect(`${tag}: page loads in touch mode without errors`, watch.errs.length === 0 && s.audit.length === 0, 'clean', watch.errs.slice(0, 2).join(' | ') || s.audit.join(','));

    // ---- tap to select and tap to move
    // Another known layout problem on short screens: the Game card can cover the white pieces. A real tap on its header collapses it.
    const gameHdr = '.card[data-card="game"] > header';
    let collapsedGame = false;
    if (!(await sqXY('e2')).found || !(await sqXY('d2')).found) {
      R.warn(`${tag}: the Game card covers the white pieces, tapping the board needs it collapsed`, 'e2 or d2 cannot be tapped in the default layout');
      collapsedGame = await tapEl(gameHdr); await sleep(400); await step(0.5);
    }
    await ev(() => { const st = document.createElement('style'); st.id = 'touch-test-park'; st.textContent = '#tools { pointer-events: none !important; } #tools * { pointer-events: none !important; }'; document.head.append(st); });
    await tapSq('e2');
    s = await state();
    R.expect(`${tag}: tap selects an own piece`, s.selected === 'e2', 'e2 selected', `selected ${s.selected}`);
    await tapSq('e5');
    s = await state();
    R.expect(`${tag}: tap on an illegal target moves nothing`, s.moves.length === 0 && s.selected === null, 'refused, selection cleared', `moves ${s.moves.join(' ')} selected ${s.selected}`);
    await play('e2', 'e4');
    s = await state();
    R.expect(`${tag}: tap e2 then e4 plays e4`, s.moves.join(' ') === 'e4' && s.turn === 'b' && s.audit.length === 0, 'e4', `${s.moves.join(' ')} ${s.audit.join(',')}`);
    await play('e7', 'e5'); await play('g1', 'f3'); await play('b8', 'c6');
    s = await state();
    R.expect(`${tag}: four plies by finger, all legal, view matches the rules`, s.moves.join(' ') === 'e4 e5 Nf3 Nc6' && s.turn === 'w' && s.audit.length === 0, s.moves.join(' '), `${s.moves.join(' ')} ${s.audit.join(',')}`);

    // ---- pinch on the board: two fingers apart zooms in (distance falls), together zooms out
    const spots = await freeSpots();
    if (spots.length < 2) R.fail(`${tag}: free canvas area for a pinch`, `${spots.length} spots`);
    else {
      const cx = spots.reduce((a, p) => a + p.x, 0) / spots.length, cy = spots.reduce((a, p) => a + p.y, 0) / spots.length;
      const mid = spots.reduce((b, p) => (Math.hypot(p.x - cx, p.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? p : b));
      const horiz = size.w > size.h || true;
      const span = (d) => ev((m, dd) => { const ok = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.id === 'stage'; }; let h = dd; while (h > 10 && !(ok(m.x - h, m.y) && ok(m.x + h, m.y))) h -= 5; return h; }, mid, d);
      const half = await span(70);
      const d0 = (await state()).dist;
      await down(1, mid.x - half * 0.3, mid.y); await down(2, mid.x + half * 0.3, mid.y);
      await moveTo(1, mid.x - half, mid.y); await moveTo(2, mid.x + half, mid.y);
      await up(2); await up(1); await step(0.3);
      const d1 = (await state()).dist;
      R.expect(`${tag}: pinch out on the board zooms in`, d1 < d0 * 0.8, `dist ${d0.toFixed(1)} to ${d1.toFixed(1)}`, `dist ${d0.toFixed(1)} to ${d1.toFixed(1)}`);
      await down(1, mid.x - half, mid.y); await down(2, mid.x + half, mid.y);
      await moveTo(1, mid.x - half * 0.3, mid.y); await moveTo(2, mid.x + half * 0.3, mid.y);
      await up(2); await up(1); await step(0.3);
      const d2 = (await state()).dist;
      R.expect(`${tag}: pinch in on the board zooms out`, d2 > d1 * 1.2, `dist ${d1.toFixed(1)} to ${d2.toFixed(1)}`);
      s = await state();
      R.expect(`${tag}: a pinch does not select or move anything`, s.moves.length === 4 && s.selected === null, 'moves unchanged', `${s.moves.length} moves, selected ${s.selected}`);

      // ---- page zoom is blocked
      await ev(() => {
        window.__tt = { dblPrevented: [], multiPrevented: [] };
        window.addEventListener('touchend', (e) => { if (e.target.id === 'stage') window.__tt.dblPrevented.push(e.defaultPrevented); }, { passive: true });
        window.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && e.target.id !== 'stage') window.__tt.multiPrevented.push(e.defaultPrevented); }, { passive: true });
      });
      const sp = (await freeSpots())[0] || mid;
      await tap(sp.x, sp.y); await tap(sp.x, sp.y);   // double tap on the board
      // two fingers off the canvas: the HUD card, or the header of a drawer, whichever is free; fall back to the top edge strip
      const off = await ev(() => { const el = document.querySelector('#hud .card') || document.getElementById('turn'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
      const ofs = Math.min(40, off.w / 4);
      await down(1, off.x - ofs, off.y); await down(2, off.x + ofs, off.y);
      await moveTo(1, off.x - ofs * 2, off.y, 4); await moveTo(2, off.x + ofs * 2, off.y, 4);
      await up(2); await up(1); await sleep(100);
      const tt = await ev(() => window.__tt);
      s = await state();
      R.expect(`${tag}: visual viewport scale stays 1 after pinch and double tap`, s.scale === 1, `scale ${s.scale}`);
      R.expect(`${tag}: the second tap of a double tap on the board is blocked`, tt.dblPrevented.length >= 2 && tt.dblPrevented[tt.dblPrevented.length - 1] === true, `touchend defaultPrevented ${JSON.stringify(tt.dblPrevented)}`);
      R.expect(`${tag}: two finger move off the board is blocked`, tt.multiPrevented.length > 0 && tt.multiPrevented.every(Boolean), `touchmove defaultPrevented ${JSON.stringify(tt.multiPrevented)}`);
      await step(0.3);
    }

    // ---- HUD buttons respond to taps
    await ev(() => document.getElementById('touch-test-park')?.remove());
    if (collapsedGame) { await tapEl(gameHdr); await sleep(400); }
    const hudOk = await ev(() => !!document.getElementById('btn-new'));
    R.expect(`${tag}: HUD is built`, hudOk, '');
    // a view preset: the toolbox may sit in the Controls drawer on narrow layouts
    const presetSel = '#presets .preset:nth-child(3)';
    let c = await centre(presetSel);
    if (!c) { await tapEl('.drawer-btn'); await sleep(150); c = await centre(presetSel); }
    if (!c) {   // the View card can be collapsed too
      const hdr = await ev(() => { const h = document.querySelector('#presets')?.closest('.card')?.querySelector('header'); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (hdr) { await tap(hdr.x, hdr.y); await sleep(150); c = await centre(presetSel); }
    }
    if (!c) R.fail(`${tag}: a view preset button can be reached and tapped`, 'not visible even with the drawer open');
    else {
      const name = await ev((q) => document.querySelector(q).textContent, presetSel);
      const before = (await state()).pitch;
      await tap(c.x, c.y); await step(2);
      s = await state();
      R.expect(`${tag}: tapping the view preset "${name}" moves the camera`, Math.abs(s.pitch - before) > 0.05, `pitch ${(before * 57.3).toFixed(0)} to ${(s.pitch * 57.3).toFixed(0)} deg`);
    }
    // New game
    let tapped = await tapEl('#btn-new');
    if (!tapped) { await tapEl('.drawer-btn'); await sleep(150); tapped = await tapEl('#btn-new'); }
    await sleep(100); await step(2.5);
    s = await state();
    R.expect(`${tag}: tapping New game resets the game`, tapped && s.moves.length === 0 && s.turn === 'w' && s.audit.length === 0, 'start position', `tapped ${tapped}, moves ${s.moves.length}`);
    R.expect(`${tag}: no console or page error during the touch run`, watch.errs.length === 0, 'clean', watch.errs.slice(0, 3).join(' | '));
  } finally { await page.close().catch(() => {}); }
}

for (const size of SIZES) await guard(`${size.name} run`, () => runSize(size));
await finish();
