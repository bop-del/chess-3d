// animals king (CHE-367): a lion sitting upright, a big round mane of lobes around a kind face, a gold crown with an orb and a
// cross on top (the king's top), a gold medallion on the chest and a tail curling round the foot with a tuft.
import { THREE, parts, foot, blob, tube, lathe, TAU, HEIGHT } from '../kit.js';
import { eye, crown } from './_ak.js';

export function buildKing(mat) {
  const P = parts();
  const y0 = foot(P, 0.33, { style: 'grass' });

  // body: a round sitting torso, wide haunches, a chest bulge and shoulders that carry the mane
  P.add(lathe([[0, 0], [0.21, 0.0], [0.27, 0.09], [0.26, 0.26], [0.22, 0.46], [0.19, 0.64], [0.17, 0.76], [0.1, 0.83], [0, 0.85]], { count: 32, segments: 36 }), 'body', { p: [0, y0 - 0.01, 0.03], r: [-0.06, 0, 0], s: [1, 1, 0.9] });
  P.add(blob(1, 26, 18), 'body', { p: [0, y0 + 0.56, -0.07], s: [0.17, 0.24, 0.14] });
  P.mirror((sx) => {
    P.add(blob(1, 26, 18), 'body', { p: [sx * 0.165, y0 + 0.16, 0.07], r: [0.25, 0, sx * 0.15], s: [0.15, 0.18, 0.23] });
    // a round haunch lobe on the back of each thigh
    P.add(blob(1, 20, 14), 'body', { p: [sx * 0.15, y0 + 0.2, 0.2], s: [0.1, 0.12, 0.09] });
    // hind feet peeking out at the front sides
    P.add(blob(1, 20, 12), 'body', { p: [sx * 0.22, y0 + 0.035, -0.13], s: [0.07, 0.05, 0.1] });
    // front legs and big paws
    P.add(tube([[sx * 0.1, y0 + 0.62, -0.12], [sx * 0.105, y0 + 0.34, -0.19], [sx * 0.105, y0 + 0.08, -0.22]], (t) => 0.07 - 0.01 * t, { segments: 20, radial: 16 }), 'body');
    P.add(blob(1, 22, 14), 'body', { p: [sx * 0.105, y0 + 0.045, -0.25], s: [0.08, 0.055, 0.09] });
    for (const k of [-1, 0, 1]) P.add(blob(0.024, 8, 6), 'body', { p: [sx * 0.105 + k * 0.036, y0 + 0.04, -0.33] });
  });

  // tail: low out of the back, round the right side of the foot to the front, a big gold tuft beside the right paw
  P.add(tube([[0.05, y0 + 0.06, 0.24], [0.19, y0 + 0.03, 0.25], [0.29, y0 + 0.03, 0.1], [0.3, y0 + 0.04, -0.06], [0.26, y0 + 0.08, -0.17]], (t) => 0.034 - 0.008 * t, { segments: 30, radial: 10 }), 'body');
  P.add(blob(1, 20, 14), 'accent', { p: [0.245, y0 + 0.12, -0.21], r: [0.5, 0, -0.3], s: [0.065, 0.08, 0.06] });

  // royal chain and medallion on the chest
  P.add(tube([[-0.15, y0 + 0.72, -0.1], [-0.1, y0 + 0.6, -0.2], [0, y0 + 0.55, -0.225], [0.1, y0 + 0.6, -0.2], [0.15, y0 + 0.72, -0.1]], 0.011, { segments: 24, radial: 8 }), 'accent');
  P.add(blob(0.045, 22, 14), 'accent', { p: [0, y0 + 0.5, -0.225], r: [-0.3, 0, 0], s: [1, 1, 0.4] });
  P.add(new THREE.TorusGeometry(0.045, 0.008, 8, 28), 'accent', { p: [0, y0 + 0.5, -0.225], r: [-0.3, 0, 0] });
  P.add(blob(0.022, 12, 8), 'body', { p: [0, y0 + 0.497, -0.24], s: [1, 1, 0.6] });

  // head: big and round, sitting forward of the mane
  const hy = 1.27, hz = -0.06;
  P.add(blob(1, 24, 18), 'body', { p: [0, hy, hz], s: [0.19, 0.18, 0.17] });
  // mane: a back disc and two rings of lobes around the face
  P.add(blob(1, 24, 16), 'body', { p: [0, hy - 0.01, hz + 0.08], s: [0.29, 0.28, 0.14] });
  const ring = (n, rx, ry, z, lr, phase) => {
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * TAU;
      P.add(blob(lr, 12, 8), 'body', { p: [Math.cos(a) * rx, hy - 0.01 + Math.sin(a) * ry, hz + z], r: [0, 0, a], s: [0.75, 1, 0.75] });
    }
  };
  ring(12, 0.26, 0.215, 0.03, 0.12, Math.PI / 2);
  ring(11, 0.2, 0.17, 0.1, 0.12, Math.PI / 2 + Math.PI / 11);
  // the mane hangs down the back as one teardrop narrowing down the spine
  P.add(blob(1, 22, 14), 'body', { p: [0, hy - 0.27, hz + 0.2], r: [0.15, 0, 0], s: [0.13, 0.17, 0.08] });
  P.add(blob(1, 18, 12), 'body', { p: [0, hy - 0.42, hz + 0.215], r: [0.15, 0, 0], s: [0.07, 0.1, 0.06] });
  // round ears on the mane top corners
  P.mirror((sx) => {
    P.add(blob(1, 18, 12), 'body', { p: [sx * 0.15, hy + 0.15, hz - 0.03], r: [0, 0, -sx * 0.4], s: [0.06, 0.06, 0.035] });
    P.add(blob(1, 14, 10), 'accent', { p: [sx * 0.15, hy + 0.15, hz - 0.055], r: [0, 0, -sx * 0.4], s: [0.035, 0.035, 0.015] });
  });

  // face: muzzle pads, a dark nose, a small smile, big eyes
  P.mirror((sx) => P.add(blob(1, 20, 14), 'body', { p: [sx * 0.05, hy - 0.06, hz - 0.15], s: [0.062, 0.05, 0.05] }));
  P.add(blob(1, 16, 10), 'body', { p: [0, hy - 0.11, hz - 0.13], s: [0.04, 0.03, 0.035] });
  P.add(blob(1, 20, 12), 'dark', { p: [0, hy - 0.025, hz - 0.2], r: [0.3, 0, 0], s: [0.04, 0.025, 0.018] });
  P.add(tube([[-0.04, hy - 0.09, hz - 0.185], [-0.015, hy - 0.1, hz - 0.19], [0, hy - 0.085, hz - 0.195], [0.015, hy - 0.1, hz - 0.19], [0.04, hy - 0.09, hz - 0.185]], 0.006, { segments: 16, radial: 6 }), 'dark');
  P.mirror((sx) => eye(P, [sx * 0.075, hy + 0.035, hz - 0.125], 0.05, 0.05, -sx * 0.3));

  // crown on the head top: band with points, a velvet cap, two arches, an orb and a cross (the king's top)
  const cy = hy + 0.155, cr = 0.14, hb = 0.1, fl = 0.14, rt = cr * (1 + fl), ah = 0.8;
  crown(P, { y: cy, r: cr, hb, hp: 0.085, n: 8, ball: 0.02, cap: 0.15, flare: fl, phase: Math.PI / 8 });
  for (const ay of [0, Math.PI / 2]) {
    P.add(new THREE.TorusGeometry(rt - 0.006, 0.013, 7, 28, Math.PI), 'accent', { p: [0, cy + hb - 0.004, 0], r: [0, ay, 0], s: [1, ah, 1] });
  }
  const oy = cy + hb + (rt - 0.006) * ah + 0.03;
  P.add(blob(0.042, 22, 16), 'accent', { p: [0, oy, 0] });
  P.add(new THREE.TorusGeometry(0.042, 0.007, 8, 28), 'accent', { p: [0, oy, 0], r: [Math.PI / 2, 0, 0] });
  const ct = HEIGHT.k;
  P.add(new THREE.CapsuleGeometry(0.016, ct - oy - 0.06, 4, 12), 'accent', { p: [0, (oy + 0.02 + ct) / 2, 0] });
  P.add(new THREE.CapsuleGeometry(0.016, 0.07, 4, 12), 'accent', { p: [0, ct - 0.05, 0], r: [0, 0, Math.PI / 2] });

  return P.build(mat, 'animals-king');
}
