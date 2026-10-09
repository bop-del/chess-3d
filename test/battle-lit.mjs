// CHE-369 lit capture variants: node test/battle-lit.mjs [--port=5351] [--base=URL] [--skip-build]
// Wild capture scenes (Options Scene row, ?capture=wild beats it, Wood at quality=low with ?manual=1): every attacker type plays its scene through the
// real director and leaves the board, the camera (field of view too), the scene graph and the tray as before; Short is faster, a tap
// skips, Off plays none; a leak matrix (every attacker twice plus skips) keeps renderer.info geometries, textures and programs flat.
// The checkmate finale: it plays, hides the banner until it is done, cracks the king, a tap skips it, a new game drops the cracks.
// Without a pick or the flag nothing of it loads: no finale, the old scenes play (the pawn's victim topples, it is never hidden).
// The Options pick: the Scene chips store Wild, a reload applies it, the flag beats the stored pick for that load only.
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5351').slice(7));
const R = reporter();
const OUT = '.tmp/battle-lit-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const browser = await launchBrowser({ w: 960, h: 600 });
const FEN = {
  p: ['4k3/8/8/3V4/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5'],
  n: ['4k3/8/8/3V4/8/2N5/8/4K3 w - - 0 1', 'c3', 'd5'],
  b: ['4k3/8/8/3V4/8/5B2/8/4K3 w - - 0 1', 'f3', 'd5'],
  r: ['4k3/8/8/3V4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5'],
  q: ['4k3/8/8/3V4/8/3Q4/8/4K3 w - - 0 1', 'd3', 'd5'],
  k: ['k7/8/8/3V4/4K3/8/8/8 w - - 0 1', 'e4', 'd5'],
};
const MATE = ['6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1', 'a8'];
try {
  const page = await browser.newPage();
  const w = await watchPage(page, undefined, { scenes: true });
  const load = async (q, { keep = false } = {}) => {
    await page.goto(`${BASE || `http://127.0.0.1:${PORT}`}/?${q}&theme=wood&quality=low&manual=1&ai=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.evaluate(async (keep) => {
      const c = window.__chess;
      if (!keep) localStorage.clear();
      await c.battle.ready();
      c.step(1.5); c.draw();
      // one capture, measured
      window.__lit = {
        async capture([fen, from, to], vic, { mode = 'on', skipAt = -1, draw = 0 } = {}) {
          c.battle.settings.set({ mode });
          c.game.loadFen(fen.replace('V', vic)); c.game.finishAnimations();
          await c.stepAsync(0.3, 30);
          const cam0 = c.controls.camera, fov0 = c.stage.camera.fov;
          const kids = c.stage.scene.children.length, rootKids = c.game.root.children.length;
          c.battle.lastCtx = null;
          c.game.move(from, to);
          let steps = 0, sawScene = false, skipped = false, sceneTime = 0, hidden = false, fovMin = fov0, slowSeen = 1;
          for (; steps < 900; steps++) {
            await c.stepAsync(1 / 30, 30);
            if (draw && steps % draw === 0) c.draw();
            const ctx = c.battle.lastCtx;
            if (ctx) { sawScene = true; sceneTime = ctx.time(); if (!ctx.victimObj.group.visible && c.battle.active) hidden = true; }
            fovMin = Math.min(fovMin, c.stage.camera.fov);
            if (skipAt >= 0 && !skipped && sceneTime >= skipAt) { window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); skipped = true; }
            if (steps > 5 && !c.battle.active && !c.game.busy && !c.controls.animating) break;
          }
          await c.stepAsync(0.5, 30);
          const cam = c.controls.camera;
          return {
            steps, seconds: +(steps / 30).toFixed(2), sawScene, skipped, hidden, audit: c.game.audit(), fov: Math.abs(c.stage.camera.fov - fov0), punched: fovMin < fov0 - 0.5,
            cam: Math.max(Math.abs(cam.yaw - cam0.yaw), Math.abs(cam.pitch - cam0.pitch), Math.abs(cam.dist - cam0.dist)),
            sceneKids: c.stage.scene.children.length - kids, rootKids: c.game.root.children.length - rootKids,
            inTray: c.game.getState().captured.b.includes(vic), busy: c.game.busy || c.battle.active,
          };
        },
        mem: () => ({ g: c.stage.renderer.info.memory.geometries, t: c.stage.renderer.info.memory.textures, p: c.stage.renderer.info.programs?.length }),
      };
    }, keep);
  };
  const good = (r, extra = true) => !r.error && r.sawScene && r.audit.length === 0 && r.cam < 1e-3 && r.fov < 1e-6 && r.sceneKids === 0 && r.rootKids === 0 && r.inTray && !r.busy && extra;

  // ------------------------------------------------------------ default: no flag, nothing of the variants
  await load('x=1');
  const def = await page.evaluate(() => ({ capture: window.__chess.battle.capture, finale: !!window.__chess.battle.finale }));
  const d = await page.evaluate((f) => window.__lit.capture(f, 'p'), FEN.p);
  R.expect('no flag: no variant, no finale, the old pawn scene (victim topples, never hidden, no punch in)', def.capture === null && !def.finale && good(d, !d.hidden && !d.punched), `${d.seconds} s`, JSON.stringify({ def, d }));

  for (const variant of ['wild']) {
    await load(`capture=${variant}`);
    const on = await page.evaluate(() => ({ capture: window.__chess.battle.capture }));
    R.expect(`${variant}: flag read`, on.capture === variant, on.capture, JSON.stringify(on));
    // every attacker type, the renderer drawing during the scene
    const times = {};
    for (const att of Object.keys(FEN)) {
      const r = await page.evaluate((f, v) => window.__lit.capture(f, v, { draw: 3 }), FEN[att], att === 'k' ? 'p' : 'n');
      times[att] = r.seconds;
      R.expect(`${variant} ${att}: scene plays, victim shatters, punch in, all put back`, good(r, r.hidden && r.punched && r.seconds > 2.5 && r.seconds < 8), `${r.seconds} s`, JSON.stringify(r));
    }
    const sh = await page.evaluate((f) => window.__lit.capture(f, 'q', { mode: 'short' }), FEN.q);
    R.expect(`${variant}: Short is faster`, good(sh, sh.seconds < times.q * 0.6), `on ${times.q} s, short ${sh.seconds} s`, JSON.stringify(sh));
    const sk = await page.evaluate((f) => window.__lit.capture(f, 'q', { skipAt: 1.2 }), FEN.r);
    R.expect(`${variant}: a tap skips, all put back`, good(sk, sk.skipped && sk.seconds < times.r), `${sk.seconds} s`, JSON.stringify(sk));
    const off = await page.evaluate((f) => window.__lit.capture(f, 'n', { mode: 'off' }), FEN.b);
    R.expect(`${variant}: Off plays none`, off.audit.length === 0 && !off.sawScene && off.inTray, `${off.seconds} s`, JSON.stringify(off));
    // leak matrix: after one warm pass, a pass with every attacker plus a skip in each must leave memory flat
    const leak = await page.evaluate(async (FEN) => {
      const L = window.__lit, bad = [];
      const pass = async (skip) => { for (const f of Object.values(FEN)) { const r = await L.capture(f, 'b', { skipAt: skip, draw: 6 }); if (r.audit.length || r.sceneKids || r.rootKids || r.fov > 1e-6) bad.push(JSON.stringify(r).slice(0, 160)); } };
      await pass(-1); await pass(0.8);
      const m0 = L.mem();
      await pass(-1); await pass(0.8);
      return { m0, m1: L.mem(), bad };
    }, FEN);
    R.expect(`${variant}: leak matrix (24 scenes, 12 skipped) memory flat, all put back`, leak.bad.length === 0 && leak.m1.g <= leak.m0.g + 2 && leak.m1.t <= leak.m0.t && leak.m1.p <= leak.m0.p + 1, `geometries ${leak.m0.g} to ${leak.m1.g}, textures ${leak.m0.t} to ${leak.m1.t}, programs ${leak.m0.p} to ${leak.m1.p}`, JSON.stringify(leak).slice(0, 600));
  }

  // ------------------------------------------------------------ the Options pick (CHE-369): each kept entry, reload, applied
  const ui = () => page.evaluate(() => ({ capture: window.__chess.battle.capture, sel: document.querySelector('#sel-capture .chip.on')?.dataset.value, stored: JSON.parse(localStorage.getItem('chess3d.battle') || '{}').capture, row: !!document.querySelector('[data-settings="battle"] .battle-capture:not([hidden])') }));
  const pick = (v) => page.evaluate((v) => document.querySelector(`#sel-capture .chip[data-value="${v}"]`).click(), v);
  await load('x=1');
  const p0 = await ui();
  R.expect('Options: the Scene row is there for Wood, Normal is on without a pick', p0.row && p0.sel === 'normal' && p0.capture === null && !p0.stored, JSON.stringify(p0), JSON.stringify(p0));
  await pick('wild');
  const p1 = await ui();
  R.expect('Options: Wild picked is stored and applied at once', p1.capture === 'wild' && p1.stored === 'wild' && p1.sel === 'wild', JSON.stringify(p1), JSON.stringify(p1));
  await load('x=1', { keep: true });
  const p2 = await ui();
  const pw = await page.evaluate((f) => window.__lit.capture(f, 'n'), FEN.n);
  R.expect('Options: after a reload Wild is still on and the wild scene plays (victim shatters, punch in)', p2.capture === 'wild' && p2.sel === 'wild' && good(pw, pw.hidden && pw.punched), JSON.stringify(p2), JSON.stringify({ p2, pw }));
  await load('capture=normal', { keep: true });
  const p3 = await ui();
  R.expect('flag: ?capture=normal beats the stored Wild for that load, the store stays', p3.capture === null && p3.stored === 'wild', JSON.stringify(p3), JSON.stringify(p3));
  await load('x=1', { keep: true });
  await pick('normal');
  await load('x=1', { keep: true });
  const p4 = await ui();
  R.expect('Options: Normal picked, reload, the old scenes and no finale', p4.capture === null && p4.stored === 'normal' && !(await page.evaluate(() => !!window.__chess.battle.finale)), JSON.stringify(p4), JSON.stringify(p4));
  await load('capture=wild', { keep: true });
  const p5 = await ui();
  R.expect('flag: ?capture=wild beats the stored Normal for that load, the store stays', p5.capture === 'wild' && p5.stored === 'normal', JSON.stringify(p5), JSON.stringify(p5));
  await page.goto(`${BASE || `http://127.0.0.1:${PORT}`}/?theme=pixel&quality=low&manual=1&ai=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  await page.evaluate(() => window.__chess.step(1));
  R.expect('Options: no Scene row in Pixelwelt (its scenes are its own)', !(await ui()).row, 'hidden');

  // ------------------------------------------------------------ the checkmate finale (comes with Wild)
  await load('capture=wild');
  const fin = await page.evaluate(async ([fen, from, to]) => {
    const c = window.__chess, banner = document.getElementById('banner');
    const vis = () => !banner.hidden && getComputedStyle(banner).visibility !== 'hidden';
    const run = async ({ skipAt = -1 } = {}) => {
      c.battle.settings.set({ mode: 'on' });
      c.game.newGame({ instant: true });
      c.game.loadFen(fen); c.game.finishAnimations();
      await c.stepAsync(0.3, 30);
      const fov0 = c.stage.camera.fov, m0 = window.__lit.mem();
      c.game.move(from, to);
      let t = 0, seen = false, bannerDuring = false, skipped = false;
      for (; t < 12; t += 1 / 30) {
        await c.stepAsync(1 / 30, 30);
        const a = !!c.battle.finale?.active;
        if (a) { seen = true; if (vis()) bannerDuring = true; }
        if (skipAt >= 0 && a && t >= skipAt && !skipped) { window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); skipped = true; }
        if (seen && !a && vis()) break;
      }
      await c.stepAsync(0.8, 30); c.draw();
      return { t: +t.toFixed(2), seen, bannerDuring, skipped, bannerAfter: vis(), cracked: c.battle.finale?.cracked, fov: Math.abs(c.stage.camera.fov - fov0), cine: c.controls.cinematicActive, m0 };
    };
    const full = await run();
    const skip = await run({ skipAt: 0.5 });
    c.game.newGame({ instant: true });
    await c.stepAsync(0.5, 30);
    const after = { cracked: c.battle.finale?.cracked, mem: window.__lit.mem() };
    document.getElementById('banner').hidden = true;
    return { full, skip, after };
  }, MATE);
  R.expect('finale: plays on mate, banner waits until it is done, the king is cracked, camera and field of view back', fin.full.seen && !fin.full.bannerDuring && fin.full.bannerAfter && fin.full.cracked && fin.full.fov < 1e-6 && !fin.full.cine, `${fin.full.t} s`, JSON.stringify(fin.full));
  R.expect('finale: a tap skips it, the banner comes at once', fin.skip.seen && fin.skip.skipped && fin.skip.bannerAfter && fin.skip.t < fin.full.t && fin.skip.fov < 1e-6, `${fin.skip.t} s`, JSON.stringify(fin.skip));
  R.expect('finale: a new game drops the cracks, memory back', !fin.after.cracked && fin.after.mem.g <= fin.full.m0.g + 2 && fin.after.mem.t <= fin.full.m0.t, JSON.stringify(fin.after.mem), JSON.stringify(fin));
  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
