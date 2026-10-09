// Lava world (CHE-370): the board on a basalt plateau of hex columns above a sea of molten lava. Rock stacks and spires rise from
// the lava, two volcanoes smoke on the horizon, sparks and ash drift. Everything is procedural; the lava, the sky and the
// volcanoes are shaders, the columns one InstancedMesh.
import * as THREE from 'three';
import { rng, canvasTexture, glowTexture, skyDome, particles, tick, mergeMesh, tint, glowSprite } from './kit.js';

const FLOOR_Y = -1.2, LAVA_Y = -6.2, COL_BOTTOM = -8.2;
const FOG = '#3a1209';
const HEX = 0.62;                       // hex column circumradius (flat top hexes in xz)
const PA = 9.9, PB = 9.5, PN = 3.6;     // plateau superellipse half extents and exponent

// value noise for placement and displacement (JS side)
function hash2(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// superellipse "radius" of the plateau: < 1 inside; the edge wobbles a little
function plateauR(x, z) {
  const f = Math.pow(Math.abs(x) / PA, PN) + Math.pow(Math.abs(z) / PB, PN);
  const g = Math.pow(f, 1 / PN);
  const a = Math.atan2(z, x);
  return g * (1 + 0.05 * (vnoise(Math.cos(a) * 3 + 7, Math.sin(a) * 3 + 3, 5) - 0.5) * 2);
}
const inClear = (x, z, m = 0) => Math.abs(x) <= 7.2 + m && Math.abs(z) <= 6.8 + m;

// hex grid (flat top in xz): axial (q, r) to centre
const hexCenter = (q, r) => [1.5 * HEX * q, Math.sqrt(3) * HEX * (r + q / 2)];
const HEX_NB = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

// emissive glow from below (the lava) for lit rock: patched into a standard material, in group local space
function glowFromBelow(mat, shared) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlowTime = shared.time;
    sh.uniforms.uGlowCol = shared.color;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlowP; varying float vGlowNy;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 gwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        gwp = instanceMatrix * gwp;
        #endif
        vGlowP = gwp.xyz; vGlowNy = abs(objectNormal.y);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlowP; varying float vGlowNy; uniform float uGlowTime; uniform vec3 uGlowCol;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float k = clamp((-4.8 - vGlowP.y) / 1.4, 0.0, 1.0);
          float fl = 0.85 + 0.15 * sin(uGlowTime * 1.7 + vGlowP.x * 0.4 + vGlowP.z * 0.3);
          totalEmissiveRadiance += uGlowCol * (k * k * 0.35 + k * k * k * k * 1.1) * fl;
          // columnar joints: thin dark bands across the column sides
          float j = abs(fract(vGlowP.y * 0.9 + floor(vGlowP.x * 1.3) * 0.37 + floor(vGlowP.z * 1.3) * 0.23) - 0.5);
          diffuseColor.rgb *= mix(mix(0.55, 1.0, smoothstep(0.0, 0.05, 0.5 - j)), 1.0, step(0.5, vGlowNy));
        }`);
  };
  mat.customProgramCacheKey = () => 'lava-glow';
  return mat;
}

// a jagged rock spire: a displaced cone, faceted
function spireGeo(r, h, seed, lean = 0) {
  const g = new THREE.ConeGeometry(r, h, 7, 7, false).toNonIndexed();
  const p = g.attributes.position, R = rng(seed);
  const ox = R() * 100, oz = R() * 100;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + h / 2) / h;
    const n = vnoise(x * 1.3 + ox, y * 0.9 + oz, seed) - 0.5;
    const s = 1 + n * 0.7;
    p.setXYZ(i, x * s + lean * t * t * h * 0.25, y + n * 0.3, z * s);
  }
  g.computeVertexNormals();
  return g;
}

// rising billboards with a life cycle (sparks, smoke): each starts at its base, rises and drifts, fades out, starts again.
// Instanced camera facing quads, so big smoke puffs are not clipped by the point size limit of a GPU.
function risers({ base, count, rise, speed, drift = [0, 0, 0], sway = 0.3, size0, size1, colA, colB, colEnd, additive = true, texture, opacity = 1, seed = 3, fadeIn = 0.1, fadeOut = 0.6, nearFade = 0, spin = 0 }) {
  const R = rng(seed), pos = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const b = base(R, i);
    pos[i * 3] = b[0]; pos[i * 3 + 1] = b[1]; pos[i * 3 + 2] = b[2];
    rnd[i * 4] = R(); rnd[i * 4 + 1] = R(); rnd[i * 4 + 2] = R(); rnd[i * 4 + 3] = R();
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('base', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('rnd', new THREE.InstancedBufferAttribute(rnd, 4));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      time: { value: 0 }, map: { value: texture }, rise: { value: rise }, speed: { value: speed }, sway: { value: sway },
      drift: { value: new THREE.Vector3(...drift) }, size0: { value: size0 }, size1: { value: size1 }, opacity: { value: opacity },
      colA: { value: new THREE.Color(colA) }, colB: { value: new THREE.Color(colB) }, colEnd: { value: new THREE.Color(colEnd) },
      fadeIn: { value: fadeIn }, fadeOut: { value: fadeOut }, nearFade: { value: nearFade }, spin: { value: spin },
    },
    vertexShader: `uniform float time, rise, speed, sway, size0, size1, fadeIn, fadeOut, nearFade, spin; uniform vec3 drift, colA, colB, colEnd;
      attribute vec3 base; attribute vec4 rnd; varying vec3 vCol; varying float vA; varying vec2 vUv;
      void main() {
        float ph = fract(rnd.x + time * speed * (0.6 + 0.8 * rnd.y));
        vec3 p = base + vec3(0.0, rise * (0.55 + 0.45 * rnd.w) * ph, 0.0) + drift * ph * (0.7 + 0.6 * rnd.z);
        p.x += sin(time * (0.7 + rnd.z) + rnd.w * 6.283) * sway * ph;
        p.z += cos(time * (0.6 + rnd.y) + rnd.z * 6.283) * sway * ph;
        vA = smoothstep(0.0, fadeIn, ph) * (1.0 - smoothstep(fadeOut, 1.0, ph));
        vCol = mix(mix(colA, colB, rnd.z), colEnd, ph);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float a = rnd.x * 6.283 + spin * time * (rnd.y - 0.5);
        vec2 c = mat2(cos(a), sin(a), -sin(a), cos(a)) * position.xy;
        mv.xy += c * mix(size0, size1, ph) * (0.6 + 0.8 * rnd.y);
        vA *= smoothstep(nearFade, nearFade * 2.5, -mv.z);   // nothing flares right in front of the camera
        vUv = position.xy + 0.5;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D map; uniform float opacity; varying vec3 vCol; varying float vA; varying vec2 vUv;
      void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vCol, t.a * vA * opacity); if (gl_FragColor.a < 0.004) discard;
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false; m.userData.shaderPlaced = true; m.name = 'risers';
  return m;
}

