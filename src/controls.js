// Camera orbit + board gimbal controls.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

export const PRESETS = {
  'White view': { yaw: 0, pitch: 46 * DEG, dist: 19 },
  'Black view': { yaw: Math.PI, pitch: 46 * DEG, dist: 19 },
  'Top down': { yaw: 0, pitch: 89.4 * DEG, dist: 19.5 },
  'Side': { yaw: 0, pitch: 7 * DEG, dist: 20 },
  'Isometric': { yaw: 45 * DEG, pitch: 35.264 * DEG, dist: 20 },
};
const HOME = PRESETS['White view'];

export function createControls({ stage, gimbal, canvas, onPick, onHover }) {
  const target = new THREE.Vector3(0, 0.15, 0);
  const cam = { yaw: HOME.yaw, pitch: HOME.pitch, dist: HOME.dist };
  const gim = { x: 0, y: 0, z: 0 };            // radians
  const vel = { yaw: 0, pitch: 0 };
  const limits = { minDist: 6, maxDist: 40, minPitch: 1.5 * DEG, maxPitch: 89.6 * DEG };
  let spin = false;
  let tw = null;                                // preset transition
  let focusTw = null;                           // glide of the focus offset
  const focus = { x: 0, z: 0, zoom: 1, lift: 0 };        // board plane shift of the look point (play view follow camera), pull back, and lift: a shift along the view's up axis
  const focusV = new THREE.Vector3();
  let aspect = 1.5;
  let floorT = 1;
  const listeners = [];
  const keys = new Set();
  gimbal.rotation.order = 'YXZ';

  // --------------------------------------------------------------- apply to scene
  // Pull the camera back until the board fits the width (narrow screens), and, on desktop layouts, until the
  // capture trays (outer edge at x = 6.5, near edge about 3.2 units closer to the camera) clear the HUD columns.
  const TRAY_EDGE = 6.6, TRAY_NEAR = 3.2, TAN_V = Math.tan(17.5 * DEG), HUD_GAP = 14;
  let size = { w: 1500, h: 1000 }, hudW = 268;
  let traysOn = true;                           // capture trays shown: the fit leaves room for them (the Captured pieces setting, game.setTrays)
  function fit() {
    let f = (11.5 / (0.63 * aspect)) / HOME.dist;
    if (size.w > 900 && traysOn) {
      const free = size.w / 2 - (hudW + 2 * HUD_GAP);          // pixels from screen centre to the HUD edge
      const depth = (size.h / 2) * TRAY_EDGE / (TAN_V * Math.max(60, free));
      f = Math.max(f, (depth + TRAY_NEAR) / HOME.dist);
    }
    return Math.max(1, f);
  }
  // Phone framing (M3): the HUD tells the camera which part of the canvas is free, as insets in CSS px. The camera fits the
  // board with its pieces (up to y 2.0, a king is 1.85) and both capture trays (x to +-6.5, pieces up to y 1.2) into that rectangle: it picks the distance at which the projected board just fits
  // and slides its target sideways in the view plane so the board sits in the middle of the free area. Zero insets (desktop,
  // tablets) keep the old fit() untouched. cam.dist stays the user's zoom: FRAME_REF is the neutral value (presets are 19 to 20).
  let frame = { top: 0, right: 0, bottom: 0, left: 0 };
  let edgeToEdge = false;                       // easy views: in portrait the board fills the free width almost to the screen edges
  const FRAME_REF = 19, FRAME_MARGIN = 0.03, PORTRAIT_MARGIN = 0.04, EDGE_MARGIN = 0.01, BOARD_CORNERS = 8, TAN_HALF = Math.tan(17.5 * DEG);
  const corners = [];
  for (const x of [-4, 4]) for (const z of [-4, 4]) for (const y of [-0.3, 2.0]) corners.push(new THREE.Vector3(y < 0 ? x * 1.16 : x, y, y < 0 ? z * 1.16 : z));   // the frame foot reaches 4.65
  for (const x of [-6.5, 6.5]) for (const z of [-1.5, 3.45]) for (const y of [-0.3, 1.2]) corners.push(new THREE.Vector3(x, y, z));
  const fTarget = new THREE.Vector3();
  const cFwd = new THREE.Vector3(), cRight = new THREE.Vector3(), cUp = new THREE.Vector3(), cLook = new THREE.Vector3(), cBlend = new THREE.Vector3();
  let cine = null;                              // battle close-up: { yaw, pitch, dist, target, k, tw }
  const gq = new THREE.Quaternion(), gEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const fRight = new THREE.Vector3(), fUp = new THREE.Vector3(), fFwd = new THREE.Vector3();
  const pts = corners.map(() => new THREE.Vector3());
  let framedOn = false;                         // setFrame has been called: even with all insets zero the board is fitted to the free area (no tray-free fit() margin)
  const framed = () => framedOn;
  // returns the distance (before the user's zoom) and the in-plane target shift { sx, sy } in world units
  function frameFit() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    fFwd.set(-cp * Math.sin(cam.yaw), -sp, -cp * Math.cos(cam.yaw));          // camera looks along this
    fRight.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    fUp.crossVectors(fRight, fFwd);                                             // right x forward = up
    if (fUp.y < 0) fUp.negate();
    gq.setFromEuler(gEuler.set(gim.x, gim.y, gim.z, 'YXZ'));
    // portrait: the board with its pieces fills the free width, the capture trays may run off screen; landscape keeps the trays in
    const portrait = size.h > size.w, n = portrait || !traysOn ? BOARD_CORNERS : corners.length;
    for (let i = 0; i < n; i++) pts[i].copy(corners[i]).applyQuaternion(gq).sub(target);
    const freeW = Math.max(40, size.w - frame.left - frame.right) * (1 - (portrait ? (edgeToEdge ? EDGE_MARGIN : PORTRAIT_MARGIN) : FRAME_MARGIN));
    const freeH = Math.max(40, size.h - frame.top - frame.bottom) * (1 - FRAME_MARGIN);
    const P = (size.h / 2) / TAN_HALF;                                          // px per unit at depth 1
    const ox = (frame.left - frame.right) / 2, oy = (frame.top - frame.bottom) / 2; // free centre relative to screen centre, y down
    let sx = 0, sy = 0;
    const extent = (d) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < n; i++) {
        const p = pts[i], a = p.dot(fRight) - sx, b = p.dot(fUp) - sy, depth = d + p.dot(fFwd);
        const px = a * P / depth, py = -b * P / depth;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
      }
      return { x0, x1, y0, y1 };
    };
    let d = 20;
    for (let pass = 0; pass < 4; pass++) {
      let lo = 4, hi = 120;                                                     // smallest distance that still fits
      for (let i = 0; i < 28; i++) {
        const m = (lo + hi) / 2, e = extent(m);
        if (e.x1 - e.x0 <= freeW && e.y1 - e.y0 <= freeH) hi = m; else lo = m;
      }
      d = hi;
      const e = extent(d);
      // move the board's projected centre onto the free centre: shifting the target by s moves the picture by -s * P / d
      sx -= (ox - (e.x0 + e.x1) / 2) * d / P;
      sy += (oy - (e.y0 + e.y1) / 2) * d / P;
    }
    return { d, sx, sy };
  }
  function apply() {
    const camera = stage.camera;
    cam.pitch = clamp(cam.pitch, limits.minPitch, limits.maxPitch);
    cam.dist = clamp(cam.dist, limits.minDist, limits.maxDist);
    let d, look = target, yawV = cam.yaw, pitchV = cam.pitch;
    if (framed()) {
      const f = frameFit();
      d = f.d * cam.dist / FRAME_REF;
      // a world-space shift in the view plane, scaled when the user zooms so the board stays where it was fitted
      const k = cam.dist / FRAME_REF;
      look = fTarget.copy(target).addScaledVector(fRight, f.sx * k).addScaledVector(fUp, f.sy * k);
    } else d = cam.dist * fit();
    d *= focus.zoom;
    if (focus.lift) {
      // lift moves the look point along the screen's up axis: the picture slides down by that much without the camera
      // coming closer to the board (a board plane shift would, which magnifies the near rows)
      if (look === target) look = fTarget.copy(target);
      const cpl = Math.cos(cam.pitch), spl = Math.sin(cam.pitch);
      fFwd.set(-cpl * Math.sin(cam.yaw), -spl, -cpl * Math.cos(cam.yaw));
      fRight.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
      fUp.crossVectors(fRight, fFwd);
      if (fUp.y < 0) fUp.negate();
      look.addScaledVector(fUp, focus.lift * (cam.dist / FRAME_REF));
    }
    if (focus.x || focus.z) {
      if (look === target) look = fTarget.copy(target);
      look.add(focusV.set(focus.x, 0, focus.z).applyQuaternion(gq.setFromEuler(gEuler.set(gim.x, gim.y, gim.z, 'YXZ'))));
    }
    if (cine && cine.k > 0) {
      // battle close-up: blend the normal pose towards the close-up pose. cam is never touched, so at k = 0 the view is exact.
      const k = cine.k;
      let cd = cine.dist, cl = cine.target;
      const freeW = Math.max(40, size.w - frame.left - frame.right), freeH = Math.max(40, size.h - frame.top - frame.bottom);
      cd *= Math.max(1, 0.75 / (freeW / freeH));                                  // narrow free areas pull the camera back
      if (framed()) {
        // put the close-up target in the middle of the free area instead of the middle of the screen
        const cpc = Math.cos(cine.pitch), spc = Math.sin(cine.pitch);
        cFwd.set(-cpc * Math.sin(cine.yaw), -spc, -cpc * Math.cos(cine.yaw));
        cRight.set(Math.cos(cine.yaw), 0, -Math.sin(cine.yaw));
        cUp.crossVectors(cRight, cFwd);
        if (cUp.y < 0) cUp.negate();
        const P = (size.h / 2) / TAN_HALF;
        const ox = (frame.left - frame.right) / 2, oy = (frame.top - frame.bottom) / 2;
        cl = cLook.copy(cl).addScaledVector(cRight, -ox * cd / P).addScaledVector(cUp, oy * cd / P);
      }
      yawV += wrapPi(cine.yaw - yawV) * k;
      pitchV += (cine.pitch - pitchV) * k;
      d += (cd - d) * k;
      look = cBlend.copy(look).lerp(cl, k);
    }
    const cp = Math.cos(pitchV);
    camera.position.set(look.x + d * cp * Math.sin(yawV), look.y + d * Math.sin(pitchV), look.z + d * cp * Math.cos(yawV));
    camera.lookAt(look);
    gimbal.rotation.set(gim.x, gim.y, gim.z, 'YXZ');
    // fade the floor as the board tilts away from horizontal
    const tilt = Math.max(Math.abs(wrapPi(gim.x)), Math.abs(wrapPi(gim.z))) / DEG;
    const t = clamp(1 - (tilt - 8) / 30, 0, 1);
    if (Math.abs(t - floorT) > 0.002) { floorT = t; stage.setFloorVisibility?.(t); }
  }
  const notify = () => listeners.forEach((fn) => fn());

  // --------------------------------------------------------------- presets / transitions
  function animateTo(to, dur = 0.95) {
    const from = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, gx: gim.x, gy: gim.y, gz: gim.z };
    const end = {
      yaw: to.yaw ?? cam.yaw, pitch: to.pitch ?? cam.pitch, dist: to.dist ?? cam.dist,
      gx: to.gx ?? 0, gy: to.gy ?? 0, gz: to.gz ?? 0,
    };
    // shortest way round for every angle
    end.yaw = from.yaw + wrapPi(end.yaw - from.yaw);
    end.gx = from.gx + wrapPi(end.gx - from.gx);
    end.gy = from.gy + wrapPi(end.gy - from.gy);
    end.gz = from.gz + wrapPi(end.gz - from.gz);
    vel.yaw = vel.pitch = 0;
    tw = { t: 0, dur, from, end };
  }
  // Change pitch and distance without touching where the yaw is going: a running turn (Flip) keeps its target, the gimbal stays.
  function retarget({ pitch, dist }, dur = 0.6) {
    if (tw) { tw.end.pitch = pitch ?? tw.end.pitch; tw.end.dist = dist ?? tw.end.dist; return; }
    animateTo({ yaw: cam.yaw, pitch: pitch ?? cam.pitch, dist: dist ?? cam.dist, gx: gim.x, gy: gim.y, gz: gim.z }, dur);
  }
  function setPreset(name) {
    if (!Object.hasOwn(PRESETS, name)) return;
    const p = PRESETS[name];
    if (name === 'White view') side = 'w'; else if (name === 'Black view') side = 'b';
    spin = false;
    animateTo({ ...p });
  }
  let side = 'w';                              // the side of the board at the bottom: set by Flip and the White or Black view, never by orbiting (the Symbols read from it)
  function levelBoard() { animateTo({ yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist }, 0.7); }
  function reset() {
    spin = false;
    animateTo({ ...HOME });
  }
  function flip() {
    side = side === 'w' ? 'b' : 'w';
    // turn the view to the other side of the board, keep pitch and zoom
    const target_ = Math.round(cam.yaw / Math.PI) * Math.PI + Math.PI;
    animateTo({ yaw: target_, pitch: cam.pitch, dist: cam.dist, gx: gim.x, gy: gim.y, gz: gim.z }, 0.9);
  }
  function topDown() { if (hooks.preset) hooks.preset('Top down'); else setPreset('Top down'); }
  function toggleSpin() { if (orbitLocked) return spin; spin = !spin; notify(); return spin; }
  function setGimbal(axis, deg) { tw = null; gim[axis] = deg * DEG; notify(); }
  function nudgeZoom(f) { tw = null; cam.dist = clamp(cam.dist * f, limits.minDist, limits.maxDist); }
  // Lock view: orbit, pinch, twist and wheel do nothing; taps, keys, presets and Reset still work
  function setLocked(v) {
    locked = !!v;
    if (locked) { vel.yaw = vel.pitch = 0; pinch = null; if (drag?.moved) drag = null; }
    notify();
  }
  function setEdgeToEdge(v) { edgeToEdge = !!v; apply(); }
  function setTrays(v) { v = !!v; if (v === traysOn) return; traysOn = v; apply(); }
  function setOrbitLock(v) { orbitLocked = !!v; if (orbitLocked) { vel.yaw = vel.pitch = 0; spin = false; } notify(); }
  function setCamera(v) { tw = null; Object.assign(cam, v); if (v.yaw != null) side = Math.cos(v.yaw) < 0 ? 'b' : 'w'; apply(); }

  // Glide to a pose: opts.pitch / yaw / dist (0.6 s unless opts.dur), the rest of the pose stays. The orbit keeps working afterwards.
  function glideTo(opts = {}) {
    if (opts.pitch != null || opts.yaw != null || opts.dist != null) {
      animateTo({ yaw: opts.yaw ?? cam.yaw, pitch: opts.pitch ?? cam.pitch, dist: opts.dist ?? cam.dist }, opts.dur ?? 0.6);
    }
    apply();
    notify();
  }

  // Focus: shift the look point in the board plane (world x and z, board at y 0) with an eased glide. null goes back to the
  // home framing. Used by the play view's follow camera.
  // opts.zoom >= 1 pulls the camera back by that factor on the fitted distance eased with the focus;
  // opts.lift shifts the look point along the view's up axis (world units at the neutral distance): the board slides down the
  // screen, no closer to the camera. setFocus(null) resets zoom and lift.
  function setFocus(p, { dur = 0.5, zoom = 1, lift = 0 } = {}) {
    const to = p ? { x: p.x, z: p.z, zoom: Math.max(1, zoom), lift } : { x: 0, z: 0, zoom: 1, lift: 0 };
    if (dur <= 0) { focusTw = null; focus.x = to.x; focus.z = to.z; focus.zoom = to.zoom; focus.lift = to.lift; apply(); return; }
    focusTw = { t: 0, dur, from: { x: focus.x, z: focus.z, zoom: focus.zoom, lift: focus.lift }, to };
  }

  // --------------------------------------------------------------- pointer input
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let locked = false;
  let orbitLocked = false;                     // From above: no tilt or turn by drag, twist or keys; zoom and Flip still work
  const TWIST_DEAD = 6 * DEG;                  // a pure pinch wobbles a few degrees: ignore the twist until it is deliberate
  const pairAngle = () => { const [a, b] = [...pointers.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
  let lastMoveT = 0;
  const THRESH = 6;

  function onDown(e) {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, button: e.button, gimbalMode: e.button === 2 || e.shiftKey || e.ctrlKey };
      vel.yaw = vel.pitch = 0;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist, last: pairAngle(), total: 0, turning: false };
      if (drag) drag.moved = true;
    }
  }
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse' && onHover) onHover(e.clientX, e.clientY); return; }
    p.x = e.clientX; p.y = e.clientY;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      if (locked) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      tw = null;
      cam.dist = clamp(pinch.dist * (pinch.d / Math.max(10, d)), limits.minDist, limits.maxDist);
      // twist: the change of the angle between the two fingers turns the board about its vertical axis (clockwise on
      // screen is clockwise seen from above, which is negative gimbal yaw)
      if (orbitLocked) return;
      const ang = pairAngle();
      const dA = wrapPi(ang - pinch.last);
      pinch.last = ang;
      pinch.total += dA;
      if (!pinch.turning && Math.abs(pinch.total) > TWIST_DEAD) { pinch.turning = true; gim.y -= pinch.total - Math.sign(pinch.total) * TWIST_DEAD; }
      else if (pinch.turning) gim.y -= dA;
      if (pinch.turning) notify();
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < THRESH) return;
      drag.moved = true;
      if (!locked) tw = null;
    }
    if (locked || orbitLocked) { drag.lx = e.clientX; drag.ly = e.clientY; return; }
    drag.lx = e.clientX; drag.ly = e.clientY;
    const now = performance.now();
    const dtm = Math.max(1, now - lastMoveT) / 1000;
    lastMoveT = now;
    if (drag.gimbalMode) {
      gim.y += dx * 0.006;
      gim.x += dy * 0.006;
    } else {
      const dyaw = -dx * 0.0055, dpitch = dy * 0.0055;
      cam.yaw += dyaw; cam.pitch += dpitch;
      vel.yaw = clamp(dyaw / dtm, -8, 8) * 0.6 + vel.yaw * 0.4;
      vel.pitch = clamp(dpitch / dtm, -8, 8) * 0.6 + vel.pitch * 0.4;
    }
    notify();
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && e.pointerId === drag.id) {
      const wasClick = !drag.moved && e.type === 'pointerup' && drag.button === 0;
      if (wasClick) onPick?.(e.clientX, e.clientY);
      else if (performance.now() - lastMoveT > 90) vel.yaw = vel.pitch = 0;
      drag = null;
    }
  }
  function onWheel(e) {
    e.preventDefault();
    if (locked || cine) return;
    tw = null;
    const k = e.deltaMode === 1 ? 0.05 : 0.0012;
    cam.dist = clamp(cam.dist * Math.exp(e.deltaY * k), limits.minDist, limits.maxDist);
  }
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // --------------------------------------------------------------- keyboard
  const inField = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '');
  const hooks = {};
  function onKeyDown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || inField(e) || cine) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['q', 'e', 'w', 's', 'a', 'd', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(k)) {
      if (orbitLocked && !['+', '=', '-', '_'].includes(k)) { e.preventDefault(); return; }
      keys.add(k); tw = null; e.preventDefault(); return;
    }
    let handled = true;
    switch (k) {
      case 'r': reset(); break;
      case 'f': flip(); break;
      case 'v': topDown(); break;
      case ' ': toggleSpin(); break;
      case '1': (hooks.preset || setPreset)('White view'); break;
      case '2': (hooks.preset || setPreset)('Black view'); break;
      case '3': (hooks.preset || setPreset)('Top down'); break;
      case '4': (hooks.preset || setPreset)('Side'); break;
      case '5': (hooks.preset || setPreset)('Isometric'); break;
      case 'u': hooks.undo?.(); break;
      case 'n': hooks.newGame?.(); break;
      case 'h': hooks.toggleHud?.(); break;
      case '?': case '/': hooks.toggleHelp?.(); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); if (document.activeElement?.blur && document.activeElement !== document.body) document.activeElement.blur(); }
  }
  function onKeyUp(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.delete(k);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());

  // --------------------------------------------------------------- per-frame update
  function update(dt) {
    let dirty = false;
    if (tw) {
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur), e = easeInOut(u);
      const { from: f, end: n } = tw;
      cam.yaw = f.yaw + (n.yaw - f.yaw) * e;
      cam.pitch = f.pitch + (n.pitch - f.pitch) * e;
      cam.dist = f.dist + (n.dist - f.dist) * e;
      gim.x = f.gx + (n.gx - f.gx) * e;
      gim.y = f.gy + (n.gy - f.gy) * e;
      gim.z = f.gz + (n.gz - f.gz) * e;
      if (u >= 1) tw = null;
      dirty = true;
    }
    if (focusTw) {
      focusTw.t += dt;
      const u = Math.min(1, focusTw.t / focusTw.dur), e = easeInOut(u), { from: f, to: n } = focusTw;
      focus.x = f.x + (n.x - f.x) * e; focus.z = f.z + (n.z - f.z) * e; focus.zoom = f.zoom + (n.zoom - f.zoom) * e; focus.lift = f.lift + (n.lift - f.lift) * e;
      if (u >= 1) focusTw = null;
      dirty = true;
    }
    if (!tw && (!drag || !drag.moved)) {
      if (Math.abs(vel.yaw) > 1e-4 || Math.abs(vel.pitch) > 1e-4) {
        cam.yaw += vel.yaw * dt; cam.pitch += vel.pitch * dt;
        const damp = Math.exp(-dt * 4);
        vel.yaw *= damp; vel.pitch *= damp;
        dirty = true;
      }
      if (spin && !cine) { cam.yaw += dt * 0.35; dirty = true; }
    }
    if (keys.size) {
      const boost = 1;
      const rot = 70 * DEG * dt * boost, orbit = 1.4 * dt, zoom = Math.exp(dt * 1.1);
      if (keys.has('q')) gim.z -= rot;
      if (keys.has('e')) gim.z += rot;
      if (keys.has('w')) gim.x -= rot;
      if (keys.has('s')) gim.x += rot;
      if (keys.has('a')) gim.y -= rot;
      if (keys.has('d')) gim.y += rot;
      if (keys.has('ArrowLeft')) cam.yaw -= orbit;
      if (keys.has('ArrowRight')) cam.yaw += orbit;
      if (keys.has('ArrowUp')) cam.pitch += orbit;
      if (keys.has('ArrowDown')) cam.pitch -= orbit;
      if (keys.has('+') || keys.has('=')) cam.dist /= zoom;
      if (keys.has('-') || keys.has('_')) cam.dist *= zoom;
      dirty = true;
    }
    if (cine?.tw) {
      const c = cine.tw;
      c.t += dt;
      const u = Math.min(1, c.t / c.dur);
      cine.k = c.from + (c.to - c.from) * easeInOut(u);
      dirty = true;
      if (u >= 1) {
        cine.tw = null;
        cine.k = c.to;
        if (c.to === 0) cine = null;
        c.resolve();
      }
    }
    for (const a of ['x', 'y', 'z']) gim[a] = wrapPi(gim[a]);
    apply();
    if (dirty) notify();
  }

  function onResize(w, h) { aspect = w / Math.max(1, h); size = { w, h }; hudW = document.querySelector('#hud .col.left')?.offsetWidth || 268; }
  apply();

  // insets of the free canvas area in CSS px (see the framing block above); the camera re-fits at once
  function setFrame(insets = {}) {
    const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
    framedOn = true;
    frame = { top: n(insets.top), right: n(insets.right), bottom: n(insets.bottom), left: n(insets.left) };
    apply();
  }

  // Battle close-up. cinematic() swoops the camera to a pose around `target` (a point in gimbal space, so it follows the
  // board) and resolves when it arrives; restore() glides back to wherever the normal camera is and resolves when the
  // view is exactly the normal one again. The user's own camera state (cam, gimbal) is never changed in between.
  // Orbit, wheel, keys and spin are ignored while a close-up is held, tw (a preset glide) is left running underneath.
  const settleCine = () => { if (cine?.tw) { const r = cine.tw.resolve; cine.tw = null; r(); } };
  function cinematic({ target: at, yaw = cam.yaw, pitch = 12 * DEG, dist = 7, dur = 0.6 } = {}) {
    settleCine();
    gq.setFromEuler(gEuler.set(gim.x, gim.y, gim.z, 'YXZ'));
    const world = (at ? new THREE.Vector3(at.x, at.y, at.z) : new THREE.Vector3()).applyQuaternion(gq);
    cine = { yaw, pitch: clamp(pitch, 0.5 * DEG, 89 * DEG), dist: Math.max(2, dist), target: world, k: cine ? cine.k : 0, tw: null };
    return new Promise((resolve) => { cine.tw = { t: 0, dur: Math.max(0.001, dur), from: cine.k, to: 1, resolve }; });
  }
  function restore({ dur = 0.6 } = {}) {
    if (!cine) return Promise.resolve();
    settleCine();
    return new Promise((resolve) => { cine.tw = { t: 0, dur: Math.max(0.001, dur), from: cine.k, to: 0, resolve }; });
  }

  return {
    cinematic, restore,
    glideTo, setFocus, setOrbitLock, setEdgeToEdge, setTrays,
    update, apply, setPreset, reset, levelBoard, flip, topDown, toggleSpin, setGimbal, nudgeZoom, setCamera, onResize, setFrame, setLocked, retarget,
    get side() { return side; },
    get trays() { return traysOn; },
    get locked() { return locked; },
    get frame() { return { ...frame }; },
    presets: Object.keys(PRESETS),
    hooks,
    onChange(fn) { listeners.push(fn); },
    get spin() { return spin; },
    get camera() { return { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist }; },
    get gimbalDeg() { return { x: gim.x / DEG, y: gim.y / DEG, z: gim.z / DEG }; },
    get animating() { return !!tw || !!cine; },
    get cinematicActive() { return !!cine; },
    get orbitLocked() { return orbitLocked; },
    get focus() { return { x: focus.x, z: focus.z, zoom: focus.zoom, lift: focus.lift }; },
    get focusing() { return !!focusTw; },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
