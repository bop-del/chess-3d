// Shared helpers of the animal king, queen and bishop (CHE-367, agent ak): a cartoon eye and a gold crown.
import { THREE, V2, TAU, blob } from '../kit.js';

/** The unit direction that local -z points to after an Euler XYZ rotation [rx, ry, 0]. */
export function lookDir(rx, ry) {
  return [-Math.sin(ry), Math.cos(ry) * Math.sin(rx), -Math.cos(ry) * Math.cos(rx)];
}

/**
 * A big friendly eye at centre c with radius r, looking along lookDir(rx, ry): a body eyeball, a glossy dark pupil that bulges out
 * of it, a gold ring around the pupil (so it reads on ebony) and a small gold catchlight. Sink c a little into the head.
 */
export function eye(P, c, r, rx = 0, ry = 0, { ring = true, pupil = 0.62 } = {}) {
  const d = lookDir(rx, ry);
  const at = (k, o = [0, 0, 0]) => [c[0] + d[0] * k + o[0], c[1] + d[1] * k + o[1], c[2] + d[2] * k + o[2]];
  const rot = [rx, ry, 0];
  P.add(blob(r, 20, 12), 'body', { p: c, r: rot, s: [1, 1, 0.78] });
  P.add(blob(r * pupil, 20, 12), 'dark', { p: at(r * 0.5), r: rot, s: [1, 1, 0.58] });
  if (ring) P.add(new THREE.TorusGeometry(r * 0.93, r * 0.12, 8, 28), 'accent', { p: at(r * 0.28), r: rot });
  // catchlight: up and toward the nose side, just proud of the pupil
  const side = d[0] > 0.05 ? -1 : d[0] < -0.05 ? 1 : -1;
  P.add(blob(r * 0.16, 10, 8), 'accent', { p: at(r * 0.78, [side * r * 0.18 * Math.cos(ry), r * 0.2, 0]) });
}

/** A lathe from exact points (no spline), for crisp rings and bands. */
export const ringLathe = (pts, segments = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), segments);

/**
 * A gold crown standing at height y on a head, radius r, band height hb, n points of height hp with ball tips, body gems on the band
 * and a body velvet cap inside. Options: tilt (whole crown lean, radians about x), cap (dome height), centre ([x, z]).
 * Returns the y of the ball tips (in crown space, before the tilt).
 */
export function crown(P, { y, r, hb, hp, n = 5, ball = 0.025, cap = 0, gems = true, centre = [0, 0], flare = 0.12, phase = 0 }) {
  const [cx, cz] = centre;
  const t = 0.012;
  const rt = r * (1 + flare);
  // band: slightly flared velvet in the body colour between two gold torus rims, gold gems on it (a flat gold band mirrors the dark
  // sky and reads as a black hat)
  const barrel = [];
  for (let k = 0; k <= 10; k++) {
    const a = -1.1 + (2.2 * k) / 10, f = (Math.sin(a) / Math.sin(1.1) + 1) / 2;
    barrel.push([r + (rt - r) * f + t * 0.9 * Math.cos(a) - t * 0.3, hb * f]);
  }
  P.add(ringLathe([[r - t, 0], ...barrel, [rt - t * 1.6, hb], [r - t, 0.0001]], 44), 'body', { p: [cx, y, cz] });
  P.add(new THREE.TorusGeometry(r + t * 0.1, t * 1.15, 8, 40), 'accent', { p: [cx, y + t * 0.6, cz], r: [Math.PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(rt - t * 0.5, t * 1.0, 8, 40), 'accent', { p: [cx, y + hb - t * 0.2, cz], r: [Math.PI / 2, 0, 0] });
  if (cap) P.add(new THREE.SphereGeometry(r * 0.98, 28, 8, 0, TAU, 0, Math.PI / 2), 'body', { p: [cx, y + hb * 0.4, cz], s: [1, cap / r, 1] });
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU;
    const sx = Math.sin(a), sz = -Math.cos(a);
    const pr = rt - t * 0.4;
    const cone = new THREE.ConeGeometry(Math.min(0.05, (TAU * rt) / n * 0.32), hp, 4, 1);
    // a flat diamond point: squash the four sided cone toward the radius
    P.add(cone, 'accent', { p: [cx + sx * pr, y + hb + hp / 2 - 0.004, cz + sz * pr], r: [0, -a + Math.PI / 4, 0], s: [1, 1, 1] });
    P.add(blob(ball, 10, 6), 'accent', { p: [cx + sx * (pr + 0.004), y + hb + hp + ball * 0.55, cz + sz * (pr + 0.004)] });
    if (gems) {
      const gr = Math.min(hb * 0.24, 0.022);
      const gm = r + (rt - r) * 0.5 + t * 0.9;
      P.add(blob(gr, 10, 6), 'accent', { p: [cx + sx * gm, y + hb * 0.5, cz + sz * gm], r: [0, -a, 0], s: [1, 1, 0.6] });
    }
  }
  return y + hb + hp + ball * 1.5;
}
