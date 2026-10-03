// 16 px block face textures drawn in code (no asset files). Nearest filtering on magnification, mipmapped nearest when far away.
import * as THREE from 'three';

const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const clamp = (v) => Math.max(0, Math.min(255, v));

function make(seed, draw, size = 16) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), r = rng(seed);
  const P = (px, py, hex, j = 0) => {
    const d = j ? (r() - 0.5) * 2 * j : 0, [R, G, B] = rgb(hex);
    x.fillStyle = `rgb(${clamp(R + d)},${clamp(G + d)},${clamp(B + d)})`; x.fillRect(px, py, 1, 1);
  };
  const fill = (hex, j) => { for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) P(px, py, hex, j); };
  draw({ x, r, P, fill, size });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const specks = (g, hex, n, j = 6) => { for (let i = 0; i < n; i++) g.P(Math.floor(g.r() * 16), Math.floor(g.r() * 16), hex, j); };

export function blockTextures(track = (t) => t) {
  const T = {};
  T.grassTop = make(1, (g) => { g.fill(0x62b43a, 14); specks(g, 0x86d24f, 18); specks(g, 0x47932a, 14); });
  T.boardL = make(2, (g) => {
    g.fill(0x62b43a, 14); specks(g, 0x86d24f, 18); specks(g, 0x47932a, 14);
    g.P(3, 11, 0xffffff); g.P(11, 4, 0xffe36a); g.P(12, 13, 0xff9bb5);
  });
  T.boardD = make(3, (g) => {
    g.fill(0x4b515e, 9); specks(g, 0x5d6472, 14); specks(g, 0x3d424e, 10);
    for (let i = 0; i < 16; i++) { g.P(i, 0, 0x333843); g.P(i, 8, 0x333843); g.P(i, 1, 0x5f6675); g.P(i, 9, 0x5f6675); }
    for (let i = 1; i < 8; i++) g.P(0, i, 0x333843);
    for (let i = 9; i < 16; i++) g.P(8, i, 0x333843);
    for (let i = 0; i < 16; i++) g.P(i === 0 ? 15 : 0, 15, 0x333843);
  });
  T.dirt = make(4, (g) => { g.fill(0x8b5a36, 12); specks(g, 0x6b4326, 14); specks(g, 0xa5784f, 12); });
  T.grassSide = make(5, (g) => {
    g.fill(0x8b5a36, 12); specks(g, 0x6b4326, 12); specks(g, 0xa5784f, 10);
    for (let px = 0; px < 16; px++) {
      const h = 3 + Math.floor(g.r() * 3);
      for (let py = 0; py < h; py++) g.P(px, py, 0x62b43a, 14);
      g.P(px, h - 1, 0x47932a, 6);
    }
  });
  T.stone = make(6, (g) => {
    g.fill(0x80848d, 13); specks(g, 0x666a73, 16); specks(g, 0x9a9ea7, 12);
    for (let i = 0; i < 4; i++) { const px = Math.floor(g.r() * 14), py = Math.floor(g.r() * 14); g.P(px, py, 0x5d616a); g.P(px + 1, py, 0x5d616a); g.P(px, py + 1, 0x5d616a); }
  });
  T.plank = make(7, (g) => {
    g.fill(0xc0905a, 7);
    for (let row = 0; row < 4; row++) {
      const y0 = row * 4;
      for (let px = 0; px < 16; px++) { g.P(px, y0, 0x8a6035); g.P(px, y0 + 1, 0xd0a06a, 4); }
      const jx = Math.floor(g.r() * 14) + 1; for (let py = y0; py < y0 + 4; py++) g.P(jx, py, 0x8a6035);
      g.P(1, y0 + 2, 0x5b3d1f); g.P(14, y0 + 2, 0x5b3d1f);
    }
  });
  T.tileL = make(8, (g) => { g.fill(0xdfe2e9, 5); for (let i = 0; i < 16; i++) { g.P(i, 15, 0xbfc4cf); g.P(15, i, 0xbfc4cf); g.P(i, 0, 0xf0f2f6); g.P(0, i, 0xf0f2f6); } });
  T.tileD = make(9, (g) => { g.fill(0xb7bdca, 5); for (let i = 0; i < 16; i++) { g.P(i, 15, 0x969dac); g.P(15, i, 0x969dac); g.P(i, 0, 0xcbd0da); g.P(0, i, 0xcbd0da); } });
  T.water = make(10, (g) => { g.fill(0x3b82e6, 9); for (let i = 0; i < 9; i++) { const px = Math.floor(g.r() * 12), py = Math.floor(g.r() * 16); for (let k = 0; k < 3; k++) g.P(px + k, py, 0x86bdff); } });
  T.waterfall = make(11, (g) => {
    g.fill(0x3f8cee, 7);
    for (let px = 0; px < 16; px++) { if (g.r() < 0.3) { const y0 = Math.floor(g.r() * 12), l = 2 + Math.floor(g.r() * 3); for (let k = 0; k < l; k++) g.P(px, (y0 + k) % 16, 0x6eb0ff, 3); } }
  });
  T.bark = make(12, (g) => { g.fill(0x6a4a2a, 8); for (let px = 0; px < 16; px++) { if (g.r() < 0.45) for (let py = 0; py < 16; py++) if (g.r() < 0.8) g.P(px, py, 0x4d341b, 5); } specks(g, 0x7f5c36, 14); });
  T.barkTop = make(13, (g) => { g.fill(0xb48e58, 6); for (let i = 3; i < 13; i++) { g.P(i, 3, 0x8d6a3c); g.P(i, 12, 0x8d6a3c); g.P(3, i, 0x8d6a3c); g.P(12, i, 0x8d6a3c); } g.P(7, 7, 0x8d6a3c); g.P(8, 8, 0x8d6a3c); });
  T.leaves = make(14, (g) => {
    g.fill(0x44a038, 16); specks(g, 0x2b7625, 22); specks(g, 0x6cc650, 16);
    for (let i = 0; i < 14; i++) g.x.clearRect(Math.floor(g.r() * 16), Math.floor(g.r() * 16), 1, 1);
  });
  T.vox = make(15, (g) => { g.fill(0xf0f0f0, 9); }, 8);
  T.cloud = make(16, (g) => { g.fill(0xffffff, 5); }, 8);
  for (const k in T) track(T[k]);
  return T;
}
