// Crystal set (CHE-368): faceted gem pieces in a metal mount, one gem per side (emerald vs amethyst).
// High: a transmission shell (refraction, dispersion) around an opaque glowing core that pulses. Medium and low: no
// transmission, an opaque flat shaded shell with clearcoat and a gem tinted emissive that pulses instead.
// Per piece: mount (metal), shell (gem), core (high only), sparkle. Static parts are merged per material.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createSetStyle, m, grp, anim } from './frame.js';

// gem looks: tint = body colour, att = attenuation (high), thick = transmission thickness, spec = rim colour, glow = core (cg: its brightness),
// emis = shell glow (hi, lo: its strength on high and below), sheen = a violet rim, jit = facet jitter (medium, low), inner = the
// opaque inner body on medium, metal = the side's mount
const GEMS = {
  emerald: { tint: '#b4f5c8', att: '#0b9444', dist: 0.38, trans: 1, glow: '#6aff8e', cg: 1.3, flat: '#0f8a40', emis: '#08743a', hi: 0.12, metal: 'silver' },
  amethyst: { tint: '#ecd0ff', att: '#7a2ad0', dist: 0.45, trans: 1, glow: '#ff4ee0', cg: 1.4, flat: '#5e1aa0', emis: '#801a8c', hi: 0.12, metal: 'gold' },
};
const PAIR = ['emerald', 'amethyst'];   // the picked pair, white first (owner 2026-10-09)
const METALS = { silver: { color: '#c4c9d4', roughness: 0.4 }, gold: { color: '#f0b850', roughness: 0.38 } };

// ---------------------------------------------------------------- geometry helpers
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** Moves a geometry: xf(geo, [x, y, z], [rx, ry, rz], [sx, sy, sz]); returns it non indexed with position and normal only. */
function xf(g, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl));
  g.applyMatrix4(_m);
  if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.computeVertexNormals();
  return g;
}
/** Merges moved geometries into one. */
function bake(list) { const g = mergeGeometries(list.filter(Boolean)); for (const x of list) x?.dispose(); return g; }
/** A lathe from [r, y] pairs, bottom up, n facets. */
const lathe = (pts, n, phi = 0) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n, phi);
/** A convex hull of [x, y, z] points. */
const hull = (pts) => new ConvexGeometry(pts.map((p) => new THREE.Vector3(...p)));
/** Points on a ring: n corners, radius r, height y. */
function ring(r, y, n, phi = 0, z0 = 0, sx = 1) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = phi + (i / n) * Math.PI * 2; out.push([Math.sin(a) * r * sx, y, Math.cos(a) * r + z0]); }
  return out;
}
/** The part of a convex point cloud on the positive side of the plane n.p >= d: kept points plus every crossing. */
function clip(pts, n, d) {
  const dot = (p) => p[0] * n[0] + p[1] * n[1] + p[2] * n[2] - d;
  const out = pts.filter((p) => dot(p) >= 0);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = dot(pts[i]), b = dot(pts[j]);
    if ((a < 0) === (b < 0)) continue;
    const t = a / (a - b);
    out.push([0, 1, 2].map((k) => pts[i][k] + (pts[j][k] - pts[i][k]) * t));
  }
  return out;
}
/** A hexagonal crystal: flat foot, prism, pointed tip; foot at the origin, along +y. */
const shardGeo = (r, len, tip) => lathe([[0, 0], [r, 0], [r, len - tip], [0, len]], 6, Math.PI / 6);
/** Bakes a per facet brightness jitter (1 - a to 1 + a) as vertex colours, so an opaque cut still reads facet by facet. */
function jitter(g, a = 0.3) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const h = Math.sin(i * 12.9898) * 43758.5453, v = 1 - a + 2 * a * (h - Math.floor(h));
    c.fill(v, i * 3, i * 3 + 9);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
/** A twinkle star: three thin stretched octahedra. */
function starGeo(s) {
  const o = (sc) => xf(new THREE.OctahedronGeometry(1, 0), [0, 0, 0], [0, 0, 0], sc);
  return bake([o([s, s * 0.12, s * 0.12]), o([s * 0.12, s, s * 0.12]), o([s * 0.12, s * 0.12, s * 0.6])]);
}

