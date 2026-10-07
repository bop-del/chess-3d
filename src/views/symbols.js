// Symbols view: every piece becomes a chess diagram symbol (as in chess books) printed flat on its square, on a plain board.
// White symbols are cream with a thick dark outline, black symbols are black with a cream outline band and a thin dark line outside
// it, so black stays visible on dark squares. Every symbol has a small baked drop shadow. The paths are drawn in code (canvas
// Path2D from SVG path syntax), never a font glyph: iOS turns the chess characters into emoji. Each symbol is a plane lying on
// the board, parented to the piece's own group, so it follows every slide and hop. While the view is on, the 3D piece body is
// hidden; the invisible pick cylinder stays, so picking works as before. The board shows plain flat square colours and a simple
// frame taken from the current theme (no veins, grain or inlays), restored when the view is left.
// Outlines are in a 100 x 100 box, y down, base at y 88. Symmetric pieces give the right half only, from the top on the axis
// (x 50) down to the base on the axis; mirrored() adds the left half. Absolute commands M L C Z only.
import * as THREE from 'three';
import { createSkin } from '../themes/apply.js';

const HALF = {
  p: 'M50 13 C58 13 63 18 63 25 C63 31 59.5 35 55.5 37 L55.5 38 C59 39 61 41 61 43.5 C61 46 59 47.5 56 48 C57 56 61 64 67 71 L67 74 C72 75 75 78 75 82 L75 88 L50 88',
  r: 'M50 14 L55.5 14 L55.5 22 L62 22 L62 14 L69.5 14 L69.5 31 L65.5 35 L64 67 L69 71 L69 75 C73 76 75 78 75 81 L75 88 L50 88',
  b: 'M50 7 C53.5 7 55.5 9 55.5 11.5 C55.5 13.5 54 15 52.5 15.5 C61 21 67 30 65 39 C64 44 60.5 47 57.5 48.5 L61 49.5 C63 50.5 63 53.5 60 54.5 L57.5 55 C57 63 59 71 66 76 L66 79 C72 80 74 83 74 85 L74 88 L50 88',
  q: 'M50 8 C53.5 8 55.5 10 55.5 12.5 C55.5 14.5 54 16 52.5 16.5 L55.5 35 L60.5 23 C58.5 21.5 58.5 17.5 62 17 C65.5 16.5 67 20.5 65.5 23 L69 36 L73 26 C71 24.5 71.5 20.5 75 20 C78.5 19.5 80 23.5 78 26 L71.5 54 C65 58 62 60 62 63 C62 70 66 73 69 76 L69 79 C73 80 75 82 75 85 L75 88 L50 88',
  k: 'M50 7 L53.5 7 L53.5 12 L58.5 12 L58.5 17 L53.5 17 L53.5 21 C61 21.5 67 25 68.5 32 C69.5 37 66 41 61 42.5 L61 44 C66 44.5 70 46 70 49 C70 52 67 54 62 54.5 C63 62 66 69 69 74 L69 77 C73 78 75 81 75 84 L75 88 L50 88',
};
// the knight is one outline facing left (head tipped slightly down, long muzzle, scalloped mane), for both colours
const KNIGHT = 'M28 88 L28 83 C28 80 31 78.5 35 78 C37 70 38 62 43 56 C44.5 54 44 51.5 41.5 51 C37 55 31 56 27 54.5 C22 54 17 53 14 50 C11.5 47 12.5 43.5 16 41 L27 27 C29 23 31 19 33 14 L32 6 L39 11 C45 9 50 9 55 11 C63 14 69 22 70 33 C71 44 69 54 68 62 C67 69 69 74 72 78 C75 79 77 81 77 83 L77 88 Z';
// inner detail lines [x1, y1, x2, y2, width?] (opposite ink) and dots [x, y, r]
const LINES = {
  p: [[40, 60, 60, 60], [34, 79, 66, 79]],
  r: [[36, 30, 64, 30], [37, 62, 63, 62], [33, 79, 67, 79]],
  b: [[52, 24, 59, 35], [40, 56, 60, 56], [33, 79, 67, 79]],
  q: [[36, 52, 64, 52], [38, 62, 62, 62], [33, 79, 67, 79]],
  k: [[36, 52, 64, 52], [38, 62, 62, 62], [33, 79, 67, 79]],
  n: [[34, 80, 71, 80, 1.5], [12.5, 50, 24, 53, 1.3], [56, 18, 63, 30, 1.2], [56, 40, 62, 54, 1.2]],
};
const DOTS = { n: [[30.5, 31, 3.3], [14.5, 46.5, 1.1]] };

