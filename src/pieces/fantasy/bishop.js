// fantasy bishop (CHE-367): a kind old mage with a tall pointed hat (bent tip, gold band, stars), a long beard with a gold clasp,
// a hooded robe with wide sleeves and a rope belt, holding an upright staff with a gold orb in a curl at his right.
import { THREE, parts, foot, lathe, tube, blob, slab } from '../kit.js';
import { PI, aim, dirOf, onSphere, radiusAt, face, shell, beads, ring, limb, flute } from './_fk.js';

const ROBE = [[0, 0.15], [0.245, 0.15], [0.272, 0.175], [0.258, 0.25], [0.222, 0.38], [0.185, 0.52], [0.165, 0.62], [0.165, 0.68], [0.15, 0.73], [0.1, 0.77], [0.04, 0.79], [0, 0.795]];

function star(r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2, q = i % 2 ? r * 0.45 : r; pts.push([Math.sin(a) * q, Math.cos(a) * q]); }
  return slab(pts, 0.008, { bevel: 0.004, curveSegments: 1 });
}

export function buildBishop(mat) {
  const P = parts();
  foot(P, 0.33, { style: 'round' });
  const rr = (y) => radiusAt(ROBE, y);

  // robe with long folds
  P.add(flute(lathe(ROBE, { count: 40, segments: 64 }), 0.6, 0.17, 10, 0.05), 'body');
  P.add(new THREE.TorusGeometry(rr(0.2) * 1.05 + 0.003, 0.016, 8, 52), 'accent', { p: [0, 0.2, 0], r: [PI / 2, 0, 0] });
  // gold stole down the front: two bands
  P.mirror((sx) => {
    const st = [];
    for (let y = 0.22; y <= 0.76; y += 0.04) { const x = 0.045 * sx; st.push([x, y, -Math.sqrt(Math.max(0, rr(y) ** 2 - x * x)) - 0.003]); }
    P.add(tube(st, 0.013, { segments: 20, radial: 6 }), 'accent', { s: [1.4, 1, 1] });
  });
  // rope belt with hanging tassels
  P.add(new THREE.TorusGeometry(rr(0.6) - 0.017, 0.017, 8, 44), 'accent', { p: [0, 0.6, 0], r: [PI / 2, 0, 0] });
  P.mirror((sx) => {
    const top = [0.07 * sx, 0.6, -rr(0.6) - 0.01];
    P.add(tube([top, [0.075 * sx, 0.52, -rr(0.52) - 0.012], [0.08 * sx, 0.44, -rr(0.44) - 0.012]], 0.008, { segments: 10, radial: 6 }), 'accent');
    P.add(new THREE.ConeGeometry(0.02, 0.05, 10), 'accent', { p: [0.08 * sx, 0.425, -rr(0.44) - 0.012] });
  });
  // hood folded on the back
  P.add(blob(0.13, 20, 14), 'body', { p: [0, 0.79, 0.09], s: [1.05, 0.65, 0.75] });

  // sleeves: the right hand holds the staff, the left rests on the belt
  P.mirror((sx) => {
    const right = sx > 0;
    const pts = right
      ? [[0.13, 0.75, 0.0], [0.19, 0.69, -0.03], [0.225, 0.66, -0.06]]
      : [[-0.13, 0.75, 0.0], [-0.18, 0.66, -0.05], [-0.13, 0.62, -0.15]];
    limb(P, 'body', pts, 0.05, 0.075);
    // the cuff: a gold band hugging the sleeve just inside its mouth, the mouth closed by a soft cap the hand comes out of
    const end = pts[2], prev = pts[1], dir = [end[0] - prev[0], end[1] - prev[1], end[2] - prev[2]];
    const L = Math.hypot(...dir), u = dir.map((v) => v / L), at = end.map((v, i) => v - u[i] * 0.012);
    P.add(new THREE.TorusGeometry(0.069, 0.011, 6, 24), 'accent', { m: aim(at, dir) });
    P.add(blob(0.072, 16, 8), 'body', { m: aim(end.map((v, i) => v - u[i] * 0.004), dir, [1, 1, 0.25]) });
  });
  P.add(blob(0.042, 12, 10), 'body', { p: [0.255, 0.66, -0.07] });
  P.add(blob(0.04, 12, 10), 'body', { p: [-0.1, 0.61, -0.18], s: [1, 0.85, 1] });

  // staff: upright at his right, a curl holding a gold orb on top
  const sx0 = 0.255, sz0 = -0.07;
  P.add(new THREE.CylinderGeometry(0.019, 0.022, 0.98, 12), 'body', { p: [sx0, 0.15 + 0.49, sz0] });
  for (const y of [0.3, 0.9, 1.04]) P.add(new THREE.TorusGeometry(0.023, 0.007, 6, 16), 'accent', { p: [sx0, y, sz0], r: [PI / 2, 0, 0] });
  const curl = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20, a = -PI / 2 + t * PI * 1.6; curl.push([sx0 + Math.cos(a) * 0.055 * (1 - 0.25 * t) - 0.0, 1.1 + 0.055 + Math.sin(a) * 0.055 * (1 - 0.25 * t), sz0]); }
  curl[0] = [sx0, 1.11, sz0];
  P.add(tube([[sx0, 1.06, sz0], ...curl], 0.016, { segments: 40, radial: 8 }), 'body', { m: new THREE.Matrix4().makeTranslation(-sx0, 0, -sz0).premultiply(new THREE.Matrix4().makeRotationY(PI / 2)).premultiply(new THREE.Matrix4().makeTranslation(sx0, 0, sz0)) });
  P.add(blob(0.012, 8, 6), 'body', { p: [sx0 + 0.0, 1.155, sz0] });
  P.add(blob(0.048, 24, 16), 'accent', { p: [sx0, 1.155, sz0] });

  // head, kind eyes under bushy brows, round nose
  const H = [0, 0.86, -0.01], R = 0.125;
  P.add(blob(R, 30, 20), 'body', { p: H });
  face(P, H, R, { eyeYaw: 0.4, eyePitch: 0.08, eyeR: 0.03, nose: 0.03, smile: false, brows: true, disc: true, browSlot: 'accent' });
  P.mirror((sx) => P.add(blob(0.034, 10, 8), 'body', { p: [0.122 * sx, 0.85, 0.0], s: [0.6, 1, 0.8] }));
  // long beard: a tapered lobe down the chest, a moustache, a gold clasp near the tip
  P.add(tube([[0, 0.745, -0.085], [0, 0.7, -0.13], [0, 0.62, -0.16], [0.0, 0.52, -0.17], [0.012, 0.44, -0.168]], (t) => 0.11 * Math.pow(1 - t, 0.7) + 0.014, { segments: 28, radial: 14 }), 'body', { s: [1.15, 1, 0.85] });
  // a thin gold edge down both sides of the beard so it reads on ebony
  {
    const curve = new THREE.CatmullRomCurve3([[0, 0.745, -0.085], [0, 0.7, -0.13], [0, 0.62, -0.16], [0.0, 0.52, -0.17], [0.012, 0.44, -0.168]].map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    P.mirror((sx) => {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = 0.12 + 0.86 * (i / 14), c = curve.getPointAt(t), r = 0.11 * Math.pow(1 - t, 0.7) + 0.014;
        pts.push([c.x * 1.15 + sx * (r * 1.15 - 0.006), c.y, c.z * 0.85 - r * 0.25]);
      }
      P.add(tube(pts, 0.007, { segments: 28, radial: 6 }), 'accent');
    });
  }
  P.add(blob(0.1, 20, 14), 'body', { p: [0, 0.755, -0.07], s: [1.1, 0.75, 0.85] });
  P.add(blob(0.016, 8, 6), 'body', { p: [0.012, 0.44, -0.145] });
  P.add(new THREE.TorusGeometry(0.06, 0.018, 6, 20), 'accent', { p: [0.0, 0.62, -0.15], r: [PI / 2 + 0.25, 0, 0], s: [1.15, 1, 0.85] });
  P.mirror((sx) => {
    P.add(tube([[0.004 * sx, 0.83, -0.14], [0.045 * sx, 0.815, -0.13], [0.075 * sx, 0.79, -0.105]], (t) => 0.02 * (1 - t) + 0.008, { segments: 10, radial: 8 }), 'body');
    P.add(blob(0.009, 8, 6), 'body', { p: [0.075 * sx, 0.79, -0.105] });
  });

  // hat: a wide soft brim, a tall cone with a bent tip, gold band, stars and a moon
  P.add(lathe([[0.1, -0.005], [0.2, -0.02], [0.235, -0.007], [0.232, 0.007], [0.19, 0.003], [0.1, 0.02]], { count: 20, segments: 48 }), 'body', { p: [0, 0.925, 0], r: [0.18, 0, 0], s: [0.9, 1, 0.9] });
  P.add(new THREE.TorusGeometry(0.21, 0.01, 6, 48), 'accent', { p: [0, 0.924, 0], r: [PI / 2 + 0.18, 0, 0] });
  const cone = [[0, 0.94, 0.0], [0, 1.08, 0.005], [0, 1.2, 0.02], [0, 1.29, 0.06], [0, 1.325, 0.115], [0, 1.315, 0.16]];
  P.add(tube(cone, (t) => 0.14 * Math.pow(1 - t, 1.15) + 0.013, { segments: 48, radial: 28 }), 'body');
  P.add(blob(0.017, 10, 8), 'accent', { p: cone[5] });
  P.add(new THREE.TorusGeometry(0.128, 0.018, 8, 44), 'accent', { p: [0, 1.0, 0.002], r: [PI / 2, 0, 0], s: [1, 1, 1] });
  // on the hat front: one big star and a crescent moon
  const hz = (y) => -(0.14 * Math.pow(1 - (y - 0.94) / 0.43, 1.15) + 0.013) * 0.97;
  P.add(star(0.042), 'accent', { p: [-0.02, 1.1, hz(1.1) - 0.004], r: [0.2, 0.15, 0] });
  P.add(new THREE.TorusGeometry(0.026, 0.009, 6, 16, PI * 1.2), 'accent', { p: [0.035, 1.2, hz(1.2) + 0.004], r: [0.3, -0.25, 0.5] });
  return P.build(mat, 'fantasy-bishop');
}
