// Pixelwelt block textures: 16 x 16 pixels each, every pixel placed by code (seeded noise and small hand written patterns, no asset
// files). Hard pixels up close (nearest when magnified), mipmaps when minified so far away blocks stay calm.
import * as THREE from 'three';

const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const clamp = (v) => Math.max(0, Math.min(255, v));

// Wrap modes (S61): a texture whose faces are one tile clamps, so the sample at a block edge can never wrap to the opposite row (the
// green hairline). Repeat is an explicit opt in for textures that tile on purpose; test/pixel-rules.mjs holds the allow list.
export const REPEATING = ['water', 'fall', 'planks', 'cloud', 'sun', 'lava', 'lavafall'];
function make(seed, draw, size = 16, repeat = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), r = rng(seed);
  const P = (px, py, hex, j = 0) => {
    if (px < 0 || py < 0 || px >= size || py >= size) return;
    const d = j ? (r() - 0.5) * 2 * j : 0, [R, G, B] = rgb(hex);
    x.fillStyle = `rgb(${clamp(R + d)},${clamp(G + d)},${clamp(B + d)})`; x.fillRect(px, py, 1, 1);
  };
  const fill = (hex, j) => { for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) P(px, py, hex, j); };
  draw({ x, r, P, fill, size });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.anisotropy = 4;
  return t;
}
// n clusters of a colour: a pixel and sometimes a neighbour, so the speckle reads like worn material instead of TV noise
const specks = (g, hex, n, j = 5) => { for (let i = 0; i < n; i++) { const px = Math.floor(g.r() * 16), py = Math.floor(g.r() * 16); g.P(px, py, hex, j); if (g.r() < 0.4) g.P(px + 1, py, hex, j); } };

function drawPlanks(g) {
  g.fill(0xb68a52, 6);
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4;
    for (let px = 0; px < 16; px++) { g.P(px, y0 + 3, 0x8a6638); g.P(px, y0, 0xc59b62, 4); }
    const jx = (row * 5 + 3) % 16; for (let py = y0; py < y0 + 3; py++) g.P(jx, py, 0x8a6638);
    g.P((jx + 7) % 16, y0 + 1, 0x9c7544, 4);
  }
}

/** The planks texture tiled to a w x d slab (one tile = one block), for the tray floor. Caller disposes (or passes track). */
export function trayPlanks(w, d, track = (t) => t) {
  const t = make(6, drawPlanks, 16, true);
  t.repeat.set(w, d);
  return track(t);
}

/** The coordinate labels for the grass (CHE-236): the atlas layout of board.js (8 x 2 cells of 128 px, files then ranks), cream with a dark outline. */
export function labelAtlas(track = (t) => t) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = '700 92px "Times New Roman", Times, "Liberation Serif", serif';
  const glyphs = ['abcdefgh', '12345678'];
  for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) {
    const cx = i * 128 + 64, cy = r * 128 + 68;
    g.lineWidth = 9; g.strokeStyle = 'rgba(28,20,8,0.95)'; g.strokeText(glyphs[r][i], cx, cy);
    g.fillStyle = '#fff2c8'; g.fillText(glyphs[r][i], cx, cy);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return track(t);
}

