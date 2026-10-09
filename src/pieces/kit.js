// Shared kit of the preview piece sets (CHE-367, ?pieces=fantasy|animals): parts are placed with plain transforms and merged per
// material, so every piece is at most three meshes (body, accent, dark) like the Staunton set. Front is -z, up is +y, unit scale.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };
export const V2 = (x, y) => new THREE.Vector2(x, y);
export const TAU = Math.PI * 2;

// The ranking of today's pieces (test/geometry.mjs): each set keeps these heights within 8 %.
export const HEIGHT = { p: 0.90, r: 1.00, n: 1.20, b: 1.35, q: 1.60, k: 1.85 };

let dark = null;
/** The one extra material of the sets: glossy near black for eyes, pupils and nostrils. pieceset.js themes it like the knight inlay. */
export function darkMaterial() {
  if (!dark) dark = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
  return dark;
}

/** Catmull-Rom through [r, y] knots, resampled evenly: a smooth lathe profile. The ends are pulled onto the axis when they start at r 0. */
export function profile(knots, count = 48) {
  const curve = new THREE.SplineCurve(knots.map(([r, y]) => V2(r, y)));
  const pts = curve.getSpacedPoints(count - 1).map((p) => V2(Math.max(0, p.x), p.y));
  if (knots[0][0] === 0) pts[0].x = 0;
  if (knots[knots.length - 1][0] === 0) pts[pts.length - 1].x = 0;
  return pts;
}
export const lathe = (knots, { count = 48, segments = 48, phiStart = 0, phiLength = TAU } = {}) => new THREE.LatheGeometry(profile(knots, count), segments, phiStart, phiLength);

/**
 * A part list builder. add(geo, slot, { p, r, s }) places a geometry (position [x,y,z], rotation [x,y,z] Euler XYZ, scale number or
 * [x,y,z]) into slot 'body' | 'accent' | 'dark'; mirror(fn) runs fn twice with sx = 1 and -1 for left and right parts.
 * build(mat, name) merges each slot into one mesh: at most three meshes, shadows on.
 */
export function parts() {
  const slots = { body: [], accent: [], dark: [] };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
  const api = {
    add(geo, slot = 'body', { p = [0, 0, 0], r = [0, 0, 0], s = 1, m = null } = {}) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (m) g.applyMatrix4(m);
      else {
        e.set(r[0], r[1], r[2]); q.setFromEuler(e);
        sv.set(...(Array.isArray(s) ? s : [s, s, s]));
        m4.compose(pv.set(...p), q, sv);
        g.applyMatrix4(m4);
        if (sv.x * sv.y * sv.z < 0) flipWinding(g);
      }
      g.morphAttributes = {};
      slots[slot].push(g);
      if (g !== geo) geo.dispose();
      return api;
    },
    /** fn(sx) is called with 1 (right, +x) and -1 (left); geometry added with p[0] * sx and a mirrored scale stays correct. */
    mirror(fn) { fn(1); fn(-1); return api; },
    build(mat, name) {
      const g = new THREE.Group();
      g.name = name;
      for (const [slot, list] of Object.entries(slots)) {
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        for (const x of list) x.dispose();
        merged.computeBoundingBox(); merged.computeBoundingSphere();
        const material = slot === 'dark' ? darkMaterial() : mat[slot];
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.name = `${name}-${slot}`;
        g.add(mesh);
      }
      return g;
    },
  };
  return api;
}

function flipWinding(g) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (const a of [pos, nor, uv]) {
    if (!a) continue;
    const s = a.itemSize, arr = a.array;
    for (let i = 0; i < arr.length; i += 3 * s) for (let k = 0; k < s; k++) { const t = arr[i + s + k]; arr[i + s + k] = arr[i + 2 * s + k]; arr[i + 2 * s + k] = t; }
  }
}

/** A smooth blob: a sphere scaled to [sx, sy, sz]. */
export const blob = (r = 1, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);

/** A tube along a CatmullRom curve through points [[x,y,z], ...] with radius r (a number, or fn(t) for a taper). */
export function tube(points, r = 0.02, { segments = 32, radial = 10, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  if (typeof r === 'number') return new THREE.TubeGeometry(curve, segments, r, radial, closed);
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, closed);
  // taper: scale each ring around its centre point
  const pos = g.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const rr = r(i / segments);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(rr).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** A flat outline shape extruded with a soft bevel: points [[x,y], ...] in the XY plane, depth along z (centred). */
export function slab(points, depth = 0.04, { bevel = 0.012, steps = 1, curveSegments = 12 } = {}) {
  const sh = new THREE.Shape(points.map(([x, y]) => V2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * The common foot of a set: a round moulded plinth in the body material with an accent ring, about 0.16 high.
 * Returns the top y (where the figure stands). R is the outer radius (0.30 to 0.36; footprint 0.5 to 0.85 in the tests).
 */
export function foot(P, R = 0.32, { style = 'round', segments = 64 } = {}) {
  if (style === 'round') {
    P.add(lathe([[0, 0], [R * 0.9, 0], [R, 0.02], [R, 0.05], [R * 0.93, 0.07], [R * 0.86, 0.1], [R * 0.84, 0.13], [R * 0.8, 0.15], [R * 0.7, 0.16], [0, 0.16]], { segments }), 'body');
    P.add(new THREE.TorusGeometry(R * 0.885, 0.014, 10, segments), 'accent', { p: [0, 0.085, 0], r: [Math.PI / 2, 0, 0] });
    return 0.16;
  }
  // 'grass': a low round mound with a rim, for the animals
  P.add(lathe([[0, 0], [R * 0.92, 0], [R, 0.018], [R, 0.06], [R * 0.95, 0.085], [R * 0.82, 0.11], [R * 0.5, 0.125], [0, 0.13]], { segments }), 'body');
  P.add(new THREE.TorusGeometry(R * 0.97, 0.013, 10, segments), 'accent', { p: [0, 0.04, 0], r: [Math.PI / 2, 0, 0] });
  return 0.125;
}
