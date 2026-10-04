// The floating island of the Blocks theme: grass and stone board squares, plank frame, terrain, tree, waterfall, clouds.
// Units: one square = 1.0, the board top is y = 0, centred at x = z = 0 (the same as the classic board). Everything is meshed
// quads of 32 px textures (mesher.js), so the whole island is a handful of draw calls.
import * as THREE from 'three';
import { Mesher } from './mesher.js';
import { makeKit, toGroup } from './kit.js';
import { projectBox, projectPoints, hull, overlaps, rectPoly } from './screen.js';

const rnd = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const BLOCK = {
  grass: { keys: { top: 'grassTop', side: 'grassSide', bottom: 'dirt' } },
  dirt: { keys: { top: 'dirt', side: 'dirt', bottom: 'dirt' } },
  stone: { keys: { top: 'stone', side: 'stone', bottom: 'stone' } },
  plinth: { keys: { top: 'stone', side: 'stone', bottom: 'stone' }, tint: 0.4 },     // the dark grout under the board squares
  bed: { keys: { top: 'stone', side: 'stone', bottom: 'stone' } },
};
const DIRS = [['px', 1, 0, 0], ['nx', -1, 0, 0], ['py', 0, 1, 0], ['ny', 0, -1, 0], ['pz', 0, 0, 1], ['nz', 0, 0, -1]];
const TOP = -0.07;                                          // terrain surface; the board square tops are at y = 0
export const ISLAND = { rx: 7.3, rz: 5.0, n: 2.8 };           // half sizes and squareness of the island outline (a superellipse)
const SLABS = { cx: 5.75, cz: 0.96, w: 1.45, len: 4.9 };    // the tray slab (src/trays.js SLAB): the crates are built around it
const BED_DROP = 0.25;                                      // the crate beds are cut this much lower than the grass
const POOL = { x0: 5, x1: 7, z0: -4, z1: -2 };
const FALL_B = -5.2;                                        // bottom of the waterfall
const FRAME = 0.55;                                         // the plank frame is a little over half a square wide
export const EDGE = 4 + FRAME;                              // half size of the board and its frame
const inTray = (x, z, m = 0.3) => Math.abs(Math.abs(x) - SLABS.cx) < SLABS.w / 2 + m && Math.abs(z - SLABS.cz) < SLABS.len / 2 + m;
const inBoard = (x, z) => Math.abs(x) < 4.7 && Math.abs(z) < 4.7;
const inPool = (x, z) => x >= POOL.x0 && x < POOL.x1 && z >= POOL.z0 && z < POOL.z1;

// smooth value noise on a 1.4 unit grid
function noise2(seed) {
  const R = rnd(seed), tab = new Float32Array(64 * 64).map(() => R());
  const at = (i, j) => tab[((i & 63) * 64) + (j & 63)];
  return (x, z) => {
    const g = 1.4, fx = x / g + 32, fz = z / g + 32, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    return (at(i, j) * (1 - sx) + at(i + 1, j) * sx) * (1 - sz) + (at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx) * sz;
  };
}

