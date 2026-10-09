// Wild captures for the lit themes (CHE-369, Options Scene row, ?capture=wild): a short fight per attacker type, then the victim shatters
// (no blood). Every fight has five beats: the weapon appears, a first strike the victim dodges, the victim's shield bash the
// attacker parries, the finishing blow with a coloured trail (the victim bursts into shards of its own material), and a
// short victory pose. The pawn thrusts a lance, the knight rears and chops with a sword, the bishop swings a staff with a
// glowing orb, the rook swings a heavy mace, the queen fights with a sword and pink magic, the king with a big golden
// sword. About 4 s of scene time.
import * as THREE from 'three';
import { setup, smash, home, weapon, touch, lerp, bump, inQuad, outQuad, inOut, outBack } from './common.js';
import { beam } from '../kit-a.js';
import { noAO } from '../../fx.js';

const UP = new THREE.Vector3(0, 1, 0);
const yawOf = (v) => Math.atan2(-v.x, -v.z);
const MAGIC = ['#ff7ad9', '#c48bff', '#ffd6f4', '#ffffff'];
// on the pale glass board an additive trail washes out: there the finisher trail is drawn opaque in a deeper colour
const GLASS_FIN = { n: '#ff7a1a', b: '#1693d6', r: '#e8461e', q: '#a35cff', k: '#ffc21a' };

// Per attacker: the weapon (prop, length, scale, where the hand is: [sideways, up, forward]), the fighting distance fd
// (squares from the victim's centre), and the weapon angles: 0 points up, negative leans forward towards the victim.
// rest: carried; w1, h1: first strike (wind up, end); guard: the parry; w2, h2: the finishing blow. trail and fin: arc colours.
const TYPES = {
  p: { prop: 'lance', len: 1.05, back: 0.3, scale: 0.9, grip: [0.24, 0.42, 0.04], fd: 1.5, rest: -1.25, guard: -0.55, trail: '#ffffff', fin: '#ffd36b', thrust: true },
  n: { prop: 'sword', len: 0.72, scale: 1, grip: [0.27, 0.74, 0.08], fd: 1.45, rest: 0.4, w1: 1.35, h1: -1.55, guard: -0.5, w2: 2.1, h2: -1.6, trail: '#ffffff', fin: '#ff9a3c', rear: true },
  b: { prop: 'staff', len: 1.1, glow: '#9be8ff', scale: 1, grip: [0.27, 0.62, 0.08], fd: 1.5, rest: 0.15, w1: 0.95, h1: -1.4, guard: -0.4, w2: 1.5, h2: -1.45, trail: '#bff0ff', fin: '#7fe3ff' },
  r: { prop: 'mace', len: 0.72, scale: 1.2, grip: [0.3, 0.58, 0.05], fd: 1.4, rest: 0.5, w1: 1.8, h1: -2.1, guard: -0.6, w2: 2.1, h2: -1.65, trail: '#ffffff', fin: '#ff6a3c', heavy: true },
  q: { prop: 'sword', len: 0.85, scale: 1, grip: [0.29, 0.9, 0.08], fd: 1.55, rest: 0.3, w1: 1.15, h1: -1.45, guard: -0.45, w2: 1.9, h2: -1.55, trail: '#ffb8ee', fin: '#c48bff', magic: true },
  k: { prop: 'sword', len: 1.0, scale: 1.15, grip: [0.36, 0.95, 0.08], fd: 1.7, rest: 0.5, w1: 1.05, h1: -1.45, guard: -0.5, w2: 1.8, h2: -1.6, trail: '#fff2c0', fin: '#ffcc33', royal: true },
};
// how far up the prop its tip sits (in prop units)
const TIP = { sword: (len) => 0.23 + len + 0.12, lance: (len) => len + 0.28, staff: (len) => len + 0.08, mace: (len) => len + 0.18 };

