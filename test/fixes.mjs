// Regression checks for three fixed bugs: board label orientation, hidden piece picking, capture tray vs HUD overlap.
// Usage: const results = await runFixChecks({ page, baseUrl, log }); each result is { name, pass, detail }.
// Needs a served build (or dev server) at baseUrl. Uses ?quality=low&manual=1&ai=0 and the window.__chess hooks.

const FLAGS = 'quality=low&manual=1&ai=0';

async function load(page, baseUrl, query = '', size = { width: 1400, height: 800 }) {
  await page.setViewport(size);
  await page.goto(`${baseUrl}/?${FLAGS}${query ? `&${query}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000, polling: 100 });
  await page.evaluate(() => { window.__chess.step(2); window.__chess.draw(); });
}

// ---------------------------------------------------------------- (a) label orientation
// Every visible label quad is projected through the live camera. For a label to read upright and unmirrored
// its glyph "up" (texture v increasing) must point toward the screen top and its glyph "right" (u increasing)
// toward the screen right. The old board baked in White-side orientation on two edges and Black-side on the
// other two, so half of the labels were upside down from any single viewpoint.
const LABEL_VIEWS = [['White view', 'preset=White%20view'], ['Top down', 'preset=Top%20down'], ['Black view', 'preset=Black%20view']];
async function checkLabels(page, baseUrl, log) {
  const out = [];
  await load(page, baseUrl, LABEL_VIEWS[0][1]);   // the first view goes through ?preset, the others switch in the page like the app does at load
  for (const [preset] of LABEL_VIEWS) {
    await page.evaluate((name) => { const c = window.__chess.controls; c.setPreset(name); for (let i = 0; i < 120; i++) c.update(0.02); window.__chess.step(2); window.__chess.draw(); }, preset);
    const r = await page.evaluate(() => {
      const { THREE, stage, gimbal } = window.__chess;
      stage.scene.updateMatrixWorld(true);
      stage.camera.updateMatrixWorld(true);
      const meshes = [];
      gimbal.traverse((o) => {
        if (!o.isMesh || !o.name.startsWith('labels')) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        meshes.push(o);
      });
      let quads = 0, bad = 0, flipY = null;
      const worst = [];
      const v = (g, i, m) => new THREE.Vector3().fromBufferAttribute(g.attributes.position, i).applyMatrix4(m).project(stage.camera);
      for (const m of meshes) {
        flipY = m.material.map.flipY;
        const g = m.geometry;
        for (let q = 0; q + 3 < g.attributes.position.count; q += 4) {
          const p0 = v(g, q, m.matrixWorld), p1 = v(g, q + 1, m.matrixWorld), p3 = v(g, q + 3, m.matrixWorld);
          const u = g.attributes.uv;
          // quad corners: 0 = (u0,v0) bottom left of the glyph cell, 1 = right of it, 3 = top of it
          const uRight = u.getX(q + 1) - u.getX(q), vUp = u.getY(q + 3) - u.getY(q);
          const sRight = (p1.x - p0.x) * Math.sign(uRight);
          const sUp = (p3.y - p0.y) * Math.sign(vUp) * (flipY ? 1 : -1);
          quads++;
          if (!(sRight > 0 && sUp > 0)) { bad++; if (worst.length < 3) worst.push({ mesh: m.name, q: q / 4, sRight, sUp }); }
        }
      }
      return { meshes: meshes.map((m) => m.name), quads, bad, worst };
    });
    const pass = r.quads === 32 && r.bad === 0;
    out.push({
      name: `labels upright in ${preset}`,
      pass,
      detail: pass ? `${r.quads} label quads read upright (${r.meshes.join(', ')})`
        : `${r.bad} of ${r.quads} visible label quads are rotated or mirrored (meshes ${r.meshes.join(', ')}) ${JSON.stringify(r.worst)}`,
    });
    log?.(`labels ${preset}: ${pass ? 'ok' : 'FAIL'}`);
  }
  return out;
}

