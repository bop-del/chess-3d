// Zen garden at golden hour (CHE-370): raked gravel around a dark timber dais, moss islands and smooth rocks, a still pond with
// koi and lily pads under a red arched bridge, stone lanterns with warm windows, sakura trees, woods and layered hills in a
// peach and lavender haze, petals drifting down and fireflies over the water.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, glowTexture, particles, tick, mergeMesh, mat4 } from './kit.js';

const FLOOR_Y = -1.2;
const GROUND_R = 22;
const DEG = Math.PI / 180;
const WARM = '#ffeadb';   // golden hour: lit albedos lean warm
const DUSK = '#e2bea4';   // the gravel at dusk

// the pond: a crescent around the board, u along the arc (radius POND_R), v across it
const POND_R = 14.5, POND_A = -90 * DEG, POND_U = 8.5, WAIST_U = -4.2;
const pondW = (u) => {
  const e = 1 - (u / POND_U) ** 2;
  if (e <= 0) return 0;
  return Math.max(0, 2.7 * Math.sqrt(e) * (1 - 0.45 * Math.exp(-(((u - WAIST_U) / 1.0) ** 2))) + 0.25 * Math.sin(u * 1.7 + 1) * Math.sqrt(e));
};
const pondXZ = (u, v) => { const a = POND_A + u / POND_R, r = POND_R + v; return [r * Math.cos(a), r * Math.sin(a)]; };
const toPond = (x, z) => {
  let a = Math.atan2(z, x) - POND_A;
  if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI;
  return [a * POND_R, Math.hypot(x, z) - POND_R];
};
const polar = (deg, r) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG)];
const WATER_Y = FLOOR_Y + 0.035;
// an inlet reaches from the pond toward the board behind its far edge; the bridge crosses it side on to the play camera
// (inner bank narrower than the outer one; the inlet sits off the board's centre line, 23 degrees to the right)
const INLET_U = 5.8, BRIDGE_V = -3.0;
const tongue = (u) => 2.5 * Math.exp(-(((u - INLET_U) / 1.0) ** 4));
const pondWi = (u) => 0.75 * pondW(u) + tongue(u);
const pondDist = (u, v) => Math.abs(u) < POND_U ? (v < 0 ? -v - pondWi(u) : v - pondW(u)) : Math.hypot(Math.abs(u) - POND_U, v) + 0.1;

// smooth value noise in 3D from a few sines (cheap, deterministic), for lumpy rocks, moss and blossom crowns
function wobble(seed) {
  const r = rng(seed), k = [];
  for (let i = 0; i < 4; i++) k.push([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, r() * 6.283, 1.2 + r() * 2.2]);
  return (x, y, z) => { let s = 0; for (const [a, b, c, p, f] of k) s += Math.sin((a * x + b * y + c * z) * f + p); return s / 4; };
}

/** A lumpy sphere: indexed (smooth normals), radius 1, displaced by amp. */
function blob(detail, seed, amp) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const n = wobble(seed), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + amp * n(x, y, z);
    p.setXYZ(i, x * d, y * d, z * d);
  }
  g.computeVertexNormals();
  return g;
}

