// Extra film shots for the showcase (CHE-374), in the same contract as SHOTS in ./camera.js: a factory taking its options
// plus `fit` returns { name, dur, pose(u, t, out), ease? }. pose writes out.pos and out.look in gimbal space (one square =
// 1.0, y up, board top at y = 0, white starts at +z). u arrives eased (inOut unless the shot names its own ease).
// Design rules (checked by test/showcase-shots.mjs): never below y 1.3 within 1.2 squares of a square, never below y 0.5,
// never further than about 22 * fit.wide from the board centre, at least 1.5 from the look point, no jumps.
import * as THREE from 'three';
import { squarePos, ease } from './camera.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
const UP = new THREE.Vector3(0, 1, 0);
const orbitPos = (out, c, yaw, dist, h) => out.set(c.x + Math.sin(yaw) * dist, c.y + h, c.z + Math.cos(yaw) * dist);
// a flat unit direction from a to b, or the fallback when the two coincide
function flatDir(a, b, fallback) {
  const d = b.clone().sub(a).setY(0);
  return d.lengthSq() < 1e-6 ? fallback.clone() : d.normalize();
}
// the flat direction from the board centre out through a square (towards white for the centre squares)
const outward = (c) => flatDir(new THREE.Vector3(), c, new THREE.Vector3(0, 0, 1));

export const EXTRA_SHOTS = {
  // on a check: from behind the attacker's line the camera slowly pushes in on the checked king, tilting down a little
  pushin({ at, from = null, dur = 2.6, fit }) {
    const k = squarePos(at);
    const dir = from != null ? flatDir(squarePos(from), k, outward(k).negate()) : outward(k).negate();
    dir.applyAxisAngle(UP, 18 * DEG);    // a little off the line, so the attacker never hides the king
    const sc = Math.sqrt(fit.close);
    return { name: 'pushin', dur, pose(u, t, o) {
      o.pos.copy(k).addScaledVector(dir, -lerp(8, 3.2, u) * fit.close).setY(lerp(4.2, 2.45, u) * sc);
      o.look.copy(k).setY(lerp(0.9, 1.35, u));
    } };
  },
  // tight on a piece, then back and up in one curve until the whole board is in the frame
  reveal({ at, dur = 3, fit }) {
    const c = squarePos(at), mid = new THREE.Vector3(0, 0.3, 0);
    const out = outward(c), yaw0 = Math.atan2(out.x, out.z) + 30 * DEG;
    const centre = new THREE.Vector3();
    return { name: 'reveal', dur, pose(u, t, o) {
      const h = 1 - Math.pow(1 - u, 1.6);   // the rise leads the pull back a little: the curve
      centre.lerpVectors(c, mid, u).setY(0);
      orbitPos(o.pos, centre, yaw0 + 20 * DEG * u, lerp(2.2 * fit.close, 15 * fit.wide, u), lerp(1.6, 10 * Math.sqrt(fit.wide), h));
      o.look.lerpVectors(c.clone().setY(0.7), mid, u);
    } };
  },
  // low behind the moving piece, travelling with it and looking past where it goes
  lowtrack({ from, to, color = 'w', dur = 2.4, fit }) {
    const a = squarePos(from), b = squarePos(to);
    const fwd = flatDir(a, b, new THREE.Vector3(0, 0, color === 'w' ? -1 : 1));
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const look = b.clone().addScaledVector(fwd, 3).setY(0.45);
    const p = new THREE.Vector3();
    return { name: 'lowtrack', dur, pose(u, t, o) {
      p.lerpVectors(a, b, u);
      o.pos.copy(p).addScaledVector(fwd, -2.6 * fit.close).addScaledVector(side, 0.35).setY(1.6 * Math.sqrt(fit.close));
      o.look.copy(look);
    } };
  },
  // a fast pan round the board from high and wide, for the cuts of a montage
  whip({ yaw0 = 0, yaw1 = 90 * DEG, dur = 0.9, fit }) {
    const c = new THREE.Vector3(0, 0.3, 0);
    return { name: 'whip', dur, pose(u, t, o) {
      orbitPos(o.pos, c, lerp(yaw0, yaw1, u), 15 * fit.wide, 8.5 * Math.sqrt(fit.wide));
      o.look.copy(c);
    } };
  },
  // after a big sacrifice: a slow rising spiral round the square, the look drifting out to the whole board
  spiral({ at, dur = 4, fit }) {
    const c = squarePos(at), mid = new THREE.Vector3(0, 0.3, 0);
    const out = outward(c);
    const yaw0 = Math.atan2(out.x, out.z) - 40 * DEG;
    const centre = new THREE.Vector3();
    return { name: 'spiral', dur, ease: ease.sine, pose(u, t, o) {
      centre.lerpVectors(c, mid, 0.5 * u).setY(0);
      orbitPos(o.pos, centre, yaw0 + 150 * DEG * u, lerp(2.6 * fit.close, 12 * fit.wide, u), lerp(1.5, 8 * Math.sqrt(fit.wide), u));
      o.look.lerpVectors(c.clone().setY(0.6), mid, clamp(u * 1.1, 0, 1));
    } };
  },
};
