// Lit capture effects (CHE-369): the victim shatters into shards of its own material (wood splinters, glass shards, metal
// fragments, stone chunks), sparks, a shock wave, a camera punch in and slow motion, for the wild capture scenes and the
// finale of the lit themes (Options Scene row, ?capture=wild). Built on the director's ctx.fx: every mesh goes in through fx.add and every
// geometry and material through fx.own, so the director's dispose frees them; the camera's field of view is put back the
// same way. Positions are in the pieces' space (one square = 1.0, board top at y = 0).
//
//   const L = createLit(ctx);          // once per scene
//   L.shatter(V, { origin, push })      // hides the victim (it stays hidden, the director shows it for its exit)
//   L.ring(pos), L.sparks(pos), L.punch(), L.slowmo(), L.arc(...), L.glow(...)
import * as THREE from 'three';
import { noAO } from './fx.js';

const KIND = { classic: 'stone', tournament: 'stone', wood: 'wood', metal: 'metal', glass: 'glass' };
export const kindOf = (theme) => KIND[theme] || 'stone';
// accent colours per material: spark, ring, flash
const TONE = {
  stone: { spark: ['#fff3c4', '#ffd98a', '#ffffff'], ring: '#fff0c8', flash: '#fff4d6', dust: ['#efe6d2', '#d8ccb4', '#c9bca2'] },
  wood: { spark: ['#ffcf7a', '#ffb347', '#fff0b8'], ring: '#ffd9a0', flash: '#ffe6b8', dust: ['#c9a06a', '#a87c4a', '#e0c08c'] },
  metal: { spark: ['#fff7d6', '#ffe08a', '#ffb347', '#ffffff'], ring: '#ffe7a8', flash: '#fff7e0', dust: ['#b9bec6', '#8d939c', '#d8dce2'] },
  glass: { spark: ['#e8f7ff', '#bfe6ff', '#ffffff', '#9fd0ff'], ring: '#6fc3ff', flash: '#8fd0ff', beam: '#6fc3ff', dust: ['#dff2ff', '#bcdcf2', '#ffffff'] },
};
const UP = new THREE.Vector3(0, 1, 0);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Shard shapes, one small set per kind. Each is centred on its origin and about one unit across.
function shardGeos(kind) {
  const list = [];
  const jitter = (g, k) => {
    const pos = g.attributes.position, seen = new Map();
    for (let v = 0; v < pos.count; v++) {
      const key = [pos.getX(v), pos.getY(v), pos.getZ(v)].map((n) => n.toFixed(3)).join(',');
      if (!seen.has(key)) seen.set(key, new THREE.Vector3(rand(1 - k, 1 + k), rand(1 - k, 1 + k), rand(1 - k, 1 + k)));
      const j = seen.get(key);
      pos.setXYZ(v, pos.getX(v) * j.x, pos.getY(v) * j.y, pos.getZ(v) * j.z);
    }
    g.computeVertexNormals();
    return g;
  };
  for (let i = 0; i < 4; i++) {
    let g;
    if (kind === 'wood') {
      // a splinter: a long four sided needle, thicker at one end
      g = new THREE.CylinderGeometry(rand(0.05, 0.12), rand(0.2, 0.3), 1.6, 4, 1).toNonIndexed();
      g = jitter(g, 0.25);
    } else if (kind === 'glass') {
      // a thin flat triangle with sharp corners
      const s = new THREE.Shape();
      s.moveTo(rand(-0.6, -0.3), rand(-0.5, -0.2)); s.lineTo(rand(0.3, 0.7), rand(-0.6, -0.1)); s.lineTo(rand(-0.2, 0.3), rand(0.4, 0.8)); s.closePath();
      g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false }).toNonIndexed();
      g.center(); g.computeVertexNormals();
    } else if (kind === 'metal') {
      // a bent plate with torn edges
      g = new THREE.BoxGeometry(1.1, 0.14, 0.75, 3, 1, 2).toNonIndexed();
      const pos = g.attributes.position, bend = rand(0.2, 0.45);
      for (let v = 0; v < pos.count; v++) pos.setY(v, pos.getY(v) + bend * pos.getX(v) * pos.getX(v) - bend * 0.3);
      g = jitter(g, 0.18);
    } else {
      g = jitter(new THREE.IcosahedronGeometry(0.6, 0).toNonIndexed(), 0.35);
    }
    list.push(g);
  }
  return list;
}

