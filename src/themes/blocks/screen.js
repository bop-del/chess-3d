// Screen space tests for the Blocks world: does a block of the world (the tree, a cloud) cover the board or a UI control on
// screen? Convex hulls of projected box corners and a separating axis test. Pixels, origin top left.
import * as THREE from 'three';

const v = new THREE.Vector3();

/** The eight corners of a Box3 (world space) projected to pixels. */
export function projectBox(box, camera, w, h, out = []) {
  out.length = 0;
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    out.push([(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]);
  }
  return out;
}

/** World points projected to pixels. */
export function projectPoints(pts, camera, w, h) {
  return pts.map(([x, y, z]) => { v.set(x, y, z).project(camera); return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h]; });
}

/** Convex hull (monotone chain), counter clockwise in a y up frame. */
export function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

/** Do two convex polygons overlap (touching does not count)? */
export function overlaps(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], nx = q[1] - p[1], ny = p[0] - q[0];
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const r of a) { const d = r[0] * nx + r[1] * ny; if (d < amin) amin = d; if (d > amax) amax = d; }
      for (const r of b) { const d = r[0] * nx + r[1] * ny; if (d < bmin) bmin = d; if (d > bmax) bmax = d; }
      if (amax <= bmin || bmax <= amin) return false;
    }
  }
  return true;
}

export const rectPoly = (r, pad = 0) => [[r.left - pad, r.top - pad], [r.right + pad, r.top - pad], [r.right + pad, r.bottom + pad], [r.left - pad, r.bottom + pad]];
