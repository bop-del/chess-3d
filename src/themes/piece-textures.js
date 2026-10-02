// Procedural piece textures for the themes. Built on the first pick of a theme, freed by its dispose().
import * as THREE from 'three';

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Wood with the grain along v (the lathe uv: u runs round the piece, v runs up). Periodic in u, so there is no seam.
// size 512 on High, 256 on Low and Medium. Returns a texture to use as map with colour #ffffff.
export function pieceWood(base, streak, amount, rings = 9, size = 512) {
  seed = 12345;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const W = size, H = size;
  const img = g.createImageData(W, H), b = hex(base), s = hex(streak);
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const col = new Float32Array(W);
  for (let x = 0; x < W; x++) col[x] = rnd();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const warp = 0.012 * Math.sin(6.283 * (2 * v) + ph[0]) + 0.008 * Math.sin(6.283 * (5 * v) + ph[1]);
    const uu = u + warp;
    let t = 0.5 + 0.5 * Math.sin(6.283 * (rings * uu) + 1.6 * Math.sin(6.283 * 3 * uu + ph[2]) + ph[3]);
    t = Math.pow(t, 1.8) * 0.8 + (col[x] - 0.5) * 0.18;
    t = Math.max(0, Math.min(1, t * amount));
    const i = (y * W + x) * 4;
    img.data[i] = b[0] + (s[0] - b[0]) * t; img.data[i + 1] = b[1] + (s[1] - b[1]) * t; img.data[i + 2] = b[2] + (s[2] - b[2]) * t; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Texture size by quality tier.
export const texSize = (quality) => (quality === 'high' ? 512 : 256);