function parse(d) {
  const t = d.match(/[MLCZ]|-?\d+(\.\d+)?/g);
  let i = 0, start = null;
  const segs = [];
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') start = [num(), num()];
    else if (c === 'L') segs.push({ t: 'L', c: [], p: [num(), num()] });
    else if (c === 'C') { const a = [num(), num()], b = [num(), num()]; segs.push({ t: 'C', c: [a, b], p: [num(), num()] }); }
  }
  return { start, segs };
}
function mirrored({ start, segs }) {
  const mx = (p) => [100 - p[0], p[1]];
  const ends = [start, ...segs.map((s) => s.p)];
  const out = [];
  for (let k = segs.length - 1; k >= 0; k--) {
    const s = segs[k];
    out.push({ t: s.t, c: s.c.slice().reverse().map(mx), p: mx(ends[k]) });
  }
  return { start: mx(ends[ends.length - 1]), segs: out };
}
function outline(type) {
  if (type === 'n') return KNIGHT;
  const r = parse(HALF[type]), l = mirrored(r);
  const f = (p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2);
  let d = 'M' + f(r.start);
  for (const s of [...r.segs, ...l.segs]) d += s.t === 'L' ? ' L' + f(s.p) : ' C' + f(s.c[0]) + ' ' + f(s.c[1]) + ' ' + f(s.p);
  return d + ' Z';
}

const INK = '#15110e', CREAM = '#f6efdc', CREAM_LINE = '#ece3cc';
const SCALE = 0.976;                 // the 100 unit box in squares: the figure fills about 80 percent of the square