async function run(ctx) {
  const s = setup(ctx);
  const { a, v, L, aim, side } = s;
  const burst = { sparks: L.sparks, glints: L.glints, dust: L.dust, puff: (p, o) => s.fx.puff(p, o) };
  const T = TYPES[s.A.type] || TYPES.p;
  const low = L.low;

  // the camera looks across the fight: hold the weapon on the side towards it, the victim dodges away from it
  let cs = 1;
  const cam = ctx.stage?.camera;
  if (cam) {
    ctx.root.updateWorldMatrix(true, false);
    const cp = ctx.root.worldToLocal(cam.getWorldPosition(new THREE.Vector3()));
    cs = (cp.x - s.C.x) * side.x + (cp.z - s.C.z) * side.z >= 0 ? 1 : -1;
  }
  // the mount's +x is minus `side`
  const W = weapon(s, T.prop, { grip: [-cs * T.grip[0], T.grip[1], T.grip[2]], length: T.len, glow: T.glow, scale: T.scale });
  const back = T.back || 0;
  W.prop.position.y = -back;
  if (T.prop === 'sword') W.prop.rotation.y = Math.PI / 2;      // the flat of the blade and the guard face the camera
  if (T.magic) {
    // the queen's sword: bright steel, so it never reads as a dark needle
    const bright = s.fx.own(new THREE.MeshStandardMaterial({ color: '#f6eef4', metalness: 0.8, roughness: 0.35, emissive: '#222222' }));
    const [, , , blade, tip] = W.prop.children;
    if (blade && tip) { blade.material = bright; tip.material = bright; }
  }
  if (T.royal) {
    // the king's sword: a wide golden blade
    const gold = s.fx.own(new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 1, roughness: 0.22, emissive: '#5a3a00', emissiveIntensity: 0.35 }));
    const [, , , blade, tip] = W.prop.children;
    if (blade && tip) { blade.material = gold; tip.material = gold; blade.scale.x = 1.7; tip.scale.x *= 1.7; tip.scale.z *= 1.7; }
  }
  const R = (TIP[T.prop](T.len) - back) * T.scale;           // pivot to tip, in squares
  const wp = { th: T.rest, push: 0 };                          // the weapon's angle and how far it is pushed forward
  const fd = Math.max(T.fd, -touch(s) + 0.5);
  // pose the weapon; the tip never dips below the board
  const posWeapon = () => {
    const g = T.grip[1] + a.y;
    let th = wp.th;
    const lim = Math.acos(Math.max(-1, Math.min(1, (0.08 - g) / R)));
    th = Math.max(-lim, Math.min(lim, th));
    W.piv.rotation.x = th;
    W.piv.position.z = -(T.grip[2] + wp.push);
  };
  ctx.onFrame(posWeapon);
  posWeapon();
  // a point along the weapon (f = 0 the grip, 1 the tip) in the pieces' space
  const along = (f = 1) => {
    W.piv.updateWorldMatrix(true, true);
    const p = new THREE.Vector3(0, (TIP[T.prop](T.len) * f), 0);
    ctx.root.updateWorldMatrix(true, false);
    return ctx.root.worldToLocal(W.prop.localToWorld(p));
  };
  const pivot = () => { W.piv.updateWorldMatrix(true, false); ctx.root.updateWorldMatrix(true, false); return ctx.root.worldToLocal(W.piv.getWorldPosition(new THREE.Vector3())); };
  const normal = side.clone().multiplyScalar(-1);
  // a swoosh along the weapon's path that grows with the swing (set() each frame of the strike), brightest at the blade
  // and fading to the tail, then fades out (done(dur)). Only the part in front of the attacker, never under the board.
  const tall = T.royal || T.magic;                              // the queen and the king: a lower, smaller arc stays in frame
  const swoosh = (t0, t1, color, { width = 0.3, opacity = 0.85, solid = false, inset = 0 } = {}) => {
    const g = T.grip[1] + a.y;
    const lim = Math.acos(Math.max(-1, Math.min(1, (0.08 - g) / R)));
    const lo = Math.max(Math.min(t0, t1), -lim), hi = Math.max(lo + 0.05, Math.min(tall ? 0.15 : 0.45, Math.max(t0, t1)));
    const seg = low ? 14 : 28, len = hi - lo;
    const rad = R * (tall ? 0.8 : 0.88) - R * inset;
    const geo = s.fx.own(new THREE.RingGeometry(Math.max(0.05, rad - R * width), rad, seg, 1, 0, len));
    const n = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4));
    const mat = s.fx.own(new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity, blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    // like noAO (no ambient occlusion pass draws it), but keeping the part of the arc revealed so far
    let from = 0, count = Infinity;
    m.onBeforeRender = (r, sc, c, gg, mm) => { if (mm === mat) gg.setDrawRange(from, count); else gg.setDrawRange(0, 0); };
    const z = normal.clone(), x = UP.clone(), y = new THREE.Vector3().crossVectors(z, x);
    const q0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    s.fx.add(m);
    const col = geo.attributes.color;
    const set = () => {
      // the head follows the weapon: nothing shows until it passes hi, then the arc runs back from it to hi
      const head = Math.max(lo, wp.th);
      if (hi - head < 0.35) { count = 0; return; }             // no sliver: only once the swing has swept a real span
      const i0 = Math.max(0, Math.min(seg - 1, Math.floor(((head - lo) / len) * seg)));
      from = i0 * 6; count = (seg - i0) * 6;
      for (let v = 0; v < n; v++) {
        const ang = lo + ((v % (seg + 1)) / seg) * len;
        const f = Math.max(0, Math.min(1, (ang - head) / Math.max(0.05, hi - head)));
        const c = 1 - 0.9 * f;
        if (solid) col.setXYZW(v, 1, 1, 1, c); else col.setXYZW(v, c, c, c, 1);
      }
      col.needsUpdate = true;
      m.position.copy(pivot());
      m.quaternion.copy(q0); m.rotateZ(lo);
    };
    set();
    return {
      set,
      done: (dur) => s.tw(dur, (k) => { mat.opacity = opacity * (1 - k) * (1 - k); if (k >= 1) s.fx.remove(m); }),
    };
  };
  // a glow that stays on the weapon's tip while it lasts: a soft star (L.flare) put on the tip every 0.08 s, pulsing
  const tipGlow = (color, { size = 0.35, dur = 0.4 } = {}) => {
    let last = -1;
    const step = 0.08, big = size * 2.6;
    return s.tw(dur, (k, t) => {
      const i = Math.min(Math.floor((t * dur) / step), Math.ceil(dur / step) - 1);
      if (i === last || t >= 1) return;
      last = i;
      L.flare(along(1), { size: big * (i % 2 ? 0.8 : 1.05) * (0.6 + 0.4 * Math.min(1, t * 3)), dur: 0.16, color });
    });
  };

  // the victim's shield: on a group in front of the victim, facing the attacker
  const sh = new THREE.Group();
  const shield = s.fx.prop('shield');
  sh.add(shield);
  // its own colours: a blue face with a light gold rim, so it reads on every theme
  const face = shield.children[0];
  if (face?.isMesh) {
    face.material = s.fx.own(new THREE.MeshStandardMaterial({ color: '#2f5fa8', metalness: 0.35, roughness: 0.4 }));
    const rim = new THREE.Mesh(face.geometry, s.fx.own(new THREE.MeshBasicMaterial({ color: '#ffe7a0', toneMapped: false })));
    rim.scale.set(1.14, 1.12, 0.6); rim.position.set(0, 0, -0.012);
    shield.add(rim);
  }
  s.fx.add(sh);
  const shS = 0.8 + 0.35 * Math.min(1, s.hV / 1.6);
  let shK = 0.001, shFollow = true;
  const posShield = () => {
    if (!shFollow) return;
    const off = v.off - (s.rbV + 0.07);
    sh.position.set(s.C.x + aim.x * off + side.x * (v.lat + cs * 0.12), s.hV * 0.45 + v.y, s.C.z + aim.z * off + side.z * (v.lat + cs * 0.12));
    sh.rotation.set(0, 0, 0);
    sh.rotateY(yawOf(aim) - cs * 0.9);           // half turned to the camera so it reads as a shield
    sh.rotateX(-v.tip * 0.8);
    sh.scale.setScalar(Math.max(0.001, shK * shS));
  };
  ctx.onFrame(posShield);
  posShield();

  // ------------------------------------------------------------ 1. the weapon appears, both square up
  s.sfx('swing', { volume: 0.5, pitch: 1.4 });
  const d0 = a.d;
  await s.tw(0.42, (k) => {
    const e = outBack(k);
    W.show(Math.min(1.15, e)); shK = Math.min(1.1, e);
    a.yaw = s.yawG * inOut(k); a.d = lerp(d0, -fd, inOut(k));
    a.y = 0.1 * bump(k);
  });
  W.show(1); shK = 1;
  if (!s.live()) return;

  // ------------------------------------------------------------ 2. the first strike, the victim dodges
  const D = -cs * 0.15;                                         // a small side step away from the camera
  const back1 = Math.max(0.4, Math.min(0.75, 0.3 + 0.35 * (R - 0.8) + 0.15));   // longer weapons: the victim jumps further back
  const dodge = (dur) => s.tw(dur, (k) => {
    v.off = back1 * outQuad(k); v.lat = D * outQuad(k); v.tip = -0.4 * outQuad(k); v.y = 0.42 * bump(k * 0.75);
  });
  if (T.thrust) {
    // the pawn: draws the lance back, then thrusts
    await s.tw(0.3, (k) => { wp.push = -0.28 * k; a.tip = -0.12 * k; a.sy = 1 - 0.1 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); }, inOut);
    s.sfx('whoosh', { volume: 0.6, pitch: 1.5 });
    const from = along(1);
    dodge(0.26);
    await s.tw(0.06, () => {});
    await s.tw(0.2, (k) => { wp.push = lerp(-0.28, 0.55, k); a.d = -fd + 0.25 * k; a.tip = lerp(-0.12, 0.18, k); a.sy = lerp(0.9, 1.08, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); }, inQuad);
    { const to = along(1); beam(s.fx, from.lerp(to, 0.35), to, { dur: 0.22, radius: 0.07, color: T.trail }); }
  } else {
    await s.tw(T.heavy ? 0.38 : 0.3, (k) => {
      wp.th = lerp(T.rest, T.w1, k); a.tip = (T.rear ? -0.35 : -0.12) * k; a.y = (T.rear ? 0.12 : 0.04) * k;
      if (T.heavy) { a.sy = 1 - 0.08 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); }
    }, inOut);
    if (T.magic) tipGlow('#ff9ae6', { size: 0.2, dur: 0.35 });
    s.sfx(T.heavy ? 'whoosh' : 'swing', { pitch: T.heavy ? 0.8 : 1.1 });
    dodge(T.heavy ? 0.28 : 0.24);                              // starts a moment before the swing, ends with it
    await s.tw(0.06, () => {});
    const sw1 = swoosh(T.h1, T.w1, T.trail);
    await s.tw(T.heavy ? 0.22 : 0.18, (k) => {
      wp.th = lerp(T.w1, T.h1, k); sw1.set(); a.d = -fd + 0.22 * k; a.tip = lerp(T.rear ? -0.35 : -0.12, 0.2, k); a.y = (T.rear ? 0.12 : 0.04) * (1 - k);
      if (T.heavy) { a.sy = lerp(0.92, 1.05, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); }
    }, inQuad);
    sw1.done(0.22);
    if (T.heavy) {
      // the mace hits the board where the victim stood
      const p = along(1); p.y = 0.05;
      s.sfx('thud', { pitch: 0.9 });
      burst.dust(p); L.ring(p, { radius: 0.7, dur: 0.35 });
    }
    if (s.A.type === 'b') { tipGlow(T.glow, { size: 0.24, dur: 0.35 }); burst.sparks(along(1), { colors: ['#9be8ff', '#ffffff', '#d6f6ff'], count: low ? 6 : 14, gravity: 0.5, speed: [0.6, 2] }); }
    if (T.magic) burst.puff(along(1), { count: low ? 5 : 10, size: [0.025, 0.055], colors: MAGIC });
  }
  if (!s.live()) return;
  // both recover: the victim hops back to its square, the attacker brings the weapon up to guard
  const ad1 = a.d, at1 = a.tip, push1 = wp.push, th1 = wp.th, ay1 = a.y, sy1 = a.sy, lat1 = v.lat, vt1 = v.tip, vo1 = v.off;
  await s.tw(0.3, (k) => {
    wp.th = lerp(th1, T.guard, k); wp.push = lerp(push1, 0, k);
    a.d = lerp(ad1, -fd, k); a.tip = lerp(at1, 0, k); a.y = lerp(ay1, 0, k); a.sy = lerp(sy1, 1, k); a.sx = a.sz = 1 / Math.sqrt(a.sy);
    v.lat = lerp(lat1, 0, k); v.tip = lerp(vt1, 0, k); v.off = lerp(vo1, 0, k); v.y = 0.14 * bump(k);
  }, inOut);
  if (!s.live()) return;

  // ------------------------------------------------------------ 3. the counter: a shield bash, the attacker parries
  const lunge = Math.max(0.15, Math.min(0.6, fd - s.rbA - s.rbV - 0.38));
  // the victim gathers, the attacker lifts the weapon a little; then the bash, and the weapon sweeps down across it
  await s.tw(0.12, (k) => { v.off = 0.1 * k; v.tip = -0.12 * k; wp.th = lerp(T.guard, T.guard + 0.35, k); }, outQuad);
  s.sfx('whoosh', { volume: 0.5, pitch: 1.3 });
  await s.tw(0.18, (k) => { v.off = lerp(0.1, -lunge, k); v.tip = lerp(-0.12, 0.3, k); v.y = 0.08 * bump(k); wp.th = lerp(T.guard + 0.35, -0.9, inQuad(k)); }, inQuad);
  if (!s.live()) return;
  s.sfx('clang');
  const hit = along(0.6);
  burst.sparks(hit, { count: low ? 10 : 30 });
  L.glow(hit, { size: 0.35, dur: 0.22 });
  if (!low) burst.glints(hit, { count: 6 });
  // the parry knocks the shield away from the camera; it shrinks away within half a second
  shFollow = false;
  s.fx.launch(sh, { vel: aim.clone().multiplyScalar(0.8).addScaledVector(side, -cs * 2.6).add(new THREE.Vector3(0, 2.6, 0)), ang: new THREE.Vector3(7, 4, 10), bounce: 0.3 });
  s.tw(0.5, (k) => { sh.scale.setScalar(Math.max(0.001, (1 - k) * shS)); });
  // both recoil: the attacker rocks back, the victim is thrown back past its square and settles
  await s.tw(0.36, (k) => {
    const b = bump(k);
    a.tip = -0.2 * b; a.d = -fd - 0.14 * outQuad(k); wp.th = lerp(-0.9, T.guard, outQuad(k)) + 0.25 * b;
    v.off = lerp(-lunge, 0, outQuad(k)) + 0.2 * b; v.tip = lerp(0.3, 0, outQuad(k)) - 0.2 * b; v.y = 0.1 * b;
  });
  if (!s.live()) return;

  // ------------------------------------------------------------ 4. the finishing blow
  const fdF = -fd - 0.14;
  if (T.thrust) {
    // a big lunge with the lance, a golden streak
    await s.tw(0.4, (k) => { wp.push = -0.4 * k; wp.th = lerp(T.guard, -1.35, k); a.tip = -0.2 * k; a.sy = 1 - 0.18 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); a.d = fdF - 0.1 * k; }, inOut);
    tipGlow(T.fin, { size: 0.2, dur: 0.3 });
    s.sfx('whoosh', { pitch: 1.2 });
    const from = along(1);
    const t = touch(s);
    await s.tw(0.18, (k) => { wp.push = lerp(-0.4, 0.5, k); a.d = lerp(fdF - 0.1, t - 0.25, k); a.y = 0.12 * bump(k); a.tip = lerp(-0.2, 0.25, k); a.sy = lerp(0.82, 1.12, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); }, inQuad);
    if (!s.live()) return;
    { const to = along(1); beam(s.fx, from.lerp(to, 0.4), to, { dur: 0.25, radius: 0.07, color: T.fin }); }
    smash(ctx, s, { y: 0.5, push: 2.6 });
  } else {
    const wind = T.heavy ? 0.44 : 0.42;
    const spin = T.magic ? Math.PI * 2 : 0;
    if (T.magic) L.ring(new THREE.Vector3(s.A.group.position.x, 0, s.A.group.position.z), { radius: 0.9, dur: 0.5, color: '#ffd6f4' });
    if (T.royal) tipGlow('#ffe08a', { size: 0.24, dur: wind + 0.1 });
    if (s.A.type === 'b') tipGlow(T.glow, { size: 0.2, dur: wind + 0.1 });
    s.sfx(T.magic || s.A.type === 'b' ? 'magic' : 'swing', { pitch: T.heavy ? 0.7 : 0.9 });
    await s.tw(wind, (k) => {
      wp.th = lerp(T.guard, T.w2, k); a.d = lerp(fdF, fdF - 0.1, k);
      a.tip = (T.rear ? -0.5 : -0.22) * k; a.y = (T.rear ? 0.25 : T.magic ? 0.3 : 0.12) * k;
      a.yaw = s.yawG + spin * inOut(k);
      if (T.heavy) { a.sy = 1 - 0.14 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); }
    }, inOut);
    a.yaw = s.yawG;
    s.sfx(T.heavy ? 'whoosh' : 'swing', { pitch: T.heavy ? 0.7 : 1 });
    const dHit = Math.min(-(R * 0.75 + T.grip[2]), touch(s) - 0.1);
    const y2 = a.y, sy2 = a.sy;
    const glass = ctx.theme === 'glass';
    const sw2 = swoosh(T.h2, T.w2, glass ? GLASS_FIN[s.A.type] || T.fin : T.fin, { width: 0.34, opacity: 0.95, solid: glass });
    const sw3 = T.royal && !glass ? null : swoosh(T.h2, T.w2, '#ffffff', { width: 0.08, opacity: 0.9, solid: glass, inset: glass ? 0.04 : 0 });
    await s.tw(0.18, (k) => {
      wp.th = lerp(T.w2, T.h2, k); sw2.set(); sw3?.set(); a.d = lerp(fdF - 0.1, dHit, k); a.tip = lerp(T.rear ? -0.5 : -0.22, 0.28, k); a.y = lerp(y2, T.rear ? 0.05 : 0, k);
      a.sy = lerp(sy2, 1.06, k); a.sx = a.sz = 1 / Math.sqrt(a.sy);
    }, inQuad);
    if (!s.live()) return;
    sw2.done(0.45); sw3?.done(0.3);
    if (s.A.type === 'b') beam(s.fx, along(1), s.centre(0.55), { dur: 0.35, radius: 0.08, color: T.glow });
    smash(ctx, s, { y: T.heavy ? 0.6 : 0.55, push: T.heavy ? 3 : 2.2, lift: T.rear || T.heavy ? -0.6 : 0, ring: T.royal ? { radius: 2.6, dur: 0.7, color: '#ffe08a' } : undefined });
    if (T.magic) burst.puff(s.centre(0.6), { count: low ? 8 : 16, size: [0.03, 0.07], colors: MAGIC });
    if (T.royal) burst.glints(s.centre(0.6), { colors: ['#ffffff', '#ffe08a', '#ffcc33'] });
    if (T.heavy) s.sfx('thud', { pitch: 0.7 });
  }

  // ------------------------------------------------------------ 5. victory: the weapon goes up overhead with a twirl, a hop,
  // a glint on the tip, a short hold, then it is gone
  const ad3 = a.d, at3 = a.tip, th3 = wp.th, push3 = wp.push, sy3 = a.sy, y3 = a.y, ry3 = W.prop.rotation.y, py3 = W.piv.position.y;
  await s.tw(0.22, (k) => { wp.push = lerp(push3, 0, k); a.tip = lerp(at3, 0, k); a.sy = lerp(sy3, 1, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); a.y = lerp(y3, 0, k); }, outQuad);
  if (!s.live()) return;
  s.sfx('swing', { volume: 0.4, pitch: 1.5 });
  await s.tw(0.4, (k) => {
    wp.th = lerp(th3, tall ? -0.5 : 0, outBack(k));   // tall pieces raise it on a slant, so it stays in frame W.piv.position.y = py3 + (T.grip[1] > 0.8 ? 0 : 0.22) * outQuad(k); W.prop.rotation.y = ry3 + Math.PI * 2 * inOut(k);
    a.y = 0.2 * bump(k); a.d = lerp(ad3, ad3 - 0.08, k);
  });
  if (!s.live()) return;
  tipGlow('#fff3c0', { size: 0.15, dur: 0.4 });
  if (!low) burst.glints(along(1), { count: 6 });
  await s.tw(0.35, () => {});
  if (!s.live()) return;
  await s.tw(0.25, (k) => W.show(1 - inQuad(k)));
  if (!s.live()) return;
  await home(s, 0.45);
  await s.tw(0.05, () => {});
}

const base = { attacker: '*', cam: { dist: 6.6, pitch: 13 }, run };
// the queen and the king are tall and raise their swords high: a wider shot keeps them in frame
const wide = { ...base, cam: { dist: 7.6, pitch: 15 } };
export default { ...base, forType: (type) => (type === 'q' || type === 'k' ? wide : base) };
