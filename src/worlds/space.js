// Space world (CHE-370): the board on a floating sci-fi deck in deep space. Metal deck plates with soft blue seam lights, a railing
// with a glowing rim, a ringed gas giant and a moon hanging in the sky, a nebula and a dense star field in the sky shader (stars
// below the horizon too, so the deck floats), twinkling star points, drifting asteroids, a far space station and dust motes.
import * as THREE from 'three';
import { rng, canvasTexture, glowTexture, particles, tick, mergeMesh, tint, mat4 } from './kit.js';

const FLOOR_Y = -1.2;
const FOG = '#1d1745';

const NOISE = `
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCTAVES; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

function skySphere(lite) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    defines: { OCTAVES: lite ? 3 : 5 },
    uniforms: { time: { value: 0 }, fogCol: { value: new THREE.Color(FOG) } },
    vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform vec3 fogCol; varying vec3 vDir;
      ${NOISE}
      float stars(vec3 d, float scale, float keep, float seed) {
        vec3 p = d * scale + seed; vec3 i = floor(p), f = fract(p) - 0.5;
        float h = hash3(i);
        if (h < 1.0 - keep) return 0.0;
        vec3 o = vec3(hash3(i + 1.3), hash3(i + 2.7), hash3(i + 4.1)) - 0.5;
        float px = length(fwidth(p));
        float rad = max(0.07, px * 0.9);
        float dist = length(f - o * 0.6);
        float tw = 0.65 + 0.35 * sin(time * (0.8 + 2.5 * fract(h * 7.0)) + h * 60.0);
        return smoothstep(rad, 0.0, dist) * (0.07 / rad) * tw * (0.35 + 0.65 * fract(h * 13.0));
      }
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        // deep violet near the horizon (the fog colour), near black in the zenith and in the depth below
        vec3 deep = vec3(0.004, 0.003, 0.016);
        vec3 c = mix(fogCol, deep, smoothstep(0.0, 0.55, abs(y)));
        c += vec3(0.010, 0.004, 0.030) * smoothstep(0.7, 0.0, abs(y));
        // nebula: a tilted band of purple, teal and pink clouds with darker dust lanes
        vec3 q = d + vec3(0.0, 0.0, time * 0.0015);
        float band = exp(-pow(dot(d, normalize(vec3(0.55, 0.83, 0.08))) * 3.4, 2.0));
        float n1 = fbm(q * 2.1);
        float n2 = fbm(q * 4.3 + vec3(5.2, 1.3, 2.8));
        float n3 = fbm(q * 3.0 + vec3(9.1, 4.4, 0.7));
        float neb = smoothstep(0.32, 0.82, n1 * 0.75 + n2 * 0.45) * band;
        vec3 nc = mix(vec3(0.34, 0.08, 0.62), vec3(0.03, 0.42, 0.55), smoothstep(0.35, 0.65, n2));
        nc = mix(nc, vec3(0.80, 0.16, 0.48), smoothstep(0.5, 0.75, n3) * 0.85);
        float lanes = 1.0 - 0.75 * smoothstep(0.5, 0.72, fbm(q * 7.0 + 3.3)) * band;
        c += nc * neb * 0.95 * lanes;
        c += vec3(0.10, 0.06, 0.25) * band * n1 * 0.25;
        // a second nebula below the horizon (around 30 degrees down): dim straight behind the board (-z), brighter toward the sides
        float az = atan(d.x, -d.z);
        float lowBand = exp(-pow((y + 0.5) / 0.24, 2.0));
        float sideK = mix(0.25, 1.0, smoothstep(0.2, 0.75, abs(az)));
        float nb = smoothstep(0.34, 0.8, fbm(q * 2.6 + vec3(3.0, 7.0, 1.0)) * 0.8 + n2 * 0.4) * lowBand;
        vec3 nc2 = mix(vec3(0.04, 0.34, 0.56), vec3(0.58, 0.12, 0.62), smoothstep(0.3, 0.7, n3));
        nc2 = mix(nc2, vec3(0.85, 0.25, 0.45), smoothstep(0.62, 0.8, n1) * 0.6);
        c += nc2 * nb * sideK * 0.9 + vec3(0.012, 0.008, 0.034) * lowBand * sideK;
        neb = max(neb, nb * sideK);
        // a nebula patch toward -x (the sky of the low view)
        float pk = smoothstep(0.72, 0.97, dot(d, normalize(vec3(-1.0, 0.25, 0.0))));
        float pn = smoothstep(0.3, 0.78, fbm(q * 3.4 + vec3(2.0, 5.0, 8.0)) * 0.7 + n2 * 0.4) * pk;
        c += mix(vec3(0.62, 0.14, 0.58), vec3(0.06, 0.45, 0.62), smoothstep(0.35, 0.7, n3)) * pn * 0.55;
        neb = max(neb, pn * 0.6);
        // stars: two dense faint layers, brighter where the nebula glows
        float s = stars(d, 170.0, 0.32, 0.0) + stars(d, 95.0, 0.22, 17.0) * 1.4;
        vec3 sc = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.85, 0.75), hash3(floor(d * 95.0 + 17.0) + 8.0));
        c += sc * s * (0.55 + neb) * (0.25 + 0.75 * smoothstep(0.0, 0.18, abs(y)));
        // a shooting star now and then
        float per = 4.0, k = floor(time / per), ph = fract(time / per) * per;
        vec3 a = normalize(vec3(hash3(vec3(k, 1, 2)) - 0.5, (hash3(vec3(k, 3, 4)) - 0.5) * 1.3, hash3(vec3(k, 5, 6)) - 0.5));
        vec3 tg = normalize(cross(a, vec3(hash3(vec3(k, 7, 8)) - 0.5, 1.0, hash3(vec3(k, 9, 1)) - 0.5)));
        float head = ph * 0.45;
        float ang = atan(dot(d, tg), dot(d, a));
        float side = abs(dot(d, cross(a, tg)));
        float tail = clamp((ang - head + 0.22) / 0.22, 0.0, 1.0) * step(ang, head) * step(0.0, ang);
        float life = smoothstep(0.0, 0.15, ph) * smoothstep(0.9, 0.5, ph);
        c += vec3(0.7, 0.9, 1.0) * tail * tail * smoothstep(0.0025, 0.0, side) * life * 2.0;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(120, lite ? 32 : 48, lite ? 16 : 24), mat);
  mesh.name = 'sky'; mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}

/** Fixed points with a world size each (stars, beacons, station lights): twinkle (mode 0) or a sharp blink (mode 1). */
function fixedPoints(list, texture) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), aux = new Float32Array(n * 3), c = new THREE.Color();
  list.forEach((p, i) => {
    pos.set(p.p, i * 3); c.set(p.c).multiplyScalar(p.k ?? 1); col.set([c.r, c.g, c.b], i * 3);
    aux.set([p.s, p.ph ?? 0, p.m ?? 0], i * 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aux', new THREE.BufferAttribute(aux, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, map: { value: texture }, scale: { value: 400 } },
    vertexShader: `uniform float time, scale; attribute vec3 aux; attribute vec3 color; varying vec3 vCol; varying float vA;
      void main() {
        float tw = aux.z < 0.5 ? 0.7 + 0.3 * sin(time * (1.0 + 3.0 * fract(aux.y * 3.7)) + aux.y * 6.283)
                               : 0.08 + 0.92 * pow(max(0.0, sin(time * 2.2 + aux.y * 6.283)), 12.0);
        vA = tw; vCol = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, aux.x * scale / max(0.1, -mv.z));
      }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vCol; varying float vA;
      void main() { float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.004) discard; gl_FragColor = vec4(vCol, a);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.onBeforeRender = (renderer) => { const h = renderer.getDrawingBufferSize(_v2).y; mat.uniforms.scale.value = h * 0.5 / Math.tan(17.5 * Math.PI / 180); };
  return pts;
}
const _v2 = new THREE.Vector2();

