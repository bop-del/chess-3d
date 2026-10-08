// Pixelwelt island variants (CHE-106): five different surroundings for the board, picked by the URL flag ?island=a|b|c|d|e (this load
// only, no Options entry, no flag or an unknown value keeps today's island of world.js). Only the island body, its rim, the trays'
// surroundings and the decoration change: the board squares, the tray slabs (SLABS), PIXEL_EDGE and the coordinates stay.
//   a Wiese        grass all round, flowers and tufts, two small trees, the edge steps down through dirt and stone
//   b Strandinsel  grass, a sand beach, water to the edge, a small waterfall off the back, two palms
//   c Dorf         gravel paths, fences, lanterns, farm fields at the sides, a hut in a corner
//   d Schwebende   a round main island and three small floating islands (tree, ore, a pond with a fall)
//   e Vulkan       a basalt island with a smoking volcano, a lava river and a lava fall
// Each builder returns { island, extras, tree, update } with the contract of buildTerrain in world.js: island is a group named 'island'
// with userData.boxes (for the coplanar rule), extras more such groups, tree the { group, cells, feet } buildAvoid wants (or null), update
// an optional per frame hook. Everything is meshed quads with the fixed face shade (mesher.js), flat unlit, the textures clamp (rule 3)
// except the animated water, fall, lava and lavafall. Water and lava are opaque and lie over closed ground (rule 1). light: fewer props.
import * as THREE from 'three';

export const ISLAND_IDS = ['a', 'b', 'c', 'd', 'e'];

/** The variant the URL names (?island=b), or null: no flag and any other value mean today's island. */
export function islandFlag() {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('island');
  return ISLAND_IDS.includes(v) ? v : null;
}

const EXTRA_KINDS = {
  gravel: { top: 'gravel', side: 'gravel', bottom: 'dirt' },
  soil: { top: 'soil', side: 'dirt', bottom: 'dirt' },
  ore: { top: 'ore', side: 'ore', bottom: 'ore' },
  basalt: { top: 'basalt', side: 'basalt', bottom: 'basalt' },
};
const rect = (cx, cz, hw, hd) => ({ cx, cz, hw, hd });
const dist = (x, z, r) => Math.hypot(Math.max(Math.abs(x - r.cx) - r.hw, 0), Math.max(Math.abs(z - r.cz) - r.hd, 0));
const CORE = rect(0, 0, 6.8, 4.1);   // the board and both trays
const dCore = (x, z) => dist(x, z, CORE);
const nearBoard = (x, z) => Math.abs(x) < 5 && Math.abs(z) < 5;   // the coordinate labels lie on this ring: keep it clear

/** Faces of a cell that touch a neighbour are not drawn . */
function emitCells(m, ctx, KX, grid, K) {
  for (const c of grid.values()) {
    const keys = KX[c.kind], skip = new Set();
    for (const [f, dx, dy, dz] of ctx.DIRS) { const nb = grid.get(K(c.ix + dx, c.iy + dy, c.iz + dz)); if (nb) skip.add(f); }
    m.box('grassTop', c.ix, c.iy, c.iz, 1, 1, 1, { keys, skip, color: c.color ?? (c.kind === 'boardL' ? 0xd6c8a2 : 0xffffff) });
  }
}
const K = (ix, iy, iz) => ((ix + 256) * 512 + (iy + 256)) * 512 + (iz + 256);

/**
 * The block terrain of a variant. spec.column({ ix, iz, x, z, tray, board, NZ }) answers for one column: null (no ground), or
 * { n, drop, rise, kind(k) -> kind | [kind, color], liquid, liquidY }: n cells down from the top, the top lowered by drop, rise cells
 * stacked above y = 0, one cell at iy = liquidY drawn as water or lava (a box 0.12 below the cell top) instead of a block.
 * The board and the tray columns always exist, at y = 0.
 */
