// animals queen (CHE-367): a swan. A full round body, two large wing shells over it meeting in a raised V at the
// back (gold edged), a flat upturned tail, a thick S shaped neck with a gold necklace, a gold beak and a gold coronet
// with a gem point on the head.
import { THREE, parts, foot, blob, tube, HEIGHT } from '../kit.js';
import { eye, crown } from './_ak.js';

// The wing shell: a part of an ellipsoid round the body (phi runs from the back centre to the chest on the +x side, theta from
// the top edge down the flank), its rear lifted and pulled in toward the centre line.
const WR = [0.33, 0.235, 0.355], WC = 0.19;
const PH0 = Math.PI / 2 - 0.1, PH1 = Math.PI + 1.25, TH0 = 0.24 * Math.PI, TH1 = 0.62 * Math.PI;
function deform(x, y, z) {
  const zn = Math.max(0, z / WR[2]), t = Math.min(1, Math.max(0, (y / WR[1] - Math.cos(TH1)) / (Math.cos(TH0) - Math.cos(TH1))));
  const side = Math.min(1, Math.abs(x) / 0.11) ** 0.8; // the lift fades toward the centre line: a notch for the tail
  return [x * (1 - 0.45 * zn * zn * t), y + WC + 0.42 * zn * zn * t * side, z + 0.03 * zn * t];
}
function wingPoint(phi, theta, k) {
  return deform(-Math.cos(phi) * Math.sin(theta) * WR[0] * k, Math.cos(theta) * WR[1] * k, Math.sin(phi) * Math.sin(theta) * WR[2] * k);
}
function wingShell(k, inner = false) {
  const g = new THREE.SphereGeometry(1, 40, 14, PH0, PH1 - PH0, TH0, TH1 - TH0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = deform(pos.getX(i) * WR[0] * k, pos.getY(i) * WR[1] * k, pos.getZ(i) * WR[2] * k);
    pos.setXYZ(i, x, y, z);
  }
  if (inner) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } }
  g.computeVertexNormals();
  return g;
}

export function buildQueen(mat) {
  const P = parts();
  const y0 = foot(P, 0.33, { style: 'grass' });

  // body: a full round boat, a proud chest at the front, a pointed tail lifted at the back
  P.add(blob(1, 32, 22), 'body', { p: [0, y0 + 0.19, 0.0], r: [-0.06, 0, 0], s: [0.31, 0.19, 0.33] });
  P.add(blob(1, 26, 18), 'body', { p: [0, y0 + 0.27, -0.16], s: [0.19, 0.2, 0.17] });
  P.add(blob(1, 22, 14), 'body', { p: [0, y0 + 0.47, 0.31], r: [-1.2, 0, 0], s: [0.095, 0.026, 0.13] });
  P.add(blob(1, 14, 8), 'accent', { p: [0, y0 + 0.47 + 0.104, 0.31 + 0.04], r: [-1.2, 0, 0], s: [0.05, 0.02, 0.035] });

  // wings: per side one large smooth shell lying over the flank, from the chest round to the back centre, its rear lifted and
  // drawn in so the two meet in a raised V over the tail (a closed heart from behind); a gold line along the top edge.
  P.mirror((sx) => {
    P.add(wingShell(1), 'body', { p: [0, y0, 0], s: [sx, 1, 1] });
    P.add(wingShell(0.93, true), 'body', { p: [0, y0, 0], s: [sx, 1, 1] });
    if (sx > 0) {
      // the fold line where the two shells overlap on the back centre
      const seam = [];
      for (let k = 0; k <= 8; k++) seam.push(wingPoint(Math.PI / 2, TH0 + 0.1 + ((TH1 - TH0 - 0.25) * k) / 8, 1.0));
      P.add(tube(seam.map(([x, y, z]) => [x, y0 + y, z]), 0.009, { segments: 20, radial: 8 }), 'accent');
    }
    const edge = [];
    for (let k = 0; k <= 16; k++) edge.push(wingPoint(PH0 + 0.14 + ((PH1 - PH0 - 0.2) * k) / 16, TH0, 1.0));
    P.add(tube(edge.map(([x, y, z]) => [sx * x, y0 + y, z]), 0.017, { segments: 56, radial: 8 }), 'accent');
  });

  // neck: a thick S, forward out of the chest, back over the body, forward again to the head
  const neck = [[0, y0 + 0.28, -0.17], [0, y0 + 0.44, -0.27], [0, y0 + 0.62, -0.22], [0, y0 + 0.8, -0.06], [0, y0 + 0.95, 0.0], [0, y0 + 1.08, -0.04], [0, y0 + 1.16, -0.11]];
  P.add(tube(neck, (t) => 0.105 - 0.045 * t, { segments: 56, radial: 20 }), 'body');
  // necklace: a gold ring with a drop where the neck leaves the chest
  P.add(new THREE.TorusGeometry(0.1, 0.014, 8, 36), 'accent', { p: [0, y0 + 0.43, -0.255], r: [Math.PI / 2 + 0.2, 0, 0] });
  P.add(blob(0.026, 12, 8), 'accent', { p: [0, y0 + 0.37, -0.36] });

  // head: rounded, looking forward; big eyes, a gold beak
  const hy = y0 + 1.2, hz = -0.13;
  P.add(blob(1, 26, 18), 'body', { p: [0, hy, hz], r: [0.15, 0, 0], s: [0.1, 0.095, 0.12] });
  P.add(new THREE.ConeGeometry(0.044, 0.13, 20), 'accent', { p: [0, hy - 0.025, hz - 0.165], r: [-Math.PI / 2 - 0.3, 0, 0], s: [1, 1, 0.65] });
  P.mirror((sx) => P.add(blob(0.008, 8, 6), 'dark', { p: [sx * 0.014, hy - 0.006, hz - 0.145] }));
  P.mirror((sx) => eye(P, [sx * 0.062, hy + 0.022, hz - 0.07], 0.045, 0.05, -sx * 0.5));

  // crown: a gold coronet with five ball points and a taller centre gem on a short stem
  const cy = hy + 0.07, cap = 0.06;
  crown(P, { y: cy, r: 0.072, hb: 0.05, hp: 0.06, n: 5, ball: 0.018, cap, flare: 0.18, gems: false, centre: [0, hz + 0.01] });
  const gy = HEIGHT.q - 0.042, sb = cy + 0.05 * 0.4 + cap - 0.01;
  P.add(new THREE.CylinderGeometry(0.014, 0.019, gy - sb, 12), 'accent', { p: [0, (gy + sb) / 2, hz + 0.01] });
  P.add(new THREE.OctahedronGeometry(0.042, 0), 'accent', { p: [0, gy, hz + 0.01], s: [0.75, 1, 0.75] });

  return P.build(mat, 'animals-queen');
}