/** The island: terrain blocks (face culled), bevelled board squares, frame, wooden capture crates, flowers, rocks, waterfall. */
function buildIsland(kit) {
  const R = rnd(11), m = new Mesher(), grid = new Map(), NZ = noise2(7);
  const K = (ix, iy, iz) => ((ix + 256) * 512 + (iy + 256)) * 512 + (iz + 256);
  const colTop = new Set(), onGrass = new Set();
  const rl = 1;                                             // layers cut away for the pool
  for (let ix = -8; ix < 8; ix++) for (let iz = -7; iz < 7; iz++) {
    const x = ix + 0.5, z = iz + 0.5, tray = inTray(x, z), board = inBoard(x, z), pool = inPool(x, z), tree = ix >= TREE.x && ix <= TREE.x + 1 && iz >= TREE.z && iz <= TREE.z + 1;   // the trunk and a ledge toward the board
    const wob = (NZ(x * 1.7, z * 1.7) - 0.5) * 0.1 + (R() - 0.5) * 0.03;
    const sq = Math.pow(Math.pow(Math.abs(x) / ISLAND.rx, ISLAND.n) + Math.pow(Math.abs(z) / ISLAND.rz, ISLAND.n), 1 / ISLAND.n) + wob;
    if (sq > 1 && !tray && !board && !pool && !tree) continue;
    const depth = 1.3 + 3.4 * Math.pow(Math.max(0, 1 - sq), 0.8) + (NZ(x + 40, z + 9) - 0.5) * 1.1;
    let n = Math.max(1, Math.round(depth));
    if (pool) n = Math.max(n, rl + 1);
    if (tray) n = Math.max(n, 2);
    colTop.add(`${ix},${iz}`);
    if (!board && !tray && !pool) onGrass.add(`${ix},${iz}`);
    const bed = tray && !board;
    for (let k = 0; k < n; k++) {
      if (pool && k < rl) continue;
      const kind = bed && k === 0 ? 'bed' : board && k === 0 ? 'plinth' : k === 0 ? 'grass' : 'stone';
      grid.set(K(ix, -1 - k, iz), { ix, iy: -1 - k, iz, kind, low: bed && k === 0 ? BED_DROP : 0, bed: bed && k === 0 });
    }
  }
  for (const c of grid.values()) {
    const def = BLOCK[c.kind], tint = (def.tint ?? 1) * (0.93 + R() * 0.1);
    const skip = new Set();
    for (const [f, dx, dy, dz] of DIRS) { const nb = grid.get(K(c.ix + dx, c.iy + dy, c.iz + dz)); if (nb && !(nb.bed && !c.bed && dy === 0)) skip.add(f); }   // a bed is lower: its neighbours keep the side face
    m.box('grassTop', c.ix, TOP + c.iy, c.iz, 1, 1 - c.low, 1, { keys: def.keys, skip, color: new THREE.Color(tint, tint, tint) });
  }
  // the spring pool at the back right edge, water a little below the grass, and the waterfall over the edge
  const floor = TOP - rl;
  m.box('water', POOL.x0, floor, POOL.z0, POOL.x1 - POOL.x0, TOP - 0.18 - floor, POOL.z1 - POOL.z0, { skip: new Set(['ny']) });
  // board squares: the dark plinth shows as the grout, each square is a low stepped block (wide foot, narrower top) with a bevel
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const key = (f + r) % 2 === 0 ? 'boardD' : 'boardL', x0 = f - 4, z0 = 3 - r;
    m.box(key, x0 + 0.03, TOP, z0 + 0.03, 0.94, 0.04, 0.94, { color: 0xcfcfcf });
    m.box(key, x0 + 0.07, TOP + 0.04, z0 + 0.07, 0.86, 0.03, 0.86);
  }
  // plank frame: a ring about half a block wide around the 8 x 8 board, corner posts
  const fh = 0.2 - TOP;
  m.box('plank', -4 - FRAME, TOP, -4 - FRAME, 8 + 2 * FRAME, fh, FRAME); m.box('plank', -4 - FRAME, TOP, 4, 8 + 2 * FRAME, fh, FRAME);
  m.box('plank', -4 - FRAME, TOP, -4, FRAME, fh, 8); m.box('plank', 4, TOP, -4, FRAME, fh, 8);
  for (const [px, pz] of [[-4 - FRAME, -4 - FRAME], [4, -4 - FRAME], [-4 - FRAME, 4], [4, 4]]) m.box('bark', px, TOP, pz, FRAME, 0.42 - TOP, FRAME, { keys: { top: 'barkTop' } });
  // the capture trays are wooden crates around the slabs: two boards high, corner posts, cleats on the outer long side
  for (const sg of [1, -1]) {
    const cx = sg * SLABS.cx, x0 = cx - SLABS.w / 2 - 0.03, x1 = cx + SLABS.w / 2 + 0.03, z0 = SLABS.cz - SLABS.len / 2 - 0.03, z1 = SLABS.cz + SLABS.len / 2 + 0.03, t = 0.13;
    for (const [yb, yt] of [[-0.31, -0.03], [-0.01, 0.28]]) {
      const h = yt - yb;
      m.box('crate', x0, yb, z0, x1 - x0, h, t); m.box('crate', x0, yb, z1 - t, x1 - x0, h, t);
      m.box('crate', x0, yb, z0 + t, t, h, z1 - z0 - 2 * t); m.box('crate', x1 - t, yb, z0 + t, t, h, z1 - z0 - 2 * t);
    }
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) m.box('crate', px - 0.04 + (px === x1 ? -0.14 : 0), -0.31, pz - 0.04 + (pz === z1 ? -0.14 : 0), 0.2, 0.69, 0.2, { color: 0xa8a8a8, keys: { top: 'plank' } });
    const ox = sg > 0 ? x1 : x0 - 0.03;
    for (const zz of [z0 + 0.9, SLABS.cz - 0.06, z1 - 1.02]) m.box('crate', ox, -0.31, zz, 0.03, 0.57, 0.13, { color: 0xc4c4c4 });
    for (const zz of [z0 - 0.03, z1]) m.box('crate', cx - 0.1, -0.31, zz, 0.2, 0.57, 0.03, { color: 0xc4c4c4 });
  }
  // flowers and rocks on the grass strips around the frame and crates
  const flowers = [[-3.2, 4.8, 0xff5c7a], [2.4, 4.85, 0xffe36a], [0.2, -4.85, 0xffffff], [-2.5, -4.8, 0xff9bb5], [3.6, 4.8, 0xffffff], [5.4, 4.4, 0xffe36a], [-5.4, 4.2, 0xff5c7a], [-6.2, -2.3, 0xffe36a], [4.4, -4.8, 0xff9bb5], [-1.0, 4.85, 0xffffff]];
  for (const [fx, fz, c] of flowers) if (onGrass.has(`${Math.floor(fx)},${Math.floor(fz)}`)) {
    m.box('flat', fx, TOP, fz, 0.1, 0.25 + 0.07, 0.1, { color: 0x3f8f2f }); m.box('flat', fx - 0.06, 0.25, fz - 0.06, 0.22, 0.2, 0.22, { color: c });
  }
  for (const [rx, rz, s] of [[5.2, -4.5, 0.7], [-6.1, 3.4, 0.6]]) if (onGrass.has(`${Math.floor(rx)},${Math.floor(rz)}`)) { m.box('stone', rx, TOP, rz, s, s * 0.7, s); m.box('stone', rx + s * 0.6, TOP, rz + 0.2, s * 0.6, s * 0.45, s * 0.6); }
  // a bush block on the tree's foot cell: inside the trunk while the tree stands, and what the Black view leaves behind when the
  // tree steps aside, so the corner reads as planned (leaves cannot reach the board: the cell lies far outside the frame)
  m.box('flat', TREE.x + 0.1, TOP, TREE.z + 0.1, 0.8, 0.55, 0.8, { color: 0x2f8a2a });   // plain colour boxes: a leaf textured block here keeps two textures uploaded after the Symbols view (themes test)
  m.box('flat', TREE.x + 0.3, TOP + 0.55, TREE.z + 0.3, 0.4, 0.2, 0.4, { color: 0x3ba034 });
  for (const [dx, dz, c] of [[0.05, 0.9, 0xff5c7a], [0.85, 0.2, 0xffe36a]]) { m.box('flat', TREE.x + dx, TOP, TREE.z + dz, 0.1, 0.25 + 0.07, 0.1, { color: 0x3f8f2f }); m.box('flat', TREE.x + dx - 0.06, 0.25, TREE.z + dz - 0.06, 0.22, 0.2, 0.22, { color: c }); }
  // waterfall: a sheet in three fading segments
  const wx = POOL.x1, wz = POOL.z0, L = -0.6 - FALL_B;
  m.box('fall1', wx - 0.3, -0.6, wz, 0.9, 0.42, 2, { uvUnit: 0.5 });
  m.box('fall1', wx, -0.6 - L * 0.55, wz + 0.05, 0.6, L * 0.55, 1.9, { uvUnit: 0.5 });
  m.box('fall2', wx + 0.03, -0.6 - L * 0.85, wz + 0.05, 0.55, L * 0.3, 1.9, { uvUnit: 0.5 });
  m.box('fall3', wx + 0.06, FALL_B, wz + 0.05, 0.5, L * 0.15, 1.9, { uvUnit: 0.5 });
  return { group: toGroup(m, kit, { name: 'island' }), fall: { wx, wz } };
}

