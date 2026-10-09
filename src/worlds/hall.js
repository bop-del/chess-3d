// The torch lit castle hall (CHE-370): a flagstone floor, a nave of stone pillars and pointed arches, stained glass lancets with
// moonlight, heraldic banners, torches with flickering flames and embers, a throne dais at the far end and a great hearth behind.
// Torch light on the stone is computed in the shader (many flickering sources, no real lights); at most 2 PointLights reach the board.
// Tall parts fade out between the camera and the board (a soft cutaway), so a far camera behind a pillar still sees the game.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, skyDome, mat4 } from './kit.js';

const FY = -1.2;          // floor
const PX = 19;            // pillar rows at x = +-PX
const WX = 27;            // side walls
const EZ = 24;            // end walls (throne at -z, hearth at +z)
const CEIL = 17;
const SPRING = 8.6;       // arch springing (capital top)
const PZ = [-21, -15, -9, -3, 3, 9, 15, 21];
const BAYS = [-18, -12, -6, 0, 6, 12, 18];
const FOG = '#2c1e15';

// ---------- textures ----------
function noise(g, w, h, amt, seed) {
  const r = rng(seed), img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
  g.putImageData(img, 0, 0);
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }

/** Flagstones, 6 x 6 units per tile, rows of 1.5 units, soft mortar so the floor stays calm. */
function floorTexture(S) {
  return canvasTexture(S, S, (g) => {
    const r = rng(11), u = S / 4;
    g.fillStyle = '#5a5046'; g.fillRect(0, 0, S, S);
    for (let row = 0; row < 4; row++) {
      const ws = []; let sum = 0;
      while (sum < 4 - 0.7) { const w = 0.8 + r() * 0.9; ws.push(w); sum += w; }
      ws[ws.length - 1] += 4 - sum;
      let x = r() * u;
      for (const w of ws) {
        const k = 0.9 + r() * 0.16, warm = r() < 0.5;
        const base = shade(warm ? '#77706a' : '#6e6c6a', k);
        for (const ox of [0, -S]) {
          const px = x + ox, m = S * 0.006;
          g.fillStyle = base; g.fillRect(px + m, row * u + m, w * u - 2 * m, u - 2 * m);
          const gr = g.createLinearGradient(0, row * u, 0, row * u + u);
          gr.addColorStop(0, 'rgba(255,240,220,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.10)');
          g.fillStyle = gr; g.fillRect(px + m, row * u + m, w * u - 2 * m, u - 2 * m);
          // worn patches and a few hairline cracks
          for (let i = 0; i < 3; i++) {
            const cx = px + (0.2 + r() * 0.6) * w * u, cy = row * u + (0.2 + r() * 0.6) * u, rr = (0.15 + r() * 0.3) * u;
            const rg = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
            rg.addColorStop(0, r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,235,210,0.06)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = rg; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
          }
          if (r() < 0.25) {
            g.strokeStyle = 'rgba(40,30,22,0.35)'; g.lineWidth = Math.max(1, S / 700); g.beginPath();
            let cx = px + r() * w * u, cy = row * u + m; g.moveTo(cx, cy);
            for (let i = 0; i < 5; i++) { cx += (r() - 0.5) * u * 0.25; cy += u * 0.18; g.lineTo(cx, cy); }
            g.stroke();
          }
        }
        x += w * u;
      }
    }
    noise(g, S, S, 16, 5);
  }, { repeat: true });
}

/** Ashlar blocks, 2 x 2 units per tile, rows of 0.5 units, running bond. */
function stoneTexture(S) {
  return canvasTexture(S, S, (g) => {
    const r = rng(23), rows = 4, h = S / rows;
    g.fillStyle = '#5e5248'; g.fillRect(0, 0, S, S);
    for (let row = 0; row < rows; row++) {
      const n = 2 + (row % 2 ? 1 : 0), off = (row % 2) * S / 4;
      const ws = Array.from({ length: n }, () => 0.7 + r() * 0.6); const tot = ws.reduce((a, b) => a + b, 0);
      let x = off;
      for (const w0 of ws) {
        const w = w0 / tot * S, k = 0.84 + r() * 0.24;
        for (const ox of [0, -S]) {
          const m = S * 0.008, px = x + ox;
          g.fillStyle = shade(r() < 0.3 ? '#a29380' : '#988a79', k); g.fillRect(px + m, row * h + m, w - 2 * m, h - 2 * m);
          const gr = g.createLinearGradient(0, row * h, 0, row * h + h);
          gr.addColorStop(0, 'rgba(255,240,220,0.10)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)');
          g.fillStyle = gr; g.fillRect(px + m, row * h + m, w - 2 * m, h - 2 * m);
        }
        x += w;
      }
    }
    noise(g, S, S, 22, 9);
  }, { repeat: true });
}

/** Dark oak planks for the ceiling and its beams. */
function woodTexture(S) {
  return canvasTexture(S, S, (g) => {
    const r = rng(31), n = 6, w = S / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade('#6b4a32', 0.8 + r() * 0.3); g.fillRect(i * w, 0, w, S);
      g.strokeStyle = 'rgba(30,18,10,0.35)'; g.lineWidth = 1;
      for (let k = 0; k < 7; k++) { g.beginPath(); const x0 = i * w + r() * w; g.moveTo(x0, 0); g.bezierCurveTo(x0 + (r() - 0.5) * 8, S * 0.3, x0 + (r() - 0.5) * 8, S * 0.7, x0, S); g.stroke(); }
      g.fillStyle = 'rgba(20,12,6,0.6)'; g.fillRect(i * w, 0, Math.max(1, S / 128), S);
    }
    noise(g, S, S, 14, 4);
  }, { repeat: true });
}

