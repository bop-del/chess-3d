// fantasy queen (CHE-367): a storybook queen in a pleated bell gown with a narrow waist, a gold laced bodice, puffed sleeves and
// clasped hands, a pearl necklace, a hair bun inside a flaring coronet of pearl points with a tall gem point at the front, and a veil.
import { THREE, parts, foot, lathe, tube, blob, slab } from '../kit.js';
import { PI, aim, dirOf, onSphere, radiusAt, face, shell, beads, ring, limb, flute } from './_fk.js';

const GOWN = [[0, 0.15], [0.262, 0.15], [0.3, 0.172], [0.292, 0.215], [0.255, 0.29], [0.2, 0.41], [0.152, 0.55], [0.12, 0.67], [0.126, 0.75], [0.148, 0.84], [0.145, 0.91], [0.11, 0.965], [0.05, 0.995], [0, 1.0]];

export function buildQueen(mat) {
  const P = parts();
  foot(P, 0.33, { style: 'round' });
  const rr = (y) => radiusAt(GOWN, y);

  // gown with soft pleats from the hips down
  P.add(flute(lathe(GOWN, { count: 44, segments: 72 }), 0.62, 0.17, 12, 0.07), 'body');
  // hem: a gold rope and a row of scallops above it
  P.add(new THREE.TorusGeometry(rr(0.19) * 1.07 + 0.004, 0.017, 8, 60), 'accent', { p: [0, 0.19, 0], r: [PI / 2, 0, 0] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2 + PI / 24, y = 0.255, r = rr(y) * (1 + 0.07 * Math.pow((0.62 - y) / 0.45, 1.4) * Math.sin(12 * a)) + 0.002;
    // each pleat crest gets a small gold drop
    if (Math.sin(12 * a) > 0.9) P.add(blob(0.017, 10, 8), 'accent', { p: [Math.sin(a) * r, y, Math.cos(a) * r], s: [1, 1.4, 1] });
  }
  // the front panel: a gold lace down the skirt with pearls
  const lace = [];
  for (let y = 0.22; y <= 0.66; y += 0.04) lace.push([0, y, -rr(y) * (1 + 0.07 * Math.pow(Math.max(0, (0.62 - y) / 0.45), 1.4) * Math.sin(12 * PI)) - 0.004]);
  P.add(tube(lace, 0.012, { segments: 24, radial: 6 }), 'accent');
  for (const y of [0.3, 0.4, 0.5, 0.59]) P.add(blob(0.017, 10, 8), 'accent', { p: [0, y, -rr(y) - 0.012] });
  // waist sash with a bow at the back
  P.add(new THREE.TorusGeometry(rr(0.68) + 0.003, 0.018, 8, 44), 'accent', { p: [0, 0.68, 0], r: [PI / 2, 0, 0], s: [1, 1, 1.2] });
  P.mirror((sx) => P.add(blob(0.05, 14, 10), 'accent', { p: [0.045 * sx, 0.69, rr(0.69) + 0.01], s: [1.1, 0.6, 0.45], r: [0, 0, 0.3 * sx] }));
  P.add(blob(0.022, 10, 8), 'accent', { p: [0, 0.69, rr(0.69) + 0.015] });
  // bodice: a gold V and a jewel
  P.mirror((sx) => {
    const v = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, y = 0.69 + 0.22 * t, x = 0.075 * t * sx; v.push([x, y, -Math.sqrt(Math.max(0, rr(y) ** 2 - x * x)) - 0.002]); }
    P.add(tube(v, 0.011, { segments: 14, radial: 6 }), 'accent');
  });
  P.add(blob(0.024, 12, 10), 'accent', { p: [0, 0.72, -rr(0.72) - 0.01], s: [1, 1.3, 0.7] });

  // puffed sleeves, slim arms, hands clasped at the waist
  P.mirror((sx) => {
    P.add(blob(0.088, 18, 14), 'body', { p: [0.15 * sx, 0.915, 0.0], s: [1, 0.95, 1] });
    P.add(new THREE.TorusGeometry(0.05, 0.012, 6, 20), 'accent', { p: [0.16 * sx, 0.855, -0.005], r: [PI / 2 + 0.1, 0.0, 0.35 * sx] });
    limb(P, 'body', [[0.16 * sx, 0.86, 0.0], [0.17 * sx, 0.77, -0.05], [0.1 * sx, 0.71, -0.14], [0.03 * sx, 0.705, -0.155]], 0.05, 0.04);
    P.add(blob(0.044, 12, 10), 'body', { p: [0.028 * sx, 0.705, -0.17], s: [0.9, 1, 1.05] });
  });

  // pearl necklace with a drop
  beads(P, 'accent', ring(20, 0.085, 0.985, 0).map(([x, y, z]) => [x, y + (z < 0 ? -0.025 * (-z / 0.085) : 0), z - 0.01]), 0.014, 8, 6);
  P.add(blob(0.02, 12, 10), 'accent', { p: [0, 0.935, -0.12], s: [1, 1.35, 0.8] });

  // head and face
  const H = [0, 1.145, -0.01], R = 0.15;
  P.add(blob(R, 32, 22), 'body', { p: H });
  face(P, H, R, { eyeYaw: 0.37, eyePitch: 0.08, eyeR: 0.024, nose: 0.024, smile: true, smileR: 0.034 });
  // lashes: a little flick at the outer corner of each eye
  P.mirror((sx) => P.add(tube([onSphere(H, R, 0.47 * sx, 0.14, -0.004), onSphere(H, R, 0.55 * sx, 0.2, 0.01)], 0.006, { segments: 2, radial: 5 }), 'dark'));

  // hair: one smooth shell over the top and back down to the shoulders, a bun sunk into it, a gold ribbon at the back
  P.add(blob(0.16, 30, 20), 'body', { p: [0, 1.115, 0.045], s: [1.06, 1.25, 1] });
  P.add(blob(0.095, 22, 14), 'body', { p: [0, 1.315, 0.025] });
  P.add(new THREE.TorusGeometry(0.05, 0.016, 8, 24), 'accent', { p: [0, 1.0, 0.18], r: [-0.5, 0, 0], s: [1.3, 0.8, 1] });
  // a low bun on the back of the head, sunk into the hair, with a gold ribbon round its base and a comb of pearls on top
  P.add(blob(0.072, 20, 14), 'body', { p: [0, 1.11, 0.232] });
  P.add(new THREE.TorusGeometry(0.058, 0.012, 6, 28), 'accent', { p: [0, 1.11, 0.205] });
  for (let i = 0; i < 5; i++) { const a = -0.9 + (1.8 * i) / 4; P.add(blob(0.012, 8, 6), 'accent', { p: [Math.sin(a) * 0.066, 1.11 + Math.cos(a) * 0.066, 0.238] }); }
  // a row of gold buttons down the back of the bodice
  for (const y of [0.74, 0.79, 0.84, 0.89]) P.add(blob(0.014, 8, 6), 'accent', { p: [0, y, rr(y) + 0.006] });
  P.mirror((sx) => P.add(blob(0.035, 12, 8), 'accent', { p: [0.06 * sx, 1.0, 0.185], s: [1.2, 0.7, 0.5], r: [-0.5, 0, 0.3 * sx] }));

  // coronet: a flaring gold cup with pearl points, a jewel band and one tall gem point at the front
  P.add(lathe([[0.122, 1.25], [0.137, 1.248], [0.18, 1.42], [0.17, 1.426], [0.125, 1.27]], { count: 16, segments: 48 }), 'body');
  P.add(new THREE.TorusGeometry(0.133, 0.014, 6, 48), 'accent', { p: [0, 1.255, 0], r: [PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(0.177, 0.012, 6, 48), 'accent', { p: [0, 1.422, 0], r: [PI / 2, 0, 0] });
  for (const [i, p] of ring(10, 0.159, 1.335, 0).entries()) P.add(blob(i % 2 ? 0.012 : 0.018, 8, 6), 'accent', { p, s: [1, 1.3, 0.6] });
  const tine = slab([[-0.03, 0], [0.03, 0], [0.006, 0.07], [-0.006, 0.07]], 0.012, { bevel: 0.004, curveSegments: 2 });
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * PI * 2;
    P.add(tine.clone(), 'accent', { p: [Math.sin(a) * 0.176, 1.415, -Math.cos(a) * 0.176], r: [0, -a, 0], s: [1, 1, 1] });
    P.add(blob(0.018, 10, 8), 'accent', { p: [Math.sin(a) * 0.176, 1.5, -Math.cos(a) * 0.176] });
  }
  tine.dispose();
  // the front gem point: a tall leaf with a teardrop gem in a ring, a pearl on top
  const leaf = slab([[-0.05, 0], [0.05, 0], [0.04, 0.05], [0.022, 0.1], [0.008, 0.15], [0, 0.17], [-0.008, 0.15], [-0.022, 0.1], [-0.04, 0.05]], 0.016, { bevel: 0.006 });
  P.add(leaf, 'accent', { p: [0, 1.41, -0.18], r: [-0.12, 0, 0] });
  P.add(blob(0.03, 16, 12), 'body', { p: [0, 1.485, -0.2], s: [1, 1.35, 0.7] });
  P.add(new THREE.TorusGeometry(0.034, 0.007, 6, 20), 'accent', { p: [0, 1.485, -0.198], r: [-0.12, 0, 0], s: [1, 1.3, 1] });
  P.add(blob(0.018, 10, 8), 'accent', { p: [0, 1.588, -0.191] });

  return P.build(mat, 'fantasy-queen');
}