const TREE = { x: -7, z: -6, trunk: 4 };
/**
 * The tree on the back left edge of the island: { group (scaled around its foot), cells (the minimum corner of every block) }.
 * No block stands over the board or its frame (the square from -EDGE to EDGE): a leaf cell is kept only when its whole footprint
 * lies outside it. What a tall tree still covers on screen from other sides is handled per frame by buildAvoid.
 */
function buildTree(kit) {
  const R = rnd(23), m = new Mesher(), { x: tx, z: tz } = TREE, cells = [];
  const clear = (x, z) => x + 1 <= -EDGE || z + 1 <= -EDGE || x >= EDGE || z >= EDGE;
  for (let i = 0; i < TREE.trunk; i++) { m.box('bark', tx, i, tz, 1, 1, 1, { keys: { top: 'barkTop' }, color: new THREE.Color(1 - R() * 0.06, 1 - R() * 0.06, 1) }); cells.push([tx, i, tz]); }
  const leafAt = (x, y, z) => { if (!clear(x, z)) return; const v = 0.9 + R() * 0.15; m.box('leaves', x, y, z, 1, 1, 1, { color: new THREE.Color(v, v, v) }); cells.push([x, y, z]); };
  const blob = (cy, rad, h) => { for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) { if (Math.abs(dx) === rad && Math.abs(dz) === rad && R() < 0.6) continue; for (let dy = 0; dy < h; dy++) if (!(dx === 0 && dz === 0 && cy + dy < 4)) leafAt(tx + dx, cy + dy, tz + dz); } };
  blob(3, 2, 2); blob(5, 1, 1); leafAt(tx, 6, tz);
  const inner = toGroup(m, kit, { name: 'tree' });
  inner.position.set(-tx - 0.5, 0, -tz - 0.5);
  const group = new THREE.Group();
  group.name = 'tree-foot'; group.position.set(tx + 0.5, 0, tz + 0.5); group.add(inner);
  return { group, cells };
}

