// Easy flat view, style A: every piece is drawn as one flat symbol lying on its square. The symbols are canvas paths
// painted once into an atlas (no font files, no image files). Each symbol is a plane parented to the piece's own group,
// so it follows every slide, hop, capture flight and tray landing for free. While the symbols are on, the 3D piece body
// is hidden (and with it its shadow); the invisible pick cylinder stays, so picking works as before.
import * as THREE from 'three';

const CELL = 256;                         // atlas cell in pixels
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const COLORS = ['w', 'b'];
const PLANE = 1.0;                        // symbol plane in squares (the glyph itself fills about 0.85 of it)
const LIFT = 0.02;                        // above the board, above the highlights (0.0045) and the hint marks (0.012)

const INK = { w: { fill: '#f6efdc', line: '#23232b', rim: '#1b1b21' }, b: { fill: '#1d1d24', line: '#e2d9c3', rim: '#efe6cf' } };

// Glyphs in a 100 x 100 box, base line at y = 90, drawn facing up the board (towards black). Each is a list of filled
// parts (outline first, then fill, so only the outside of the union keeps the outline) plus thin detail strokes.
const BASE = 'M25 91 L25 84 Q25 80 30 80 L70 80 Q75 80 75 84 L75 91 Z';
const circle = (x, y, r) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
const GLYPHS = {
  p: {
    parts: [
      circle(50, 30, 12),
      'M42 41 L58 41 Q58 52 65 66 Q68 73 72 80 L28 80 Q32 73 35 66 Q42 52 42 41 Z',
      'M35 50 L65 50 L65 56 L35 56 Z',
      BASE,
    ],
    lines: [],
  },
  r: {
    parts: [
      'M31 80 L35 38 L65 38 L69 80 Z',
      'M29 40 L29 14 L38.5 14 L38.5 23 L46 23 L46 14 L54 14 L54 23 L61.5 23 L61.5 14 L71 14 L71 40 Z',
      BASE,
    ],
    lines: ['M31 40 H69', 'M34 62 H66'],
  },
  n: {
    parts: [
      'M27 80 C28 64 36 56 44 48 L34 51 Q22 55 15 51 Q10 47 14 41 Q20 33 31 27 L36 13 L43 21 L49 11 Q67 21 73 42 C78 58 77 70 74 80 Z',
      BASE,
    ],
    lines: ['M44 48 Q51 40 49 31', 'M58 32 Q68 46 66 64'],
    dots: [[36, 31, 3.2], [19, 45, 1.8]],
  },
  b: {
    parts: [
      circle(50, 14, 5.5),
      'M50 20 Q70 33 65 49 Q64 55 59 57 L41 57 Q36 55 35 49 Q30 33 50 20 Z',
      'M37 57 L63 57 L63 64 L37 64 Z',
      'M42 63 Q42 72 33 80 L67 80 Q58 72 58 63 Z',
      BASE,
    ],
    lines: ['M50 29 V43', 'M43.5 36 H56.5'],
  },
  q: {
    parts: [
      'M30 80 L33 52 L22 26 L37 42 L39 21 L46 41 L50 15 L54 41 L61 21 L63 42 L78 26 L67 52 L70 80 Z',
      circle(22, 24, 5), circle(39, 18, 5), circle(50, 12, 5.5), circle(61, 18, 5), circle(78, 24, 5),
      BASE,
    ],
    lines: ['M33 56 H67', 'M31 68 H69'],
  },
  k: {
    parts: [
      'M45.5 6 H54.5 V13 H61 V21 H54.5 V30 H45.5 V21 H39 V13 H45.5 Z',
      'M32 80 Q29 62 33 50 Q34 40 42 35 L58 35 Q66 40 67 50 Q71 62 68 80 Z',
      'M30 36 L70 36 L70 43 L30 43 Z',
      BASE,
    ],
    lines: ['M32 60 H68', 'M31 70 H69'],
  },
};