// ---------------------------------------------------------------- (b) picking
// Real mouse clicks. Helpers run in the page: screen position of a point on a piece, and the nearest piece along a ray.
const PICK_HELPERS = `
  window.__fx = {
    screen(x, y, z) {
      const { THREE, stage } = window.__chess;
      const v = new THREE.Vector3(x, y, z).project(stage.camera);
      return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
    },
    // all pieces (by square name) whose real mesh the ray through client (cx, cy) hits, nearest first
    hits(cx, cy) {
      const { THREE, stage, game } = window.__chess;
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), stage.camera);
      const out = [];
      game.root.children.forEach((g) => {
        if (!g.isGroup) return; // piece groups only (tray slabs are plain meshes)
        const meshes = [];
        g.traverse((o) => { if (o.isMesh && !o.userData.hit) meshes.push(o); });
        const h = rc.intersectObjects(meshes, false);
        if (h.length) out.push({ d: h[0].distance, x: g.position.x, z: g.position.z });
      });
      out.sort((a, b) => a.d - b.d);
      const sq = (x, z) => 'abcdefgh'[Math.round(x + 3.5)] + (Math.round(3.5 - z) + 1);
      return out.map((o) => ({ sq: sq(o.x, o.z), d: o.d }));
    },
  };
`;

async function settleUi(page) {
  await page.evaluate(() => { window.__chess.step(3); window.__chess.draw(); });
}

async function clickAt(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  await settleUi(page);
}

/** the first position goes through ?fen at load, the others are set in the page (game.loadFen is what ?fen calls) */
async function position(page, baseUrl, fen, first) {
  if (first) await load(page, baseUrl, `fen=${encodeURIComponent(fen)}`);
  else await page.evaluate((f) => { const g = window.__chess.game; g.newGame({ instant: true }); g.loadFen(f); window.__chess.step(2); window.__chess.draw(); }, fen);
  await page.evaluate(PICK_HELPERS);
}

async function checkPicking(page, baseUrl, log) {
  return [...(await pickFront(page, baseUrl, log)), ...(await pickCapture(page, baseUrl, log)), ...(await pickMove(page, baseUrl, log))];
}

async function pickFront(page, baseUrl, log) {
  const out = [];

  // 1) A queen with no legal moves (boxed in by its own men) stands directly in front of a pawn that can move.
  //    Clicking the visible queen must select the queen, not the pawn hidden behind it.
  await position(page, baseUrl, '4k3/8/8/8/8/2PPP3/2PQP3/2BRKB2 w - - 0 1', true);
  const found = await page.evaluate(() => {
    // scan the queen's screen silhouette for a ray that hits the queen first and the d3 pawn right behind it
    const { game } = window.__chess;
    const fx = window.__fx;
    let best = null;
    for (let y = 0.2; y <= 2.2; y += 0.1) for (let dx = -0.25; dx <= 0.25; dx += 0.05) {
      const s = fx.screen(-0.5 + dx, y, 2.5); // d2 is x = -0.5, z = 2.5
      const h = fx.hits(s.x, s.y);
      if (h.length >= 2 && h[0].sq === 'd2' && h[1].sq === 'd3') { best = { x: s.x, y: s.y, hits: h.map((o) => o.sq) }; break; }
    }
    const legalFromD2 = game.chess.moves().filter((m) => m.from === 3 + 8).length;
    const legalFromD3 = game.chess.moves().filter((m) => m.from === 3 + 16).length;
    return { best, legalFromD2, legalFromD3 };
  });
  if (!found.best) {
    out.push({ name: 'front piece takes the click', pass: false, detail: 'test setup: no ray hits the queen with the pawn behind it' });
  } else {
    await clickAt(page, found.best.x, found.best.y);
    const st = await page.evaluate(() => window.__chess.game.getState());
    const pass = st.selected === 'd2' && found.legalFromD2 === 0 && found.legalFromD3 > 0;
    out.push({
      name: 'front piece takes the click (hidden piece not picked)',
      pass,
      detail: `ray hits ${found.best.hits.join(' then ')}; queen d2 has ${found.legalFromD2} moves, pawn d3 has ${found.legalFromD3}; selected = ${st.selected} (want d2)`,
    });
  }
  log?.(`picking front piece: ${out[out.length - 1].pass ? 'ok' : 'FAIL'}`);
  return out;
}

