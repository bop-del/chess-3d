// animals knight (CHE-367): a friendly cartoon horse, head and neck rising from the grass like the chess knight, head toward -z.
// A round chest, an arched neck, a big cranium with toy eyes and a long soft muzzle, ears with gold inner ears, a mane of
// rounded locks down the back of the neck and a forelock, a gold bridle with cheek rosettes and a gold chest band.
import { THREE, parts, foot, tube, lathe } from '../kit.js';
import { ell, onEll, eye, orient } from './_ar.js';

export function buildKnight(mat) {
  const P = parts();
  const y0 = foot(P, 0.33, { style: 'grass' });

  // chest: a smooth breast flowing from the grass into the neck
  P.add(lathe([[0, 0], [0.2, 0], [0.215, 0.05], [0.205, 0.12], [0.17, 0.2], [0.135, 0.26], [0, 0.3]], { segments: 40 }), 'body', { p: [0, y0 - 0.01, 0.03] });
  // neck: an arched tapered tube from the chest up to the head, leaning forward like the chess knight
  const neck = [[0, y0 + 0.1, 0.06], [0, y0 + 0.33, 0.08], [0, y0 + 0.54, 0.04], [0, y0 + 0.7, -0.03]];
  P.add(tube(neck, (t) => 0.16 - 0.04 * t, { segments: 24, radial: 24 }), 'body');

  // head: everything of the head goes through HP, which scales it 10 % up around the top of the neck and sets it a little lower,
  // so the head reads at phone size
  const pivot = new THREE.Vector3(0, y0 + 0.72, -0.02);
  const S = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y - 0.035, pivot.z).multiply(new THREE.Matrix4().makeScale(1.1, 1.1, 1.1)).multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  const HP = {
    add(geo, slot, { p = [0, 0, 0], r = [0, 0, 0], s = 1, m = null } = {}) {
      const mm = m ? m.clone() : new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])));
      P.add(geo, slot, { m: S.clone().multiply(mm) });
      return HP;
    },
  };
  const hcW = new THREE.Vector3(0, y0 + 0.8, 0).applyMatrix4(S);
  // head: cranium, bridge and muzzle, nose a little down
  const hc = [0, y0 + 0.8, 0.0], hs = [0.16, 0.155, 0.16];
  ell(HP, 'body', hc, hs);
  ell(HP, 'body', [0, hc[1] - 0.045, -0.1], [0.125, 0.12, 0.125]);
  const mc = [0, hc[1] - 0.105, -0.205], ms = [0.128, 0.11, 0.14];
  ell(HP, 'body', mc, ms, [0.2, 0, 0]);
  // nostrils and a small smile
  for (const sx of [1, -1]) {
    const { p, n } = onEll(mc, ms, [sx * 0.42, 0.25, -0.88]);
    HP.add(new THREE.SphereGeometry(1, 12, 10), 'dark', { m: orient(p.clone().addScaledVector(n, -0.006), n, [0.016, 0.022, 0.008], sx * 0.35) });
  }
  const sm = [];
  for (let i = 0; i <= 6; i++) {
    const a = -0.5 + i / 6;
    const { p, n } = onEll(mc, ms, [a * 0.75, -0.42 + 0.12 * Math.abs(a), -0.86]);
    sm.push(p.addScaledVector(n, -0.002).toArray());
  }
  HP.add(tube(sm, 0.0065, { segments: 16, radial: 6 }), 'dark');

  // eyes: big and set toward the front
  for (const sx of [1, -1]) {
    const { p, n } = onEll(hc, hs, [sx * 0.6, 0.18, -0.78]);
    eye(HP, p, n, 0.042);
  }

  // ears: upright ovals with gold insides, leaning out
  for (const sx of [1, -1]) {
    const r = [-0.15, 0, -sx * 0.32];
    const ec = [sx * 0.085, hc[1] + 0.19, 0.04];
    ell(HP, 'body', ec, [0.045, 0.095, 0.032], r, 16, 12);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...ec), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(1, 1, 1));
    const inner = new THREE.Vector3(0, -0.006, -0.018).applyMatrix4(m);
    ell(HP, 'accent', inner.toArray(), [0.026, 0.068, 0.012], r, 14, 10);
  }

  // forelock: three locks tumbling over the forehead
  ell(HP, 'body', [0, hc[1] + 0.13, -0.04], [0.05, 0.05, 0.06], [0.4, 0, 0], 16, 12);
  ell(HP, 'body', [0.03, hc[1] + 0.105, -0.1], [0.04, 0.045, 0.045], [0.6, 0, 0.3], 14, 10);
  ell(HP, 'body', [-0.035, hc[1] + 0.1, -0.095], [0.038, 0.042, 0.042], [0.6, 0, -0.3], 14, 10);

  // mane: a soft crest down the back of the neck covered with flat rounded locks that alternate sides
  const mp = [[0, hcW.y + 0.13, 0.05], [0, hcW.y + 0.03, 0.16], [0, y0 + 0.55, 0.17], [0, y0 + 0.37, 0.2], [0, y0 + 0.2, 0.2]];
  P.add(tube(mp, (t) => 0.05 - 0.01 * t, { segments: 24, radial: 12 }), 'body');
  const mane = new THREE.CatmullRomCurve3(mp.map((p) => new THREE.Vector3(...p)));
  const N = 12;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const p = mane.getPointAt(t), d = mane.getTangentAt(t);
    const sx = i % 2 ? 1 : -1;
    const rr = 0.058 + 0.012 * Math.sin(t * Math.PI);
    const tilt = Math.atan2(-d.z, -d.y);
    ell(P, 'body', [sx * 0.03, p.y, p.z + 0.012], [rr * 0.62, rr * 1.25, rr * 0.6], [tilt, 0, sx * 0.3], 16, 12);
  }

  // bridle: noseband around the muzzle, cheek straps over the head behind the ears, rosettes on the cheeks
  const nb = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    nb.push(onEll(mc, ms, [Math.cos(a), Math.sin(a), 0.15]).p);
  }
  const nbc = new THREE.Vector3(...mc);
  const nbPts = nb.map((p) => { p.sub(nbc).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.2).add(nbc); return p.toArray(); });
  HP.add(tube(nbPts, 0.017, { segments: 48, radial: 8, closed: true }), 'accent');
  const H = (u) => onEll(hc, hs, u).p.toArray();
  const half = (sx) => [onEll(mc, ms, [sx, 0.1, 0.25]).p.toArray(), H([sx, -0.3, -0.15]), H([sx, 0.15, 0.25]), H([sx * 0.6, 0.72, 0.38])];
  const strap = [...half(1), H([0, 0.86, 0.5]), ...half(-1).reverse()];
  HP.add(tube(strap, 0.016, { segments: 64, radial: 8 }), 'accent');
  for (const sx of [1, -1]) {
    const { p, n } = onEll(hc, hs, [sx, -0.15, -0.05]);
    HP.add(new THREE.SphereGeometry(1, 16, 10), 'accent', { m: orient(p, n, [0.042, 0.042, 0.018]) });
  }

  // browband: a gold strap across the forehead below the forelock, joining the cheek straps
  {
    const bb = [];
    for (let i = 0; i <= 12; i++) {
      const a = -1 + (2 * i) / 12;
      bb.push(onEll(hc, hs, [a * 0.95, 0.42, -0.62 + 0.2 * Math.abs(a)]).p.toArray());
    }
    HP.add(tube(bb, 0.015, { segments: 24, radial: 8 }), 'accent');
  }

  // gold chest band where the neck meets the breast
  const cb = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    cb.push([Math.cos(a) * 0.19, y0 + 0.155 + Math.sin(a) * 0.02, 0.03 + Math.sin(a) * 0.19]);
  }
  P.add(tube(cb, 0.016, { segments: 48, radial: 8, closed: true }), 'accent');
  ell(P, 'accent', [0, y0 + 0.135, -0.172], [0.034, 0.034, 0.02], [0, 0, 0], 16, 10);

  return P.build(mat, 'animals-knight');
}