function terrain(ctx, kit, spec) {
  const KX = { ...ctx.KINDS, ...EXTRA_KINDS }, m = new ctx.Mesher({ shade: true }), NZ = ctx.noise2(spec.seed ?? 9);
  const grid = new Map(), liquids = [], tops = new Map();
  const [x0, x1, z0, z1] = spec.box, margin = spec.trayMargin ?? 0.3;
  for (let ix = x0; ix < x1; ix++) for (let iz = z0; iz < z1; iz++) {
    const x = ix + 0.5, z = iz + 0.5, tray = ctx.inTray(x, z, margin), board = ctx.inBoard(x, z);
    const col = spec.column({ ix, iz, x, z, tray, board, NZ });
    if (!col) { if (board || tray) throw new Error('island variant: no ground under the board or a tray'); continue; }
    const flat = board || tray, drop = flat ? 0 : col.drop || 0, rise = flat ? 0 : col.rise || 0, n = Math.max(2, col.n);
    const list = [];   // [iy, kind, color, k] from the top down
    const kc = (k, up) => [].concat(col.kind(k, up));
    for (let j = rise - 1; j >= 0; j--) { const [kind, color] = kc(-1 - j, true); list.push([j, kind, color, -1 - j]); }
    for (let k = 0; k < n; k++) { const [kind, color] = kc(k, false); list.push([-1 - drop - k, kind, color, k]); }
    let first = true;
    for (const [iy, kind, color, k] of list) {
      if (first) { tops.set(`${ix},${iz}`, { y: rise > 0 ? rise : -drop, kind, rise, drop, liquid: col.liquid && iy === col.liquidY ? col.liquid : null }); first = false; }
      if (col.liquid && iy === col.liquidY) { liquids.push({ ix, iy, iz, key: col.liquid }); continue; }
      let kd = kind;
      if (k === 0 && iy === -1) { if (board) kd = (ix + 4 + (3 - iz)) % 2 === 0 ? 'boardD' : 'boardL'; }
      grid.set(K(ix, iy, iz), { ix, iy, iz, kind: kd, color: board ? undefined : color });
    }
  }
  emitCells(m, ctx, KX, grid, K);
  const liq = new Set(liquids.map((l) => K(l.ix, l.iy, l.iz)));
  for (const l of liquids) {
    const skip = new Set(['ny']);
    for (const [f, dx, dy, dz] of ctx.DIRS) if (dy === 0 && (grid.has(K(l.ix + dx, l.iy, l.iz + dz)) || liq.has(K(l.ix + dx, l.iy, l.iz + dz)))) skip.add(f);
    m.box(l.key, l.ix, l.iy, l.iz, 1, 0.88, 1, { skip });
  }
  return { m, grid, tops, NZ };
}

// ---- props ----
const put = (m, key, x, y, z, w, h, d, o) => m.box(key, x, y, z, w, h, d, o);
const flat = (m, x, y, z, w, h, d, color) => m.box('flat', x, y, z, w, h, d, { color });
const FLOWERS = [0xe0364f, 0xf2d13a, 0xffffff, 0xb06ae0, 0xff9ac8, 0xff8a3c];
function flower(m, x, y, z, c) { flat(m, x, y, z, 0.0625, 0.25, 0.0625, 0x3f8f2f); flat(m, x - 0.06, y + 0.25, z - 0.06, 0.1875, 0.125, 0.1875, c); }
function tuft(m, x, y, z, h, c = 0x4f9a36) { flat(m, x, y, z, 0.05, h, 0.05, c); flat(m, x + 0.11, y, z + 0.04, 0.05, h * 0.7, 0.05, 0x62b543); flat(m, x - 0.1, y, z + 0.1, 0.05, h * 0.55, 0.05, c); }
function fence(m, x0, z0, x1, z1, y = 0, h = 0.75) {
  const lenX = Math.abs(x1 - x0), lenZ = Math.abs(z1 - z0), len = Math.max(lenX, lenZ), n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; put(m, 'crate', x - 0.06, y, z - 0.06, 0.12, h, 0.12); }
  for (const ry of [0.2, 0.44]) {
    if (lenX >= lenZ) put(m, 'crate', Math.min(x0, x1), y + ry, z0 - 0.03, lenX, 0.08, 0.06);
    else put(m, 'crate', x0 - 0.03, y + ry, Math.min(z0, z1), 0.06, 0.08, lenZ);
  }
}
function lantern(m, x, y, z) {
  flat(m, x - 0.05, y, z - 0.05, 0.1, 1.05, 0.1, 0x5a3f27);
  flat(m, x - 0.17, y + 1.05, z - 0.17, 0.34, 0.06, 0.34, 0x3a2a1a);
  flat(m, x - 0.13, y + 1.11, z - 0.13, 0.26, 0.26, 0.26, 0xffe27a);
  flat(m, x - 0.17, y + 1.37, z - 0.17, 0.34, 0.06, 0.34, 0x3a2a1a);
}