async function pickCapture(page, baseUrl, log) {
  const out = [];
  // 2) Clicking a capture target piece still captures; clicking an empty destination square still moves.
  await position(page, baseUrl, '4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1');
  const rook = await page.evaluate(() => window.__fx.screen(-0.5, 0.5, 3.5)); // rook on d1
  await clickAt(page, rook.x, rook.y);
  const sel = await page.evaluate(() => window.__chess.game.getState().selected);
  const s = await page.evaluate(() => window.__fx.screen(-0.5, 0.45, -0.5)); // pawn on d5
  await clickAt(page, s.x, s.y);
  const cap = await page.evaluate(() => { const st = window.__chess.game.getState(); return { moves: st.moves, fen: st.fen, captured: st.captured.b.length }; });
  const capPass = sel === 'd1' && cap.moves.length === 1 && /x/.test(cap.moves[0]) && cap.captured === 1;
  out.push({ name: 'clicking a capture target piece captures it', pass: capPass, detail: `selected ${sel}, moves ${JSON.stringify(cap.moves)}, black pieces captured ${cap.captured}` });
  log?.(`picking capture: ${capPass ? 'ok' : 'FAIL'}`);
  return out;
}

async function pickMove(page, baseUrl, log) {
  const out = [];
  await position(page, baseUrl, '4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
  const r2 = await page.evaluate(() => window.__fx.screen(-0.5, 0.5, 3.5));
  await clickAt(page, r2.x, r2.y);
  const dest = await page.evaluate(() => window.__fx.screen(-0.5, 0, 0.5)); // empty square d4
  await clickAt(page, dest.x, dest.y);
  const mv = await page.evaluate(() => window.__chess.game.getState().moves);
  const mvPass = mv.length === 1 && mv[0] === 'Rd4';
  out.push({ name: 'clicking an empty legal target square moves', pass: mvPass, detail: `moves ${JSON.stringify(mv)} (want Rd4)` });
  log?.(`picking move: ${mvPass ? 'ok' : 'FAIL'}`);
  return out;
}

// ---------------------------------------------------------------- (c) trays vs HUD
// Projects the two capture tray volumes (slab footprint, tall enough for the captured pieces) to the screen and
// compares the bounding rectangles against every visible HUD card and the viewport.
const TRAY_SIZES = [[1280, 720], [1280, 800], [1400, 788], [1600, 900], [1920, 1080]];
async function checkTrays(page, baseUrl, log, [width, height]) {
  const out = [];
  {
    // a fresh load per size: a live resize leaves the camera framing of the old size (clearances differ from a fresh load), and repeated resizes can crash headless Chrome
    await load(page, baseUrl, 'moves=e2e4,d7d5,e4d5,d8d5,b1c3,d5a5', { width, height });
    const r = await page.evaluate(() => {
      const { THREE, stage, gimbal } = window.__chess;
      stage.scene.updateMatrixWorld(true);
      stage.camera.updateMatrixWorld(true);
      const slabs = [];
      gimbal.traverse((o) => { if (o.name === 'tray-slab') slabs.push(o); });
      const trays = slabs.map((s) => {
        const b = new THREE.Box3().setFromObject(s);
        b.max.y = 1.4; // captured pieces stand on the slab (scaled to 0.62, king about 1.4 tall at most)
        let l = Infinity, t = Infinity, rr = -Infinity, bt = -Infinity;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(stage.camera);
          const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight;
          l = Math.min(l, sx); rr = Math.max(rr, sx); t = Math.min(t, sy); bt = Math.max(bt, sy);
        }
        return { side: b.min.x < 0 ? 'left' : 'right', l, t, r: rr, b: bt };
      });
      const cards = [...document.querySelectorAll('#hud .card, #hud .panel')].map((e) => {
        const q = e.getBoundingClientRect();
        return { name: e.dataset.card || e.className, l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height };
      }).filter((c) => c.w > 0 && c.h > 0);
      return { trays, cards, vw: innerWidth, vh: innerHeight };
    });
    const problems = [];
    for (const t of r.trays) {
      if (t.l < 0 || t.t < 0 || t.r > r.vw || t.b > r.vh) problems.push(`${t.side} tray leaves the viewport`);
      for (const c of r.cards) {
        if (t.l < c.r && t.r > c.l && t.t < c.b && t.b > c.t) problems.push(`${t.side} tray [${Math.round(t.l)}-${Math.round(t.r)} x ${Math.round(t.t)}-${Math.round(t.b)}] overlaps card ${c.name} [${Math.round(c.l)}-${Math.round(c.r)} x ${Math.round(c.t)}-${Math.round(c.b)}]`);
      }
    }
    const pass = r.trays.length === 2 && r.cards.length > 0 && problems.length === 0;
    const gaps = r.trays.map((t) => `${t.side} ${Math.round(t.side === 'left' ? t.l - Math.max(...r.cards.filter((c) => c.l < r.vw / 2).map((c) => c.r)) : Math.min(...r.cards.filter((c) => c.l >= r.vw / 2).map((c) => c.l)) - t.r)}px`).join(', ');
    out.push({ name: `trays clear of HUD at ${width}x${height}`, pass, detail: pass ? `no overlap, clearance to HUD: ${gaps}` : problems.join('; ') || 'tray or card not found' });
    log?.(`trays ${width}x${height}: ${pass ? 'ok' : 'FAIL'}`);
  }
  return out;
}

