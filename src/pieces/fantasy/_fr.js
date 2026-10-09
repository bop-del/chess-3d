// Shared helpers of the fantasy knight, rook and pawn (CHE-367, agent fr): matrices, eyes, rods between two points.
import { THREE, blob } from '../kit.js';

const UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

/** A matrix from a position, a direction the local +y axis points to (or a quaternion) and a scale. */
export function along(p, dir = [0, 1, 0], s = 1, axis = UP) {
  const q = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(...dir).normalize());
  return new THREE.Matrix4().compose(new THREE.Vector3(...p), q, new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])));
}

/** A rod (cylinder) from a to b with radii ra and rb, rounded ends optional. */
export function rod(P, a, b, ra, rb = ra, slot = 'body', { radial = 12, caps = true } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const mid = A.clone().add(B).multiplyScalar(0.5);
  P.add(new THREE.CylinderGeometry(rb, ra, len, radial, 1, true), slot, { m: along(mid.toArray(), d.toArray()) });
  if (caps) {
    P.add(blob(ra, radial, 8), slot, { p: a });
    P.add(blob(rb, radial, 8), slot, { p: b });
  }
}

/** A kind eye: a body bulge, a dark pupil and a thin accent ring, looking along dir. */
export function eye(P, p, dir, r = 0.03, { bulge = true, ring = 1 } = {}) {
  const d = new THREE.Vector3(...dir).normalize();
  const at = (k) => [p[0] + d.x * k, p[1] + d.y * k, p[2] + d.z * k];
  if (bulge) P.add(blob(r * 1.35, 16, 12), 'body', { m: along(p, dir, [1, 0.55, 1]) });
  P.add(blob(r, 16, 12), 'dark', { m: along(at(r * 0.35), dir, [1, 0.6, 1]) });
  P.add(new THREE.TorusGeometry(r * 1.05 * ring, r * 0.2 * Math.sqrt(ring), 8, 28), 'accent', { m: along(at(r * (0.38 - (ring - 1) * 0.5)), dir, 1, Z) });
}
