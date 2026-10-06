// Pixelwelt backdrops (CHE-239): what stands far below the island. Two builders (floating islands, castle and village),
// each one Mesher of flat coloured boxes (plus the kit's water and fall textures), tinted by the sky: the colour is the box colour times
// the sky's multiplier, faded toward the horizon colour with distance, so the rows read as far away and the night is dark.
// The island and the board are not touched. The camera looks down at 46 degrees, so the ground of every backdrop lies about 25 below.
import * as THREE from 'three';
import { Mesher } from '../blocks/mesher.js';
import { BACKDROPS } from './look.js';

const rnd = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
/** Meshes of a Mesher through the kit (the flat material for keys the kit does not know). */
export function meshesOf(m, kit, name) {
  const g = new THREE.Group();
  g.name = name;
  g.userData.boxes = m.boxes;
  for (const [k, geo] of m.geometries()) {
    const mesh = new THREE.Mesh(geo, kit.mats[k] || kit.mats.flat);
    mesh.name = k;
    g.add(mesh);
  }
  return g;
}
const GROUND = -26;
const NO_BOTTOM = new Set(['ny']);   // a box that stands on the ground draws no floor (and never fights another floor at the same height)   // the top of the land and of the sea far below
const c1 = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color();

/** Grass green under a snow sky is white: the land, the hills and the island tops carry the snow. */
const grass = (hex, sky) => (sky.id === 'snow' ? 0xe6edf6 : hex);

/** A box colour for a sky: hex times the multiplier, faded toward the horizon by fade (0 near, 1 at the horizon). */
export function tint(hex, sky, fade = 0) {
  c1.setHex(hex); c2.setHex(sky.mul); c3.setHex(sky.hz);
  c1.multiply(c2).multiplyScalar(sky.dim ?? 1).lerp(c3, fade);
  return c1.getHex();
}
// lit windows when it is dark (night, evening, storm, snow), dark glass in the day
const winColor = (sky) => sky.id === 'night' || sky.id === 'storm' ? 0xffd45e : sky.id === 'evening' || sky.id === 'snow' ? 0xffc866 : 0x4a5878;

// ---- floating islands: stepped chunks of grass, dirt and stone; one with a waterfall, one with a small house ----
const ISLANDS = [
  [-26, -6, -22, 11, 'fall'], [27, -2, -26, 9, 'house'], [-30, -14, 12, 10, null], [30, -10, 18, 9, null], [4, -16, 36, 12, null],
  [-6, -12, -40, 13, null], [44, -16, -8, 8, null], [-44, -4, -6, 9, null], [14, -4, -44, 8, null], [-18, -8, 36, 7, null],
];
function islands(m, sky) {
  const R = rnd(7);
  ISLANDS.forEach(([x, y, z, w, kind], i) => {
    const d = w * (0.8 + R() * 0.3), fade = Math.min(0.5, Math.hypot(x, z) / 140);
    m.box('flat', x - w / 2, y - 1.2, z - d / 2, w, 1.2, d, { color: tint(grass(0x62a83c, sky), sky, fade) });
    m.box('flat', x - w / 2 + 0.6, y - 3.0 - i * 0.01, z - d / 2 + 0.6, w - 1.2, 1.8, d - 1.2, { color: tint(0x86603f, sky, fade) });
    for (let k = 0; k < 3; k++) { const s = 1.4 + k * 1.3; m.box('flat', x - w / 2 + s, y - 3.0 - 2.2 * (k + 1) - i * 0.013 * (k + 1), z - d / 2 + s, w - 2 * s, 2.2, d - 2 * s, { color: tint(0x808285, sky, fade) }); }
    if (kind === 'fall') {   // a pond at the back edge and the water falling off it, far down into the void
      m.box('water', x - 2, y - 1.1, z - d / 2 + 0.2, 4, 0.1, 2.2, { uvUnit: 2 });
      m.box('fall', x - 1.6, y - 40, z - d / 2 - 0.2, 3.2, 38.9, 0.6, { skip: new Set(['py', 'ny']), uvUnit: 2 });
    }
    if (kind === 'house') {
      const hx = x - 2, hz = z - 1;
      m.box('flat', hx, y, hz, 4, 2.6, 3.4, { color: tint(0xb68a52, sky, fade) });
      m.box('flat', hx - 0.4, y + 2.6, hz - 0.3, 4.8, 0.9, 4, { color: tint(0xa03a30, sky, fade) });
      m.box('flat', hx + 0.4, y + 3.5, hz + 0.5, 3.2, 0.9, 2.4, { color: tint(0xa03a30, sky, fade) });
      m.box('flat', hx + 0.9, y + 1.0, hz + 3.4, 0.8, 0.8, 0.05, { color: winColor(sky) });
      m.box('flat', hx + 2.3, y + 1.0, hz + 3.4, 0.8, 0.8, 0.05, { color: winColor(sky) });
    }
    // a few trees: a log and a cube of leaves
    for (let t = 0; t < 2 + (w > 9 ? 1 : 0); t++) {
      const tx = x + (R() - 0.5) * (w - 3), tz = z + (R() - 0.5) * (d - 3);
      if (kind === 'house' && Math.abs(tx - x) < 3.2 && Math.abs(tz - z) < 3) continue;
      m.box('flat', tx - 0.3, y, tz - 0.3, 0.6, 1.6, 0.6, { color: tint(0x6b4e2e, sky, fade) });
      m.box('flat', tx - 1.1, y + 1.5, tz - 1.1, 2.2, 1.8 + t * 0.09, 2.2, { color: tint(0x3f8f35, sky, fade) });
    }
  });
}