/** Trees and palms: one foot group per tree (it shrinks softly when the camera comes close), one root group for buildAvoid. */
function trees(ctx, kit, list, seed) {
  const R = ctx.rnd(seed), root = new THREE.Group(), cells = [], feet = [];
  root.name = 'trees';
  for (const { tx, tz, y = 0, trunk = 4, rad = 2, palm = false } of list) {
    const m = new ctx.Mesher({ shade: true });
    for (let i = 0; i < trunk; i++) { m.box('logSide', tx, i, tz, 1, 1, 1, { keys: { top: 'logTop', side: 'logSide' } }); cells.push([tx, y + i, tz]); }
    const leaf = (x, yy, z) => { m.box('leaves', x, yy, z, 1, 1, 1); cells.push([x, y + yy, z]); };
    if (palm) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) leaf(tx + dx, trunk, tz + dz);
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) leaf(tx + dx, trunk - 1, tz + dz);
      leaf(tx, trunk, tz); leaf(tx, trunk + 1, tz);
    } else {
      const blob = (cy, r, h) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (Math.abs(dx) === r && Math.abs(dz) === r && R() < 0.55) continue; for (let dy = 0; dy < h; dy++) if (!(dx === 0 && dz === 0 && cy + dy < trunk)) leaf(tx + dx, cy + dy, tz + dz); } };
      blob(trunk - 1, rad, 2); if (rad > 1) blob(trunk + 1, rad - 1, 1); leaf(tx, trunk + (rad > 1 ? 2 : 1), tz);
    }
    const inner = ctx.toGroup(m, kit, { name: 'tree' });
    inner.position.set(-tx - 0.5, 0, -tz - 0.5);
    const foot = new THREE.Group();
    foot.name = 'tree-foot'; foot.position.set(tx + 0.5, y, tz + 0.5); foot.add(inner);
    root.add(foot); feet.push(foot);
  }
  return { group: root, cells, feet };
}
const topOf = (T, x, z) => T.tops.get(`${Math.floor(x)},${Math.floor(z)}`);

// ---------------------------------------------------------------- a Wiese
function meadow(ctx, kit, { light }) {
  const R = ctx.rnd(41);
  const T = terrain(ctx, kit, {
    seed: 9, box: [-13, 13, -11, 11],
    column: ({ x, z, board, tray, NZ }) => {
      const d = dCore(x, z) + (NZ(x * 1.7, z * 1.7) - 0.5) * 1.3;
      if (!board && !tray && d > 3.7) return null;
      const drop = board || tray ? 0 : d < 2.5 ? 0 : d < 3.1 ? 1 : 2;
      const n = 2 + Math.round(4 * Math.pow(Math.max(0, 1 - d / 4), 0.8) + (NZ(x + 40, z + 9) - 0.5) * 1.4);
      const patch = NZ(x * 2.3 + 5, z * 2.3) > 0.58 ? 0xe4f2d8 : 0xffffff;   // a slightly darker patch of grass here and there
      return { n, drop, kind: (k) => (drop === 0 ? (k === 0 ? ['grass', patch] : k < 3 ? 'dirt' : 'stone') : drop === 1 ? (k === 0 ? 'dirt' : 'stone') : 'stone') };
    },
  });
  // flowers and tufts: at most one prop per block of open grass, none on the label ring or beside a tray; beds of one colour where the noise is high
  for (const [c, t] of T.tops) {
    if (t.drop !== 0 || t.rise || t.kind !== 'grass') continue;
    const [ix, iz] = c.split(',').map(Number), x = ix + 0.2 + R() * 0.6, z = iz + 0.2 + R() * 0.6;
    if (nearBoard(ix + 0.5, iz + 0.5) || ctx.inTray(ix + 0.5, iz + 0.5, 1.0)) continue;
    const bed = T.NZ(ix * 1.3 + 3, iz * 1.3) > 0.6, r = R();
    if (r < (light ? 0.14 : bed ? 0.85 : 0.22)) flower(T.m, x, 0, z, bed ? FLOWERS[Math.floor(T.NZ(ix * 0.7, iz * 0.7 + 8) * FLOWERS.length) % FLOWERS.length] : FLOWERS[Math.floor(R() * FLOWERS.length)]);
    else if (r < (light ? 0.3 : 0.75)) tuft(T.m, x, 0, z, 0.22 + R() * 0.16);
  }
  for (const [bx, bz, s] of [[-9.6, 3.4, 0.7], [9.4, 4.7, 0.5]]) if (topOf(T, bx, bz)?.y === 0) put(T.m, 'cobble', bx, 0, bz, s, s * 0.75, s);
  return { island: ctx.toGroup(T.m, kit, { name: 'island' }), extras: [], tree: trees(ctx, kit, [{ tx: -8, tz: -6, trunk: 3, rad: 1 }, { tx: 7, tz: -6, trunk: 3, rad: 1 }], 23) };
}

