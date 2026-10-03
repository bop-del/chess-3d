// Play view follow camera (M9): in the Play view (phone portrait) the board is framed close, so the camera glides
// sideways whenever something happens off screen. On select it centres the piece and all its legal targets, after a move
// it keeps the move squares in view until the pieces have landed and then settles back, the computer's reply is followed
// the same way, and the hint arrow (Explain, Drill, Practise) is kept on screen. The glide itself is controls.setFocus.
import * as THREE from 'three';

const sqX = (sq) => (sq & 7) - 3.5;
const sqZ = (sq) => 3.5 - (sq >> 3);
const MARGIN = 26;           // px kept free around the squares that must stay on screen
const PIECE_H = 1.9;         // a king is 1.85 tall: its head must not end up under the HUD
const HOLD = 0.55;           // seconds a finished move stays framed before the camera settles
const GLIDE = 0.55;
const LEARN_PITCH = 60 * Math.PI / 180;   // steeper than the Play view's 40 degrees while learning
const FRAME_REF = 19;       // controls.js: the neutral distance the framed fit is made for
const LEARNING = ['explaining', 'drilling', 'puzzling'];   // body classes while Explain, Drill, Practise or a Puzzle runs
export const HOME_FOCUS = { x: 0, z: 0.8 };   // the Play view's resting look point: towards the player's side, so his pieces fill the lower half
const HOME_LIFT = 2.2;   // plus a lift along the view's up axis: the board slides down into the band above the thumb bar

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _f = new THREE.Vector3();
const scratch = new THREE.PerspectiveCamera();

/**
 * The focus that puts every square in `squares` (engine indices, the first one is a piece whose top counts too) inside
 * the free rectangle: { x, z, zoom }. x and z are the board plane offset of the look target from the home framing, zoom
 * is 1 or a pull back factor when the squares do not fit at the home distance (a queen with targets on both wings).
 * `at` is the focus the camera is at now. A focus move is a rigid translation of the camera, a zoom scales its distance
 * from the look target. The result is never null: the caller compares it with HOME_FOCUS.
 *   camera, w, h   the live camera and the canvas size in px
 *   free           { top, right, bottom, left } insets of the free canvas area in px
 */
export function solveFocus({ camera, w, h, free = {}, squares, at = { x: 0, z: 0 } }) {
  if (!squares.length) return { ...HOME_FOCUS, zoom: 1 };
  camera.updateMatrixWorld(true);
  const L = (free.left || 0) + MARGIN, R = w - (free.right || 0) - MARGIN;
  const T = (free.top || 0) + MARGIN, B = h - (free.bottom || 0) - MARGIN;
  const pts = [];
  squares.forEach((sq, i) => {
    const cx = sqX(sq), cz = sqZ(sq);
    for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) {
      pts.push([cx + dx, 0, cz + dz]);
      if (i === 0) pts.push([cx + dx * 0.4, PIECE_H, cz + dz * 0.4]);
    }
  });
  // the point of the board plane the camera looks at
  camera.getWorldDirection(_f);
  const tt = (0.15 - camera.position.y) / (_f.y || -1e-6);
  _t.copy(camera.position).addScaledVector(_f, tt);
  scratch.copy(camera, false);
  scratch.quaternion.copy(camera.quaternion);
  const view = (fx, fz, k) => {
    // camera as it would be with focus offset (fx, fz) from now and zoom k: the target moves, the distance scales
    scratch.position.set(_t.x + fx + (camera.position.x - _t.x) * k, _t.y + (camera.position.y - _t.y) * k, _t.z + fz + (camera.position.z - _t.z) * k);
    scratch.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y, z] of pts) {
      _v.set(x, y, z).project(scratch);
      const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
    return { x0, x1, y0, y1 };
  };
  const shift = (lo, hi, a, b) => (hi - lo > b - a ? (a + b) / 2 - (lo + hi) / 2 : lo < a ? a - lo : hi > b ? b - hi : 0);
  const E = 0.25;
  let fx = 0, fz = 0, k = 1;
  for (; k < 3.2; k *= 1.06) {
    for (let pass = 0; pass < 5; pass++) {
      const e = view(fx, fz, k);
      const dsx = shift(e.x0, e.x1, L, R), dsy = shift(e.y0, e.y1, T, B);
      if (Math.abs(dsx) < 0.5 && Math.abs(dsy) < 0.5) break;
      // pixels the box moves per unit of focus move along x and z (a focus move of +d moves the picture by -d)
      const ex = view(fx + E, fz, k), ez = view(fx, fz + E, k);
      const a = (ex.x0 + ex.x1 - e.x0 - e.x1) / 2 / E, b = (ez.x0 + ez.x1 - e.x0 - e.x1) / 2 / E;
      const c = (ex.y0 + ex.y1 - e.y0 - e.y1) / 2 / E, d = (ez.y0 + ez.y1 - e.y0 - e.y1) / 2 / E;
      const det = a * d - b * c;
      if (Math.abs(det) < 1e-6) break;
      fx += (d * dsx - b * dsy) / det; fz += (-c * dsx + a * dsy) / det;
    }
    const e = view(fx, fz, k);
    if (e.x0 >= L - 1 && e.x1 <= R + 1 && e.y0 >= T - 1 && e.y1 <= B + 1) break;
  }
  const out = { x: at.x + fx, z: at.z + fz, zoom: k };
  const lim = (v) => Math.max(-4, Math.min(4, v));
  out.x = lim(out.x); out.z = lim(out.z);
  return out;
}

