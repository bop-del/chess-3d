// Tokens view: every piece becomes a thick round turned disc with a Staunton silhouette carved into the top face.
// White discs take the theme's white piece material (ivory in Classic, pale wood in Wood and so on) with a thin ebony
// hairline edge and a glossy ebony symbol. Black discs are true ebony black in every theme (own material, matte, so the
// flat top does not mirror the sky) with a gold symbol. The symbol is a real hole in the disc with a small sloped chamfer
// at its mouth (a thin band that catches the light), the symbol filled below the face. The discs are real meshes in real
// light, so they cast soft shadows. Each disc is parented to the piece's own group, so it follows every slide, hop,
// capture flight and tray landing. While tokens are on, the 3D piece body is hidden (and its shadow); the invisible pick
// cylinder stays, so picking works as before.
// Silhouettes are drawn in code as outlines in a 100 x 100 box (SVG path syntax, y down, base at y 88), solid and in one
// piece, with a few engraved lines (cuts) painted over the symbol.
import * as THREE from 'three';

const RADIUS = 0.435;           // disc radius in squares, rim included
const THICK = 0.17;             // disc height
const BEVEL = 0.022;            // rounded rim, in size and height: small, so the ebony edge stays a hairline
const FACE_R = 0.412;           // the face runs out to the rim bevel
const SIL = 0.76;               // silhouette box in squares
const CARVE = 0.03;             // how far the symbol sits below the top face
const CHAMFER_W = 0.014;        // width of the sloped mouth of the carving

// ---- silhouettes -------------------------------------------------------------------------------------------------------
// Symmetric pieces give the right half only, from the top on the axis (x 50) down to the base on the axis; mirror() adds the
// left half. Absolute commands M L C only.
const HALF = {
  p: 'M50 13 C58 13 63 18 63 25 C63 31 59.5 35 55.5 37 L55.5 38 C59 39 61 41 61 43.5 C61 46 59 47.5 56 48 C57 56 61 64 67 71 L67 74 C72 75 75 78 75 82 L75 88 L50 88',
  r: 'M50 14 L55.5 14 L55.5 22 L62 22 L62 14 L69.5 14 L69.5 31 L65.5 35 L64 67 L69 71 L69 75 C73 76 75 78 75 81 L75 88 L50 88',
  b: 'M50 7 C53.5 7 55.5 9 55.5 11.5 C55.5 13.5 54 15 52.5 15.5 C61 21 67 30 65 39 C64 44 60.5 47 57.5 48.5 L61 49.5 C63 50.5 63 53.5 60 54.5 L57.5 55 C57 63 59 71 66 76 L66 79 C72 80 74 83 74 85 L74 88 L50 88',
  q: 'M50 8 C53.5 8 55.5 10 55.5 12.5 C55.5 14.5 54 16 52.5 16.5 L55.5 35 L60.5 23 C58.5 21.5 58.5 17.5 62 17 C65.5 16.5 67 20.5 65.5 23 L69 36 L73 26 C71 24.5 71.5 20.5 75 20 C78.5 19.5 80 23.5 78 26 L71.5 54 C65 58 62 60 62 63 C62 70 66 73 69 76 L69 79 C73 80 75 82 75 85 L75 88 L50 88',
  k: 'M50 7 L53.5 7 L53.5 12 L58.5 12 L58.5 17 L53.5 17 L53.5 21 C61 21.5 67 25 68.5 32 C69.5 37 66 41 61 42.5 L61 44 C66 44.5 70 46 70 49 C70 52 67 54 62 54.5 C63 62 66 69 69 74 L69 77 C73 78 75 81 75 84 L75 88 L50 88',
};
// the knight is a single outline, drawn facing left and up the board, with a sawtooth mane
const KNIGHT = 'M26 88 L26 83 C26 79 29 77 33 76 C33 68 36 60 42 53 C38 54.5 34 56 30 55 C24 54 17 50.5 14 46 C12 43 13.5 40 16 38 L24 31 L27 24 C29 20 31.5 17 34 15 L33 7.5 L40 12 C42 10 45 9 48 8.5 C52 8 56 9 60 11 L66 14 L65 19 L72 22 L71 28 L77 34 L76 40 L81 46 C82 60 80 70 78 76 C81 77 82 79.5 82 83 L82 88 Z';