// ---------------------------------------------------------------- the style
export function createStyle({ quality } = {}) {
  const high = quality === 'high', low = quality === 'low', medium = !high && !low;
  const [gw, gb] = PAIR.map((k) => GEMS[k]);
  const SEG = high ? 12 : 8, MSEG = high ? 20 : 12;   // gem facets, mount facets
  const materials = [];
  const keep = (x) => { materials.push(x); return x; };

  const side = (g) => {
    const glow = new THREE.Color(g.glow);
    const shell = keep(high
      ? new THREE.MeshPhysicalMaterial({ color: g.tint, transmission: g.trans, roughness: 0.02, metalness: 0, ior: 2.1, thickness: g.thick || 0.45,
        attenuationColor: g.att, attenuationDistance: g.dist, dispersion: 4, specularIntensity: 1, specularColor: g.spec || '#ffffff',
        clearcoat: 1, clearcoatRoughness: 0.02, emissive: g.emis, emissiveIntensity: g.hi, envMapIntensity: 2.4, flatShading: true,
        sheen: g.sheen ? 0.4 : 0, sheenColor: g.sheen || '#000000', sheenRoughness: 0.35 })
      : low
        ? new THREE.MeshStandardMaterial({ color: g.flat, roughness: 0.12, metalness: 0.55, emissive: g.emis, emissiveIntensity: g.lo ?? 0.25, envMapIntensity: 2.8, flatShading: true, vertexColors: true })
        : new THREE.MeshPhysicalMaterial({ color: g.flat, roughness: 0.04, metalness: 0.15, emissive: g.emis, emissiveIntensity: g.lo ?? 0.25, clearcoat: 1,
          clearcoatRoughness: 0.03, ior: 2.1, iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 2.6, flatShading: true, vertexColors: true,
          transparent: true, opacity: 0.8, specularColor: g.spec || '#ffffff', sheen: g.sheen ? 0.3 : 0, sheenColor: g.sheen || '#000000', sheenRoughness: 0.35 }));
    // medium: an opaque, unlit, darker inner body behind the translucent shell, so the silhouette stays solid and the gem glows inside
    const inner = medium ? keep(new THREE.MeshBasicMaterial({ color: g.inner || new THREE.Color(g.flat).multiplyScalar(0.55) })) : null;
    const core = high ? keep(new THREE.MeshBasicMaterial({ color: g.glow, toneMapped: false })) : null;
    const mt = METALS[g.metal];
    const metal = keep(new THREE.MeshStandardMaterial({ color: mt.color, metalness: 1, roughness: mt.roughness, envMapIntensity: 0.6, flatShading: true }));
    const spark = keep(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    return { shell, core, inner, metal, spark, glow, cg: g.cg || 1, jit: g.jit || 0.3 };
  };
  const mats = { w: side(gw), b: side(gb) };
  const star = starGeo(0.11);
  const SPK = high ? 1 : 1.35;   // sparkles larger below high, where nothing else glints
  const coreGeo = new THREE.IcosahedronGeometry(1, 0);

  // mount: a bevelled foot, a waist, a cup and prongs up to the girdle
  function mount(R, cupY, cupR, prongs, girdleR, girdleY, extra = []) {
    const foot = lathe([[0, 0], [R, 0], [R, 0.045], [R - 0.035, 0.08], [R * 0.62, 0.13], [cupR * 0.8, Math.min(0.17, cupY - 0.04)], [cupR * 0.72, cupY - 0.04], [cupR, cupY], [cupR * 0.75, cupY + 0.004], [0, cupY + 0.004]], MSEG);
    const list = [xf(foot)];
    for (let i = 0; i < prongs; i++) {
      const a = (i / prongs) * Math.PI * 2 + Math.PI / prongs;
      const w = 0.022;
      const pt = (r, y, t) => [[Math.sin(a) * r + Math.cos(a) * w * t, y, Math.cos(a) * r - Math.sin(a) * w * t], [Math.sin(a) * r - Math.cos(a) * w * t, y, Math.cos(a) * r + Math.sin(a) * w * t]];
      list.push(xf(hull([...pt(cupR * 0.92, cupY - 0.02, 1), ...pt(cupR * 0.92 - 0.03, cupY - 0.02, 1), ...pt(girdleR + 0.018, girdleY, 0.8), ...pt(girdleR - 0.02, girdleY + 0.05, 0.6)])));
    }
    return bake([...list, ...extra]);
  }
  const core = (c, pos, scl) => { const o = m(coreGeo, c, pos, null, scl); o.userData.noShadow = true; return anim(o, { kind: 'spin', speed: 0.7 }); };
  const sparkle = (c, pos, s = 1) => { const o = m(star, c, pos, [0.3, 0.6, 0.2], [s * SPK, s * SPK, s * SPK]); o.userData.noShadow = true; return anim(o, { kind: 'pulse', amp: 0.75, speed: 2.2 }); };
  // glow parts (orbs, the cross) light up in the core material on high and join the shell below that
  const piece = (c, mountGeo, shellGeo, corePart, sparkPart, glow) => {
    const ms = mats[c];
    const shell = high ? shellGeo : jitter(glow ? bake([shellGeo, glow]) : shellGeo, ms.jit);
    const sh = m(shell, ms.shell);
    let inner = null;
    if (ms.inner) {   // scaled 0.9 about the shell's centre, so it stays inside
      if (!shell.boundingBox) shell.computeBoundingBox();
      const cy = (shell.boundingBox.min.y + shell.boundingBox.max.y) / 2, cz = (shell.boundingBox.min.z + shell.boundingBox.max.z) / 2;
      inner = m(shell, ms.inner, [0, cy * 0.1, cz * 0.1], null, [0.9, 0.9, 0.9]);
      inner.userData.noShadow = true;
    }
    return grp([m(mountGeo, ms.metal), sh, inner, high && corePart ? corePart(ms.core) : null, high && glow ? m(glow, ms.core) : null, sparkPart ? sparkPart(ms.spark) : null]);
  };

  const builders = {
    // pawn: a round brilliant on a short mount
    p: (c) => piece(c,
      mount(0.26, 0.26, 0.13, 4, 0.185, 0.54),
      bake([xf(lathe([[0, 0.23], [0.185, 0.55], [0.19, 0.59], [0.14, 0.7], [0.09, 0.8], [0, 0.8]], SEG))]),
      (k) => core(k, [0, 0.52, 0], [0.1, 0.13, 0.1]),
      (s) => sparkle(s, [0.03, 0.805, -0.03], 0.55)),   // the sparkle tops the table, so the pawn keeps its height
    // rook: a hexagonal crystal tower, flared top, six crystal merlons, a metal band
    r: (c) => {
      const band = xf(lathe([[0.205, 0.40], [0.225, 0.42], [0.225, 0.47], [0.205, 0.49]], 6, Math.PI / 6));
      const merl = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; merl.push(xf(shardGeo(0.055, 0.15, 0.065), [Math.sin(a) * 0.17, 0.84, Math.cos(a) * 0.17], [0, a, 0])); }
      return piece(c,
        mount(0.30, 0.20, 0.17, 0, 0.2, 0.3, [band]),
        bake([xf(lathe([[0, 0.14], [0.19, 0.2], [0.195, 0.76], [0.25, 0.83], [0.25, 0.86], [0, 0.86]], 6, Math.PI / 6)), ...merl]),
        (k) => core(k, [0, 0.54, 0], [0.11, 0.27, 0.11]),
        (s) => sparkle(s, [0.14, 0.86, -0.12], 0.5));
    },
    // knight: a faceted horse head facing -z: neck, head with snout, two ears, a crystal mane
    n: (c) => {
      const neck = hull([...ring(0.21, 0.14, 8, Math.PI / 8, 0.03, 0.8), [0.14, 0.42, -0.19], [-0.14, 0.42, -0.19], [0.1, 0.72, -0.1], [-0.1, 0.72, -0.1], [0.09, 0.98, 0.04], [-0.09, 0.98, 0.04], [0.08, 0.98, 0.17], [-0.08, 0.98, 0.17], [0.12, 0.5, 0.23], [-0.12, 0.5, 0.23], [0, 0.98, 0.2], [0, 0.72, 0.28], [0, 0.4, 0.29]]);   // the last three: a spine, so the back is a ridge, not one flat panel
      const head = hull([[0, 1.12, 0.02], [0, 1.0, 0.16], [0.14, 1.09, 0.1], [-0.14, 1.09, 0.1], [0.15, 0.94, 0.12], [-0.15, 0.94, 0.12], [0.14, 1.08, -0.06], [-0.14, 1.08, -0.06],
        [0.065, 0.92, -0.35], [-0.065, 0.92, -0.35], [0.065, 0.78, -0.37], [-0.065, 0.78, -0.37], [0.11, 0.82, -0.1], [-0.11, 0.82, -0.1], [0, 0.85, -0.375]]);   // a head wedge wider than the neck
      const ear = (sx) => xf(hull([[sx * 0.04, 1.06, 0.0], [sx * 0.11, 1.06, 0.0], [sx * 0.075, 1.06, 0.1], [sx * 0.17, 1.28, 0.05]]));   // tilted out: a V above the head from behind
      // mane: one ridge of tapered fins on the centre line, feet sunk in the spine
      const mane = [];
      for (let i = 0; i < 6; i++) {
        const t = i / 5, y = 1.08 - t * 0.58, z = 0.11 + t * 0.15, w = 0.022 - t * 0.006, out = 0.1 - t * 0.03;
        mane.push(xf(hull([[w, y + 0.05, z - 0.03], [-w, y + 0.05, z - 0.03], [w, y - 0.06, z], [-w, y - 0.06, z], [0, y + 0.04, z + out]])));
      }
      return piece(c,
        mount(0.32, 0.15, 0.24, 0, 0.2, 0.2),
        bake([xf(neck), xf(head), ear(1), ear(-1), ...mane]),
        (k) => core(k, [0, 0.62, 0.02], [0.1, 0.2, 0.1]),
        (s) => sparkle(s, [0.1, 1.0, -0.2], 0.7));
    },
    // bishop: a tall pointed gem with a slanted mitre slit and a small orb
    b: (c) => {
      const up = [...ring(0.2, 0.58, SEG), ...ring(0.2, 0.82, SEG, Math.PI / SEG), ...ring(0.13, 1.06, SEG), [0, 1.27, 0]];
      const nrm = [0.751, 0.661, 0], n2 = [-0.751, -0.661, 0], d = 0.65;   // the slit runs down from upper left to lower right, seen from the front
      return piece(c,
        mount(0.29, 0.30, 0.13, 4, 0.2, 0.56),
        bake([xf(lathe([[0, 0.26], [0.2, 0.56], [0.2, 0.585], [0, 0.585]], SEG)), xf(hull(clip(up, nrm, d + 0.035))), xf(hull(clip(up, n2, -d + 0.035)))]),
        (k) => core(k, [0, 0.72, 0], [0.11, 0.24, 0.11]),
        (s) => sparkle(s, [0.11, 1.12, -0.08], 0.55),   // off the finial, so the two never merge into one blob
        xf(new THREE.OctahedronGeometry(0.045, 0), [0, 1.3, 0], [0, 0, 0], [1, 1.1, 1]));
    },
    // queen: a tall gem, a metal crown band, eight crystal shards around a central spire and an orb
    q: (c) => {
      const band = xf(lathe([[0.13, 1.14], [0.165, 1.15], [0.17, 1.22], [0.14, 1.23]], MSEG));
      const sh = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const g = shardGeo(0.036, i % 2 ? 0.22 : 0.28, 0.08);
        g.rotateZ(-0.42); g.rotateY(a - Math.PI / 2);
        sh.push(xf(g, [Math.sin(a) * 0.12, 1.18, Math.cos(a) * 0.12]));
      }
      return piece(c,
        mount(0.33, 0.32, 0.15, 6, 0.235, 0.7, [band]),
        bake([xf(lathe([[0, 0.28], [0.235, 0.68], [0.24, 0.73], [0.16, 1.06], [0.13, 1.18], [0, 1.18]], SEG)), ...sh,
          xf(lathe([[0, 1.16], [0.075, 1.3], [0, 1.5]], 6))]),
        (k) => core(k, [0, 0.76, 0], [0.13, 0.3, 0.13]),
        (s) => sparkle(s, [0.08, 1.4, -0.08], 0.6),
        xf(new THREE.OctahedronGeometry(0.05, 0), [0, 1.54, 0], [0, 0, 0], [1, 1.2, 1]));
    },
    // king: the widest and tallest, a metal crown band, a crystal dome and a crystal cross
    k: (c) => {
      const band = xf(lathe([[0.17, 1.26], [0.215, 1.27], [0.22, 1.34], [0.18, 1.35]], MSEG));
      const bar = (len, r) => lathe([[0, 0], [r, 0.03], [r, len - 0.03], [0, len]], 4, Math.PI / 4);   // square section
      return piece(c,
        mount(0.36, 0.34, 0.16, 6, 0.24, 0.72, [band]),
        bake([xf(lathe([[0, 0.3], [0.24, 0.72], [0.27, 0.86], [0.29, 1.0], [0.235, 1.2], [0.18, 1.3], [0, 1.3]], SEG)),
          xf(lathe([[0, 1.29], [0.185, 1.33], [0.17, 1.44], [0.09, 1.54], [0, 1.56]], SEG))]),
        (k) => core(k, [0, 0.84, 0], [0.14, 0.32, 0.14]),
        (s) => sparkle(s, [0.06, 1.66, -0.1], 0.5),
        bake([xf(bar(0.4, 0.09), [0, 1.48, 0]), xf(bar(0.45, 0.085), [-0.225, 1.73, 0], [0, 0, -Math.PI / 2])]));
    },
  };

  // core glow and emissive pulse: shared per side, no allocation
  const base = { w: mats.w.shell.emissiveIntensity, b: mats.b.shell.emissiveIntensity };
  const tick = (t) => {
    const s = 0.5 + 0.5 * Math.sin(t * 1.7);
    for (const c of ['w', 'b']) {
      const ms = mats[c];
      if (ms.core) ms.core.color.copy(ms.glow).multiplyScalar(ms.cg * (0.7 + 0.5 * s));
      ms.shell.emissiveIntensity = base[c] * (0.7 + 0.6 * s);
    }
  };
  return createSetStyle({ id: 'crystal', build: (type, color) => builders[type](color), materials, textures: [], tick });
}
