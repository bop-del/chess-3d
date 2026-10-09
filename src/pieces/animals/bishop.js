// animals bishop (CHE-367): an owl. Egg shaped body, a big round head with a face disc and large eyes, two tall ear tufts that
// make the bishop's pointed top, folded wings, a gold brow, beak and feet.
import { THREE, parts, foot, blob, tube, lathe, HEIGHT } from '../kit.js';
import { eye } from './_ak.js';

export function buildBishop(mat) {
  const P = parts();
  const y0 = foot(P, 0.32, { style: 'grass' });

  // body: an egg, widest low, a little deeper at the back
  P.add(lathe([[0, 0], [0.19, 0.0], [0.25, 0.08], [0.27, 0.22], [0.255, 0.4], [0.21, 0.56], [0.14, 0.66], [0, 0.7]], { count: 40, segments: 44 }), 'body', { p: [0, y0 - 0.01, 0.01], s: [1, 1, 0.92] });
  // belly: a soft front panel with two rows of shallow chevrons (feather marks)
  P.add(blob(1, 28, 18), 'body', { p: [0, y0 + 0.3, -0.07], s: [0.2, 0.26, 0.18] });
  const onBelly = (x, y) => -0.07 - Math.sqrt(Math.max(0, 1 - (x / 0.2) ** 2 - ((y - y0 - 0.3) / 0.26) ** 2)) * 0.18 + 0.004;
  for (const [ry, xs] of [[y0 + 0.4, [-0.055, 0.055]], [y0 + 0.29, [-0.1, 0, 0.1]]]) {
    for (const x of xs) {
      const pts = [-0.042, -0.021, 0, 0.021, 0.042].map((dx) => [x + dx, ry - 0.026 * (1 - Math.abs(dx) / 0.042), onBelly(x + dx, ry - 0.026 * (1 - Math.abs(dx) / 0.042))]);
      P.add(tube(pts, 0.013, { segments: 12, radial: 8 }), 'body');
    }
  }

  // folded wings: long slabs of round feathers wrapping round the sides toward the back, gold tips and a gold front edge
  P.mirror((sx) => {
    P.add(blob(1, 26, 18), 'body', { p: [sx * 0.2, y0 + 0.38, 0.08], r: [0.12, sx * 0.55, sx * 0.1], s: [0.08, 0.26, 0.19] });
    for (const k of [0, 1, 2]) {
      P.add(blob(1, 14, 10), 'body', { p: [sx * (0.2 - k * 0.04), y0 + 0.17 - k * 0.012, 0.17 + k * 0.045], r: [0, sx * 0.55, sx * 0.1], s: [0.065, 0.075, 0.05] });
      P.add(blob(1, 12, 8), 'accent', { p: [sx * (0.2 - k * 0.04), y0 + 0.105 - k * 0.012, 0.19 + k * 0.045], s: [0.026, 0.022, 0.026] });
    }
    P.add(tube([[sx * 0.18, y0 + 0.6, -0.04], [sx * 0.25, y0 + 0.5, -0.06], [sx * 0.275, y0 + 0.36, -0.04], [sx * 0.265, y0 + 0.22, -0.01]], (t) => 0.012 + 0.004 * Math.sin(t * Math.PI), { segments: 20, radial: 8 }), 'accent');
  });

  // a rounded fan tail of three lobes at the back, a gold tip on each
  for (const k of [-1, 0, 1]) {
    const a = k * 0.45;
    P.add(blob(1, 16, 12), 'body', { p: [Math.sin(a) * 0.08, y0 + 0.06, 0.25 + Math.cos(a) * 0.02], r: [0.9, 0, -a], s: [0.055, 0.1, 0.035] });
  }

  // head: big, round, slightly wider than tall
  const hy = 0.985, hz = -0.01;
  P.add(blob(1, 32, 22), 'body', { p: [0, hy, hz], s: [0.255, 0.215, 0.22] });
  // face disc: two flat round pads, one per eye, framed by a gold heart brow
  P.mirror((sx) => P.add(blob(1, 24, 16), 'body', { p: [sx * 0.092, hy - 0.01, hz - 0.155], r: [0, -sx * 0.3, 0], s: [0.115, 0.125, 0.06] }));
  P.add(tube([[-0.23, hy + 0.04, hz - 0.1], [-0.15, hy + 0.115, hz - 0.17], [-0.06, hy + 0.1, hz - 0.205], [0, hy + 0.05, hz - 0.225], [0.06, hy + 0.1, hz - 0.205], [0.15, hy + 0.115, hz - 0.17], [0.23, hy + 0.04, hz - 0.1]], 0.014, { segments: 40, radial: 8 }), 'accent');
  P.mirror((sx) => eye(P, [sx * 0.092, hy - 0.005, hz - 0.188], 0.066, 0.04, -sx * 0.25, { pupil: 0.64 }));
  // beak: a small gold hook between the eyes
  P.add(new THREE.ConeGeometry(0.032, 0.085, 16), 'accent', { p: [0, hy - 0.07, hz - 0.225], r: [Math.PI - 0.35, 0, 0], s: [1, 1, 0.75] });

  // ear tufts: two feathers each, flat and tall, leaning out, a gold tip on the long one (the bishop's pointed top)
  const top = HEIGHT.b;
  P.mirror((sx) => {
    const base = [sx * 0.1, hy + 0.11, hz + 0.01];
    const tipL = [sx * 0.075, top - 0.024 - base[1], 0.01];
    P.add(tube([[0, 0, 0], [sx * 0.04, 0.1, 0.0], tipL], (t) => 0.062 * (1 - t) + 0.016, { segments: 18, radial: 14 }), 'body', { p: base, s: [1, 1, 0.62] });
    P.add(blob(0.024, 12, 8), 'accent', { p: [base[0] + tipL[0], top - 0.024, base[2] + tipL[2] * 0.62] });
    P.add(tube([[0, 0, 0], [sx * 0.07, 0.07, 0.0], [sx * 0.12, 0.12, 0.0]], (t) => 0.045 * (1 - t) + 0.015, { segments: 14, radial: 12 }), 'body', { p: [base[0], base[1] - 0.02, base[2] + 0.02], s: [1, 1, 0.6] });
  });
  // a soft ridge from tuft to tuft over the head top
  P.add(tube([[-0.12, hy + 0.16, hz + 0.02], [-0.06, hy + 0.215, hz + 0.0], [0, hy + 0.235, hz - 0.01], [0.06, hy + 0.215, hz + 0.0], [0.12, hy + 0.16, hz + 0.02]], 0.035, { segments: 24, radial: 12 }), 'body');
  // feather chevrons on the back, seen first from the white side
  const egg = [[0, 0.19], [0.08, 0.25], [0.22, 0.27], [0.4, 0.255], [0.56, 0.21], [0.66, 0.14]];
  const rAt = (yy) => { for (let k = 1; k < egg.length; k++) if (yy <= egg[k][0]) { const [a, ra] = egg[k - 1], [b, rb] = egg[k]; return ra + (rb - ra) * (yy - a) / (b - a); } return 0.14; };
  for (const [ry, xs] of [[0.52, [-0.06, 0.06]], [0.42, [-0.11, 0, 0.11]], [0.32, [-0.06, 0.06]]]) {
    for (const x of xs) {
      const pts = [-0.035, -0.017, 0, 0.017, 0.035].map((dx) => {
        const yy = ry - 0.024 * (1 - Math.abs(dx) / 0.035), xx = x + dx, r = rAt(yy + 0.01);
        return [xx, y0 + yy, 0.01 + Math.sqrt(Math.max(0, r * r - xx * xx)) * 0.92 + 0.003];
      });
      P.add(tube(pts, 0.011, { segments: 12, radial: 8 }), 'body');
    }
  }

  // gold feet: three round toes each, gripping the mound
  P.mirror((sx) => {
    for (const k of [-1, 0, 1]) P.add(blob(1, 12, 8), 'accent', { p: [sx * 0.095 + k * 0.042, y0 + 0.012, -0.215 - (k === 0 ? 0.025 : 0)], r: [0, k * 0.4, 0], s: [0.032, 0.028, 0.062] });
  });

  return P.build(mat, 'animals-bishop');
}