// engraved details painted in the body material over the gold: [x1, y1, x2, y2, width]
const CUTS = {
  p: [[51 - 12, 60, 51 + 12, 60, 2.6]],
  r: [[36, 30, 64, 30, 2.4], [37, 62, 63, 62, 2.4]],
  b: [[52, 24, 60, 36, 2.6], [40, 55, 60, 55, 2.4]],
  q: [[36, 52, 64, 52, 2.4], [38, 62, 62, 62, 2.4]],
  k: [[36, 52, 64, 52, 2.4], [38, 62, 62, 62, 2.4]],
  n: [],
};
const KNIGHT_DOTS = [[29, 33, 2.6], [18.5, 44.5, 1.6]];   // eye and nostril: [x, y, radius]

function parse(d) {
  const t = d.match(/[MLCZ]|-?\d+(\.\d+)?/g);
  let i = 0, start = null;
  const segs = [];
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    const c = t[i++];
    if (c === 'M') start = [num(), num()];
    else if (c === 'L') segs.push({ t: 'L', c: [], p: [num(), num()] });
    else if (c === 'C') { const a = [num(), num()], b = [num(), num()]; segs.push({ t: 'C', c: [a, b], p: [num(), num()] }); }
  }
  return { start, segs };                       // Z is implied: every outline is closed by the caller
}

function mirrored({ start, segs }) {
  const mx = (p) => [100 - p[0], p[1]];
  const ends = [start, ...segs.map((s) => s.p)];
  const out = [];
  for (let k = segs.length - 1; k >= 0; k--) {
    const s = segs[k];
    out.push({ t: s.t, c: s.c.slice().reverse().map(mx), p: mx(ends[k]) });
  }
  return { start: mx(ends[ends.length - 1]), segs: out };
}

const X = (p) => (p[0] - 50) / 100 * SIL;
const Y = (p) => -(p[1] - 50) / 100 * SIL;
function pathOf(path, shape = new THREE.Shape()) {
  shape.moveTo(X(path.start), Y(path.start));
  for (const s of path.segs) {
    if (s.t === 'L') shape.lineTo(X(s.p), Y(s.p));
    else shape.bezierCurveTo(X(s.c[0]), Y(s.c[0]), X(s.c[1]), Y(s.c[1]), X(s.p), Y(s.p));
  }
  shape.closePath();
  return shape;
}
function silhouette(type) {
  if (type === 'n') return pathOf(parse(KNIGHT));
  const right = parse(HALF[type]), left = mirrored(right);
  const full = { start: right.start, segs: [...right.segs, ...left.segs] };
  return pathOf(full);
}
function circlePath(r, hole = false) {
  const p = hole ? new THREE.Path() : new THREE.Shape();
  p.absarc(0, 0, r, 0, Math.PI * 2, hole);
  return p;
}
function strokeShape([x1, y1, x2, y2, w]) {
  const a = [x1, y1], b = [x2, y2];
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2;
  const s = new THREE.Shape();
  const P = (px, py) => [X([px, py]), Y([px, py])];
  const q = [P(a[0] + nx, a[1] + ny), P(b[0] + nx, b[1] + ny), P(b[0] - nx, b[1] - ny), P(a[0] - nx, a[1] - ny)];
  s.moveTo(...q[0]); for (let i = 1; i < 4; i++) s.lineTo(...q[i]); s.closePath();
  return s;
}