const NOISE_GLSL = `
  float lh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 lh2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  float ln(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(lh(i), lh(i + vec2(1.0, 0.0)), u.x), mix(lh(i + vec2(0.0, 1.0)), lh(i + vec2(1.0, 1.0)), u.x), u.y); }
  float lfbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { s += a * ln(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
`;

function lavaMaterial(lite) {
  return new THREE.ShaderMaterial({
    fog: true,
    defines: { OCT: lite ? 3 : 4 },
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 } }]),
    vertexShader: `varying vec3 vP;
      #include <fog_pars_vertex>
      void main() { vP = position; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; varying vec3 vP;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      // crust plates: cell distance F1 and F2 of slowly moving points
      vec2 voro(vec2 x) {
        vec2 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j)); vec2 o = lh2(n + g);
          o = 0.5 + 0.38 * sin(time * 0.12 + 6.283 * o);
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return vec2(d1, d2);
      }
      void main() {
        vec2 p = vP.xz;
        float r = length(p);
        vec2 flow = vec2(0.05, 0.022) * time;
        vec2 w = vec2(lfbm(p * 0.07 + time * 0.015), lfbm(p * 0.07 + vec2(5.2, 1.3) - time * 0.012));
        float calm = smoothstep(13.0, 26.0, r);   // dark crust with thin veins near the plateau, brighter further out
        vec2 q = p * 0.42 + flow + 1.4 * w;
        vec2 v = voro(q);
        float edge = v.y - v.x;
        float wob = ln(q * 3.0 + time * 0.1);
        // thin red orange veins between dark crust plates; only the rare molten pools burn yellow
        float crack = 1.0 - smoothstep(0.0, 0.035 + 0.05 * wob, edge);
        float sub = lfbm(p * 0.45 - flow * 2.5);
        float pool = lfbm(p * 0.09 - flow * 0.8 + 3.0);
        float molten = smoothstep(0.6, 0.85, pool);
        float pulse = 0.9 + 0.1 * sin(time * 1.3 + sub * 9.0);
        vec3 crust = mix(vec3(0.03, 0.014, 0.011), vec3(0.1, 0.04, 0.026), lfbm(q * 2.5 + 4.0));
        crust += vec3(0.25, 0.05, 0.0) * smoothstep(0.25, 0.0, edge) * 0.2;
        vec3 col = mix(crust, vec3(1.0, 0.35, 0.06) * 1.8 * (0.55 + 0.45 * sub) * pulse, crack * mix(0.55, 1.0, calm));
        vec3 hot = mix(vec3(1.0, 0.3, 0.05) * 1.8, vec3(1.0, 0.62, 0.16) * 4.0, smoothstep(0.2, 0.9, molten * (0.6 + 0.5 * sub)));
        col = mix(col, hot * pulse, smoothstep(0.0, 0.35, molten));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// volcano: a lathe cone with a crater; colour hazes into the horizon at the foot, lava streams run down from the crater
function volcanoMaterial() {
  return new THREE.ShaderMaterial({
    fog: false,
    defines: { OCT: 3 },
    uniforms: { time: { value: 0 }, fogCol: { value: new THREE.Color(FOG) }, rockCol: { value: new THREE.Color('#170806') } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main() { vUv = uv; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform vec3 fogCol, rockCol; varying vec2 vUv; varying vec3 vN;
      ${NOISE_GLSL}
      void main() {
        float h = vUv.y;                      // 0 at the foot, 1 in the crater
        float a = vUv.x * 6.2831853;
        float lit = 0.75 + 0.25 * clamp(dot(normalize(vN), normalize(vec3(-0.3, 0.6, 0.6))), 0.0, 1.0);
        vec3 col = mix(fogCol, rockCol * lit, smoothstep(0.0, 0.55, h));
        // streams: a few wandering lines from the crater down
        float s = sin(a * 4.0 + 1.6 * ln(vec2(h * 5.0, a)) + 0.5);
        float line = smoothstep(0.9, 1.0, s) * smoothstep(0.35, 0.82, h) * (1.0 - smoothstep(0.86, 0.9, h));
        float pulse = 0.55 + 0.45 * sin(h * 26.0 + time * 1.4);
        col += vec3(1.0, 0.32, 0.05) * line * pulse * 2.2;
        // crater rim and throat glow
        col += vec3(1.0, 0.45, 0.1) * smoothstep(0.86, 0.93, h) * 3.0;
        col += vec3(0.6, 0.12, 0.02) * smoothstep(0.7, 0.88, h) * 0.5;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
function volcanoGeo(R0, H, craterR, seed, at) {
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = craterR + (R0 - craterR) * Math.pow(1 - t, 1.6);
    pts.push(new THREE.Vector2(r, t * H));
  }
  pts.push(new THREE.Vector2(craterR * 0.75, H - craterR * 0.35));
  pts.push(new THREE.Vector2(0.01, H - craterR * 0.45));
  const g = new THREE.LatheGeometry(pts, 48);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const t = y / H;
    const n = (vnoise(Math.cos(a) * 4 + 3, Math.sin(a) * 4 + t * 3, seed) - 0.5) * 0.22 * (1 - t * 0.7);
    p.setXYZ(i, x * (1 + n) + at[0], y + at[1], z * (1 + n) + at[2]);
    uv.setY(i, Math.min(1, t * 0.9 + (i % (N + 3) >= N + 1 ? 0.1 : 0)));
  }
  g.computeVertexNormals();
  return g;
}

export function build({ THREE: T = THREE, lite }) {
  const group = new T.Group();
  const R = rng(370);
  const shared = { time: { value: 0 }, color: { value: new T.Color('#ff7a30').multiplyScalar(lite ? 0.42 : 1) } };
  const glowTex = glowTexture(64, 2.0);

  // sky: dark red brown, a warm band over the horizon, smoke bands, the volcano glow
  // volcanoes: the big one far out on the -x side (seen in low views across the board), a smaller one behind on the right
  const V1 = { at: [-95, LAVA_Y - 1, -22], R0: 34, H: 19, cr: 4.2 }, V2 = { at: [-85, LAVA_Y - 1, 40], R0: 26, H: 18, cr: 3.2 };
  const volDir = new T.Vector3(V1.at[0], V1.at[1] + V1.H + 4, V1.at[2]).normalize();
  const vol2Dir = new T.Vector3(V2.at[0], V2.at[1] + V2.H + 4, V2.at[2]).normalize();
  const sky = skyDome({
    stops: [[0.0, '#1c0806'], [0.5, FOG], [0.53, '#6a230d'], [0.58, '#3e140a'], [0.7, '#130605'], [1.0, '#030202']],
    extraUniforms: { volDir: { value: volDir }, vol2Dir: { value: vol2Dir } },
    extra: `
      float up = max(vDir.y, 0.0);
      float band = sin(vDir.x * 7.0 + time * 0.02 + 2.0 * sin(vDir.z * 5.0 + time * 0.013)) * sin(vDir.z * 9.0 - time * 0.017 + vDir.x * 3.0 + up * 14.0);
      c *= 1.0 - 0.5 * smoothstep(0.1, 0.9, band) * smoothstep(0.02, 0.1, up) * (1.0 - smoothstep(0.5, 0.9, up));
      float v = max(dot(normalize(vDir), volDir), 0.0);
      c += vec3(0.42, 0.1, 0.02) * pow(v, 24.0) + vec3(0.12, 0.03, 0.0) * pow(v, 5.0) * smoothstep(-0.05, 0.2, vDir.y);
      float v2 = max(dot(normalize(vDir), vol2Dir), 0.0);
      c += vec3(0.2, 0.05, 0.01) * pow(v2, 30.0);`,
  });
  group.add(sky);

  // lava falls: from basalt cliffs at r >= 18, 30 to 40 degrees off the axis behind the board
  // two short wide falls low in the play view's band (lip y about -3.6), framed under the top edge a third in from each side
  const FALLS = [
    { x: -10, z: -18.5, top: -0.4, lip: -3.6, w0: 2.8, w1: 3.3, bend: 0.6 },
    { x: 10.5, z: -18.5, top: -0.2, lip: -3.6, w0: 2.8, w1: 3.3, bend: 0.6 },
  ].slice(0, lite ? 1 : 2);
  for (const f of FALLS) { f.a = Math.atan2(f.z, f.x); f.r = Math.hypot(f.x, f.z); }
  const angGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const v1a = Math.atan2(V1.at[2], V1.at[0]);
  const v2a = Math.atan2(V2.at[2], V2.at[0]);
  const spireOk = (a) => angGap(a, v1a) > 8 * Math.PI / 180 && angGap(a, v2a) > 7 * Math.PI / 180 && angGap(a, -Math.PI / 2) > 0.35 && FALLS.every((f) => angGap(a, f.a) > 0.3);
  // a cliff of hex columns around a fall; only the faces that look towards the centre and the tops are kept (single sided,
  // so a camera behind the cliff sees through it)
  function cliffGeo(f) {
    const parts = [], RC = rng(Math.round(f.x * 13 + f.z));
    for (let q = -50; q <= 50; q++) for (let r = -50; r <= 50; r++) {
      const [x, z] = hexCenter(q, r), rr = Math.hypot(x, z);
      if (rr < f.r - 1.2 || rr > f.r + 3.2) continue;
      const da = angGap(Math.atan2(z, x), f.a) * f.r;   // arc distance from the fall
      if (da > 4.2) continue;
      const tall = f.top > 4, top = f.top - da * da * (tall ? 0.55 : 0.28) + (rr - f.r + 1.2) * 0.4 - RC() * (tall ? 3.2 : 1.2) - (da < 0.8 ? 0.6 : 0);
      if (top < Math.min(2, f.top - 3)) continue;
      const g = new THREE.CylinderGeometry(HEX * 0.97, HEX * 0.97, top - COL_BOTTOM, 6, 1, false, Math.PI / 2).toNonIndexed();
      g.translate(x, (top + COL_BOTTOM) / 2, z);
      parts.push(tint(g, new THREE.Color('#2e2725').multiplyScalar(0.75 + RC() * 0.35)));
    }
    const merged = mergeMesh(parts, null).geometry;
    // drop the faces turned away from the centre
    const pos = merged.attributes.position, col = merged.attributes.color, keepP = [], keepC = [];
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3(), a0 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      a0.fromBufferAttribute(pos, i);
      e1.fromBufferAttribute(pos, i + 1).sub(a0); e2.fromBufferAttribute(pos, i + 2).sub(a0);
      n.crossVectors(e1, e2).normalize();
      c.set(-a0.x, 0, -a0.z).normalize();
      if (n.y < 0.5 && n.dot(c) < -0.05) continue;
      if (n.y < -0.5) continue;
      for (let k = 0; k < 3; k++) { keepP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)); keepC.push(col.getX(i + k), col.getY(i + k), col.getZ(i + k)); }
    }
    merged.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(keepC, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(keepP.length / 3 * 2), 2));
    g.computeVertexNormals();
    return g;
  }

  // plateau: hex cells inside the superellipse are one flat cap mesh; the cells around the edge are columns stepping down
  const cells = new Map();
  const key = (q, r) => `${q},${r}`;
  const inner = new Set();
  const QN = 26;
  for (let q = -QN; q <= QN; q++) for (let r = -QN; r <= QN; r++) {
    const [x, z] = hexCenter(q, r);
    if (Math.abs(x) > 18 || Math.abs(z) > 18) continue;
    const g = plateauR(x, z);
    cells.set(key(q, r), { q, r, x, z, g });
    if (g <= 1 || inClear(x, z, HEX * 1.05)) inner.add(key(q, r));
  }

  // cap texture (seams, grain) and emissive (seams glow towards the edge), mapped over [-TX, TX] in x and z
  const TX = 12, TS = lite ? 256 : 1024;
  const toPx = (v) => (v + TX) / (2 * TX) * TS;
  // hex corners jittered by their position (shared by the three cells that meet there), so the seams look like rock, not tiles
  const corner = (x, z, k) => {
    const a = k * Math.PI / 3, vx = x + Math.cos(a) * HEX, vz = z + Math.sin(a) * HEX;
    const ix = Math.round(vx * 50), iz = Math.round(vz * 50);
    return [vx + (hash2(ix, iz, 31) - 0.5) * HEX * 0.32, vz + (hash2(ix, iz, 32) - 0.5) * HEX * 0.32];
  };
  const hexPath = (g2, c, shrink = 1) => {
    g2.beginPath();
    for (let k = 0; k < 6; k++) {
      const [vx, vz] = corner(c.x, c.z, k);
      const px = toPx(c.x + (vx - c.x) * shrink), pz = toPx(c.z + (vz - c.z) * shrink);
      k ? g2.lineTo(px, pz) : g2.moveTo(px, pz);
    }
    g2.closePath();
  };
  const SMOOTH = THREE.MathUtils.smoothstep;
  const SLAB = 6.5;   // inside this radius the floor is one smooth worn slab: no seams near the board
  const TONES = ['#3b3431', '#352c2a', '#43362f'].map((h) => new THREE.Color(h));
  const capMap = canvasTexture(TS, TS, (g2, w, h) => {
    g2.fillStyle = '#2f2724'; g2.fillRect(0, 0, w, h);
    const px = TS / (2 * TX);
    for (const k of inner) {
      const c = cells.get(k), rc = Math.hypot(c.x, c.z);
      const edge = SMOOTH(c.g, 0.7, 1.02);
      const base = rc < SLAB ? new THREE.Color('#38302c')
        : TONES[Math.floor(hash2(c.q, c.r, 8) * 3)].clone().lerp(new THREE.Color('#4a3129'), edge * 0.6).multiplyScalar(1 + 0.24 * (hash2(c.q, c.r, 9) - 0.5));
      g2.fillStyle = `#${base.getHexString()}`; g2.strokeStyle = g2.fillStyle; g2.lineWidth = 1.5;
      hexPath(g2, c); g2.fill(); g2.stroke();
      if (rc >= SLAB) { g2.lineWidth = px * 0.14; g2.strokeStyle = `rgba(0,0,0,${(0.03 + 0.2 * edge).toFixed(3)})`; hexPath(g2, c, 0.86); g2.stroke(); }
    }
    // a soft darker ring where the slab ends
    const rg = g2.createRadialGradient(toPx(0), toPx(0), (SLAB - 0.9) * px, toPx(0), toPx(0), (SLAB + 0.9) * px);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.5, 'rgba(10,6,5,0.28)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = rg; g2.fillRect(0, 0, w, h);
    const img = g2.getImageData(0, 0, w, h), RR = rng(11), sc = 1024 / TS;
    for (let i = 0; i < w * h; i++) {
      const x = (i % w) * sc, y = ((i / w) | 0) * sc;
      const n = 0.8 + vnoise(x * 0.03, y * 0.03, 3) * 0.2 + vnoise(x * 0.15, y * 0.15, 4) * 0.12 + RR() * 0.08;
      img.data[i * 4] *= n; img.data[i * 4 + 1] *= n; img.data[i * 4 + 2] *= n;
    }
    g2.putImageData(img, 0, 0);
    // seams: each edge once, about 45 % skipped so cells fuse into bigger slabs, none inside the slab
    const done = new Set();
    for (const k of inner) {
      const c = cells.get(k), edge = SMOOTH(c.g, 0.7, 1.0);
      for (let e = 0; e < 6; e++) {
        const [ax, az] = corner(c.x, c.z, e), [bx, bz] = corner(c.x, c.z, e + 1);
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, ek = `${Math.round(mx * 20)},${Math.round(mz * 20)}`;
        if (done.has(ek)) continue;
        done.add(ek);
        if (Math.hypot(mx, mz) < SLAB || hash2(Math.round(mx * 20), Math.round(mz * 20), 77) < 0.45) continue;
        g2.lineWidth = Math.max(1, px * (0.03 + 0.045 * edge)); g2.strokeStyle = `rgba(12,8,7,${(0.3 + 0.6 * edge).toFixed(3)})`;
        g2.beginPath(); g2.moveTo(toPx(ax), toPx(az)); g2.lineTo(toPx(bx), toPx(bz)); g2.stroke();
      }
    }
  });
  // glowing cracks: only some seams, more of them towards the plateau edge, none near the board
  const capGlow = canvasTexture(TS, TS, (g2) => {
    g2.fillStyle = '#000'; g2.fillRect(0, 0, TS, TS);
    const px = TS / (2 * TX), RR = rng(12);
    for (const k of inner) {
      const c = cells.get(k), a = 0.06 * SMOOTH(c.g, 0.8, 1.0);
      if (a <= 0.002) continue;
      g2.fillStyle = `rgba(255,90,30,${a.toFixed(3)})`; g2.strokeStyle = g2.fillStyle; g2.lineWidth = 1.5; hexPath(g2, c); g2.fill(); g2.stroke();
    }
    g2.lineCap = 'round';
    for (const k of inner) {
      const c = cells.get(k);
      const e = SMOOTH(c.g, 0.84, 1.0) * (inClear(c.x, c.z, 0.4) ? 0 : 1);
      if (e <= 0.01) continue;
      for (let s = 0; s < 3; s++) {
        if (RR() > e * 0.85) continue;
        const [ax, az] = corner(c.x, c.z, s), [bx, bz] = corner(c.x, c.z, s + 1);
        const hot = RR();
        for (const [lw, al] of [[0.22, 0.22], [0.07, 0.95]]) {
          g2.lineWidth = Math.max(1, px * lw * (0.6 + 0.6 * e));
          g2.strokeStyle = `rgba(255,${Math.round(70 + 110 * hot)},${Math.round(20 + 30 * hot)},${(al * e * (0.55 + 0.45 * RR())).toFixed(3)})`;
          g2.beginPath(); g2.moveTo(toPx(ax), toPx(az)); g2.lineTo(toPx(bx), toPx(bz)); g2.stroke();
        }
      }
    }
  });
  {
    const pos = [], uv = [];
    for (const k of inner) {
      const c = cells.get(k);
      for (let s = 0; s < 6; s++) {
        const a0 = s * Math.PI / 3, a1 = (s + 1) * Math.PI / 3;
        const tri = [[c.x, c.z], [c.x + Math.cos(a1) * HEX, c.z + Math.sin(a1) * HEX], [c.x + Math.cos(a0) * HEX, c.z + Math.sin(a0) * HEX]];
        for (const [x, z] of tri) { pos.push(x, FLOOR_Y, z); uv.push((x + TX) / (2 * TX), 1 - (z + TX) / (2 * TX)); }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    capMap.flipY = true; capGlow.flipY = true;
    const m = new T.MeshStandardMaterial({ map: capMap, roughness: 0.86, metalness: 0.0, emissive: '#ffffff', emissiveMap: capGlow, emissiveIntensity: 2.6 });
    const cap = new T.Mesh(g, m);
    cap.name = 'plateau'; cap.receiveShadow = true;
    group.add(cap);
  }

  // dais under the board: dark polished basalt in two steps
  {
    const m = new T.MeshStandardMaterial({ color: '#262120', roughness: 0.5, metalness: 0.1 });
    const a = new T.BoxGeometry(9.0, 0.22, 9.0); a.translate(0, FLOOR_Y + 0.11, 0);
    const b = new T.BoxGeometry(8.7, 0.47, 8.7); b.translate(0, FLOOR_Y + 0.22 + 0.235 - 0.005, 0);
    const dais = mergeMesh([a, b], m, 'dais');
    dais.receiveShadow = true;
    group.add(dais);
  }

  // columns: the plateau edge (boundary cells plus the cells beyond stepping down) and column islands in the lava
  const cols = [];   // [x, z, top, shade]
  for (const [k, c] of cells) {
    if (inner.has(k)) {
      const edge = HEX_NB.some(([dq, dr]) => !inner.has(key(c.q + dq, c.r + dr)));
      if (edge) cols.push([c.x, c.z, FLOOR_Y - 0.004, 0.9]);
      continue;
    }
    const d = (c.g - 1) * 9.6;
    if (d > (lite ? 2.6 : 3.4)) continue;
    let top = FLOOR_Y - 0.15 - d * 1.5 - R() * 1.1 * Math.min(1, d + 0.3);
    if (d > 0.6 && R() < 0.05 && !(Math.abs(c.x) < 6 && c.z < -8)) top = FLOOR_Y + 0.05 + R() * 1.0;   // a broken pillar sticking up at the edge
    if (top < LAVA_Y + 0.4) continue;
    cols.push([c.x, c.z, top, 0.75 + R() * 0.3]);
  }
  const islands = lite
    ? [[-16, -6, 0.6, 2.2], [15, -11, 0.2, 2.4], [-11, 15, -0.6, 2.0], [22, 9, 3.0, 2.6]]
    : [[-16, -6, 0.6, 2.2], [15, -11, 0.2, 2.4], [-11, 15, -0.6, 2.0], [22, 9, 2.0, 2.6], [-24, 12, 2.5, 3.0], [8, -22, 3.0, 3.2],
      [-7, -20, 2.5, 2.3], [26, -4, 1.0, 2.0], [13, 18, 1.5, 2.6], [-22, -20, 3.5, 3.5], [30, 22, 3.0, 3.0], [-33, 2, 2.0, 3.4]];
  const islandSpires = [];
  for (const [ix, iz, peak, rad] of islands) {
    // the whole cluster leans a little (pivot at the lava), and a spire rises from it
    const ta = R() * Math.PI * 2, tilt = (3 + R() * 5) * Math.PI / 180;
    const tiltM = new T.Matrix4().makeTranslation(ix, LAVA_Y, iz)
      .multiply(new T.Matrix4().makeRotationAxis(new T.Vector3(Math.cos(ta), 0, Math.sin(ta)), tilt))
      .multiply(new T.Matrix4().makeTranslation(-ix, -LAVA_Y, -iz));
    const ir = Math.hypot(ix, iz);
    const st = ir > 18.5 ? peak + 3 + R() * 4 : Math.min(1.2, peak + 0.8);
    islandSpires.push([ix + (R() - 0.5) * rad * 0.6, iz + (R() - 0.5) * rad * 0.6, st, 0.8 + R() * 0.6]);
    const q0 = Math.round(ix / (1.5 * HEX)), r0 = Math.round(iz / (Math.sqrt(3) * HEX) - q0 / 2), n = Math.ceil(rad / HEX) + 1;
    for (let dq = -n; dq <= n; dq++) for (let dr = -n; dr <= n; dr++) {
      const [x, z] = hexCenter(q0 + dq, r0 + dr), dd = Math.hypot(x - ix, z - iz);
      const edgeN = rad * (0.75 + 0.5 * vnoise(x * 0.8, z * 0.8, 21));
      if (dd > edgeN) continue;
      const rr = Math.hypot(x, z);
      const cap = rr < 12 ? 0.4 : rr < 17 ? 1.9 : 99;
      let top = Math.min(cap, peak - Math.pow(dd / edgeN, 1.5) * (peak - LAVA_Y) * 0.75 - R() * 0.9);
      if (top < LAVA_Y + 0.3) top = LAVA_Y + 0.3 + R() * 0.4;
      cols.push([x, z, top, 0.7 + R() * 0.35, ir > 18.5 ? tiltM : null]);
    }
  }
  {
    const geo = new T.CylinderGeometry(1, 1, 1, 6, 1, false, Math.PI / 2);
    const m = glowFromBelow(new T.MeshStandardMaterial({ color: '#2e2725', roughness: 0.8, metalness: 0.05, flatShading: true }), shared);
    const inst = new T.InstancedMesh(geo, m, cols.length);
    const mx = new T.Matrix4(), c3 = new T.Color(), sv = new T.Vector3(), pv = new T.Vector3(), qv = new T.Quaternion();
    cols.forEach(([x, z, top, shade, tiltM], i) => {
      const h = top - COL_BOTTOM;
      pv.set(x, COL_BOTTOM + h / 2, z); sv.set(HEX * 0.965, h, HEX * 0.965);
      mx.compose(pv, qv, sv);
      if (tiltM) mx.premultiply(tiltM);
      inst.setMatrixAt(i, mx);
      inst.setColorAt(i, c3.setRGB(shade, shade * 0.93, shade * 0.9));
    });
    inst.name = 'columns'; inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  // jagged spires beyond radius 17 (and low rocks in between), merged into one mesh
  {
    const parts = [];
    const n = lite ? 9 : 22;
    for (let i = 0; i < n; i++) {
      let a = R() * Math.PI * 2;
      for (let tries = 0; tries < 20 && !spireOk(a); tries++) a = R() * Math.PI * 2;
      const rr = 19 + R() * 30, h = 6 + R() * 11 * (rr / 45), r = 1.8 + R() * 2.2;
      const g = spireGeo(r, h, 100 + i, (R() - 0.5) * 0.6);
      g.translate(Math.cos(a) * rr, LAVA_Y - 0.5 + h / 2, Math.sin(a) * rr);
      tint(g, new T.Color('#3a302d').multiplyScalar(0.8 + R() * 0.3));
      parts.push(g);
    }
    for (let i = 0; i < (lite ? 6 : 14); i++) {
      let a = R() * Math.PI * 2;
      while (Math.sin(a) < -0.7) a = R() * Math.PI * 2;   // none in the -z quadrant behind the board
      const rr = 12.5 + R() * 4;
      const h = 3 + R() * 2, top = Math.min(-1.0, LAVA_Y + h);
      const g = spireGeo(0.9 + R() * 1.2, top - LAVA_Y + 0.5, 300 + i);
      g.translate(Math.cos(a) * rr, LAVA_Y - 0.5 + (top - LAVA_Y + 0.5) / 2, Math.sin(a) * rr);
      tint(g, new T.Color('#3a302d').multiplyScalar(0.7 + R() * 0.3));
      parts.push(g);
    }
    for (const [x, z, top, r] of islandSpires) {
      const h = top - LAVA_Y + 0.5, g = spireGeo(r, h, 500 + parts.length);
      g.translate(x, LAVA_Y - 0.5 + h / 2, z);
      tint(g, new T.Color('#3a302d').multiplyScalar(0.75 + R() * 0.3));
      parts.push(g);
    }
    for (const f of FALLS) parts.push(cliffGeo(f));
    const m = glowFromBelow(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), shared);
    group.add(mergeMesh(parts, m, 'spires'));
  }

  // the lava sea
  const lava = new T.Mesh(new T.CircleGeometry(115, 64), lavaMaterial(lite));
  lava.geometry.rotateX(-Math.PI / 2).translate(0, LAVA_Y, 0);   // baked in: the shader reads group local xz
  lava.name = 'lava';
  group.add(lava);

  // the lava falls: curved ribbons down the cliff faces, streaks scrolling down; a glow, a spark spray and steam at the splash
  const falls = FALLS;
  const fallMat = new T.ShaderMaterial({
    fog: true, toneMapped: false, transparent: true, depthWrite: false, side: T.DoubleSide, defines: { OCT: 3 },
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { time: { value: 0 } }]),
    vertexShader: `varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      void main() {
        float ek = pow(1.0 - abs(vUv.x * 2.0 - 1.0), 0.6);   // 1 in the middle of the half cylinder, 0 at its edges
        // cooled dark lumps ride down on the flow
        float crust = lfbm(vec2(vUv.x * 3.0, vUv.y * 1.2 - time * 0.5));
        float lump = smoothstep(0.5, 0.6, crust);
        float st = ln(vec2(vUv.x * 14.0, (vUv.y - time * 0.6) * 8.0));
        vec3 col = mix(vec3(0.6, 0.1, 0.02), vec3(1.0, 0.42, 0.06), ek);
        col = mix(col, vec3(1.0, 0.75, 0.25), smoothstep(0.86, 0.98, ek) * (0.7 + 0.3 * st));   // a thin hot centre line
        col = mix(col, vec3(0.12, 0.03, 0.01), lump * 0.92);
        float a = smoothstep(0.0, 0.12, ek) * smoothstep(0.0, 0.03, vUv.y);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
        #ifdef USE_FOG
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, min(0.3, smoothstep(fogNear, fogFar, vFogDepth)));
        #endif
      }`,
  });
  const splash = [], lips = [];
  {
    const parts = [];
    for (const f of falls) {
      // a half cylinder in cross section (bulging towards the centre), curving out from the cliff, wider at the foot
      const r0 = f.r - 1.9, y0 = f.lip, ca = Math.cos(f.a), sa = Math.sin(f.a), tx = -sa, tz = ca;
      const N = 24, S = 6, pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, y = y0 + (LAVA_Y - 0.1 - y0) * t, hw = (f.w0 + (f.w1 - f.w0) * t) / 2;
        const wob = Math.sin(t * 7 + f.x) * 0.12;
        for (let j = 0; j <= S; j++) {
          const u = j / S, ph = (u - 0.5) * Math.PI;
          const rr = r0 - f.bend * t * t - Math.cos(ph) * hw * 0.35, off = Math.sin(ph) * hw + wob;
          pos.push(ca * rr + tx * off, y, sa * rr + tz * off);
          uv.push(u, t * (y0 - LAVA_Y) / 6);
        }
        if (i < N) for (let j = 0; j < S; j++) { const k = i * (S + 1) + j, k2 = k + S + 1; idx.push(k, k + 1, k2, k + 1, k2 + 1, k2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      parts.push(g);
      splash.push([ca * (r0 - f.bend), sa * (r0 - f.bend)]);
      lips.push([ca * r0, y0, sa * r0, f.w0]);
    }
    const fm = mergeMesh(parts, fallMat, 'lava-falls');
    fm.renderOrder = 1;
    group.add(fm);
    for (const [x, z] of splash) { const sg = glowSprite(glowTex, '#ff7a28', 5.5, [x, LAVA_Y + 0.7, z], 0.8); sg.name = 'fall-glow'; group.add(sg); }
    // the outlet glows where the lava leaves the rock
    for (const [x, y, z, w] of lips) { const sg = glowSprite(glowTex, '#ff8a30', w * 1.6, [x, y + 0.1, z], 0.75); sg.name = 'fall-outlet'; group.add(sg); }
  }
  const spray = risers({
    base: (r, i) => { const [x, z] = splash[i % splash.length]; return [x + (r() - 0.5) * 2, LAVA_Y + 0.1, z + (r() - 0.5) * 2]; },
    count: 60 * splash.length, rise: 4, speed: 0.35, drift: [0, 0, 0], sway: 0.7,
    size0: 0.2, size1: 0.08, colA: '#ffd27a', colB: '#ff8a2a', colEnd: '#ff3a10', texture: glowTex, opacity: 1, seed: 47, fadeIn: 0.05, fadeOut: 0.5, nearFade: 5,
  });
  spray.name = 'fall-spray'; group.add(spray);
  // a short burst of sparks at each splash every few seconds (opacity pulsed in update)
  const burst = risers({
    base: (r, i) => { const [x, z] = splash[i % splash.length]; return [x + (r() - 0.5) * 1.2, LAVA_Y + 0.2, z + (r() - 0.5) * 1.2]; },
    count: 40 * splash.length, rise: 3.2, speed: 0.9, drift: [0, 0, 0], sway: 1.2,
    size0: 0.26, size1: 0.1, colA: '#ffe08a', colB: '#ff9a3a', colEnd: '#ff4a10', texture: glowTex, opacity: 0, seed: 49, fadeIn: 0.03, fadeOut: 0.4, nearFade: 5,
  });
  burst.name = 'fall-burst'; group.add(burst);
  let steam = null;
  if (!lite) {
    steam = risers({
      base: (r, i) => { const [x, z] = splash[i % splash.length]; return [x + (r() - 0.5) * 1.5, LAVA_Y + 0.3, z + (r() - 0.5) * 1.5]; },
      count: 26 * splash.length, rise: 7, speed: 0.07, drift: [0.8, 0, 0.4], sway: 0.8,
      size0: 1.2, size1: 3.8, colA: '#6a4436', colB: '#4a3530', colEnd: '#2a2022', additive: false, texture: glowTexture(64, 1.8), opacity: 0.3, seed: 48, fadeIn: 0.15, fadeOut: 0.5, nearFade: 5,
    });
    steam.name = 'fall-steam'; group.add(steam);
  }

  // volcanoes on the horizon
  const vol1 = V1.at, vol2 = V2.at;
  const volParts = [volcanoGeo(V1.R0, V1.H, V1.cr, 1, vol1)];
  volParts.push(volcanoGeo(V2.R0, V2.H, V2.cr, 2, vol2));
  const volMat = volcanoMaterial();
  const volcano = new T.Mesh(volParts.length > 1 ? mergeVol(volParts) : volParts[0], volMat);
  volcano.name = 'volcanoes'; volcano.frustumCulled = false;
  group.add(volcano);

  // smoke plumes from the craters (dark, lit orange at the bottom)
  const smokeTex = glowTexture(64, 1.8);
  const plumeBase = (v, H, spread) => (r) => [v[0] + (r() - 0.5) * spread, v[1] + H, v[2] + (r() - 0.5) * spread];
  const plume = risers({
    base: plumeBase(vol1, V1.H - 1, 3), count: lite ? 60 : 150, rise: 34, speed: 0.022, drift: [10, 0, 22], sway: 3,
    size0: 5, size1: 32, colA: '#d0561c', colB: '#5a2a1c', colEnd: '#1a1012', additive: false, texture: smokeTex, opacity: 0.8, seed: 41, fadeIn: 0.1, fadeOut: 0.6, spin: 0.3,
  });
  plume.name = 'plume'; group.add(plume);
  let plume2 = null;
  if (!lite) {
    plume2 = risers({
      base: plumeBase(vol2, V2.H - 1, 2), count: 90, rise: 28, speed: 0.026, drift: [14, 0, 8], sway: 2.4,
      size0: 4, size1: 24, colA: '#d0561c', colB: '#5a2a1c', colEnd: '#1a1012', additive: false, texture: smokeTex, opacity: 0.75, seed: 42, fadeIn: 0.1, fadeOut: 0.6, spin: 0.3,
    });
    plume2.name = 'plume'; group.add(plume2);
  }

  // sparks rising from the lava around the plateau and from the cracks at its edge (never inside the clear zone)
  const sparkBase = (r) => {
    for (;;) {
      if (r() < 0.2) {   // at the plateau edge
        const a = r() * Math.PI * 2, x = Math.cos(a) * 12, z = Math.sin(a) * 12;
        const g = plateauR(x, z), s = (1.02 + r() * 0.25) / g;
        const px = x * s, pz = z * s;
        if (!inClear(px, pz, 1.5)) return [px, LAVA_Y + 2 + r() * 4, pz];
        continue;
      }
      const a = r() * Math.PI * 2, rr = 12 + Math.pow(r(), 1.5) * 30;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (plateauR(x, z) > 1.15) return [x, LAVA_Y + 0.2, z];
    }
  };
  const sparks = risers({
    base: sparkBase, count: lite ? 160 : 700, rise: 13, speed: 0.11, drift: [0.6, 0, 0.3], sway: 0.5,
    size0: 0.22, size1: 0.1, colA: '#ffd27a', colB: '#ff7a22', colEnd: '#ff3a10', texture: glowTex, opacity: 1, seed: 43, fadeIn: 0.05, fadeOut: 0.55, nearFade: 5,
  });
  sparks.name = 'sparks'; group.add(sparks);

  // ash: sparse dark flakes drifting down high above everything
  const ash = particles({
    count: lite ? 70 : 260, box: { min: [-40, 2.5, -40], max: [40, 22, 40] }, vel: [0.25, -0.45, 0.1], jitter: 0.5, sway: 0.6,
    size: 0.07, colors: ['#6e5f58', '#53463f', '#8a6a58'], additive: false, texture: glowTex, opacity: 0.75, seed: 44,
  });
  group.add(ash);


  // lava light from below on the plateau edge
  const lights = [];
  if (!lite) {
    for (const [x, z] of [[-9, 13], [11, -12]]) {
      const l = new T.PointLight('#ff5a1c', 70, 34, 2);
      l.position.set(x, LAVA_Y + 2.2, z);
      lights.push(l); group.add(l);
    }
  }

  function update(dt, t) {
    shared.time.value = t;
    tick(t, sky, lava, volcano, plume, plume2, sparks, ash, spray, steam);
    fallMat.uniforms.time.value = t;
    const bt = (t % 4.2) / 1.1;
    burst.material.uniforms.opacity.value = bt < 1 ? Math.sin(bt * Math.PI) : 0;
    burst.material.uniforms.time.value = t;
    for (let i = 0; i < lights.length; i++) lights[i].intensity = 70 * (0.85 + 0.15 * Math.sin(t * 1.3 + i * 2.4) * Math.sin(t * 0.57 + i));
  }

  function mergeVol(parts) {
    const m = mergeMesh(parts, volMat);
    const g = m.geometry; m.geometry = null;
    return g;
  }

  return { group, look: { fog: FOG, near: 1.5, far: 34 }, update };
}
