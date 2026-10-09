// The living island's sky and water (CHE-372): a flock of blocky birds that circles the island all the time, and spray at
// every waterfall (drops along the sheet, splashes at the lip, mist at the foot) or glowing embers at the lava fall and the crater.
// Everything is opaque boxes with the fixed face shade on the flat unlit material, moved in eighths of a block at 8 frames per
// second, a pure function of the stepped time (no state, no Math.random). The flocks fly on ellipses about 20 blocks out (one high
// in the sky, one under the island's rim), so from the White and Black views a bird never stands between the camera and a square.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Mesher } from '../blocks/mesher.js';

const SNAP = 1 / 8;
const snap = (v) => Math.round(v / SNAP) * SNAP;
const frac = (v) => v - Math.floor(v);

// ------------------------------------------------------------------ flock
const BIRDS = {
  gull: { body: 0xf6f6f2, wing: 0xbfc6ce, tip: 0x2a2a30, beak: 0xf2c230, belly: 0xffffff, fork: false },
  swallow: { body: 0x2c3c70, wing: 0x23315e, tip: 0x161e3c, beak: 0x2a2a30, belly: 0xf4efe6, throat: 0xd0462c, fork: true },
};
/** Three wing frames (up, level, down) of one bird, in pixels, facing +z. */
function birdFrames(c) {
  const frames = [];
  for (const pose of ['up', 'mid', 'down']) {
    const m = new Mesher({ shade: true });
    const b = (x, y, z, w, h, d, color) => m.box('flat', x - w / 2, y, z - d / 2, w, h, d, { color });
    b(0, 0, 0, 3, 2.4, 6, c.body); b(0, -0.1, 0.6, 2.6, 0.1, 4, c.belly);
    b(0, 0.9, 3.6, 2.4, 2.2, 2.4, c.body); b(0, 1.5, 5.3, 1, 0.7, 1.2, c.beak);
    b(-1.25, 2.1, 3.9, 0.1, 0.6, 0.6, 0x111111); b(1.25, 2.1, 3.9, 0.1, 0.6, 0.6, 0x111111);
    if (c.throat) b(0, 0.8, 4.85, 1.6, 0.8, 0.1, c.throat);
    if (c.fork) { b(-0.8, 1.2, -4.2, 0.7, 0.5, 2.6, c.wing); b(0.8, 1.2, -4.2, 0.7, 0.5, 2.6, c.wing); } else b(0, 1.2, -3.6, 2.4, 0.5, 2, c.wing);
    for (const s of [-1, 1]) {
      if (pose === 'mid') { b(s * 4, 1.6, 0.2, 5, 0.5, 3.2, c.wing); b(s * 7.25, 1.6, 0, 1.5, 0.5, 2.4, c.tip); }
      if (pose === 'up') { b(s * 3, 2.1, 0.2, 3, 0.5, 3.2, c.wing); b(s * 5.75, 2.6, 0.1, 2.5, 0.5, 3, c.wing); b(s * 7.75, 3.1, 0, 1.5, 0.5, 2.4, c.tip); }
      if (pose === 'down') { b(s * 3, 1.1, 0.2, 3, 0.5, 3.2, c.wing); b(s * 5.75, 0.6, 0.1, 2.5, 0.5, 3, c.wing); b(s * 7.75, 0.1, 0, 1.5, 0.5, 2.4, c.tip); }
    }
    const geo = m.geometries().get('flat');
    geo.computeBoundingSphere();
    frames.push({ geo, boxes: m.boxes });
  }
  return frames;
}

// a loose V: offsets [side, up, back] in blocks behind the leader
const V = [[0, 0, 0], [-1.7, 0.2, -1.5], [1.7, 0.1, -1.6], [-3.3, 0.3, -3.0], [3.4, 0.2, -3.1], [-5.0, 0.4, -4.4], [5.0, 0.3, -4.6]];
const FLAP = [0, 1, 2, 1];   // up, level, down, level

/**
 * Flocks circle the island on an ellipse, far out, so from the default views they never cross the board.
 * spec: [{ n, rx, rz, cz, y, yFar, period, dir, phase, kind, scale }]: an ellipse round (0, cz); with yFar the far half of the
 * loop sinks to yFar (out of sight) and the near half crosses the sky band the White view sees behind the island.
 */
