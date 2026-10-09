// Pixelwelt capture fights and the checkmate finale in the real page (CHE-371, the owner's pick): node test/pixel-fights-page.mjs [--port=5354] [--base=<server>]
// With no flag the Pixelwelt fights rotate per attacker type (two queen captures in a row differ). Every fight, forced by
// ?pixfight=<id>, plays On with blood, then Short with Blood Off and the colours swapped (no red cube), and afterwards the board is clean: no cube left, the victim in the tray, the game not busy,
// and every geometry and texture the scene made is disposed (a tracker over the scene graph and dispose(); renderer.info also
// counts first uploads of scenery). ?pixfight=old plays the earlier pixel gore scene. A mate by either side plays the finale
// (the banner waits), it ends by itself, leaves nothing behind (the same tracker, on a second finale in the page) and shows the
// banner; a key skips it. No console error or warning. quality=low and ?manual=1 so the clock is simulated.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5354').slice(7));
const R = reporter();
const OUT = '.tmp/pixel-fights-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const TYPES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const FIGHT = {
  p: ['4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5'], n: ['4k3/8/8/4b3/8/5N2/8/4K3 w - - 0 1', 'f3', 'e5'],
  b: ['4k3/8/8/4n3/8/2B5/8/4K3 w - - 0 1', 'c3', 'e5'], r: ['k7/8/8/4b3/8/8/K3R3/8 w - - 0 1', 'e2', 'e5'],
  q: ['4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1', 'd1', 'd5'], k: ['7k/8/8/4p3/4K3/8/8/8 w - - 0 1', 'e4', 'e5'],
};
const mirrorFen = (fen) => { const [b, , ...rest] = fen.split(' '); return [b.split('/').reverse().map((r) => r.replace(/[a-z]/gi, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))).join('/'), 'b', ...rest].join(' '); };
const mirrorSq = (sq) => sq[0] + (9 - Number(sq[1]));