// ---------------------------------------------------------------- b Strandinsel
function beach(ctx, kit, { light }) {
  const R = ctx.rnd(52), FALL_Z = -9, FALL_B = -7.5, FALL_T = 0.3;
  const T = terrain(ctx, kit, {
    seed: 21, box: [-14, 14, -11, 11],
    column: ({ ix, iz, x, z, board, tray, NZ }) => {
      let d = dCore(x, z) + (NZ(x * 1.5, z * 1.5) - 0.5) * 1.1;
      if (!board && !tray) {
        if (ix >= 1 && ix <= 3) { if (iz < FALL_Z) return null; if (iz <= FALL_Z + 1) d = 3.6; }   // the fall: a flat back edge
        else if (d > 4.6) return null;
      }
      if (d < 1.7 || board || tray) return { n: 3 + Math.round(1.5 * Math.max(0, 1 - d / 4.6)), kind: (k) => (k === 0 ? 'grass' : k < 3 ? 'dirt' : 'stone') };
      if (d < 3.1) return { n: 3, kind: (k) => (k < 2 ? 'sand' : 'stone') };
      return { n: 3, liquid: 'water', liquidY: -1, kind: () => 'sand' };
    },
  });
  // the waterfall (like the pond's of today): a sheet off the back edge, down past the island
  put(T.m, 'fall', 1.25, FALL_B, FALL_Z - FALL_T, 2.5, -0.12 - FALL_B, FALL_T, { skip: new Set(['pz', 'ny']) });
  // shells and starfish on the sand, a small sand castle
  let shells = 0;
  for (const [c, t] of T.tops) {
    if (t.kind !== 'sand' || t.liquid || shells >= (light ? 6 : 16) || R() > 0.16) continue;
    const [ix, iz] = c.split(',').map(Number);
    if (ctx.inTray(ix + 0.5, iz + 0.5, 0.6) || (ix >= 4 && ix <= 6 && iz >= 6 && iz <= 7)) continue;   // none under the sand castle (cx 5, cz 6.5)
    flat(T.m, ix + 0.25 + R() * 0.4, 0, iz + 0.25 + R() * 0.4, 0.2, 0.06, 0.2, R() < 0.5 ? 0xfff3ea : 0xf2a3b8); shells++;
  }
  const cx = 5, cz = 6.5;
  if (topOf(T, cx, cz)?.kind === 'sand' || topOf(T, cx, cz)?.kind === 'grass') {
    put(T.m, 'sand', cx, 0, cz, 1.3, 0.35, 1.3);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(T.m, 'sand', cx + dx * 0.95, 0, cz + dz * 0.95, 0.35, 0.7, 0.35);
    put(T.m, 'sand', cx + 0.4, 0.35, cz + 0.4, 0.5, 0.5, 0.5);
  }
  return { island: ctx.toGroup(T.m, kit, { name: 'island' }), extras: [], tree: trees(ctx, kit, [{ tx: -10, tz: -6, trunk: 4, palm: true }, { tx: 9, tz: -5, trunk: 3, palm: true }], 24) };
}