export function createFlocks({ kit, specs }) {
  const group = new THREE.Group();
  group.name = 'life-flock';
  const geos = [], birds = [];
  // the three wing frames of a kind live in one buffer; every bird has its own geometry over those buffers and picks a frame with
  // its draw range. Birds are never culled: every geometry reaches the GPU on the first frame, so the GPU memory does not depend on
  // where the flock is or which frames it has shown yet (the leak checks compare renderer.info before and after a rebuild)
  const frameSets = {};
  const kindOf = (kind) => {
    if (frameSets[kind]) return frameSets[kind];
    const frames = birdFrames(BIRDS[kind]), all = mergeGeometries(frames.map((f) => f.geo), true);
    all.computeBoundingSphere();
    for (const f of frames) f.geo.dispose();
    geos.push(all);
    return (frameSets[kind] = { all, frames: frames.map((f, i) => ({ boxes: f.boxes, start: all.groups[i].start, count: all.groups[i].count })) });
  };
  for (const sp of specs) {
    const { all, frames } = kindOf(sp.kind);
    for (let i = 0; i < sp.n; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setIndex(all.index);
      for (const [name, attr] of Object.entries(all.attributes)) geo.setAttribute(name, attr);
      geo.boundingSphere = all.boundingSphere.clone();
      geo.setDrawRange(frames[1].start, frames[1].count);
      geos.push(geo);
      const mesh = new THREE.Mesh(geo, kit.mats.flat);
      mesh.name = 'life-bird';
      mesh.userData.boxes = frames[1].boxes;
      mesh.frustumCulled = false;
      mesh.scale.setScalar(sp.scale / 16);
      mesh.rotation.order = 'YXZ';
      group.add(mesh);
      birds.push({ mesh, sp, i, off: V[i % V.length], frames });
    }
  }
  const place = (ts) => {
    for (const b of birds) {
      const { sp, off, i, mesh } = b;
      const th = sp.dir * (ts / sp.period + sp.phase) * Math.PI * 2;
      const cx = sp.rx * Math.sin(th), cz = (sp.cz || 0) + sp.rz * Math.cos(th), far = (1 - Math.cos(th)) / 2;
      // heading along the ellipse (derivative of the position)
      const hx = sp.dir * sp.rx * Math.cos(th), hz = -sp.dir * sp.rz * Math.sin(th), hl = Math.hypot(hx, hz), ux = hx / hl, uz = hz / hl;
      const wob = Math.sin(ts * 1.3 + i * 1.7) * 0.25, k = 1 + 0.12 * Math.sin(ts * 0.4 + i);
      const x = cx + (off[0] * uz + off[2] * ux) * k + wob * uz;
      const z = cz + (-off[0] * ux + off[2] * uz) * k - wob * ux;
      const y = sp.y + ((sp.yFar ?? sp.y) - sp.y) * far + (sp.yFar == null ? 1.6 : 0.5) * Math.sin(th * 2 + sp.phase * 6) + off[1] + Math.sin(ts * 0.9 + i * 2.1) * 0.2;
      mesh.position.set(snap(x), snap(y), snap(z));
      mesh.rotation.y = Math.atan2(ux, uz);
      mesh.rotation.z = -0.28 * sp.dir;   // banked into the turn
      const glide = Math.sin(ts * 0.55 + i * 0.9) < -0.35;
      const f = glide ? 1 : FLAP[(Math.floor(ts * 8) + i) % 4];
      mesh.geometry.setDrawRange(b.frames[f].start, b.frames[f].count); mesh.userData.boxes = b.frames[f].boxes;
    }
  };
  return {
    group, geos, birds,
    update: place,
    /** The nearest any bird comes to the board centre now, in x and z (test hook). */
    near() { let t = Infinity; for (const b of birds) t = Math.min(t, Math.hypot(b.mesh.position.x, b.mesh.position.z)); return t; },
  };
}

// ------------------------------------------------------------------ spray and embers
const WATER = { drop: [0xdcecff, 0xffffff, 0xa9d0ff], lip: [0xffffff, 0xe6f2ff], mist: [0xffffff, 0xeef6ff, 0xd8ebff] };
const LAVA = { drop: [0xffb028, 0xff8a1f, 0xffd84a], lip: [0xffe066, 0xffb028, 0xff7a1a], mist: [0xff6a1f, 0xffd84a, 0xd8401a] };

/**
 * Particles of one fall (and of the crater): one instanced mesh of unit cubes, each instance a size, a colour and a motion
 * kind with seeded constants. fall: { lava, nx, nz, px, pz, u0, u1, alongX, top, bottom }; crater: { x, y, z } or null.
 */