// One texture per type and colour (size px square). The white style is A: a thick dark outline.
function drawSymbol(type, color, size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const x = cv.getContext('2d');
  const p = new Path2D(outline(type)), w = color === 'w', K = size / 100;
  x.lineJoin = 'round'; x.lineCap = 'round';
  x.setTransform(K, 0, 0, K, 0, 0);
  x.save();                                       // baked drop shadow, offset towards the viewer
  x.shadowColor = 'rgba(0,0,0,0.8)'; x.shadowBlur = 3.2 * K * 0.6; x.shadowOffsetY = 3.2 * K; x.shadowOffsetX = 1.2 * K;
  x.fillStyle = '#000'; x.fill(p);
  x.restore();
  if (w) {
    x.strokeStyle = INK; x.lineWidth = 9; x.stroke(p);
    x.fillStyle = CREAM; x.fill(p);
    x.strokeStyle = INK; x.lineWidth = 2.1;
    for (const [a, b, c, d, lw] of LINES[type]) { if (lw) x.lineWidth = lw * 1.4; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
    x.fillStyle = INK;
    for (const [a, b, r] of DOTS[type] || []) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  } else {
    x.strokeStyle = 'rgba(8,8,12,0.9)'; x.lineWidth = 9; x.stroke(p);       // thin dark line outside, for light squares
    x.strokeStyle = CREAM; x.lineWidth = 5.4; x.stroke(p);                   // the cream band that keeps it visible on dark squares
    x.fillStyle = '#0c0b0e'; x.fill(p);
    x.save(); x.clip(p); x.strokeStyle = CREAM; x.lineWidth = 3.4; x.stroke(p); x.restore();
    x.strokeStyle = CREAM_LINE; x.lineWidth = 1.5;
    for (const [a, b, c, d, lw] of LINES[type]) { if (lw) x.lineWidth = lw; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
    x.fillStyle = CREAM;
    for (const [a, b, r] of DOTS[type] || []) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Plain square colours and frame per theme (the squares are lit like any matte surface). Unknown themes fall back to Classic.
const PLAIN = {
  classic: { light: '#ddd8ca', dark: '#272b34', frame: '#4a3220' },
  tournament: { light: '#f0eed6', dark: '#58863b', frame: '#8a7358' },
  wood: { light: '#e6c28c', dark: '#97633f', frame: '#5b3822' },
  metal: { light: '#a9acb4', dark: '#4c4e56', frame: '#34373e' },
  glass: { light: '#b4c8d8', dark: '#3a4d62', frame: '#7f93a6' },
};
const flatSpec = (color) => ({
  map: null, normalMap: null, roughnessMap: null, metalnessMap: null, vertexColors: false, metalness: 0, roughness: 0.92, clearcoat: 0,
  envMapIntensity: 0.15, transparent: false, transmission: 0, specularIntensity: 1, color,
});

// createSymbols({ gimbal, game, stage, controls?, themes?, size? }) -> { setVisible(on), sync(dt), fadeOut(obj), dispose(), visible }
//   size is the texture size in px (384, or 256 on a phone). sync() is cheap and safe to call every frame; pieces made after
//   setVisible (promotion) get their symbol at once (root.add is wrapped).
export function createSymbols({ gimbal, game, stage, controls = null, themes = null, size = 384 }) {
  const root = game.root;
  let planeGeo = null;
  let cache = {};
  let mats = [];
  // renderOrder 11: above the highlights (10) so the last move never tints a symbol, below the hint arrow (12)
  const material = (type, color) => cache[type + color] || (cache[type + color] = (() => {
    const m = new THREE.MeshBasicMaterial({ map: drawSymbol(type, color, size), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    mats.push(m);
    return m;
  })());
  let on = false;
  let yaw = 0;
  const holders = new Set();
  const fades = [];   // Pixelwelt: a captured symbol fades out ({ obj, card, orig, t, seen })

  function attach(group) {
    const info = group.userData.piece;
    if (!info || group.userData.sym) return;
    const holder = new THREE.Group();
    holder.name = 'symbol';
    holder.rotation.y = yaw;
    const card = new THREE.Mesh(planeGeo || (planeGeo = new THREE.PlaneGeometry(1, 1)), material(info.type, info.color));
    card.scale.setScalar(SCALE); card.raycast = () => {}; card.renderOrder = 11;
    card.rotation.x = -Math.PI / 2; card.position.set(0, 0.012, 0.033 * SCALE);
    holder.add(card);
    group.add(holder);
    group.userData.sym = holder;
    holders.add(holder);
  }
  function body(group, show) {                     // the 3D piece: everything but the pick cylinder and the symbol
    group.userData.symHid = !show;
    for (const ch of group.children) if (!ch.userData.hit && ch.name !== 'symbol' && ch.name !== 'token') ch.visible = show;
  }
  const eachPiece = (fn) => { for (const ch of root.children) if (ch.userData?.piece) fn(ch); };
  function apply(group) {
    attach(group);
    if (group.userData.sym) group.userData.sym.visible = on;
    body(group, !on);
  }

  const origAdd = root.add;
  root.add = function (...objs) {
    const r = origAdd.apply(this, objs);
    if (on) for (const o of objs) if (o?.userData?.piece) apply(o);
    return r;
  };

  // The reading direction comes from the side at the bottom of the board (controls.side: the played colour, Flip, the White or
  // Black view), never from the camera: orbit, tilt and zoom leave it alone. A change of side turns the symbols once by half a
  // turn, together with the board (the flip glide takes 0.9 s).
  const TURN = 0.9;
  let turn = null;   // { t, from, to }
  const sideYaw = () => (controls?.side === 'b' ? Math.PI : 0);
  const setYaw = (a) => { yaw = a; for (const h of holders) { if (!h.parent) holders.delete(h); else h.rotation.y = yaw; } };
  function orient(dt = 0, snap = false) {
    const to = sideYaw();
    if (snap) { turn = null; if (yaw !== to) setYaw(to); return; }
    if (!turn && Math.abs(yaw - to) > 1e-6) turn = { t: 0, from: yaw, to: yaw + Math.PI };   // always the same way round
    if (!turn) return;
    turn.t += dt;
    const k = Math.min(1, turn.t / TURN), e = k * k * (3 - 2 * k);
    setYaw(turn.from + (turn.to - turn.from) * e);
    if (k >= 1) { turn = null; yaw = to; setYaw(to); }
  }

  // The GTAO pass draws the whole scene with an override material, which would turn the transparent planes into opaque quads in
  // the AO: hide them for that pass (scene.onBeforeRender runs at the start of every render of the scene).
  const beforeRender = (r, scene) => { const show = on && !scene.overrideMaterial; for (const h of holders) h.visible = show; };

  // ---- plain board
  let skin = null;
  const part = (name) => gimbal.getObjectByName(name);
  function flatten() {
    const id = themes?.current?.() || 'classic', P = PLAIN[id] || PLAIN.classic;
    const m = { light: part('squares-light')?.material, dark: part('squares-dark')?.material, frame: part('frame')?.material, plinth: part('plinth')?.material };
    if (!m.light || !m.dark || !m.frame) return;
    skin = createSkin(m);                          // takes the snapshot of the theme as it is now
    skin.apply({ light: flatSpec(P.light), dark: flatSpec(P.dark), frame: { ...flatSpec(P.frame), roughness: 0.8 }, plinth: m.plinth ? { color: P.frame, metalness: 0 } : null });
    for (const n of ['gold-inlay', 'maple-inlay']) { const o = part(n); if (o) o.visible = false; }
  }
  function unflatten() {
    skin?.apply(null); skin = null;
    for (const n of ['gold-inlay', 'maple-inlay']) { const o = part(n); if (o) o.visible = true; }
  }
  // a theme change restores the theme's own look under the flat one: take it again
  const onTheme = () => { if (on) { skin = null; flatten(); } };
  themes?.on?.(onTheme);

  const FADE = 0.5;
  function endFade(f) { f.card.material.dispose(); f.card.material = f.orig; }
  function fadeOut(obj) {
    const card = obj?.group?.userData?.sym?.children[0];
    if (!card || fades.some((f) => f.obj === obj)) return;
    const orig = card.material;
    card.material = orig.clone();   // the shared material of the type stays opaque
    fades.push({ obj, card, orig, t: 0, seen: false });
  }
  function stepFades(dt) {
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i];
      if (f.obj.sq < 0) f.seen = true;
      if (!f.card.parent || (f.seen && f.obj.sq >= 0)) { if (f.card.parent) endFade(f); fades.splice(i, 1); continue; }   // back on the board (undo): opaque again
      f.t += dt;
      f.card.material.opacity = Math.max(0, 1 - f.t / FADE);
    }
  }
  // off: the symbols and their textures go (about 4 MB on a phone), the next entry draws them again
  function release() {
    for (const f of fades.splice(0)) if (f.card.material !== f.orig) f.card.material.dispose();
    eachPiece((g) => { g.userData.sym?.removeFromParent(); g.userData.sym = null; });
    holders.clear();
    for (const m of mats) { m.map?.dispose(); m.dispose(); }
    cache = {}; mats = [];
    planeGeo?.dispose(); planeGeo = null;
  }

  const api = {
    setVisible(v) {
      v = !!v;
      if (v === on) return;
      on = v;
      if (on) { flatten(); stage.scene.onBeforeRender = beforeRender; }
      else { unflatten(); if (stage.scene.onBeforeRender === beforeRender) stage.scene.onBeforeRender = () => {}; }
      eachPiece(apply);
      if (on) orient(0, true); else release();
    },
    fadeOut,
    sync(dt = 0) {
      if (!on) return;
      eachPiece(apply);
      if (fades.length) stepFades(dt);
      orient(dt);
    },
    get visible() { return on; },
    dispose() {
      api.setVisible(false);
      delete root.add;
      release();
    },
  };
  return api;
}

export const __symbols = { outline };
