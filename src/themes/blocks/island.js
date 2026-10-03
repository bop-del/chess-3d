// The floating island of the Blocks theme: grass and stone board squares, plank frame, terrain, tree, waterfall, clouds.
// Units: one square = 1.0, the board top is y = 0, centred at x = z = 0 (the same as the classic board). Everything is meshed
// quads of 16 px textures (mesher.js), so the whole island is a handful of draw calls.
import * as THREE from 'three';
import { Mesher } from './mesher.js';
import { makeKit, toGroup } from './kit.js';

const rnd = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const BLOCK = {
  grass: { keys: { top: 'grassTop', side: 'grassSide', bottom: 'dirt' } },
  dirt: { keys: { top: 'dirt', side: 'dirt', bottom: 'dirt' } },
  stone: { keys: { top: 'stone', side: 'stone', bottom: 'stone' } },
  boardL: { keys: { top: 'boardL', side: 'grassSide', bottom: 'dirt' }, flat: true },
  boardD: { keys: { top: 'boardD', side: 'stone', bottom: 'stone' }, flat: true },
};
const DIRS = [['px', 1, 0, 0], ['nx', -1, 0, 0], ['py', 0, 1, 0], ['ny', 0, -1, 0], ['pz', 0, 0, 1], ['nz', 0, 0, -1]];
// The capture trays stand on the island (x about 5 to 6.5 on both sides, z from -1.5 to 3.4). Their slab top is at y = 0, so the
// columns below them are cut 0.3 lower (a stone bed) instead of sharing the grass plane.
const BED_X = new Set([-7, -6, 5, 6]), BED_Z = [-2, 3], BED_DROP = 0.3;

/** The island: terrain blocks (face culled), board squares, frame, tree, flowers, rocks, waterfall. */
function buildIsland(kit) {
  const R = rnd(11), m = new Mesher(), grid = new Map(), bed = new Set();
  const key = (x, y, z) => `${x},${y},${z}`;
  const force = new Set(['-7,-6', '-6,-6', '-7,-5']);
  for (let ix = -7; ix <= 6; ix++) for (let iz = -7; iz <= 6; iz++) {
    const cx = ix + 0.5, cz = iz + 0.5, r = Math.hypot(cx, cz) + (R() - 0.5) * 1.1;
    const tray = BED_X.has(ix) && iz >= BED_Z[0] && iz <= BED_Z[1];
    if (r > 7.2 && !force.has(`${ix},${iz}`) && !tray) continue;
    const depth = Math.max(1, Math.round(1.4 + (1 - Math.min(1, r / 7.4)) * 8.6 + (R() - 0.5) * 1.6));
    for (let d = 0; d < depth; d++) grid.set(key(ix, -1 - d, iz), d === 0 ? 'grass' : d < 3 ? 'dirt' : 'stone');
    if (tray) bed.add(key(ix, -1, iz));
  }
  // spring pool at the back right edge (2 x 2 cells), away from the trays, and the waterfall over the edge
  const poolZ = [-4, -3];
  let edge = -7;
  for (let ix = -7; ix <= 6; ix++) if (poolZ.every((z) => grid.has(key(ix, -1, z)))) edge = ix;
  const water = [];
  for (let ix = edge - 1; ix <= edge; ix++) for (const z of poolZ) { grid.delete(key(ix, -1, z)); if (!grid.has(key(ix, -2, z))) grid.set(key(ix, -2, z), 'dirt'); water.push([ix, z]); }
  // board squares
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) grid.set(key(f - 4, -1, 3 - r), (f + r) % 2 === 0 ? 'boardD' : 'boardL');
  // terrain meshing with face culling
  for (const [k, type] of grid) {
    const [x, y, z] = k.split(',').map(Number);
    const def = bed.has(k) ? { keys: { top: 'stone', side: 'stone', bottom: 'stone' } } : BLOCK[type];
    const skip = new Set();
    for (const [f, dx, dy, dz] of DIRS) { const nk = key(x + dx, y + dy, z + dz); if (grid.has(nk) && !(bed.has(nk) && !bed.has(k) && dy === 0)) skip.add(f); }   // a bed is lower: its neighbours keep the side face
    const v = def.flat ? 1 : 0.93 + R() * 0.1;
    const low = bed.has(k) ? BED_DROP : 0;
    m.box('grassTop', x, y, z, 1, 1 - low, 1, { keys: def.keys, skip, color: new THREE.Color(v, v, v) });
  }
  // lowered water in the channel
  for (const [ix, z] of water) m.box('water', ix, -1, z, 1, 0.82, 1, { skip: new Set(['ny']) });
  // plank frame: a ring one block wide around the 8 x 8 board, corner posts
  const fh = 0.24;
  for (let i = -5; i < 5; i++) {
    m.box('plank', i, 0, -5, 1, fh, 1); m.box('plank', i, 0, 4, 1, fh, 1);
    if (i > -5 && i < 4) { m.box('plank', -5, 0, i, 1, fh, 1); m.box('plank', 4, 0, i, 1, fh, 1); }
  }
  for (const [px, pz] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) m.box('bark', px, 0, pz, 1, 0.5, 1, { keys: { top: 'barkTop' } });
  // tree
  const tx = -6, tz = -6;
  for (let i = 0; i < 4; i++) m.box('bark', tx, i, tz, 1, 1, 1, { keys: { top: 'barkTop' }, color: new THREE.Color(1 - R() * 0.06, 1 - R() * 0.06, 1) });
  const leafAt = (x, y, z) => { const v = 0.9 + R() * 0.15; m.box('leaves', x, y, z, 1, 1, 1, { color: new THREE.Color(v, v, v) }); };
  const blob = (cy, rad, h) => { for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) { if (Math.abs(dx) === rad && Math.abs(dz) === rad && R() < 0.6) continue; for (let dy = 0; dy < h; dy++) if (!(dx === 0 && dz === 0 && cy + dy < 4)) leafAt(tx + dx, cy + dy, tz + dz); } };
  blob(3, 2, 2); blob(5, 1, 1); leafAt(tx, 6, tz);
  // flowers and rocks on the grass
  const flowers = [[-5.3, -2.2, 0xff5c7a], [-4.6, 4.3, 0xffe36a], [5.2, 3.9, 0xffffff], [-6.0, 2.0, 0xff9bb5], [5.5, -5.4, 0xffe36a], [2.2, 5.3, 0xff5c7a], [-2.6, -5.6, 0xffffff], [0.4, -6.3, 0xff9bb5], [3.8, 5.8, 0xffe36a]];
  for (const [fx, fz, c] of flowers) {
    if (grid.get(key(Math.floor(fx), -1, Math.floor(fz))) === 'grass' && !bed.has(key(Math.floor(fx), -1, Math.floor(fz)))) {
      m.box('flat', fx, 0, fz, 0.1, 0.25, 0.1, { color: 0x3f8f2f }); m.box('flat', fx - 0.06, 0.25, fz - 0.06, 0.22, 0.2, 0.22, { color: c });
    }
  }
  for (const [rx, rz, s] of [[5.2, -5.3, 0.9], [-6.2, -3.4, 0.7]]) {
    if (grid.get(key(Math.floor(rx), -1, Math.floor(rz))) === 'grass') { m.box('stone', rx, 0, rz, s, s * 0.7, s); m.box('stone', rx + s * 0.6, 0, rz + 0.2, s * 0.6, s * 0.45, s * 0.6); }
  }
  // waterfall: a sheet in three fading segments
  const wx = edge + 1, wz = poolZ[0];
  m.box('fall1', wx - 0.3, -0.6, wz, 0.9, 0.42, 2, { uvUnit: 0.5 });
  m.box('fall1', wx, -6.5, wz + 0.05, 0.6, 5.9, 1.9, { uvUnit: 0.5 });
  m.box('fall2', wx + 0.03, -10.5, wz + 0.05, 0.55, 4, 1.9, { uvUnit: 0.5 });
  m.box('fall3', wx + 0.06, -14, wz + 0.05, 0.5, 3.5, 1.9, { uvUnit: 0.5 });
  return { group: toGroup(m, kit, { name: 'island' }), fall: { wx, wz } };
}

