// Battle system checks: node test/battle.mjs [--port=5350]
// The director, the capture hook, the camera close-up and the settings, through the real game (nothing mocked) at quality=low
// with ?manual=1: one capture per attacker (scene runs, camera swoops and returns exactly, board consistent, victim in the tray),
// Short is faster, Off plays none, a tap skips, undo and new game during a scene settle at once, black attackers and en passant,
// instant (scripted) moves and explain mode play no scene, settings persist and are mounted, ten scenes leave renderer.info
// geometries and textures at the baseline (the fx dispose check), no console error or warning.
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5350').slice(7));
const R = reporter();
const OUT = '.tmp/battle-dist';   // a build, so edits by other sessions do not reload the page mid test
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');   // a server that is already up (test/smoke-groups.mjs)
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const browser = await launchBrowser({ w: 1280, h: 720 });
const FEN = {
  p: ['4k3/8/8/3V4/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5'],
  n: ['4k3/8/8/3V4/8/2N5/8/4K3 w - - 0 1', 'c3', 'd5'],
  b: ['4k3/8/8/3V4/8/5B2/8/4K3 w - - 0 1', 'f3', 'd5'],
  r: ['4k3/8/8/3V4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5'],
  q: ['4k3/8/8/3V4/8/3Q4/8/4K3 w - - 0 1', 'd3', 'd5'],
  k: ['k7/8/8/3V4/4K3/8/8/8 w - - 0 1', 'e4', 'd5'],
};
try {
  const page = await browser.newPage();
  const w = await watchPage(page, undefined, { scenes: true });
  const load = async (size = { width: 1280, height: 720 }) => {
    await page.setViewport(size);
    await page.goto(`${BASE || `http://127.0.0.1:${PORT}`}/?quality=low&manual=1&ai=0${size.width < 500 ? '&touch=1' : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.evaluate(() => { localStorage.clear(); window.__chess.step(2); window.__chess.draw(); });
  };
  await load();
  const au0 = await page.evaluate(() => ({ ac: window.__chess.audio.ac, unlocked: window.__chess.audio.unlocked, mute: !!document.querySelector('[data-settings="audio"] [data-audio-mute]'), battle: !!document.querySelector('[data-settings="battle"]') }));
  R.expect('no audio context before a gesture; mute switch mounted next to the battle setting', au0.ac === null && !au0.unlocked && au0.mute && au0.battle, 'locked, switch present', JSON.stringify(au0));
  // runs one capture; returns timings and state
  const run = (att, vic, opts = {}) => page.evaluate(async ({ fen, from, to, vic, opts }) => {
    const { game, controls, battle, stage } = window.__chess;
    battle.settings.set({ mode: opts.mode || 'on' });
    game.loadFen(fen.replace('V', vic));
    await battle.ready(); await window.__chess.stepAsync(0.5);
    const before = stage.camera.position.toArray();
    const camBefore = controls.camera;
    const info = stage.renderer.info.memory;
    const mem0 = { g: info.geometries, t: info.textures };
    game.move(from, to);
    let t = 0, sawActive = false, sawCine = false, maxBusyT = 0, minDist = 1e9;
    const frames = [];
    while (game.busy && t < 12) {
      await window.__chess.stepAsync(0.05); t += 0.05;
      if (battle.active) sawActive = true;
      if (controls.cinematicActive) sawCine = true;
      const cp = stage.camera.position; minDist = Math.min(minDist, cp.distanceTo(new window.__chess.THREE.Vector3(0, 0.15, 0)));
      if (opts.skipAt && t >= opts.skipAt && battle.active && !opts.skipped) { opts.skipped = true; window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); }
    }
    await window.__chess.stepAsync(0.6);
    window.__chess.draw();
    const after = stage.camera.position.toArray();
    const mem1 = { g: stage.renderer.info.memory.geometries, t: stage.renderer.info.memory.textures };
    return { t: +t.toFixed(2), sawActive, sawCine, still: game.busy, audit: game.audit(), camDelta: Math.max(...before.map((v, i) => Math.abs(v - after[i]))), mem0, mem1, minDist: +minDist.toFixed(2), tray: game.getState().captured };
  }, { fen: FEN[att][0], from: FEN[att][1], to: FEN[att][2], vic, opts });

  {
  for (const att of Object.keys(FEN)) {
    const r = await run(att, 'p');
    R.expect(`${att}: scene runs, camera swoops, everything settles`, r.sawActive && r.sawCine && !r.still && r.audit.length === 0 && r.tray.b.length === 1, `${r.t}s min camera distance ${r.minDist}`, JSON.stringify(r));
    R.expect(`${att}: camera returns exactly`, r.camDelta < 1e-6, `delta ${r.camDelta}`, `delta ${r.camDelta}`);
  }
  // modes
  const base = await run('q', 'p', { mode: 'on' });
  const short = await run('q', 'p', { mode: 'short' });
  const off = await run('q', 'p', { mode: 'off' });
  R.expect('short is faster than on', short.t < base.t * 0.6, `on ${base.t}s short ${short.t}s`, `on ${base.t}s short ${short.t}s`);
  R.expect('off plays no scene', !off.sawActive && !off.sawCine && off.audit.length === 0, `${off.t}s`, JSON.stringify(off));
  const skip = await run('r', 'p', { skipAt: 0.9 });
  R.expect('tap skips the scene and everything settles', skip.audit.length === 0 && skip.t < base.t, `${skip.t}s`, JSON.stringify(skip));
  // game.loadFen and new game must not allocate geometry per piece (the hit proxies are shared)
  const lf = await page.evaluate(() => {
    const { game, stage } = window.__chess;
    const g = () => stage.renderer.info.memory.geometries;
    game.loadFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const g0 = g();
    for (let i = 0; i < 10; i++) { game.loadFen('4k3/8/8/3p4/4P3/2N5/8/4K3 w - - 0 1'); game.newGame({ instant: true }); }
    window.__chess.draw();
    return { g0, g1: g() };
  });
  R.expect('loadFen and newGame allocate no geometry', lf.g1 <= lf.g0 + 1, `geometries ${lf.g0} to ${lf.g1}`, `geometries ${lf.g0} to ${lf.g1}`);
  // The leak matrix: every attacker, full and short, against a queen and a pawn, each capture undone, plus a
  // mid scene skip. After the warm up, renderer.info geometries and textures, programs and the pieces must be unchanged
  // (loadFen allocates hit proxies, so the position is loaded once per victim before the baseline).
  await page.evaluate(() => {
    const { game, battle, stage, controls } = window.__chess;
    const mm = () => ({ g: stage.renderer.info.memory.geometries, t: stage.renderer.info.memory.textures, p: stage.renderer.info.programs?.length });
    const FEN = '7k/8/8/R2V4/2K1P3/2N2B2/8/3Q4 w - - 0 1';
    const MOVES = [['e4', 'd5'], ['c3', 'd5'], ['f3', 'd5'], ['a5', 'd5'], ['d1', 'd5'], ['c4', 'd5']];
    const st = { bad: [], scenes: 0, drawn: 0, m0: null, cam0: controls.camera };
    const run = async ([f, t], { skipAt = -1 } = {}) => {
      game.move(f, t);
      let n = 0, sceneT = 0, skipped = false;
      while ((game.busy || battle.active) && n++ < 600) {
        await window.__chess.stepAsync(0.05);
        if (++st.drawn % 8 === 0) window.__chess.draw();
        if (battle.active) sceneT += 0.05;
        if (skipAt >= 0 && !skipped && battle.active && sceneT >= skipAt) { battle.skip(); skipped = true; }
      }
      await window.__chess.stepAsync(0.5);
      if (n >= 600) st.bad.push(`${f}${t} never settled`);
      const au = game.audit();
      if (au.length) st.bad.push(`${f}${t}: ${au.join(',')}`);
      st.scenes++;
      game.undo();
      await window.__chess.stepAsync(1.3);
      const au2 = game.audit();
      if (au2.length) st.bad.push(`undo ${f}${t}: ${au2.join(',')}`);
      if (controls.cinematicActive) st.bad.push('camera still in close-up');
    };
    window.__m = {
      st, mm,
      async load(vic) { game.loadFen(FEN.replace('V', vic)); await window.__chess.stepAsync(0.3); },
      async pass(mode, skipAt = -1) { battle.settings.set({ mode }); for (const mv of MOVES) await run(mv, { skipAt }); },
      mark() { st.m0 = mm(); },
      end() {
        const c0 = st.cam0, c1 = controls.camera;
        if (Math.abs(c1.yaw - c0.yaw) + Math.abs(c1.pitch - c0.pitch) + Math.abs(c1.dist - c0.dist) > 1e-9) st.bad.push('camera state changed');
        return { m0: st.m0, m1: mm(), bad: st.bad, scenes: st.scenes };
      },
    };
  });
  await page.evaluate(() => window.__chess.battle.ready());
  for (const [vic, mode] of [['q', 'on'], ['p', 'short']]) {
    await page.evaluate((v) => window.__m.load(v), vic);
    await page.evaluate((m) => window.__m.pass(m), mode);
    if (vic === 'q') await page.evaluate(() => window.__m.mark());   // every piece type has been drawn once: shared geometry is uploaded
    await page.evaluate((m) => window.__m.pass(m, 0.7), mode);
  }
  const mem = await page.evaluate(() => window.__m.end());
  R.expect(`leak matrix: ${mem.scenes} scenes, board and camera restored every time`, mem.bad.length === 0, `${mem.scenes} scenes`, mem.bad.slice(0, 6).join(' | '));
  R.expect('memory flat over the matrix (fx dispose)', mem.m1.g <= mem.m0.g + 4 && mem.m1.t <= mem.m0.t && mem.m1.p <= mem.m0.p + 2, `geometries ${mem.m0.g} to ${mem.m1.g}, textures ${mem.m0.t} to ${mem.m1.t}, programs ${mem.m0.p} to ${mem.m1.p}`, JSON.stringify(mem));
  // black attacker, en passant, undo mid scene, explain mode and instant moves
  const extra = await page.evaluate(async () => {
    const { game, battle, controls } = window.__chess;
    const out = {};
    battle.settings.set({ mode: 'on' });
    game.loadFen('4k3/8/8/3p4/4P3/8/8/4K3 b - - 0 1');
    game.move('d5', 'e4');
    let t = 0; while (game.busy && t < 12) { await window.__chess.stepAsync(0.05); t += 0.05; }
    await window.__chess.stepAsync(0.6);
    out.black = { t, audit: game.audit() };
    game.loadFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    game.move('e5', 'd6');
    t = 0; while (game.busy && t < 12) { await window.__chess.stepAsync(0.05); t += 0.05; }
    await window.__chess.stepAsync(0.6);
    out.ep = { t, audit: game.audit(), captured: game.getState().captured };
    // undo while the scene runs
    game.loadFen('4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1');
    const cam0 = controls.camera;
    game.move('c3', 'd5');
    await window.__chess.stepAsync(1.2);
    out.midActive = battle.active;
    game.undo();
    await window.__chess.stepAsync(1.5);
    out.undo = { audit: game.audit(), busy: game.busy, active: battle.active, fen: game.getState().fen, cine: controls.cinematicActive };
    // instant moves never play a scene
    game.loadFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    game.playMoves(['e4d5']);
    out.instant = { busy: game.busy, active: battle.active };
    // explain mode
    game.loadFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    game.setMode('explain');
    game.move('e4', 'd5');
    await window.__chess.stepAsync(0.2);
    out.explain = { active: battle.active };
    game.setMode('play');
    await window.__chess.stepAsync(2);
    // new game mid scene
    game.loadFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    game.move('e4', 'd5');
    await window.__chess.stepAsync(1.2);
    game.newGame({ instant: true });
    await window.__chess.stepAsync(1.5);
    out.newgame = { audit: game.audit(), busy: game.busy, active: battle.active, cine: controls.cinematicActive };
    return out;
  });
  R.expect('black attacker settles', extra.black.audit.length === 0, `${extra.black.t.toFixed(1)}s`, JSON.stringify(extra.black));
  R.expect('en passant settles', extra.ep.audit.length === 0 && extra.ep.captured.b.length === 1, `${extra.ep.t.toFixed(1)}s`, JSON.stringify(extra.ep));
  R.expect('undo during a scene restores the board', extra.midActive && extra.undo.audit.length === 0 && !extra.undo.busy && !extra.undo.active && !extra.undo.cine, '', JSON.stringify(extra));
  R.expect('instant moves play no scene', !extra.instant.busy && !extra.instant.active, '', JSON.stringify(extra.instant));
  R.expect('explain mode plays no scene', !extra.explain.active, '', JSON.stringify(extra.explain));
  R.expect('new game during a scene settles', extra.newgame.audit.length === 0 && !extra.newgame.busy && !extra.newgame.active && !extra.newgame.cine, '', JSON.stringify(extra.newgame));
  // settings stored per device
  await page.evaluate(() => document.querySelector('[data-audio-mute]').click());   // the real input is visually hidden (the track is the target)
  const mu = await page.evaluate(() => ({ muted: window.__chess.audio.muted, ac: !!window.__chess.audio.ac }));
  R.expect('mute switch mutes and a click unlocks the context', mu.muted, JSON.stringify(mu), JSON.stringify(mu));
  await page.evaluate(() => window.__chess.battle.settings.set({ mode: 'short' }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  const st = await page.evaluate(() => ({ m: window.__chess.battle.settings.mode, ui: !!document.querySelector('[data-settings="battle"]'), sel: document.querySelector('#sel-battle')?.value }));
  const mut = await page.evaluate(() => ({ muted: window.__chess.audio.muted, box: document.querySelector('[data-audio-mute]').checked }));
  R.expect('mute is stored per device', mut.muted && mut.box, JSON.stringify(mut), JSON.stringify(mut));
  await page.evaluate(() => window.__chess.audio.setMuted(false));
  R.expect('settings persist and are mounted in the Scene card', st.m === 'short' && st.ui && st.sel === 'short', JSON.stringify(st), JSON.stringify(st));

  }
    // Scene matrix for the pawn, knight and bishop (scenes-a): 15 attacker and victim combinations through the real director,
  // with the real renderer drawing during the scene; Short, skip and Off per attacker.
  await page.evaluate(() => {
    const SQ = { p: 'd5', n: 'c5', b: 'd5' };                       // where the black victim stands, for a white piece on e4
    const MOD = { p: 'pawn', n: 'knight', b: 'bishop' };
    const c = window.__chess;
    window.__t = {
      async capture(att, vic, { mode = 'on', skipAt = -1, draw = 0 } = {}) {
        c.battle.settings.set({ mode });
        // put the victim on its square by loading a position that has it
        const sq = SQ[att], f = sq.charCodeAt(0) - 97, r = sq.charCodeAt(1) - 49;
        const rows = Array.from({ length: 8 }, () => Array(8).fill(''));
        rows[7][4] = 'k'; rows[0][4] = 'K'; rows[3][4] = att.toUpperCase(); rows[r][f] = vic;
        const fen = rows.map((row) => { let s = '', n = 0; for (const x of row) { if (!x) n++; else { if (n) s += n; n = 0; s += x; } } return s + (n || ''); }).reverse().join('/') + ' w - - 0 1';
        c.game.loadFen(fen); c.game.finishAnimations();
        const cam0 = { yaw: c.controls.camera.yaw, pitch: c.controls.camera.pitch, dist: c.controls.camera.dist };
        const kids = c.stage.scene.children.length, rootKids = c.game.root.children.length;
        c.battle.lastCtx = null;
        const rec = c.game.move('e4', sq);
        if (!rec) return { error: `illegal move e4${sq} for ${att}x${vic}` };
        let steps = 0, sawScene = false, skipped = false, sceneTime = 0;
        for (; steps < 900; steps++) {
          await c.stepAsync(1 / 30, 30);
          if (draw && steps % draw === 0) c.draw();
          if (c.battle.lastCtx) { sawScene = true; sceneTime = c.battle.lastCtx.time(); }
          if (skipAt >= 0 && !skipped && sceneTime >= skipAt) { c.battle.skip(); skipped = true; }
          if (steps > 5 && !c.battle.active && !c.game.busy && !c.controls.animating) break;
        }
        await c.stepAsync(0.5, 30);
        const cam = c.controls.camera;
        return {
          steps, seconds: +(steps / 30).toFixed(2), sawScene, skipped, audit: c.game.audit(),
          cam: Math.max(Math.abs(cam.yaw - cam0.yaw), Math.abs(cam.pitch - cam0.pitch), Math.abs(cam.dist - cam0.dist)),
          sceneKids: c.stage.scene.children.length - kids, rootKids: c.game.root.children.length - rootKids,
          inTray: c.game.getState().captured.b.includes(vic), busy: c.game.busy || c.battle.active,
        };
      },
    };
  });
  const good = (r, extra = true) => !r.error && r.sawScene && r.audit.length === 0 && r.cam < 1e-3 && r.sceneKids === 0 && r.rootKids === 0 && r.inTray && !r.busy && extra;
  for (const att of ['p', 'n', 'b']) for (const vic of ['p', 'n', 'b', 'r', 'q']) {
    const r = await page.evaluate((a, v) => window.__t.capture(a, v), att, vic);
    R.expect(`scene ${att}x${vic}`, good(r, r.seconds > 3.5 && r.seconds < 7), `${r.seconds} s`, JSON.stringify(r));
  }
  for (const att of ['p', 'n', 'b']) {
    const r = await page.evaluate((a) => window.__t.capture(a, 'b', { mode: 'short' }), att);
    R.expect(`short ${att}`, good(r, r.seconds < 3.2), `${r.seconds} s`, JSON.stringify(r));
    const x = await page.evaluate((a) => window.__t.capture(a, 'q', { skipAt: 1 }), att);
    R.expect(`skip ${att}`, good(x, x.skipped && x.seconds < 4.8), `${x.seconds} s`, JSON.stringify(x));
    const o = await page.evaluate((a) => window.__t.capture(a, 'b', { mode: 'off' }), att);
    R.expect(`off ${att}`, o.audit?.length === 0 && !o.sawScene && o.inTray, `${o.seconds} s, no scene`, JSON.stringify(o));
  }
  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
