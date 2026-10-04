// Battle effects toolkit: slicing, shattering, particles, props, squash and stretch, a tiny physics.
//
//   const fx = createFx({ stage, parent, signal });   // one per scene, parent = the group the pieces live in
//   ... scene runs, awaiting fx.tween / fx.wait / fx.squash ...
//   fx.dispose();                                      // removes and frees everything, restores hidden pieces
//
// Space: every position, vector and plane is in the space of `parent` (the board space: one square = 1.0,
// y up, board top at y = 0). The toolkit never touches a piece's geometry or materials, it only reads them.
// Time: the owner calls fx.update(dt) every frame (the director does, so `__chess.step` drives it in tests).
// Skip: fx.skip() (or aborting `signal`) finishes every running tween at its end value and makes later tweens and
// waits resolve at once, so a scene unwinds to its final state in one frame. Physics bodies are left where they are.
import * as THREE from 'three';

// ---------------------------------------------------------------- easing
export const ease = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inBack: (t) => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  // 0 to 1 to 0 hump, for hops and flashes
  hump: (t) => Math.sin(Math.PI * t),
};

export const BLOOD = ['#7d0a0a', '#a31212', '#5e0707', '#c01a1a'];
export const DUST = ['#d9d0bd', '#c4baa5', '#e8e0cf'];
export const MAGIC = ['#ff6bd6', '#9b6bff', '#6be0ff', '#fff2a8'];
export const CONFETTI = ['#ff5d73', '#ffd23f', '#3bceac', '#4d9de0', '#e15fed'];

const UP = new THREE.Vector3(0, 1, 0);
const rand = (a, b) => a + Math.random() * (b - a);
const range = (v) => (Array.isArray(v) ? rand(v[0], v[1]) : v);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Local plane clipping inside the shader: the plane lives in the mesh's own space, so it moves with the mesh
// (renderer clipping planes are fixed in world space and would not follow a falling half). The side that is
// cut away is the one where dot(p, n) > d. Back faces of a clipped body are painted with the cap colour, which
// reads as a flat cut surface on these convex, lathed pieces.
function patchClip(mat, plane, cap, withCap) {
  const uPlane = { value: new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, -plane.constant) };
  const uCap = { value: new THREE.Color(cap) };
  mat.userData.fxPlane = uPlane;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.fxPlane = uPlane;
    shader.uniforms.fxCap = uCap;
    shader.vertexShader = 'varying vec3 vFxP;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFxP = position;');
    let fs = 'varying vec3 vFxP;\nuniform vec4 fxPlane;\nuniform vec3 fxCap;\n' + shader.fragmentShader;
    fs = fs.replace('void main() {', 'void main() {\n if (dot(vFxP, fxPlane.xyz) > fxPlane.w) discard;');
    if (withCap) fs = fs.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n if (!gl_FrontFacing) gl_FragColor = vec4(mix(fxCap, gl_FragColor.rgb, 0.18), 1.0);');
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => (withCap ? 'fxclip-cap' : 'fxclip-depth');
  mat.needsUpdate = true;
  return mat;
}

function makeClipped(src, plane, cap) {
  const m = src.clone();
  m.side = THREE.DoubleSide;
  return patchClip(m, plane, cap, true);
}

function makeClipDepth(plane) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  return patchClip(m, plane, '#000000', false);
}

// Object3D.clone copies userData through JSON, which breaks on the game's circular userData. Clone without it.
function cloneBare(obj) {
  const saved = [];
  obj.traverse((o) => { saved.push([o, o.userData]); o.userData = {}; });
  try { return obj.clone(true); } finally { for (const [o, u] of saved) o.userData = u; }
}