export function createPlayView({ controls, game, views, device, stage = null, hint = null, size = null }) {
  let st = game.getState();
  let follow = null;            // { squares, t } while a move is kept in view
  let shownKey = '';            // what the camera was last sent to
  let at = { ...HOME_FOCUS };   // where the camera focus is (commanded)
  let wasActive = false, entered = false;
  let before = null;            // the camera pose before a learning mode took over: { pitch, dist }

  const isPlay = () => views.current() === 'play';
  const canvasSize = () => size?.() || { w: window.innerWidth, h: window.innerHeight };
  const cam = () => stage?.camera || null;

  game.on('change', (s) => { st = s; });
  game.on('move', (rec) => {
    st = game.getState();
    follow = { squares: [rec.m.from, rec.m.to], t: 0 };
  });
  game.on('undo', () => { follow = null; });

  // every visible move hint on the board (Explain, Drill, Practise and Good move each own one): a group named 'move-hint'
  // whose first two children mark the from and the to square
  function hintSquares() {
    const root = window.__chess?.gimbal;
    const groups = hint ? [hint.group] : (root?.children || []).filter((g) => g.name === 'move-hint');
    const sq = (m) => Math.round(3.5 - m.position.z) * 8 + Math.round(m.position.x + 3.5);
    const out = [];
    for (const g of groups) if (g && g.visible && g.children.length >= 2) out.push(sq(g.children[0]), sq(g.children[1]));
    return out.length ? out : null;
  }
  function wanted() {
    const out = [];
    if (st.selected) {
      const from = game.nameSq(st.selected);
      out.push(from);
      for (const m of game.chess.moves()) if (m.from === from && !out.includes(m.to)) out.push(m.to);
    }
    if (follow && out.length === 0) out.push(...follow.squares);
    if (out.length === 0) { const h = hintSquares(); if (h) out.push(...h); }
    return out;
  }
  function setFocus(f, dur = GLIDE) {
    const to = f || { ...HOME_FOCUS, zoom: 1 };
    at = { x: to.x, z: to.z };
    controls.setFocus?.({ x: to.x, z: to.z }, { dur, zoom: to.zoom || 1, lift: HOME_LIFT });
  }
  function settle(dur) { shownKey = ''; follow = null; setFocus(null, dur); }
  function leave() { before = null; shownKey = ''; follow = null; at = { ...HOME_FOCUS }; controls.setFocus?.(null, { dur: GLIDE }); }

  function update(dt) {
    const active = isPlay();
    if (!active) { if (wasActive) { wasActive = false; leave(); } return; }
    if (!wasActive) { wasActive = true; settle(entered ? GLIDE : 0); entered = true; }   // the first entry is instant: no glide at load
    if (follow && !game.busy) { follow.t += dt; if (follow.t > HOLD) follow = null; }
    // learning: the whole board between the text card and the learning bar (the frame insets say where), the camera straight and
    // still, no follow. The framed fit puts the whole board in the free area at the neutral distance; a steeper pitch spends the
    // height the card leaves on a bigger board. Leaving gives the Play view's own pose back.
    if (LEARNING.some((c) => document.body.classList.contains(c))) {
      follow = null;
      if (!before) {
        const c = controls.camera;
        before = { pitch: c.pitch, dist: c.dist };
        shownKey = 'L';
        at = { x: 0, z: 0 };
        controls.retarget({ pitch: LEARN_PITCH, dist: FRAME_REF }, GLIDE);
        controls.setFocus?.({ x: 0, z: 0 }, { dur: GLIDE, zoom: 1, lift: 0 });
      }
      return;
    }
    if (before) {
      controls.retarget({ pitch: before.pitch, dist: before.dist }, GLIDE);
      before = null; shownKey = ''; at = { ...HOME_FOCUS };
      controls.setFocus?.(null, { dur: GLIDE });
      controls.setFocus?.({ ...HOME_FOCUS }, { dur: GLIDE, zoom: 1, lift: HOME_LIFT });
    }
    st = game.getState();     // polled: a scripted select (selectSquare) raises no change event
    const sq = wanted();
    const key = sq.join(',');
    if (key === shownKey) return;
    shownKey = key;
    const camera = cam();
    if (!sq.length || !camera) { setFocus(null); return; }
    const { w, h } = canvasSize();
    setFocus(solveFocus({ camera, w, h, free: controls.frame, squares: sq, at }));
  }

  return {
    update,
    get focus() { return { ...at }; },
    get home() { return { ...HOME_FOCUS }; },
    dispose() { leave(); },
  };
}
