// animals rook (CHE-367): a standing elephant carrying a small castle tower (a crenellated howdah) on its back, so the rook reads
// from above. Round body on four stubby legs with gold toenails, a big head with toy eyes, big round ears, a trunk curling up in
// front, a saddle blanket with a gold trim and tassels, a little tail.
import { THREE, parts, foot, tube, lathe } from '../kit.js';
import { ell, onEll, eye, latheSharp } from './_ar.js';

export function buildRook(mat) {
  const P = parts();
  const y0 = foot(P, 0.33, { style: 'grass' });

  // body: a wide round barrel the tower sits on
  const bc = [0, y0 + 0.25, 0.07], bs = [0.25, 0.185, 0.25];
  ell(P, 'body', bc, bs, [0, 0, 0], 32, 20);
  // legs: short stubby columns, a little wider at the foot, gold toenails all round the front
  for (const sx of [1, -1]) for (const z of [-0.07, 0.19]) {
    const lx = sx * 0.135;
    P.add(lathe([[0, 0], [0.07, 0], [0.074, 0.02], [0.068, 0.07], [0.064, 0.12], [0, 0.15]], { count: 16, segments: 24 }), 'body', { p: [lx, y0 - 0.012, z] });
    for (const k of [-1, 0, 1]) {
      const a = k * 0.6 + (z > 0 ? Math.PI : 0) * 0;
      ell(P, 'accent', [lx + Math.sin(a) * 0.07, y0 + 0.018, z - Math.cos(a) * 0.07], [0.02, 0.017, 0.011], [0, a, 0], 10, 8);
    }
  }
  // tail: a short curl with a round tuft
  P.add(tube([[0, bc[1] + 0.04, 0.29], [0, bc[1] + 0.0, 0.325], [0.03, bc[1] - 0.06, 0.33], [0.06, bc[1] - 0.07, 0.31]], (t) => 0.028 - 0.008 * t, { segments: 14, radial: 10 }), 'body');
  ell(P, 'accent', [0.072, bc[1] - 0.075, 0.305], [0.04, 0.046, 0.04], [0, 0, 0.4], 16, 12);

  // head
  const hc = [0, y0 + 0.4, -0.14], hs = [0.155, 0.15, 0.145];
  // a short neck so the head stands out from the barrel
  ell(P, 'body', [0, hc[1] - 0.04, -0.07], [0.13, 0.13, 0.1]);
  ell(P, 'body', hc, hs);
  for (const sx of [1, -1]) {
    const { p, n } = onEll(hc, hs, [sx * 0.55, 0.22, -0.8]);
    eye(P, p, n, 0.03);
  }
  // ears: big round flaps sunk into the side of the head, cupped forward (a thick rim lobe and a gold inner ear in the hollow)
  for (const sx of [1, -1]) {
    const ec = [sx * 0.19, hc[1] - 0.01, hc[2] + 0.07];
    const r = [0.1, sx * 0.42, sx * 0.12];
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...ec), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(1, 1, 1));
    const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m).toArray();
    ell(P, 'body', ec, [0.14, 0.155, 0.03], r, 32, 14);
    // the rim lobe curls forward on the outer edge: the cup
    P.add(new THREE.TorusGeometry(1, 0.14, 10, 40, Math.PI * 1.3), 'body', { m: m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(sx * 0.0, 0, -0.012), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sx > 0 ? -Math.PI * 0.65 : Math.PI * 0.35)), new THREE.Vector3(0.128, 0.142, 0.16))) });
    ell(P, 'accent', at(sx * 0.012, -0.006, -0.02), [0.1, 0.115, 0.012], r, 28, 12);
  }
  // trunk: out of the face, then curled up high in front of the tower and off to one side, so it shows from behind too
  const trunk = [[0, hc[1] - 0.03, hc[2] - 0.11], [0, hc[1] - 0.1, hc[2] - 0.15], [0, hc[1] - 0.18, hc[2] - 0.165], [0, hc[1] - 0.25, hc[2] - 0.18], [0, hc[1] - 0.28, hc[2] - 0.205], [0, hc[1] - 0.25, hc[2] - 0.235]];
  P.add(tube(trunk, (t) => 0.055 - 0.027 * t, { segments: 40, radial: 14 }), 'body');
  ell(P, 'body', trunk[trunk.length - 1], [0.029, 0.029, 0.029], [0, 0, 0], 12, 10);
  {
    const c = new THREE.CatmullRomCurve3(trunk.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    for (const t of [0.5, 0.6]) {
      const p = c.getPointAt(t), d = c.getTangentAt(t);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      const rr = 0.055 - 0.027 * t;
      P.add(new THREE.TorusGeometry(rr + 0.002, 0.009, 8, 24), 'accent', { m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)) });
    }
  }
  // a small smile under the trunk
  {
    const sm = [];
    for (let i = 0; i <= 6; i++) {
      const a = -0.5 + i / 6;
      const { p, n } = onEll(hc, hs, [a * 0.6, -0.55 + 0.12 * Math.abs(a), -0.75]);
      sm.push(p.addScaledVector(n, -0.002).toArray());
    }
    P.add(tube(sm, 0.006, { segments: 14, radial: 6 }), 'dark');
  }

  // saddle blanket hanging down the flanks with a wavy gold trim and tassels, a round howdah cushion on top
  const tc = [0, 0, 0.08];
  const TH = 1.22, bx = bs[0] + 0.012, by = bs[1] + 0.012, bz = 0.215;
  P.add(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, TH), 'body', { p: [bc[0], bc[1], tc[2]], s: [bx, by, bz] });
  const rim = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const th = TH + 0.06 * Math.sin(a * 8) * 0.5;
    rim.push([Math.cos(a) * Math.sin(th) * (bx + 0.003), bc[1] + Math.cos(th) * (by + 0.003), tc[2] + Math.sin(a) * Math.sin(th) * (bz + 0.003)]);
  }
  P.add(tube(rim, 0.014, { segments: 96, radial: 8, closed: true }), 'accent');
  for (const sx of [1, -1]) for (const a0 of [-0.45, 0.45]) {
    const a = (sx > 0 ? 0 : Math.PI) + a0 * sx;
    const th = TH + 0.03;
    ell(P, 'accent', [Math.cos(a) * Math.sin(th) * (bx + 0.01), bc[1] + Math.cos(th) * by - 0.03, tc[2] + Math.sin(a) * Math.sin(th) * bz], [0.017, 0.028, 0.017], [0, 0, 0], 10, 8);
  }
  const cy = bc[1] + by - 0.02;
  P.add(lathe([[0, 0], [0.17, 0], [0.19, 0.015], [0.19, 0.03], [0.17, 0.045], [0, 0.05]], { count: 20, segments: 40 }), 'body', { p: [0, cy, tc[2]] });
  P.add(new THREE.TorusGeometry(0.188, 0.011, 8, 48), 'accent', { p: [0, cy + 0.022, tc[2]], r: [Math.PI / 2, 0, 0] });

  // the castle tower on the back
  const ty = cy + 0.04, tz = tc[2];
  const R = 0.135, top = 0.975;
  P.add(latheSharp([[0, ty], [R + 0.03, ty], [R + 0.03, ty + 0.03], [R + 0.012, ty + 0.06], [R - 0.01, top - 0.16], [R + 0.03, top - 0.12], [R + 0.03, top - 0.085], [R - 0.02, top - 0.085], [R - 0.02, top - 0.105], [0, top - 0.105]], 40), 'body', { p: [0, 0, tz] });
  // gold bands: one low, one under the corbel
  P.add(new THREE.TorusGeometry(R + 0.012, 0.012, 8, 40), 'accent', { p: [0, ty + 0.085, tz], r: [Math.PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(R - 0.002, 0.01, 8, 40), 'accent', { p: [0, top - 0.158, tz], r: [Math.PI / 2, 0, 0] });
  // merlons
  const M = 6;
  for (let i = 0; i < M; i++) {
    const a = (i / M) * Math.PI * 2 + Math.PI / M;
    const rm = R + 0.003;
    P.add(new THREE.BoxGeometry(0.058, 0.09, 0.044), 'body', { p: [Math.sin(a) * rm, top - 0.045, tz + Math.cos(a) * rm], r: [0, a, 0] });
  }
  // an arched gold window on the front and on each side
  for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2, 0]) {
    const arch = new THREE.Shape();
    arch.moveTo(-0.022, 0); arch.lineTo(0.022, 0); arch.lineTo(0.022, 0.045); arch.absarc(0, 0.045, 0.022, 0, Math.PI, false); arch.lineTo(-0.022, 0);
    const g = new THREE.ExtrudeGeometry(arch, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -0.006);
    const rr = R - 0.008;
    P.add(g, 'accent', { p: [Math.sin(a) * rr, top - 0.27, tz + Math.cos(a) * rr], r: [0, a, 0] });
  }

  return P.build(mat, 'animals-rook');
}