const CLOUDS = [[-14, -6, -15, 5, 0.3], [12, 0, -16, 4, 0.22], [-18, 4, 6, 4, 0.38], [16, -9, 8, 5, 0.28], [2, -14, -20, 5, 0.2], [-8, 8, -22, 4, 0.25], [24, 5, -19, 3, 0.33]];
/** Each cloud is its own group so it drifts at its own (slow) speed. */
function addClouds(parent, kit) {
  const R = rnd(5), out = [];
  for (const [x, y, z, n, speed] of CLOUDS) {
    const m = new Mesher();
    for (let i = 0; i < n; i++) {
      const w = 2 + Math.floor(R() * 3), d = 2 + Math.floor(R() * 2), ox = (R() - 0.5) * 5, oz = (R() - 0.5) * 2.5;
      m.box('cloud', ox, (R() < 0.3 ? 0.8 : 0), oz, w, 0.8, d, { color: 0xffffff });
    }
    const g = toGroup(m, kit, { cast: false, receive: false, name: 'cloud' });
    // a material of its own per cloud, so one cloud can fade out (at a UI control) without the others
    const mats = [];
    g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material); } });
    const local = new THREE.Box3().setFromObject(g);
    g.position.set(x, y, z); g.userData = { x0: x, y0: y, speed, mats, local, fade: 1 };
    parent.add(g); out.push(g);
  }
  return out;
}