const GOLD = '#e0b040', GOLD_D = '#8a5a17';
function emblem(g, kind) {
  g.save(); g.translate(128, 228);
  g.lineJoin = 'round'; g.strokeStyle = GOLD_D; g.lineWidth = 6; g.fillStyle = GOLD;
  if (kind === 'knight') {
    // a chess knight head in profile, facing left
    g.beginPath(); g.moveTo(-52, 84); g.lineTo(62, 84); g.lineTo(54, 56);
    g.quadraticCurveTo(76, -6, 40, -58); g.lineTo(26, -92); g.lineTo(6, -64);
    g.quadraticCurveTo(-34, -62, -62, -22); g.lineTo(-80, 6); g.quadraticCurveTo(-84, 26, -62, 28);
    g.lineTo(-30, 18); g.quadraticCurveTo(-6, 24, -22, 56); g.lineTo(-52, 64); g.closePath();
    g.stroke(); g.fill();
    g.fillRect(-64, 70, 138, 20); g.strokeRect(-64, 70, 138, 20);
    g.fillStyle = '#3a1608'; g.beginPath(); g.ellipse(-14, -30, 7, 9, 0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(-66, 8, 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = GOLD_D; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(44 - i * 4, -44 + i * 22); g.lineTo(26 - i * 4, -36 + i * 22); g.stroke(); }
  } else if (kind === 'crown') {
    g.beginPath(); g.moveTo(-72, 45); g.lineTo(-80, -40); g.lineTo(-38, 5); g.lineTo(0, -62); g.lineTo(38, 5); g.lineTo(80, -40); g.lineTo(72, 45); g.closePath();
    g.stroke(); g.fill();
    g.fillRect(-74, 40, 148, 28); g.strokeRect(-74, 40, 148, 28);
    for (const [x, y] of [[-80, -40], [0, -62], [80, -40]]) { g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); g.stroke(); }
    for (const [x, c] of [[-44, '#c8202a'], [0, '#2a5bd7'], [44, '#c8202a']]) { g.fillStyle = c; g.beginPath(); g.arc(x, 54, 8, 0, Math.PI * 2); g.fill(); }
  } else if (kind === 'tower') {
    g.beginPath(); g.moveTo(-46, 80); g.lineTo(-40, -30); g.lineTo(-58, -30); g.lineTo(-58, -78);
    for (let i = 0; i < 5; i++) { const x = -58 + i * 29; g.lineTo(x, -78); g.lineTo(x, -100); g.lineTo(x + 14.5, -100); g.lineTo(x + 14.5, -78); }
    g.lineTo(58, -78); g.lineTo(58, -30); g.lineTo(40, -30); g.lineTo(46, 80); g.closePath(); g.stroke(); g.fill();
    g.fillStyle = '#3a1608'; g.beginPath(); g.moveTo(-18, 80); g.lineTo(-18, 40); g.arc(0, 40, 18, Math.PI, 0); g.lineTo(18, 80); g.closePath(); g.fill();
    g.fillRect(-6, -60, 12, 24); g.fillRect(-28, -10, 10, 20); g.fillRect(18, -10, 10, 20);
    g.strokeStyle = GOLD_D; g.lineWidth = 2;
    for (let y = -20; y < 80; y += 18) { g.beginPath(); g.moveTo(-42, y); g.lineTo(42, y); g.stroke(); }
  } else {
    // a friendly lion head: a star mane, a round face, ears, eyes, nose
    g.beginPath();
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, rr = i % 2 ? 66 : 86; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = '#d99a2e'; g.fill(); g.stroke();
    g.fillStyle = GOLD;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 36, -40, 14, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.beginPath(); g.arc(0, 0, 52, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#f6d98a'; g.beginPath(); g.ellipse(0, 22, 26, 20, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a1608';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 19, -8, 6, 8, 0, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(-10, 10); g.lineTo(10, 10); g.lineTo(0, 22); g.closePath(); g.fill();
    g.strokeStyle = '#3a1608'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 22); g.lineTo(0, 28); g.moveTo(-12, 32); g.quadraticCurveTo(0, 40, 12, 32); g.stroke();
  }
  g.restore();
}
const BANNERS = [['#a3161d', 'knight'], ['#1d3a8c', 'tower'], ['#a3161d', 'crown'], ['#1d3a8c', 'knight']];
/** Four banners side by side (256 x 512 each at full size): cloth, gold trim, a swallowtail, an emblem. */
function bannerTexture(k) {
  return canvasTexture(1024 * k, 512 * k, (g) => {
    g.scale(k, k);
    BANNERS.forEach(([col, kind], i) => {
      g.save(); g.translate(i * 256, 0);
      const shape = () => { g.beginPath(); g.moveTo(4, 0); g.lineTo(252, 0); g.lineTo(252, 500); g.lineTo(128, 420); g.lineTo(4, 500); g.closePath(); };
      shape(); const gr = g.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, shade(col, 0.8)); gr.addColorStop(0.35, col); gr.addColorStop(1, shade(col, 0.62)); g.fillStyle = gr; g.fill();
      g.save(); shape(); g.clip();
      g.fillStyle = 'rgba(0,0,0,0.10)'; for (let x = 0; x < 256; x += 6) g.fillRect(x, 0, 2, 512);
      for (const x of [40, 128, 216]) { const fg = g.createLinearGradient(x - 26, 0, x + 26, 0); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(0.5, 'rgba(0,0,0,0.16)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fillRect(x - 26, 0, 52, 512); }
      g.restore();
      g.strokeStyle = GOLD; g.lineWidth = 9; g.beginPath(); g.moveTo(18, 30); g.lineTo(18, 470); g.lineTo(128, 400); g.lineTo(238, 470); g.lineTo(238, 30); g.stroke();
      g.strokeStyle = GOLD_D; g.lineWidth = 2; g.stroke();
      g.fillStyle = GOLD; g.fillRect(4, 0, 248, 24); g.fillStyle = GOLD_D; g.fillRect(4, 22, 248, 3);
      emblem(g, kind);
      g.fillStyle = GOLD; for (const [x, y] of [[10, 494], [246, 494], [128, 416]]) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
      g.restore();
    });
  });
}

/** Four gold emblems on transparent ground (256 x 256 each at full size): knight, tower, crown, knight. */
function emblemTexture(k) {
  return canvasTexture(2048 * k, 256 * k, (g) => {
    g.scale(k, k);
    [0, 1].forEach((med) => ['knight', 'tower', 'crown', 'knight'].forEach((kind, i) => {
      g.save(); g.translate((med * 4 + i) * 256, 0);
      if (med) {   // a dark medallion behind the floor emblems, with a gold rim
        g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(128, 128, 122, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#8a5a17'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.stroke();
        g.translate(128, 128); g.scale(0.72, 0.72); g.translate(-128, -128);
      }
      g.translate(0, -100); emblem(g, kind); g.restore();
    }));
  });
}

const GLASS_BLUE = ['#2456c8', '#3a74e0', '#1a3a98', '#5a86ea', '#2c4fb0'];
/** Stained glass: a lancet (left quarter) and a rose window (right half), lead lines between bright panes. */
function glassTexture(k) {
  return canvasTexture(1024 * k, 512 * k, (g) => {
    g.scale(k, k);
    const r = rng(41);
    g.fillStyle = '#0c0c14'; g.fillRect(0, 0, 1024, 512);
    // lancet: lozenge quarries, a medallion in the middle
    g.save(); g.beginPath(); g.rect(0, 0, 256, 512); g.clip();
    const qw = 44, qh = 64;
    for (let y = -qh; y < 512 + qh; y += qh / 2) for (let x = ((y / (qh / 2)) % 2 ? qw / 2 : 0) - qw; x < 256 + qw; x += qw) {
      const p = r(); g.fillStyle = p < 0.08 ? '#d9a63a' : p < 0.14 ? '#7b3fb8' : p < 0.18 ? '#c03030' : GLASS_BLUE[Math.floor(r() * GLASS_BLUE.length)];
      g.beginPath(); g.moveTo(x, y - qh / 2 + 3); g.lineTo(x + qw / 2 - 3, y); g.lineTo(x, y + qh / 2 - 3); g.lineTo(x - qw / 2 + 3, y); g.closePath(); g.fill();
    }
    for (const [cy, rad] of [[300, 62], [120, 40]]) {
      g.fillStyle = '#0c0c14'; g.beginPath(); g.arc(128, cy, rad + 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e0b040'; g.beginPath(); g.arc(128, cy, rad, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0c0c14'; g.beginPath(); g.arc(128, cy, rad - 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c42a2a'; g.beginPath(); g.arc(128, cy, rad - 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0c0c14';
      for (let i = 0; i < 4; i++) { g.save(); g.translate(128, cy); g.rotate(i * Math.PI / 2 + Math.PI / 4); g.fillRect(-2, 0, 4, rad); g.restore(); }
      g.fillStyle = '#f0d070'; g.beginPath(); g.arc(128, cy, rad * 0.28, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // rose: rings of petals around a golden heart
    g.save(); g.translate(768, 256);
    const ring = (r0, r1, n, cols, off = 0) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i + off) / n * Math.PI * 2 + 0.03, a1 = (i + 1 + off) / n * Math.PI * 2 - 0.03;
        g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(0, 0, r1 - 4, a0, a1); g.arc(0, 0, r0 + 4, a1, a0, true); g.closePath(); g.fill();
      }
    };
    ring(170, 248, 24, ['#2456c8', '#1a3a98', '#3a74e0', '#7b3fb8'], 0.5);
    ring(80, 170, 12, ['#c03030', '#2c4fb0', '#d9a63a', '#2c4fb0']);
    for (let i = 0; i < 12; i++) {   // petal tips
      const a = i / 12 * Math.PI * 2 + Math.PI / 12; g.fillStyle = '#0c0c14'; g.beginPath(); g.arc(Math.cos(a) * 170, Math.sin(a) * 170, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e0b040'; g.beginPath(); g.arc(Math.cos(a) * 170, Math.sin(a) * 170, 16, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#e0b040'; g.beginPath(); g.arc(0, 0, 74, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0c0c14'; g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c42a2a'; g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f0d070'; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
    g.restore();
    noise(g, 1024 * k, 512 * k, 18, 3);
  });
}

/** Red runner with gold borders and a diamond pattern, repeats along its length. */
function carpetTexture(k) {
  return canvasTexture(128 * k, 512 * k, (g) => {
    g.scale(k, k);
    g.fillStyle = '#7a1016'; g.fillRect(0, 0, 128, 512);
    g.fillStyle = '#5a0a0e'; g.fillRect(0, 0, 8, 512); g.fillRect(120, 0, 8, 512);
    g.fillStyle = '#d0a040'; g.fillRect(10, 0, 6, 512); g.fillRect(112, 0, 6, 512);
    g.fillStyle = '#9a1820';
    for (let y = 0; y < 512; y += 64) { g.beginPath(); g.moveTo(64, y + 6); g.lineTo(96, y + 32); g.lineTo(64, y + 58); g.lineTo(32, y + 32); g.closePath(); g.fill(); }
    g.fillStyle = '#c99a3c';
    for (let y = 0; y < 512; y += 64) { g.beginPath(); g.moveTo(64, y + 22); g.lineTo(74, y + 32); g.lineTo(64, y + 42); g.lineTo(54, y + 32); g.closePath(); g.fill(); }
    noise(g, 128 * k, 512 * k, 18, 8);
  }, { repeat: true });
}

// ---------- geometry helpers ----------
/** Planar UVs in world units (scale units per texture tile): tops use x, z; sides run along the face. */
function worldUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(ny) > 0.7) { uv[i * 2] = x / scale; uv[i * 2 + 1] = z / scale; }
    else { const l = Math.hypot(nx, nz) || 1; uv[i * 2] = (x * -nz / l + z * nx / l) / scale; uv[i * 2 + 1] = y / scale; }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
/** Drop the faces that look out of the hall through a wall plane (the camera outside sees through the walls). */
function dropOutward(geo) {
  const p = geo.attributes.position, keep = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    nrm.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3;
    const out = (Math.abs(cx) >= WX - 0.05 && nrm.x * Math.sign(cx) > 0.5) || (Math.abs(cz) >= EZ - 0.05 && nrm.z * Math.sign(cz) > 0.5);
    if (!out) keep.push(i);
  }
  if (keep.length * 3 === p.count) return geo;
  const out = new THREE.BufferGeometry();
  for (const [k, attr] of Object.entries(geo.attributes)) {
    const s = attr.itemSize, arr = new Float32Array(keep.length * 3 * s);
    keep.forEach((i, j) => { arr.set(attr.array.subarray(i * s, (i + 3) * s), j * 3 * s); });
    out.setAttribute(k, new THREE.BufferAttribute(arr, s));
  }
  geo.dispose();
  return out;
}
function paint(geo, hex, jitter = 0, r = null) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, arr = new Float32Array(n * 3);
  const k = jitter && r ? 1 - jitter / 2 + r() * jitter : 1;
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
/** A collector of parts for one merged mesh: add(geometry, matrix, colour), then mesh(material). */
function parts(uvScale = 0) {
  const list = [];
  return {
    add(geo, m, color = '#ffffff', jitter = 0, r = null) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      geo.dispose();
      if (m) g.applyMatrix4(m);
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (uvScale) worldUV(g, uvScale);
      else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g = dropOutward(g);
      paint(g, color, jitter, r);
      list.push(g);
    },
    mesh(material, name) {
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      const m = new THREE.Mesh(geo, material); m.name = name; return m;
    },
    get count() { return list.length; },
  };
}
const flat = (geo) => { const g = geo.toNonIndexed(); geo.dispose(); g.computeVertexNormals(); return g; };
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 8) => flat(new THREE.CylinderGeometry(r0, r1, h, n));
/** Matrix for a unit box (height 1 along y) stretched from a to b. */
function rod(a, b) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
}

/** A pointed (equilateral) arch outline, half width a, springing at ys: points from the left springer over the apex. */
function pointedArch(path, a, ys, cx = 0) {
  path.absarc(cx + a, ys, 2 * a, Math.PI, Math.PI * 2 / 3, true);
  path.absarc(cx - a, ys, 2 * a, Math.PI / 3, 0, true);
}
function lancetShape(a, sill, ys, cx = 0) {
  const s = new THREE.Path(); s.moveTo(cx - a, sill); s.lineTo(cx - a, ys); pointedArch(s, a, ys, cx); s.lineTo(cx + a, sill); s.closePath();
  return s;
}

// ---------- shader injection for the lit hall materials: torch light, cutaway, banner sway ----------
function hallify(m, U, n, { cut = true, sway = false, inlay = false, cutY = -0.5 } = {}) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTorch = U.torch; sh.uniforms.uCam = U.cam; sh.uniforms.uTime = U.time;
    sh.defines = { ...(sh.defines || {}), HALL_N: n };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; varying vec3 vHallP; varying vec3 vHallN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${sway ? `{ float ph = transformed.z * 0.55 + transformed.x * 0.31; float f = pow(1.0 - uv.y, 1.4);
          transformed += objectNormal * f * (0.22 * sin(uTime * 0.85 + ph) + 0.07 * sin(uTime * 2.1 + ph * 1.7 + uv.x * 5.0));
          transformed.y += f * 0.04 * sin(uTime * 1.3 + ph); }` : ''}
        { vec4 hp = vec4(transformed, 1.0); vec3 hn = objectNormal;
          #ifdef USE_INSTANCING
          hp = instanceMatrix * hp; hn = mat3(instanceMatrix) * hn;
          #endif
          vHallP = hp.xyz; vHallN = hn; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec4 uTorch[HALL_N]; uniform vec3 uCam; varying vec3 vHallP; varying vec3 vHallN;
        vec3 hallLight(vec3 p, vec3 nn) {
          vec3 s = vec3(0.0);
          for (int i = 0; i < HALL_N; i++) {
            vec3 d = uTorch[i].xyz - p; float l2 = dot(d, d);
            float ndl = max(dot(nn, d * inversesqrt(l2)), 0.0) * 0.75 + 0.25;
            s += uTorch[i].w * ndl / (1.0 + l2 * 0.1);
          }
          return s * vec3(1.0, 0.52, 0.2) + vec3(0.13, 0.095, 0.07) * (0.6 + 0.4 * smoothstep(-1.0, 12.0, p.y));
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        ${cut ? `if (vHallP.y > ${cutY.toFixed(2)}) {
          float L = length(uCam); vec3 dir = uCam / L; float t = dot(vHallP, dir);
          float e = (length(vHallP - dir * t) - 8.5) / 0.6;
          if (t > 3.0 && t < L && e < 1.0) {
            float hsh = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
            if (e < hsh) discard;
          }
        }` : ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float hallBrass = 0.0;
        ${inlay ? `{ // an inlaid compass ring around the dais: dark bands, a brass line, an eight point star
          float rr = length(vHallP.xz), aa = fwidth(rr) * 1.2 + 0.01;
          float band = smoothstep(7.9 - aa, 7.9 + aa, rr) * (1.0 - smoothstep(8.6 - aa, 8.6 + aa, rr))
                     + smoothstep(11.5 - aa, 11.5 + aa, rr) * (1.0 - smoothstep(12.2 - aa, 12.2 + aa, rr));
          float ang = atan(vHallP.z, vHallP.x) + 3.14159 / 8.0;
          float seg = abs(fract(ang * 8.0 / 6.28318) - 0.5) * 2.0;
          float tip = 8.6 + (1.0 - seg) * 2.0, sd = (tip - rr) * 1.0;
          float star = smoothstep(-aa, aa, sd) * smoothstep(8.6 - aa, 8.6 + aa, rr);
          float line = 1.0 - smoothstep(0.0, 0.025 + aa, min(abs(rr - 8.6), abs(rr - 11.5)));
          float edge = (1.0 - smoothstep(0.03, 0.03 + aa * 2.0, abs(sd))) * step(8.6, rr) * step(rr, 10.7);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.36, 0.34, 0.36), clamp(band, 0.0, 1.0));
          float pi8 = floor(ang * 8.0 / 6.28318), enamel = 1.0 - mod(pi8, 2.0), blue = mod(floor(pi8 * 0.5), 2.0);
          vec3 tintE = mix(vec3(0.155, 0.023, 0.018) * 3.2, vec3(0.019, 0.04, 0.133) * 4.0, blue);   // #6e2a24, #263866 over the stone
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tintE, star * enamel * 0.75);
          diffuseColor.rgb *= 1.0 + 0.15 * star * (1.0 - enamel);
          hallBrass = clamp(line + edge, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.23, 0.08), hallBrass * 0.51);
        }` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += hallLight(vHallP, normalize(vHallN)) * diffuseColor.rgb + vec3(0.62, 0.44, 0.2) * hallBrass * 0.15;`);
  };
  m.customProgramCacheKey = () => `hall${n}${cut ? 'c' + cutY : ''}${sway ? 's' : ''}${inlay ? 'i' : ''}`;
  return m;
}

// ---------- flames, glows, embers (one draw call each) ----------
// the same soft cutaway for points and billboards: 0 inside the cone from the board to the camera, 1 outside
const CUT_GLSL = `uniform vec3 uCam;
  float hallCut(vec3 p) { float L = length(uCam); vec3 d = uCam / L; float t = dot(p, d);
    return (p.y > 1.0 && t > 3.0 && t < L) ? clamp((length(p - d * t) - 8.5) / 0.8, 0.0, 1.0) : 1.0; }`;
const FLAME_VS = `${CUT_GLSL} attribute vec4 iPos; attribute vec4 iPar; uniform float uTime;
  varying vec2 vUv; varying float vPh; varying float vI; varying float vFog;
  void main() {
    vec4 c = modelViewMatrix * vec4(iPos.xyz, 1.0);
    vec3 up = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 right = normalize(cross(up, normalize(-c.xyz)));
    float h = iPos.w, w = h * iPar.y;
    vec3 p = c.xyz + right * position.x * w + up * position.y * h;
    vUv = position.xy; vPh = iPar.x; vI = iPar.z * hallCut(iPos.xyz);
    vFog = 1.0 - 0.6 * smoothstep(22.0, 75.0, -c.z);
    gl_Position = projectionMatrix * vec4(p, 1.0);
  }`;
const FLAME_FS = `uniform float uTime; varying vec2 vUv; varying float vPh; varying float vI; varying float vFog;
  void main() {
    float t = uTime + vPh * 17.0;
    float fl = 0.86 + 0.09 * sin(t * 7.1) + 0.05 * sin(t * 13.7 + 1.3);
    float y = vUv.y / fl;
    float x = vUv.x + (sin(y * 6.0 - t * 8.0) * 0.07 + sin(y * 13.0 - t * 14.0) * 0.03) * y;
    float w = 0.44 * pow(clamp(1.0 - y, 0.0, 1.0), 1.15) * sqrt(clamp(y * 3.0 + 0.3, 0.0, 1.0));
    float d = abs(x) / max(w, 1e-3);
    float body = (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(-0.08, 0.06, y) * (1.0 - smoothstep(0.85, 1.0, y));
    float core = (1.0 - smoothstep(0.0, 0.75, d)) * (1.0 - smoothstep(0.05, 0.7, y));
    vec3 col = mix(vec3(1.0, 0.22, 0.04), vec3(1.0, 0.58, 0.14), smoothstep(0.0, 0.6, core + 0.3 * (1.0 - y)));
    col = mix(col, vec3(1.0, 0.93, 0.7), core * core);
    gl_FragColor = vec4(col * (1.3 + 2.4 * core) * vI * vFog, body);
    if (body < 0.003) discard;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const GLOW_VS = `${CUT_GLSL} attribute vec4 iPos; attribute vec4 iPar; attribute vec3 iCol; uniform float uTime;
  varying vec2 vUv; varying vec3 vCol; varying float vA;
  void main() {
    vec4 c = modelViewMatrix * vec4(iPos.xyz, 1.0);
    c.xy += position.xy * iPos.w;
    vUv = position.xy * 2.0; vCol = iCol;
    float t = uTime + iPar.x * 17.0;
    vA = iPar.z * (1.0 - iPar.y * (0.5 + 0.5 * (0.6 * sin(t * 7.1) + 0.4 * sin(t * 13.7 + 1.3))))
       * (1.0 - 0.6 * smoothstep(22.0, 75.0, -c.z)) * hallCut(iPos.xyz);
    gl_Position = projectionMatrix * c;
  }`;
const GLOW_FS = `varying vec2 vUv; varying vec3 vCol; varying float vA;
  void main() { float d = length(vUv); float a = pow(max(0.0, 1.0 - d), 2.4) * vA; if (a < 0.002) discard;
    gl_FragColor = vec4(vCol * a, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const EMBER_VS = `${CUT_GLSL} attribute vec4 org; attribute vec4 rnd; uniform float uTime, uScale; varying vec3 vCol; varying float vA;
  void main() {
    vec3 p = org.xyz; float a, s;
    if (org.w < 0.5) {
      float P = 2.0 + rnd.x * 2.4, age = fract(uTime / P + rnd.y), rise = 2.4 + rnd.z * 2.2;
      p.xz += (rnd.zw - 0.5) * 0.3;
      p += vec3(sin(age * 5.0 + rnd.w * 6.283) * 0.4 * age, age * rise, cos(age * 4.0 + rnd.x * 6.283) * 0.4 * age);
      a = smoothstep(0.0, 0.08, age) * (1.0 - age) * (0.65 + 0.35 * sin(uTime * 19.0 + rnd.x * 50.0));
      vCol = mix(vec3(1.0, 0.4, 0.08), vec3(1.0, 0.78, 0.35), rnd.w) * 3.0; s = 0.075;
    } else if (org.w < 1.5) {
      float P = 3.0 + rnd.x * 3.0, age = fract(uTime / P + rnd.y);
      p.x += (rnd.z - 0.5) * 3.6; p.z += (rnd.w - 0.5) * 0.8;
      p += vec3(sin(age * 4.0 + rnd.w * 6.283) * 0.5 * age, age * (3.5 + rnd.z * 3.0), cos(age * 3.0 + rnd.x * 6.283) * 0.3 * age);
      a = smoothstep(0.0, 0.06, age) * (1.0 - age) * (0.65 + 0.35 * sin(uTime * 17.0 + rnd.x * 50.0));
      vCol = mix(vec3(1.0, 0.4, 0.08), vec3(1.0, 0.8, 0.4), rnd.w) * 3.0; s = 0.1;
    } else {
      p += vec3(sin(uTime * 0.13 + rnd.x * 6.283) * 0.9, sin(uTime * 0.09 + rnd.y * 6.283) * 1.1, sin(uTime * 0.11 + rnd.z * 6.283) * 0.9);
      a = 0.5 * (0.5 + 0.5 * sin(uTime * 0.6 + rnd.w * 20.0)); vCol = vec3(0.65, 0.8, 1.0) * 1.3; s = 0.07;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vA = a * (1.0 - 0.6 * smoothstep(22.0, 75.0, -mv.z)) * hallCut(p);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = s * (0.6 + 0.8 * rnd.y) * uScale / max(0.1, -mv.z);
  }`;
const EMBER_FS = `varying vec3 vCol; varying float vA;
  void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 1.6) * vA; if (a < 0.003) discard;
    gl_FragColor = vec4(vCol * a, 1.0);
    #include <colorspace_fragment>
  }`;
const SHAFT_VS = `varying vec2 vUv; varying float vFog;
  void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vFog = 1.0 - 0.5 * smoothstep(22.0, 75.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const SHAFT_FS = `uniform float uTime; varying vec2 vUv; varying float vFog;
  void main() {
    float a = sin(vUv.x * 3.14159) * smoothstep(0.0, 0.55, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
    a *= 0.85 + 0.15 * sin(uTime * 0.4 + vUv.x * 9.0 + vUv.y * 4.0);
    gl_FragColor = vec4(vec3(0.5, 0.66, 1.0) * a * 0.13 * vFog, 1.0);
    #include <colorspace_fragment>
  }`;

// coloured light from the stained glass on the floor: a rose window pool (kd 0) and lancet streaks (kd 1)
const POOL_VS = `attribute float kd; varying vec2 vUv; varying float vK;
  void main() { vUv = uv; vK = kd; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const POOL_FS = `uniform float uTime; varying vec2 vUv; varying float vK;
  void main() {
    vec3 col; float a;
    if (vK < 0.5) {
      vec2 p = (vUv - 0.5) * 2.0; float r = length(p), ang = atan(p.y, p.x), aa = fwidth(r) * 1.5;
      float f12 = ang * 12.0 / 6.28318, f24 = ang * 24.0 / 6.28318;
      float l12 = min(fract(f12), 1.0 - fract(f12)) * r * 6.28 / 12.0, l24 = min(fract(f24), 1.0 - fract(f24)) * r * 6.28 / 24.0;
      float ring = min(min(abs(r - 0.28), abs(r - 0.62)), abs(r - 0.94));
      float lead = smoothstep(0.025, 0.025 + aa, ring) * smoothstep(0.02, 0.02 + aa, r < 0.62 ? (r < 0.28 ? 1.0 : l12) : l24);
      vec3 gold = vec3(1.0, 0.72, 0.28), blue = vec3(0.28, 0.48, 1.0), deep = vec3(0.16, 0.3, 0.95);
      col = r < 0.28 ? gold : r < 0.62 ? (mod(floor(f12), 2.0) < 0.5 ? blue : gold * 0.85) : (mod(floor(f24), 2.0) < 0.5 ? blue : deep);
      col *= lead;
      a = 1.0 - smoothstep(0.96 - aa, 0.96 + aa, r);
    } else {
      float band = fract(vUv.y * 5.0);
      col = mix(vec3(0.3, 0.5, 1.0), vec3(0.45, 0.6, 1.0), step(0.5, band));
      col = mix(col, vec3(1.0, 0.7, 0.3), step(0.86, band));
      a = sin(vUv.x * 3.14159) * smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
    }
    a *= 0.12 * (0.85 + 0.15 * sin(uTime * 2.513));
    gl_FragColor = vec4(col * a, 1.0);
    #include <colorspace_fragment>
  }`;

function quadGeo(y0, y1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, y0, 0, 0.5, y0, 0, 0.5, y1, 0, -0.5, y1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
function billboards(list, vs, fs, U, y0, y1, withColor) {
  const base = quadGeo(y0, y1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position);
  const pos = new Float32Array(list.length * 4), par = new Float32Array(list.length * 4), col = new Float32Array(list.length * 3), c = new THREE.Color();
  list.forEach((f, i) => {
    pos.set([...f.p, f.size], i * 4); par.set([f.ph ?? 0, f.w ?? 0.55, f.i ?? 1, 0], i * 4);
    if (withColor) { c.set(f.color); col.set([c.r, c.g, c.b], i * 3); }
  });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 4));
  g.setAttribute('iPar', new THREE.InstancedBufferAttribute(par, 4));
  if (withColor) g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 3));
  g.instanceCount = list.length;
  const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: { uTime: U.time, uCam: U.cam }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
  return mesh;
}

/** Skip a mesh in passes that draw the scene with an override material (the GTAO depth and normal pass): billboards, shafts and
 *  cut away stone would otherwise turn into opaque shapes there. */
function ownPassOnly(mesh, also) {
  mesh.onBeforeRender = (renderer, scene, camera, geometry, material) => {
    const own = material === mesh.material;
    geometry.drawRange.count = own ? Infinity : 0;
    if (own && also) also(renderer, scene, camera);
  };
}

// ---------- the hall ----------
export function build({ lite }) {
  const group = new THREE.Group();
  const r = rng(370);
  const U = { time: { value: 0 }, cam: { value: new THREE.Vector3(0, 10, 20) }, torch: { value: [] } };
  const sources = [];   // fake light sources: { p, base, ph }
  const flames = [], glows = [], embers = [];
  const T = lite ? 256 : 1024;

  // textures and materials
  const floorTex = floorTexture(T); floorTex.repeat.set(WX * 2 / 6, EZ * 2 / 6);
  const stoneTex = stoneTexture(lite ? 256 : 512);
  const woodTex = woodTexture(lite ? 128 : 256);
  const bannerTex = bannerTexture(lite ? 0.25 : 1);
  const glassTex = glassTexture(lite ? 0.25 : 0.5);
  const carpetTex = carpetTexture(lite ? 1 : 2);

  const mats = [];
  const std = (o, h) => { const m = new THREE.MeshStandardMaterial(o); mats.push([m, h]); return m; };
  const stoneMat = std({ map: stoneTex, vertexColors: true, roughness: 0.9, metalness: 0, color: '#9a8670' }, { cut: true });
  const woodMat = std({ map: woodTex, vertexColors: true, roughness: 0.8, metalness: 0, color: '#6a5444' }, { cut: true });
  const propMat = std({ vertexColors: true, roughness: 0.7, metalness: 0.1 }, { cut: true, cutY: 1.0 });
  const goldMat = std({ color: '#d9a640', roughness: 0.32, metalness: 1, vertexColors: true }, { cut: true, cutY: 1.0 });
  const bannerMat = std({ map: bannerTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, color: '#c8c0b8' }, { cut: true, sway: true });
  const floorMat = std({ map: floorTex, bumpMap: lite ? null : floorTex, bumpScale: 0.4, roughness: 0.88, metalness: 0, color: '#7d6c5c' }, { cut: false, inlay: true });
  const carpetMat = std({ map: carpetTex, vertexColors: true, color: '#b09a94', roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, { cut: false });
  const emblemTex = emblemTexture(lite ? 0.25 : 0.5);
  const emblemMat = std({ map: emblemTex, alphaTest: 0.5, color: '#ffffff', roughness: 0.45, metalness: 0.35, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }, { cut: false });
  const glassMat = new THREE.MeshBasicMaterial({ map: glassTex, color: new THREE.Color(1.5, 1.55, 1.75) });

  // sky (seen only past the walls when the camera is far out): the fog colour
  const sky = skyDome({ stops: [[0, FOG], [0.5, FOG], [1, '#1c130e']] });
  group.add(sky);

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WX * 2, EZ * 2).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = FY; floor.receiveShadow = true; floor.name = 'hall-floor';
  group.add(floor);

  const S = parts(2), W = parts(4), P = parts(0), G = parts(0);
  const stoneC = () => (r() < 0.5 ? '#d8c4a6' : '#ccb898');

  // dais under the board
  S.add(box(9.2, 0.26, 9.2), mat4([0, FY + 0.13, 0]), '#b0a594');
  S.add(box(8.7, 0.42, 8.7), mat4([0, FY + 0.26 + 0.21, 0]), '#a69a89');

  // pillars
  const pillar = (x, z) => {
    S.add(box(2.1, 0.45, 2.1), mat4([x, FY + 0.225, z]), '#c8b496');
    S.add(cyl(0.98, 1.05, 0.35, 8), mat4([x, FY + 0.62, z], [0, Math.PI / 8, 0]), '#d0bc9e');
    const h = SPRING - 0.75 - (FY + 0.8);
    S.add(cyl(0.78, 0.8, h, 8), mat4([x, FY + 0.8 + h / 2, z], [0, Math.PI / 8, 0]), stoneC(), 0.1, r);
    if (!lite) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) S.add(cyl(0.17, 0.17, h, 6), mat4([x + dx * 0.8, FY + 0.8 + h / 2, z + dz * 0.8]), '#ccb898');
    S.add(cyl(1.02, 0.8, 0.45, 8), mat4([x, SPRING - 0.75 + 0.225, z], [0, Math.PI / 8, 0]), '#d0bc9e');
    S.add(box(2.1, 0.3, 2.1), mat4([x, SPRING - 0.15, z]), '#c8b496');
  };
  for (const sx of [-1, 1]) {
    for (const z of PZ) pillar(sx * PX, z);
    for (const sz of [-1, 1]) S.add(box(1.2, CEIL - FY, EZ - 21), mat4([sx * (PX + 0.6), (CEIL + FY) / 2, sz * (EZ + 21) / 2]), '#c8b496', 0.1, r);
  }
  // arcade walls with pointed arches, from the springing up to the ceiling, one per bay
  const archHalf = 1.95, thick = 1.2;
  for (const sx of [-1, 1]) for (const bz of BAYS) {
    const sh = new THREE.Shape(); sh.moveTo(-3, SPRING); sh.lineTo(-archHalf, SPRING); pointedArch(sh, archHalf, SPRING); sh.lineTo(3, SPRING); sh.lineTo(3, CEIL); sh.lineTo(-3, CEIL); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: lite ? 5 : 10 });
    S.add(g, mat4([sx * (PX + thick / 2), 0, bz], [0, -Math.PI / 2, 0]), stoneC(), 0.12, r);
    if (!lite) {   // a moulded rib along the arch, standing a little proud
      const rib = new THREE.Shape(); const ro = archHalf + 0.001, ri = archHalf - 0.28;
      rib.moveTo(-ro, SPRING); pointedArch(rib, ro, SPRING); rib.lineTo(ri, SPRING);
      const inner = new THREE.Path(); inner.moveTo(ri, SPRING); inner.absarc(-ri, SPRING, 2 * ri, 0, Math.PI / 3, false); inner.absarc(ri, SPRING, 2 * ri, Math.PI * 2 / 3, Math.PI, false);
      for (const p of inner.getPoints(8)) rib.lineTo(p.x, p.y);
      rib.closePath();
      const rg = new THREE.ExtrudeGeometry(rib, { depth: thick + 0.24, bevelEnabled: false, curveSegments: 10 });
      S.add(rg, mat4([sx * (PX + thick / 2 + 0.12), 0, bz], [0, -Math.PI / 2, 0]), '#cfc2ae');
    }
  }
  // string course above the arches
  for (const sx of [-1, 1]) S.add(box(0.3, 0.35, EZ * 2), mat4([sx * (PX - 0.12), 12.9, 0]), '#b5a996');

  // outer walls with lancet windows (inward facing planes), glass behind, a stone frame around each
  const winA = 0.85, sill = 2.4, wSpring = 9.2;
  const glassParts = [], lancetUV = (g) => {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i));
    return g;
  };
  for (const sx of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(-EZ, FY); sh.lineTo(EZ, FY); sh.lineTo(EZ, CEIL); sh.lineTo(-EZ, CEIL); sh.closePath();
    for (const bz of BAYS) sh.holes.push(lancetShape(winA + 0.22, sill - 0.22, wSpring, bz));
    const g = new THREE.ShapeGeometry(sh, lite ? 4 : 8);
    S.add(g, mat4([sx * WX, 0, 0], [0, -sx * Math.PI / 2, 0]), '#c4b092');
    for (const bz of BAYS) {
      const fr = new THREE.Shape(lancetShape(winA + 0.22, sill - 0.22, wSpring).getPoints(lite ? 5 : 10));
      fr.holes.push(lancetShape(winA, sill, wSpring));
      const fg = new THREE.ExtrudeGeometry(fr, { depth: 0.75, bevelEnabled: false, curveSegments: lite ? 5 : 10 });
      S.add(fg, mat4([sx * (WX + 0.6), 0, bz], [0, -sx * Math.PI / 2, 0]), '#dccaa8');
      // mullion
      S.add(box(0.14, wSpring + 1.2 - sill, 0.14), mat4([sx * (WX + 0.3), (wSpring + 1.2 + sill) / 2, bz]), '#dccaa8');
      const gl = new THREE.PlaneGeometry(winA * 2, wSpring + winA * 1.75 - sill).translate(0, (wSpring + winA * 1.75 + sill) / 2, 0);
      glassParts.push([lancetUV(gl), mat4([sx * (WX + 0.55), 0, bz], [0, -sx * Math.PI / 2, 0])]);
      glows.push({ p: [sx * (WX - 0.3), 6.5, bz], size: 5.5, color: sx < 0 ? '#3a5aa0' : '#4a3a90', ph: 0, w: 0, i: 0.55 });
    }
  }
  // end walls: the throne wall with a rose window, the hearth wall
  const ROSE_Y = 10.6, ROSE_R = 3.3;
  {
    const sh = new THREE.Shape(); sh.moveTo(-WX, FY); sh.lineTo(WX, FY); sh.lineTo(WX, CEIL); sh.lineTo(-WX, CEIL); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, ROSE_Y, ROSE_R + 0.35, 0, Math.PI * 2, true); sh.holes.push(hole);
    S.add(new THREE.ShapeGeometry(sh, lite ? 16 : 32), mat4([0, 0, -EZ]), '#c4b092');
    const ring = new THREE.Shape(); ring.absarc(0, ROSE_Y, ROSE_R + 0.35, 0, Math.PI * 2, false);
    const rh = new THREE.Path(); rh.absarc(0, ROSE_Y, ROSE_R, 0, Math.PI * 2, true); ring.holes.push(rh);
    S.add(new THREE.ExtrudeGeometry(ring, { depth: 0.8, bevelEnabled: false, curveSegments: lite ? 16 : 32 }), mat4([0, 0, -EZ - 0.6]), '#dccaa8');
    const rose = new THREE.PlaneGeometry(ROSE_R * 2, ROSE_R * 2).translate(0, ROSE_Y, 0);
    { const uv = rose.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + uv.getX(i) * 0.5, uv.getY(i)); }
    glassParts.push([rose, mat4([0, 0, -EZ - 0.5])]);
    glows.push({ p: [0, ROSE_Y, -EZ + 0.5], size: 12, color: '#3a50a0', ph: 0, w: 0, i: 0.6 });
    const sh2 = new THREE.Shape(); sh2.moveTo(-WX, FY); sh2.lineTo(WX, FY); sh2.lineTo(WX, CEIL); sh2.lineTo(-WX, CEIL); sh2.closePath();
    S.add(new THREE.ShapeGeometry(sh2), mat4([0, 0, EZ], [0, Math.PI, 0]), '#c4b092');
  }
  // ceiling: dark planks and transverse beams
  W.add(new THREE.PlaneGeometry(WX * 2, EZ * 2).rotateX(Math.PI / 2), mat4([0, CEIL, 0]), '#ffffff');
  for (const z of PZ) W.add(box(WX * 2, 0.8, 0.55), mat4([0, CEIL - 0.4, z]), '#b8a898');
  for (const sx of [-1, 1]) W.add(box(0.55, 0.8, EZ * 2), mat4([sx * (PX + 0.3), CEIL - 0.4, 0]), '#b8a898');

  // throne dais at the far end, braziers either side
  const DZ = -EZ;
  S.add(box(12, 0.3, 5.8), mat4([0, FY + 0.15, DZ + 2.9]), '#b8ac9a');
  S.add(box(9.6, 0.3, 4.6), mat4([0, FY + 0.45, DZ + 2.3]), '#aea290');
  S.add(box(7.2, 0.3, 3.4), mat4([0, FY + 0.75, DZ + 1.7]), '#b8ac9a');
  {
    const ty = FY + 0.9, tz = DZ + 1.6, k = 1.25;
    const T6 = (w, h, d, x, y, z) => mat4([x * k, ty + y * k, tz + z * k], [0, 0, 0], [w * k, h * k, d * k]);
    P.add(box(1, 1, 1), T6(1.9, 0.9, 1.4, 0, 0.45, 0), '#5a2e1a');
    P.add(box(1, 1, 1), T6(1.95, 3.4, 0.35, 0, 1.7, -0.6), '#5a2e1a');
    P.add(box(1, 1, 1), T6(1.5, 0.18, 1.15, 0, 0.99, 0.05), '#9a1820');
    P.add(box(1, 1, 1), T6(1.45, 2.3, 0.06, 0, 2.15, -0.41), '#9a1820');
    for (const s of [-1, 1]) {
      P.add(box(1, 1, 1), T6(0.28, 0.55, 1.4, s * 1.0, 1.15, 0), '#5a2e1a');
      G.add(box(1, 1, 1), T6(0.12, 3.6, 0.12, s * 0.98, 1.8, -0.4), '#ffffff');
      G.add(new THREE.SphereGeometry(0.18, 10, 8), T6(1, 1, 1, s * 1.0, 1.5, 0.62), '#ffffff');
      G.add(new THREE.ConeGeometry(0.16, 0.6, 6), T6(1, 1, 1, s * 0.98, 3.85, -0.4), '#ffffff');
    }
    G.add(box(1, 1, 1), T6(2.0, 0.14, 0.42, 0, 3.45, -0.6), '#ffffff');
    G.add(new THREE.ConeGeometry(0.32, 0.9, 4), T6(1, 1, 1, 0, 3.97, -0.6), '#ffffff');
    G.add(new THREE.SphereGeometry(0.2, 10, 8), T6(1, 1, 1, 0, 4.5, -0.6), '#ffffff');
    // crown on the back
    G.add(new THREE.CylinderGeometry(0.34, 0.3, 0.3, 10, 1, true), T6(1, 1, 1, 0, 2.9, -0.39), '#ffffff');
  }
  const brazier = (bx, bz, n, low = 0, fs = 1) => {
    const FY0 = FY; { const FY = FY0 - low;
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; G.add(box(0.08, 1.7, 0.08), mat4([bx + Math.cos(a) * 0.35, FY + 0.85, bz + Math.sin(a) * 0.35], [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]), '#6a5a4a'); }
    G.add(new THREE.CylinderGeometry(0.75, 0.38, 0.5, 12, 1, true), mat4([bx, FY + 1.75, bz]), '#ffffff');
    P.add(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 12), mat4([bx, FY + 1.9, bz]), '#ff8a30');
    for (let i = 0; i < 3; i++) flames.push({ p: [bx + (i - 1) * 0.3 * fs, FY + 1.88, bz + (i % 2 ? 0.15 : -0.1)], size: (1.1 - (i % 2) * 0.25) * (fs > 1 ? 1.25 : 1), ph: r(), w: 0.6 * fs, i: 1 });
    glows.push({ p: [bx, FY + 2.5, bz], size: fs > 1 ? 4.6 : 4, color: '#ff7a28', ph: r(), w: 0.4, i: 0.55 });
    const src = { p: [bx, FY + 2.6, bz], base: 2.5, ph: r() }; sources.push(src);
    embers.push({ kind: 0, p: [bx, FY + 2.3, bz], n });
    return src; }
  };
  for (const s of [-1, 1]) brazier(s * 5.6, DZ + 6.4, lite ? 10 : 24);

  // the great hearth on the near wall
  {
    const hz = EZ;
    S.add(box(9.6, 0.26, 2.8), mat4([0, FY + 0.13, hz - 1.4]), '#b8ac9a');
    for (const s of [-1, 1]) S.add(box(1.3, 4.6, 1.9), mat4([s * 3.65, FY + 0.26 + 2.3, hz - 0.95]), '#dccaa8');
    S.add(box(9.8, 0.55, 2.3), mat4([0, FY + 4.86 + 0.275, hz - 1.15]), '#cdbfaa');
    S.add(box(8.6, 0.4, 2.0), mat4([0, FY + 4.86 - 0.2, hz - 1.0]), '#b0a491');
    S.add(flat(new THREE.CylinderGeometry(3.4, 4.6, 3.6, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.32)), mat4([0, FY + 5.41 + 1.8, hz - 0.9]), '#b4a896');
    S.add(box(6.0, CEIL - (FY + 9), 1.3), mat4([0, (CEIL + FY + 9) / 2, hz - 0.65]), '#ada18f');
    P.add(box(6.0, 4.6, 0.1), mat4([0, FY + 0.26 + 2.3, hz - 0.15]), '#2a1a12');
    for (const [x, ry, y] of [[-0.5, 0.3, 0.42], [0.5, -0.35, 0.42], [0, 0.05, 0.75]]) P.add(new THREE.CylinderGeometry(0.2, 0.22, 2.6, 8), mat4([x, FY + y, hz - 1.2], [0, ry, Math.PI / 2]), '#3a2418');
    P.add(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 12), mat4([0, FY + 0.3, hz - 1.2]), '#ff7a26');
    // shield above the mantle
    const shp = new THREE.Shape(); shp.moveTo(-0.9, 0.9); shp.lineTo(0.9, 0.9); shp.lineTo(0.9, 0); shp.quadraticCurveTo(0.8, -0.8, 0, -1.2); shp.quadraticCurveTo(-0.8, -0.8, -0.9, 0); shp.closePath();
    G.add(new THREE.ExtrudeGeometry(shp, { depth: 0.12, bevelEnabled: false }), mat4([0, FY + 7.4, hz - 1.6], [0, Math.PI, 0], 1.25), '#ffffff');
    P.add(new THREE.ExtrudeGeometry(shp, { depth: 0.12, bevelEnabled: false }), mat4([0, FY + 7.45, hz - 1.65], [0, Math.PI, 0], 1.05), '#1d3a8c');
    for (let i = 0; i < 5; i++) flames.push({ p: [(i - 2) * 0.5, FY + 0.5, hz - 1.25 + (i % 2) * 0.2], size: 2.6 - Math.abs(i - 2) * 0.45, ph: r(), w: 0.6, i: 1.1 });
    glows.push({ p: [0, FY + 1.6, hz - 1.6], size: 10, color: '#ff6a20', ph: 0.3, w: 0.35, i: 0.7 });
    sources.push({ p: [0, FY + 1.4, hz - 2.4], base: 7, ph: 0.3 });
    embers.push({ kind: 1, p: [0, FY + 0.8, hz - 1.3], n: lite ? 40 : 120 });
    if (!lite) for (let i = 0; i < 6; i++) {   // candles on the mantle
      const x = (i < 3 ? -1 : 1) * (2.3 + (i % 3) * 0.75), h = 0.5 + (i % 3) * 0.15;
      P.add(new THREE.CylinderGeometry(0.08, 0.09, h, 8), mat4([x, FY + 5.41 + h / 2, hz - 1.4]), '#eadcc0');
      flames.push({ p: [x, FY + 5.41 + h, hz - 1.4], size: 0.28, ph: r(), w: 0.5, i: 1 });
      glows.push({ p: [x, FY + 5.41 + h + 0.12, hz - 1.4], size: 0.9, color: '#ff9a40', ph: r(), w: 0.3, i: 0.6 });
    }
  }

  // torches on the inner faces of the pillars
  const torchZ = lite ? [-15, -3, 3, 15] : PZ;
  const torchY = FY + 5.3;
  for (const sx of [-1, 1]) for (const z of torchZ) {
    const fx = sx * (PX - 0.8);
    const tip = [fx - sx * 0.62, torchY + 0.72, z];
    P.add(box(0.06, 0.6, 0.3), mat4([fx - sx * 0.03, torchY, z]), '#2a2420');
    P.add(box(0.5, 0.07, 0.07), mat4([fx - sx * 0.25, torchY - 0.05, z], [0, 0, sx * 0.5]), '#2a2420');
    P.add(new THREE.CylinderGeometry(0.06, 0.045, 0.9, 6), mat4([fx - sx * 0.5, torchY + 0.18, z], [0, 0, sx * 0.25]), '#4a3020');
    P.add(new THREE.CylinderGeometry(0.15, 0.09, 0.22, 8, 1, true), mat4([tip[0] + sx * 0.03, tip[1] - 0.1, z], [0, 0, sx * 0.25]), '#2a2420');
    P.add(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 8), mat4([tip[0] + sx * 0.03, tip[1] - 0.02, z]), '#ff8a30');
    const ph = r();
    flames.push({ p: [tip[0], tip[1] - 0.05, z], size: 1.0, ph, w: 0.5, i: 1 });
    glows.push({ p: [tip[0], tip[1] + 0.35, z], size: 3.6, color: '#ff8a34', ph, w: 0.45, i: 0.6 });
    sources.push({ p: [tip[0] - sx * 0.6, tip[1] + 0.3, z], base: 2.5, ph });
    embers.push({ kind: 0, p: [tip[0], tip[1] + 0.35, z], n: lite ? 5 : 12 });
  }

  // four low braziers around the board (the far pair lights it), a heraldic row between them
  const farBraziers = [-1, 1].map((s) => brazier(s * 9.5, -8.5, lite ? 10 : 24, 0.5, 1.3));
  for (const s of [-1, 1]) brazier(s * 10, 8, lite ? 10 : 24);
  const emb = [];   // emblem decals: [slot, matrix]
  const facing = (x, z) => Math.atan2(-x, -z);
  const shield = (x, z, col, slot) => {
    const ry = facing(x, z);
    P.add(box(0.12, 1.0, 0.12), mat4([x, FY + 0.5, z]), '#3a2a1e');
    P.add(box(0.7, 0.08, 0.5), mat4([x, FY + 0.04, z], [0, ry, 0]), '#3a2a1e');
    const shp = new THREE.Shape(); shp.moveTo(-0.9, 0.9); shp.lineTo(0.9, 0.9); shp.lineTo(0.9, 0); shp.quadraticCurveTo(0.8, -0.8, 0, -1.2); shp.quadraticCurveTo(-0.8, -0.8, -0.9, 0); shp.closePath();
    const m = mat4([x, FY + 1.15, z], [0, ry, 0]);
    G.add(new THREE.ExtrudeGeometry(shp, { depth: 0.08, bevelEnabled: false }), m.clone().multiply(mat4([0, 0, 0.02], [0, 0, 0], 0.6)), '#ffffff');
    P.add(new THREE.ExtrudeGeometry(shp, { depth: 0.08, bevelEnabled: false }), m.clone().multiply(mat4([0, 0.01, 0.06], [0, 0, 0], 0.53)), col);
    emb.push([slot, m.clone().multiply(mat4([0, 0.05, 0.145], [0, 0, 0], 0.62))]);
  };
  const chest = (x, z) => {
    const ry = facing(x, z), m = (p, rr = [0, 0, 0], sc = 1) => mat4([x, FY, z], [0, ry, 0]).multiply(mat4(p, rr, sc));
    P.add(box(1.1, 0.55, 0.7), m([0, 0.275, 0]), '#6a4022');
    P.add(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12), m([0, 0.55, 0], [0, 0, Math.PI / 2], [1, 1, 0.55]), '#7a4a28');
    for (const bx of [-0.36, 0.36]) P.add(box(0.08, 0.76, 0.74), m([bx, 0.4, 0]), '#2a2420');
    G.add(box(0.16, 0.2, 0.06), m([0, 0.45, 0.36]), '#ffffff');
  };
  shield(-12.9, -3.6, '#8a1a1e', 0);
  shield(12.9, -3.6, '#1d3a8c', 1);
  shield(-12.9, 3.6, '#1d3a8c', 2);
  chest(12.9, 3.6);
  chest(-5.4, -11.8);
  {   // a sleeping hound curled on a round rug
    const x = 5.4, z = -11.8, ry = facing(x, z), m = (p, rr = [0, 0, 0], sc = 1) => mat4([x, FY, z], [0, ry, 0]).multiply(mat4(p, rr, sc));
    const k = 1.4, d = (p, rr, sc) => m(p.map((v) => v * k), rr, typeof sc === 'number' ? sc * k : (sc || [1, 1, 1]).map((v) => v * k));
    P.add(new THREE.CylinderGeometry(1.25, 1.25, 0.03, 24), m([0, 0.015, 0]), '#6a1a1e');
    P.add(new THREE.CylinderGeometry(1.0, 1.0, 0.034, 24), m([0, 0.016, 0]), '#7e2228');
    const fur = '#8a5a32', dark = '#3a2414';
    P.add(new THREE.SphereGeometry(1, 16, 12), d([-0.1, 0.27, -0.05], [0, 0, 0], [0.72, 0.27, 0.45]), fur);
    P.add(new THREE.SphereGeometry(0.31, 14, 10), d([0.42, 0.3, 0.38]), '#5a3a20');
    P.add(box(0.28, 0.16, 0.24), d([0.42, 0.22, 0.68]), '#b08050');
    P.add(new THREE.SphereGeometry(0.055, 8, 6), d([0.42, 0.3, 0.8]), '#1a1010');
    for (const e of [-1, 1]) P.add(box(0.08, 0.3, 0.2), d([0.42 + e * 0.3, 0.22, 0.36], [0, 0, e * 0.45]), dark);
    P.add(new THREE.TorusGeometry(0.62, 0.07, 6, 16, Math.PI * 0.9).rotateX(-Math.PI / 2), d([-0.15, 0.08, 0.02], [0, Math.PI * 1.05, 0]), fur);
  }
  emb.push(...[0, 1, 2, 3].map((slot, i) => {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 9.5, z = Math.sin(a) * 9.5;
    return [slot + 4, mat4([x, FY + 0.006, z], [0, Math.atan2(-Math.cos(a), -Math.sin(a)), 0]).multiply(mat4([0, 0, 0], [-Math.PI / 2, 0, 0], 2.6))];
  }));

  // chandeliers over the nave (full only)
  if (!lite) for (const cz of [-19, 19]) {
    const cy = 10.4;
    const ring = new THREE.TorusGeometry(1.7, 0.07, 6, 24).rotateX(Math.PI / 2);
    P.add(ring, mat4([0, cy, cz]), '#2a2420');
    P.add(new THREE.TorusGeometry(0.9, 0.05, 6, 16).rotateX(Math.PI / 2), mat4([0, cy + 0.6, cz]), '#2a2420');
    P.add(box(0.06, CEIL - cy, 0.06), mat4([0, (CEIL + cy) / 2, cz]), '#2a2420');
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; P.add(box(0.04, 1, 0.04), rod([Math.cos(a) * 1.7, cy, cz + Math.sin(a) * 1.7], [0, cy + 2.4, cz]), '#2a2420'); }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 1.7, z = cz + Math.sin(a) * 1.7;
      P.add(new THREE.CylinderGeometry(0.07, 0.08, 0.4, 6), mat4([x, cy + 0.27, z]), '#eadcc0');
      flames.push({ p: [x, cy + 0.47, z], size: 0.32, ph: r(), w: 0.5, i: 1 });
      glows.push({ p: [x, cy + 0.6, z], size: 1.1, color: '#ffa048', ph: r(), w: 0.3, i: 0.6 });
    }
    sources.push({ p: [0, cy + 0.2, cz], base: 1.6, ph: r() });
  }

  // banners: in the arcade openings and two great ones on the throne wall; gold rods above
  const bParts = [];
  const banner = (slot, w, h, m) => {
    const g = new THREE.PlaneGeometry(w, h, 4, 12).translate(0, -h / 2, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (slot + 0.02 + uv.getX(i) * 0.96) / 4);
    g.applyMatrix4(m); bParts.push(g);
  };
  let slot = 0;
  for (const sx of [-1, 1]) for (const bz of [-12, 0, 12]) {
    const top = 10.6;
    banner(slot++ % 4, 2.2, 6.2, mat4([sx * PX, top, bz], [0, -sx * Math.PI / 2, 0]));
    G.add(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), mat4([sx * PX, top + 0.05, bz], [Math.PI / 2, 0, 0]), '#ffffff');
    for (const s of [-1, 1]) G.add(new THREE.SphereGeometry(0.11, 8, 6), mat4([sx * PX, top + 0.05, bz + s * 1.42]), '#ffffff');
  }
  for (const s of [-1, 1]) {
    banner(s < 0 ? 0 : 2, 2.8, 8.4, mat4([s * 6.3, 15.2, -EZ + 0.5]));
    G.add(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), mat4([s * 6.3, 15.25, -EZ + 0.5], [0, 0, Math.PI / 2]), '#ffffff');
  }
  const bannerGeo = mergeGeometries(bParts, false); for (const g of bParts) g.dispose();
  const banners = new THREE.Mesh(bannerGeo, bannerMat); banners.name = 'hall-banners';

  // carpet runners: from the board to the throne, and on the near side towards the hearth, gold fringes at the ends
  const cParts = [];
  for (const [z0, z1, w, k] of [[-7.0, DZ + 6, 3.0, 1], [7.0, 13.0, 2.2, 0.75]]) {
    const len = Math.abs(z1 - z0), g = new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2).translate(0, FY + 0.003, (z0 + z1) / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / 12);
    paint(g, new THREE.Color(k, k, k).getHex()); cParts.push(g);
    for (const z of [z0, z1]) G.add(box(w, 0.012, 0.14), mat4([0, FY + 0.006, z]), '#ffffff');
  }
  const carpet = new THREE.Mesh(mergeGeometries(cParts, false), carpetMat); carpet.name = 'hall-carpet';
  for (const g of cParts) g.dispose();
  const emblems = new THREE.Mesh(mergeGeometries(emb.map(([slot, m]) => {
    const g = new THREE.PlaneGeometry(1, 1); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (slot + uv.getX(i)) / 8);
    return g.applyMatrix4(m);
  }), false), emblemMat); emblems.name = 'hall-emblems';
  {   // coloured light from the glass on the floor
    const pp = [];
    const quad = (kd, m) => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).applyMatrix4(m); g.setAttribute('kd', new THREE.BufferAttribute(new Float32Array(4).fill(kd), 1)); pp.push(g); };
    for (const s of [-1, 1]) quad(0, mat4([s * 2.95, FY + 0.012, -10.7], [0, 0, 0], [2.9, 1, 2.9]));
    for (const z of [-5, -1, 3, 7]) quad(1, mat4([-11.6, FY + 0.012, z], [0, -0.45, 0], [0.9, 1, 5.0]));
    const pool = new THREE.Mesh(mergeGeometries(pp, false), new THREE.ShaderMaterial({ vertexShader: POOL_VS, fragmentShader: POOL_FS, uniforms: { uTime: U.time }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    for (const g of pp) g.dispose();
    pool.name = 'hall-glasslight'; group.add(pool);
  }

  group.add(S.mesh(stoneMat, 'hall-stone'), W.mesh(woodMat, 'hall-wood'), P.mesh(propMat, 'hall-props'), G.mesh(goldMat, 'hall-gold'), banners, carpet, emblems);
  {
    const gg = mergeGeometries(glassParts.map(([g, m]) => g.applyMatrix4(m)), false); for (const [g] of glassParts) g.dispose();
    const glass = new THREE.Mesh(gg, glassMat); glass.name = 'hall-glass'; group.add(glass);
  }

  // moonlight shafts through the left windows (full only)
  let shafts = null;
  if (!lite) {
    const verts = [], uvs = [], idx = [];
    for (const bz of BAYS) for (const [y0, x1, wd] of [[10.5, -16.5, 1.0], [5.0, -20.5, 0.8]]) {
      const b = verts.length / 3, x0 = -WX + 0.2, dz = 1.4;
      verts.push(x0, y0, bz - wd, x0, y0, bz + wd, x1, FY, bz + wd * 1.5 + dz, x1, FY, bz - wd * 1.5 + dz);
      uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    shafts = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS, uniforms: { uTime: U.time }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    shafts.name = 'hall-shafts'; shafts.frustumCulled = false; group.add(shafts);
  }

  // flames, glows, embers and dust in the moonlight
  const flameMesh = billboards(flames, FLAME_VS, FLAME_FS, U, -0.1, 1.0, false); flameMesh.name = 'hall-flames'; flameMesh.renderOrder = 2; flameMesh.userData.shaderPlaced = true;
  const glowMesh = billboards(glows, GLOW_VS, GLOW_FS, U, -0.5, 0.5, true); glowMesh.name = 'hall-glows'; glowMesh.renderOrder = 1; glowMesh.userData.shaderPlaced = true;
  group.add(glowMesh, flameMesh);
  {
    const motes = lite ? 60 : 260;
    const total = embers.reduce((a, e) => a + e.n, 0) + motes;
    const org = new Float32Array(total * 4), rnd = new Float32Array(total * 4), pos = new Float32Array(total * 3);
    let k = 0;
    const put = (x, y, z, kind) => { org.set([x, y, z, kind], k * 4); rnd.set([r(), r(), r(), r()], k * 4); pos.set([x, y, z], k * 3); k++; };
    for (const e of embers) for (let i = 0; i < e.n; i++) put(...e.p, e.kind);
    for (let i = 0; i < motes; i++) put(-WX + 2 + r() * 7.5, 0.5 + r() * 9, -26 + r() * 52, 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('org', new THREE.BufferAttribute(org, 4)); g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 4));
    const m = new THREE.ShaderMaterial({ vertexShader: EMBER_VS, fragmentShader: EMBER_FS, uniforms: { uTime: U.time, uCam: U.cam, uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.name = 'hall-embers'; pts.userData.shaderPlaced = true;
    const v2 = new THREE.Vector2();
    pts.onBeforeRender = (renderer) => { m.uniforms.uScale.value = renderer.getDrawingBufferSize(v2).y * 0.5 / Math.tan(17.5 * Math.PI / 180); };
    group.add(pts);
  }

  // fake light sources for the shaders, and the cutaway camera (in the hall's own coordinates)
  U.torch.value = sources.map((s) => new THREE.Vector4(...s.p, s.base));
  for (const [m, h] of mats) hallify(m, U, sources.length, h);
  const camV = new THREE.Vector3();
  ownPassOnly(sky, (renderer, scene, camera) => { camV.setFromMatrixPosition(camera.matrixWorld); group.worldToLocal(camV); U.cam.value.copy(camV); });
  group.traverse((o) => { if (o.isMesh && o !== sky && o !== floor) ownPassOnly(o); });

  // two real lights: torch spill that touches the board (none in lite)
  const lights = [];
  if (!lite) for (const sx of [-1, 1]) {
    const b = farBraziers[(sx + 1) / 2]; const L = new THREE.PointLight('#ff9a50', 0, 0, 2); L.position.set(b.p[0], b.p[1] + 0.3, b.p[2]); L.userData.ph = b.ph;
    group.add(L); lights.push(L);
  }

  const flick = (t, ph) => { const q = t + ph * 17; return 0.86 + 0.09 * Math.sin(q * 7.1) + 0.05 * Math.sin(q * 13.7 + 1.3); };
  return {
    group,
    look: { fog: FOG, near: 3, far: 52 },
    update(dt, t) {
      U.time.value = t;
      const tv = U.torch.value;
      for (let i = 0; i < sources.length; i++) tv[i].w = sources[i].base * flick(t, sources[i].ph);
      for (const L of lights) L.intensity = 22 * flick(t, L.userData.ph);
    },
  };
}
