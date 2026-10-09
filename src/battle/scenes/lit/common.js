// Shared moves of the lit capture variants (CHE-369): the smash that ends every scene, a weapon in the attacker's hand and
// the way back to the starting pose. Built on kit-a's stage (createStage: the numbers a and v pose the two pieces) and
// fx-lit (createLit: shards, shock wave, punch in, slow motion).
import * as THREE from 'three';
import { createStage, lerp, bump } from '../kit-a.js';
import { createLit } from '../../fx-lit.js';

export { lerp, bump };
export const inQuad = (k) => k * k;
export const outQuad = (k) => 1 - (1 - k) * (1 - k);
export const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const outBack = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const inBack = (k) => { const c = 1.7; return (c + 1) * k * k * k - c * k * k; };
// how heavy the victim is: 0 pawn, 1 queen
export const HEAVY = { p: 0, n: 0.45, b: 0.5, r: 0.7, q: 1, k: 1 };
// the distance from the victim's centre where the attacker's front touches it
export const touch = (s) => -(s.rbA + s.rbV + 0.04);

export function setup(ctx) {
  const s = createStage(ctx);
  const L = createLit(ctx);
  s.L = L;
  s.w = HEAVY[s.V.type] ?? 0.5;
  s.sfx = (name, opts) => { try { ctx.sfx.play?.(name, opts); } catch (e) { /* sound is optional */ } };
  return s;
}

// The end of every scene: the victim bursts into shards of its own material at `y` (fraction of its height), shards
// fly along the blow (`push`, squares per second along the aim, plus `lift` up), with a flash, sparks, a shock wave,
// the camera punch in and slow motion. Returns at once; the slow motion and the punch run on.
export function smash(ctx, s, { y = 0.5, push = 2, lift = 0, power, up, ring, from, flare = 1, more = 0 } = {}) {
  const { L, aim, v } = s;
  const at = s.centre(y);
  v.on = false;
  s.sfx('crack', { volume: 0.7 });
  s.sfx('shatter');
  // shards stay mostly in frame: a modest push along the blow, more up than out
  const pushV = aim.clone().multiplyScalar(push * 0.5).add(new THREE.Vector3(0, lift, 0));
  L.shatter(s.V.group, { origin: from || at.clone().addScaledVector(aim, -0.25), push: pushV, power: power ?? 1.6 + 0.5 * s.w, up: up ?? 2.8,
    heavy: 1 + 0.25 * Math.max(s.w, more), count: L.low ? 20 + Math.round(6 * Math.max(s.w, more)) : 48 + Math.round(18 * Math.max(s.w, more)) });   // a queen bursts into more and bigger shards than a pawn
  L.impact(at, { size: flare });
  if (ring) L.ring(new THREE.Vector3(at.x, 0, at.z), ring);
  L.slowmo({ k: 0.2, hold: 0.65, release: 0.5 });
  L.punch({ k: 1.3, attack: 0.1, hold: 0.7, release: 0.7 });
  return at;
}

// back to where the game staged the attacker, upright and turned back
export function home(s, dur = 0.5) {
  const { a } = s;
  const d0 = a.d, y0 = a.y, t0 = a.tip, yaw0 = a.yaw, sx = a.sx, sy = a.sy, sz = a.sz;
  return s.tw(dur, (k) => {
    a.d = lerp(d0, -s.run0, k); a.y = lerp(y0, 0, k) + 0.12 * bump(k) * (y0 > 0.05 ? 0 : 1); a.tip = lerp(t0, 0, k);
    a.yaw = lerp(yaw0, 0, k); a.sx = lerp(sx, 1, k); a.sy = lerp(sy, 1, k); a.sz = lerp(sz, 1, k);
  }, inOut);
}

// a weapon in the attacker's hand: a pivot on a mount that follows the attacker; the prop points up the pivot's +y.
// grip: [sideways, up, forward] from the attacker's base in squares. Returns { piv, prop, show(k), tip() }.
export function weapon(s, name, { grip = [0.3, 0.55, 0], length, glow, scale = 1 } = {}) {
  const hand = s.mount(grip[1]);
  const piv = new THREE.Group();
  piv.position.set(grip[0], 0, -grip[2]);
  const prop = s.fx.prop(name, { length, glow });
  piv.add(prop); hand.add(piv);
  piv.scale.setScalar(0.001);
  const tipY = (length ?? 0.85) + 0.3;
  return {
    piv, prop, hand,
    show: (k) => piv.scale.setScalar(Math.max(0.001, k * scale)),
    // the weapon's tip in piece space
    tip() { const p = new THREE.Vector3(0, tipY, 0); prop.updateWorldMatrix(true, false); return s.where({ getWorldPosition: (t) => t.copy(p).applyMatrix4(prop.matrixWorld) }); },
  };
}
