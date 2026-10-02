// Easy flat view symbols in the real page: runSymbolsChecks({ page, baseUrl, log, shot }) -> [{ name, pass, detail }].
// Called from test/smoke.mjs (a served build) or on its own: node test/symbols.mjs [--base-url=http://...] [--port=5362] [--shots]
// On its own it serves the dev server with HMR off, so edits by other agents do not reload the page.
// The page needs window.__chess.symbols (the object from createSymbols). When it is missing the check imports
// /src/views/symbols.js itself, which only works against the dev server.
// Uses ?quality=low&manual=1&ai=0, so time is stepped with __chess.step and nothing depends on durations.

const FLAGS = 'quality=low&manual=1&ai=0';

export async function runSymbolsChecks({ page, baseUrl, log = () => {}, shot = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 160));
  page.on('pageerror', onErr);
  const onConsole = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); };
  page.on('console', onConsole);

  const load = async (query, w, h) => {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/?${FLAGS}${query ? '&' + query : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.evaluate(async () => {
      const c = window.__chess;
      if (!c.symbols) {
        const m = await import(/* @vite-ignore */ '/src/views/symbols.js');
        c.symbols = m.createSymbols({ gimbal: c.gimbal, game: c.game, stage: c.stage });
      }
    });
  };
  const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  // lightness 0..1 of the rendered pixel at the centre of a square, read from the canvas right after a draw
  const lightAt = (names) => page.evaluate(async (list) => {
    const c = window.__chess, T = c.THREE;
    c.draw();
    const url = c.stage.renderer.domElement.toDataURL();
    const img = new Image(); img.src = url; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const r = c.stage.renderer.domElement.getBoundingClientRect();
    const res = {};
    for (const n of list) {
      const sq = c.game.nameSq(n);
      const v = new T.Vector3((sq & 7) - 3.5, 0.02, 3.5 - (sq >> 3)).applyMatrix4(c.gimbal.matrixWorld).project(c.stage.camera);
      const x = Math.round((v.x * 0.5 + 0.5) * img.width), y = Math.round((-v.y * 0.5 + 0.5) * img.height);
      const d = g.getImageData(x - 1, y - 1, 3, 3).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      res[n] = s / (d.length / 4) / 255;
    }
    return res;
  }, names);
  const stat = () => page.evaluate(() => {
    const c = window.__chess, root = c.game.root;
    let pieces = 0, symbols = 0, symVisible = 0, bodyHidden = 0, bodyShown = 0, hits = 0;
    for (const ch of root.children) {
      if (!ch.userData.piece) continue;
      pieces++;
      const s = ch.userData.symbol;
      if (s) { symbols++; if (s.visible) symVisible++; }
      for (const k of ch.children) {
        if (k.userData.hit) { hits++; continue; }
        if (k.name === 'symbol') continue;
        if (k.visible) bodyShown++; else bodyHidden++;
      }
    }
    return { pieces, symbols, symVisible, bodyHidden, bodyShown, hits, audit: c.game.audit().length };
  });
  const play = async (from, to) => {
    await page.evaluate((a, b) => { const g = window.__chess.game; g.clickSquare(g.nameSq(a)); g.clickSquare(g.nameSq(b)); }, from, to);
    await step(1.4);
  };

  try {
    // 1. start position from above, 1280x720
    await load('preset=Top%20down', 1280, 720);
    await step(1);
    let s = await stat();
    ok('symbols: off by default, 3D pieces shown', s.pieces === 32 && s.symVisible === 0 && s.bodyShown === 32 && s.bodyHidden === 0, JSON.stringify(s));
    let L = await lightAt(['a1', 'a8']);
    await page.evaluate(() => window.__chess.symbols.setVisible(true));
    await step(0.5);
    s = await stat();
    ok('symbols on: 32 symbols shown, every 3D body hidden, pick cylinders kept', s.symbols === 32 && s.symVisible === 32 && s.bodyShown === 0 && s.hits === 32, JSON.stringify(s));
    let L2 = await lightAt(['a1', 'a8']);
    ok('symbols on: white rook (on a dark square) draws light, black rook (on a light square) draws dark', L2.a1 > 0.6 && L2.a8 < 0.3, JSON.stringify({ off: L, on: L2 }));
    await shot?.('symbols-start-1280');

    // 2. picking still works in the easy flat view
    const picked = await page.evaluate(() => {
      const c = window.__chess, T = c.THREE;
      const out = [];
      for (const n of ['e2', 'd7', 'g1']) {
        const sq = c.game.nameSq(n);
        const v = new T.Vector3((sq & 7) - 3.5, 0.3, 3.5 - (sq >> 3)).applyMatrix4(c.gimbal.matrixWorld).project(c.stage.camera);
        const r = c.stage.renderer.domElement.getBoundingClientRect();
        out.push(c.game.sqName(c.pick(r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height)));
      }
      return out;
    });
    ok('picking: e2, d7 and g1 resolve to their squares through the symbols', picked.join() === 'e2,d7,g1', picked.join());

    // 3. a move, a capture, undo: symbols follow, counts stay right
    // the real Easy flat view: a capture in an easy view plays no battle scene, so the pawn is in the tray after the usual wait
    await page.evaluate(() => window.__chess.views?.set('easy-flat', { instant: true, remember: false }));
    await step(0.5);
    await play('e2', 'e4'); await play('d7', 'd5'); await play('e4', 'd5');
    s = await stat();
    ok('capture: 31 pieces on the board plus the captured one, all with a visible symbol and a hidden body', s.pieces === 32 && s.symVisible === 32 && s.bodyShown === 0 && s.audit === 0, JSON.stringify(s));
    const tray = await page.evaluate(() => window.__chess.game.getState().captured.b.length);
    ok('capture: the captured pawn is in the tray', tray === 1, String(tray));
    await page.evaluate(() => window.__chess.game.undo());
    await step(1.4);
    s = await stat();
    ok('undo: still 32 symbols, board consistent', s.symVisible === 32 && s.audit === 0, JSON.stringify(s));
    L2 = await lightAt(['e4', 'd5']);
    ok('undo: after taking back, e4 holds a white symbol and d5 a black one', L2.e4 > 0.6 && L2.d5 < 0.3, JSON.stringify(L2));

    // 4. promotion creates a piece mid animation: it gets its symbol at once
    await page.evaluate(() => window.__chess.game.loadFen('8/P6k/8/8/8/8/8/K7 w - - 0 1'));
    await step(0.5);
    await page.evaluate(() => { const g = window.__chess.game; g.move('a7', 'a8', 'q'); });
    await step(0.05);
    s = await stat();
    ok('promotion: the new queen already has a visible symbol and a hidden body', s.symVisible === s.pieces && s.bodyShown === 0, JSON.stringify(s));
    await step(2);

    // 5. new game
    await page.evaluate(() => window.__chess.game.newGame());
    await step(2.5);
    s = await stat();
    ok('new game: 32 symbols, no 3D body shown', s.pieces === 32 && s.symVisible === 32 && s.bodyShown === 0 && s.audit === 0, JSON.stringify(s));

    // 6. back to 3D
    await page.evaluate(() => window.__chess.symbols.setVisible(false));
    await step(0.3);
    s = await stat();
    L2 = await lightAt(['a1']);
    ok('symbols off again: 3D bodies shown, symbols hidden', s.symVisible === 0 && s.bodyShown === 32, JSON.stringify(s));

    // 7. symbols stay upright on screen in the white and black views
    for (const preset of ['White view', 'Black view', 'Top down']) {
      await page.evaluate((p) => { const c = window.__chess; c.symbols.setVisible(true); c.controls.setPreset(p); for (let i = 0; i < 160; i++) c.controls.update(0.02); c.step(0.2); c.draw(); }, preset);
      const up = await page.evaluate(() => {
        const c = window.__chess, T = c.THREE;
        const g = [...c.game.root.children].find((k) => k.userData.piece && k.userData.symbol);
        const sym = g.userData.symbol;
        sym.updateWorldMatrix(true, false);
        const e = sym.matrixWorld.elements;
        const dir = new T.Vector3(-e[8], -e[9], -e[10]).normalize();     // the glyph's up, in world space
        const camUp = new T.Vector3(0, 1, 0).applyQuaternion(c.stage.camera.quaternion);
        dir.y = 0; camUp.y = 0;
        return dir.normalize().dot(camUp.normalize());
      });
      ok(`orientation: symbols read upright in ${preset}`, up > 0.97, `dot ${up.toFixed(3)}`);
      await shot?.(`symbols-${preset.toLowerCase().replace(/ /g, '-')}`);
    }
    await page.evaluate(() => window.__chess.symbols.setVisible(false));

    // 8a. the view registry drives the symbols: on in Easy flat only
    if (await page.evaluate(() => !!window.__chess.views)) {
      const seen = await page.evaluate(() => {
        const c = window.__chess, out = {};
        for (const id of ['easy-flat', 'white', 'easy-3d', 'easy-flat']) { c.views.set(id, { instant: true, remember: false }); c.step(0.1); out[id] = c.symbols.visible; }
        return out;
      });
      ok('views: symbols are on in Easy flat, off in White view and Easy 3D', seen['easy-flat'] === true && seen.white === false && seen['easy-3d'] === false, JSON.stringify(seen));
      s = await stat();
      ok('views: Easy flat leaves 32 symbols and no 3D body shown', s.symVisible === 32 && s.bodyShown === 0, JSON.stringify(s));
    }

    // 8b. phone sizes, selection marks on top of the symbols
    for (const [w, h] of [[390, 844], [844, 390], [844, 290]]) {
      await load('preset=Top%20down&moves=e2e4,e7e5,g1f3,b8c6&select=f1', w, h);
      await page.evaluate(() => { window.__chess.symbols.setVisible(true); });
      await step(1);
      s = await stat();
      ok(`${w}x${h}: symbols drawn with a piece selected, no error`, s.symVisible === 32 && s.bodyShown === 0, JSON.stringify(s));   // audit left out: a selected piece is lifted on purpose
      await shot?.(`symbols-${w}x${h}`);
    }
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
  }
  ok('symbols: no console or page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  return out;
}

// ---------------------------------------------------------------- standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawn } = await import('node:child_process');
  const { ROOT, launchBrowser, sleep, VITE } = await import('../tools/_lib.mjs');
  const args = process.argv.slice(2);
  const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  const PORT = Number(opt('port', 5362));
  let baseUrl = (opt('base-url', '') || opt('base', '')).replace(/\/$/, '');   // --base= is what test/smoke-groups.mjs passes
  let vite = null, dir = null, browser = null, nf = 0;
  const shotDir = join(ROOT, '.tmp/symbols-shots');
  try {
    if (!baseUrl) {
      dir = join(tmpdir(), `chess3d-symbols-${process.pid}`);
      mkdirSync(dir, { recursive: true });
      const cfg = join(dir, 'vite.config.mjs');
      writeFileSync(cfg, `export default { root: ${JSON.stringify(ROOT)}, server: { hmr: false, watch: null } };\n`);
      vite = spawn(VITE(), ['--config', cfg, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
      baseUrl = `http://127.0.0.1:${PORT}`;
      for (let i = 0; i < 80; i++) { try { if ((await fetch(baseUrl)).ok) break; } catch (e) { /* not up yet */ } await sleep(250); }
    }
    if (args.includes('--shots')) mkdirSync(shotDir, { recursive: true });
    browser = await launchBrowser();
    const page = await browser.newPage();
    const shot = args.includes('--shots') ? async (name) => { await page.screenshot({ path: join(shotDir, `${name}.png`) }); } : null;
    const rows = await runSymbolsChecks({ page, baseUrl, shot });
    for (const r of rows) { console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  ' + r.detail : ''}`); if (!r.pass) nf++; }
    console.log(`\n${rows.length} checks, ${nf} failed`);
  } finally {
    if (browser) await browser.close();
    if (vite) vite.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
  process.exit(nf ? 1 : 0);
}
