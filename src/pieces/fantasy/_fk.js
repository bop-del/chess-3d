// Shared helpers of the fantasy king, queen and bishop (CHE-367, agent fk): faces, robe surface lookup, oriented parts, shells.
import { THREE, profile, blob, tube } from '../kit.js';

export const PI = Math.PI;
const Z = new THREE.Vector3(0, 0, 1);

/** A matrix that puts a part at p, turns its +z toward dir d, rolls it by roll around d and scales it by s. */
export function aim(p, d, s = 1, roll = 0) {
  const dir = new THREE.Vector3(...d).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(Z, dir);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, roll));
  const sv = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
  return new THREE.Matrix4().compose(new THREE.Vector3(...p), q, sv);
}

/** Unit direction from yaw (around y, 0 = front -z, + toward +x) and pitch (up). */
export function dirOf(yaw, pitch) {
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

/** A point on a sphere (centre c, radius R) in the direction yaw, pitch, pushed out by off. */
export function onSphere(c, R, yaw, pitch, off = 0) {
  const d = dirOf(yaw, pitch);
  return [c[0] + d[0] * (R + off), c[1] + d[1] * (R + off), c[2] + d[2] * (R + off)];
}

/** Radius of a lathe profile (same knots as lathe()) at height y: the outermost crossing. */
export function radiusAt(knots, y) {
  const pts = profile(knots, 160);
  let best = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
      const t = (y - a.y) / (b.y - a.y);
      best = Math.max(best, a.x + (b.x - a.x) * t);
    }
  }
  return best;
}

/** Kind storybook face on a head sphere: dark pupils in accent rings, a round nose, an optional smile. */
export function face(P, c, R, { eyeYaw = 0.36, eyePitch = 0.12, eyeR = 0.024, nose = 0.032, smile = true, smileR = 0.04, brows = false, ringT = 0.2, disc = false, browSlot = 'body' } = {}) {
  P.mirror((sx) => {
    const d = dirOf(eyeYaw * sx, eyePitch);
    // a soft eye socket, the pupil sits in it, a thin gold ring around it
    if (disc) {
      // a filled gold oval with a dark pupil sunk into it and a tiny gold glint
      P.add(blob(eyeR, 16, 10), 'accent', { m: aim(onSphere(c, R, eyeYaw * sx, eyePitch, -eyeR * 0.3), d, [1, 1.3, 0.5]) });
      P.add(blob(eyeR * 0.62, 12, 8), 'dark', { m: aim(onSphere(c, R, eyeYaw * sx, eyePitch - 0.015, -eyeR * 0.05), d, [1, 1.2, 0.5]) });
      P.add(blob(eyeR * 0.2, 6, 5), 'accent', { m: aim(onSphere(c, R, eyeYaw * sx + 0.035 * sx, eyePitch + 0.025, eyeR * 0.22), d, [1, 1, 0.5]) });
    } else {
      P.add(blob(eyeR, 14, 10), 'dark', { m: aim(onSphere(c, R, eyeYaw * sx, eyePitch, -eyeR * 0.25), d, [1, 1.25, 0.55]) });
      P.add(blob(eyeR * 0.3, 8, 6), 'accent', { m: aim(onSphere(c, R, eyeYaw * sx + 0.05 * sx, eyePitch + 0.06, eyeR * 0.05), d, [1, 1, 0.5]) });
      P.add(new THREE.TorusGeometry(eyeR * 1.3, eyeR * ringT, 6, 20), 'accent', { m: aim(onSphere(c, R, eyeYaw * sx, eyePitch, -0.002), d, [1, 1.2, 1]) });
    }
    if (brows) {
      const bd = dirOf((eyeYaw + 0.02) * sx, eyePitch + 0.32);
      P.add(new THREE.TorusGeometry(eyeR * 1.6, eyeR * 0.32, 6, 14, PI * 0.6), browSlot, { m: aim(onSphere(c, R, (eyeYaw + 0.02) * sx, eyePitch + 0.32, -0.006), bd, 1, PI * 0.2) });
    }
  });
  if (nose) P.add(blob(nose, 14, 10), 'body', { m: aim(onSphere(c, R, 0, -0.08, -nose * 0.35), dirOf(0, -0.08), [1, 0.9, 0.9]) });
  if (smile) {
    const d = dirOf(0, -0.36);
    P.add(new THREE.TorusGeometry(smileR, 0.0085, 6, 16, PI * 0.62), 'dark', { m: aim(onSphere(c, R, 0, -0.36, -0.006), d, 1, -PI / 2 - PI * 0.31) });
  }
}