// ---------------------------------------------------------------- c Dorf
function village(ctx, kit, { light }) {
  const R = ctx.rnd(63), ISL = rect(-0.5, -1, 8.6, 6.2);
  const gravel = (ix, iz) => (iz === 5 && ix >= -10 && ix <= 8) || (ix === -10 && iz >= -4 && iz <= 5) || (ix === -8 && iz >= -5 && iz <= -3) || (iz === -3 && ix >= -10 && ix <= -8);
  const field = (ix, iz) => iz >= -2 && iz <= 3 && ((ix >= 7 && ix <= 8) || (ix >= -9 && ix <= -8));
  const T = terrain(ctx, kit, {
    seed: 14, box: [-13, 13, -12, 10],
    column: ({ ix, iz, x, z, board, tray, NZ }) => {
      const d = dist(x, z, ISL) + (NZ(x * 1.7, z * 1.7) - 0.5) * 1.0;
      if (!board && !tray && d > 1.9) return null;
      const drop = board || tray ? 0 : d < 1.3 ? 0 : 1;
      const n = 2 + Math.round(3 * Math.pow(Math.max(0, 1 - d / 2.6), 0.8) + (NZ(x + 40, z + 9) - 0.5) * 1.2);
      const top = board || tray ? 'grass' : drop ? 'dirt' : field(ix, iz) ? 'soil' : gravel(ix, iz) ? 'gravel' : 'grass';
      return { n, drop, kind: (k) => (k === 0 ? top : k < 3 ? 'dirt' : 'stone') };
    },
  });
  // the hut in the back left corner: planks walls, a door and two windows on the south side, a stepped red roof, a stone chimney
  const hx = -9, hz = -8, hw = 3, hd = 3, wh = 2;
  put(T.m, 'crate', hx, 0, hz, hw, wh, hd);
  flat(T.m, hx + 1.1, 0, hz + hd, 0.8, 1.35, 0.04, 0x4a2f1a);          // door (south, +z)
  flat(T.m, hx + 0.25, 0.9, hz + hd, 0.55, 0.5, 0.04, 0x9fd0f0); flat(T.m, hx + 2.2, 0.9, hz + hd, 0.55, 0.5, 0.04, 0x9fd0f0);
  flat(T.m, hx + hw, 0.9, hz + 1.2, 0.04, 0.5, 0.6, 0x9fd0f0);          // a window on the east wall
  for (const [i, ox, oz, w, d] of [[0, -0.4, -0.4, 3.8, 3.8], [1, 0, 0, 3, 3], [2, 0.5, 0.5, 2, 2]]) flat(T.m, hx + ox, wh + i * 0.5, hz + oz, w, 0.5, d, i === 2 ? 0xc04a3a : 0xa03a30);
  put(T.m, 'cobble', hx + 0.3, wh + 0.25, hz + 0.3, 0.6, 1.65, 0.6);
  // the fields: rows of wheat and young crops on the soil, a scarecrow in the right one
  for (const [xa, xb] of [[7, 9], [-9, -7]]) for (let r = 0; r < 4; r++) {
    const rx = xa + 0.17 + r * 0.5, gold = r % 2 === 0;
    flat(T.m, rx, 0, -1.85, 0.22, gold ? 0.55 : 0.38, 5.7, gold ? 0xd9b23a : 0x6fb83a);
  }
  flat(T.m, 7.9, 0, 0.6, 0.1, 1.3, 0.1, 0x6b4a2e); flat(T.m, 7.45, 0.95, 0.62, 1.0, 0.08, 0.06, 0x6b4a2e);
  flat(T.m, 7.75, 1.3, 0.5, 0.4, 0.35, 0.34, 0xe08a2c); flat(T.m, 7.7, 1.62, 0.45, 0.5, 0.08, 0.44, 0x4a3a2a); flat(T.m, 7.8, 1.68, 0.5, 0.3, 0.18, 0.34, 0x4a3a2a);
  // fences round the fields and along the front path
  for (const sg of [1, -1]) {
    const ox = sg * 9.1, ix0 = sg * 6.95;
    fence(T.m, ix0, -2.05, ox, -2.05); fence(T.m, ix0, 4.05, ox, 4.05); fence(T.m, ox, -2.05, ox, 4.05);
  }
  const lanterns = light ? [-8, 0, 8] : [-8, -4, 0, 4, 8];
  for (const lx of lanterns) lantern(T.m, lx, 0, 6.35);
  lantern(T.m, hx + 2.9, 0, hz + hd + 0.3);
  // haystack and a barrel by the hut, a few flowers on the grass
  flat(T.m, -5.5, 0, -6.6, 1.2, 0.6, 1.0, 0xd9b23a); flat(T.m, -5.3, 0.6, -6.5, 0.8, 0.5, 0.8, 0xe3c250);
  put(T.m, 'crate', -9.6, 0, -4.7, 0.5, 0.6, 0.5);
  let fl = 0;
  for (const [c, t] of T.tops) {
    if (t.kind !== 'grass' || t.drop || fl >= (light ? 6 : 16) || R() > 0.1) continue;
    const [ix, iz] = c.split(',').map(Number);
    if (nearBoard(ix + 0.5, iz + 0.5) || ctx.inTray(ix + 0.5, iz + 0.5, 1.0) || (ix >= -10 && ix <= -4 && iz >= -9 && iz <= -4) || iz >= 5 || field(ix, iz)) continue;
    flower(T.m, ix + 0.3 + R() * 0.4, 0, iz + 0.3 + R() * 0.4, FLOWERS[Math.floor(R() * FLOWERS.length)]); fl++;
  }
  return { island: ctx.toGroup(T.m, kit, { name: 'island' }), extras: [], tree: null };
}

