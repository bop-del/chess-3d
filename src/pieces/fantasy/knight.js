// fantasy knight (CHE-367): a friendly little dragon sitting on the round foot. Long neck leaning forward to a big horse like
// head (-z), kind eyes, gold horns, gold belly plates and a gold spine row, wings folded along the back with gold bones, and a
// tail curled around the foot ending in a gold spade. From above it reads like a chess knight: a head on a neck leaning forward.
import { THREE, parts, foot, slab, blob, tube } from '../kit.js';
import { eye, rod, along } from './_fr.js';

const v3 = (a) => new THREE.Vector3(...a);
const X = new THREE.Vector3(1, 0, 0);

export function buildKnight(mat) {
  const P = parts();
  const y0 = foot(P, 0.33, { style: 'round' });

  // ---- torso: an egg leaning forward, haunches, hind feet
  const TC = v3([0, y0 + 0.2, 0.07]), TS = v3([0.15, 0.2, 0.15]), TQ = new THREE.Quaternion().setFromAxisAngle(X, -0.3);
  P.add(blob(1, 32, 22), 'body', { m: new THREE.Matrix4().compose(TC, TQ, TS) });
  // a point on the torso surface at height u (-1..1) on the front (side -1) or back (side 1), with its up tangent and half width
  const torso = (u, side) => {
    const c = Math.sqrt(1 - u * u);
    const p = v3([0, u * TS.y, side * TS.z * c]).applyQuaternion(TQ).add(TC);
    const d = v3([0, TS.y * c, -side * TS.z * u]).applyQuaternion(TQ).normalize();
    return { p, d, w: TS.x * c };
  };
  P.mirror((sx) => {
    P.add(blob(1, 24, 16), 'body', { p: [sx * 0.115, y0 + 0.09, 0.09], s: [0.095, 0.1, 0.15] });
    P.add(blob(1, 16, 12), 'body', { p: [sx * 0.155, y0 + 0.022, -0.04], s: [0.05, 0.034, 0.085] });
    for (const dx of [-0.024, 0, 0.024]) P.add(blob(0.015, 10, 8), 'accent', { p: [sx * 0.155 + dx, y0 + 0.016, -0.118] });
  });

  // ---- neck: a centre line from inside the chest, up and forward into the head; radius tapers
  const NC = new THREE.CatmullRomCurve3([[0, y0 + 0.26, 0.02], [0, y0 + 0.42, -0.01], [0, y0 + 0.56, -0.02], [0, y0 + 0.67, -0.05], [0, y0 + 0.76, -0.105]].map(v3));
  const nr = (t) => 0.126 - t * 0.062;
  P.add(tube(NC.getSpacedPoints(12).map((p) => p.toArray()), nr, { segments: 32, radial: 16 }), 'body');
  const neck = (t, side) => {
    const c = NC.getPointAt(t), d = NC.getTangentAt(t);
    const n = new THREE.Vector3().crossVectors(d, X).normalize(); // points toward -z for an upward tangent
    return { p: c.clone().addScaledVector(n, -side * nr(t)), d, w: nr(t), n };
  };

  // ---- belly plates: gold bands across the front, chest then neck
  const plate = ({ p, d, w }, k = 1) => P.add(blob(1, 20, 10), 'accent', { m: along(p.toArray(), d.toArray(), [w * 0.82 * k, 0.019, 0.035]) });
  for (const u of [-0.55, -0.32, -0.1, 0.12, 0.34]) plate(torso(u, -1));
  // neck plates: overlapping gold scale plates down the front of the neck, each tipped so its lower edge stands out
  for (const t of [0.3, 0.43, 0.56, 0.69, 0.82]) {
    const { p, d } = neck(t, -1), r = nr(t);
    const n = new THREE.Vector3().crossVectors(d, X).normalize();
    const m = along(p.clone().addScaledVector(n, -0.002).toArray(), d.toArray()).multiply(new THREE.Matrix4().makeRotationX(0.35));
    m.multiply(new THREE.Matrix4().makeScale(r * 0.92, 0.05, 0.02));
    P.add(blob(1, 24, 12), 'accent', { m });
  }

  // ---- head: big skull, long rounded snout, jaw, cheeks
  const H = [0, y0 + 0.82, -0.12];
  // gold muzzle band round the middle of the snout
  {
    const m = new THREE.Matrix4().compose(v3([0, H[1] - 0.035, H[2] - 0.14]), new THREE.Quaternion().setFromAxisAngle(X, -0.22), v3([1, 1, 1]));
    m.multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.035)).multiply(new THREE.Matrix4().makeScale(0.073, 0.063, 0.085));
    P.add(new THREE.TorusGeometry(1, 0.13, 10, 40), 'accent', { m });
  }
  P.add(blob(1, 32, 22), 'body', { p: H, s: [0.1, 0.095, 0.11] });
  P.add(blob(1, 32, 24), 'body', { p: [0, H[1] - 0.035, H[2] - 0.14], s: [0.074, 0.064, 0.125], r: [-0.22, 0, 0] });
  P.add(blob(1, 24, 16), 'body', { p: [0, H[1] - 0.07, H[2] - 0.09], s: [0.078, 0.042, 0.11], r: [-0.08, 0, 0] });
  P.mirror((sx) => {
    // nostrils on a little nose bump and a gentle smile
    P.add(blob(1, 16, 12), 'body', { p: [sx * 0.03, H[1] - 0.0, H[2] - 0.235], s: [0.03, 0.022, 0.03] });
    P.add(blob(0.011, 10, 8), 'dark', { p: [sx * 0.032, H[1] + 0.006, H[2] - 0.258], s: [1, 0.7, 1] });
    P.add(new THREE.TorusGeometry(0.015, 0.0045, 8, 20), 'accent', { m: along([sx * 0.032, H[1] + 0.006, H[2] - 0.259], [sx * 0.25, 0.35, -1], 1, new THREE.Vector3(0, 0, 1)) });
    P.add(tube([[sx * 0.07, H[1] - 0.05, H[2] - 0.07], [sx * 0.066, H[1] - 0.068, H[2] - 0.14], [sx * 0.042, H[1] - 0.07, H[2] - 0.22], [sx * 0.03, H[1] - 0.062, H[2] - 0.245]], 0.0042, { segments: 16, radial: 6 }), 'dark');
    // cheeks
    P.add(blob(1, 16, 12), 'body', { p: [sx * 0.07, H[1] - 0.04, H[2] - 0.02], s: [0.04, 0.045, 0.05] });
  });
  // eyes on the sides, looking forward and out; soft brows above
  P.mirror((sx) => {
    eye(P, [sx * 0.074, H[1] + 0.022, H[2] - 0.06], [sx * 0.72, 0.12, -0.68], 0.028, { ring: 1.5 });
    P.add(tube([[sx * 0.03, H[1] + 0.07, H[2] - 0.095], [sx * 0.065, H[1] + 0.075, H[2] - 0.08], [sx * 0.092, H[1] + 0.055, H[2] - 0.05]], (t) => 0.011 - Math.abs(t - 0.4) * 0.008, { segments: 12, radial: 8 }), 'accent');
  });
  // horns: gold, sweeping up and back; ear frills behind them
  P.mirror((sx) => {
    const hp = [[sx * 0.045, H[1] + 0.06, H[2] + 0.015], [sx * 0.058, H[1] + 0.14, H[2] + 0.05], [sx * 0.068, H[1] + 0.2, H[2] + 0.12]];
    P.add(tube(hp, (t) => 0.026 - t * 0.012, { segments: 18, radial: 10 }), 'accent');
    P.add(blob(0.019, 14, 10), 'accent', { p: hp[2] });
    P.add(new THREE.TorusGeometry(0.026, 0.007, 8, 20), 'accent', { m: along([sx * 0.046, H[1] + 0.066, H[2] + 0.017], [sx * 0.15, 1, 0.4], 1, new THREE.Vector3(0, 0, 1)) });
    const fr = slab([[0, 0], [0.08, 0.035], [0.06, 0.05], [0.1, 0.08], [0.055, 0.075], [0.07, 0.11], [0.0, 0.06]], 0.01, { bevel: 0.005, curveSegments: 4 });
    P.add(fr, 'body', { m: frill(sx, [sx * 0.075, H[1] - 0.01, H[2] + 0.05]) });
  });
  // a little gold crest knob between the horns
  P.add(blob(1, 12, 10), 'accent', { p: [0, H[1] + 0.09, H[2] + 0.01], s: [0.018, 0.024, 0.03] });

  // ---- spine row: small gold fins down the back of the head and neck, along the back to the tail root
  const fin = ({ p, d }, s) => {
    const out = new THREE.Vector3().crossVectors(X, d).normalize(); // away from the front: the back
    P.add(blob(1, 12, 8), 'accent', { m: along(p.toArray(), out.toArray(), [s * 0.35, s * 1.3, s]) });
  };
  fin({ p: v3([0, H[1] + 0.085, H[2] + 0.075]), d: v3([0, 0.3, -1]).normalize() }, 0.02);
  for (const t of [0.95, 0.83, 0.71, 0.59, 0.47, 0.35]) fin(neck(t, 1), 0.02);
  for (const u of [0.45, 0.2, -0.05, -0.3, -0.55]) fin(torso(u, 1), 0.019);

  // ---- front legs with paws resting on the foot
  P.mirror((sx) => {
    rod(P, [sx * 0.085, y0 + 0.25, -0.05], [sx * 0.085, y0 + 0.05, -0.135], 0.038, 0.027);
    P.add(blob(1, 16, 12), 'body', { p: [sx * 0.085, y0 + 0.024, -0.16], s: [0.04, 0.03, 0.055] });
    for (const dx of [-0.02, 0, 0.02]) P.add(blob(0.012, 10, 8), 'accent', { p: [sx * 0.085 + dx, y0 + 0.016, -0.208] });
  });

  // ---- wings folded along the back: curved membranes with scalloped trailing edges, gold bones and a claw
  P.mirror((sx) => {
    const W = wing(sx, [sx * 0.095, y0 + 0.36, 0.03]);
    const shape = [[0, 0], [0.05, 0.13], [0.11, 0.24], [0.175, 0.305], [0.215, 0.29], [0.255, 0.255], [0.2, 0.2], [0.27, 0.12], [0.19, 0.075], [0.245, -0.02], [0.165, -0.005], [0.15, -0.09], [0.085, -0.06], [0.035, -0.035]];
    const bend = (x) => sx * 0.9 * x * x;
    const g = slab(denser(shape), 0.013, { bevel: 0.005, curveSegments: 4 });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + bend(pos.getX(i)));
    g.computeVertexNormals();
    P.add(g, 'body', { m: W });
    const L = (x, y) => v3([x, y, bend(x) + sx * 0.0]).applyMatrix4(W).toArray();
    P.add(tube([L(0, 0), L(0.05, 0.13), L(0.11, 0.24), L(0.175, 0.3)], (t) => 0.024 - t * 0.008, { segments: 20, radial: 10 }), 'accent');
    P.add(blob(0.02, 12, 10), 'accent', { p: L(0.175, 0.3) });
    for (const tip of [[0.25, 0.255], [0.262, 0.12], [0.24, -0.015], [0.15, -0.08]]) {
      const pts = [];
      for (let k = 0; k <= 6; k++) { const s = k / 6; pts.push(L(0.15 + (tip[0] - 0.15) * s, 0.27 + (tip[1] - 0.27) * s)); }
      P.add(tube(pts, (t) => 0.011 - t * 0.004, { segments: 10, radial: 6 }), 'body');
    }
  });

  // ---- tail: from the back, curling round the right side of the foot to the front, gold scutes, a gold spade
  const tail = [[0, y0 + 0.07, 0.19], [0.1, y0 + 0.04, 0.245], [0.2, y0 + 0.03, 0.18], [0.248, y0 + 0.028, 0.04], [0.228, y0 + 0.03, -0.1], [0.165, y0 + 0.035, -0.18]];
  const tr = (t) => 0.062 - t * 0.042;
  P.add(tube(tail, tr, { segments: 40, radial: 12 }), 'body');
  const tc = new THREE.CatmullRomCurve3(tail.map(v3), false, 'centripetal');
  for (let i = 1; i < 8; i++) {
    const t = i * 0.115, p = tc.getPointAt(t), d = tc.getTangentAt(t);
    const s = 0.018 - t * 0.008;
    P.add(blob(1, 10, 8), 'accent', { m: along([p.x, p.y + tr(t) * 0.92, p.z], [0, 1, 0], [s * 0.4, s * 1.1, s]).multiply(new THREE.Matrix4().makeRotationY(Math.atan2(d.x, d.z))) });
  }
  const end = tc.getPointAt(1), dir = tc.getTangentAt(1);
  const spade = slab([[-0.01, -0.012], [0.03, -0.04], [0.075, 0.0], [0.03, 0.04], [-0.01, 0.012]], 0.014, { bevel: 0.006, curveSegments: 4 });
  const sm = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  sm.premultiply(new THREE.Matrix4().makeRotationY(Math.atan2(-dir.z, dir.x)));
  sm.premultiply(new THREE.Matrix4().makeTranslation(end.x, end.y + 0.002, end.z));
  P.add(spade, 'accent', { m: sm });

  return P.build(mat, 'fantasy-knight');
}

// an outline with extra points along each edge, so a bend applied per vertex stays smooth
function denser(pts, n = 4) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}

// an ear frill: the outline x runs back (+z), y up, leaning out from the skull
function frill(sx, p) {
  const m = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
  m.premultiply(new THREE.Matrix4().makeRotationZ(-sx * 0.55));
  m.premultiply(new THREE.Matrix4().makeTranslation(...p));
  return m;
}

// wing placement: the local outline x runs back (+z), y up; the plane sits on the flank, leans out and tips back a little
function wing(sx, p) {
  const m = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
  m.premultiply(new THREE.Matrix4().makeRotationZ(-sx * 0.12));
  m.premultiply(new THREE.Matrix4().makeRotationX(-0.25));
  m.premultiply(new THREE.Matrix4().makeTranslation(...p));
  return m;
}