// Flat in the xz plane, extruded along +y, top of the silhouette towards -z.
function extruded(shapes, depth, bevel) {
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth, curveSegments: 14,
    bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Offsets a closed outline outwards by d (any winding; the end point may repeat the start).
function offsetOutline(pts, d) {
  const p = pts.slice();
  if (p.length > 1 && p[0].distanceTo(p[p.length - 1]) < 1e-6) p.pop();
  let area = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; area += a.x * b.y - b.x * a.y; }
  const sgn = area < 0 ? 1 : -1;                                  // clockwise: the outward normal of an edge (dx, dy) is (-dy, dx)
  const n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n], c = p[i], b = p[(i + 1) % n];
    const e1 = new THREE.Vector2().subVectors(c, a), e2 = new THREE.Vector2().subVectors(b, c);
    if (e1.lengthSq() < 1e-12 || e2.lengthSq() < 1e-12) { out.push(c.clone()); continue; }
    e1.normalize(); e2.normalize();
    const n1 = new THREE.Vector2(-e1.y * sgn, e1.x * sgn), n2 = new THREE.Vector2(-e2.y * sgn, e2.x * sgn);
    const m = n1.clone().add(n2);
    if (m.lengthSq() < 1e-9) { out.push(c.clone()); continue; }
    m.normalize();
    out.push(c.clone().addScaledVector(m, d / Math.max(0.45, m.dot(n1))));
  }
  return { pts: p, out };
}

// geometry per type, built on first use and shared by every token of the type
function makeGeometry(type) {
  const sil = silhouette(type);
  const sp = sil.getPoints(24);
  const { pts, out } = offsetOutline(sp, CHAMFER_W);
  // the chamfer: a sloped band from the offset outline on the top face down to the symbol outline
  const pos = [], idx = [];
  pts.forEach((q, i) => { pos.push(out[i].x, THICK, -out[i].y, q.x, THICK - CARVE, -q.y); });
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length, a = i * 2, b = j * 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  band.setIndex(idx);
  band.computeVertexNormals();
  // the rim is bevelled; the inner disc is not (a bevel would close the thin parts of the silhouette hole)
  const rim = circlePath(RADIUS - BEVEL); rim.holes.push(circlePath(FACE_R, true));
  const innerShape = circlePath(FACE_R); innerShape.holes.push(new THREE.Path(out.slice().reverse()));
  const rimGeo = extruded([rim], THICK - 2 * BEVEL, BEVEL);
  rimGeo.translate(0, BEVEL, 0);
  const inner = extruded([innerShape], THICK, 0);
  const IB = 0.006;                                               // the inlay is gently domed, so it catches the light
  const inlay = extruded([sil], THICK - CARVE - 0.02 - IB, IB);
  inlay.translate(0, 0.02 + IB, 0);
  const shapes = (CUTS[type] || []).map(strokeShape);
  if (type === 'n') for (const [x, y, r] of KNIGHT_DOTS) { const e = new THREE.Shape(); e.absarc(X([x, y]), Y([x, y]), r / 100 * SIL, 0, Math.PI * 2, false); shapes.push(e); }
  const engraved = shapes.length ? extruded(shapes, 0.004, 0) : null;
  if (engraved) engraved.translate(0, THICK - CARVE + 0.004, 0);
  return { rim: rimGeo, inner, inlay, engraved, band };
}