export function pixelTextures(track = (t) => t) {
  const T = {};
  T.grassTop = make(1, (g) => { g.fill(0x62a83c, 8); specks(g, 0x77bd48, 26); specks(g, 0x4a8c2e, 22); });
  T.dirt = make(2, (g) => { g.fill(0x86603f, 8); specks(g, 0x6b4a2e, 24); specks(g, 0x9c7650, 20); specks(g, 0x5a3f27, 6); });
  T.grassSide = make(3, (g) => {
    g.fill(0x86603f, 8); specks(g, 0x6b4a2e, 20); specks(g, 0x9c7650, 14);
    for (let px = 0; px < 16; px++) {
      const h = 3 + Math.floor(g.r() * 3);
      for (let py = 0; py < h; py++) g.P(px, py, 0x62a83c, 8);
      g.P(px, h - 1, 0x4a8c2e, 4);
    }
  });
  T.stone = make(4, (g) => { g.fill(0x808285, 6); specks(g, 0x6a6c70, 30); specks(g, 0x95979b, 22); specks(g, 0x5a5c60, 8); });
  T.cobble = make(5, (g) => {
    g.fill(0x797b7f, 9);
    const rows = [[0, 5], [5, 5], [10, 6]];                    // three bands of stones, every band shifted
    rows.forEach(([y0, h], i) => {
      const off = [0, 4, 2][i];
      for (let px = 0; px < 16; px++) { g.P(px, y0, 0x4f5156); }
      for (let k = 0; k < 3; k++) { const jx = (off + k * 6 + Math.floor(g.r() * 2)) % 16; for (let py = y0; py < y0 + h; py++) g.P(jx, py, 0x4f5156); }
    });
    for (let i = 0; i < 20; i++) g.P(Math.floor(g.r() * 16), Math.floor(g.r() * 16), 0x93959a, 6);
  });
  T.planks = make(6, drawPlanks, 16, true);
  T.logSide = make(7, (g) => {
    g.fill(0x6b4e2e, 5);
    for (let px = 0; px < 16; px++) if (g.r() < 0.5) for (let py = 0; py < 16; py++) if (g.r() < 0.85) g.P(px, py, 0x4d3720, 5);
    specks(g, 0x80603a, 18);
  });
  T.logTop = make(8, (g) => {
    g.fill(0xb78e58, 5);
    for (let i = 0; i < 16; i++) { g.P(i, 0, 0x6b4e2e); g.P(i, 15, 0x6b4e2e); g.P(0, i, 0x6b4e2e); g.P(15, i, 0x6b4e2e); }
    for (let i = 4; i < 12; i++) { g.P(i, 4, 0x93703f); g.P(i, 11, 0x93703f); g.P(4, i, 0x93703f); g.P(11, i, 0x93703f); }
    g.P(7, 7, 0x93703f); g.P(8, 8, 0x93703f);
  });
  T.leaves = make(9, (g) => {
    g.fill(0x3f8f35, 14); specks(g, 0x2c6f28, 40, 6); specks(g, 0x58ad47, 30, 6);
    for (let i = 0; i < 10; i++) g.x.clearRect(Math.floor(g.r() * 16), Math.floor(g.r() * 16), 1, 1);
  });
  T.sand = make(10, (g) => { g.fill(0xdbcf97, 6); specks(g, 0xc9bb80, 24); specks(g, 0xeadfae, 18); });
  T.water = make(11, (g) => { g.fill(0x2f5fcf, 8); for (let i = 0; i < 14; i++) { const px = Math.floor(g.r() * 13), py = Math.floor(g.r() * 16); for (let k = 0; k < 3; k++) g.P(px + k, py, 0x5d8df0, 4); } specks(g, 0x2650b0, 18); }, 16, true);
  // the waterfall (CHE-222): vertical streaks, scrolls down the sheet (repeat on purpose, like the pond)
  T.fall = make(12, (g) => { g.fill(0x3a6bd8, 8); for (let i = 0; i < 9; i++) { const px = Math.floor(g.r() * 16), py = Math.floor(g.r() * 12); for (let k = 0; k < 2 + Math.floor(g.r() * 4); k++) g.P(px, (py + k) % 16, 0xdce9ff, 4); } specks(g, 0x2a55b8, 14); }, 16, true);
  T.cloud = make(12, (g) => { g.fill(0xffffff, 4); }, 8, true);
  T.sun = make(13, (g) => { g.fill(0xffe27a, 6); for (let i = 0; i < 8; i++) { g.P(i * 2, 0, 0xfff3b8); g.P(0, i * 2, 0xfff3b8); } }, 8, true);
  // CHE-106 island variants: gravel paths, tilled soil (furrows run along z on a top face), ore, basalt and the lava of the volcano island
  T.gravel = make(14, (g) => { g.fill(0x9a948a, 7); specks(g, 0xb4aea2, 30); specks(g, 0x7d776d, 26); specks(g, 0xcfc9bd, 8, 3); });
  T.soil = make(15, (g) => { g.fill(0x6e4a2c, 6); for (let px = 0; px < 16; px += 4) for (let py = 0; py < 16; py++) { g.P(px, py, 0x4a2f1a, 3); g.P(px + 1, py, 0x5a3a22, 3); } specks(g, 0x86603f, 14); });
  T.ore = make(16, (g) => {
    g.fill(0x808285, 6); specks(g, 0x6a6c70, 24); specks(g, 0x95979b, 16);
    for (const [hex, n] of [[0xf2c744, 3], [0x5fd8e6, 2]]) for (let i = 0; i < n; i++) { const px = 1 + Math.floor(g.r() * 12), py = 1 + Math.floor(g.r() * 12); g.P(px, py, hex, 6); g.P(px + 1, py, hex, 6); g.P(px, py + 1, hex, 6); g.P(px + 1, py + 1, 0xfff3b8, 4); }
  });
  T.basalt = make(17, (g) => { g.fill(0x59555f, 5); specks(g, 0x46424d, 26); specks(g, 0x6e6a78, 20); specks(g, 0xe0662a, 1, 10); });
  T.lava = make(18, (g) => { g.fill(0xe8641c, 8); for (let i = 0; i < 12; i++) { const px = Math.floor(g.r() * 13), py = Math.floor(g.r() * 16); for (let k = 0; k < 3; k++) g.P(px + k, py, 0xffb028, 4); } specks(g, 0xffe066, 8); specks(g, 0xb23a10, 14); }, 16, true);
  T.lavafall = make(19, (g) => { g.fill(0xf07a1c, 8); for (let i = 0; i < 9; i++) { const px = Math.floor(g.r() * 16), py = Math.floor(g.r() * 12); for (let k = 0; k < 2 + Math.floor(g.r() * 4); k++) g.P(px, (py + k) % 16, 0xffe066, 4); } specks(g, 0xc9440f, 14); }, 16, true);
  for (const k in T) track(T[k]);
  return T;
}