const CLOUDS = [[-14, -6, -12, 5, 0.3], [12, 0, -16, 4, 0.22], [-18, 4, 6, 4, 0.38], [16, -9, 8, 5, 0.28], [2, -14, -20, 5, 0.2], [-8, 8, -22, 4, 0.25], [24, 5, -6, 3, 0.33]];
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
    g.position.set(x, y, z); g.userData = { x0: x, speed };
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
          mesh.position.set(wx + 0.3 + ph * 1.2 + s * 0.6, -16.2 + ph * 3.4 + s * 0.8, wz + 0.2 + s * 1.5);
          mesh.scale.setScalar(0.35 + ph * 1.0); mat.opacity = 0.35 * Math.sin(ph * Math.PI);
        } else if (it.kind === 'streak') {
          const q = frac(t * 0.14 + i / n);
          mesh.position.set(wx + 0.36, -0.5 - q * 13.5, wz + 0.2 + ((i * 5) % 7) / 7 * 1.6);
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

/** The whole Blocks world: { group, update(dt, t?), dispose() }. track(texture) registers a texture for disposal. */
export function createWorld({ track, onKit } = {}) {
  const kit = makeKit(track);
  onKit?.(kit);
  const group = new THREE.Group();
  group.name = 'blocks-world';
  const isl = buildIsland(kit);
  group.add(isl.group);
  const clouds = addClouds(group, kit);
  const anim = buildAnim(group, kit, isl, clouds);
  let time = 2.2;
  anim.update(time);
  return {
    group, kit,
    update(dt) { time += dt; anim.update(time); },
    dispose() {
      group.traverse((o) => { if (o.isMesh && o.geometry !== anim.geo) o.geometry.dispose(); });
      anim.geo.dispose();
      for (const mt of anim.mats) mt.dispose();
      kit.dispose();
    },
  };
}
