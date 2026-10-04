// The Pixelwelt world: a floating chunk of 1 x 1 x 1 terrain blocks (grass over dirt over stone, a sand beach, a square pond of water
// blocks), the 8 x 8 board laid into the top layer (light squares sand, dark squares cobblestone, flush with the grass), an oak plank
// frame with log corner posts, two crates for the captured pieces, an oak tree, a square sun and blocky clouds. Units as everywhere:
// one square = 1.0, the board top is y = 0, centred at x = z = 0. Everything is meshed quads (mesher.js with the fixed per face shade).
import * as THREE from 'three';
import { Mesher } from '../blocks/mesher.js';
import { buildAvoid, approach } from '../blocks/island.js';
import { makePixelKit } from './kit.js';

const rnd = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const ISLAND = { rx: 7.2, rz: 5.7, n: 3 };                 // half sizes and squareness of the outline (a superellipse)
const SLABS = { cx: 5.75, cz: 0.96, w: 1.45, len: 4.9 };   // the tray slab (src/trays.js SLAB): the crates are built around it
const BED_DROP = 0.3;                                      // the crate beds sit this much lower than the grass
const POOL = { x0: 4, x1: 6, z0: -5, z1: -3 };             // the pond, in whole blocks
const FRAME = 0.5;
export const PIXEL_EDGE = 4 + FRAME;                       // half size of board plus frame
const FRAME_H = 0.2;
const TREE = { x: -7, z: -6, trunk: 4 };
const KINDS = {
  grass: { top: 'grassTop', side: 'grassSide', bottom: 'dirt' },
  dirt: { top: 'dirt', side: 'dirt', bottom: 'dirt' },
  stone: { top: 'stone', side: 'stone', bottom: 'stone' },
  sand: { top: 'sand', side: 'sand', bottom: 'sand' },
  boardL: { top: 'sand', side: 'sand', bottom: 'dirt' },
  boardD: { top: 'cobble', side: 'cobble', bottom: 'dirt' },
  bed: { top: 'stone', side: 'stone', bottom: 'stone' },
};
const DIRS = [['px', 1, 0, 0], ['nx', -1, 0, 0], ['py', 0, 1, 0], ['ny', 0, -1, 0], ['pz', 0, 0, 1], ['nz', 0, 0, -1]];
const inTray = (x, z, m = 0.3) => Math.abs(Math.abs(x) - SLABS.cx) < SLABS.w / 2 + m && Math.abs(z - SLABS.cz) < SLABS.len / 2 + m;
const inBoard = (x, z) => Math.abs(x) < 4 && Math.abs(z) < 4;
const inPool = (ix, iz) => ix >= POOL.x0 && ix < POOL.x1 && iz >= POOL.z0 && iz < POOL.z1;

function toGroup(m, kit, { cast = false, name } = {}) {
  const g = new THREE.Group();
  if (name) g.name = name;
  g.userData.boxes = m.boxes;
  for (const [k, geo] of m.geometries()) {
    const mesh = new THREE.Mesh(geo, kit.mats[k] || kit.mats.flat);
    mesh.name = k;
    if (k === 'water') mesh.renderOrder = 2;
    mesh.castShadow = cast;
    g.add(mesh);
  }
  return g;
}

function noise2(seed) {
  const R = rnd(seed), tab = new Float32Array(64 * 64).map(() => R());
  const at = (i, j) => tab[((i & 63) * 64) + (j & 63)];
  return (x, z) => {
    const g = 1.6, fx = x / g + 32, fz = z / g + 32, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sz) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sz;
  };
}

