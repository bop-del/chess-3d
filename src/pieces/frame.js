// Shared frame for the procedural preview piece sets behind ?pieces= (CHE-368: crystal, mech). A set module gives
// build(type, color, mats) -> THREE.Group (front faces -z, base on y = 0) and its own materials; this turns it into the
// piece style pieceset.js takes: { id, make, height, warm, update, dispose }.
// Each (type, color) is built once; make() hands out clones that share geometry and materials. Animated parts carry
// userData.anim = { kind, ... } (see ANIMS); update(dt, root) moves them on every piece under root (the game's pieces group).
import * as THREE from 'three';

// per frame motion of a tagged part, t = seconds since the style was made, o = the part, a = its anim spec, p = the phase of the piece
const ANIMS = {
  bob: (o, a, t, p) => { o.position.y = a.y + Math.sin(t * (a.speed || 2) + p) * (a.amp || 0.03); },
  spin: (o, a, t, p) => { o.rotation[a.axis || 'y'] = (a.r0 || 0) + t * (a.speed || 1) + p; },
  sway: (o, a, t, p) => { o.rotation[a.axis || 'y'] = (a.r0 || 0) + Math.sin(t * (a.speed || 0.6) + p) * (a.amp || 0.4); },
  pulse: (o, a, t, p) => { o.scale.setScalar(1 + Math.sin(t * (a.speed || 3) + p) * (a.amp || 0.08)); },
};

/** createSetStyle({ id, build, materials, tick }): build(type, color) -> Group; materials: a list to dispose; tick(t, dt) per frame (shared material glow). */
export function createSetStyle({ id, build, materials = [], textures = [], tick }) {
  const protos = new Map();
  const heights = new Map();
  const parts = new WeakMap();   // inner group -> [[object, anim]]
  let t = 0, made = 0;
  const proto = (type, color) => {
    const k = type + color;
    let p = protos.get(k);
    if (!p) {
      p = build(type, color);
      p.updateMatrixWorld(true);
      // the resting height: animated parts at their rest pose, so a bobbing drone measures the same every time
      heights.set(k, Math.max(0.6, new THREE.Box3().setFromObject(p).max.y));
      p.traverse((o) => { if (o.isMesh) { o.castShadow = o.userData.noShadow !== true; o.receiveShadow = true; } });
      protos.set(k, p);
    }
    return p;
  };
  return {
    id,
    make(type, color) {
      const inner = proto(type, color).clone(true);
      const list = [];
      inner.traverse((o) => { if (o.userData.anim) list.push(o); });
      if (list.length) parts.set(inner, list);
      inner.userData.phase = (made++ * 2.39996) % 6.283;   // golden angle steps: neighbours never move in step, and a clip is the same every run
      return inner;
    },
    height(type, color) { proto(type, color); return heights.get(type + color); },
    warm(type, color) { proto(type, color); },
    update(dt, root) {
      if (!(dt > 0)) return;
      t += dt;
      tick?.(t, dt);
      if (!root) return;
      for (const wrap of root.children) {
        const inner = wrap.children[0];
        const list = inner && parts.get(inner);
        if (!list) continue;
        const ph = inner.userData.phase || 0;
        for (const o of list) ANIMS[o.userData.anim.kind]?.(o, o.userData.anim, t, ph);
      }
    },
    dispose() {
      for (const p of protos.values()) p.traverse((o) => o.geometry?.dispose());
      protos.clear();
      for (const m of materials) m.dispose();
      for (const x of textures) x.dispose();
    },
  };
}

// ---------------------------------------------------------------- geometry helpers shared by the sets
/** A mesh with an optional position, rotation and scale: m(geo, mat, [x, y, z], [rx, ry, rz], [sx, sy, sz]). */
export function m(geo, mat, pos, rot, scl) {
  const o = new THREE.Mesh(geo, mat);
  if (pos) o.position.set(...pos);
  if (rot) o.rotation.set(...rot);
  if (scl) o.scale.set(...scl);
  return o;
}
/** A group of children with an optional position. */
export function grp(children = [], pos) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  if (pos) g.position.set(...pos);
  return g;
}
/** Marks a part as animated (see ANIMS); bob keeps its rest height in a.y. */
export function anim(o, a) { o.userData.anim = a.kind === 'bob' ? { y: o.position.y, ...a } : a; return o; }