// createTokens({ gimbal, game, materials, stage? }) -> { setVisible(on), sync(), dispose(), visible }
//   stage is optional: with it, sync() turns every silhouette so it reads upright on screen whatever the camera yaw.
//   sync() is cheap and safe to call every frame; pieces made after setVisible get their token at once (root.add is wrapped).
export function createTokens({ gimbal, game, materials, stage = null }) {
  const root = game.root;
  const geos = {};
  // The inks are the tokens' own, whatever the theme: the theme's accent materials are wood or bronze in some themes and
  // would not read against the disc.
  const gold = new THREE.MeshPhysicalMaterial({ name: 'token-gold', color: '#c98b14', roughness: 0.14, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.06, envMapIntensity: 1.8 });
  const goldLine = new THREE.MeshPhysicalMaterial({ name: 'token-gold-line', color: '#dc9f1c', roughness: 0.16, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.06, envMapIntensity: 1.7 });
  const ebony = new THREE.MeshPhysicalMaterial({ name: 'token-ebony-inlay', color: '#15110e', roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 });
  const black = new THREE.MeshPhysicalMaterial({ name: 'token-ebony-black', color: '#020203', roughness: 0.5, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.2, envMapIntensity: 0.1, specularIntensity: 0.35 });
  const bevelMat = {                                               // the chamfered mouth of the carving, lit like polished stone
    w: new THREE.MeshPhysicalMaterial({ name: 'token-bevel-white', color: '#fbf3df', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
    b: new THREE.MeshPhysicalMaterial({ name: 'token-bevel-black', color: '#2a2a30', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide, envMapIntensity: 1.6 }),
  };
  const geo = (type) => geos[type] || (geos[type] = makeGeometry(type));
  let on = false;
  let yaw = 0;
  const tops = new Set();
  const noRay = () => {};

  function attach(group) {
    const info = group.userData.piece;
    if (!info || group.userData.token) return;
    const g = geo(info.type);
    const w = info.color === 'w';
    const token = new THREE.Group();
    token.name = 'token';
    token.rotation.y = yaw;
    const meshes = [
      new THREE.Mesh(g.rim, w ? ebony : black),
      new THREE.Mesh(g.inner, w ? materials.white.body : black),
      new THREE.Mesh(g.inlay, w ? ebony : gold),
      new THREE.Mesh(g.band, bevelMat[info.color]),
    ];
    if (g.engraved) meshes.push(new THREE.Mesh(g.engraved, w ? goldLine : black));
    for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; m.raycast = noRay; token.add(m); }
    token.visible = on;
    group.add(token);
    group.userData.token = token;
    tops.add(token);
  }
  function body(group, show) {                   // the 3D piece: everything but the pick cylinder and the token
    for (const ch of group.children) if (!ch.userData.hit && ch.name !== 'token') ch.visible = show;
  }
  function apply(group) {
    attach(group);
    const t = group.userData.token;
    if (!t) return;
    t.visible = on;
    body(group, !on);
  }
  const eachPiece = (fn) => { for (const ch of root.children) if (ch.userData?.piece) fn(ch); };

  // pieces are created in the middle of an animation (promotion): catch them the moment they join the pieces group
  const origAdd = root.add;
  root.add = function (...objs) {
    const r = origAdd.apply(this, objs);
    for (const o of objs) if (o?.userData?.piece) apply(o);
    return r;
  };

  const upLocal = new THREE.Vector3(), q = new THREE.Quaternion();
  function orient() {
    if (!stage) return;
    upLocal.set(0, 1, 0).applyQuaternion(stage.camera.quaternion).applyQuaternion(q.copy(gimbal.quaternion).invert());
    if (upLocal.x * upLocal.x + upLocal.z * upLocal.z < 1e-4) return;
    const a = Math.atan2(-upLocal.x, -upLocal.z);
    if (Math.abs(a - yaw) < 1e-3) return;
    yaw = a;
    for (const t of tops) { if (!t.parent) tops.delete(t); else t.rotation.y = yaw; }
  }

  // The hint arrow and its squares lie flat at the board plane, under the 0.17 high discs: while tokens are on they are
  // drawn without the depth test (their render order is already above the discs), so the arrow runs over the pieces.
  // Hint groups are direct children of the gimbal and can be made after setVisible (the start sequence turns a stored
  // Tokens view on before Explain, Drill and Good move exist), so sync() repeats this every frame: a short walk over
  // the gimbal's children that only touches a material when it is wrong.
  function hintOnTop(v) {
    for (const o of gimbal.children) if (o.name === 'move-hint') o.traverse((m) => { if (m.isMesh && m.material.depthTest === v) { m.material.depthTest = !v; m.material.needsUpdate = true; } });
  }
  const api = {
    setVisible(v) {
      on = !!v;
      hintOnTop(on);
      eachPiece(apply);
      if (on) orient();
    },
    sync() {
      if (on) hintOnTop(true);
      eachPiece(apply);
      if (on) orient();
    },
    get visible() { return on; },
    dispose() {
      delete root.add;
      hintOnTop(false);
      eachPiece((g) => { g.userData.token?.removeFromParent(); g.userData.token = null; body(g, true); });
      tops.clear();
      for (const m of [gold, goldLine, ebony, black, bevelMat.w, bevelMat.b]) m.dispose();
      for (const t of Object.values(geos)) { t.rim.dispose(); t.inner.dispose(); t.inlay.dispose(); t.engraved?.dispose(); t.band.dispose(); }
    },
  };
  eachPiece(attach);
  return api;
}

export const __glyphs = { silhouette };