function buildTerrain(kit) {
  const R = rnd(31), m = new Mesher({ shade: true }), grid = new Map(), NZ = noise2(9);
  const K = (ix, iy, iz) => ((ix + 256) * 512 + (iy + 256)) * 512 + (iz + 256);
  const onGrass = new Set();
  for (let ix = -8; ix < 8; ix++) for (let iz = -7; iz < 7; iz++) {
    const x = ix + 0.5, z = iz + 0.5, tray = inTray(x, z), board = inBoard(x, z), pool = inPool(ix, iz);
    const tree = ix >= TREE.x && ix <= TREE.x + 1 && iz >= TREE.z && iz <= TREE.z + 1;
    const sq = Math.pow(Math.pow(Math.abs(x) / ISLAND.rx, ISLAND.n) + Math.pow(Math.abs(z) / ISLAND.rz, ISLAND.n), 1 / ISLAND.n) + (NZ(x * 1.7, z * 1.7) - 0.5) * 0.14;
    if (sq > 1 && !tray && !board && !pool && !tree) continue;
    const depth = 2 + Math.round(3 * Math.pow(Math.max(0, 1 - sq), 0.7) + (NZ(x + 40, z + 9) - 0.5) * 1.4);
    const n = Math.max(2, depth);
    const beach = sq > 0.86 && !tray && !board && !tree;
    const bed = tray && !board;
    if (!board && !tray && !pool && !beach) onGrass.add(`${ix},${iz}`);
    for (let k = 0; k < n; k++) {
      if (pool && k === 0) continue;
      let kind = k === 0 ? 'grass' : k < 3 ? 'dirt' : 'stone';
      if (board && k === 0) kind = (ix + 4 + (3 - iz)) % 2 === 0 ? 'boardD' : 'boardL';   // file f = ix + 4, rank r = 3 - iz: a1 is dark
      else if (bed && k === 0) kind = 'bed';
      else if (beach && k < 2) kind = 'sand';
      else if (pool && k === 1) kind = 'sand';
      grid.set(K(ix, -1 - k, iz), { ix, iy: -1 - k, iz, kind, bed: bed && k === 0 });
    }
  }
  for (const c of grid.values()) {
    const keys = KINDS[c.kind], skip = new Set();
    for (const [f, dx, dy, dz] of DIRS) { const nb = grid.get(K(c.ix + dx, c.iy + dy, c.iz + dz)); if (nb && !(nb.bed && !c.bed && dy === 0)) skip.add(f); }
    m.box('grassTop', c.ix, c.iy, c.iz, 1, c.bed ? 1 - BED_DROP : 1, 1, { keys, skip, color: c.kind === 'boardL' ? 0xd6c8a2 : 0xffffff });
  }
  // the pond: water blocks a little below the grass (two blocks wide and deep, only the surface is drawn)
  m.box('water', POOL.x0, -1, POOL.z0, POOL.x1 - POOL.x0, 1 - 0.12, POOL.z1 - POOL.z0, { skip: new Set(['px', 'nx', 'pz', 'nz', 'ny']), color: 0xffffff });
  // the oak frame: a ring half a block wide around the board, four log posts in the corners
  const fh = FRAME_H;
  // the planks stop at the posts: no two boxes share a face (rule, test/pixel-rules.mjs)
  m.box('planks', -4, 0, -4 - FRAME, 8, fh, FRAME); m.box('planks', -4, 0, 4, 8, fh, FRAME);
  m.box('planks', -4 - FRAME, 0, -4, FRAME, fh, 8); m.box('planks', 4, 0, -4, FRAME, fh, 8);
  for (const [px, pz] of [[-4 - FRAME, -4 - FRAME], [4, -4 - FRAME], [-4 - FRAME, 4], [4, 4]]) m.box('logSide', px, 0, pz, FRAME, 0.5, FRAME, { keys: { top: 'logTop', side: 'logSide' } });
  // two crates for the captured pieces: boards two high with corner posts, built around the tray slab (top at y = 0, bottom -0.26)
  for (const sg of [1, -1]) {
    const cx = sg * SLABS.cx, x0 = cx - SLABS.w / 2 - 0.03, x1 = cx + SLABS.w / 2 + 0.03, z0 = SLABS.cz - SLABS.len / 2 - 0.03, z1 = SLABS.cz + SLABS.len / 2 + 0.03, t = 0.13;
    for (const [yb, yt] of [[-0.3, -0.01], [0, 0.29]]) {
      const h = yt - yb;
      m.box('crate', x0, yb, z0, x1 - x0, h, t); m.box('crate', x0, yb, z1 - t, x1 - x0, h, t);
      m.box('crate', x0, yb, z0 + t, t, h, z1 - z0 - 2 * t); m.box('crate', x1 - t, yb, z0 + t, t, h, z1 - z0 - 2 * t);
    }
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) m.box('crate', px - 0.04 + (px === x1 ? -0.14 : 0), -0.3, pz - 0.04 + (pz === z1 ? -0.14 : 0), 0.2, 0.62, 0.2);
  }
  // a few flowers (single colour blocks on a green stalk) and a boulder on the grass
  const flowers = [[-3.2, 4.75, 0xe0364f], [2.4, 4.8, 0xf2d13a], [0.2, -4.85, 0xffffff], [-2.5, -4.8, 0xe0364f], [3.6, 4.75, 0xf2d13a], [5.4, 4.4, 0xe0364f], [-5.4, 4.2, 0xf2d13a], [-6.2, -2.3, 0xe0364f], [-1.0, 4.8, 0xffffff]];
  for (const [fx, fz, c] of flowers) if (onGrass.has(`${Math.floor(fx)},${Math.floor(fz)}`)) {
    m.box('flat', fx, 0, fz, 0.0625, 0.25, 0.0625, { color: 0x3f8f2f }); m.box('flat', fx - 0.06, 0.25, fz - 0.06, 0.1875, 0.125, 0.1875, { color: c });
  }
  for (const [rx, rz, s] of [[-6.1, 3.4, 0.75], [3.2, 5.1, 0.5]]) if (onGrass.has(`${Math.floor(rx)},${Math.floor(rz)}`)) m.box('cobble', rx, 0, rz, s, s * 0.75, s);
  return toGroup(m, kit, { name: 'island' });
}