// ---------------------------------------------------------------- d Schwebende Inseln
function islet(ctx, kit, KX, m, { cx, cy, cz, r, top, seed, deep = 4.5, fall = null }) {
  const NZ = ctx.noise2(seed), grid = new Map(), liquids = [], tops = [];
  for (let ix = cx - r - 2; ix <= cx + r + 2; ix++) for (let iz = cz - r - 2; iz <= cz + r + 2; iz++) {
    const dx = ix + 0.5 - cx, dz = iz + 0.5 - cz, q = Math.hypot(dx, dz) / r + (NZ(dx * 1.9 + 9, dz * 1.9) - 0.5) * 0.3;
    if (q > 1) continue;
    const inFall = fall && ix >= fall.ix0 && ix <= fall.ix1;
    if (inFall && iz < fall.iz) continue;
    const n = 2 + Math.round(deep * Math.pow(1 - q, 0.9) + (NZ(dx + 40, dz + 9) - 0.5));
    for (let k = 0; k < n; k++) {
      const iy = cy - 1 - k;
      let kind = top === 'ore' ? 'stone' : k === 0 ? 'grass' : k < 3 ? 'dirt' : 'stone';
      const pond = top === 'water' && (Math.hypot(dx, dz) < r * 0.55 || (inFall && iz <= fall.iz + 2 && dz < 0.5));
      if (pond && k === 0) { liquids.push({ ix, iy, iz }); continue; }
      if (pond && k === 1) kind = 'sand';
      if (k >= 3 && kind === 'stone' && NZ(ix * 3.1, iz * 2.7 + k) > 0.8) kind = 'ore';
      grid.set(K(ix, iy, iz), { ix, iy, iz, kind });
    }
    if (q < 0.86) tops.push([ix, iz]);
  }
  emitCells(m, ctx, KX, grid, K);
  const liq = new Set(liquids.map((l) => K(l.ix, l.iy, l.iz)));
  for (const l of liquids) {
    const skip = new Set(['ny']);
    for (const [f, dx, dy, dz] of ctx.DIRS) if (dy === 0 && (grid.has(K(l.ix + dx, l.iy, l.iz + dz)) || liq.has(K(l.ix + dx, l.iy, l.iz + dz)))) skip.add(f);
    m.box('water', l.ix, l.iy, l.iz, 1, 0.88, 1, { skip });
  }
  return { grid, liquids, tops };
}