const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page, undefined, { scenes: true });
  await page.setViewport({ width: 1280, height: 720 });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const open = async (q) => {
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0&intro=0&theme=pixel${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.stepAsync', { timeout: 120000 });
    await ev(async () => { await window.__chess.battle.ready(); window.__chess.step(1); });
    // leak tracker: every geometry and texture that shows up in the scene during a run must be in the scene again or
    // disposed afterwards (renderer.info counts first uploads of scenery a wide shot reveals, so it cannot tell)
    await ev(() => {
      const c = window.__chess, T = c.THREE, gone = new Set();
      for (const C of [T.BufferGeometry, T.Texture]) { const d = C.prototype.dispose; C.prototype.dispose = function () { gone.add(this.uuid); return d.call(this); }; }
      const all = () => { const m = new Map(); c.stage.scene.traverse((o) => { if (o.geometry) m.set(o.geometry.uuid, `geometry ${o.name || o.parent?.name || o.type}`); for (const mt of [].concat(o.material || [])) for (const k of ['map', 'alphaMap']) if (mt[k]) m.set(mt[k].uuid, `texture ${o.name || o.type}`); }); return m; };
      let before = new Map(), seen = new Map();
      window.__leak = {
        start() { before = all(); seen = new Map(); },
        scan() { for (const [u, n] of all()) if (!before.has(u)) seen.set(u, n); },
        lost() { const now = all(); return [...seen].filter(([u]) => !now.has(u) && !gone.has(u)).map(([, n]) => n); },
      };
    });
  };
  // one capture from a FEN: the peak of small cubes and red cubes, then the state afterwards
  const capture = (fen, from, to, { mode = 'on', gore = true } = {}) => ev(async ({ fen, from, to, mode, gore }) => {
    const c = window.__chess, root = c.game.root, mem = () => ({ ...c.stage.renderer.info.memory });
    const small = () => root.children.filter((o) => o.isMesh && o.geometry?.type === 'BoxGeometry');
    const red = (o) => { const h = o.material?.color?.getHex?.() ?? 0, r = h >> 16, g = (h >> 8) & 255; return r > 0x50 && r > g * 3; };
    c.battle.settings.set({ mode, gore });
    c.game.loadFen(fen); await c.stepAsync(1); c.draw();
    const kids0 = root.children.length, m0 = mem();
    window.__pixfight = null;
    window.__leak.start();
    c.game.move(from, to);
    let peak = 0, peakRed = 0, played = false;
    for (let i = 0; i < 240 && (i < 6 || c.game.busy); i++) {
      await c.stepAsync(0.1);
      if (c.battle.active) played = true;
      const s = small(); peak = Math.max(peak, s.length); peakRed = Math.max(peakRed, s.filter(red).length);
      window.__leak.scan();
      if (i % 5 === 0) c.draw();
    }
    await c.stepAsync(2); c.draw();
    const m1 = mem(), st = c.game.getState();
    return { id: window.__pixfight?.id || null, played, peak, peakRed, kids0, kids1: root.children.length, left: small().length, busy: c.game.busy, audit: c.game.audit(), captured: st.captured.w.length + st.captured.b.length, geo: m1.geometries - m0.geometries, tex: m1.textures - m0.textures, lost: window.__leak.lost() };
  }, { fen, from, to, mode, gore });

  // ---------------------------------------------------------------- ?pixfight=old: the earlier pixel gore scene (also the reference count)
  await open('&pixfight=old');
  const base = await capture(...FIGHT.n);
  R.expect('?pixfight=old: a Pixelwelt capture plays the earlier pixel gore scene', base.played && base.id === 'classic' && base.peakRed > 0 && !base.audit.length && base.left === 0, JSON.stringify({ id: base.id, peak: base.peak, red: base.peakRed }));
  const allow = { geo: Math.max(0, base.geo), tex: Math.max(0, base.tex) };

  // ---------------------------------------------------------------- no flag: the fights rotate per attacker type
  await open('');
  const list = await ev(() => window.__pixfightVariants || []);
  R.expect('no flag: the page has 17 fights, two or three per attacker type', list.length === 17 && Object.keys(TYPES).every((t) => list.filter((v) => v.attacker === t).length >= 2), list.map((v) => v.id).join(' '));
  const q1 = await capture(...FIGHT.q), q2 = await capture(...FIGHT.q);
  R.expect('no flag: two queen captures in a row play two different queen fights', /^queen-/.test(q1.id) && /^queen-/.test(q2.id) && q1.id !== q2.id, `${q1.id} then ${q2.id}`);

  // ---------------------------------------------------------------- every fight (forced by ?pixfight=<id>), On with blood (white attacks)
  for (const v of list) {
    await ev((id) => history.replaceState(null, '', `?quality=low&manual=1&ai=0&theme=pixel&pixfight=${id}`), v.id);   // fights.js reads the flag at each capture
    const [fen, from, to] = FIGHT[v.attacker];
    const r = await capture(fen, from, to);
    R.expect(`${v.id}: plays for the ${TYPES[v.attacker]} with blood, red cubes peak in range`, r.played && r.id === v.id && r.peakRed > 0 && r.peak <= 260, `peak ${r.peak}, red ${r.peakRed}`);
    R.expect(`${v.id}: afterwards no cube left, the victim captured, not busy, the board matches the rules`, r.left === 0 && r.kids1 === r.kids0 && !r.busy && !r.audit.length && r.captured === 1, JSON.stringify({ left: r.left, kids: [r.kids0, r.kids1], busy: r.busy, audit: r.audit, cap: r.captured }));
    R.expect(`${v.id}: disposes what it built (every geometry and texture it made is disposed or still in the scene)`, r.lost.length === 0, r.lost.length ? r.lost.slice(0, 4).join(', ') : `none lost (renderer count ${r.geo}, today's scene ${allow.geo})`);
    // Short, Blood Off, black attacks
    const s = await capture(mirrorFen(fen), mirrorSq(from), mirrorSq(to), { mode: 'short', gore: false });
    R.expect(`${v.id}: Short with Blood Off and black attacking: plays, no red cube at all, clean afterwards`, s.played && s.id === v.id && s.peakRed === 0 && s.left === 0 && !s.busy && !s.audit.length, `peak ${s.peak}, red ${s.peakRed}, left ${s.left}`);
  }

  // ---------------------------------------------------------------- the finale, both sides
  for (const [side, fen, from, to] of [['w', '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'a1', 'a8'], ['b', 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', 'a8', 'a1']]) {
    await open(`&fen=${encodeURIComponent(fen)}`);
    const f = await ev(async ({ fen, from, to }) => {
      const c = window.__chess, root = c.game.root, banner = () => !document.getElementById('banner').hidden;
      // a first finale as a warm up: its wide shot draws scenery the normal camera never shows, and three.js counts a geometry
      // when it is first uploaded; the second finale of the same page is the one measured
      c.game.move(from, to);
      for (let i = 0; i < 400; i++) { await c.stepAsync(1 / 15); if (window.__finale && !window.__finale.running && window.__finale.t > 1) break; }
      c.game.newGame(); c.game.loadFen(fen); await c.stepAsync(1); c.draw();
      window.__finale = null;
      const kids0 = root.children.length, m0 = { ...c.stage.renderer.info.memory };
      window.__leak.start();
      c.game.move(from, to);
      let started = -1, ended = -1, bannerDuring = false, peak = 0;
      for (let i = 0; i < 400; i++) {
        await c.stepAsync(1 / 15);
        window.__leak.scan();
        const fin = window.__finale;
        if (fin?.running && started < 0) started = i;
        if (fin?.running) { bannerDuring = bannerDuring || banner(); peak = Math.max(peak, root.children.length - kids0); }
        if (started >= 0 && !fin?.running) { ended = i; break; }
      }
      await c.stepAsync(0.5); c.draw();
      const m1 = c.stage.renderer.info.memory;
      return { started, ended, len: (ended - started) / 15, bannerDuring, bannerAfter: banner(), side: window.__finale?.side, kids: root.children.length - kids0, geo: m1.geometries - m0.geometries, tex: m1.textures - m0.textures, lost: window.__leak.lost(), peak };
    }, { fen, from, to });
    R.expect(`finale ${side}: a mate starts the finale and the banner waits while it plays`, f.started >= 0 && !f.bannerDuring && f.side === side, JSON.stringify(f));
    R.expect(`finale ${side}: it ends by itself in 3 to 6 s, shows the banner, leaves no object, geometry or texture behind`, f.ended > 0 && f.len >= 3 && f.len <= 6 && f.bannerAfter && f.kids === 0 && !f.lost.length, JSON.stringify({ len: f.len, banner: f.bannerAfter, kids: f.kids, lost: f.lost.slice(0, 4), rendererCount: f.geo }));
  }
  // a key skips the finale
  {
    await open(`&fen=${encodeURIComponent('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')}`);
    await ev(async () => { const c = window.__chess; c.game.move('a1', 'a8'); for (let i = 0; i < 400 && !window.__finale?.running; i++) await c.stepAsync(1 / 15); await c.stepAsync(0.5); });
    await page.keyboard.press('Space');
    const k = await ev(async () => { await window.__chess.stepAsync(0.2); return { running: !!window.__finale?.running, banner: !document.getElementById('banner').hidden }; });
    R.expect('finale: a key skips it, the banner shows at once', !k.running && k.banner, JSON.stringify(k));
  }
  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