export function createLit(ctx) {
  const fx = ctx.fx;
  const kind = kindOf(ctx.theme);
  const tone = TONE[kind];
  const low = ctx.quality === 'low';
  const n = (hi, lo) => (low ? lo : hi);
  let geos = null;
  const cam = ctx.stage?.camera || null;
  const fov0 = cam?.fov;
  let fovTouched = false;
  const L = { kind, tone, low };

  // ------------------------------------------------------------ camera punch in and slow motion
  // Both run on real time (scene time divided by the slow motion factor), so a punch in stays snappy inside slow motion.
  let cur = 1;
  const setSlow = (k) => { cur = k; ctx.slow?.(k); };
  const realTween = (dur, fn) => {
    if (!ctx.onFrame) { fn(1); return; }
    let t = 0;
    const off = ctx.onFrame((d) => { t += d / Math.max(0.05, cur); const u = Math.min(1, t / dur); fn(u); if (u >= 1) off(); });
    fn(0);
  };
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  // punch(k): narrows the field of view to fov0 / k (a quick zoom on the impact), holds, eases back
  L.punch = ({ k = 1.28, attack = 0.12, hold = 0.6, release = 0.7 } = {}) => {
    if (!cam || !fov0) return;
    if (!fovTouched) { fovTouched = true; fx.own({ dispose() { cam.fov = fov0; cam.updateProjectionMatrix(); } }); }
    const T = attack + hold + release;
    realTween(T, (u) => {
      const t = u * T;
      const z = t < attack ? 1 + (k - 1) * (1 - (1 - t / attack) ** 3) : t < attack + hold ? k : 1 + (k - 1) * (1 - ease((t - attack - hold) / release));
      cam.fov = fov0 / z; cam.updateProjectionMatrix();
    });
  };
  // slowmo(k, hold, release): the scene clock runs at k for `hold` real seconds, then ramps back to full speed
  L.slowmo = ({ k = 0.25, hold = 0.6, release = 0.5 } = {}) => {
    if (!ctx.slow) return;
    setSlow(k);
    realTween(hold + release, (u) => {
      const t = u * (hold + release);
      setSlow(u >= 1 ? 1 : t < hold ? k : k + (1 - k) * ease((t - hold) / release));
    });
  };

  // ------------------------------------------------------------ the shatter
  // shatter(V, opts): V (a piece group) breaks into shards of its own material. origin: the blast centre (default the
  // piece's middle); push: a vector added to every shard's speed (the blow's direction); power, up, count, size, life.
  L.shatter = (V, o = {}) => {
    geos = geos || shardGeos(kind).map((g) => fx.own(g));
    const h = V.userData.height || 1.2;
    const base = V.position.clone();
    const origin = (o.origin || base.clone().setY(h * 0.5)).clone();
    const { pts, refs } = fx.samplePoints(V, 500);
    const solid = [];            // not the game's invisible hit cylinder
    for (let j = 0; j < refs.length; j++) if (!refs[j].userData?.hit) solid.push(j);
    if (!solid.length) { V.visible = false; fx.hide(V); return []; }
    const count = o.count ?? n(58, 22), power = o.power ?? 2.6, up = o.up ?? 2.6;
    const size = (o.size ?? 0.11) * (o.heavy ?? 1) * (kind === 'wood' ? 1.15 : kind === 'glass' ? 1.25 : 1) * (0.75 + 0.25 * h);
    const push = o.push || new THREE.Vector3();
    const mats = new Map();
    // glass shards: a clear, cheap stand in for the piece's own glass (no transmission pass for every shard)
    const matFor = (src) => {
      if (kind !== 'glass') return src;
      if (!mats.has(src)) {
        mats.set(src, fx.own(new THREE.MeshPhysicalMaterial({
          color: src.color ? src.color.clone() : new THREE.Color('#dff2ff'), roughness: 0.08, metalness: 0, transparent: true, opacity: 0.9, emissive: src.color ? src.color.clone().multiplyScalar(0.3) : new THREE.Color('#3a5a78'), emissiveIntensity: 0.15,   // keeps a dark glass piece dark
          clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
        })));
      }
      return mats.get(src);
    };
    V.visible = false;            // hidden before fx tracks it, so the victim stays hidden when fx puts it back
    const shards = [];
    for (let i = 0; i < count; i++) {
      const idx = solid[Math.floor(Math.random() * solid.length)];
      const ref = refs[idx];
      const src = Array.isArray(ref.material) ? ref.material[0] : ref.material;
      const m = new THREE.Mesh(pick(geos), matFor(src));
      const s = size * rand(0.45, 1.45);
      m.scale.set(s, s * (kind === 'wood' ? rand(0.9, 1.6) : rand(0.8, 1.2)), s);
      m.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
      const k = rand(0.25, 1);
      m.position.set(base.x + (pts[idx * 3] - base.x) * k, pts[idx * 3 + 1], base.z + (pts[idx * 3 + 2] - base.z) * k);
      m.castShadow = !low; m.receiveShadow = false;
      fx.add(m);
      const d = m.position.clone().sub(origin); d.y = Math.max(d.y * 0.6, 0.08);
      if (d.lengthSq() < 1e-4) d.set(rand(-1, 1), 0.5, rand(-1, 1));
      d.normalize();
      const vel = d.multiplyScalar(power * rand(0.5, 1.25)).addScaledVector(push, rand(0.6, 1.2)).add(new THREE.Vector3(0, up * rand(0.35, 1), 0));
      fx.body(m, {
        radius: s * 0.5, vel, ang: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)),
        bounce: kind === 'metal' ? 0.45 : kind === 'glass' ? 0.25 : 0.32, life: o.life ?? rand(1.0, 1.4), fade: 0.35,
      });
      shards.push(m);
    }
    fx.hide(V);
    return shards;
  };

  // ------------------------------------------------------------ light and air
  const glowMat = (color, opacity = 1) => fx.own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  // ring(pos): a shock wave: a bright ring racing over the board plus a thin dome of air that swells and fades.
  L.ring = (pos, { radius = 1.9, dur = 0.55, color = tone.ring, dome = false } = {}) => {
    const ring = new THREE.Mesh(fx.own(new THREE.RingGeometry(0.8, 1, n(56, 32))), glowMat(color, 0.9));
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.03, pos.z); ring.scale.setScalar(0.01); ring.frustumCulled = false;
    noAO(ring, cam);
    fx.add(ring);
    let shell = null;
    if (dome && !low && kind === 'glass') {
      shell = new THREE.Mesh(fx.own(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), glowMat(color, 0.25));
      shell.position.set(pos.x, 0.02, pos.z); shell.scale.setScalar(0.01); shell.frustumCulled = false;
      noAO(shell, cam);
      fx.add(shell);
    }
    // on real time, bright until late and then gone quickly: a faint ring over the white marble rendered as a dark band
    // (seen in Classic at every quality; cause not found), so it never lingers faint, also not in slow motion
    realTween(dur * 1.6, (u) => {
      const r = 0.15 + radius * ctx.ease.out(Math.min(1, u * 1.15));
      ring.scale.setScalar(r); ring.material.opacity = u < 0.7 ? 0.9 : 0.9 * Math.max(0, 1 - (u - 0.7) / 0.3) ** 0.5;
      if (shell) { shell.scale.set(r * 0.8, r * 0.45, r * 0.8); shell.material.opacity = 0.12 * (1 - u); }
      if (u >= 1) { fx.remove(ring); if (shell) fx.remove(shell); }
    });
    return Promise.resolve();
  };
  // a star of light that flares and fades (an impact, a charged up weapon): a camera facing sprite with a drawn star
  let starTex = null;
  const star = () => starTex || (starTex = fx.own(makeStar()));
  L.flare = (pos, { size = 1.1, dur = 0.3, color = tone.flash, spin = true } = {}) => {
    const mat = fx.own(new THREE.SpriteMaterial({ map: star(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    mat.rotation = spin ? rand(0, Math.PI / 2) : 0;
    const sp = new THREE.Sprite(mat);
    sp.geometry = fx.own(sp.geometry.clone());   // its own quad, so hiding it from the AO pass leaves other sprites alone
    noAO(sp, cam);
    sp.position.copy(pos); sp.renderOrder = 5; sp.frustumCulled = false;
    fx.add(sp);
    const r0 = mat.rotation;
    // on real time, so the flash stays a flash inside slow motion
    return realTween(dur, (u) => {
      const k = u < 0.25 ? u / 0.25 : 1;
      sp.scale.setScalar(Math.max(0.001, size * (0.35 + 0.65 * k) * (1 + 0.25 * u)));
      mat.opacity = u < 0.25 ? 1 : 1 - (u - 0.25) / 0.75;
      mat.rotation = r0 + u * 0.4;
      if (u >= 1) fx.remove(sp);
    });
  };
  L.glow = (pos, { size = 0.5, dur = 0.35, color = tone.flash } = {}) => L.flare(pos, { size: size * 2.2, dur, color });
  // sparks in the material's colours; metal gets many more, and long ones
  L.sparks = (pos, o = {}) => fx.sparks(pos, {
    count: n(kind === 'metal' ? 44 : 26, kind === 'metal' ? 18 : 12), colors: tone.spark, speed: [2.5, kind === 'metal' ? 7 : 5.5], spread: 2.8,
    size: kind === 'metal' ? [0.018, 0.04] : [0.015, 0.035], life: [0.35, kind === 'metal' ? 0.9 : 0.6], ...o,
  });
  L.dust = (pos, o = {}) => fx.dust(pos, { count: n(12, 6), size: [0.03, 0.06], grow: 0.8, speed: [0.8, 2], life: [0.5, 0.8], colors: tone.dust, ...o });
  // glints: a few slow, bright specks that float up (glass and metal catch the light)
  L.glints = (pos, o = {}) => fx.burst(pos, { count: n(14, 6), speed: [0.4, 1.4], spread: 3, size: [0.02, 0.04], life: [0.35, 0.6], gravity: 0.6, drag: 1.5, stain: false, glow: true, colors: ['#ffffff', ...tone.spark], ...o });

  // arc(centre, normal, from, to, opts): a fading swoosh along a circle (a weapon's path). centre and normal in piece space;
  // from and to are angles measured from `start` (a unit vector in the circle's plane) about `normal`.
  L.arc = (centre, normal, start, from, to, { radius = 0.8, width = 0.16, color = '#ffffff', dur = 0.32, opacity = 0.75 } = {}) => {
    const seg = n(28, 14);
    const geo = fx.own(new THREE.RingGeometry(radius - width, radius, seg, 1, 0, Math.max(0.01, to - from)));
    const m = new THREE.Mesh(geo, glowMat(color, opacity));
    // RingGeometry lies in the xy plane from +x counter clockwise about +z: turn +z to `normal` and +x to `start`
    const z = normal.clone().normalize(), x = start.clone().normalize(), y = new THREE.Vector3().crossVectors(z, x);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    m.rotateZ(from);
    m.position.copy(centre); m.frustumCulled = false;
    noAO(m, cam);
    fx.add(m);
    return ctx.tween({ dur, step: (e, u) => { m.material.opacity = opacity * (1 - u) * (1 - u * 0.5); if (u >= 1) fx.remove(m); } });
  };

  // impact(pos): the shared hit moment: flash, sparks, ring and dust
  L.impact = (pos, { big = true, size = 1 } = {}) => {
    L.flare(pos, { size: (big ? 1.8 : 0.7) * size, dur: big ? 0.38 : 0.2 });
    L.sparks(pos, big ? {} : { count: n(12, 6), speed: [1.5, 3.5] });
    if (kind !== 'stone') L.glints(pos, big ? {} : { count: n(5, 3) });
    if (big) L.ring(pos);
  };
  return L;
}

// a four pointed star with a soft round core, white with the shape in alpha, computed per pixel (canvas gradients drew one
// pair of rays dark under additive blending)
function makeStar() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S), d = img.data, h = S / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5 - h) / h, dy = (y + 0.5 - h) / h, r = Math.hypot(dx, dy);
    const core = Math.max(0, 1 - r / 0.55) ** 2;
    const ray = (a, b) => Math.max(0, 1 - Math.abs(a)) ** 1.5 * Math.exp(-Math.abs(b) / 0.035);
    const k = Math.min(1, core + ray(dx, dy) + ray(dy, dx));
    const o = (y * S + x) * 4;
    d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(255 * k);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- cracks (the checkmate finale)
// crackMesh(group, opts) -> Mesh: a few jagged glowing lines over the surface of a piece, in the group's own space, made from
// the piece's vertices (a walk from vertex to nearby vertex). Add it to the group; it moves with the piece.
export function crackMesh(group, { lines = 4, steps = 9, width = 0.03, color = '#fff0c0', low = false } = {}) {
  group.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const pts = [];
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData?.hit || !o.geometry?.attributes?.position) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 900));
    for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(m); pts.push(v.clone()); }
  });
  const h = pts.reduce((a, p) => Math.max(a, p.y), 0) || 1;
  const out = [];
  const nLines = low ? Math.min(3, lines) : lines;
  for (let l = 0; l < nLines; l++) {
    // start high on the body, wander down and around
    const cand = pts.filter((p) => p.y > h * 0.35 && p.y < h * 0.85);
    let cur = pick(cand.length ? cand : pts);
    let ang = Math.atan2(cur.z, cur.x);
    const path = [cur];
    for (let s = 0; s < steps; s++) {
      ang += rand(-0.6, 0.6);
      const want = new THREE.Vector3(cur.x + Math.cos(ang) * 0.05, cur.y - rand(0.04, 0.11), cur.z + Math.sin(ang) * 0.05);
      let best = null, bd = Infinity;
      for (const p of pts) {
        const d = p.distanceToSquared(want);
        if (d < bd && p !== cur) { bd = d; best = p; }
      }
      if (!best || best.y > cur.y + 0.01) break;
      cur = best; path.push(cur);
    }
    // a ribbon along the path, lifted a hair off the surface (outward from the axis)
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const outA = new THREE.Vector3(a.x, 0, a.z).normalize(), outB = new THREE.Vector3(b.x, 0, b.z).normalize();
      if (!outA.lengthSq()) outA.set(0, 0, 1); if (!outB.lengthSq()) outB.set(0, 0, 1);
      const seg = new THREE.Vector3().subVectors(b, a);
      const sideA = new THREE.Vector3().crossVectors(seg, outA).normalize().multiplyScalar(width * (1 - i / path.length) * 0.5 + 0.004);
      const sideB = new THREE.Vector3().crossVectors(seg, outB).normalize().multiplyScalar(width * (1 - (i + 1) / path.length) * 0.5 + 0.003);
      const A = a.clone().addScaledVector(outA, 0.012), B = b.clone().addScaledVector(outB, 0.012);
      const q = [A.clone().add(sideA), A.clone().sub(sideA), B.clone().sub(sideB), B.clone().add(sideB)];
      out.push(...q[0].toArray(), ...q[1].toArray(), ...q[2].toArray(), ...q[0].toArray(), ...q[2].toArray(), ...q[3].toArray());
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

export { UP };