function planetMaterial(lite, light) {
  return new THREE.ShaderMaterial({
    fog: false,
    defines: { OCTAVES: lite ? 3 : 4 },
    uniforms: { time: { value: 0 }, L: { value: light } },
    vertexShader: `varying vec3 vN, vNv, vPv;
      void main() { vN = normal; vNv = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float time; uniform vec3 L; varying vec3 vN, vNv, vPv;
      ${NOISE}
      void main() {
        vec3 n = normalize(vN);
        float sp = time * 0.006, cs = cos(sp), sn = sin(sp);
        vec3 q = vec3(cs * n.x - sn * n.z, n.y, sn * n.x + cs * n.z);
        float w = fbm(vec3(q.x * 2.2, q.y * 16.0, q.z * 2.2)) - 0.5;
        float w2 = fbm(q * 6.0 + 4.0) - 0.5;
        float b = q.y * 6.5 + w * 1.6 + w2 * 0.35;
        vec3 col = mix(vec3(0.96, 0.80, 0.62), vec3(0.88, 0.48, 0.30), 0.5 + 0.5 * sin(b * 3.1));
        col = mix(col, vec3(0.62, 0.22, 0.16), smoothstep(0.55, 1.0, sin(b * 1.7 + 1.0)) * 0.8);
        col = mix(col, vec3(0.62, 0.50, 0.85), smoothstep(0.65, 1.0, sin(b * 0.9 + 2.0)) * 0.7);
        col = mix(col, vec3(1.0, 0.93, 0.85), smoothstep(0.75, 1.0, sin(b * 4.3)) * 0.35);
        // a big storm oval
        vec2 so = vec2((atan(q.z, q.x) - 2.3) * 1.0, (q.y + 0.32) * 3.4);
        float sd = length(so);
        float swirl = sin(sd * 18.0 - atan(so.y, so.x) * 2.0 + w2 * 6.0);
        col = mix(col, mix(vec3(0.85, 0.30, 0.22), vec3(1.0, 0.78, 0.62), 0.5 + 0.5 * swirl), smoothstep(0.32, 0.12, sd));
        float ndl = dot(n, L);
        float lit = smoothstep(-0.10, 0.55, ndl);
        vec3 c = col * (0.015 + 1.15 * lit);
        c += col * vec3(0.9, 0.35, 0.2) * exp(-pow((ndl - 0.02) / 0.12, 2.0)) * 0.35;
        c += vec3(0.04, 0.02, 0.10) * (1.0 - lit);
        float fr = pow(1.0 - max(0.0, dot(normalize(vNv), normalize(-vPv))), 3.0);
        c += vec3(0.45, 0.55, 1.0) * fr * (0.15 + 1.1 * smoothstep(-0.35, 0.5, ndl));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function ringMaterial(light, R) {
  return new THREE.ShaderMaterial({
    fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { L: { value: light }, R: { value: R } },
    vertexShader: `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 L; uniform float R; varying vec3 vP;
      float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
      float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main() {
        vec3 p = vP / R;
        float r = length(p.xz);
        float a = smoothstep(1.38, 1.48, r) * smoothstep(2.22, 2.0, r);
        a *= 0.25 + 0.6 * n1(r * 34.0) + 0.12 * n1(r * 90.0);
        a *= 1.0 - 0.97 * smoothstep(0.045, 0.03, abs(r - 1.93));
        a *= 1.0 - 0.9 * smoothstep(0.022, 0.012, abs(r - 1.62));
        float t = dot(p, L);
        float sh = (t < 0.0 && length(p - t * L) < 1.0) ? 0.12 : 1.0;
        vec3 col = mix(vec3(0.95, 0.85, 0.72), vec3(0.72, 0.62, 0.95), n1(r * 7.0));
        gl_FragColor = vec4(col * sh * 1.05, a * 0.5);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function moonMaterial(light, tint = [1, 1, 1], lite = false) {
  return new THREE.ShaderMaterial({
    fog: false, defines: { OCTAVES: lite ? 3 : 4 },
    uniforms: { L: { value: light }, tint: { value: new THREE.Vector3(...tint) } },
    vertexShader: `varying vec3 vN, vNv, vPv;
      void main() { vN = normal; vNv = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 L, tint; varying vec3 vN, vNv, vPv;
      ${NOISE}
      vec3 h33(vec3 p) { return vec3(hash3(p), hash3(p + 11.7), hash3(p + 23.1)); }
      // craters from cellular noise: a dark floor and a bright rim around each cell's feature point
      float craters(vec3 p) {
        vec3 i = floor(p), f = fract(p); float best = 9.0, rad = 0.4;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
          vec3 o = vec3(x, y, z), h = h33(i + o);
          float dd = length(o + h - f);
          if (dd < best) { best = dd; rad = 0.18 + 0.3 * hash3(i + o + 5.0); }
        }
        return smoothstep(rad * 0.8, rad, best) * smoothstep(rad + 0.12, rad, best) * 0.6 - smoothstep(rad, rad * 0.5, best) * 0.25;
      }
      void main() {
        vec3 n = normalize(vN);
        float maria = smoothstep(0.5, 0.62, fbm(n * 1.6 + 3.0));
        float alb = mix(0.8, 0.45, maria) + (fbm(n * 6.0) - 0.5) * 0.15;
        alb += craters(n * 5.0) * 0.5 + craters(n * 11.0 + 4.0) * 0.3;
        vec3 col = alb * vec3(0.86, 0.88, 0.98) * tint;
        float lit = smoothstep(-0.04, 0.35, dot(n, L));
        vec3 c = col * (0.015 + 1.05 * lit) + vec3(0.012, 0.012, 0.04);
        float fr = pow(1.0 - max(0.0, dot(normalize(vNv), normalize(-vPv))), 4.0);
        c += vec3(0.5, 0.6, 1.0) * fr * 0.3 * lit;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function iceMaterial(light, lite) {
  return new THREE.ShaderMaterial({
    fog: false, defines: { OCTAVES: lite ? 3 : 4 },
    uniforms: { L: { value: light } },
    vertexShader: `varying vec3 vN, vNv, vPv;
      void main() { vN = normal; vNv = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 L; varying vec3 vN, vNv, vPv;
      ${NOISE}
      void main() {
        vec3 n = normalize(vN);
        float lit = smoothstep(-0.05, 0.4, dot(n, L));
        float tone = fbm(n * 3.0);
        vec3 col = mix(mix(vec3(0.011, 0.035, 0.08), vec3(0.02, 0.14, 0.2), tone), mix(vec3(0.35, 0.79, 1.0), vec3(0.62, 0.92, 1.0), tone), lit);
        float rd = 1.0 - abs(vnoise(n * 5.0) * 2.0 - 1.0);
        float rd2 = 1.0 - abs(vnoise(n * 11.0 + 3.0) * 2.0 - 1.0);
        float crack = smoothstep(0.955, 0.985, rd) + smoothstep(0.97, 0.99, rd2) * 0.6;
        col += vec3(0.75, 0.95, 1.0) * crack * 0.35 * (0.3 + 0.7 * lit);
        float fr = pow(1.0 - max(0.0, dot(normalize(vNv), normalize(-vPv))), 3.0);
        col += vec3(0.25, 0.85, 1.0) * fr * 0.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

const SIDES = 16, SEG = Math.PI / SIDES;   // the deck is a 16 sided polygon, flat sides facing the axes
const DECK = 10.3;   // apothem
const DECK_R = DECK / Math.cos(SEG);
const INNER_R = 7.6;   // plain plates inside, detailed radial plates outside

function plate(g, r, x0, y0, W, H, base) {
  const l = base[2] + r() * 3, hue = base[0] + r() * 6;
  g.fillStyle = `hsl(${hue}, ${base[1]}%, ${l}%)`; g.fillRect(x0, y0, W, H);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + r() * 0.03})`;
    g.fillRect(x0 + r() * W, y0 + r() * H, 10 + r() * W * 0.5, Math.max(1, H / 200));
  }
}
function rivets(g, x0, y0, W, H, s) {
  const m = 12 * s;
  for (const [cx, cy] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x0 + cx, y0 + cy + s, 3 * s, 0, 7); g.fill();
    g.fillStyle = 'rgba(200,215,240,0.3)'; g.beginPath(); g.arc(x0 + cx, y0 + cy, 2.5 * s, 0, 7); g.fill();
  }
}
function grooveRect(g, x0, y0, W, H, lw) {
  g.fillStyle = 'rgba(3,5,12,0.85)';
  g.fillRect(x0, y0, W, lw / 2); g.fillRect(x0, y0 + H - lw / 2, W, lw / 2); g.fillRect(x0, y0, lw / 2, H); g.fillRect(x0 + W - lw / 2, y0, lw / 2, H);
  g.fillStyle = 'rgba(190,210,255,0.12)';
  g.fillRect(x0 + lw / 2, y0 + lw / 2, W - lw, Math.max(1, lw / 3)); g.fillRect(x0 + lw / 2, y0 + lw / 2, Math.max(1, lw / 3), H - lw);
}
const BASE = [216, 30, 13];

/** Inner deck tile (8 x 8 units: one large plate, very faint seams at its edges). */
function innerTexture(px) {
  const r = rng(31);
  return canvasTexture(px, px, (g, w) => {
    plate(g, r, 0, 0, w, w, BASE);
    g.fillStyle = 'rgba(3,5,12,0.3)'; const lw = Math.max(2, w / 200);
    g.fillRect(0, 0, w, lw / 2); g.fillRect(0, w - lw / 2, w, lw / 2); g.fillRect(0, 0, lw / 2, w); g.fillRect(w - lw / 2, 0, lw / 2, w);
  }, { repeat: true });
}

/** Outer ring tiles: 4 sides of the 16 gon across (u), the ring width (v, outer edge on top), random plate kinds. */
function outerTextures(w, h) {
  const r = rng(57), s = w / 1024, cols = 4, P = w / cols, H2 = h / 2;
  const kinds = [];
  const map = canvasTexture(w, h, (g) => {
    for (let c = 0; c < cols; c++) for (let row = 0; row < 2; row++) {
      const x0 = c * P, y0 = row * H2, kind = Math.floor(r() * 4);
      kinds.push(kind);
      plate(g, r, x0, y0, P, H2, BASE);
      if (kind === 1) {   // vent slots
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x0 + P * 0.18, y0 + H2 * 0.22, P * 0.64, H2 * 0.56);
        g.fillStyle = 'rgba(4,7,16,0.2)';
        for (let i = 0; i < 7; i++) g.fillRect(x0 + P * 0.22 + i * P * 0.083, y0 + H2 * 0.28, P * 0.04, H2 * 0.44);
      } else if (kind === 2) {   // grip
        g.fillStyle = 'rgba(0,0,0,0.2)';
        for (let yy = 16 * s; yy < H2 - 16 * s; yy += 12 * s) for (let xx = 16 * s + ((yy / (12 * s)) % 2) * 6 * s; xx < P - 16 * s; xx += 12 * s) g.fillRect(x0 + xx, y0 + yy, 5 * s, 2 * s);
      } else if (kind === 3) {   // hatch
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3 * s; g.strokeRect(x0 + P * 0.25, y0 + H2 * 0.25, P * 0.5, H2 * 0.5);
        g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1.5 * s; g.strokeRect(x0 + P * 0.25 + 3 * s, y0 + H2 * 0.25 + 3 * s, P * 0.5 - 6 * s, H2 * 0.5 - 6 * s);
      }
      if (row === 0 && r() < 0.6) {   // hazard edge along the deck rim
        const bh = H2 * 0.13;
        g.save(); g.beginPath(); g.rect(x0 + 6 * s, y0 + 5 * s, P - 12 * s, bh); g.clip();
        g.fillStyle = 'rgba(20,20,26,0.9)'; g.fillRect(x0, y0, P, bh + 10 * s);
        g.fillStyle = 'rgba(214,170,40,0.75)';
        for (let x = -bh; x < P + bh; x += bh * 1.6) { g.beginPath(); g.moveTo(x0 + x, y0 + 5 * s + bh); g.lineTo(x0 + x + bh * 0.8, y0 + 5 * s + bh); g.lineTo(x0 + x + bh * 1.6, y0 + 5 * s); g.lineTo(x0 + x + bh * 0.8, y0 + 5 * s); g.fill(); }
        g.restore();
      }
      rivets(g, x0, y0, P, H2, s);
      grooveRect(g, x0, y0, P, H2, Math.max(2, 5 * s));
    }
  }, { repeat: true });
  const emissive = canvasTexture(w, h, (g) => {
    g.fillStyle = 'rgb(6,8,18)'; g.fillRect(0, 0, w, h);
    // soft blue light in the radial seams, a node where the seams cross
    for (let c = 0; c <= cols; c++) {
      const x = c * P, lw = Math.max(2, 3 * s);
      const gr = g.createLinearGradient(0, h * 0.1, 0, h * 0.9);
      gr.addColorStop(0, 'rgba(60,170,255,0)'); gr.addColorStop(0.5, 'rgba(60,170,255,0.85)'); gr.addColorStop(1, 'rgba(60,170,255,0)');
      g.fillStyle = gr; g.fillRect(x - lw / 2, h * 0.1, lw, h * 0.8);
      const rg = g.createRadialGradient(x, H2, 0, x, H2, 14 * s);
      rg.addColorStop(0, 'rgba(150,215,255,1)'); rg.addColorStop(1, 'rgba(40,110,255,0)');
      g.fillStyle = rg; g.fillRect(x - 14 * s, H2 - 14 * s, 28 * s, 28 * s);
    }
    g.fillStyle = 'rgba(80,190,255,0.9)'; g.fillRect(0, h - Math.max(2, 3 * s), w, Math.max(2, 3 * s));   // a thin cyan seam at the inner edge
  }, { repeat: true });
  map.wrapT = emissive.wrapT = THREE.ClampToEdgeWrapping;
  return { map, emissive };
}

/** A polygon ring of boxes (one per side, n sides) at apothem a: width wd, height ht, centre height y. */
function polyRing(n, a, wd, ht, y, color, parts, inset = 0) {
  const len = 2 * a * Math.tan(Math.PI / n) - inset;
  for (let i = 0; i < n; i++) {
    const ang = i * 2 * Math.PI / n;
    parts.push([tint(new THREE.BoxGeometry(len, ht, wd), color), mat4([Math.sin(ang) * a, y, Math.cos(ang) * a], [0, ang, 0])]);
  }
}

/** A craggy rock: displaced icosahedron with a few flat cuts, one colour (flat shaded). */
function rockGeometry(seed, color) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const r = rng(seed), p = g.attributes.position, v = new THREE.Vector3(), dir = new THREE.Vector3();
  const f = [0, 1, 2, 3].map(() => [r() * 3 + 1.5, r() * 6.28, r() * 3 + 1.5, r() * 6.28]);
  const cuts = Array.from({ length: 3 + Math.floor(r() * 2) }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 0.55 + r() * 0.3]);
  const sx = 0.8 + r() * 0.5, sy = 0.6 + r() * 0.3;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize(); dir.copy(v);
    let k = 1;
    for (const [a, b, c, d] of f) k += 0.075 * Math.sin(dir.x * a + b) * Math.cos(dir.z * c + d + dir.y * 2.0) * 4 / f.length;
    v.multiplyScalar(k * (1 + (Math.sin(dir.x * 7 + seed) * 0.5 + 0.5) * 0.3 - 0.15));
    for (const [n, o] of cuts) { const t = v.dot(n); if (t > o) v.addScaledVector(n, o - t); }
    p.setXYZ(i, v.x * sx, v.y * sy, v.z);
  }
  g.computeVertexNormals();
  // per face colour: around the rock's colour, between rust and dark grey
  const a = new THREE.Color(color), rust = new THREE.Color('#7f4a2e'), grey = new THREE.Color('#34333a'), c = new THREE.Color();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    c.copy(a).lerp(r() < 0.5 ? rust : grey, r() * 0.6).multiplyScalar(0.85 + r() * 0.3);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function build({ lite }) {
  const group = new THREE.Group();
  const r = rng(2026);
  const dot = glowTexture(64, 2.0);

  // sky, planet, moons (no fog: they sit beyond it)
  const sky = skySphere(lite);
  group.add(sky);

  // the gas giant hangs below the horizon, about 30 degrees off the play view's centre, lit from outside (a crescent toward the frame corner)
  const sunDir = new THREE.Vector3(-0.6, 0.6, -0.5).normalize();
  const R = 22;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, lite ? 40 : 72, lite ? 28 : 48), null);
  const pDir = new THREE.Vector3(-0.42, -0.53, -0.73).normalize();
  planet.position.copy(pDir).multiplyScalar(118);
  planet.rotation.set(0.32, 0.0, -0.22);
  planet.updateMatrix();
  const toLocal = new THREE.Matrix4().extractRotation(planet.matrix).invert();
  const lightLocal = sunDir.clone().applyMatrix4(toLocal).normalize();
  planet.material = planetMaterial(lite, lightLocal);
  planet.name = 'planet';
  const ringGeo = new THREE.RingGeometry(R * 1.35, R * 2.15, lite ? 96 : 160, 1);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, ringMaterial(lightLocal, R));
  ring.renderOrder = 1;
  planet.add(ring);
  group.add(planet);

  // the moon (seen from the low views at -x, half lit) and a small icy body that balances the planet on the other side
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, lite ? 24 : 40, lite ? 16 : 28), moonMaterial(new THREE.Vector3(0.1, 0.3, 1).normalize(), [1.0, 0.96, 0.92], lite));
  moon.position.set(-96, 11, 30);
  group.add(moon);
  const ice = new THREE.Mesh(new THREE.SphereGeometry(4.2, lite ? 20 : 32, lite ? 14 : 22), iceMaterial(sunDir, lite));
  const iceDir = new THREE.Vector3(0.4, -0.48, -0.78).normalize();
  ice.position.copy(iceDir).multiplyScalar(112);
  group.add(ice);

  // star points: bright coloured stars all around, more in the nebula band; buoy and station lights share the shader
  const pts = [];
  const nStars = lite ? 220 : 1500, sc = new THREE.Vector3();
  const starCols = ['#ffffff', '#cfe0ff', '#a9c6ff', '#fff1d6', '#ffd2b0', '#ffc8ec', '#bff6ff'];
  const bandN = new THREE.Vector3(0.55, 0.83, 0.08).normalize();
  for (let i = 0; i < nStars; i++) {
    sc.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (sc.lengthSq() > 1 || sc.lengthSq() < 0.01) { i--; continue; }
    sc.normalize();
    if (Math.abs(sc.dot(bandN)) > 0.45 && r() < 0.45) { i--; continue; }   // denser along the band
    const big = r() < 0.06;
    pts.push({ p: sc.multiplyScalar(105).toArray(), c: starCols[Math.floor(r() * starCols.length)], k: big ? 2.2 : 0.7 + r() * 0.9, s: big ? 1.6 + r() * 1.2 : 0.35 + r() * 0.55, ph: r() });
  }

  // the deck: plain dark plates inside, radial plates with vents, hazard edges and seam lights outside
  const tint8 = '#b8c8ff';
  const inner = new THREE.CircleGeometry(INNER_R, SIDES, SEG);
  inner.rotateX(-Math.PI / 2);
  { const p = inner.attributes.position, uv = inner.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 4) / 8, (-p.getZ(i) + 4) / 8); }
  { const n = inner.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.fill(i === 0 ? 0.95 : 0.7, i * 3, i * 3 + 3); inner.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  inner.translate(0, FLOOR_Y, 0);
  const innerMat = new THREE.MeshStandardMaterial({ color: tint8, vertexColors: true, map: innerTexture(lite ? 256 : 512), emissive: new THREE.Color(6 / 255, 8 / 255, 18 / 255), metalness: 0.35, roughness: 0.5, envMapIntensity: 0.35 });
  const innerMesh = new THREE.Mesh(inner, innerMat);
  innerMesh.receiveShadow = true; innerMesh.name = 'deck';
  group.add(innerMesh);
  const outer = new THREE.RingGeometry(INNER_R, DECK_R, SIDES, 2, SEG);
  outer.rotateX(-Math.PI / 2);
  { const uv = outer.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (i % (SIDES + 1)) / 4, Math.floor(i / (SIDES + 1)) / 2); }
  outer.translate(0, FLOOR_Y, 0);
  const otex = outerTextures(lite ? 512 : 1024, lite ? 128 : 256);
  const deckMat = new THREE.MeshStandardMaterial({ color: tint8, map: otex.map, emissiveMap: otex.emissive, emissive: new THREE.Color(0.45, 0.85, 1.7), metalness: 0.35, roughness: 0.5, envMapIntensity: 0.35 });
  const outerMesh = new THREE.Mesh(outer, deckMat);
  outerMesh.receiveShadow = true; outerMesh.name = 'deck-outer';
  group.add(outerMesh);

  // trim: deck rim slab, hull below, dais under the board, railing (one merged mesh, vertex colours)
  const trim = [];
  const T = '#5d6880', DARK = '#262c3c', HULL = '#1e2333';
  trim.push([tint(new THREE.CylinderGeometry(DECK_R, DECK_R * 0.97, 0.5, SIDES, 1, true, SEG), '#3a4357'), mat4([0, FLOOR_Y - 0.25, 0])]);
  trim.push([tint(new THREE.CylinderGeometry(DECK_R * 0.97, 2.6, 6, SIDES, 1, true, SEG), HULL), mat4([0, FLOOR_Y - 0.5 - 3, 0])]);
  trim.push([tint(new THREE.CylinderGeometry(2.6, 1.3, 1.8, SIDES, 1, false, SEG), DARK), mat4([0, FLOOR_Y - 7.4, 0])]);
  // dais under the board: an octagon pedestal (apothem 4.4), its top just under the plinth bottom
  const OCT = Math.PI / 8, daisR = 4.4 / Math.cos(OCT);
  trim.push([tint(new THREE.CylinderGeometry(daisR, daisR + 0.15, 0.62, 8, 1), '#434c62'), mat4([0, FLOOR_Y + 0.31, 0], [0, OCT, 0])]);
  trim.push([tint(new THREE.CylinderGeometry(daisR + 0.06, daisR + 0.06, 0.1, 8, 1), '#6a7590'), mat4([0, -0.6, 0], [0, OCT, 0])]);
  // railing at the edge (apothem 10.05: clear of the flat zone's corners at radius 9.9), top at y -0.3
  const railA = DECK - 0.25;
  const rail = [];
  polyRing(SIDES, railA, 0.08, 0.08, FLOOR_Y + 0.9, T, rail, 0.1);
  polyRing(SIDES, railA, 0.05, 0.05, FLOOR_Y + 0.5, T, rail, 0.1);
  for (let i = 0; i < SIDES; i++) {
    const ang = i * 2 * Math.PI / SIDES;
    rail.push([tint(new THREE.BoxGeometry(0.05, 0.96, 0.05), DARK), mat4([Math.sin(ang) * (railA + 0.02), FLOOR_Y + 0.48, Math.cos(ang) * (railA + 0.02)], [0, ang, 0])]);
    const ca = ang + SEG, cr = railA / Math.cos(SEG);
    rail.push([tint(new THREE.BoxGeometry(0.06, 1.0, 0.06), DARK), mat4([Math.sin(ca) * cr, FLOOR_Y + 0.5, Math.cos(ca) * cr], [0, ca, 0])]);
  }
  const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.42, envMapIntensity: 0.7 });
  const trimMesh = mergeMesh(trim, trimMat, 'deck-trim');
  trimMesh.receiveShadow = true;
  group.add(trimMesh);
  // the railing fades out on the near half when the camera is outside it (no cage in front of the low views), dithered
  const railMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.42, envMapIntensity: 0.7 });
  railMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRailW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRailW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRailW;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float railFade = smoothstep(${(railA + 0.5).toFixed(2)}, ${(railA + 1.5).toFixed(2)}, length(cameraPosition.xz))
          * smoothstep(0.45, 0.55, dot(normalize(vRailW.xz), normalize(cameraPosition.xz)));
        if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < railFade) discard;`);
  };
  group.add(mergeMesh(rail, railMat, 'railing'));

  // glowing parts: one solid rim light, the dais band, light bands around the hull (one unlit mesh)
  const glow = [];
  const CY = '#2fa8ff', MG = '#ff4fd2';
  polyRing(SIDES, DECK + 0.02, 0.04, 0.09, FLOOR_Y - 0.12, CY, glow);
  glow.push([tint(new THREE.CylinderGeometry(daisR + 0.03, daisR + 0.12, 0.05, 8, 1, true), CY), mat4([0, FLOOR_Y + 0.12, 0], [0, OCT, 0])]);
  const hullTop = DECK_R * 0.97, hullAt = (d) => hullTop - (hullTop - 2.6) * d / 6;
  for (const [d, c] of [[1.3, CY], [3.0, MG], [4.6, CY]]) {
    glow.push([tint(new THREE.CylinderGeometry(hullAt(d - 0.06) + 0.06, hullAt(d + 0.06) + 0.06, 0.12, SIDES, 1, true, SEG), c), mat4([0, FLOOR_Y - 0.5 - d, 0])]);
  }
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  group.add(mergeMesh(glow, glowMat, 'deck-glow'));
  pts.push({ p: [0, FLOOR_Y - 8.6, 0], c: '#4aa8ff', k: 1.6, s: 4, ph: 0.3 });   // engine glow under the keel

  // floating buoys around the deck (radius 18 and more, below the deck level), bobbing, their tips blink
  const buoys = new THREE.Group();
  const bParts = [], bGlow = [], bPts = [];
  const nB = lite ? 4 : 6;
  for (let i = 0; i < nB; i++) {
    const a = (i + 0.5) / nB * Math.PI * 2, rr = 18.5 + (i % 2) * 2.5, y = -3.2 - (i % 3) * 1.1;
    const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
    bParts.push([tint(new THREE.CylinderGeometry(0.45, 0.05, 0.9, 8), DARK), mat4([x, y - 0.45, z])]);
    bParts.push([tint(new THREE.CylinderGeometry(0.05, 0.45, 0.5, 8), T), mat4([x, y + 0.25, z])]);
    bParts.push([tint(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 5), T), mat4([x, y + 0.85, z])]);
    bGlow.push([tint(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 8, 1, true), i % 2 ? MG : CY), mat4([x, y, z])]);
    bPts.push({ p: [x, y + 1.25, z], c: i % 2 ? MG : CY, k: 2.4, s: 1.2, ph: i / nB, m: 1 });
  }
  buoys.add(mergeMesh(bParts, trimMat, 'buoys'), mergeMesh(bGlow, glowMat, 'buoy-glow'));
  const buoyPts = fixedPoints(bPts, dot);
  buoys.add(buoyPts);
  group.add(buoys);

  // asteroids: far rocks (radius 46 to 68, at least 8 degrees off the horizon, never over the moons or the planet), a belt below
  // the deck, and a few small ones drifting through the void band in front of the play view (radius beyond 17, y below -3)
  const keepOut = [[pDir, 20], [iceDir, 10], [moon.position.clone().normalize(), 15]].map(([d, deg]) => [d, Math.cos(deg * Math.PI / 180)]);
  const blocked = (x, y, z) => { v.set(x, y, z).normalize(); return keepOut.some(([d, c]) => v.dot(d) > c); };
  const rockCols = ['#3d3632', '#4a3f38', '#5a4636', '#6b4632', '#7a4630'];
  const rockParts = [], driftParts = [], v = new THREE.Vector3();
  const nRocks = lite ? 8 : 20;
  for (let i = 0, tries = 0; i < nRocks && tries < 500; tries++) {
    const far = i % 3 === 0, ang = r() * Math.PI * 2;
    let rad, y;
    if (far) { rad = 46 + r() * 22; const el = (8 + r() * 18) * (r() < 0.5 ? -1 : 1) * Math.PI / 180; y = Math.tan(el) * rad; }
    else { rad = 20 + r() * 34; y = -6 - r() * 18; }
    if (blocked(Math.cos(ang) * rad, y, Math.sin(ang) * rad)) continue;
    const s = far ? 0.9 + r() * 1.6 : 0.4 + r() * 1.3;
    rockParts.push([rockGeometry(9 + i, rockCols[Math.floor(r() * rockCols.length)]), mat4([Math.cos(ang) * rad, y, Math.sin(ang) * rad], [r() * 6, r() * 6, r() * 6], s)]);
    i++;
  }
  const nDrift = lite ? 3 : 7;
  for (let i = 0, tries = 0; i < nDrift && tries < 200; tries++) {
    const ang = -Math.PI / 2 + (i / nDrift - 0.5) * 2.2 + r() * 0.2, rad = 18 + r() * 10, y = -4 - r() * 6;
    if (blocked(Math.cos(ang) * rad, y, Math.sin(ang) * rad)) continue;
    i++;
    driftParts.push([rockGeometry(40 + i, rockCols[Math.floor(r() * rockCols.length)]), mat4([Math.cos(ang) * rad, y, Math.sin(ang) * rad], [r() * 6, r() * 6, r() * 6], 0.25 + r() * 0.45)]);
  }
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#0b0e1c', roughness: 0.95, metalness: 0.0, flatShading: true, fog: false });
  rockMat.onBeforeCompile = (sh) => {   // a faint cool rim
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.27, 0.48, 1.0) * 0.3 * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);');
  };
  const rockMesh = mergeMesh(rockParts, rockMat, 'asteroids');
  const driftMesh = mergeMesh(driftParts, rockMat, 'asteroids-near');
  // a few big chunky rocks in the void band at the play view's top edge, left and right of the centre (they only sway)
  const bigParts = [[-24, -9, -17, 1.5], [17, -9, -27, 1.2]].map(([x, y, z, sc], i) => [rockGeometry(70 + i, rockCols[i + 1]), mat4([x, y, z], [r() * 6, r() * 6, r() * 6], sc)]);
  const bigMesh = mergeMesh(bigParts, rockMat, 'asteroids-big');
  group.add(rockMesh, driftMesh, bigMesh);
  const placeRocks = (t) => {
    rockMesh.rotation.y = t * 0.008; rockMesh.position.y = Math.sin(t * 0.12) * 0.4;
    bigMesh.rotation.y = Math.sin(t * 0.05) * 0.06; bigMesh.position.y = Math.sin(t * 0.2 + 1.0) * 0.3;
    driftMesh.rotation.y = t * 0.02; driftMesh.position.y = Math.sin(t * 0.3) * 0.35;
  };

  // a far space station (full quality): a slowly turning ring with spokes, a hub and solar wings
  let station = null;
  if (!lite) {
    const st = [];
    st.push(tint(new THREE.TorusGeometry(4, 0.45, 8, 40), '#8a93ad'));
    st.push([tint(new THREE.CylinderGeometry(0.8, 0.8, 3.2, 12), '#9aa3bb'), mat4([0, 0, 0], [Math.PI / 2, 0, 0])]);
    for (let i = 0; i < 4; i++) st.push([tint(new THREE.CylinderGeometry(0.12, 0.12, 7.6, 6), '#6f7891'), mat4([0, 0, 0], [0, 0, i * Math.PI / 4])]);
    st.push([tint(new THREE.BoxGeometry(5, 1.4, 0.06), '#2c3f8a'), mat4([0, 0, 2.6])]);
    st.push([tint(new THREE.BoxGeometry(1.4, 5, 0.06), '#2c3f8a'), mat4([0, 0, -2.6])]);
    station = mergeMesh(st, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, emissive: '#151a36' }), 'station');
    station.position.set(48, 9, 70);
    station.rotation.set(0.4, -0.6, 0);
    group.add(station);
    const sw = new THREE.Vector3();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      sw.set(Math.cos(a) * 4, Math.sin(a) * 4, 0).applyEuler(station.rotation).add(station.position);
      pts.push({ p: sw.toArray(), c: i % 5 === 0 ? '#ff6a6a' : '#ffe2a0', k: 1.6, s: i % 5 === 0 ? 1.4 : 0.9, ph: i / 10, m: i % 5 === 0 ? 1 : 0 });
    }
  }
  const starPts = fixedPoints(pts, dot);
  group.add(starPts);

  // dust motes above the deck (never below y = 1)
  const dust = particles({
    count: lite ? 50 : 240, box: { min: [-20, 1.2, -20], max: [20, 11, 20] }, vel: [0.06, 0.03, 0.04], jitter: 0.6, sway: 0.35,
    size: 0.09, colors: ['#9fdcff', '#c8b4ff', '#ffffff'], texture: dot, opacity: 0.7, twinkle: 0.6, seed: 77,
  });
  group.add(dust);

  // two soft coloured lights over the outer deck (full quality only)
  if (!lite) {
    const l1 = new THREE.PointLight('#4fb6ff', 7, 12, 2); l1.position.set(6.6, 0.4, -6.6);
    const l2 = new THREE.PointLight('#d070ff', 5, 12, 2); l2.position.set(-6.6, 0.4, 6.6);
    group.add(l1, l2);
  }

  const base = glowMat.color.clone();
  return {
    group,
    look: { fog: FOG, near: 1.5, far: 40 },
    update(dt, t) {
      tick(t, sky, planet, starPts, buoyPts, dust);
      placeRocks(t);
      buoys.position.y = Math.sin(t * 0.6) * 0.22;
      buoys.rotation.y = t * 0.01;
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
      glowMat.color.copy(base).multiplyScalar(pulse);
      deckMat.emissiveIntensity = 0.8 + 0.2 * Math.sin(t * 1.3 + 0.6);
      if (station) station.rotateZ(dt * 0.05);
    },
  };
}