export function createFx({ stage, parent, signal } = {}) {
  const owned = [];            // things with dispose()
  const objects = new Set();   // objects we added to `parent`
  const hidden = new Map();    // piece object -> prior visible flag (restored on dispose)
  const tracked = new Map();   // piece object -> snapshot of position, quaternion, scale, visible
  const tweens = new Set();
  const bodies = new Set();
  const bursts = new Set();
  const cache = new Map();
  let disposed = false;
  let skipped = false;
  let time = 0;

  if (stage?.renderer) stage.renderer.localClippingEnabled = true;

  // after dispose() nothing new is kept: a scene that runs on after a skip must not leak or add to the scene
  const own = (r) => { if (disposed) { try { r.dispose?.(); } catch (e) { /* ignore */ } } else owned.push(r); return r; };
  const cached = (key, make) => { let v = cache.get(key); if (!v) { v = own(make()); cache.set(key, v); } return v; };
  const add = (obj) => { if (disposed) return obj; (parent || stage?.scene).add(obj); objects.add(obj); return obj; };
  const remove = (obj) => { obj.removeFromParent(); objects.delete(obj); };
  const space = (obj) => parent || obj.parent;

  // ------------------------------------------------------------ time: tweens and waits
  // tween(sec, fn(k, t), { ease }) -> Promise. fn gets the eased progress k and the raw progress t. The final call
  // is always k = 1. Resolves when done, or on skip (after the k = 1 call). Never rejects.
  function tween(sec, fn, opts = {}) {
    if (disposed) return Promise.resolve();
    if (skipped) { try { fn(1, 1); } catch (e) { /* object may be gone */ } return Promise.resolve(); }
    return new Promise((resolve) => {
      tweens.add({ t: 0, dur: Math.max(1e-4, sec), fn, ease: opts.ease || ease.linear, resolve });
    });
  }
  const wait = (sec) => tween(sec, () => {});

  function skip() {
    if (skipped || disposed) return;
    skipped = true;
    for (const tw of [...tweens]) { tweens.delete(tw); try { tw.fn(1, 1); } catch (e) { /* ignore */ } tw.resolve(); }
  }
  signal?.addEventListener('abort', skip, { once: true });

  // ------------------------------------------------------------ sampling and bounds
  const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _v = new THREE.Vector3();

  // Points on the surface of obj in `space(obj)` coordinates, about `target` of them, spread across its meshes.
  function samplePoints(obj, target = 480) {
    const p = space(obj);
    p.updateWorldMatrix(true, false);
    obj.updateWorldMatrix(true, true);
    _inv.copy(p.matrixWorld).invert();
    const meshes = [];
    let total = 0;
    obj.traverse((o) => { if (o.isMesh && o.visible) { meshes.push(o); total += o.geometry.attributes.position.count; } });
    const out = [];
    const refs = [];
    for (const mesh of meshes) {
      const pos = mesh.geometry.attributes.position;
      const n = Math.max(2, Math.round(target * pos.count / total));
      const step = Math.max(1, Math.floor(pos.count / n));
      _m.multiplyMatrices(_inv, mesh.matrixWorld);
      for (let i = 0; i < pos.count; i += step) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
        out.push(_v.x, _v.y, _v.z);
        refs.push(mesh);
      }
    }
    return { pts: new Float32Array(out), refs };
  }

  function heightOf(obj) {
    if (obj.userData?.height) return obj.userData.height * (obj.scale?.y || 1);
    return new THREE.Box3().setFromObject(obj).max.y;
  }

  // The piece's base centre in `space(obj)`.
  const basePoint = (obj) => obj.position.clone();

  // ------------------------------------------------------------ physics bodies
  // A body moves `obj` (any Object3D) as a rigid thing under gravity, bouncing on the board top (y = 0).
  // `center` is the pivot in obj-local space, `pts` (obj-local, optional) are the contact points, `radius` makes it a
  // sphere instead. The body owns obj.position and obj.quaternion while it runs.
  function body(obj, o = {}) {
    const center = o.center ? o.center.clone() : new THREE.Vector3();
    const b = {
      obj, center, pts: o.pts || null, radius: o.radius ?? 0.05,
      vel: (o.vel || new THREE.Vector3()).clone(),
      ang: (o.ang || new THREE.Vector3()).clone(),
      g: o.gravity ?? -14, bounce: o.bounce ?? 0.3, drag: o.drag ?? 0.15,
      cpos: new THREE.Vector3(), asleep: false, age: 0, life: o.life ?? Infinity, fade: o.fade ?? 0.4,
      baseScale: obj.scale.clone(), onHit: o.onHit, floor: o.floor ?? 0,
    };
    // centre position in parent space from the current transform
    b.cpos.copy(center).multiply(obj.scale).applyQuaternion(obj.quaternion).add(obj.position);
    bodies.add(b);
    return b;
  }

  const _q = new THREE.Quaternion(), _off = new THREE.Vector3(), _ax = new THREE.Vector3(), _e = new THREE.Matrix4();
  function stepBody(b, dt) {
    if (b.asleep) return;
    const h = Math.min(dt, 1 / 60);
    let rest = dt;
    while (rest > 1e-6 && !b.asleep) {
      const d = Math.min(h, rest); rest -= d;
      b.vel.y += b.g * d;
      const k = Math.max(0, 1 - b.drag * d);
      b.vel.x *= k; b.vel.z *= k;
      b.cpos.addScaledVector(b.vel, d);
      const w = b.ang.length();
      if (w > 1e-4) { _ax.copy(b.ang).divideScalar(w); _q.setFromAxisAngle(_ax, w * d); b.obj.quaternion.premultiply(_q).normalize(); }
      // lowest point
      let minY;
      if (b.pts) {
        _e.makeRotationFromQuaternion(b.obj.quaternion);
        const m = _e.elements, s = b.obj.scale.x;
        minY = Infinity;
        for (let i = 0; i < b.pts.length; i += 3) {
          const px = (b.pts[i] - b.center.x) * s, py = (b.pts[i + 1] - b.center.y) * s, pz = (b.pts[i + 2] - b.center.z) * s;
          const y = m[1] * px + m[5] * py + m[9] * pz;
          if (y < minY) minY = y;
        }
        minY += b.cpos.y;
      } else minY = b.cpos.y - b.radius;
      if (minY < b.floor) {
        b.cpos.y += b.floor - minY;
        if (b.vel.y < 0) {
          const hit = -b.vel.y;
          b.vel.y = hit * b.bounce;
          if (b.vel.y < 0.7) b.vel.y = 0;
          b.vel.x *= 0.72; b.vel.z *= 0.72;
          b.ang.multiplyScalar(0.6);
          if (hit > 1.2 && b.onHit) b.onHit(hit, b);
        } else {
          b.vel.x *= Math.max(0, 1 - 8 * d); b.vel.z *= Math.max(0, 1 - 8 * d);
          b.ang.multiplyScalar(Math.max(0, 1 - 7 * d));
        }
        if (b.vel.lengthSq() < 0.05 && b.ang.lengthSq() < 0.25) { b.asleep = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); }
      }
    }
    // write back: obj.position = cpos - R * (scale * center)
    _off.copy(b.center).multiply(b.obj.scale).applyQuaternion(b.obj.quaternion);
    b.obj.position.copy(b.cpos).sub(_off);
  }

  // Fling a real piece (it is tracked, so dispose puts it back). vel in squares per second, ang in rad per second.
  function launch(obj, { vel, ang, center, bounce = 0.35, gravity = -14, onHit } = {}) {
    track(obj);
    const { pts } = samplePoints(obj, 160);
    const loc = new THREE.Vector3(), rel = new THREE.Matrix4();
    obj.updateMatrix();
    rel.copy(obj.matrix).invert();
    for (let i = 0; i < pts.length; i += 3) { loc.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(rel); pts[i] = loc.x; pts[i + 1] = loc.y; pts[i + 2] = loc.z; }
    const c = center || new THREE.Vector3(0, heightOf(obj) * 0.45 / (obj.scale.y || 1), 0);
    return body(obj, { vel: vel || new THREE.Vector3(2, 4, 0), ang: ang || new THREE.Vector3(0, 0, 4), center: c, pts, bounce, gravity, onHit });
  }

  // ------------------------------------------------------------ piece state tracking
  // track(obj): remember position, rotation, scale and visibility; dispose() restores them. launch(), slice() and
  // shatter() call it for you. Call it yourself before moving a piece by hand, unless the scene means to leave it moved.
  function track(obj) {
    if (!tracked.has(obj)) tracked.set(obj, { p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone(), v: obj.visible });
    return obj;
  }
  function hide(obj) { track(obj); obj.visible = false; }

  // ------------------------------------------------------------ slicing
  // slice(obj, opts) cuts a piece in two along a plane. The original is hidden (restored on dispose) and two
  // clipped copies take its place; each is wrapped in a pivot group at the cut point and driven by a body, so they
  // slide apart and fall. The cut plane is either:
  //   { point, normal }            explicit, in parent space, or
  //   { at, tilt, azimuth }        at = fraction of the piece's height (default 0.5), tilt = degrees away from a
  //                                horizontal cut (0 = level), azimuth = the direction of the tilt in radians.
  // Other options: push (sideways speed, default 1.2), pop (upward speed, default 1.5), spin (rad/s, default 2.5),
  // cap (colour of the cut surface), gravity, bounce, life (seconds until the halves shrink away), delay-free.
  // Returns { top, bottom, pivots, done } where top is the half on the plane normal's side, bottom the other.
  function slice(obj, o = {}) {
    const p = space(obj);
    obj.updateWorldMatrix(true, true);
    p.updateWorldMatrix(true, false);
    const h = heightOf(obj);
    let normal, point;
    if (o.normal) {
      normal = o.normal.clone().normalize();
      point = (o.point || basePoint(obj).add(new THREE.Vector3(0, h * (o.at ?? 0.5), 0))).clone();
    } else {
      const tilt = THREE.MathUtils.degToRad(o.tilt ?? 0), az = o.azimuth ?? 0;
      normal = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize();
      point = basePoint(obj).add(new THREE.Vector3(0, h * (o.at ?? 0.5), 0));
    }
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    const sample = samplePoints(obj, o.samples ?? 520);
    const body0 = obj.getObjectByProperty('isMesh', true)?.material;
    const baseCol = (body0?.color || new THREE.Color('#ddd')).clone();
    const cap = o.cap ? new THREE.Color(o.cap) : baseCol.clone().lerp(new THREE.Color('#9a8f80'), 0.45);

    const meshes = [];
    obj.traverse((m) => { if (m.isMesh) meshes.push(m); });
    _inv.copy(p.matrixWorld).invert();
    const rel = new THREE.Matrix4().multiplyMatrices(_inv, obj.matrixWorld);

    const make = (sign) => {
      // sign +1: keep the normal side (cut away dot > d of the flipped plane)
      const pivot = new THREE.Group();
      pivot.position.copy(point);
      const content = cloneBare(obj);
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3();
      new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(-point.x, -point.y, -point.z), rel).decompose(pos, quat, sc);
      content.position.copy(pos); content.quaternion.copy(quat); content.scale.copy(sc);
      content.visible = true;
      pivot.add(content);
      const clones = [];
      content.traverse((m) => { if (m.isMesh) clones.push(m); });
      clones.forEach((m, i) => {
        const src = meshes[i];
        // plane (parent space) to this mesh's local space; for sign +1 we cut away the negative side
        const loc = plane.clone();
        if (sign > 0) loc.negate();
        _m.multiplyMatrices(_inv, src.matrixWorld).invert();
        loc.applyMatrix4(_m);
        const mats = Array.isArray(src.material) ? src.material : [src.material];
        const made = mats.map((mm) => own(makeClipped(mm, loc, cap)));
        m.material = Array.isArray(src.material) ? made : made[0];
        m.customDepthMaterial = own(makeClipDepth(loc));
        m.castShadow = true; m.receiveShadow = true;
      });
      // contact points on this side, relative to the pivot
      const keep = [];
      for (let i = 0; i < sample.pts.length; i += 3) {
        const x = sample.pts[i], y = sample.pts[i + 1], z = sample.pts[i + 2];
        const d = plane.distanceToPoint(_v.set(x, y, z));
        if (sign > 0 ? d >= -0.01 : d <= 0.01) keep.push(x - point.x, y - point.y, z - point.z);
      }
      return { pivot, pts: new Float32Array(keep) };
    };
    const A = make(+1), B = make(-1);
    hide(obj);
    add(A.pivot); add(B.pivot);

    const push = o.push ?? 1.2, pop = o.pop ?? 1.5, spin = o.spin ?? 2.5;
    // sideways direction: along the plane, away from the piece axis; falls back to a random heading
    const side = new THREE.Vector3().crossVectors(normal, UP);
    if (side.lengthSq() < 1e-4) side.set(Math.cos(o.azimuth ?? 0), 0, Math.sin(o.azimuth ?? 0)); else side.normalize();
    const lat = side.clone().cross(normal).normalize();   // in-plane, perpendicular to side
    const along = new THREE.Vector3().copy(lat); along.y = 0; if (along.lengthSq() < 1e-4) along.copy(side); along.normalize();
    const common = { gravity: o.gravity ?? -14, bounce: o.bounce ?? 0.28, life: o.life, center: new THREE.Vector3(), onHit: o.onHit };
    const bTop = body(A.pivot, { ...common, pts: A.pts, vel: new THREE.Vector3(along.x * push, pop, along.z * push), ang: side.clone().multiplyScalar(-spin) });
    const bBot = body(B.pivot, { ...common, pts: B.pts, vel: new THREE.Vector3(-along.x * push * 0.35, pop * 0.15, -along.z * push * 0.35), ang: side.clone().multiplyScalar(spin * 0.25) });
    return { top: A.pivot, bottom: B.pivot, bodies: [bTop, bBot], pivots: [A.pivot, B.pivot], point, normal };
  }

  // ------------------------------------------------------------ shatter
  const chunkGeos = () => cached('chunks', () => {
    const list = [];
    for (let i = 0; i < 5; i++) {
      let g = new THREE.IcosahedronGeometry(1, 0);
      const pos = g.attributes.position, seen = new Map();
      for (let v = 0; v < pos.count; v++) {
        const key = [pos.getX(v), pos.getY(v), pos.getZ(v)].map((n) => n.toFixed(3)).join(',');
        if (!seen.has(key)) seen.set(key, new THREE.Vector3(rand(0.55, 1.2), rand(0.55, 1.2), rand(0.55, 1.2)));
        const j = seen.get(key);
        pos.setXYZ(v, pos.getX(v) * j.x, pos.getY(v) * j.y, pos.getZ(v) * j.z);
      }
      g.computeVertexNormals();
      list.push(g);
    }
    return { dispose() { list.forEach((g) => g.dispose()); }, list };
  });

  // shatter(obj, opts): the piece breaks into shards of its own material. Original hidden (restored on dispose).
  // Options: count (default 28), power (outward speed, default 3), up (default 3), size (shard scale in squares,
  // default 0.09), origin (blast centre in parent space, default the piece's middle), life.
  // Returns { shards, bodies }.
  function shatter(obj, o = {}) {
    const h = heightOf(obj);
    const { pts, refs } = samplePoints(obj, 600);
    const n = pts.length / 3;
    const base = basePoint(obj);
    const origin = (o.origin || base.clone().add(new THREE.Vector3(0, h * 0.5, 0))).clone();
    const count = o.count ?? 28, power = o.power ?? 3, up = o.up ?? 3, size = o.size ?? 0.09;
    const geos = chunkGeos().list;
    const shards = [], list = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * n);
      const mat = Array.isArray(refs[idx].material) ? refs[idx].material[0] : refs[idx].material;
      const mesh = new THREE.Mesh(pick(geos), mat);
      const s = size * rand(0.45, 1.5);
      mesh.scale.set(s * rand(0.8, 1.4), s * rand(0.7, 1.2), s * rand(0.8, 1.4));
      mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      // pull points toward the axis so shards come from inside the volume as well as the skin
      const k = rand(0.2, 1);
      mesh.position.set(base.x + (pts[idx * 3] - base.x) * k, pts[idx * 3 + 1], base.z + (pts[idx * 3 + 2] - base.z) * k);
      mesh.castShadow = true; mesh.receiveShadow = true;
      add(mesh);
      const dir = mesh.position.clone().sub(origin); dir.y = Math.max(dir.y * 0.5, 0.05);
      if (dir.lengthSq() < 1e-4) dir.set(rand(-1, 1), 0.5, rand(-1, 1));
      dir.normalize();
      list.push(body(mesh, {
        radius: s * 0.8, vel: dir.multiplyScalar(power * rand(0.5, 1.2)).add(new THREE.Vector3(0, up * rand(0.4, 1), 0)),
        ang: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), bounce: 0.35, life: o.life,
      }));
      shards.push(mesh);
    }
    hide(obj);
    return { shards, bodies: list };
  }

  // ------------------------------------------------------------ particles
  // burst(point, opts): a puff of small blobs from one InstancedMesh. Options:
  //   count 24, colors (array of css colours), speed [2,5], dir (cone axis, default up), spread (cone half angle, 1.2),
  //   gravity -12, size [0.03,0.08], life [0.7,1.3], grow 0 (extra size over life, for dust), drag 0,
  //   stain true (blobs that reach the board flatten into a stain before fading), glow false (additive, bright).
  // Returns the handle ({ done: Promise }) and cleans itself up once every blob has faded.
  function burst(point, o = {}) {
    const count = o.count ?? 24;
    const geo = cached('blob', () => new THREE.SphereGeometry(1, 16, 10));
    const mat = own(o.glow
      ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: o.rough ?? 0.25, metalness: 0 }));
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false; mesh.receiveShadow = false;
    const colors = o.colors || BLOOD;
    const axis = (o.dir || UP).clone().normalize();
    const perp = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(axis, perp).normalize(), t2 = new THREE.Vector3().crossVectors(axis, t1);
    const ps = [];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), c = Math.cos(rand(0, o.spread ?? 1.2)), s = Math.sqrt(1 - c * c);
      const d = axis.clone().multiplyScalar(c).addScaledVector(t1, s * Math.cos(a)).addScaledVector(t2, s * Math.sin(a));
      ps.push({
        p: point.clone().add(new THREE.Vector3(rand(-0.03, 0.03), rand(-0.03, 0.03), rand(-0.03, 0.03))),
        v: d.multiplyScalar(range(o.speed ?? [2, 5])),
        size: range(o.size ?? [0.03, 0.08]), life: range(o.life ?? [0.7, 1.3]), age: 0, landed: false, flat: rand(1.5, 2.6),
      });
      mesh.setColorAt(i, col.set(pick(colors)));
    }
    mesh.instanceColor.needsUpdate = true;
    add(mesh);
    const b = { mesh, ps, o, g: o.gravity ?? -12, drag: o.drag ?? 0, grow: o.grow ?? 0, stain: o.stain ?? true, resolve: null, floor: o.floor ?? 0.01 };
    b.done = new Promise((r) => { b.resolve = r; });
    if (disposed) { mesh.dispose(); b.resolve(); } else bursts.add(b);
    return b;
  }
  const _mat = new THREE.Matrix4(), _pos = new THREE.Vector3(), _scl = new THREE.Vector3(), _idq = new THREE.Quaternion();
  function stepBurst(b, dt) {
    let alive = 0;
    b.ps.forEach((q, i) => {
      q.age += dt;
      const k = q.age / q.life;
      if (k >= 1) { _mat.makeScale(0, 0, 0); b.mesh.setMatrixAt(i, _mat); return; }
      alive++;
      if (!q.landed) {
        q.v.y += b.g * dt;
        if (b.drag) q.v.multiplyScalar(Math.max(0, 1 - b.drag * dt));
        q.p.addScaledVector(q.v, dt);
        if (q.p.y <= b.floor && q.v.y < 0 && b.stain) { q.landed = true; q.p.y = b.floor; q.v.set(0, 0, 0); }
        else if (q.p.y < 0.005) { q.p.y = 0.005; q.v.y = Math.abs(q.v.y) * 0.3; }
      }
      const fade = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      const s = q.size * (1 + b.grow * k) * fade;
      if (q.landed) _scl.set(s * q.flat, s * 0.12, s * q.flat); else _scl.set(s, s, s);
      _mat.compose(q.p, _idq, _scl);
      b.mesh.setMatrixAt(i, _mat);
    });
    b.mesh.instanceMatrix.needsUpdate = true;
    if (!alive) { bursts.delete(b); remove(b.mesh); b.mesh.dispose(); b.resolve(); }
  }

  // Ready made bursts. All take a point in parent space.
  const splatter = (point, o = {}) => burst(point, { count: 28, speed: [1.5, 5], size: [0.025, 0.07], life: [1.4, 2.4], colors: BLOOD, ...o });
  const dust = (point, o = {}) => burst(point, { count: 14, speed: [0.4, 1.4], spread: 1.4, size: [0.07, 0.14], life: [0.7, 1.1], gravity: -1, grow: 1.4, drag: 2.5, stain: false, rough: 1, colors: DUST, ...o });
  const puff = (point, o = {}) => burst(point, { count: 20, speed: [0.6, 2.2], spread: 3, size: [0.05, 0.12], life: [0.6, 1.0], gravity: 0.5, grow: 1.2, drag: 2, stain: false, glow: true, colors: MAGIC, ...o });
  const sparks = (point, o = {}) => burst(point, { count: 14, speed: [2, 5], spread: 2.6, size: [0.015, 0.03], life: [0.3, 0.6], gravity: -9, stain: false, glow: true, colors: ['#ffe9a6', '#fff7d6', '#ffbf5a'], ...o });
  const confetti = (point, o = {}) => burst(point, { count: 26, speed: [2, 5], spread: 1.1, size: [0.03, 0.055], life: [1.0, 1.7], gravity: -7, drag: 0.8, stain: true, colors: CONFETTI, rough: 0.6, ...o });

  // flash(point, opts): a glowing ball that swells and fades, plus an optional ring on the board (a crown flash,
  // a magic pop, an impact). size 0.8, dur 0.35, color, ring true. Returns a promise.
  function flash(point, { color = '#fff2b8', size = 0.8, dur = 0.35, ring = true } = {}) {
    const ball = new THREE.Mesh(
      cached('flashball', () => new THREE.SphereGeometry(1, 20, 14)),
      own(new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    ball.position.copy(point); ball.frustumCulled = false;
    add(ball);
    let rg = null;
    if (ring) {
      rg = new THREE.Mesh(
        cached('flashring', () => new THREE.RingGeometry(0.82, 1, 48)),
        own(new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })));
      rg.rotation.x = -Math.PI / 2; rg.position.set(point.x, 0.012, point.z);
      add(rg);
    }
    return tween(dur, (k) => {
      ball.scale.setScalar(Math.max(1e-3, size * (0.2 + 0.8 * ease.outCubic(k))));
      ball.material.opacity = (1 - k) * 0.9;
      if (rg) { rg.scale.setScalar(Math.max(1e-3, size * 1.8 * ease.outCubic(k))); rg.material.opacity = (1 - k) * 0.8; }
      if (k >= 1) { remove(ball); if (rg) remove(rg); }
    }, { ease: ease.linear });
  }

  // stars(point, opts): gold stars orbiting a point, the cartoon "seeing stars". count 5, radius 0.22, dur 1.2.
  function stars(point, { count = 5, radius = 0.22, dur = 1.2, size = 0.07 } = {}) {
    const geo = cached('star', () => {
      const sh = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.42 : 1, a = Math.PI / 2 + i * Math.PI / 5; (i ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * r, Math.sin(a) * r); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false });
      g.center();
      return g;
    });
    const mat = cached('starmat', () => new THREE.MeshStandardMaterial({ color: '#ffd23f', metalness: 0.6, roughness: 0.3, emissive: '#ffb300', emissiveIntensity: 0.6 }));
    const g = new THREE.Group();
    g.position.copy(point);
    const ms = [];
    for (let i = 0; i < count; i++) { const m = new THREE.Mesh(geo, mat); m.scale.setScalar(size); g.add(m); ms.push(m); }
    add(g);
    return tween(dur, (k, t) => {
      const fade = k > 0.8 ? Math.max(1e-3, 1 - (k - 0.8) / 0.2) : Math.min(1, t * 6);
      ms.forEach((m, i) => {
        const a = t * 9 + (i / count) * Math.PI * 2;
        m.position.set(Math.cos(a) * radius, Math.sin(t * 14 + i) * 0.015, Math.sin(a) * radius);
        m.rotation.set(0, a, t * 6);
        m.scale.setScalar(size * fade);
      });
      if (k >= 1) remove(g);
    });
  }

  // hole(point, opts): a dark disc on the board for trapdoor gags. Returns { mesh, set(k) }, k 0 closed to 1 open.
  function hole(point, { radius = 0.38 } = {}) {
    const m = new THREE.Mesh(
      cached('holegeo', () => new THREE.CircleGeometry(1, 40)),
      cached('holemat', () => new THREE.MeshBasicMaterial({ color: 0x050505 })));
    m.rotation.x = -Math.PI / 2; m.position.set(point.x, 0.008, point.z); m.scale.setScalar(1e-3);
    add(m);
    return { mesh: m, set(k) { m.scale.setScalar(Math.max(1e-3, radius * k)); m.visible = k > 0.01; } };
  }

  // ------------------------------------------------------------ props
  // prop(name, opts) -> Group, built along +Y with its origin at the grip (the end you hold). Added to the parent.
  // Names: sword, lance, staff, mace, shield, crown, bomb. opts.length scales the long ones. Remove with fx.remove(g)
  // (dispose does it anyway).
  const steel = () => cached('steel', () => new THREE.MeshStandardMaterial({ color: '#cfd5de', metalness: 1, roughness: 0.22 }));
  const gold = () => cached('gold', () => new THREE.MeshStandardMaterial({ color: '#e8b850', metalness: 1, roughness: 0.2 }));
  const wood = () => cached('wood', () => new THREE.MeshStandardMaterial({ color: '#6b4426', metalness: 0, roughness: 0.55 }));
  const cloth = (c) => cached('cloth' + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }));
  const mesh = (g, m) => { const x = new THREE.Mesh(own(g), m); x.castShadow = true; x.receiveShadow = true; return x; };

  function prop(name, o = {}) {
    const g = new THREE.Group();
    const L = o.length;
    if (name === 'sword') {
      const len = L ?? 0.85;
      g.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.2, 12), wood()).translateY(0.1));
      g.add(mesh(new THREE.SphereGeometry(0.035, 12, 8), gold()).translateY(-0.005));
      g.add(mesh(new THREE.BoxGeometry(0.26, 0.04, 0.06), gold()).translateY(0.21));
      const blade = mesh(new THREE.BoxGeometry(0.07, len, 0.018), steel());
      blade.position.y = 0.23 + len / 2; g.add(blade);
      const tip = mesh(new THREE.ConeGeometry(0.0495, 0.12, 4), steel());
      tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.26); tip.position.y = 0.23 + len + 0.06; g.add(tip);
    } else if (name === 'lance') {
      const len = L ?? 1.9;
      g.add(mesh(new THREE.CylinderGeometry(0.022, 0.03, len, 12), wood()).translateY(len / 2));
      g.add(mesh(new THREE.ConeGeometry(0.045, 0.28, 14), steel()).translateY(len + 0.14));
      g.add(mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 16), gold()).translateY(len - 0.02).rotateX(Math.PI / 2));
      const flag = mesh(new THREE.PlaneGeometry(0.22, 0.12), cloth('#c0392b'));
      flag.position.set(0.12, len - 0.14, 0); g.add(flag);
    } else if (name === 'staff') {
      const len = L ?? 1.5;
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.026, len, 12), wood()).translateY(len / 2));
      g.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), gold()).translateY(len + 0.03).rotateY(Math.PI / 2));
      const orb = new THREE.Mesh(own(new THREE.SphereGeometry(0.05, 16, 12)), own(new THREE.MeshBasicMaterial({ color: o.glow || '#9be8ff', toneMapped: false })));
      orb.position.y = len + 0.03; g.add(orb);
      g.userData.orb = orb;
    } else if (name === 'mace') {
      const len = L ?? 0.9;
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.026, len, 10), wood()).translateY(len / 2));
      const head = mesh(new THREE.SphereGeometry(0.1, 14, 10), steel()); head.position.y = len + 0.08; g.add(head);
      for (let i = 0; i < 10; i++) {
        const sp = mesh(new THREE.ConeGeometry(0.02, 0.07, 6), steel());
        const d = new THREE.Vector3().setFromSphericalCoords(1, Math.acos(1 - 2 * ((i + 0.5) / 10)), i * 2.4);
        sp.position.copy(d).multiplyScalar(0.12).add(head.position);
        sp.quaternion.setFromUnitVectors(UP, d); g.add(sp);
      }
    } else if (name === 'shield') {
      const s = new THREE.Shape();
      s.moveTo(0, 0.28); s.lineTo(0.2, 0.2); s.quadraticCurveTo(0.2, -0.1, 0, -0.3); s.quadraticCurveTo(-0.2, -0.1, -0.2, 0.2); s.closePath();
      const sh = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), steel());
      g.add(sh);
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), gold()).rotateX(Math.PI / 2).translateY(0).translateZ(0.015).translateY(0.05));
    } else if (name === 'crown') {
      const ring = mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.1, 24, 1, true), gold());
      ring.material = cached('goldds', () => { const m = gold().clone(); m.side = THREE.DoubleSide; return m; });
      g.add(ring);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        const pt = mesh(new THREE.ConeGeometry(0.035, 0.1, 8), gold());
        pt.position.set(Math.cos(a) * 0.165, 0.09, Math.sin(a) * 0.165); g.add(pt);
        const ball = mesh(new THREE.SphereGeometry(0.018, 8, 6), gold()); ball.position.set(Math.cos(a) * 0.165, 0.15, Math.sin(a) * 0.165); g.add(ball);
      }
    } else if (name === 'bomb') {
      g.add(mesh(new THREE.SphereGeometry(0.11, 18, 14), cached('bombmat', () => new THREE.MeshStandardMaterial({ color: '#16161a', roughness: 0.35, metalness: 0.4 }))).translateY(0.11));
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.04, 8), steel()).translateY(0.23));
      const fuse = new THREE.Mesh(own(new THREE.SphereGeometry(0.02, 8, 6)), own(new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false })));
      fuse.position.y = 0.27; g.add(fuse);
    } else throw new Error(`fx.prop: unknown prop ${name}`);
    add(g);
    return g;
  }

  // ------------------------------------------------------------ squash, stretch and friends
  const volume = (obj, base, sy) => { const sx = 1 / Math.sqrt(sy); obj.scale.set(base.x * sx, base.y * sy, base.z * sx); };

  // squash, wobble, shake and hop track their target (dispose restores it). squash(obj, { y, dur, hold, recover, ease }): scales the piece to y of its height (volume kept, so it bulges
  // sideways), holds, and springs back with an elastic ease. y < 1 squashes, y > 1 stretches. The origin of a piece is
  // its base, so the base stays on the board. Resolves when back at the start scale.
  async function squash(obj, { y = 0.55, dur = 0.12, hold = 0.08, recover = 0.35, ease: e = ease.out } = {}) {
    track(obj);
    const base = obj.scale.clone();
    await tween(dur, (k) => volume(obj, base, 1 + (y - 1) * k), { ease: e });
    if (hold > 0) await wait(hold);
    await tween(recover, (k) => volume(obj, base, y + (1 - y) * k), { ease: ease.outElastic });
    obj.scale.copy(base);
  }
  // stretch is squash with a tall target
  const stretch = (obj, o = {}) => squash(obj, { y: 1.5, ...o });

  // wobble(obj, { amp, freq, dur, axis }): damped rock back and forth, for hits and tantrums. axis 'x' | 'z' (default z).
  async function wobble(obj, { amp = 0.25, freq = 7, dur = 0.8, axis = 'z' } = {}) {
    track(obj);
    const base = obj.rotation[axis];
    await tween(dur, (k, t) => { obj.rotation[axis] = base + Math.sin(t * dur * freq * Math.PI * 2) * amp * (1 - k) * (1 - k); }, {});
    obj.rotation[axis] = base;
  }

  // shake(obj, { amp, dur, freq }): jitter the position sideways (rage, fear). Returns to the start.
  async function shake(obj, { amp = 0.04, dur = 0.6, freq = 28 } = {}) {
    track(obj);
    const bx = obj.position.x, bz = obj.position.z;
    await tween(dur, (k, t) => {
      const a = amp * (1 - k);
      obj.position.x = bx + Math.sin(t * dur * freq) * a; obj.position.z = bz + Math.cos(t * dur * freq * 1.3) * a;
    });
    obj.position.x = bx; obj.position.z = bz;
  }

  // hop(obj, { height, dur }): a parabolic hop straight up and down on y.
  async function hop(obj, { height = 0.3, dur = 0.3 } = {}) {
    track(obj);
    const y0 = obj.position.y;
    await tween(dur, (k) => { obj.position.y = y0 + 4 * height * k * (1 - k); });
    obj.position.y = y0;
  }

  // moveTo(obj, pos, dur, easeFn): slide to a point in parent space.
  function moveTo(obj, to, dur = 0.4, e = ease.inOut) {
    const from = obj.position.clone();
    return tween(dur, (k) => obj.position.lerpVectors(from, to, k), { ease: e });
  }
  // turnTo(obj, yaw, dur): rotate about y to an absolute angle by the short way.
  function turnTo(obj, yaw, dur = 0.25, e = ease.inOut) {
    const from = obj.rotation.y;
    let d = ((yaw - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return tween(dur, (k) => { obj.rotation.y = from + d * k; }, { ease: e });
  }
  // growTo(obj, s, dur): uniform scale, relative to the starting scale. Use 0.001 to vanish (never exactly 0).
  function scaleTo(obj, s, dur = 0.3, e = ease.inOut) {
    const base = obj.scale.clone();
    return tween(dur, (k) => obj.scale.copy(base).multiplyScalar(1 + (s - 1) * k), { ease: e });
  }

  // ------------------------------------------------------------ frame update and teardown
  function update(dt) {
    if (disposed) return;
    time += dt;
    for (const tw of [...tweens]) {
      tw.t += dt;
      const t = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.ease(t), t);
      if (t >= 1) { tweens.delete(tw); tw.resolve(); }
    }
    for (const b of bodies) {
      stepBody(b, dt);
      b.age += dt;
      if (b.life !== Infinity && b.age > b.life) {
        const k = Math.min(1, (b.age - b.life) / b.fade);
        b.obj.scale.copy(b.baseScale).multiplyScalar(Math.max(1e-3, 1 - k));
        if (k >= 1) { b.obj.visible = false; bodies.delete(b); }
      }
    }
    for (const b of [...bursts]) stepBurst(b, dt);
  }

  // dispose(): stop everything, remove all added objects, free geometries and materials made here, put tracked
  // pieces back (position, rotation, scale, visibility). Pending tweens resolve without a final call.
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const tw of tweens) tw.resolve();
    tweens.clear(); bodies.clear();
    for (const b of bursts) { b.mesh.dispose(); b.resolve(); }
    bursts.clear();
    for (const o of objects) o.removeFromParent();
    objects.clear();
    for (const [obj, s] of tracked) { obj.position.copy(s.p); obj.quaternion.copy(s.q); obj.scale.copy(s.s); obj.visible = s.v; }
    tracked.clear();
    for (const r of owned) { try { r.dispose?.(); } catch (e) { /* ignore */ } }
    owned.length = 0; cache.clear();
    signal?.removeEventListener?.('abort', skip);
  }

  return {
    update, dispose, skip,
    tween, wait, ease,
    slice, shatter, burst, splatter, dust, puff, sparks, confetti, flash, stars, hole, prop,
    squash, stretch, wobble, shake, hop, moveTo, turnTo, scaleTo,
    body, launch, track, hide, own, add, remove,
    samplePoints, heightOf,
    get time() { return time; },
    get skipped() { return skipped; },
    get disposed() { return disposed; },
    get active() { return tweens.size + bursts.size + [...bodies].filter((b) => !b.asleep).length; },
  };
}
