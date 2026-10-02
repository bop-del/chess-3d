// Helpers for the rook, queen and king scenes (scenes-b), on top of the director's ctx and the effects kit ctx.fx.
// Only what fx lacks lives here: a small score (timed tracks driven by one ctx.tween, so they run on the scene clock and
// stop on skip), a few rig helpers. Disposal and restoring the pieces belong to the director.
import * as THREE from 'three';

const V3 = THREE.Vector3;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  io: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)),
  back: (u) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
  elastic: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : Math.pow(2, -9 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};
// How hard the victim is to move or break: pawn light, queen heavy. Scenes scale their reactions with it (0 to 1).
export const WEIGHT = { p: 0, n: 0.45, b: 0.5, r: 0.7, q: 1 };

// Common facts of a scene. The attacker stands short of the victim along dir (the game stages it so).
export function rig(ctx) {
  const A = ctx.attackerObj.group, V = ctx.victimObj.group;
  const f = ctx.dir.clone(), c = ctx.center.clone();
  const r = {
    ctx, fx: ctx.fx, A, V, f, c, a0: A.position.clone(),
    side: new V3(1, 0, 0), up: new V3(0, 1, 0),
    w: WEIGHT[ctx.victimObj.type] ?? 0.5, vh: V.userData.height || 1.2, ah: A.userData.height || 1.2,
    // a point relative to the victim: kf along the attack direction, ks sideways, y up
    p(kf = 0, ks = 0, y = 0) { return c.clone().addScaledVector(f, kf).addScaledVector(r.side, ks).setY(y); },
    // squash and stretch with the volume kept
    squash(g, sy, sxz = 1 / Math.sqrt(Math.max(0.05, sy))) { g.scale.set(sxz, sy, sxz); },
    // turn a piece about a pivot (a point in root space) from its unrotated pose at basePos
    rotAbout(g, basePos, pivot, axis, ang) {
      g.quaternion.setFromAxisAngle(axis, ang);
      g.position.copy(basePos).sub(pivot).applyQuaternion(g.quaternion).add(pivot);
    },
    tipAxis(dir) { return new V3().crossVectors(r.up, dir).normalize(); },   // axis that tips an upright piece toward dir
    sfx(name, t, opts) { r.once(t, () => { try { ctx.sfx.play?.(name, opts); } catch (e) { /* sound is optional */ } }); },
    tracks: [],
    at(t0, t1, fn) { r.tracks.push({ t0, t1, fn, st: 0 }); },
    once(t, fn) { r.tracks.push({ t0: t, t1: t, fn, st: 0, once: true }); },
  };
  return r;
}

// Run the tracks on the scene clock for `total` seconds. Each track is a pure function of its progress, so the last call
// of every track always happens, in order, and the scene ends in a known pose.
export function play(r, total) {
  const tracks = r.tracks;
  return r.ctx.tween({
    dur: total,
    step: (e, u) => {
      const t = u * total;
      for (const k of tracks) {
        if (k.st === 2 || t < k.t0) continue;
        if (k.once) { k.st = 2; k.fn(); continue; }
        if (t >= k.t1) { k.st = 2; k.fn(1); } else { k.st = 1; k.fn((t - k.t0) / (k.t1 - k.t0)); }
      }
    },
  });
}

// A flat fading disc or ring on the board (a blood puddle, a shock ring). Returns set(radius, opacity).
export function decal(r, pos, color, { ring = false } = {}) {
  const fx = r.fx;
  const geo = fx.own(ring ? new THREE.RingGeometry(0.85, 1, 40) : new THREE.CircleGeometry(1, 28));
  const mat = fx.own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.012, pos.z); m.scale.setScalar(0.001);
  fx.add(m);
  return (radius, opacity) => { m.scale.setScalar(Math.max(0.001, radius)); mat.opacity = opacity; };
}

export function glowMesh(fx, geo, color, opacity = 1) {
  const mat = fx.own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const m = new THREE.Mesh(fx.own(geo), mat); m.frustumCulled = false; fx.add(m); return m;
}