/**
 * A cloth shell: a lathe of a thin closed section (outer radius rOut(y), thickness th) between y0 and y1, over phi phiStart..+phiLength,
 * with folds: the radius is pushed by amp * f(y) * sin(k * phi). Returns { geo, at(phi, y, off) } where at() finds a point on the outer surface.
 */
export function shell(rOut, y0, y1, { th = 0.016, phiStart = -1.8, phiLength = 3.6, k = 9, amp = 0.018, rows = 28, segments = 48, foldFrom = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= rows; i++) { const y = y1 - (y1 - y0) * (i / rows); pts.push(new THREE.Vector2(rOut(y), y)); }
  pts.push(new THREE.Vector2(rOut(y0) - th, y0 + 0.004));
  for (let i = rows; i >= 0; i--) { const y = y1 - (y1 - y0) * (i / rows); pts.push(new THREE.Vector2(Math.max(0.001, rOut(y) - th), y)); }
  pts.push(new THREE.Vector2(rOut(y1) - th * 0.5, y1 + 0.004));
  const geo = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  const fold = (phi, y) => { const t = Math.max(0, Math.min(1, (y1 - y) / (y1 - y0))); return amp * Math.max(0, (t - foldFrom) / (1 - foldFrom)) * Math.sin(k * (phi - phiStart)); };
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const r = Math.hypot(x, z); if (r < 1e-5) continue;
    const phi = Math.atan2(x, z);
    const nr = r + fold(phi, y);
    pos.setX(i, x * nr / r); pos.setZ(i, z * nr / r);
  }
  geo.computeVertexNormals();
  const at = (phi, y, off = 0) => { const r = rOut(y) + fold(phi, y) + off; return [Math.sin(phi) * r, y, Math.cos(phi) * r]; };
  return { geo, at };
}

/** A string of beads along points (for trims and pearls). */
export function beads(P, slot, pts, r, w = 10, h = 8) {
  for (const p of pts) P.add(blob(r, w, h), slot, { p });
}

/** A ring of n points at radius R, height y, starting at angle a0 (0 = front). */
export function ring(n, R, y, a0 = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * PI * 2; out.push([Math.sin(a) * R, y, -Math.cos(a) * R]); }
  return out;
}

/** A tapered sleeve or limb, closed at both ends by small spheres. */
export function limb(P, slot, pts, r0, r1, { radial = 12, segments = 18 } = {}) {
  P.add(tube(pts, (t) => r0 + (r1 - r0) * t, { radial, segments }), slot);
  P.add(blob(r0 * 0.98, 14, 10), slot, { p: pts[0] });
}

/** Pleats on a lathe: between yTop and yBot the radius is pushed by amp * t * sin(k * phi), t growing from 0 at yTop to 1 at yBot. */
export function flute(geo, yTop, yBot, k, amp) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
    const r = Math.hypot(x, z); if (r < 1e-5) continue;
    const t = Math.max(0, Math.min(1, (yTop - y) / (yTop - yBot)));
    const nr = r * (1 + amp * Math.pow(t, 1.4) * Math.sin(k * Math.atan2(x, z)));
    pos.setX(i, x * nr / r); pos.setZ(i, z * nr / r);
  }
  geo.computeVertexNormals();
  return geo;
}