/** Animated water: a slow scrolling fall, a little foam at the top lip, mist at the bottom, drifting clouds. update(t) in seconds. */
function buildAnim(parent, kit, isl, clouds) {
  const { wx, wz } = isl.fall, box = new THREE.BoxGeometry(1, 1, 1), items = [], mats = [];
  const mk = (kind, i, n) => {
    const mat = new THREE.MeshLambertMaterial({ color: 0xb8d8ff, transparent: true, opacity: 0.8, depthWrite: false, emissive: 0x3a5f95 });
    const mesh = new THREE.Mesh(box, mat); mesh.renderOrder = 3; parent.add(mesh); items.push({ kind, i, n, mesh, mat }); mats.push(mat);
  };
  for (let i = 0; i < 6; i++) mk('mist', i, 6);
  for (let i = 0; i < 4; i++) mk('streak', i, 4);
  for (let i = 0; i < 2; i++) mk('lip', i, 2);
  for (let i = 0; i < 2; i++) mk('foam', i, 2);
  const frac = (v) => v - Math.floor(v);
  return {
    geo: box, mats,
    update(t) {
      kit.T.waterfall.offset.y = -t * 0.3;
      kit.T.water.offset.x = t * 0.03; kit.T.water.offset.y = Math.sin(t * 0.6) * 0.04;
      for (const it of items) {
        const { mesh, mat, i, n } = it, ph = frac(t * 0.1 + i / n), s = (i * 7919 % 13) / 13;
        if (it.kind === 'mist') {
          mesh.position.set(wx + 0.3 + ph * 1.2 + s * 0.6, FALL_B - 1.2 + ph * 1.4 + s * 0.4, wz + 0.2 + s * 1.5);
          mesh.scale.setScalar(0.35 + ph * 1.0); mat.opacity = 0.35 * Math.sin(ph * Math.PI);
        } else if (it.kind === 'streak') {
          const q = frac(t * 0.14 + i / n);
          mesh.position.set(wx + 0.36, -0.5 - q * (-0.5 - FALL_B), wz + 0.2 + ((i * 5) % 7) / 7 * 1.6);
          mesh.scale.set(0.08, 0.5 + s * 0.6, 0.2); mat.opacity = 0.5 * (1 - q * 0.8);
        } else if (it.kind === 'lip') {
          const q = frac(t * 0.2 + i / n);
          mesh.position.set(wx - 0.15 + q * 0.5, -0.12 + Math.sin(t * 1.6 + i * 1.7) * 0.03 - q * q * 0.9, wz + 0.1 + (i / n) * 1.8);
          mesh.scale.setScalar(0.2 + 0.08 * Math.sin(t * 3 + i)); mat.opacity = 0.5 * (1 - q * 0.6);
        } else {
          const q = frac(t * 0.16 + i / n);
          mesh.position.set(wx - 0.4 - q * 0.9, -0.55 + Math.sin(t * 2 + i) * 0.03, wz + 0.1 + (i / n) * 1.8);
          mesh.scale.set(0.3, 0.14, 0.3); mat.opacity = 0.45 * (1 - q);
        }
      }
      for (const c of clouds) { const span = 70, x = c.userData.x0 + t * c.userData.speed; c.position.x = ((x + 35) % span + span) % span - 35; }
    },
  };
}

const MASK_X = 6.6, MASK_TOP = 2.3;       // the prism over the board: crates to x = 6.6, figures to 2.3
const LIFT = 14, LIFT_FROM = 0.5;           // clouds rise by up to LIFT while the camera elevation is below LIFT_FROM (rad)
export const approach = (cur, target, step) => (cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step));

/**
 * Keeps the tree and the clouds out of the way. view() gives { camera, w, h, rects } (the camera, the canvas size in px and the UI
 * controls as DOMRect like objects). The tree shrinks into the ground while it would cover a board square or the frame on screen
 * and grows back when the view moves on; a cloud fades out while it would pass behind a control. Each test runs on the full size
 * tree and the full cloud, so nothing flickers. `state` is read by the smoke tests.
 */
