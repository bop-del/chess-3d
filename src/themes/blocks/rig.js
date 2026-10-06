// Turns a box list (vox.js) into a rigged character and animates it: idle (breathe, look around), walk with swinging legs,
// gallop for the knights' mounts. The piece style (createPieceStyle) is what src/pieceset.js asks for pieces while the Blocks
// theme is on. Animation is a pure function of the rig state and the time given to update(dt), so tests that step the clock
// (?manual=1) stay deterministic. A walk is detected from how far the piece moved, so game.js needs no animation calls.
import * as THREE from 'three';
import { Mesher } from './mesher.js';
import { buildVox, V } from './vox.js';
import { moveOf } from './moves.js';

const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];

// ---------------------------------------------------------------- building
// Where a group turns: legs, arms and tails at their top, head and rider at their bottom, hands in the middle.
function pivotOf(tag, parts) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of parts) {
    x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y + p.h);
    z0 = Math.min(z0, p.z - p.d / 2); z1 = Math.max(z1, p.z + p.d / 2);
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (/^(leg|arm|lg|tail)/.test(tag)) return [cx, y1, cz];
  if (tag === 'head' || tag === 'rider') return [cx, y0, cz];
  return [cx, (y0 + y1) / 2, cz];
}

/** One template: a Group named 'rig' (turned to face -z) with one child mesh group per tag, each placed at its pivot. */
export function buildTemplate(color, type, material, build = buildVox, mesherOpts) {
  const vox = build(color, type), U = vox.unit || V;
  const byTag = new Map();
  for (const p of vox.parts) { if (!byTag.has(p.g)) byTag.set(p.g, []); byTag.get(p.g).push(p); }
  const rig = new THREE.Group();
  rig.name = 'rig';
  rig.rotation.y = Math.PI;
  let top = 0;
  for (const [tag, parts] of byTag) {
    const m = new Mesher(mesherOpts);
    for (const p of parts) {
      m.box('vox', (p.x - p.w / 2) * U, p.y * U, (p.z - p.d / 2) * U, p.w * U, p.h * U, p.d * U,
        { color: p.color, uvUnit: U * 2, off: [((p.x * 7 + p.y * 3) % 5) * 0.37, ((p.z * 5 + p.w) % 7) * 0.29] });
      top = Math.max(top, (p.y + p.h) * U);
    }
    const [px, py, pz] = tag === 'body' ? [0, 0, 0] : pivotOf(tag, parts);
    const geo = m.geometries().get('vox');
    geo.translate(-px * U, -py * U, -pz * U);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const g = new THREE.Group();
    g.name = tag;
    if (tag === 'poseSpear' || tag === 'spear') g.visible = false;      // the Pixelwelt pawn's spear pose: only in the capture scene (CHE-273)
    g.position.set(px * U, py * U, pz * U);
    g.add(mesh);
    rig.add(g);
  }
  return { rig, height: top, unit: U };
}

function voxTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const x = c.getContext('2d');
  let a = 15;
  const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) { const v = 240 + Math.round((r() - 0.5) * 18); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(px, py, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------- animation
const rigs = new WeakMap();   // inner group -> rig state
let seedCounter = 1;
const wrapPi = (a) => { const T = Math.PI * 2; a = (a + Math.PI) % T; if (a < 0) a += T; return a - Math.PI; };
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function attach(inner, type, unit = V, height = 1) {
  const rig = inner.children[0];
  const parts = {};
  for (const g of rig.children) parts[g.name] = { o: g, p: g.position.clone() };
  const seed = seedCounter++ * 1.7;
  rigs.set(inner, { rig, parts, type, unit, height, seed, t: seed * 3.1, phi: 0, w: 0, yaw: 0, last: null, sig: null, spin: 0 });
}

function animate(s, dt, speed, dist) {
  const { parts, type, rig, unit: V } = s;
  const knight = type === 'n';
  s.t += dt;
  s.w += (clamp01(speed / 0.7) - s.w) * Math.min(1, dt * 9);
  if (s.w < 0.002) s.w = 0;
  s.phi += dist * (knight ? 4.2 : 7);
  const w = s.w, t = s.t, sd = s.seed, phi = s.phi;
  const idle = 1 - w;
  const breathe = Math.sin(t * 1.9 + sd);
  rig.scale.set(1 - 0.007 * breathe, 1 + 0.016 * breathe, 1 - 0.007 * breathe);
  const legless = !parts.legN && !parts.lgNF;
  rig.position.y = Math.abs(Math.sin(phi)) * (legless ? 0.05 : knight ? 0.02 : 0.026) * w;
  rig.rotation.z = Math.sin(phi) * (legless ? 0.09 : 0.035) * w;
  rig.rotation.x = knight ? Math.sin(phi * 2 + 0.6) * 0.045 * w : 0;

  const critter = !knight && !!parts.legN && !parts.armN;   // critters turn the whole torso, so only a little
  const look = (0.6 * Math.sin(t * 0.55 + sd) + 0.4 * Math.sin(t * 0.91 + sd * 2)) * idle;
  const nod = Math.sin(t * 0.7 + sd * 3) * idle;
  const head = parts.head;
  if (head) {
    const amp = critter ? 0.2 : knight ? 0.4 : 0.55;
    head.o.rotation.y = look * amp;
    head.o.rotation.x = knight ? (nod * 0.05 + Math.sin(phi + 1) * 0.12 * w) : nod * 0.04 + Math.abs(Math.sin(phi)) * 0.03 * w;
    head.o.rotation.z = critter ? Math.sin(t * 0.8 + sd) * 0.03 * idle : 0;
  }
  // two legged walkers: legs swing against each other, arms against their leg, the foot lifts a little
  for (const side of ['N', 'P']) {
    const ph = phi + (side === 'P' ? Math.PI : 0);
    const leg = parts['leg' + side];
    if (leg) {
      const sw = Math.sin(ph), len = leg.p.y / V;                // short legs step more than they turn: a long boot would tip up
      leg.o.rotation.x = sw * (0.2 + 0.17 * len) * w;
      leg.o.position.z = leg.p.z + sw * (1.1 - 0.25 * len) * V * w;
      leg.o.position.y = leg.p.y + Math.max(0, Math.cos(ph)) * 0.45 * V * w;
    }
    const arm = parts['arm' + side];
    if (arm) arm.o.rotation.x = -Math.sin(ph) * 0.65 * w + Math.sin(t * 1.4 + sd + (side === 'P' ? 2 : 0)) * 0.05 * idle;
    const hand = parts['hand' + side];
    if (hand) hand.o.position.y = hand.p.y + (0.5 + 0.5 * Math.sin(t * 3.2 + sd + (side === 'P' ? 1.8 : 0))) * 0.9 * V;
  }
  // horses: a gallop, front pair and back pair
  if (parts.lgNF) {
    const ph = { NF: 0, PF: 0.6, NB: Math.PI, PB: Math.PI + 0.6 };
    for (const k in ph) {
      const leg = parts['lg' + k], a = phi + ph[k];
      leg.o.rotation.x = Math.sin(a) * 0.8 * w;
      leg.o.position.y = leg.p.y + Math.max(0, Math.cos(a)) * 0.6 * V * w;
    }
    if (parts.tail) parts.tail.o.rotation.z = Math.sin(t * 1.3 + sd) * 0.22 * idle + Math.sin(phi) * 0.3 * w;
    if (parts.tail) parts.tail.o.rotation.x = -0.25 * w + Math.sin(phi + 1) * 0.15 * w;
    if (parts.rider) {
      parts.rider.o.position.y = parts.rider.p.y + Math.abs(Math.sin(phi)) * 0.55 * V * w + (0.5 + 0.5 * breathe) * 0.1 * V;
      parts.rider.o.rotation.x = Math.sin(phi + 0.8) * 0.06 * w;
      parts.rider.o.rotation.y = -look * 0.35;
    }
  }
  if (s.sig) runSignature(s, dt);
}

// ---------------------------------------------------------------- signature moves (CHE-238)
// The move (moves.js) is played on top of the idle animation: every frame the parts go back to their base pose first, then the move
// sets what it needs. A walk (the piece got a move) or the end of the move puts everything back.
let sparkGeo = null;
function sparkGeometry() {
  if (!sparkGeo) {
    const m = new Mesher();
    m.box('vox', -0.5, -0.5, -0.5, 1, 1, 1, { color: 0xffe27a, uvUnit: 2 });
    sparkGeo = m.geometries().get('vox');
  }
  return sparkGeo;
}
function resetParts(s) {
  for (const k in s.parts) {
    const { o, p } = s.parts[k];
    o.rotation.set(0, 0, 0); o.position.copy(p); o.scale.set(1, 1, 1);
  }
  s.rig.position.x = 0; s.rig.position.z = 0;
  s.spin = 0;
}
function endSignature(s) {
  resetParts(s);
  s.rig.rotation.x = 0; s.rig.rotation.z = 0;
  if (s.fx) { s.fx.removeFromParent(); }
  s.sig = null;
}
function runSignature(s, dt) {
  const g = s.sig;
  if (s.w > 0.25) { endSignature(s); return; }   // the piece got a move: back to normal at once
  g.t += dt;
  const u = clamp01(g.t / g.move.dur);
  if (u >= 1) { endSignature(s); return; }
  resetParts(s);
  const { parts, unit: U, rig } = s;
  if (!g.k) {
    g.k = {
      P: parts, rig, U, H: s.height,
      has: (n) => !!parts[n],
      rot(n, x, y, z) { const q = parts[n]; if (q) q.o.rotation.set(x, y, z); },
      lift(n, dy) { const q = parts[n]; if (q) q.o.position.y = q.p.y + dy; },
      spin(v) { s.spin = v; },
      stretch(dy, dxz) { rig.scale.y *= 1 + dy; rig.scale.x *= 1 + dxz; rig.scale.z *= 1 + dxz; },
      spark(count, cx, cy, cz, radius, t, mode) {
        if (!s.fx) {
          s.fx = new THREE.Group(); s.fx.name = 'fx';
          s.fxMeshes = [];
          for (let i = 0; i < 8; i++) { const mm = new THREE.Mesh(sparkGeometry(), s.material); s.fx.add(mm); s.fxMeshes.push(mm); }
        }
        if (!s.fx.parent) rig.add(s.fx);
        const on = t >= 0 && t <= 1;
        s.fxMeshes.forEach((mm, i) => {
          mm.visible = on && i < count;
          if (!mm.visible) return;
          const ph = (t * 1.6 + i / count) % 1, a = (i / count) * Math.PI * 2 + t * (mode === 'orbit' ? 5 : 1.5);
          const size = Math.round(Math.sin(Math.PI * ph) * 3) / 3 * 0.075 * (s.height / 1.3);
          const r = radius * (mode === 'orbit' ? 1 : 0.4 + 0.6 * ((i * 0.37) % 1));
          mm.position.set(cx + Math.cos(a) * r, cy + (mode === 'rise' ? ph * 0.45 : mode === 'fall' ? -ph * cy * 0.7 : Math.sin(a * 2) * 0.06), cz + Math.sin(a) * r);
          mm.scale.setScalar(Math.max(size, 0.001));
          mm.rotation.y = a;
        });
      },
    };
  }
  g.move.run(g.k, u);
}

/** Walks all rigs below root (the game's piece group). dt in seconds. */
function update(dt, root) {
  if (!(dt > 0)) return;
  for (const wrap of root.children) {
    const inner = wrap.children[0];
    const s = inner && rigs.get(inner);
    if (!s) continue;
    const p = wrap.position;
    let speed = 0, dist = 0;
    if (s.last) {
      const dx = p.x - s.last.x, dz = p.z - s.last.z, d = Math.hypot(dx, dz);
      if (d < 20 * dt && d > 1e-5) {                     // a jump (undo, a new game) is not a walk
        dist = d; speed = d / dt;
        // face the way it goes: relative to the piece's own turn (knights turn with their rank) and the wrapper's
        if (s.w > 0.3 && !wrap.userData.noTurn) {      // a capture scene may ask a piece to keep its facing (the Pixelwelt pawn with its spear)
          const want = wrapPi(Math.atan2(-dx, -dz) - inner.rotation.y - wrap.rotation.y);
          s.yaw += wrapPi(want - s.yaw) * Math.min(1, dt * 12);
        }
      }
      s.last.set(p.x, p.y, p.z);
    } else s.last = new THREE.Vector3(p.x, p.y, p.z);
    if ((speed === 0 && s.w < 0.3) || wrap.userData.noTurn) s.yaw += wrapPi(0 - s.yaw) * Math.min(1, dt * 8);
    animate(s, dt, speed, dist);
    s.rig.rotation.y = Math.PI + s.yaw + s.spin;
  }
}

// ---------------------------------------------------------------- the style
/** What pieceset.setStyle takes: make(type, color) -> the inner group, height(type, color), update(dt, root), dispose(). */
export function createPieceStyle({ track } = {}, { id = 'blocks', build = buildVox, mesher, makeMaterial, decorate } = {}) {
  const tex = voxTexture();
  track?.(tex);
  const material = makeMaterial ? makeMaterial(tex) : new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.8 });
  const templates = new Map();
  const tpl = (type, color) => {
    const k = type + color;
    if (!templates.has(k)) templates.set(k, buildTemplate(color, type, material, build, mesher));
    return templates.get(k);
  };
  return {
    id,
    make(type, color) {
      const inner = new THREE.Group();
      inner.add(tpl(type, color).rig.clone(true));
      attach(inner, type, tpl(type, color).unit, tpl(type, color).height);
      rigs.get(inner).material = material;
      decorate?.(inner, type, color);
      return inner;
    },
    height: (type, color) => Math.max(0.6, tpl(type, color).height),
    warm(type, color) { tpl(type, color); },
    update,
    dispose() {
      for (const t of templates.values()) t.rig.traverse((o) => o.geometry?.dispose());
      templates.clear();
      material.dispose();
      tex.dispose();
    },
  };
}
/** Plays the signature move of the piece whose inner group is `inner`. Returns its duration in seconds, 0 when it cannot play
 *  (no rig, no such move, one is already running, or the piece is walking). */
export function playSignature(inner) {
  const s = rigs.get(inner);
  const move = s && moveOf(s.type);
  if (!move || s.sig || s.w > 0.25) return 0;
  s.sig = { move, t: 0, k: null };
  return move.dur;
}
export const signatureBusy = (inner) => !!rigs.get(inner)?.sig;
export { TYPES };
