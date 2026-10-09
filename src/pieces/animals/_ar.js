// Shared helpers of the animal knight, rook and pawn (CHE-367, agent ar): ellipsoid blobs, points on an ellipsoid surface,
// toy eyes (dark pupil, gold ring, body catchlight) and crisp lathes for the tower.
import { THREE, blob } from '../kit.js';

const Z = new THREE.Vector3(0, 0, 1);

/** An ellipsoid: centre c [x,y,z], radii s [sx,sy,sz], optional Euler r. */
export function ell(P, slot, c, s, r = [0, 0, 0], w = 24, h = 16) {
  P.add(blob(1, w, h), slot, { p: c, s, r });
}

/** Point and outward normal on the ellipsoid (centre c, radii s) in direction u (any vector, normalised here). */
export function onEll(c, s, u) {
  const d = new THREE.Vector3(...u).normalize();
  const p = new THREE.Vector3(c[0] + d.x * s[0], c[1] + d.y * s[1], c[2] + d.z * s[2]);
  const n = new THREE.Vector3(d.x / s[0], d.y / s[1], d.z / s[2]).normalize();
  return { p, n };
}

/** A matrix placing a part at p with its local +z along n, scaled by s. */
export function orient(p, n, s = [1, 1, 1], spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(Z, n.clone().normalize());
  if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, spin));
  return new THREE.Matrix4().compose(p.clone(), q, new THREE.Vector3(...s));
}

/**
 * A big toy eye on a surface point p with normal n, radius e: a domed dark pupil, a gold ring around it (so it reads on ebony)
 * and a small body coloured catchlight up and outward.
 */
export function eye(P, p, n, e, { ring = true } = {}) {
  const sunk = p.clone().addScaledVector(n, -e * 0.2);
  P.add(blob(1, 20, 14), 'dark', { m: orient(sunk, n, [e, e, e * 0.55]) });
  if (ring) P.add(new THREE.TorusGeometry(e * 1.08, e * 0.2, 8, 28), 'accent', { m: orient(p.clone().addScaledVector(n, -e * 0.12), n) });
  // catchlight: up and toward the outer side of the pupil
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize();
  const side = new THREE.Vector3().crossVectors(n, up).normalize();
  const cl = sunk.clone().addScaledVector(up, e * 0.42).addScaledVector(side, (p.x >= 0 ? -1 : 1) * e * 0.3).addScaledVector(n, e * 0.42);
  P.add(blob(1, 10, 8), 'body', { m: orient(cl, n, [e * 0.22, e * 0.22, e * 0.12]) });
}

/** A lathe through exact [r, y] points (no smoothing): crisp edges for built things like the tower. */
export const latheSharp = (pts, segments = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments);

/** Points of a closed ellipse in the xz plane at height y (for trims). */
export function ellipseXZ(c, rx, rz, n = 32, y0 = 0, dip = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([c[0] + Math.cos(a) * rx, c[1] + y0 - dip * Math.abs(Math.cos(a)), c[2] + Math.sin(a) * rz]);
  }
  return out;
}
