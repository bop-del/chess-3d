// fantasy king (CHE-367): a storybook king with a closed gold crown (arches, orb and cross), an ermine collar, a folded cape that opens
// to the front, a robe with a gold placket and belt, a round beard and a short sceptre held against the chest.
import { THREE, parts, foot, lathe, tube, blob, slab } from '../kit.js';
import { PI, aim, dirOf, onSphere, radiusAt, face, shell, beads, ring, limb } from './_fk.js';

const ROBE = [[0, 0.15], [0.24, 0.15], [0.272, 0.18], [0.262, 0.27], [0.232, 0.43], [0.198, 0.6], [0.182, 0.72], [0.192, 0.84], [0.198, 0.93], [0.17, 1.01], [0.09, 1.065], [0, 1.08]];

export function buildKing(mat) {
  const P = parts();
  const y0 = foot(P, 0.33, { style: 'round' });

  // robe
  P.add(lathe(ROBE, { count: 36, segments: 40 }), 'body');
  const rr = (y) => radiusAt(ROBE, y);
  // gold hem and a second thin hem line
  P.add(new THREE.TorusGeometry(rr(0.2) + 0.004, 0.016, 8, 44), 'accent', { p: [0, 0.2, 0], r: [PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(rr(0.26) + 0.002, 0.008, 6, 44), 'accent', { p: [0, 0.26, 0], r: [PI / 2, 0, 0] });
  // belt with a buckle
  P.add(new THREE.TorusGeometry(rr(0.66) + 0.004, 0.02, 8, 44), 'accent', { p: [0, 0.66, 0], r: [PI / 2, 0, 0], s: [1, 1, 1.15] });
  P.add(new THREE.TorusGeometry(0.03, 0.011, 8, 20), 'accent', { p: [0, 0.66, -rr(0.66) - 0.02] });
  // placket: a gold band down the front of the robe with buttons
  const front = [];
  for (let y = 0.21; y <= 0.97; y += 0.04) front.push([0, y, -rr(y) - 0.002]);
  P.add(tube(front, 0.017, { segments: 28, radial: 8 }), 'accent', { s: [1.5, 1, 1] });
  for (const y of [0.78, 0.86]) P.add(blob(0.016, 10, 8), 'accent', { p: [0, y, -rr(y) - 0.016] });

  // cape: a folded shell behind the back, open to the front, gold trim along the front edges and the hem
  // the cape hangs from under the collar, rounds over the shoulders and flares to the foot
  const rOut = (y) => {
    if (y > 0.93) { const u = (y - 0.93) / 0.12; return 0.235 - 0.06 * u * u; }
    const t = (0.93 - y) / (0.93 - 0.1);
    return 0.235 + 0.085 * Math.pow(t, 1.3);
  };
  const cape = shell(rOut, 0.1, 1.05, { th: 0.018, phiStart: -1.95, phiLength: 3.9, k: 7, amp: 0.048, foldFrom: 0.15, segments: 40, rows: 18 });
  P.add(cape.geo, 'body');
  P.mirror((sx) => {
    const edge = [];
    for (let y = 0.11; y <= 1.0; y += 0.04) edge.push(cape.at(1.95 * sx - 0.03 * sx, y, -0.004));
    P.add(tube(edge, 0.014, { segments: 32, radial: 6 }), 'accent');
  });
  const hem = [];
  for (let a = -1.93; a <= 1.93; a += 0.06) hem.push(cape.at(a, 0.125, -0.006));
  P.add(tube(hem, 0.014, { segments: 48, radial: 6 }), 'accent');

  // the back: a gold seam down the middle of the cape and a gold medallion with a star between the shoulders
  { const seam = []; for (let y = 0.13; y <= 0.86; y += 0.04) seam.push(cape.at(0, y, -0.006)); P.add(tube(seam, 0.013, { segments: 28, radial: 6 }), 'accent'); }
  { const c = cape.at(0, 0.84, 0.0), n = [c[0], 0.25, c[2]];
    P.add(new THREE.CylinderGeometry(0.06, 0.06, 0.016, 28), 'accent', { m: aim(c, n, 1, 0).multiply(new THREE.Matrix4().makeRotationX(PI / 2)) });
    P.add(new THREE.TorusGeometry(0.06, 0.009, 6, 28), 'accent', { m: aim([c[0], c[1], c[2] + 0.008], n) });
    const st = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2, q = i % 2 ? 0.018 : 0.042; st.push([Math.sin(a) * q, Math.cos(a) * q]); }
    P.add(slab(st, 0.008, { bevel: 0.003, curveSegments: 1 }), 'body', { m: aim([c[0], c[1], c[2] + 0.012], n) }); }

  // ermine collar: a fat soft ring on the shoulders with gold tails
  P.add(new THREE.TorusGeometry(0.15, 0.06, 10, 32), 'body', { p: [0, 1.0, 0], r: [PI / 2, 0, 0], s: [1, 1, 0.8] });
  for (const p of ring(10, 0.17, 1.0, PI / 10)) P.add(blob(0.012, 6, 5), 'accent', { p: [p[0], p[1] - 0.01, p[2]], s: [1, 1.8, 1] });
  // shoulder clasps holding the cape
  P.mirror((sx) => P.add(new THREE.CylinderGeometry(0.03, 0.03, 0.016, 20), 'accent', { p: [0.15 * sx, 0.995, -0.1], r: [PI / 2 - 0.5, 0, -0.5 * sx] }));

  // arms: sleeves to the chest, ermine cuffs, hands holding the sceptre
  const hand = { 1: [0.075, 0.69, -0.215], [-1]: [-0.05, 0.62, -0.225] };
  P.mirror((sx) => {
    const h = hand[sx];
    const cuff = [h[0] + 0.06 * sx, h[1] + 0.03, h[2] + 0.04];
    limb(P, 'body', [[0.19 * sx, 0.95, 0.0], [0.23 * sx, 0.84, -0.04], [0.2 * sx, 0.73, -0.12], cuff], 0.07, 0.064);
    P.add(new THREE.TorusGeometry(0.052, 0.022, 8, 20), 'body', { m: aim(cuff, [h[0] - cuff[0], h[1] - cuff[1], h[2] - cuff[2]]) });
    P.add(blob(0.045, 12, 10), 'body', { p: h, s: [1, 0.9, 0.9] });
  });
  // sceptre: short gold rod across the chest, a gem orb with a small crown on top
  const s0 = [-0.06, 0.5, -0.235], s1 = [0.12, 1.07, -0.215];
  P.add(tube([s0, s1], 0.014, { segments: 6, radial: 10 }), 'accent');
  P.add(blob(0.022, 12, 10), 'accent', { p: s0 });
  for (const t of [0.5, 0.6]) P.add(new THREE.TorusGeometry(0.02, 0.007, 6, 16), 'accent', { m: aim([s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t, s0[2] + (s1[2] - s0[2]) * t], [s1[0] - s0[0], s1[1] - s0[1], s1[2] - s0[2]]) });
  P.add(blob(0.045, 14, 10), 'accent', { p: [0.125, 1.1, -0.214] });
  for (const p of ring(5, 0.03, 1.145, 0)) P.add(new THREE.ConeGeometry(0.012, 0.035, 8), 'accent', { p: [p[0] + 0.125, p[1], p[2] - 0.214] });

  // head
  const H = [0, 1.235, -0.01], R = 0.165;
  P.add(blob(R, 28, 20), 'body', { p: H });
  // ears
  P.mirror((sx) => P.add(blob(0.04, 12, 10), 'body', { p: [0.16 * sx, 1.22, 0.0], s: [0.6, 1, 0.8] }));
  face(P, H, R, { eyeYaw: 0.43, eyePitch: 0.12, eyeR: 0.022, nose: 0.034, smile: false, brows: true, disc: true, browSlot: 'accent' });
  // round beard and moustache
  P.add(blob(0.13, 24, 16), 'body', { p: [0, 1.135, -0.075], s: [1.05, 0.95, 0.85] });
  P.mirror((sx) => {
    P.add(tube([[0.005 * sx, 1.195, -0.178], [0.05 * sx, 1.185, -0.17], [0.09 * sx, 1.195, -0.145]], (t) => 0.022 * (1 - t) + 0.008, { segments: 12, radial: 10 }), 'body');
    P.add(blob(0.009, 8, 6), 'body', { p: [0.09 * sx, 1.195, -0.145] });
  });
  // a smile under the moustache
  P.add(new THREE.TorusGeometry(0.03, 0.008, 6, 14, PI * 0.6), 'dark', { m: aim(onSphere(H, R, 0, -0.42, 0.06), dirOf(0, -0.2), 1, -PI / 2 - PI * 0.3) });
  // hair curls at the sides under the crown
  P.mirror((sx) => { for (const [a, y] of [[1.25, 1.3], [1.7, 1.27], [2.2, 1.26]]) P.add(blob(0.05, 12, 8), 'body', { p: [Math.sin(a) * 0.15 * sx, y, -Math.cos(a) * 0.15] }); });

  // crown: band with jewels and fleur points, two arches over a velvet cap, orb and cross on top
  const band = [[0.15, 1.3], [0.178, 1.3], [0.185, 1.35], [0.19, 1.42], [0.165, 1.425], [0.15, 1.36], [0.148, 1.3]];
  P.add(lathe(band, { count: 16, segments: 40 }), 'body');
  P.add(new THREE.TorusGeometry(0.186, 0.007, 6, 48), 'accent', { p: [0, 1.362, 0], r: [PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(0.18, 0.012, 6, 48), 'accent', { p: [0, 1.302, 0], r: [PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(0.188, 0.01, 6, 48), 'accent', { p: [0, 1.425, 0], r: [PI / 2, 0, 0] });
  for (const [i, p] of ring(8, 0.19, 1.362, 0).entries()) P.add(blob(i % 2 ? 0.017 : 0.024, 8, 6), 'accent', { p: [p[0] * 1.03, p[1], p[2] * 1.03], s: [1, 1.2, 0.6] });
  for (const [i, p] of ring(8, 0.19, 1.362, 0).entries()) if (!(i % 2)) P.add(new THREE.TorusGeometry(0.024, 0.006, 5, 12), 'accent', { m: aim(p, [p[0], 0, p[2]]) });
  // fleur points: a slab leaf with a ball, eight round the rim
  const leaf = slab([[-0.045, 0], [0.045, 0], [0.03, 0.03], [0.012, 0.06], [0, 0.1], [-0.012, 0.06], [-0.03, 0.03]], 0.016, { bevel: 0.006 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + PI / 8;
    P.add(leaf.clone(), 'accent', { p: [Math.sin(a) * 0.182, 1.415, -Math.cos(a) * 0.182], r: [0, -a, 0], s: i % 2 ? 0.75 : 1 });
    P.add(blob(0.016, 8, 6), 'accent', { p: [Math.sin(a) * 0.182, 1.415 + (i % 2 ? 0.08 : 0.105), -Math.cos(a) * 0.182] });
  }
  leaf.dispose();
  // velvet cap and arches
  P.add(lathe([[0.17, 1.4], [0.165, 1.47], [0.13, 1.56], [0.06, 1.6], [0, 1.61]], { count: 12, segments: 36 }), 'body');
  for (const a of [PI / 4, -PI / 4]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * PI; const rx = Math.cos(t) * 0.18, y = 1.42 + Math.sin(t) * 0.2;
      pts.push([Math.sin(a) * rx, y, -Math.cos(a) * rx]);
    }
    P.add(tube(pts, 0.019, { segments: 32, radial: 8 }), 'accent');
    for (let i = 3; i <= 13; i += 2) { const p = pts[i]; P.add(blob(0.013, 8, 6), 'accent', { p: [p[0] * 1.08, p[1] + 0.012, p[2] * 1.08] }); }
  }
  // orb and cross
  P.add(blob(0.055, 24, 16), 'accent', { p: [0, 1.665, 0] });
  P.add(new THREE.TorusGeometry(0.056, 0.007, 6, 32), 'accent', { p: [0, 1.665, 0], r: [PI / 2, 0, 0] });
  const cross = slab([[-0.02, 0], [0.02, 0], [0.02, 0.076], [0.054, 0.076], [0.054, 0.116], [0.02, 0.116], [0.02, 0.152], [-0.02, 0.152], [-0.02, 0.116], [-0.054, 0.116], [-0.054, 0.076], [-0.02, 0.076]], 0.03, { bevel: 0.014, curveSegments: 2 });
  P.add(cross, 'accent', { p: [0, 1.7, 0] });
  for (const p of [[0, 1.858, 0], [0.058, 1.796, 0], [-0.058, 1.796, 0]]) P.add(blob(0.014, 10, 8), 'accent', { p });

  return P.build(mat, 'fantasy-king');
}