/** Prepare a part for mergeMesh: transform, drop uv, colour every vertex with fn(x, y, z, nx, ny, nz, color) or a hex. */
const _c = new THREE.Color(), _n = new THREE.Vector3(), _g = new THREE.Color('#3a5229');
function part(geo, m, col) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (m) g.applyMatrix4(m);
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, nr = g.attributes.normal, a = new Float32Array(p.count * 3);
  if (typeof col !== 'function') _c.set(col);
  for (let i = 0; i < p.count; i++) {
    if (typeof col === 'function') { _n.fromBufferAttribute(nr, i); col(p.getX(i), p.getY(i), p.getZ(i), _n.x, _n.y, _n.z, _c); }
    a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** A tube along curve whose radius tapers from r0 to r1 (trunks and branches). */
function taperTube(curve, r0, r1, seg, rad) {
  const fr = curve.computeFrenetFrames(seg, false), pos = [], nor = [], idx = [], P = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = r0 + (r1 - r0) * t;
    curve.getPointAt(t, P);
    for (let j = 0; j <= rad; j++) {
      const a = j / rad * Math.PI * 2;
      n.copy(fr.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a)).normalize();
      pos.push(P.x + n.x * r, P.y + n.y * r, P.z + n.z * r); nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a = i * (rad + 1) + j, b = a + rad + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// ---- the layout ----
const ROCKS = [   // x, z, radius on the ground, height, seed
  [...polar(148, 10.9), 0.95, 0.85, 1], [...polar(154, 11.9), 0.6, 0.5, 2], [...polar(142, 11.8), 0.45, 0.32, 3],
  [...polar(213, 10.4), 0.8, 0.62, 4], [...polar(219, 11.3), 0.5, 0.38, 5],
  [...polar(328, 13.0), 0.85, 1.55, 6], [...polar(334, 12.7), 0.5, 0.5, 7],
  [...polar(40, 11.2), 0.6, 0.5, 8], [...polar(46, 11.6), 0.38, 0.3, 9],
  [...polar(12, 13.2), 0.7, 0.9, 10], [...polar(186, 14.8), 0.7, 1.1, 11],
];
const MOSS = [    // x, z, rx, rz, height (moss mounds around the rock groups and by the pond)
  [...polar(149, 11.5), 1.8, 1.4, 0.3], [...polar(216, 10.9), 1.6, 1.2, 0.26], [...polar(330, 13.0), 1.8, 1.4, 0.3],
  [...polar(42, 11.4), 1.1, 0.9, 0.22], [...polar(12, 13.3), 1.6, 1.3, 0.28], [...polar(186, 14.9), 1.7, 1.4, 0.32],
  [...pondXZ(-9.0, 0.5), 1.8, 1.6, 0.32], [...pondXZ(9.2, -0.4), 1.6, 1.4, 0.3],
];
const LANTERNS = [  // x, z, scale
  [...pondXZ(-9.3, 0.3), 1.15], [...pondXZ(9.5, 0.6), 1.15], [...polar(162, 14.6), 1.1], [...polar(205, 15.2), 1.15], [...polar(62, 14.2), 1.05],
];
const SHRUBS = [  // x, z, radius, height, azalea (pink blooms)
  [...polar(120, 15.2), 1.1, 0.85, 1], [...polar(128, 16.2), 0.8, 0.6, 0], [...polar(176, 16.0), 1.0, 0.9, 0],
  [...polar(200, 15.4), 0.9, 0.7, 1], [...polar(236, 16.4), 1.2, 1.0, 0], [...polar(272, 18.9), 1.0, 0.8, 1],
  [...polar(300, 18.4), 1.1, 0.9, 0], [...polar(58, 14.8), 0.9, 0.7, 1], [...polar(25, 16.4), 1.0, 0.9, 0],
  [...polar(96, 18.6), 1.3, 1.1, 0], [...polar(78, 19.4), 1.0, 0.8, 1], [...polar(300, 19.0), 1.2, 1.2, 1],
];
const TREES = [   // angle, radius, seed, size, near (branches only outward, crowns stay beyond radius 17)
  [72, 25, 11, 1.0], [116, 23.5, 12, 0.95], [160, 26, 13, 1.1], [203, 23.5, 14, 1.0], [236, 25.5, 15, 1.08],
  [312, 24.5, 16, 0.95], [338, 23.5, 17, 1.05], [12, 24, 18, 1.0], [42, 27, 19, 1.1],
  [248, 19.2, 20, 1.0, 1], [271, 19.8, 21, 1.1, 1], [293, 19.2, 22, 0.95, 1],
];

// ---- the gravel ground: one canvas painted from distance fields, raked lines follow the nearest feature ----
function sdBox(x, z, h, r) {
  const qx = Math.abs(x) - h + r, qz = Math.abs(z) - h + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}
function groundTextures(N, M) {
  const S = GROUND_R * 2, r = rng(91), noise = wobble(33);
  // smooth fields on an M x M grid: raked distance f, moss amount, pond distance, moss shade. The raked lines are drawn in the
  // shader (the same distance field, exact per pixel); a small texture says where gravel is, the albedo canvas holds the rest.
  const F = [new Float32Array(M * M), new Float32Array(M * M), new Float32Array(M * M), new Float32Array(M * M)];
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const x = -GROUND_R + (i + 0.5) / M * S, z = -GROUND_R + (j + 0.5) / M * S, rr = Math.hypot(x, z);
    let f = sdBox(x, z, 4.75, 0.7);
    for (const [rx, rz, rad] of ROCKS) f = Math.min(f, Math.hypot(x - rx, z - rz) - rad - 0.25);
    let m = -1;
    for (const [mx, mz, ax, az] of MOSS) {
      const e = Math.hypot((x - mx) / ax, (z - mz) / az);
      m = Math.max(m, 1 - e); f = Math.min(f, (e - 1.05) * Math.min(ax, az));
    }
    m += noise(x * 2.1, 0, z * 2.1) * 0.12;
    const [pu, pv] = toPond(x, z), pd = pondDist(pu, pv);
    f = Math.min(f, pd - 0.45);
    const lawn = Math.min(1, Math.max(0, (rr - 18.2) / 2.2)) + noise(x * 0.9, 1, z * 0.9) * 0.25 * (rr > 17 ? 1 : 0);
    const k = j * M + i;
    F[0][k] = f; F[1][k] = Math.max(Math.min(1, Math.max(0, m * 6)), Math.min(1, Math.max(0, lawn))); F[2][k] = pd;
    F[3][k] = 0.5 + 0.5 * noise(x * 5, 2, z * 5);
  }
  const data = new Uint8Array(M * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
    const k = j * M + i, o = (M - 1 - j) * M + i;   // data row 0 is the far +z edge (v = 0)
    data[o] = Math.round(255 * (1 - F[1][k]) * Math.min(1, Math.max(0, (F[2][k] - 0.1) / 0.3)));
  }
  const field = new THREE.DataTexture(data, M, M, THREE.RedFormat, THREE.UnsignedByteType);
  field.magFilter = field.minFilter = THREE.LinearFilter; field.needsUpdate = true;

  const albedo = canvasTexture(N, N, (g) => {
    const img = g.createImageData(N, N), d = img.data;
    const gravel = [172, 170, 172], moss = [70, 86, 56], mossDark = [46, 58, 40], bed = [30, 40, 48], wet = [88, 84, 80];
    const at = (A, gx, gy) => {
      const i0 = Math.max(0, Math.min(M - 2, Math.floor(gx))), j0 = Math.max(0, Math.min(M - 2, Math.floor(gy)));
      const fx = Math.max(0, Math.min(1, gx - i0)), fy = Math.max(0, Math.min(1, gy - j0)), k = j0 * M + i0;
      return (A[k] * (1 - fx) + A[k + 1] * fx) * (1 - fy) + (A[k + M] * (1 - fx) + A[k + M + 1] * fx) * fy;
    };
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const gx = (px + 0.5) / N * M - 0.5, gy = (py + 0.5) / N * M - 0.5;
      const mk = at(F[1], gx, gy), pd = at(F[2], gx, gy);
      const x = -GROUND_R + (px + 0.5) / N * S, z = -GROUND_R + (py + 0.5) / N * S;
      const shade = 1 + (r() - 0.5) * 0.06;
      let c0 = gravel[0] * shade, c1 = gravel[1] * shade, c2 = gravel[2] * shade;
      if (r() < 0.012) { c0 *= 0.86; c1 *= 0.86; c2 *= 0.88; }
      // moss islands and the lawn beyond the garden
      if (mk > 0) {
        const t = at(F[3], gx, gy) + (r() - 0.5) * 0.3;
        const mc0 = moss[0] + (mossDark[0] - moss[0]) * t, mc1 = moss[1] + (mossDark[1] - moss[1]) * t, mc2 = moss[2] + (mossDark[2] - moss[2]) * t;
        c0 += (mc0 - c0) * mk; c1 += (mc1 - c1) * mk; c2 += (mc2 - c2) * mk;
      }
      // the pond: a dark bed with a wet band of pebbles
      if (pd < 0.35) {
        const kk = Math.min(1, (0.35 - pd) / 0.3), q = 0.8 + r() * 0.4;
        c0 += (wet[0] * q - c0) * kk; c1 += (wet[1] * q - c1) * kk; c2 += (wet[2] * q - c2) * kk;
        if (pd < 0) { const b = Math.min(1, -pd / 0.4); c0 += (bed[0] - c0) * b; c1 += (bed[1] - c1) * b; c2 += (bed[2] - c2) * b; }
      }
      // fallen petals
      if (r() < (x * x + z * z > 225 ? 0.012 : 0.004) * N / 1024) { c0 = 245; c1 = 176 + r() * 30; c2 = 196 + r() * 20; }
      const i = (py * N + px) * 4;
      d[i] = c0; d[i + 1] = c1; d[i + 2] = c2; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  return { albedo, field };
}

/** The gravel material: lit albedo, raked grooves from the distance field computed per pixel (they fade to their mean where finer
 *  than a pixel), only where the gravel mask says so. */
function gravelMaterial(albedo, mask, sp, gc) {
  const mat = new THREE.MeshLambertMaterial({ map: albedo, color: DUSK });
  const rocks = ROCKS.map(([x, z, rad]) => new THREE.Vector3(x, z, rad + 0.25));
  const moss = MOSS.map(([x, z, ax, az]) => new THREE.Vector4(x, z, ax, az));
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { mask: { value: mask }, sp: { value: sp }, gc: { value: gc }, gamp: { value: gc > 0.2 ? 0.05 : 0 }, rocks: { value: rocks }, moss: { value: moss } });
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D mask; uniform float sp, gc, gamp; uniform vec3 rocks[${rocks.length}]; uniform vec4 moss[${moss.length}];
        float pondW(float u) {
          float e = 1.0 - (u / ${POND_U.toFixed(3)}) * (u / ${POND_U.toFixed(3)});
          if (e <= 0.0) return 0.0;
          float se = sqrt(e), q = (u - ${WAIST_U.toFixed(3)});
          return max(0.0, 2.7 * se * (1.0 - 0.45 * exp(-q * q)) + 0.25 * sin(u * 1.7 + 1.0) * se);
        }
        float rakeField(vec2 p) {
          vec2 q = abs(p) - vec2(4.75 - 0.7);
          float f = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.7;
          for (int i = 0; i < ${rocks.length}; i++) f = min(f, length(p - rocks[i].xy) - rocks[i].z);
          for (int i = 0; i < ${moss.length}; i++) f = min(f, (length((p - moss[i].xy) / moss[i].zw) - 1.05) * min(moss[i].z, moss[i].w));
          float a = atan(p.y, p.x) - (${POND_A.toFixed(5)});
          a = mod(a + PI, 2.0 * PI) - PI;
          float u = a * ${POND_R.toFixed(1)}, v = length(p) - ${POND_R.toFixed(1)};
          float pd = abs(u) < ${POND_U.toFixed(3)} ? (v < 0.0 ? -v - 0.75 * pondW(u) - 2.5 * exp(-pow(u - ${INLET_U.toFixed(2)}, 4.0)) : v - pondW(u)) : length(vec2(abs(u) - ${POND_U.toFixed(3)}, v)) + 0.1;
          return min(f, pd - 0.45);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float gw = texture2D(mask, vMapUv).r;
          if (gw > 0.003) {
            vec2 p = vec2(vMapUv.x * 2.0 - 1.0, 1.0 - vMapUv.y * 2.0) * ${GROUND_R.toFixed(1)};
            float ph = rakeField(p) / sp, aa = smoothstep(0.15, 0.45, fwidth(ph));
            float rp = 0.5 + 0.5 * cos(6.2831853 * ph), groove = mix(rp * rp * rp, 0.3125, aa);
            float side = sin(6.2831853 * ph) * (1.0 - aa);
            vec2 gp = floor(vMapUv * 2600.0);
            float grain = fract(sin(dot(gp, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
            float ga = gamp * (1.0 - clamp(fwidth(vMapUv.x * 2600.0) - 0.5, 0.0, 1.0)) * (1.0 - smoothstep(0.0, 0.05, fwidth(ph) - 0.15));
            diffuseColor.rgb *= mix(1.0, (1.0 + 0.32 * gc - gc * groove + 0.05 * side) * (1.0 + grain * ga), gw);
            diffuseColor.rgb *= 1.0 - 0.25 * smoothstep(10.0, 21.0, length(p));
          }
        }`);
  };
  mat.customProgramCacheKey = () => 'zen-gravel';
  return mat;
}

// ---- the sky: a dusk gradient, a low sun and drifting cloud streaks ----
const SUN = new THREE.Vector3(-0.97, 0.12, -0.2).normalize();
function sky() {
  const stops = [[0.40, '#b98a92'], [0.5, '#f39a6a'], [0.535, '#f0a07c'], [0.6, '#d68fa2'], [0.74, '#8c79ae'], [1.0, '#3a3a78']];
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      cols: { value: stops.map(([, c]) => new THREE.Color(c)) }, pos: { value: stops.map(([p]) => p) }, time: { value: 0 },
      sunDir: { value: SUN }, sunCol: { value: new THREE.Color('#ffd49a') },
      cloudLit: { value: new THREE.Color('#ffc69a') }, cloudShade: { value: new THREE.Color('#9c7398') },
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 cols[6]; uniform float pos[6]; uniform float time; uniform vec3 sunDir, sunCol, cloudLit, cloudShade; varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = cols[0];
        for (int i = 1; i < 6; i++) c = mix(c, cols[i], smoothstep(pos[i - 1], pos[i], h));
        float s = max(dot(d, sunDir), 0.0);
        if (d.y > 0.0) {
          vec2 q = d.xz / (d.y + 0.09);
          q = vec2(q.x * 0.55 + q.y * 0.2, q.y * 1.6 - q.x * 0.3) + vec2(time * 0.012, time * 0.004);
          float n = fbm(q * 0.7);
          float m = smoothstep(0.52, 0.8, n) * smoothstep(0.015, 0.1, d.y) * (1.0 - smoothstep(0.3, 0.62, d.y));
          vec3 cl = mix(cloudShade, cloudLit, clamp(pow(s, 4.0) * 1.2 + 0.25 * (1.0 - d.y * 2.0), 0.0, 1.0));
          c = mix(c, cl, m * 0.7);
        }
        c += sunCol * (smoothstep(0.9993, 0.9996, s) * 1.6 + pow(s, 90.0) * 0.5 + pow(s, 8.0) * 0.22);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(120, 48, 24), mat);
  mesh.name = 'sky'; mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}

// ---- the pond water: dark, reflects the sky at grazing angles, slow ripples and a few expanding rings ----
function water(lite) {
  const geo = new THREE.BufferGeometry(), pos = [], idx = [], NU = lite ? 48 : 80, NV = 10;
  for (let i = 0; i <= NU; i++) {
    const u = -POND_U + (i / NU) * 2 * POND_U, w = Math.max(pondW(u), 0.02) + 0.12, wi = 0.75 * w + tongue(u);
    for (let j = 0; j <= NV; j++) { const [x, z] = pondXZ(u, -wi + (j / NV) * (w + wi)); pos.push(x, WATER_Y, z); }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const drops = [pondXZ(-4.2, 0.6), pondXZ(0.4, -0.9), pondXZ(5.2, 0.4), pondXZ(-1.8, 1.2)].map(([x, z]) => new THREE.Vector2(x, z));
  const mat = new THREE.ShaderMaterial({
    transparent: true, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, deep: { value: new THREE.Color(lite ? '#33646f' : '#2b5a66') }, skyLo: { value: new THREE.Color('#f0a07c') },
      skyHi: { value: new THREE.Color('#7a6aa6') }, sunDir: { value: SUN }, sunCol: { value: new THREE.Color('#ffcf8a') },
      drops: { value: drops },
    }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; uniform vec3 deep, skyLo, skyHi, sunDir, sunCol; uniform vec2 drops[4]; varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vW.xz;
        vec2 g = vec2(cos(p.x * 1.7 + time * 0.8) + 0.6 * cos(p.x * 2.9 - p.y * 2.1 + time * 1.3),
                      cos(p.y * 1.4 - time * 0.7) + 0.6 * cos(p.y * 3.3 + p.x * 1.9 - time * 1.1)) * 0.035;
        for (int i = 0; i < 4; i++) {
          float ph = fract(time * 0.16 + float(i) * 0.27);
          vec2 dd = p - drops[i]; float dl = length(dd) + 1e-4;
          float ring = exp(-pow((dl - ph * 2.6) * 5.0, 2.0)) * (1.0 - ph);
          g += dd / dl * ring * sin(dl * 22.0 - time * 5.0) * 0.22;
        }
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vW);
        float fres = 0.06 + 0.94 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 r = reflect(-v, n);
        vec3 c = mix(deep, skyLo, 0.42 * smoothstep(0.3, 0.85, fres));   // a warm sheen only where the view grazes (the far edge)
        c += sunCol * pow(max(dot(r, sunDir), 0.0), 160.0) * 2.5;
        gl_FragColor = vec4(c, 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pond'; mesh.renderOrder = 1;
  return mesh;
}

// ---- a stone lantern (toro): stone parts and the glowing firebox ----
function lantern(x, z, s, stone, glow) {
  const M = (y, geo, sx = 1, sy = 1, sz = 1, ry = 0) => [geo, mat4([x, FLOOR_Y + y * s, z], [0, ry, 0], [sx * s, sy * s, sz * s])];
  const sc = (x0, y0, z0, nx, ny, nz, c) => c.set('#9a948b').multiplyScalar(0.85 + 0.15 * ny + 0.08 * Math.sin(y0 * 9 + x0 * 3));
  const hex = (r, h) => new THREE.CylinderGeometry(r, r, h, 6);
  stone.push(
    part(...M(0.08, hex(0.44, 0.16)), sc), part(...M(0.2, hex(0.32, 0.1)), sc),
    part(...M(0.52, new THREE.CylinderGeometry(0.13, 0.16, 0.56, 8)), sc),
    part(...M(0.85, new THREE.CylinderGeometry(0.4, 0.3, 0.12, 6)), sc),
    part(...M(1.38, new THREE.CylinderGeometry(0.62, 0.66, 0.05, 6)), sc),
    part(...M(1.56, new THREE.ConeGeometry(0.6, 0.32, 6)), sc),
    part(...M(1.74, new THREE.SphereGeometry(0.08, 8, 6)), sc), part(...M(1.83, new THREE.ConeGeometry(0.05, 0.12, 6)), sc),
  );
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2;
    stone.push(part(new THREE.BoxGeometry(0.07, 0.42, 0.07), mat4([x + Math.cos(a) * 0.3 * s, FLOOR_Y + 1.12 * s, z + Math.sin(a) * 0.3 * s], [0, -a, 0], s), sc));
  }
  glow.push(part(...M(1.12, new THREE.CylinderGeometry(0.27, 0.27, 0.4, 6)), '#ffffff'));
}

// ---- the red arched bridge over the pond's waist ----
function bridge(parts) {
  // spans along the pond's arc (u) over the inlet; kept below y = 0.5 (it stands at radius about 9)
  const L = 4.6, n = 14, W = 1.15, arch = (x) => FLOOR_Y + 0.06 + 0.9 * (1 - (2 * x / L) ** 2);
  const [bx, bz] = pondXZ(INLET_U, BRIDGE_V), ba = POND_A + INLET_U / POND_R;
  const base = mat4([bx, 0, bz], [0, -(ba + Math.PI / 2), 0]);
  const add = (geo, x0, y0, x1, y1, z, col, dy = 0) => {
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.03, m = mat4([(x0 + x1) / 2, (y0 + y1) / 2 + dy, z], [0, 0, Math.atan2(y1 - y0, x1 - x0)]);
    parts.push(part(geo(len), base.clone().multiply(m), col));
  };
  const red = '#c8392c', redDark = '#8e2620', wood = (i) => (i % 2 ? '#6a4632' : '#5b3b2a');
  for (let i = 0; i < n; i++) {
    const x0 = -L / 2 + i * L / n, x1 = x0 + L / n;
    add((l) => new THREE.BoxGeometry(l, 0.08, W), x0, arch(x0), x1, arch(x1), 0, wood(i));
    for (const z of [-W / 2 - 0.02, W / 2 + 0.02]) {
      add((l) => new THREE.BoxGeometry(l, 0.2, 0.1), x0, arch(x0), x1, arch(x1), z, redDark, -0.11);
      add((l) => new THREE.BoxGeometry(l, 0.07, 0.09), x0, arch(x0), x1, arch(x1), z, red, 0.48);
      add((l) => new THREE.BoxGeometry(l, 0.04, 0.05), x0, arch(x0), x1, arch(x1), z, red, 0.25);
    }
  }
  for (let i = 0; i <= n; i += 2) {
    const x = -L / 2 + i * L / n, end = i === 0 || i === n;
    for (const z of [-W / 2 - 0.02, W / 2 + 0.02]) {
      const h = end ? 0.68 : 0.56;
      parts.push(part(new THREE.BoxGeometry(0.11, h, 0.11), base.clone().multiply(mat4([x, arch(x) + h / 2 - 0.05, z])), red));
      if (end || i === n / 2 || i === n / 2 - 1) {
        parts.push(part(new THREE.SphereGeometry(0.085, 10, 8), base.clone().multiply(mat4([x, arch(x) + h - 0.02, z], [0, 0, 0], [1, 1.25, 1])), '#d8a74a'));
      }
    }
  }
  // posts into the water under the arch
  for (const x of [-1.15, 1.15]) for (const z of [-W / 2 + 0.05, W / 2 - 0.05]) {
    const top = arch(x) - 0.12;
    parts.push(part(new THREE.CylinderGeometry(0.07, 0.07, top - FLOOR_Y, 8), base.clone().multiply(mat4([x, (top + FLOOR_Y) / 2, z])), redDark));
  }
}

// ---- a sakura tree: a dark curving trunk, branches and big pink blossom crowns ----
function tree(angle, radius, seed, size, near, trunks, crowns, blossoms, lite) {
  const r = rng(seed), [bx, bz] = polar(angle, radius), base = new THREE.Vector3(bx, FLOOR_Y - 0.2, bz), s = size;
  const lean = near ? angle * DEG + (r() - 0.5) * 0.5 : r() * Math.PI * 2, lx = Math.cos(lean), lz = Math.sin(lean);
  const pts = [0, 1.3, 2.6, 3.7].map((y, i) => new THREE.Vector3(base.x + lx * i * 0.35 * s + (r() - 0.5) * 0.4, base.y + y * s, base.z + lz * i * 0.35 * s + (r() - 0.5) * 0.4));
  const trunk = new THREE.CatmullRomCurve3(pts);
  const bark = (x, y, z, nx, ny, nz, c) => c.set('#3a2a2a').multiplyScalar(0.8 + 0.3 * Math.max(0, ny) + 0.1 * Math.sin(y * 7 + x * 3));
  trunks.push(part(taperTube(trunk, 0.4 * s, 0.17 * s, lite ? 6 : 10, lite ? 5 : 7), null, bark));
  const tips = [pts[3]];
  const nb = lite ? 4 : 6;
  for (let b = 0; b < nb; b++) {
    const t = 0.5 + 0.45 * (b / nb), P = trunk.getPointAt(t), a = near ? lean + ((b + 0.5) / nb - 0.5) * 2.2 + (r() - 0.5) * 0.3 : lean + (b / nb) * Math.PI * 2 + r() * 0.8, len = (1.8 + r() * 1.2) * s;
    const E = new THREE.Vector3(P.x + Math.cos(a) * len, P.y + (0.9 + r() * 1.2) * s, P.z + Math.sin(a) * len);
    const Mid = new THREE.Vector3((P.x + E.x) / 2, P.y + (E.y - P.y) * 0.25, (P.z + E.z) / 2);
    trunks.push(part(taperTube(new THREE.CatmullRomCurve3([P, Mid, E]), 0.16 * s, 0.05 * s, lite ? 4 : 6, 5), null, bark));
    tips.push(E);
  }
  // the crown: many small clumps in a wide, flat cloud around each branch tip, each clump its own shade of pink
  const pink = new THREE.Color('#f5a3c0'), light = new THREE.Color('#ffe0ea'), deep = new THREE.Color('#9a4068');
  const n = wobble(seed + 100);
  const geo = blob(lite ? 0 : 1, seed, 0.45);
  for (const E of tips) {
    // a darker core behind the clumps closes the sky gaps
    crowns.push(part(geo, mat4([E.x, E.y - 0.15 * s, E.z], [r() * 3, r() * 3, 0], [0.95 * s, 0.6 * s, 0.95 * s]), (x, y, z, nx, ny, nz, c) => c.set('#b0587c').multiplyScalar(0.75 + 0.3 * Math.max(0, ny))));
    const k = lite ? 8 : 16;
    for (let i = 0; i < k; i++) {
      const rad = (lite ? 0.42 : 0.3) * (1 + r() * 0.5) * s, a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1.0 * s;
      const p = [E.x + Math.cos(a) * d, E.y + (r() - 0.35) * 0.85 * s - d * 0.2, E.z + Math.sin(a) * d];
      const k0 = r() * 0.12 - 0.06;
      const col = (x, y, z, nx, ny, nz, c) => {
        if (ny < 0) { c.copy(deep).lerp(pink, Math.max(0, 1 + ny * 1.6) * 0.6 + k0); return; }
        const t = Math.max(0, Math.min(1, 0.45 + 0.6 * ny + k0 + 0.1 * n(x * 2.3, y * 2.3, z * 2.3)));
        if (t < 0.5) c.copy(deep).lerp(pink, 0.6 + t * 0.8); else c.copy(pink).lerp(light, (t - 0.5) * 2);
      };
      crowns.push(part(geo, mat4(p, [r() * 3, r() * 3, 0], [rad * (1 + r() * 0.3), rad * 0.6 * (1 + r() * 0.4), rad]), col));
      if (blossoms && r() < 0.62) for (let q = 0; q < 1; q++) {
        const u = r() * Math.PI * 2, v = Math.acos(1 - r() * 1.3);
        blossoms.push(p[0] + Math.sin(v) * Math.cos(u) * rad * 1.25, p[1] + Math.cos(v) * rad * 1.0, p[2] + Math.sin(v) * Math.sin(u) * rad * 1.25);
      }
    }
  }
  geo.dispose();
}

export function build({ lite, quality }) {
  const group = new THREE.Group();
  const R = rng(370);
  const keep = (m) => m;

  group.add(sky());

  // ground: the painted gravel disc, then a lawn ring out to the haze
  const gtex = groundTextures(lite ? 256 : 1024, 256);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_R, 96).rotateX(-Math.PI / 2), gravelMaterial(gtex.albedo, gtex.field, 0.48, lite ? 0.15 : 0.3));
  ground.position.y = FLOOR_Y; ground.receiveShadow = true; ground.name = 'gravel';
  group.add(ground);
  const lawn = new THREE.Mesh(new THREE.RingGeometry(GROUND_R, 150, 96, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: new THREE.Color('#34492b').multiply(new THREE.Color(WARM)) }));
  lawn.position.y = FLOOR_Y; lawn.name = 'lawn';
  group.add(lawn);

  // the dais under the board: dark timber on a stone foot
  const dais = [];
  dais.push(part(new THREE.BoxGeometry(8.9, 0.6, 8.9), mat4([0, FLOOR_Y + 0.38, 0]), '#3a2a20'));
  dais.push(part(new THREE.BoxGeometry(8.96, 0.1, 8.96), mat4([0, FLOOR_Y + 0.05, 0]), '#6f675d'));
  for (let i = 0; i < 9; i++) for (const sgn of [-1, 1]) {
    const c = i % 2 ? '#47332a' : '#3e2c22';
    dais.push(part(new THREE.BoxGeometry(0.9, 0.6, 0.02), mat4([-4 + i, FLOOR_Y + 0.38, sgn * 4.455]), c));
    dais.push(part(new THREE.BoxGeometry(0.02, 0.6, 0.9), mat4([sgn * 4.455, FLOOR_Y + 0.38, -4 + i]), c));
  }
  const daisMesh = mergeMesh(dais, keep(new THREE.MeshLambertMaterial({ vertexColors: true, color: WARM })), 'dais');
  daisMesh.receiveShadow = true;
  group.add(daisMesh);

  // stones: rocks, pond edge pebbles, stepping stones, lanterns
  const stone = [], glow = [];
  const rockCol = (seed) => { const n = wobble(seed); return (x, y, z, nx, ny, nz, c) => c.set('#676a70').multiplyScalar(0.72 + 0.34 * Math.max(0, ny) + 0.12 * n(x * 3, y * 3, z * 3)); };
  for (const [x, z, rad, h, seed] of ROCKS) {
    const g = blob(lite ? 2 : 3, seed, 0.22);
    stone.push(part(g, mat4([x, FLOOR_Y + h * 0.35, z], [0, seed, 0.1], [rad, h * 0.75, rad * 0.85]), rockCol(seed)));
    g.dispose();
  }
  const pebble = blob(1, 5, 0.25);
  for (let u = -POND_U - 0.3; u <= POND_U + 0.3; u += lite ? 0.95 : 0.62) {
    for (const sgn of [-1, 1]) {
      const w = sgn > 0 ? pondW(u) : pondWi(u), [x, z] = pondXZ(u, sgn * (w + 0.25 + R() * 0.1)), s = 0.2 + R() * 0.17;
      if (w < 0.05 && sgn > 0) continue;
      stone.push(part(pebble, mat4([x, FLOOR_Y + 0.03, z], [0, R() * 6, 0], [s * 1.2, s * 0.55, s]), rockCol(u * 10 + sgn)));
    }
  }
  for (const [x, z, ax, az] of MOSS) {
    const k = 3 + Math.floor(R() * 3);
    for (let i = 0; i < k; i++) {
      const a = R() * Math.PI * 2, e = 0.92 + R() * 0.15, s = 0.12 + R() * 0.12;
      if (Math.abs(x + Math.cos(a) * ax * e) < 7.5 && Math.abs(z + Math.sin(a) * az * e) < 7.1) continue;   // the capture areas stay clear
      stone.push(part(pebble, mat4([x + Math.cos(a) * ax * e, FLOOR_Y + 0.02, z + Math.sin(a) * az * e], [0, R() * 6, 0], [s * 1.2, s * 0.6, s]), rockCol(i + x)));
    }
  }
  pebble.dispose();
  const step = blob(2, 44, 0.12);
  for (let k = 0; k < 3; k++) {
    const [sx, sz] = pondXZ(INLET_U - 2.75 - k * 0.6, BRIDGE_V - 0.15 - k * 0.42), s = 0.34 + R() * 0.08;
    stone.push(part(step, mat4([sx, FLOOR_Y + 0.02, sz], [0, R() * 3, 0], [s * 1.15, 0.07, s]), rockCol(40 + k)));
  }
  step.dispose();
  for (const [x, z, s] of LANTERNS) lantern(x, z, s, stone, glow);
  const stoneMesh = mergeMesh(stone, keep(new THREE.MeshLambertMaterial({ vertexColors: true, color: WARM })), 'stones');
  stoneMesh.castShadow = true; stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  const winMat = keep(new THREE.MeshBasicMaterial({ vertexColors: true }));
  winMat.color.setRGB(3.4, 1.8, 0.65);
  group.add(mergeMesh(glow, winMat, 'lantern-glow'));

  // moss mounds and pruned shrubs (karikomi), some with azalea blooms
  const green = [], shrubBloom = [];
  const mossCol = (seed) => { const n = wobble(seed); return (x, y, z, nx, ny, nz, c) => c.set('#45573a').multiplyScalar(0.72 + 0.32 * Math.max(0, ny) + 0.2 * n(x * 4, y * 4, z * 4)); };
  const mound = blob(lite ? 2 : 3, 77, 0.22);
  for (const [x, z, ax, az, h] of MOSS) green.push(part(mound, mat4([x, FLOOR_Y - 0.02, z], [0, 0, 0], [ax * 0.95, h, az * 0.95]), mossCol(x)));
  mound.dispose();
  for (const [x, z, rad, h, az] of SHRUBS) {
    const g = blob(lite ? 1 : 2, Math.round(x * 13), 0.14), n = wobble(Math.round(z * 7));
    // dark green, the azaleas dotted with a few pink blossoms (a vertex speckle, plus blossom points on full)
    const col = (px, py, pz, nx, ny, nz, c) => {
      c.set('#3e5a34').multiplyScalar(0.7 + 0.45 * Math.max(0, ny) + 0.12 * n(px * 3, py * 3, pz * 3));
      if (az && !lite && ny > -0.1 && n(px * 11, py * 11, pz * 11) > 0.42) c.set('#e48aa8').multiplyScalar(0.8 + 0.3 * ny);
    };
    green.push(part(g, mat4([x, FLOOR_Y + h * 0.42, z], [0, 0, 0], [rad, h * 0.62, rad * 0.9]), col));
    if (az && !lite) for (let k = 0; k < 14; k++) {
      const u = R() * Math.PI * 2, v = Math.acos(1 - R() * 1.2);
      shrubBloom.push(x + Math.sin(v) * Math.cos(u) * rad * 1.02, FLOOR_Y + h * 0.42 + Math.cos(v) * h * 0.62 * 1.02, z + Math.sin(v) * Math.sin(u) * rad * 0.92);
    }
    g.dispose();
  }
  // a low clipped hedge closing the garden at radius 20 to 21
  {
    const prof = [[20.05, -1.3], [20.0, -0.95], [20.2, -0.75], [20.8, -0.75], [21.0, -0.95], [20.95, -1.3]].map(([x, y]) => new THREE.Vector2(x, y));
    const hedge = new THREE.LatheGeometry(prof, lite ? 96 : 200), hp = hedge.attributes.position, hn = wobble(61);
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      if (y > -1.0) hp.setY(i, y + 0.12 * hn(x * 0.35, 0, z * 0.35) + 0.05 * hn(x * 1.3, 1, z * 1.3));
    }
    hedge.computeVertexNormals();
    const hc = (x, y, z, nx, ny, nz, c) => c.set('#34502f').multiplyScalar(0.62 + 0.5 * Math.max(0, ny) + 0.14 * hn(x * 2, y * 2, z * 2));
    green.push(part(hedge, null, hc));
    hedge.dispose();
    const lump = blob(lite ? 0 : 1, 62, 0.3), nl = lite ? 80 : 130;
    for (let k = 0; k < nl; k++) {
      const a = (k + R() * 0.5) / nl * Math.PI * 2, rr = 20.5 + (R() - 0.5) * 0.25;
      green.push(part(lump, mat4([Math.cos(a) * rr, FLOOR_Y + 0.5 + R() * 0.08, Math.sin(a) * rr], [0, R() * 3, 0], [0.75 + R() * 0.2, 0.36 + R() * 0.08, 0.62]), hc));
    }
    lump.dispose();
  }
  const greenMesh = mergeMesh(green, keep(new THREE.MeshLambertMaterial({ vertexColors: true, color: WARM })), 'moss');
  greenMesh.receiveShadow = true;
  group.add(greenMesh);

  // the pond, koi and lily pads
  const pond = water(lite);
  group.add(pond);
  const lily = [];
  const pad = new THREE.CircleGeometry(1, 16, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2);
  const nPads = 24;
  for (let k = 0, tries = 0; k < nPads && tries < 400; tries++) {
    const u = (R() * 2 - 1) * (POND_U - 0.8), w = pondW(u);
    if (w < 0.9) continue;
    const v = R() < 0.5 ? R() * (w - 0.45) : -R() * (0.75 * w - 0.45), [x, z] = pondXZ(u, v), s = 0.22 + R() * 0.16;
    const shade = 0.75 + R() * 0.35;
    lily.push(part(pad, mat4([x, WATER_Y + 0.012, z], [0, R() * 6.3, 0], [s, 1, s]), (px, py, pz, nx, ny, nz, c) => c.set('#4f7d3a').multiplyScalar(shade)));
    if (k % 4 === 1) {
      for (let p = 0; p < 6; p++) {
        const a = p / 6 * Math.PI * 2;
        lily.push(part(new THREE.SphereGeometry(0.06, 6, 4), mat4([x + Math.cos(a) * 0.06, WATER_Y + 0.07, z + Math.sin(a) * 0.06], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], [0.8, 1.6, 0.8]), '#ffc2d6'));
      }
      lily.push(part(new THREE.SphereGeometry(0.035, 6, 4), mat4([x, WATER_Y + 0.1, z]), '#ffd86a'));
    }
    k++;
  }
  pad.dispose();
  group.add(mergeMesh(lily, keep(new THREE.MeshLambertMaterial({ vertexColors: true, color: WARM })), 'lilies'));

  let koi = null;
  const KOI = [];
  if (!lite) {
    const body = [
      part(new THREE.SphereGeometry(1, 10, 6), mat4([0, 0, 0], [0, 0, 0], [0.075, 0.035, 0.24]), '#ffffff'),
      part(new THREE.ConeGeometry(0.07, 0.16, 4).rotateX(Math.PI / 2), mat4([0, 0, -0.27], [0, 0, 0], [1.3, 0.3, 1]), '#ffffff'),
    ];
    const kgeo = mergeGeometries(body);
    koi = new THREE.InstancedMesh(kgeo, keep(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3a1408' })), 6);
    const cols = ['#ff6a1c', '#ff8a2a', '#f4efe6', '#ff5a20', '#ffb24a', '#e8e2da'];
    for (let k = 0; k < 6; k++) {
      koi.setColorAt(k, new THREE.Color(cols[k]));
      KOI.push({ w: 0.11 + R() * 0.07, p: R() * 6.3, q: R() * 6.3, span: 4 + R() * 2 });
    }
    koi.name = 'koi'; koi.frustumCulled = false;
    group.add(koi);
  }

  // the bridge
  const bparts = [];
  bridge(bparts);
  const bridgeMesh = mergeMesh(bparts, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.0 })), 'bridge');
  bridgeMesh.castShadow = true;
  group.add(bridgeMesh);

  const petalTex = canvasTexture(64, 64, (g, w) => {
    g.translate(w / 2, w / 2); g.rotate(0.6);
    const grd = g.createRadialGradient(0, 4, 2, 0, 0, 28);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0.85)');
    g.fillStyle = grd; g.beginPath();
    g.moveTo(0, 26); g.bezierCurveTo(22, 14, 18, -18, 5, -24); g.lineTo(0, -16); g.lineTo(-5, -24); g.bezierCurveTo(-18, -18, -22, 14, 0, 26);
    g.fill();
  });
  // sakura trees
  const trunks = [], crowns = [];
  const blossoms = lite ? null : [...shrubBloom];
  for (const [a, rr, seed, s, near] of TREES) tree(a, rr, seed, s, near, trunks, crowns, blossoms, lite);
  group.add(mergeMesh(trunks, keep(new THREE.MeshLambertMaterial({ vertexColors: true, color: WARM })), 'trunks'));
  const crownMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#7a3352', emissiveIntensity: 0.28 }));
  group.add(mergeMesh(crowns, crownMat, 'crowns'));
  // single blossoms on the crown surfaces: soft points that break up the clump outlines
  let bloom = null;
  if (blossoms) {
    bloom = particles({ count: blossoms.length / 3, box: { min: [-200, -200, -200], max: [200, 200, 200] }, vel: [0, 0, 0], jitter: 0, sway: 0,
      size: 0.75, colors: ['#ffd0de', '#ffb3c9', '#ffe6ee', '#f594b4'], additive: false, texture: petalTex, opacity: 1, seed: 8 });
    bloom.geometry.attributes.position.array.set(blossoms);
    bloom.name = 'blossoms';
    group.add(bloom);
  }

  // a wooded rise beyond the trees: rounded canopies and a few tall cedars, flat hazed silhouettes (no fog, no light) in two depths
  const woods = [];
  const haze = new THREE.Color('#a27f9e'), mist = new THREE.Color('#e5a48a'), canopy = blob(1, 9, 0.22);
  for (const [rad, k0, n, hMin] of lite ? [[40, 0.3, 40, 3.5]] : [[36, 0.15, 110, 2.5], [46, 0.4, 90, 4.5]]) {
    const wn = wobble(rad);
    for (let k = 0; k < n; k++) {
      const a = (k + R() * 0.8) / n * Math.PI * 2, rr = rad + (R() - 0.5) * 4, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const h = hMin + 3.5 * (0.5 + 0.5 * wn(Math.cos(a) * 2, 0, Math.sin(a) * 2)) + R() * 1.5, w = 2.4 + R() * 1.8, top = FLOOR_Y + h * 0.9;
      const base = new THREE.Color(R() < 0.5 ? '#2c473c' : '#3a5040').lerp(haze, k0 + R() * 0.08);
      woods.push(part(canopy, mat4([x, FLOOR_Y + h * 0.3, z], [0, R() * 3, 0], [w, h * 0.62, w]), (px, py, pz, nx, ny, nz, c) => {
        c.copy(base).multiplyScalar(0.94 + 0.1 * Math.max(0, ny)).lerp(mist, Math.max(0, Math.min(1, 1 - (py - FLOOR_Y) / (top - FLOOR_Y))) * (lite ? 0.85 : 0.55));
      }));
    }
  }
  // tall narrow cedars for a rhythm in the skyline
  const cedar = new THREE.ConeGeometry(1, 1, 7, 1), cedarC = new THREE.Color('#2c473c').lerp(haze, lite ? 0.3 : 0.15);
  for (let k = 0; k < (lite ? 6 : 13); k++) {
    const a = (k + 0.3 + R() * 0.4) / (lite ? 6 : 13) * Math.PI * 2, rr = 35.5 + R() * 2, H = 6 + R() * 2, w = 1.3 + R() * 0.4;
    for (let t = 0; t < 3; t++) {
      woods.push(part(cedar, mat4([Math.cos(a) * rr, FLOOR_Y + H * (0.3 + 0.25 * t), Math.sin(a) * rr], [0, R() * 3, 0], [w * (1 - 0.24 * t), H * 0.45, w * (1 - 0.24 * t)]), (px, py, pz, nx, ny, nz, c) => {
        c.copy(cedarC).multiplyScalar(0.94 + 0.1 * Math.max(0, ny)).lerp(mist, Math.max(0, Math.min(1, 1 - (py - FLOOR_Y) / H)) * 0.55);
      }));
    }
  }
  cedar.dispose();
  canopy.dispose();
  group.add(mergeMesh(woods, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), 'woods'));

  // layered hills in the haze (no fog: each layer has its own haze colour, misty at the foot), a snow capped peak far away
  const hills = [];
  const horizon = new THREE.Color('#ef9f74');
  const layers = [[110, '#c9a0c2', 14, 4], [92, '#a586b0', 10, 3], [76, '#7f6f9e', 7, 2.5]];
  const peakA = Math.atan2(SUN.z, SUN.x) - 0.3, snow = new THREE.Color('#f7e8ee'), FR = [0, 0.55, 0.82, 1];
  for (const [rad, hex, amp, seedK] of layers) {
    const n = wobble(Math.round(rad)), n2 = wobble(Math.round(rad) + 7), top = new THREE.Color(hex), N = 240, pos = [], col = [];
    const hAt = (a) => {
      const cx = Math.cos(a), sz = Math.sin(a);
      let h = amp * (0.5 + 0.38 * n(cx * 1.6, 0, sz * 1.6) + 0.14 * n2(cx * seedK * 1.8, 0, sz * seedK * 1.8));
      if (rad === 110) { let d = Math.abs(a - peakA); d = Math.min(d, Math.PI * 2 - d); h = Math.max(h, 32 * Math.pow(Math.max(0, 1 - d / 0.4), 1.3)); }
      return Math.max(2, h);
    };
    const cAt = (row, h, f) => {
      if (row === 0) return horizon;
      if (row === 1) return _c.copy(top).lerp(horizon, 0.45);
      if (rad === 110 && h > 20 && row === 3) return snow;
      if (rad === 110 && h > 26 && row === 2) return _c.copy(top).lerp(snow, 0.55);
      return top;
    };
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, h0 = hAt(a0), h1 = hAt(a1);
      const P = (a, h, row) => [Math.cos(a) * rad, row === 0 ? FLOOR_Y - 4 : FLOOR_Y + h * FR[row], Math.sin(a) * rad];
      for (let rI = 0; rI < 3; rI++) {
        const quad = [[a0, h0, rI], [a0, h0, rI + 1], [a1, h1, rI + 1], [a0, h0, rI], [a1, h1, rI + 1], [a1, h1, rI]];
        for (const [a, h, k] of quad) { pos.push(...P(a, h, k)); const c = cAt(k, h); col.push(c.r, c.g, c.b); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    hills.push(g);
  }
  group.add(mergeMesh(hills, keep(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })), 'hills'));

  // petals drifting down (kept above y = 1), fireflies over the pond
  const petals = particles({
    count: lite ? 200 : 400, box: { min: [-30, 1, -30], max: [30, 15, 30] }, vel: [0.35, -0.55, 0.18], jitter: 0.4, sway: 0.7,
    size: 0.21, colors: ['#ffd3de', '#ffb9cb', '#ffe6ee', '#f7a3bb'], additive: false, texture: petalTex, opacity: 0.95, seed: 21,
  });
  petals.name = 'petals';
  // petals right in front of the lens: capped in size and faded out, no big blots over the view
  petals.material.vertexShader = petals.material.vertexShader.replace('gl_PointSize = size * (0.6 + 0.8 * rnd.y) * scale / max(0.1, -mv.z);',
    'gl_PointSize = min(scale * 0.018, size * (0.6 + 0.8 * rnd.y) * scale / max(0.1, -mv.z)); vA *= smoothstep(2.0, 6.0, -mv.z);');
  group.add(petals);
  let flies = null;
  const gtexGlow = glowTexture();
  if (!lite) {
    const [cx, cz] = pondXZ(0, 0);
    flies = particles({
      count: 70, box: { min: [cx - 7, -0.9, cz - 4], max: [cx + 7, 2.2, Math.min(cz + 5, -7.2)] }, vel: [0.08, 0.04, 0.06], jitter: 0.8, sway: 0.6,
      size: 0.16, colors: ['#fff2a0', '#e2ff8c', '#ffd27a'], additive: true, texture: gtexGlow, opacity: 0.9, twinkle: 0.9, seed: 5,
    });
    flies.name = 'fireflies';
    group.add(flies);
  }

  // lantern halos and two warm lights by the pond
  // lantern halos: one static point each (points, not sprites: the AO pass would draw a sprite as a dark quad)
  let halos = null;
  if (!lite) {
    halos = particles({ count: LANTERNS.length, box: { min: [-200, -200, -200], max: [200, 200, 200] }, vel: [0, 0, 0], jitter: 0, sway: 0,
      size: 4.2, colors: ['#ff9a4a'], additive: true, texture: gtexGlow, opacity: 0.85, twinkle: 0.18, seed: 3 });
    const hp = halos.geometry.attributes.position;
    LANTERNS.forEach(([x, z, s], i) => hp.setXYZ(i, x, FLOOR_Y + 1.12 * s, z));
    halos.name = 'halos';
    group.add(halos);
  } else {
    gtexGlow.dispose();
  }
  const lights = [];
  if (!lite) {
    for (const k of [0, 1]) {
      const [x, z, s] = LANTERNS[k];
      const l = new THREE.PointLight('#ffb36b', 7, 0, 2);
      l.position.set(x, FLOOR_Y + 1.15 * s, z);
      lights.push(l); group.add(l);
    }
  }

  const look = { fog: '#ef9f74', near: 4, far: 50 };
  const dummy = new THREE.Object3D();
  function update(dt, t) {
    tick(t, group.children[0], pond, petals, flies, halos);
    const f = 0.88 + 0.07 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.1 + 1.3);
    winMat.color.setRGB(3.4 * f, 1.8 * f, 0.65 * f);
    for (let i = 0; i < lights.length; i++) lights[i].intensity = 7 * (0.9 + 0.1 * Math.sin(t * (6.3 + i * 1.7) + i));
    if (koi) {
      for (let k = 0; k < KOI.length; k++) {
        const K = KOI[k], a = t * K.w + K.p;
        const u = K.span * Math.sin(a), u2 = K.span * Math.sin(a + 0.02);
        const v = 0.5 * pondW(u) * Math.sin(2 * a + K.q), v2 = 0.5 * pondW(u2) * Math.sin(2 * (a + 0.02) + K.q);
        const [x, z] = pondXZ(u, v), [x2, z2] = pondXZ(u2, v2);
        dummy.position.set(x, WATER_Y - 0.03, z);
        dummy.rotation.set(0, Math.atan2(x2 - x, z2 - z) + 0.12 * Math.sin(t * 6 + k), 0);
        dummy.updateMatrix();
        koi.setMatrixAt(k, dummy.matrix);
      }
      koi.instanceMatrix.needsUpdate = true;
    }
  }
  return { group, look, update, dispose() { gtex.field.dispose(); } };
}