function floating(ctx, kit, { light }) {
  const KX = { ...ctx.KINDS, ...EXTRA_KINDS }, R = ctx.rnd(74), RAD = 9.2;
  const T = terrain(ctx, kit, {
    seed: 33, box: [-12, 12, -11, 11],
    column: ({ x, z, board, tray, NZ }) => {
      const q = Math.hypot(x, z) / RAD + (NZ(x * 1.7, z * 1.7) - 0.5) * 0.1;
      if (!board && !tray && q > 1) return null;
      const n = 2 + Math.round(7 * Math.pow(Math.max(0, 1 - q), 0.9) + (NZ(x + 40, z + 9) - 0.5) * 1.4);
      return { n, kind: (k) => (k === 0 ? 'grass' : k < 3 ? 'dirt' : k > 3 && NZ(x * 3.1, z * 2.7 + k) > 0.82 ? 'ore' : 'stone') };
    },
  });
  for (const [c, t] of T.tops) {
    if (t.kind !== 'grass') continue;
    const [ix, iz] = c.split(',').map(Number);
    if (nearBoard(ix + 0.5, iz + 0.5) || ctx.inTray(ix + 0.5, iz + 0.5, 1.0) || R() > (light ? 0.14 : 0.3)) continue;
    const x = ix + 0.2 + R() * 0.6, z = iz + 0.2 + R() * 0.6;
    if (R() < 0.5) flower(T.m, x, 0, z, FLOWERS[Math.floor(R() * FLOWERS.length)]); else tuft(T.m, x, 0, z, 0.22 + R() * 0.14);
  }
  // three small floating islands: a tree, ore, a pond with a fall
  const m2 = new ctx.Mesher({ shade: true });
  const A = islet(ctx, kit, KX, m2, { cx: -13, cy: -2, cz: -4, r: 3, top: 'grass', seed: 5 });
  const B = islet(ctx, kit, KX, m2, { cx: 12, cy: -1, cz: -6, r: 2.8, top: 'ore', seed: 6 });
  const FZ = -16;   // the pond island's back edge: a channel of water two blocks wide ends flat there, the fall hangs on it
  islet(ctx, kit, KX, m2, { cx: 2, cy: -3, cz: -13, r: 3.2, top: 'water', seed: 7, fall: { ix0: 1, ix1: 2, iz: FZ } });
  put(m2, 'fall', 1.2, -23, FZ - 0.3, 1.6, -3.12 + 23, 0.3, { skip: new Set(['pz', 'ny']) });
  // ore blocks on the ore island, a few on the rock round the tree island
  for (const [ox, oy, oz, key] of [[11, -1, -7, 'ore'], [12, -1, -5, 'ore'], [13, -1, -6, 'stone'], [10, -1, -5, 'stone']]) {
    if (B.grid.has(K(ox, oy - 1, oz))) m2.box(key, ox, oy, oz, 1, 1, 1);
  }
  flat(m2, 11.2, -1, -4.2, 0.35, 0.3, 0.35, 0xf2c744);
  flower(m2, -11.4, -2, -4.9, 0xe0364f); flower(m2, -14.6, -2, -2.8, 0xf2d13a); tuft(m2, -12.3, -2, -2.3, 0.3); tuft(m2, -14, -2, -5.3, 0.25);
  const extra = ctx.toGroup(m2, kit, { name: 'islets' });
  const treeSpec = [{ tx: -14, tz: -5, y: -2, trunk: 3, rad: 1 }];
  const trs = trees(ctx, kit, treeSpec, 25);
  const mainTree = trees(ctx, kit, [{ tx: -8, tz: -6, trunk: 3, rad: 1 }], 26);
  trs.group.add(...mainTree.group.children); trs.cells.push(...mainTree.cells); trs.feet.push(...mainTree.feet);
  return { island: ctx.toGroup(T.m, kit, { name: 'island' }), extras: [extra], tree: trs };
}