// ---------------------------------------------------------------- (d) device: start tier, ?touch, context loss
// Loads with its own flags (no quality=low unless asked), still manual=1 and ai=0. Small viewport to stay fast.
async function loadRaw(page, baseUrl, query) {
  await page.setViewport({ width: 800, height: 500 });
  await page.goto(`${baseUrl}/?manual=1&ai=0&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000, polling: 100 });
  return page.evaluate(() => ({ touchClass: document.body.classList.contains('touch'), quality: window.__chess.stage.quality, select: document.querySelector('#sel-quality').value }));
}

const DEVICE_CASES = [
    ['default load starts on high without the touch class', '', (r) => r.quality === 'high' && !r.touchClass && r.select === 'high'],
    ['?touch=1 sets the touch class and starts on medium', 'touch=1', (r) => r.quality === 'medium' && r.touchClass && r.select === 'medium'],
    ['?touch=0 behaves like the default', 'touch=0', (r) => r.quality === 'high' && !r.touchClass],
    ['?touch=1&quality=low starts on low', 'touch=1&quality=low', (r) => r.quality === 'low' && r.touchClass],
];

async function checkDevice(page, baseUrl, log, [name, query, ok]) {
  const r = await loadRaw(page, baseUrl, query);
  const pass = !!ok(r);
  log?.(`device ${query || 'default'}: ${pass ? 'ok' : 'FAIL'}`);
  return [{ name, pass, detail: `quality ${r.quality}, touch class ${r.touchClass}` }];
}

async function checkContextLoss(page, baseUrl, log) {
  const out = [];
  // forced context loss and restore: the board must render again and nothing may log an error
  const errs = [];
  const onErr = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); };
  page.on('console', onErr);
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  try {
    await loadRaw(page, baseUrl, 'quality=low');
    const readFrame = () => page.evaluate(() => {
      const { stage } = window.__chess, gl = stage.renderer.getContext();
      window.__chess.draw();
      const W = gl.canvas.width, H = gl.canvas.height, buf = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let sum = 0, sum2 = 0, n = 0; const seen = new Set();
      for (let i = 0; i < buf.length; i += 16) { const l = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; sum += l; sum2 += l * l; n++; seen.add(((buf[i] >> 3) << 10) | ((buf[i + 1] >> 3) << 5) | (buf[i + 2] >> 3)); }
      const mean = sum / n;
      return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), colors: seen.size, lost: stage.contextLost };
    });
    const before = await readFrame();
    await page.evaluate(() => {
      const gl = window.__chess.stage.renderer.getContext();
      window.__lose = gl.getExtension('WEBGL_lose_context');
      window.__lose.loseContext();
    });
    await page.waitForFunction('window.__chess.stage.contextLost === true', { timeout: 10000, polling: 100 });
    await page.evaluate(() => { window.__chess.draw(); });   // drawing while lost must be a quiet no-op
    await page.evaluate(() => window.__lose.restoreContext());
    await page.waitForFunction('window.__chess.stage.contextLost === false', { timeout: 30000, polling: 100 });
    await page.evaluate(() => { window.__chess.step(1); });
    const after = await readFrame();
    const pass = before.std > 8 && after.std > 8 && after.colors > 40 && after.mean > 8 && !after.lost && errs.length === 0;
    out.push({
      name: 'board renders again after a lost and restored WebGL context, no console error',
      pass,
      detail: `before std ${before.std.toFixed(0)} colors ${before.colors}, after std ${after.std.toFixed(0)} colors ${after.colors} mean ${after.mean.toFixed(0)}, errors ${errs.length ? errs.join(' | ') : 'none'}`,
    });
    log?.(`device context loss: ${pass ? 'ok' : 'FAIL'}`);
  } finally { page.off('console', onErr); }
  return out;
}

// ---------------------------------------------------------------- (e) camera fit: zero insets fit like a small margin
// setFrame({}) must fit the board into the whole canvas as large as setFrame with an 8 px inset (r23 finding 7: 11.4 against 27 percent).
async function checkFrameFit(page, baseUrl, log) {
  await load(page, baseUrl, '', { width: 1280, height: 720 });
  const r = await page.evaluate(() => {
    const { THREE, stage, controls } = window.__chess;
    const share = (insets) => {
      controls.setFrame(insets);
      stage.scene.updateMatrixWorld(true); stage.camera.updateMatrixWorld(true);
      let l = Infinity, rr = -Infinity;
      for (const x of [-4, 4]) for (const z of [-4, 4]) { const p = new THREE.Vector3(x, 0, z).project(stage.camera); const sx = (p.x + 1) / 2 * innerWidth; l = Math.min(l, sx); rr = Math.max(rr, sx); }
      return (rr - l) / innerWidth * 100;
    };
    const zero = share({}), small = share({ left: 8, right: 8, top: 8, bottom: 8 });
    return { zero, small };
  });
  const pass = r.zero > 0 && Math.abs(r.zero - r.small) < 2 && r.zero > 20;
  log?.(`frame fit: ${pass ? 'ok' : 'FAIL'}`);
  return [{ name: 'setFrame with zero insets fits the board as large as with an 8 px inset', pass, detail: `board width ${r.zero.toFixed(1)}% (zero) against ${r.small.toFixed(1)}% (8 px)` }];
}

// Phone Help lists only things the bar or the touch controls really have: no Flip/Wenden row (CHE-158 removed that button).
async function checkPhoneHelp(page, baseUrl, log) {
  const out = [];
  for (const lang of ['en', 'de']) {
    await load(page, baseUrl, 'touch=1', { width: 390, height: 844 });
    await page.evaluate((l) => localStorage.setItem('chess3d.lang', l), lang);
    await load(page, baseUrl, 'touch=1', { width: 390, height: 844 });
    const rows = await page.evaluate(() => [...document.querySelectorAll('#phone-keys dt')].map((e) => e.textContent.trim()));
    const pass = rows.length >= 4 && !rows.some((x) => /^(flip|wenden)$/i.test(x));
    out.push({ name: `phone Help has no Flip row (${lang})`, pass, detail: rows.join(', ') });
  }
  await page.evaluate(() => localStorage.removeItem('chess3d.lang'));
  log?.(`phone help: ${out.every((o) => o.pass) ? 'ok' : 'FAIL'}`);
  return out;
}

// One unit of work is one fresh page load plus its checks. Units are independent, so they run in several tabs of the one browser
// when the caller passes newPage; results keep the order of the units either way.
const UNITS = [
  ['labels', checkLabels],
  ['picking', checkPicking],
  ...TRAY_SIZES.map((a) => ['trays', checkTrays, a]),
  ...DEVICE_CASES.map((a) => ['device', checkDevice, a]),
  ['device', checkContextLoss],
  ['frame', checkFrameFit],
  ['phone', checkPhoneHelp],
];

export async function runFixChecks({ page, baseUrl, log = () => {}, newPage = null, tabs = 4, part = '' }) {
  const [pi, pn] = part ? part.split('/').map(Number) : [0, 1];   // part 'i/n' runs every n-th unit, so groups can run in separate browsers
  const units = UNITS.filter((u, i) => i % pn === pi);
  const results = units.map(() => []);
  let next = 0;
  const worker = async (pg) => {
    for (;;) {
      const i = next++;
      if (i >= units.length) return;
      const [name, fn, arg] = units[i];
      try {
        results[i] = await fn(pg, baseUrl, log, arg);
      } catch (err) {
        results[i] = [{ name: `${name} checks ran`, pass: false, detail: String(err && err.stack || err).slice(0, 400) }];
      }
    }
  };
  const pages = [page];
  const own = [];
  try {
    for (let k = 1; newPage && k < Math.min(tabs, units.length); k++) { const p = await newPage(); own.push(p); pages.push(p); }
    await Promise.all(pages.map(worker));
  } finally { for (const p of own) await p.close().catch(() => {}); }
  return results.flat();
}
