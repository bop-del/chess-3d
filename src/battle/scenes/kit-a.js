// What the pawn, knight and bishop scenes need on top of ctx.fx and the director's clock: a small stage that poses the
// two pieces from plain state numbers (distance along the aim, lift, tip, spin, squash), props that follow the
// attacker's hand, and a lit bolt. Timing, skip and cleanup belong to the director and fx, not to this file.
import * as THREE from 'three';
import { noAO } from '../fx.js';

export const SIZE = { p: 0.9, r: 1.0, n: 1.2, b: 1.35, q: 1.6, k: 1.85 };
export const RADIUS = { p: 0.28, r: 0.34, n: 0.3, b: 0.31, q: 0.34, k: 0.36 };
// 0 light (pawn), 1 medium (knight, bishop), 2 heavy (rook, queen, king)
export const weight = (type) => (type === 'p' ? 0 : type === 'n' || type === 'b' ? 1 : 2);
export const lerp = (a, b, u) => a + (b - a) * u;
export const bump = (u) => Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
const UP = new THREE.Vector3(0, 1, 0);
const yawOf = (v) => Math.atan2(-v.x, -v.z);

// Pose a group tipped around its base rim: base is the base centre, tip turns the top towards aim (negative leans back).
const _k = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3();
export function pose(g, aim, rb, base, { tip = 0, spin = 0, yaw = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  _q.setFromAxisAngle(UP, yaw + spin);
  if (tip) {
    _k.set(aim.z, 0, -aim.x);
    _q2.setFromAxisAngle(_k, tip);
    _p.copy(aim).multiplyScalar((tip > 0 ? 1 : -1) * rb).add(base);
    g.position.copy(base).sub(_p).applyQuaternion(_q2).add(_p);
    g.quaternion.copy(_q2).multiply(_q);
  } else { g.position.copy(base); g.quaternion.copy(_q); }
  g.scale.set(sx, sy, sz);
}

// The stage. `a` and `v` are the numbers to animate (with fx.tween); a frame callback on the scene clock turns them
// into poses. Set v.on = false when something else (fx.slice, fx.shatter, fx.launch) takes over the victim.
export function createStage(ctx) {
  const { attackerObj: A, victimObj: V, fx } = ctx;
  const aim = new THREE.Vector3(ctx.dir.x, 0, ctx.dir.z).normalize();
  const side = new THREE.Vector3(aim.z, 0, -aim.x);
  const C = new THREE.Vector3(ctx.center.x, 0, ctx.center.z);
  const rbA = RADIUS[A.type] || 0.32, rbV = RADIUS[V.type] || 0.32;
  const hV = V.group.userData.height || SIZE[V.type] || 1.2;
  const run0 = Math.max(0, (C.x - A.group.position.x) * aim.x + (C.z - A.group.position.z) * aim.z);
  const inner = A.group.children[0];
  const f0 = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, inner?.rotation?.y || 0);
  const yawG = yawOf(aim) - yawOf(f0);          // turns the attacker's front towards the victim (knights look sideways)
  const at = (d, y = 0) => new THREE.Vector3(C.x + aim.x * d, y, C.z + aim.z * d);
  const a = { d: -run0, y: 0, tip: 0, yaw: 0, sx: 1, sy: 1, sz: 1 };
  const v = { on: true, off: 0, lat: 0, y: 0, tip: 0, spin: 0, sx: 1, sy: 1, sz: 1 };
  const mounts = [];
  fx.track(A.group); fx.track(V.group);

  const apply = () => {
    pose(A.group, aim, rbA, at(a.d, a.y), a);
    if (v.on) pose(V.group, aim, rbV, new THREE.Vector3(C.x + aim.x * v.off + side.x * v.lat, v.y, C.z + aim.z * v.off + side.z * v.lat), v);
    for (const m of mounts) { m.position.copy(A.group.position); m.position.y += m.userData.lift; m.rotation.y = yawOf(aim); }
  };
  ctx.onFrame(apply);
  apply();

  const tw = (sec, fn, ease) => fx.tween(sec, fn, ease ? { ease } : {});
  const volume = (o, k) => { o.sy = k; o.sx = o.sz = 1 / Math.sqrt(k); };
  return {
    A, V, fx, aim, side, C, hV, rbV, rbA, run0, yawG, a, v, at, tw, volume,
    live: () => !ctx.signal.aborted,
    // a group that follows the attacker (position and heading); props are built facing -z (the aim)
    mount(lift = 0) { const g = new THREE.Group(); g.userData.lift = lift; fx.add(g); mounts.push(g); return g; },
    centre: (k = 0.5) => new THREE.Vector3(C.x, hV * k, C.z),
    // an object's position in the pieces' space
    where(obj) { ctx.root.updateWorldMatrix(true, true); return ctx.root.worldToLocal(obj.getWorldPosition(new THREE.Vector3())); },
  };
}

// A lit rod between two points that fades (the bishop's bolt).
export function beam(fx, from, to, { dur = 0.25, radius = 0.035, color = '#fff2b0' } = {}) {
  const geo = fx.own(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true));
  const mat = fx.own(new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  noAO(m);
  const d = new THREE.Vector3().subVectors(to, from);
  const len = Math.max(0.001, d.length());
  m.position.copy(from).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
  fx.add(m);
  return fx.tween(dur, (k, t) => {
    const w = radius * (0.5 + 0.9 * Math.sin(Math.PI * t)) * (1 + 0.25 * Math.sin(t * 90));
    m.scale.set(w, len, w);
    mat.opacity = 0.95 * (1 - k * k);
    if (t >= 1) fx.remove(m);
  });
}