// ---------------------------------------------------------------- e Vulkan
function volcano(ctx, kit, { light }) {
  const R = ctx.rnd(85), CV = { x: -7.5, z: -7.5 }, ISL = rect(0.2, -1.2, 8.6, 6.4);
  const EDGE = 9;   // the lava ends at this x: the island is cut off flat there for the three rows of the pool, the lava fall hangs on it
  const river = (ix, iz) => iz === -8 && ix >= -7 && ix <= 5;   // the lava river along the back row, east from the cone
  const pool = (ix, iz) => ix >= 5 && ix < EDGE && iz >= -9 && iz <= -7;
  const T = terrain(ctx, kit, {
    seed: 17, box: [-14, 14, -13, 11],
    column: ({ ix, iz, x, z, board, tray, NZ }) => {
      const d = dist(x, z, ISL) + (NZ(x * 1.7, z * 1.7) - 0.5) * 1.0;
      if (!board && !tray && (d > 1.9 || (ix >= EDGE && iz >= -9 && iz <= -7))) return null;
      const drop = board || tray ? 0 : d < 1.3 || (iz >= -9 && iz <= -7 && ix >= 3) ? 0 : 1;
      let n = 2 + Math.round(4 * Math.pow(Math.max(0, 1 - d / 2.8), 0.8) + (NZ(x + 40, z + 9) - 0.5) * 1.3);
      const cheb = Math.max(Math.abs(x - CV.x), Math.abs(z - CV.z));
      let rise = board || tray ? 0 : Math.max(0, Math.round(6 - cheb * 1.5));
      const crater = !board && !tray && cheb < 0.5;
      const top = 'basalt';
      const col = { n, drop, rise, kind: (k, up) => (up ? (-1 - k < 2 || R() < 0.1 ? 'stone' : 'basalt') : k === 0 ? top : 'stone') };
      if (crater) { col.liquid = 'lava'; col.liquidY = rise - 1; }
      else if (!board && !tray && (river(ix, iz) || pool(ix, iz))) { col.liquid = 'lava'; col.liquidY = rise > 0 ? rise - 1 : -1 - drop; col.n = Math.max(n, 3); }
      return col;
    },
  });
  // the lava fall: a sheet off the east edge of the pool, down past the island
  put(T.m, 'lavafall', EDGE, -7.5, -9, 0.3, 7.38, 3, { skip: new Set(['nx', 'ny']) });
  // basalt columns and rocks round the edge, a few glowing stones
  let rocks = 0;
  for (const [c, t] of T.tops) {
    if (t.rise || t.liquid || t.drop || rocks >= (light ? 6 : 14) || R() > 0.07) continue;
    const [ix, iz] = c.split(',').map(Number);
    if (nearBoard(ix + 0.5, iz + 0.5) || ctx.inTray(ix + 0.5, iz + 0.5, 1.0) || river(ix, iz) || pool(ix, iz) || (ix >= -11 && ix <= -4 && iz >= -11 && iz <= -4)) continue;
    const h = 0.4 + Math.floor(R() * 3) * 0.5;
    put(T.m, 'basalt', ix + 0.15, 0, iz + 0.15, 0.7, h, 0.7); rocks++;
  }
  // smoke: grey blocks rise from the crater and shrink away
  const puffs = light ? 2 : 4, smoke = new THREE.Group(), puffGroups = [];
  smoke.name = 'smoke';
  for (let i = 0; i < puffs; i++) {
    const pm = new ctx.Mesher({ shade: true });
    flat(pm, -0.4, -0.4, -0.4, 0.8, 0.8, 0.8, i % 2 ? 0x8c8996 : 0xa9a6b3);
    const g = ctx.toGroup(pm, kit, { name: 'puff' });
    smoke.add(g); puffGroups.push(g);
  }
  smoke.position.set(CV.x, 5.2, CV.z);
  const update = (t) => {
    kit.T.lava.offset.y = ((16 - Math.floor(t * 3) % 16) % 16) / 16;
    kit.T.lavafall.offset.y = (Math.floor(t * 3) % 16) / 16;
    puffGroups.forEach((g, i) => { const f = ((t * 0.12 + i / puffs) % 1); g.position.set(Math.sin(f * 6 + i) * 0.5 + f * 1.2, f * 7, Math.cos(f * 5 + i) * 0.4); g.scale.setScalar(Math.max(0.0001, (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85) * (0.6 + f * 0.6))); });
  };
  update(0);
  return { island: ctx.toGroup(T.m, kit, { name: 'island' }), extras: [smoke], tree: null, update };
}

export const ISLANDS = { a: meadow, b: beach, c: village, d: floating, e: volcano };