export function createSpray({ kit, falls, crater, light, R }) {
  const group = new THREE.Group();
  group.name = 'life-spray';
  const m = new Mesher({ shade: true });
  m.box('flat', -0.5, -0.5, -0.5, 1, 1, 1, { color: 0xffffff });
  const geo = m.geometries().get('flat');
  const P = [];   // [kind, a, b, c, d, e, size, period, phase, colour] per particle
  const pick = (list) => list[Math.floor(R() * list.length)];
  // a fall behind the board (|x| < 6 along its sheet, not on a flank): its splashes stay under the board plane, so from the White and
  // Black views no particle stands among the pieces; a fall on a flank or far below may splash freely
  // a fall that starts far below the main island (an islet's) only spits low over its lip, so no cube floats over the water as debris
  const cap = (f) => (f.alongX && Math.max(Math.abs(f.u0), Math.abs(f.u1)) < 6 ? -0.05 - f.top : f.top < -1 && !f.lava ? 0.4 : 3);
  for (const f of falls) {
    const pal = f.lava ? LAVA : WATER, H = f.top - f.bottom, mul = light ? 0.5 : 1;
    const nDrops = Math.round(Math.min(18, 6 + H) * mul), nLip = Math.round(12 * mul), nMist = Math.round((f.lava ? 8 : 12) * mul);
    for (let i = 0; i < nDrops; i++) P.push({ f, k: 'drop', u: f.u0 + 0.1 + R() * (f.u1 - f.u0 - 0.2), s: 0.06 + R() * 0.22, size: R() < 0.3 ? 0.1875 : 0.125, T: H / (4.5 + R() * 2), ph: R(), c: pick(pal.drop) });
    for (let i = 0; i < nLip; i++) P.push({ f, k: 'lip', u: f.u0 + R() * (f.u1 - f.u0), s: 0.25 + R() * 0.5, h: Math.max(0.04, Math.min((f.lava ? 0.6 : 0.3) + R() * (f.lava ? 0.9 : 0.4), cap(f) - 0.25)), size: R() < 0.4 && f.top > -1 ? 0.1875 : 0.125, T: 0.7 + R() * 0.6, ph: R(), c: pick(pal.lip) });
    for (let i = 0; i < nMist; i++) P.push({ f, k: 'mist', u: f.u0 + R() * (f.u1 - f.u0), s: 0.4 + R() * 1.3, side: (R() - 0.5) * 1.6, size: f.lava ? 0.125 + R() * 0.0625 : 0.1875 + Math.floor(R() * 2) * 0.0625, T: 1.8 + R() * 1.4, ph: R(), c: pick(pal.mist) });
  }
  if (crater) for (let i = 0, n = light ? 4 : 9; i < n; i++) P.push({ k: 'ember', x: crater.x + (R() - 0.5) * 0.6, y: crater.y, z: crater.z + (R() - 0.5) * 0.6, a: R() * Math.PI * 2, s: 0.3 + R() * 1.1, h: 1.2 + R() * 2.2, size: R() < 0.4 ? 0.1875 : 0.125, T: 1.4 + R() * 1.2, ph: R(), c: pick(LAVA.lip) });
  const n = Math.max(1, P.length);
  const mesh = new THREE.InstancedMesh(geo, kit.mats.flat, n);
  mesh.name = 'life-spray';
  mesh.frustumCulled = false;
  mesh.count = P.length;
  const col = new THREE.Color();
  P.forEach((p, i) => mesh.setColorAt(i, col.setHex(p.c)));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  const M = new THREE.Matrix4();
  const put = (i, x, y, z, s) => { M.makeScale(s, s, s); M.setPosition(snap(x), snap(y), snap(z)); mesh.setMatrixAt(i, M); };
  // a point on a fall: u along the sheet, s out from it (into OX, OZ: nothing is allocated per frame)
  let OX = 0, OZ = 0;
  const onFall = (f, u, s) => { if (f.alongX) { OX = u; OZ = f.pz + f.nz * s; } else { OX = f.px + f.nx * s; OZ = u; } };
  const update = (ts) => {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], k = frac(ts / p.T + p.ph);
      if (p.k === 'ember') {
        put(i, p.x + Math.sin(p.a) * p.s * k, p.y + p.h * 4 * k * (1 - k) - k * 0.6, p.z + Math.cos(p.a) * p.s * k, p.size * (k < 0.85 ? 1 : 0.5));
        continue;
      }
      const f = p.f;
      if (p.k === 'drop') {
        onFall(f, p.u, p.s + k * 0.25);
        put(i, OX, f.top - k * (f.top - f.bottom), OZ, p.size);
      } else if (p.k === 'lip') {
        onFall(f, p.u, 0.06 + p.s * k);
        put(i, OX, f.top + p.h * 4 * k * (1 - k) - k * k * 0.5, OZ, p.size * (k < 0.8 ? 1 : 0.5));
      } else {
        onFall(f, p.u + p.side * k, 0.15 + p.s * k);
        const s = Math.max(0.0625, Math.round(p.size * (1 - k * 0.8) * 16) / 16);
        put(i, OX, f.bottom + 0.2 - k * (f.lava ? 1.4 : 1.8) + (f.lava ? 0.6 * 4 * k * (1 - k) : 0), OZ, s);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return { group, mesh, geos: [geo], count: P.length, update };
}