// Paints one glyph into the box (x0, y0, size) of a 2d context.
export function drawGlyph(g, type, color, x0, y0, size) {
  const ink = INK[color], def = GLYPHS[type];
  const s = size / 100;
  const parts = def.parts.map((d) => new Path2D(d));
  g.save();
  g.translate(x0, y0);
  g.scale(s, s);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // soft drop shadow, so a symbol sits on the marble instead of printing on it
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 5 * s; g.shadowOffsetY = 2.5 * s;
  g.strokeStyle = ink.rim; g.lineWidth = 7;
  for (const p of parts) g.stroke(p);
  g.restore();
  if (color === 'b') {                       // a thin pale rim keeps black symbols apart from black marble
    g.strokeStyle = ink.rim; g.lineWidth = 8.5;
    for (const p of parts) g.stroke(p);
    g.strokeStyle = '#14141a'; g.lineWidth = 5.5;
    for (const p of parts) g.stroke(p);
  } else {
    g.strokeStyle = ink.line; g.lineWidth = 6;
    for (const p of parts) g.stroke(p);
  }
  g.fillStyle = ink.fill;
  for (const p of parts) g.fill(p);
  g.strokeStyle = ink.line; g.lineWidth = 2.6;
  for (const d of def.lines || []) g.stroke(new Path2D(d));
  g.fillStyle = ink.line;
  for (const [x, y, r] of def.dots || []) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

function buildAtlas() {
  const c = document.createElement('canvas');
  c.width = CELL * TYPES.length; c.height = CELL * COLORS.length;
  const g = c.getContext('2d');
  COLORS.forEach((color, row) => TYPES.forEach((type, col) => {
    const pad = CELL * 0.07;
    drawGlyph(g, type, color, col * CELL + pad, row * CELL + pad, CELL - 2 * pad);
  }));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

function cellGeometry(col, row) {
  const w = TYPES.length, h = COLORS.length, e = 0.5;   // half a texel in
  const u0 = (col * CELL + e) / (CELL * w), u1 = ((col + 1) * CELL - e) / (CELL * w);
  const v1 = 1 - (row * CELL + e) / (CELL * h), v0 = 1 - ((row + 1) * CELL - e) / (CELL * h);
  const geo = new THREE.PlaneGeometry(PLANE, PLANE).rotateX(-Math.PI / 2);   // top of the glyph points to -z (black side)
  const uv = geo.getAttribute('uv');
  uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
  return geo;
}

// createSymbols({ gimbal, game, materials, stage? }) -> { setVisible(on), sync(), dispose() }
//   stage is optional: with it, sync() also turns every symbol so it reads upright on screen whatever the camera yaw.
//   sync() is cheap and safe to call every frame; pieces made after setVisible get their symbol at once (root.add is wrapped).
export function createSymbols({ gimbal, game, stage = null }) {
  const root = game.root;
  const atlas = buildAtlas();
  const mat = new THREE.MeshBasicMaterial({
    map: atlas, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const geos = {};
  COLORS.forEach((color, row) => TYPES.forEach((type, col) => { geos[type + color] = cellGeometry(col, row); }));

  let on = false;
  let yaw = 0;
  const symbols = new Set();
  const noRay = () => {};

  function attach(group) {
    const info = group.userData.piece;
    if (!info || group.userData.symbol) return;
    const mesh = new THREE.Mesh(geos[info.type + info.color], mat);
    mesh.name = 'symbol';
    mesh.position.y = LIFT;
    mesh.rotation.y = yaw;
    mesh.renderOrder = 11;                       // above the highlights (10), so a selected piece is not tinted
    mesh.raycast = noRay;
    mesh.visible = on;
    group.add(mesh);
    group.userData.symbol = mesh;
    symbols.add(mesh);
  }
  function body(group, show) {                   // the 3D piece: everything but the pick cylinder and the symbol
    for (const ch of group.children) if (!ch.userData.hit && ch.name !== 'symbol') ch.visible = show;
  }
  function apply(group) {
    attach(group);
    const sym = group.userData.symbol;
    if (!sym) return;
    sym.visible = on;
    body(group, !on);
  }
  const eachPiece = (fn) => { for (const ch of root.children) if (ch.userData?.piece) fn(ch); };

  // pieces are created in the middle of an animation (promotion): catch them the moment they join the pieces group
  const origAdd = root.add; // the prototype method
  root.add = function (...objs) {
    const r = origAdd.apply(this, objs);
    for (const o of objs) if (o?.userData?.piece) apply(o);
    return r;
  };

  const upLocal = new THREE.Vector3(), q = new THREE.Quaternion();
  function orient() {
    if (!stage) return;
    upLocal.set(0, 1, 0).applyQuaternion(stage.camera.quaternion).applyQuaternion(q.copy(gimbal.quaternion).invert());
    if (upLocal.x * upLocal.x + upLocal.z * upLocal.z < 1e-4) return;        // looking straight along y: keep the last yaw
    const a = Math.atan2(-upLocal.x, -upLocal.z);
    if (Math.abs(a - yaw) < 1e-3) return;
    yaw = a;
    for (const m of symbols) { if (!m.parent) symbols.delete(m); else m.rotation.y = yaw; }
  }

  const api = {
    setVisible(v) {
      on = !!v;
      eachPiece(apply);
      if (on) orient();
    },
    sync() {
      eachPiece(apply);
      if (on) orient();
    },
    get visible() { return on; },
    dispose() {
      delete root.add;                           // back to the prototype method
      eachPiece((g) => { g.userData.symbol?.removeFromParent(); g.userData.symbol = null; body(g, true); });
      symbols.clear();
      Object.values(geos).forEach((g) => g.dispose());
      mat.dispose(); atlas.dispose();
    },
  };
  eachPiece(attach);
  return api;
}