export function buildAvoid(group, tree, clouds, view, edge = EDGE) {
  const hullTmp = [], state = { treeHidden: false, treeCovers: false, cloudsHidden: 0, boardAvoid: true, lift: 0 };
  // the board and its frame (10 x 10) up to the height of the pieces, in world space, as the hull of the corners on screen
  const ground = [];
  for (const y of [0, 1.2]) for (const [x, z] of [[-edge, -edge], [edge, -edge], [edge, edge], [-edge, edge]]) ground.push(new THREE.Vector3(x, y, z));
  // what no cloud may cover (CHE-159): the board, its frame, both crates and the figures standing on them, as one prism
  const mask = [];
  for (const y of [-0.4, MASK_TOP]) for (const [x, z] of [[-MASK_X, -edge], [MASK_X, -edge], [MASK_X, edge], [-MASK_X, edge]]) mask.push(new THREE.Vector3(x, y, z));
  const cornerPts = [], corner = new THREE.Vector3(), camLocal = new THREE.Vector3();
  let lift = 0;
  let grow = 1, lastKey = '', wpts = [];
  return {
    state,
    update(dt) {
      const vw = view?.();
      if (!vw?.camera) return;
      const { camera, w, h, rects = [] } = vw;
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      group.updateWorldMatrix(true, false);
      wpts = ground.map((p) => { const q = group.localToWorld(p.clone()); return [q.x, q.y, q.z]; });
      // the tree: only when the camera or the window moved
      const key = camera.matrixWorldInverse.elements.concat(camera.projectionMatrix.elements, group.matrixWorld.elements, w, h).join();
      if (key !== lastKey) {
        lastKey = key;
        const board = hull(projectPoints(wpts, camera, w, h));
        let covers = false;
        for (const [x, y, z] of tree.cells) {
          cornerPts.length = 0;
          for (let k = 0; k < 8; k++) { const q = group.localToWorld(corner.set(x + (k & 1), y + ((k >> 1) & 1), z + ((k >> 2) & 1))); cornerPts.push([q.x, q.y, q.z]); }
          if (overlaps(hull(projectPoints(cornerPts, camera, w, h)), board)) { covers = true; break; }
        }
        state.treeCovers = covers;
      }
      grow = approach(grow, state.treeCovers ? 0 : 1, dt / 0.35);
      tree.group.scale.setScalar(Math.max(grow, 0.0001));
      tree.group.visible = grow > 0.02;
      state.treeHidden = !tree.group.visible;
      // the clouds: they follow the camera height (a low camera looks past the island at the sky, so the clouds go up with it)
      // and fade out while they would come between the camera and the board or a figure, or behind a control
      camLocal.copy(camera.position); group.worldToLocal(camLocal);
      const elev = Math.atan2(camLocal.y, Math.hypot(camLocal.x, camLocal.z));
      lift = state.boardAvoid ? LIFT * Math.min(1, Math.max(0, (LIFT_FROM - elev) / LIFT_FROM)) : 0;
      state.lift = lift;
      const polys = rects.map((r) => rectPoly(r, 10));
      if (state.boardAvoid) polys.push(hull(projectPoints(mask.map((p) => { const q = group.localToWorld(p.clone()); return [q.x, q.y, q.z]; }), camera, w, h)));
      let hidden = 0;
      for (const c of clouds) {
        c.position.y = c.userData.y0 + lift;
        c.updateWorldMatrix(true, false);
        const wb = c.userData.local.clone().applyMatrix4(c.matrixWorld);
        const poly = hull(projectBox(wb, camera, w, h, hullTmp));
        const hit = polys.some((pl) => overlaps(poly, pl));
        c.userData.fade = approach(c.userData.fade, hit ? 0 : 1, dt / 0.3);
        for (const mt of c.userData.mats) mt.opacity = c.userData.fade;
        c.visible = c.userData.fade > 0.01;
        if (hit) hidden++;
      }
      state.cloudsHidden = hidden;
    },
  };
}

/** The whole Blocks world: { group, update(dt, t?), dispose() }. track(texture) registers a texture for disposal. view(): see buildAvoid. */
export function createWorld({ track, onKit, view } = {}) {
  const kit = makeKit(track);
  onKit?.(kit);
  const group = new THREE.Group();
  group.name = 'blocks-world';
  const isl = buildIsland(kit);
  group.add(isl.group);
  // the plank frame and its corner posts: the battle scene lowers them (k from 1 to 0) so the low camera looks past the board
  // edge and no plank wall stands on the horizon behind the fight
  const frameMeshes = isl.group.children.filter((o) => o.material === kit.mats.plank || o.material === kit.mats.bark);
  const frame = (k) => { for (const o of frameMeshes) { o.scale.y = Math.max(k, 1e-4); o.visible = k > 0.01; } };
  group.userData.frame = frame;
  const tree = buildTree(kit);
  group.add(tree.group);
  const clouds = addClouds(group, kit);
  const anim = buildAnim(group, kit, isl, clouds);
  const avoid = buildAvoid(group, tree, clouds, view);
  let time = 2.2;
  anim.update(time);
  return {
    group, kit, avoid: avoid.state, frame,
    update(dt) { time += dt; anim.update(time); avoid.update(dt); },
    /** run the avoid pass at once (the view changed in one jump: a test, a theme switch) */
    settle() { avoid.update(5); },
    dispose() {
      group.traverse((o) => { if (o.isMesh && o.geometry !== anim.geo) o.geometry.dispose(); });
      for (const c of clouds) for (const mt of c.userData.mats) mt.dispose();
      anim.geo.dispose();
      for (const mt of anim.mats) mt.dispose();
      kit.dispose();
    },
  };
}