function buildTree(kit) {
  const R = rnd(23), m = new Mesher({ shade: true }), { x: tx, z: tz } = TREE, cells = [];
  const clear = (x, z) => x + 1 <= -PIXEL_EDGE || z + 1 <= -PIXEL_EDGE || x >= PIXEL_EDGE || z >= PIXEL_EDGE;
  for (let i = 0; i < TREE.trunk; i++) { m.box('logSide', tx, i, tz, 1, 1, 1, { keys: { top: 'logTop', side: 'logSide' } }); cells.push([tx, i, tz]); }
  const leafAt = (x, y, z) => { if (!clear(x, z)) return; m.box('leaves', x, y, z, 1, 1, 1); cells.push([x, y, z]); };
  const blob = (cy, rad, h) => { for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) { if (Math.abs(dx) === rad && Math.abs(dz) === rad && R() < 0.55) continue; for (let dy = 0; dy < h; dy++) if (!(dx === 0 && dz === 0 && cy + dy < TREE.trunk)) leafAt(tx + dx, cy + dy, tz + dz); } };
  blob(3, 2, 2); blob(5, 1, 1); leafAt(tx, 6, tz);
  const inner = toGroup(m, kit, { name: 'tree' });
  inner.position.set(-tx - 0.5, 0, -tz - 0.5);
  const group = new THREE.Group();
  group.name = 'tree-foot'; group.position.set(tx + 0.5, 0, tz + 0.5); group.add(inner);
  return { group, cells };
}

// clouds are flat slabs of white blocks, square from every side, drifting slowly
const CLOUDS = [[-14, -6, -12, 5, 0.3], [12, 0, -16, 4, 0.22], [-18, 4, 6, 4, 0.38], [16, -9, 8, 5, 0.28], [2, -14, -20, 5, 0.2], [-8, 8, -22, 4, 0.25], [24, 5, -6, 3, 0.33]];
function addClouds(parent, kit) {
  const R = rnd(5), out = [];
  for (const [x, y, z, n, speed] of CLOUDS) {
    const m = new Mesher({ shade: true });
    for (let i = 0; i < n; i++) {
      const w = 2 + Math.floor(R() * 3), d = 2 + Math.floor(R() * 2), ox = Math.round((R() - 0.5) * 5), oz = Math.round((R() - 0.5) * 2.5);
      m.box('cloud', ox, R() < 0.3 ? 1 : 0, oz, w, 1, d);
    }
    const g = toGroup(m, kit, { name: 'cloud' });
    const mats = [];
    g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); } });
    const local = new THREE.Box3().setFromObject(g);
    g.position.set(x, y, z); g.userData = { boxes: m.boxes, x0: x, y0: y, speed, mats, local, fade: 1 };
    parent.add(g); out.push(g);
  }
  return out;
}

/** The whole Pixelwelt world: { group, update(dt), settle(), dispose(), avoid, frame }. */
export function createPixelWorld({ track, view } = {}) {
  const kit = makePixelKit(track);
  const group = new THREE.Group();
  group.name = 'pixel-world';
  const isl = buildTerrain(kit);
  group.add(isl);
  // the frame and its posts fold down for the capture scenes (k from 1 to 0), as in Blocks
  const frameMeshes = isl.children.filter((o) => o.material === kit.mats.planks || o.material === kit.mats.logSide || o.material === kit.mats.logTop);
  const frame = (k) => { for (const o of frameMeshes) { o.scale.y = Math.max(k, 1e-4); o.visible = k > 0.01; } };
  group.userData.frame = frame;
  const tree = buildTree(kit);
  group.add(tree.group);
  const clouds = addClouds(group, kit);
  // the sun: one flat square, far behind the board
  const sunM = new Mesher({ shade: false });
  sunM.box('sun', -3.5, -3.5, -0.5, 7, 7, 1, { color: 0xffffff });
  const sun = toGroup(sunM, kit, { name: 'sun' });
  sun.position.set(-12, 17, -34);
  group.add(sun);
  const avoid = buildAvoid(group, tree, clouds, view, PIXEL_EDGE);
  let time = 2.2, tick = -1;
  const anim = (t) => {
    const f = Math.floor(t * 3);   // the water steps like animation frames: a pixel row every few frames
    if (f !== tick) { tick = f; kit.T.water.offset.y = (f % 16) / 16; kit.T.water.offset.x = (Math.floor(f / 5) % 16) / 16; }
    for (const c of clouds) { const span = 70, x = c.userData.x0 + t * c.userData.speed; c.position.x = ((x + 35) % span + span) % span - 35; }
  };
  anim(time);
  return {
    group, kit, avoid: avoid.state, frame,
    update(dt) { time += dt; anim(time); avoid.update(dt); },
    settle() { avoid.update(5); },
    dispose() {
      group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const c of clouds) for (const mt of c.userData.mats) mt.dispose();
      kit.dispose();
    },
  };
}
export { approach };
