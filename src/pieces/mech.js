// Mech set (CHE-368, ?pieces=mech): toy robots with armour plates, bolts, hoses, dark visors, round glowing eyes and
// glow strips recessed in dark channels. Pawn a hover drone, knight a walker with a horse head and a glowing mane, bishop
// a robot with a notched mitre, rook a turret with twin barrels, queen a slim robot with a fan crown, king a command mech
// with a glowing cross. Every piece has a back feature (reactor behind a grille, vents, a rear status light), since the
// white player mostly sees backs. White: off white armour, cyan eyes and accents; black: gunmetal armour with light steel
// caps, amber eyes, orange accents. Static parts merge into one mesh per material (body with vertex colours, accent, eye,
// beam); animated parts are their own groups. Panel lines: a small DataTexture on the body material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createSetStyle, grp, anim } from './frame.js';

const PI = Math.PI;
const PAL = {
  w: { armor: '#eef1f5', plate: '#a9b5c4', dark: '#27303c', steel: '#d3dae3', cap: '#fbfcfd', hi: '#ffffff', accent: '#00b4ff', eye: '#3df2ff', beam: 0.48, cross: '#22d8ff' },
  b: { armor: '#717b89', plate: '#3c424c', dark: '#14161a', steel: '#9aa3b0', cap: '#b4bdc9', hi: '#ffffff', accent: '#ff7414', eye: '#ffb02e', beam: 0.38, cross: '#ff9a1a' },
};

// panel texture: plate borders and corner rivets on every face, a faint grain inside
function panelTexture() {
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const e = Math.min(x, y, N - 1 - x, N - 1 - y);
    const rx = Math.min(Math.abs(x - 7), Math.abs(x - 56)), ry = Math.min(Math.abs(y - 7), Math.abs(y - 56));
    let v = 250 - ((x * 7 + y * 13) % 5) * 2;
    if (e < 2) v = 120; else if (e < 3) v = 200;
    if (rx * rx + ry * ry <= 3) v = 150;
    const i = (y * N + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// a non indexed copy with position, normal, uv (and colour, if it has one) only, moved into place
function place(geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const src = geo.index ? geo.toNonIndexed() : geo.clone();
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) if (src.getAttribute(k)) g.setAttribute(k, src.getAttribute(k));
  _e.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ');
  g.applyMatrix4(_m.compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e), _s.set(scl[0], scl[1], scl[2])));
  geo.dispose();
  return g;
}
// a point on a part: local offset l, turned by rot, moved to pos
const _v = new THREE.Vector3(), _eu = new THREE.Euler();
function at(pos, rot, l) {
  _v.set(l[0], l[1], l[2]).applyEuler(_eu.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ'));
  return [pos[0] + _v.x, pos[1] + _v.y, pos[2] + _v.z];
}
const fill = (n, c) => { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } return a; };