// ---- castle and village: a green land far below, a castle on a hill behind the island, houses around; windows lit at night ----
function house(m, sky, x, z, w, d, h, fade) {
  const roof = [0xa03a30, 0x4a5a78, 0x8a5a38][Math.abs(Math.round(x + z)) % 3];
  m.box('flat', x - w / 2, GROUND, z - d / 2, w, h, d, { color: tint(0xcfc2a0, sky, fade), skip: NO_BOTTOM });
  m.box('flat', x - w / 2 - 0.3, GROUND + h, z - d / 2 - 0.3, w + 0.6, 1.2, d + 0.6, { color: tint(roof, sky, fade) });
  m.box('flat', x - w / 2 + 0.4, GROUND + h + 1.2, z - d / 2 + 0.4, w - 0.8, 1.0, d - 0.8, { color: tint(roof, sky, fade) });
  for (const sx of [-1, 1]) m.box('flat', x + sx * w * 0.22 - 0.4, GROUND + 1.0, z + d / 2 + 0.02, 0.8, 0.9, 0.05, { color: winColor(sky) });
}
function castle(m, sky) {
  const R = rnd(29);
  m.box('flat', -150, GROUND - 20, -150, 300, 20, 300, { color: tint(grass(0x5f9a45, sky), sky, 0.12) });
  // a river and a few fields
  m.box('flat', -150, GROUND + 0.01, 18, 300, 0.01, 4, { color: tint(0x3a6bd8, sky, 0.25) });
  for (const [x, z, w, d, c] of [[22, -12, 12, 9, 0xc9b24a], [34, 8, 10, 8, 0x4f8a38], [-30, 8, 11, 8, 0xc9b24a], [-4, 38, 12, 9, 0x4f8a38]]) m.box('flat', x, GROUND + 0.02, z, w, 0.02, d, { color: tint(c, sky, 0.3) });
  // the hill (stepped) and the castle on it, straight behind the island
  const hx = -6, hz = -44;
  for (let k = 0; k < 5; k++) { const w = 26 - k * 4.4; m.box('flat', hx - w / 2, GROUND + k * 2, hz - w / 2, w, 2, w, { color: tint(grass(k < 1 ? 0x4f8a38 : 0x6a9a48, sky), sky, 0.18), skip: k ? undefined : NO_BOTTOM }); }
  const by = GROUND + 10, stone = tint(0xa2a4a8, sky, 0.12), dark = tint(0x76787e, sky, 0.12);
  m.box('flat', hx - 6, by, hz - 4, 12, 5.5, 8, { color: stone, skip: NO_BOTTOM });                         // the keep
  for (const [dx, dz] of [[-6.8, -4.8], [5.2, -4.8], [-6.8, 3.2], [5.2, 3.2]]) {          // four corner towers with roofs
    m.box('flat', hx + dx, by, hz + dz, 1.6, 8, 1.6, { color: dark, skip: NO_BOTTOM });
    m.box('flat', hx + dx - 0.3, by + 8, hz + dz - 0.3, 2.2, 1.6, 2.2, { color: tint(0x4a5a78, sky, 0.12) });
    m.box('flat', hx + dx + 0.3, by + 9.6, hz + dz + 0.3, 1.0, 1.0, 1.0, { color: tint(0x4a5a78, sky, 0.12) });
  }
  m.box('flat', hx - 2, by + 5.5, hz - 2, 4, 5, 4, { color: stone });                     // the donjon
  m.box('flat', hx - 2.4, by + 10.5, hz - 2.4, 4.8, 1.3, 4.8, { color: tint(0xa03a30, sky, 0.12) });
  m.box('flat', hx - 1.6, by + 11.8, hz - 1.6, 3.2, 1.3, 3.2, { color: tint(0xa03a30, sky, 0.12) });
  for (let k = 0; k < 5; k++) { m.box('flat', hx - 6 + k * 2.6 + 0.3, by + 5.5, hz + 3.2, 1.2, 0.9, 0.8, { color: dark }); }   // battlements
  for (const dx of [-3.5, -1.2, 1.2, 3.5]) m.box('flat', hx + dx - 0.4, by + 2.2, hz + 4.02, 0.8, 1.3, 0.05, { color: winColor(sky) });
  m.box('flat', hx - 0.5, by + 7.8, hz + 2.02, 1.0, 1.4, 0.05, { color: winColor(sky) });
  // villages: houses in loose groups on the sides and in front
  const groups = [[34, -2], [-36, 10], [8, 40], [-14, -16], [42, -34]];
  groups.forEach(([gx, gz], gi) => {
    for (let i = 0; i < 5; i++) {
      const x = gx + (i % 3 - 1) * 8 + (R() - 0.5) * 2, z = gz + (Math.floor(i / 3) - 0.5) * 8 + (R() - 0.5) * 2, w = 4 + R() * 2.2, d = 3.6 + R() * 2, h = 2.6 + R() * 1.4;
      house(m, sky, x, z, w, d, h, Math.min(0.45, Math.hypot(x, z) / 160));
    }
  });
}

const BUILD = { islands, castle };

/** The group of one backdrop for a sky, or null. */
export function buildBackdrop(id, sky, kit) {
  if (!BUILD[id] || !BACKDROPS[id]) return null;
  const m = new Mesher({ shade: true });
  BUILD[id](m, sky);
  return meshesOf(m, kit, `backdrop-${id}`);
}
