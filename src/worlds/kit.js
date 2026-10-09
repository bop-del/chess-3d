// Shared helpers for the backdrop worlds (CHE-370): a seeded random, canvas textures, a sky dome, a soft glow sprite texture,
// GPU particles (moved in the vertex shader, no per frame CPU work) and geometry merging (few draw calls on a phone).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Seeded random in [0, 1): the same world every load. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

/** A canvas texture drawn by draw(ctx2d, w, h); sRGB, mipmapped. */
export function canvasTexture(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A soft round dot (white, alpha falls off), for glows, sparks, stars and petals drawn as points. */
export function glowTexture(size = 64, falloff = 2.2) {
  return canvasTexture(size, size, (g, w) => {
    const img = g.createImageData(w, w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w * 2 - 1, dy = (y + 0.5) / w * 2 - 1, r = Math.min(1, Math.hypot(dx, dy));
      const a = Math.pow(1 - r, falloff), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
  });
}

/** A sky dome around everything (no fog, drawn first, behind the world). stops: [[0..1 height from horizon down to zenith, '#hex'], ...]
 *  from below the horizon (0) up to the zenith (1). extra(shader chunk) is optional GLSL added to the colour (vDir, time). */
export function skyDome({ radius = 120, stops, extraUniforms = {}, extra = '' }) {
  const cols = stops.map(([, c]) => new THREE.Color(c));
  const pos = stops.map(([p]) => p);
  while (cols.length < 6) { cols.push(cols[cols.length - 1]); pos.push(pos[pos.length - 1] + 1e-3); }
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { cols: { value: cols }, pos: { value: pos }, time: { value: 0 }, ...extraUniforms },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 cols[6]; uniform float pos[6]; uniform float time; varying vec3 vDir;
      ${Object.keys(extraUniforms).map((k) => `uniform ${glslType(extraUniforms[k].value)} ${k};`).join(' ')}
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 c = cols[0];
        for (int i = 1; i < 6; i++) c = mix(c, cols[i], smoothstep(pos[i - 1], pos[i], h));
        ${extra}
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.name = 'sky'; mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}
function glslType(v) {
  if (typeof v === 'number') return 'float';
  if (v?.isColor || v?.isVector3) return 'vec3';
  if (v?.isVector2) return 'vec2';
  if (v?.isVector4) return 'vec4';
  if (v?.isTexture) return 'sampler2D';
  return 'float';
}

/** GPU particles in a box: each point moves with its own speed and wraps around inside the box, all in the vertex shader.
 *  box: { min: [x,y,z], max: [x,y,z] }, vel: [x,y,z] base velocity, jitter: speed spread (0..1), sway: sideways wobble amplitude,
 *  size: world size, colors: ['#hex', ...] picked per point, additive, texture (glowTexture()), fade: fade in and out near the box ends
 *  along the main motion axis, twinkle: 0..1. Returns a THREE.Points; set .material.uniforms.time.value each frame (tick(points, t)). */
export function particles({ count, box, vel = [0, 1, 0], jitter = 0.4, sway = 0.2, size = 0.1, colors = ['#ffffff'], additive = true, texture, opacity = 1, twinkle = 0, seed = 7 }) {
  const r = rng(seed), pos = new Float32Array(count * 3), col = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = box.min[k] + r() * (box.max[k] - box.min[k]);
    c.set(colors[Math.floor(r() * colors.length)]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    rnd[i * 4] = r(); rnd[i * 4 + 1] = r(); rnd[i * 4 + 2] = r(); rnd[i * 4 + 3] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      time: { value: 0 }, map: { value: texture }, size: { value: size }, opacity: { value: opacity }, twinkle: { value: twinkle },
      bmin: { value: new THREE.Vector3(...box.min) }, bmax: { value: new THREE.Vector3(...box.max) },
      vel: { value: new THREE.Vector3(...vel) }, jitter: { value: jitter }, sway: { value: sway },
      scale: { value: 400 },
    },
    vertexShader: `uniform float time, size, jitter, sway, scale, twinkle; uniform vec3 bmin, bmax, vel; attribute vec4 rnd; attribute vec3 color;
      varying vec3 vCol; varying float vA;
      void main() {
        vec3 ext = bmax - bmin;
        vec3 v = vel * (1.0 + jitter * (rnd.x * 2.0 - 1.0));
        vec3 p = position + v * time;
        p.x += sin(time * (0.6 + rnd.y) + rnd.z * 6.283) * sway;
        p.z += cos(time * (0.5 + rnd.w) + rnd.y * 6.283) * sway;
        p = bmin + mod(p - bmin, ext);
        // fade near the box faces the motion leaves and enters through, so wrapping never pops
        vec3 f = (p - bmin) / ext;
        vec3 e = min(f, 1.0 - f) * 6.0;
        float a = 1.0;
        if (abs(vel.x) > 1e-4) a *= clamp(e.x, 0.0, 1.0);
        if (abs(vel.y) > 1e-4) a *= clamp(e.y, 0.0, 1.0);
        if (abs(vel.z) > 1e-4) a *= clamp(e.z, 0.0, 1.0);
        a *= 1.0 - twinkle * (0.5 + 0.5 * sin(time * (2.0 + 3.0 * rnd.z) + rnd.w * 40.0));
        vA = a; vCol = color;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * (0.6 + 0.8 * rnd.y) * scale / max(0.1, -mv.z);
      }`,
    fragmentShader: `uniform sampler2D map; uniform float opacity; varying vec3 vCol; varying float vA;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vCol, t.a * vA * opacity); if (gl_FragColor.a < 0.004) discard;
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.onBeforeRender = (renderer) => { const h = renderer.getDrawingBufferSize(_v2).y; mat.uniforms.scale.value = h * 0.5 / Math.tan(17.5 * Math.PI / 180); };
  return pts;
}
const _v2 = new THREE.Vector2();
/** Advance one or more particle systems (or sky domes) to time t. */
export function tick(t, ...objs) { for (const o of objs) if (o?.material?.uniforms?.time) o.material.uniforms.time.value = t; }

/** Merge geometries into one mesh (one draw call). Each part: a BufferGeometry already transformed, or [geo, matrix]. */
export function mergeMesh(parts, material, name) {
  const geos = parts.map((p) => {
    if (Array.isArray(p)) { const g = p[0].index ? p[0].toNonIndexed() : p[0].clone(); g.applyMatrix4(p[1]); return g; }
    return p.index ? p.toNonIndexed() : p;
  });
  for (const g of geos) { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); }
  const keys = new Set(geos.flatMap((g) => Object.keys(g.attributes)));
  for (const g of geos) if (keys.has('color') && !g.attributes.color) {
    const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(merged, material);
  if (name) mesh.name = name;
  return mesh;
}

/** Paint a vertex colour over a whole geometry (for merged meshes with one material and vertexColors). */
export function tint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/** Matrix from position, Euler rotation and scale (numbers or [x,y,z]). */
export function mat4(p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const sc = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
  return new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), sc);
}

/** An additive glow billboard (a Sprite) at p with colour and world size. */
export function glowSprite(texture, color, size, p = [0, 0, 0], opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size); s.position.set(...p);
  return s;
}