/** Collects parts per material; meshes() merges them into at most four meshes. */
class Parts {
  constructor(pal) { this.pal = pal; this.L = { body: [], accent: [], eye: [], beam: [], cross: [] }; }
  body(col, geo, pos, rot, scl) {
    const g = place(geo, pos, rot, scl);
    if (!g.getAttribute('color')) g.setAttribute('color', new THREE.BufferAttribute(fill(g.getAttribute('position').count, new THREE.Color(this.pal[col])), 3));
    this.L.body.push(g);
    return this;
  }
  acc(geo, pos, rot, scl) { this.L.accent.push(place(geo, pos, rot, scl)); return this; }
  eye(geo, pos, rot, scl) { this.L.eye.push(place(geo, pos, rot, scl)); return this; }
  cross(geo, pos, rot, scl) { this.L.cross.push(place(geo, pos, rot, scl)); return this; }
  // the hover beam fades out to the ground: vertex colour from bright at the top to black (additive: nothing) at the base
  beam(geo, pos, rot, scl, floor = 0) {
    const g = place(geo, pos, rot, scl), p = g.getAttribute('position'), n = p.count, a = new Float32Array(n * 3);
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { y0 = Math.min(y0, p.getY(i)); y1 = Math.max(y1, p.getY(i)); }
    for (let i = 0; i < n; i++) { const f = floor + (1 - floor) * Math.pow((p.getY(i) - y0) / (y1 - y0 || 1), 1.6); a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = f; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    this.L.beam.push(g);
    return this;
  }
  meshes(mats) {
    const out = [];
    for (const k of ['body', 'accent', 'eye', 'beam', 'cross']) {
      if (!this.L[k].length) continue;
      const g = mergeGeometries(this.L[k], false);
      for (const x of this.L[k]) x.dispose();
      g.computeBoundingBox(); g.computeBoundingSphere();
      const o = new THREE.Mesh(g, mats[k]);
      if (k !== 'body') o.userData.noShadow = true;
      out.push(o);
    }
    return out;
  }
}

/** createStyle({ quality }): the mech piece style for pieceset.js. */
export function createStyle({ quality } = {}) {
  const Q = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
  const RS = [8, 12, 16][Q];            // round parts
  const TT = [12, 20, 28][Q];           // torus tube steps
  const tex = panelTexture();
  const mats = {};
  for (const c of ['w', 'b']) {
    const p = PAL[c];
    mats[c] = {
      body: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, metalness: c === 'w' ? 0.12 : 0.2, roughness: c === 'w' ? 0.5 : 0.45, flatShading: true }),
      accent: new THREE.MeshStandardMaterial({ color: p.accent, emissive: p.accent, emissiveIntensity: 1.5, metalness: 0, roughness: 0.4, flatShading: true }),
      eye: new THREE.MeshStandardMaterial({ color: p.eye, emissive: p.eye, emissiveIntensity: 1.6, metalness: 0, roughness: 0.3, flatShading: true }),
      // the king's cross: its own steady glow, kept below tone mapping wash out
      cross: new THREE.MeshStandardMaterial({ color: p.cross, emissive: p.cross, emissiveIntensity: 0.95, metalness: 0, roughness: 0.4, flatShading: true }),
      beam: new THREE.MeshBasicMaterial({ color: p.accent, vertexColors: true, transparent: true, opacity: p.beam, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    };
  }
  const eyes = [mats.w.eye, mats.b.eye];

  // geometry shorthands; small boxes stay sharp, bevels only where they read
  const box = (w, h, d, bev = 0) => (bev && Q > 0 && Math.min(w, h, d) >= (Q > 1 ? 0.08 : 0.1) ? new RoundedBoxGeometry(w, h, d, 1, bev) : new THREE.BoxGeometry(w, h, d));
  const cyl = (rt, rb, h, seg = !Q && Math.max(rt, rb) < 0.05 ? 6 : RS, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const oct = (rt, rb, h) => cyl(rt, rb, h, 8);
  const sph = (r, ws = r > 0.09 ? RS : r > 0.04 ? (Q ? 8 : 6) : Q ? 6 : 4, hs = Math.max(3, Math.round(ws * 0.6))) => new THREE.SphereGeometry(r, ws, hs);
  const tor = (R, r, rs = Q ? 6 : 3) => new THREE.TorusGeometry(R, r, rs, Math.max(8, Math.round(TT * Math.min(1, R / 0.2))));
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const O8 = [0, PI / 8, 0];            // octagon with a flat face to the front
  const Z = [0, 0, 0];

  // ---------------------------------------------------------------- details
  const hi = (P, r, pos) => { if (Q) P.body('hi', sph(r, 6, 4), pos); };   // eye highlights, not on low
  /** A glow strip recessed in a dark channel (no channel on low): w x h, facing the local z axis of rot. */
  function strip(P, w, h, pos, rot = Z, mat = 'acc') {
    if (Q) P.body('dark', box(w + 0.024, h + 0.024, 0.02), pos, rot);
    P[mat](box(w, h, 0.026), pos, rot);
  }
  /** Bolt heads at the four corners of a plate face (face -1: the -z side of the plate, +1: the +z side). */
  function bolts(P, w, h, d, pos, rot = Z, face = -1) {
    if (!Q) return;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      P.body('steel', box(0.02, 0.02, 0.012), at(pos, rot, [sx * (w / 2 - 0.022), sy * (h / 2 - 0.022), face * (d / 2 + 0.004)]), rot);
    }
  }
  /** A plate with bolts on its face. */
  function plate(P, col, w, h, d, pos, rot = Z, face = -1, bev = 0.012) {
    P.body(col, box(w, h, d, bev), pos, rot);
    bolts(P, w, h, d, pos, rot, face);
  }
  /** A flexible hose through the points, with a steel collar at each end. */
  function hose(P, pts, r = 0.016) {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    P.body('dark', new THREE.TubeGeometry(c, Q ? 12 : 6, r, Q ? 6 : 4, false));
    if (Q) for (const t of [0, 1]) {
      const p = c.getPointAt(t), d = c.getTangentAt(t);
      const g = cyl(r * 1.5, r * 1.5, 0.025, 6, true);
      g.applyQuaternion(_q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
      P.body('steel', g, [p.x, p.y, p.z]);
    }
  }
  /** A reactor on a back: dark housing, glowing core, steel grille bars across it; faces the local +z of rot. */
  function reactor(P, w, h, pos, rot = Z) {
    plate(P, 'dark', w, h, 0.06, pos, rot, 1, 0.015);
    const cr = Math.min(w, h) * 0.32;
    P.eye(cyl(cr, cr, 0.02), at(pos, rot, [0, 0, 0.032]), [rot[0] + PI / 2, rot[1], rot[2], rot[3]]);
    const n = 3;
    for (let i = 0; i < n; i++) {
      P.body('steel', box(w * 0.78, 0.014, 0.014), at(pos, rot, [0, (i - (n - 1) / 2) * cr * 0.7, 0.048]), rot);
    }
  }
  /** A small glowing status light in a dark socket, facing +z (a rear light). */
  function rearLight(P, pos, r = 0.022) {
    P.body('dark', cyl(r * 1.5, r * 1.5, 0.03, Q ? 10 : 6), pos, [PI / 2, 0, 0]);
    P.eye(cyl(r, r, 0.03, Q ? 10 : 6), [pos[0], pos[1], pos[2] + 0.008], [PI / 2, 0, 0]);
  }
  /** Vent slats: dark louvres stacked on a face that looks along local +z. */
  function vents(P, w, n, pos, rot = Z) {
    for (let i = 0; i < n; i++) P.body('dark', box(w, 0.014, 0.025), at(pos, rot, [0, (i - (n - 1) / 2) * 0.03, 0]), [rot[0] - 0.4, rot[1], rot[2], rot[3]]);
  }
  // the shared plinth: a stepped octagon with a glowing ring in a dark channel, top at y = top
  function plinth(P, r, top = 0.15) {
    const h1 = top * 0.4;
    P.body('plate', oct(r - 0.01, r, h1), [0, h1 / 2, 0], O8);
    P.body('dark', oct(r - 0.022, r - 0.022, 0.045), [0, h1 + 0.018, 0], O8);
    P.acc(oct(r - 0.018, r - 0.018, 0.02), [0, h1 + 0.018, 0], O8);
    P.body('armor', oct(r - 0.05, r - 0.03, top - h1 - 0.034), [0, (top + h1 + 0.034) / 2, 0], O8);
  }
  // a dark visor with two round eyes on its front face; z0 = visor centre, faces -z
  function visor(P, y, z0, w, h, gap, er, d = 0.06) {
    P.body('dark', box(w, h, d, Math.min(h, d) * 0.3), [0, y, z0]);
    const zf = z0 - d / 2;
    for (const s of [-1, 1]) {
      P.eye(cyl(er, er, 0.03), [s * gap, y, zf - 0.006], [PI / 2, 0, 0]);
      hi(P, er * 0.28, [s * gap - er * 0.35, y + er * 0.35, zf - 0.022]);
    }
  }

  // ---------------------------------------------------------------- pieces
  function pawn(pal, M) {
    const P = new Parts(pal);
    // landing pad: glow ring and centre light in dark channels, a beam that fades to the ground
    P.body('plate', oct(0.26, 0.27, 0.05), [0, 0.025, 0], O8);
    P.body('dark', oct(0.245, 0.245, 0.04), [0, 0.065, 0], O8);
    P.eye(oct(0.25, 0.25, 0.018), [0, 0.065, 0], O8);
    P.body('armor', oct(0.2, 0.23, 0.03), [0, 0.095, 0], O8);
    P.body('dark', cyl(0.1, 0.1, 0.024), [0, 0.102, 0]);
    P.eye(cyl(0.05, 0.05, 0.032), [0, 0.108, 0]);
    P.beam(cyl(0.042, 0.056, 0.16, RS, true), [0, 0.204, 0], Z, [1, 1, 1], 0.35);
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2 + PI / 4;
      P.body('steel', box(0.045, 0.02, 0.045), [Math.sin(a) * 0.155, 0.115, Math.cos(a) * 0.155], [0, a, 0]);
    }
    // the drone: body, lens eye, cap, antenna, rear lights
    const D = new Parts(pal);
    D.body('armor', sph(0.18), Z, Z, [1, 0.86, 1]);
    D.body('plate', cyl(0.188, 0.188, 0.05), [0, -0.01, 0]);
    D.body('dark', cyl(0.088, 0.088, 0.05), [0, 0.035, -0.16], [PI / 2, 0, 0]);
    D.eye(cyl(0.066, 0.066, 0.03), [0, 0.035, -0.19], [PI / 2, 0, 0]);
    D.body('dark', cyl(0.024, 0.024, 0.01), [0, 0.035, -0.206], [PI / 2, 0, 0]);
    hi(D, 0.01, [-0.012, 0.047, -0.211]);
    D.body('cap', cyl(0.075, 0.105, 0.05), [0, 0.16, 0]);
    D.body('dark', cyl(0.012, 0.012, 0.36), [0, 0.35, 0]);
    D.eye(sph(0.035), [0, 0.56, 0]);
    strip(D, 0.1, 0.022, [0, 0.07, 0.15], [-0.6, 0, 0], 'eye');
    rearLight(D, [0, 0.0, 0.18], 0.018);
    for (const s of [-1, 1]) D.body('dark', box(0.02, 0.06, 0.07), [s * 0.185, 0.01, 0]);
    // rotor ring with three struts, spins
    const R = new Parts(pal);
    R.body('steel', tor(0.2, 0.018), Z, [PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * PI / 3;
      R.body('dark', box(0.025, 0.018, 0.08), [Math.sin(a) * 0.165, 0, Math.cos(a) * 0.165], [0, a, 0]);
      R.body('plate', box(0.05, 0.04, 0.04), [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2], [0, a, 0]);
    }
    const rotor = anim(grp(R.meshes(M), [0, -0.08, 0]), { kind: 'spin', axis: 'y', speed: 2.2 });
    const drone = anim(grp([...D.meshes(M), rotor], [0, 0.4, 0]), { kind: 'bob', speed: 1.7, amp: 0.025 });
    drone.scale.setScalar(0.85);
    return grp([...P.meshes(M), drone]);
  }

  function rook(pal, M) {
    const P = new Parts(pal);
    plinth(P, 0.34);
    P.body('armor', oct(0.27, 0.3, 0.38), [0, 0.33, 0], O8);
    P.body('plate', oct(0.305, 0.315, 0.08), [0, 0.25, 0], O8);
    plate(P, 'plate', 0.16, 0.16, 0.04, [0, 0.42, -0.255], [-0.08, 0, 0]);
    strip(P, 0.09, 0.022, [0, 0.42, -0.278], [-0.08, 0, 0]);
    for (const a of [PI / 2, 0, -PI / 2]) strip(P, 0.03, 0.11, [Math.sin(a) * 0.272, 0.42, Math.cos(a) * 0.272], [0.08, a, 0, 'YXZ']);
    // turret head: drum, capped teeth, visor, exhaust grille, twin barrels on a mount; sways
    const H = new Parts(pal);
    H.body('plate', oct(0.33, 0.33, 0.06), [0, 0.03, 0], O8);
    H.body('armor', oct(0.32, 0.3, 0.28), [0, 0.16, 0], O8);
    H.body('dark', cyl(0.21, 0.21, 0.04), [0, 0.3, 0]);
    for (let i = 0; i < 8; i++) {
      if (i === 4) continue;   // the front tooth is the gun port
      const a = i * PI / 4, r = 0.265, odd = i % 2;
      H.body(odd ? 'armor' : 'plate', box(0.16, 0.19, 0.1, 0.02), [Math.sin(a) * r, 0.375, Math.cos(a) * r], [0, a, 0]);
      H.body('cap', box(0.15, 0.02, 0.09), [Math.sin(a) * r, 0.477, Math.cos(a) * r], [0, a, 0]);
      if (!odd) strip(H, 0.07, 0.02, [Math.sin(a) * 0.318, 0.4, Math.cos(a) * 0.318], [0, a, 0]);
    }
    H.body('dark', box(0.4, 0.1, 0.06, 0.02), [0, 0.16, -0.29]);
    for (const s of [-1, 1]) {
      H.eye(cyl(0.04, 0.04, 0.03), [s * 0.08, 0.16, -0.326], [PI / 2, 0, 0]);
      hi(H, 0.01, [s * 0.08 - 0.012, 0.172, -0.342]);
    }
    // exhaust grille on the drum back
    H.body('dark', box(0.22, 0.13, 0.04), [0, 0.15, 0.29]);
    H.acc(box(0.17, 0.08, 0.02), [0, 0.15, 0.306]);
    for (let i = 0; i < 3; i++) H.body('steel', box(0.2, 0.014, 0.014), [0, 0.12 + i * 0.03, 0.322]);
    // twin barrels pointing forward and up from a mount in the middle
    plate(H, 'plate', 0.17, 0.1, 0.15, [0, 0.36, 0.02], Z, -1, 0.025);
    H.body('cap', box(0.13, 0.02, 0.11), [0, 0.415, 0.03]);
    const el = -1.1;   // barrel tilt: forward and up, out through the gun port
    for (const s of [-1, 1]) {
      const c0 = [s * 0.045, 0.33, -0.08], L = 0.31;
      const c = [c0[0], c0[1] + Math.cos(el) * L / 2, c0[2] + Math.sin(el) * L / 2];
      H.body('steel', cyl(0.026, 0.03, L, Q ? 10 : 6), c, [el, 0, 0]);
      const tip = [c0[0], c0[1] + Math.cos(el) * L, c0[2] + Math.sin(el) * L];
      H.body('dark', cyl(0.032, 0.032, 0.02, Q ? 10 : 6), tip, [el, 0, 0]);
      const rim = new THREE.TorusGeometry(0.031, 0.006, Q ? 6 : 3, 6, PI);
      rim.rotateZ(PI);   // half rim on the upper side only, so the muzzles never read as eyes
      H.acc(rim, tip, [el - PI / 2, 0, 0]);
    }
    const head = anim(grp(H.meshes(M), [0, 0.52, 0]), { kind: 'sway', axis: 'y', speed: 0.5, amp: 0.45 });
    return grp([...P.meshes(M), head]);
  }

  function knight(pal, M) {
    const P = new Parts(pal);
    plinth(P, 0.33);
    for (const s of [-1, 1]) {
      const x = s * 0.12;
      P.body('plate', box(0.13, 0.07, 0.25, 0.02), [x, 0.18, 0.0]);
      P.body('armor', box(0.09, 0.22, 0.1, 0.02), [x, 0.31, 0.05], [0.15, 0, 0]);
      P.body('dark', sph(0.055), [x, 0.43, 0.06]);
      P.body('armor', box(0.1, 0.17, 0.12, 0.025), [x, 0.52, 0.03], [-0.25, 0, 0]);
      strip(P, 0.02, 0.07, [x, 0.31, -0.007], [0.15, 0, 0]);
    }
    // torso with back vents and a tail light
    P.body('armor', box(0.32, 0.2, 0.34, 0.05), [0, 0.64, 0.06]);
    P.body('plate', box(0.34, 0.06, 0.32, 0.02), [0, 0.59, 0.06]);
    plate(P, 'plate', 0.2, 0.15, 0.06, [0, 0.66, 0.24], Z, 1, 0.02);
    vents(P, 0.15, 3, [0, 0.66, 0.28]);
    strip(P, 0.12, 0.022, [0, 0.715, 0.235], [-0.3, 0, 0]);
    // tail: three stepped armour fins leaning back, glow only on the tips
    for (let i = 0; i < 3; i++) {
      const L = 0.11 - i * 0.02, b = [0, 0.69 + i * 0.045, 0.235 - i * 0.012], t = 0.95 - i * 0.15;
      P.body('armor', box(0.022, L, 0.045), [0, b[1] + Math.cos(t) * L / 2, b[2] + Math.sin(t) * L / 2], [t, 0, 0]);
      P.acc(box(0.026, 0.025, 0.05), [0, b[1] + Math.cos(t) * L, b[2] + Math.sin(t) * L], [t, 0, 0]);
    }
    // the S neck: leans back from the torso, then bends forward to the head
    P.body('armor', box(0.15, 0.2, 0.15, 0.04), [0, 0.77, -0.04], [0.22, 0, 0]);
    P.body('armor', box(0.14, 0.2, 0.14, 0.04), [0, 0.9, -0.07], [-0.55, 0, 0]);
    P.body('dark', box(0.1, 0.24, 0.1), [0, 0.83, -0.03], [-0.15, 0, 0]);
    // glowing mane crest down the back of the neck
    const mane = [[0.985, 0.03, -0.9], [0.93, 0.07, -0.55], [0.865, 0.085, -0.15], [0.795, 0.085, 0.25], [0.725, 0.08, 0.6]];
    mane.forEach(([y, z, r], i) => {
      const h = 0.11 - i * 0.008;
      const sx = i % 2 ? 1 : -1;
      P.body('dark', box(0.05, h * 0.6, 0.05), [0, y, z - 0.01], [r, 0, 0]);
      P.acc(box(0.045, h, 0.06), [sx * 0.02, y + 0.02, z + 0.03], [r + 0.5, 0, sx * -0.2]);
    });
    // hose loops from the neck to the torso
    for (const s of [-1, 1]) hose(P, [[s * 0.07, 0.86, -0.08], [s * 0.13, 0.8, -0.12], [s * 0.16, 0.68, -0.07]]);
    // head: skull, long snout, pointed ears, side eyes, rear light; looks around a little
    const H = new Parts(pal);
    H.body('armor', box(0.2, 0.18, 0.24, 0.05), [0, 0.05, -0.02]);
    H.body('armor', box(0.15, 0.12, 0.22, 0.04), [0, 0.0, -0.2]);
    H.body('plate', box(0.16, 0.05, 0.22, 0.02), [0, -0.045, -0.18]);
    H.body('dark', box(0.11, 0.03, 0.02), [0, 0.0, -0.312]);
    for (const s of [-1, 1]) {
      H.acc(cyl(0.012, 0.012, 0.02), [s * 0.035, 0.03, -0.312], [PI / 2, 0, 0]);
      H.body('armor', new THREE.ConeGeometry(0.03, 0.25, 4), [s * 0.085, 0.235, 0.04], [0.15, PI / 4, s * -0.3, 'ZXY']);
      H.body('dark', cyl(0.055, 0.055, 0.04), [s * 0.095, 0.07, -0.06], [0, 0, PI / 2]);
      H.eye(cyl(0.042, 0.042, 0.03), [s * 0.115, 0.07, -0.06], [0, 0, PI / 2]);
      hi(H, 0.011, [s * 0.132, 0.084, -0.075]);
    }
    H.body('cap', box(0.08, 0.03, 0.22, 0.012), [0, 0.15, -0.06]);
    rearLight(H, [0, 0.06, 0.1], 0.02);
    const head = anim(grp(H.meshes(M), [0, 0.84, -0.06]), { kind: 'sway', axis: 'y', speed: 0.7, amp: 0.2 });
    head.rotation.x = -0.2;   // snout down, like a horse
    return grp([...P.meshes(M), head]);
  }

  // the bishop's mitre: a faceted lathe with a dark wedge cut across it that notches the outline on one side
  const MITRE = [[0.12, 0.9], [0.14, 0.98], [0.135, 1.07], [0.1, 1.17], [0.05, 1.25], [0.0, 1.3]];
  const CUT = { yc: 1.19, k: 0.75, w: 0.075, d: 0.14 };   // the cut plane y = yc - k x, half width w, depth d at the outer side
  function mitre(pal, seg, step) {
    const pts = [[0, 0.9], MITRE[0]];
    for (let i = 1; i < MITRE.length; i++) {
      const [r0, y0] = MITRE[i - 1], [r1, y1] = MITRE[i], n = Math.max(1, Math.ceil(Math.hypot(r1 - r0, y1 - y0) / step));
      for (let k = 1; k <= n; k++) pts.push([r0 + (r1 - r0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    const g = lathe(pts, seg).toNonIndexed(), p = g.getAttribute('position'), n = p.count;
    const ca = new THREE.Color(pal.armor), cd = new THREE.Color(pal.dark), cc = new THREE.Color(), col = new Float32Array(n * 3);
    // per triangle: the deepest corner colours the whole face, so the cut reads as a dark wedge
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r < 1e-6) continue;
      const side = Math.min(1, Math.max(0, (x / r + 0.2) / 0.5));
      const t = Math.max(0, 1 - Math.abs(y - (CUT.yc - CUT.k * x)) / CUT.w) * side;
      f[i] = t;
      const nr = Math.max(r * 0.25, r - CUT.d * t) / r;
      p.setX(i, x * nr); p.setZ(i, z * nr);
    }
    for (let i = 0; i < n; i += 3) {
      const t = Math.max(f[i], f[i + 1], f[i + 2]);
      cc.copy(ca).lerp(cd, Math.min(1, t * 2.2));
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = cc.r; col[(i + k) * 3 + 1] = cc.g; col[(i + k) * 3 + 2] = cc.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  function bishop(pal, M) {
    const P = new Parts(pal);
    plinth(P, 0.32);
    P.body('armor', lathe([[0, 0.14], [0.25, 0.14], [0.2, 0.32], [0.15, 0.48], [0, 0.48]], 8), Z, O8);
    P.body('dark', oct(0.172, 0.172, 0.06), [0, 0.49, 0], O8);
    P.acc(oct(0.178, 0.178, 0.022), [0, 0.49, 0], O8);
    P.body('armor', lathe([[0, 0.5], [0.15, 0.5], [0.2, 0.66], [0.15, 0.74], [0, 0.74]], 8), Z, O8);
    plate(P, 'plate', 0.14, 0.12, 0.04, [0, 0.62, -0.165], [-0.3, 0, 0]);
    P.body('dark', cyl(0.045, 0.045, 0.02, 6), [0, 0.62, -0.19], [PI / 2 - 0.3, 0, 0]);
    P.acc(cyl(0.032, 0.032, 0.026, 6), [0, 0.62, -0.19], [PI / 2 - 0.3, 0, 0]);
    reactor(P, 0.15, 0.13, [0, 0.61, 0.175], [0.3, 0, 0]);
    for (const s of [-1, 1]) {
      P.body('plate', sph(0.075), [s * 0.2, 0.68, 0], Z, [1, 0.8, 1.1]);
      if (Q) P.body('cap', sph(0.05), [s * 0.2, 0.715, 0], Z, [1, 0.5, 1.1]);
      P.body('armor', box(0.08, 0.2, 0.09, 0.025), [s * 0.21, 0.56, 0], [0, 0, s * 0.1]);
      P.body('dark', sph(0.045), [s * 0.22, 0.44, 0]);
    }
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2 + PI / 4;
      strip(P, 0.026, 0.13, [Math.sin(a) * 0.212, 0.26, Math.cos(a) * 0.212], [0.26, a, 0, 'YXZ']);
    }
    P.body('dark', cyl(0.07, 0.08, 0.08), [0, 0.76, 0]);
    P.body('armor', sph(0.13), [0, 0.86, 0], Z, [1, 0.95, 1]);
    visor(P, 0.86, -0.1, 0.21, 0.08, 0.05, 0.03, 0.05);
    rearLight(P, [0, 0.87, 0.12], 0.022);
    // the mitre, its glowing wedge core, a cap band and a glowing tip
    P.body('armor', mitre(pal, Q ? 10 : 8, Q ? 0.02 : 0.05));
    const ex = 0.035;
    P.eye(cyl(0.075, 0.075, 0.016, RS), [ex, CUT.yc - CUT.k * ex, 0], [0, 0, -Math.atan(CUT.k)]);
    P.body('cap', cyl(0.146, 0.146, 0.04, Q ? 12 : 8), [0, 0.93, 0]);
    P.body('dark', cyl(0.035, 0.035, 0.03), [0, 1.29, 0]);
    P.eye(sph(0.035), [0, 1.315, 0]);
    return grp(P.meshes(M));
  }

  function queen(pal, M) {
    const P = new Parts(pal);
    plinth(P, 0.32);
    P.body('armor', lathe([[0, 0.14], [0.27, 0.14], [0.22, 0.34], [0.13, 0.62], [0, 0.62]], 8), Z, O8);
    for (let i = 0; i < 8; i += Q ? 1 : 2) {
      const a = i * PI / 4;
      P.body('plate', box(0.07, 0.22, 0.03), [Math.sin(a) * 0.238, 0.26, Math.cos(a) * 0.238], [-0.24, a, 0, 'YXZ']);
    }
    P.body('dark', cyl(0.11, 0.12, 0.08), [0, 0.64, 0]);
    P.body('armor', lathe([[0, 0.66], [0.12, 0.66], [0.17, 0.82], [0.11, 0.92], [0, 0.92]], 8), Z, O8);
    plate(P, 'plate', 0.11, 0.1, 0.03, [0, 0.8, -0.148], [-0.35, 0, 0]);
    P.body('dark', cyl(0.035, 0.035, 0.02, 4), [0, 0.8, -0.168], [PI / 2 - 0.35, 0, 0]);
    P.acc(cyl(0.025, 0.025, 0.026, 4), [0, 0.8, -0.168], [PI / 2 - 0.35, 0, 0]);
    reactor(P, 0.12, 0.11, [0, 0.79, 0.15], [0.35, 0, 0]);
    for (const s of [-1, 1]) {
      P.body('plate', sph(0.06), [s * 0.17, 0.86, 0], Z, [1, 0.8, 1]);
      P.body('cap', sph(0.04), [s * 0.17, 0.89, 0], Z, [1, 0.5, 1]);
      P.body('armor', box(0.06, 0.18, 0.07, 0.02), [s * 0.18, 0.74, 0], [0, 0, s * 0.12]);
    }
    P.body('dark', cyl(0.055, 0.065, 0.1), [0, 0.95, 0]);
    P.body('armor', sph(0.115), [0, 1.07, 0]);
    visor(P, 1.07, -0.09, 0.19, 0.072, 0.045, 0.028, 0.05);
    rearLight(P, [0, 1.08, 0.105], 0.02);
    // crown: a capped band over a glow ring, five friendly fins in a fan with ball tips and glowing cores
    P.body('dark', cyl(0.122, 0.122, 0.04, Q ? 12 : 8), [0, 1.13, 0]);
    P.acc(cyl(0.126, 0.126, 0.016, Q ? 12 : 8), [0, 1.13, 0]);
    P.body('cap', cyl(0.13, 0.12, 0.05, Q ? 12 : 8), [0, 1.17, 0]);
    const fins = [[0, 0.37], [0.42, 0.27], [-0.42, 0.27], [0.84, 0.17], [-0.84, 0.17]];
    for (const [a, h] of fins) {
      const dx = -Math.sin(a), dy = Math.cos(a), bx = dx * 0.04, by = 1.18;
      const c = [bx + dx * h / 2, by + dy * h / 2, 0];
      P.body('steel', cyl(0.032, 0.068, h, 4), c, [0, 0, a], [1, 1, 0.55]);
      P.acc(sph(0.034), [bx + dx * (h + 0.02), by + dy * (h + 0.02), 0]);
    }
    // a glowing ring with three nodes spins round the gown
    const R = new Parts(pal);
    R.acc(tor(0.21, 0.014), Z, [PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3; R.body('steel', sph(0.03), [Math.sin(a) * 0.21, 0, Math.cos(a) * 0.21]); }
    const ring = anim(grp(R.meshes(M), [0, 0.42, 0]), { kind: 'spin', axis: 'y', speed: 0.8 });
    return grp([...P.meshes(M), ring]);
  }

  function king(pal, M) {
    const P = new Parts(pal);
    plinth(P, 0.34);
    for (const s of [-1, 1]) {
      P.body('armor', box(0.14, 0.3, 0.18, 0.03), [s * 0.12, 0.3, 0]);
      plate(P, 'plate', 0.1, 0.12, 0.04, [s * 0.12, 0.33, -0.095]);
      strip(P, 0.05, 0.02, [s * 0.12, 0.235, -0.095]);
    }
    P.body('dark', box(0.34, 0.1, 0.22), [0, 0.48, 0]);
    P.body('armor', box(0.42, 0.34, 0.3, 0.06), [0, 0.7, 0]);
    plate(P, 'plate', 0.3, 0.2, 0.04, [0, 0.72, -0.15]);
    P.body('dark', cyl(0.075, 0.075, 0.03), [0, 0.72, -0.17], [PI / 2, 0, 0]);
    P.acc(cyl(0.055, 0.055, 0.035), [0, 0.72, -0.172], [PI / 2, 0, 0]);
    // backpack reactor behind a grille, hoses to the shoulders
    reactor(P, 0.26, 0.24, [0, 0.71, 0.18]);
    for (const s of [-1, 1]) {
      plate(P, 'plate', 0.16, 0.13, 0.24, [s * 0.27, 0.85, 0], Z, -1, 0.04);
      P.body('cap', box(0.14, 0.02, 0.22), [s * 0.27, 0.92, 0]);
      strip(P, 0.18, 0.026, [s * 0.352, 0.86, 0], [0, PI / 2, 0]);
      P.body('armor', box(0.1, 0.2, 0.12, 0.03), [s * 0.27, 0.69, 0]);
      P.body('dark', box(0.11, 0.1, 0.11), [s * 0.27, 0.56, 0]);
      hose(P, [[s * 0.25, 0.85, 0.12], [s * 0.2, 0.8, 0.24], [s * 0.13, 0.76, 0.215]], 0.018);
    }
    P.body('dark', cyl(0.07, 0.08, 0.07), [0, 0.89, 0]);
    P.body('armor', box(0.24, 0.19, 0.21, 0.05), [0, 1.01, 0]);
    visor(P, 1.01, -0.1, 0.23, 0.09, 0.055, 0.033, 0.05);
    rearLight(P, [0, 1.02, 0.11], 0.024);
    // crown band with big points, a short mast, the glowing cross
    P.body('dark', box(0.25, 0.03, 0.22), [0, 1.09, 0]);
    P.acc(box(0.256, 0.014, 0.226), [0, 1.09, 0]);
    P.body('cap', box(0.27, 0.06, 0.24, 0.015), [0, 1.13, 0]);
    for (const [x, z] of [[-0.105, -0.09], [0.105, -0.09], [-0.105, 0.09], [0.105, 0.09]]) {
      P.body('steel', new THREE.ConeGeometry(0.045, 0.15, 4), [x, 1.235, z], [0, PI / 4, 0]);
      P.acc(sph(0.018), [x, 1.315, z]);
    }
    P.body('steel', cyl(0.05, 0.075, 0.1), [0, 1.2, 0]);
    P.body('dark', cyl(0.032, 0.032, 0.28), [0, 1.36, 0]);
    P.cross(box(0.12, 0.37, 0.13), [0, 1.665, 0]);
    P.cross(box(0.37, 0.12, 0.12), [0, 1.71, 0]);
    // a radar ring spins round the mast
    const R = new Parts(pal);
    R.acc(tor(0.08, 0.011), Z, [PI / 2, 0, 0]);
    for (let i = 0; i < 2; i++) { const a = i * PI; R.body('steel', box(0.035, 0.035, 0.035), [Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08]); }
    const ring = anim(grp(R.meshes(M), [0, 1.38, 0]), { kind: 'spin', axis: 'y', speed: 1.2 });
    return grp([...P.meshes(M), ring]);
  }

  const B = { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king };
  return createSetStyle({
    id: 'mech',
    build: (type, color) => B[type](PAL[color], mats[color]),
    materials: [...Object.values(mats.w), ...Object.values(mats.b)],
    textures: [tex],
    tick: (t) => { const v = 1.15 + Math.sin(t * 2.4) * 0.3; for (const e of eyes) e.emissiveIntensity = v; },
  });
}
