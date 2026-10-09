// Pixelwelt fight variants of the bishop (CHE-371). See fights.js for the module shape. The bishop fights with magic from a
// distance like in pixel-gore, but never with today's straight bolt: (a) a storm cloud brews over the victim and a zigzag
// lightning strike hits from above, (b) a ring of glowing runes lifts the victim high into the air and slams it down,
// (c) a giant glowing fist of cubes assembles in the sky and squashes the victim flat. In every variant the bishop raises
// an arm with a glowing tip that links it to its magic. The white cleric's magic is gold and sky blue, the black bone
// archer's is violet and green.
import * as THREE from 'three';
import { DUST, SPARK } from './kit.js';

// the colours of one side
const LOOK = {
  w: { bolt: 0xffe040, glow: 0xfff0a0, core: 0xfffbe6, rune: 0xe8a818, glyph: 0xfff6c8, column: 0x2c2614,
    cloud: [0x5a6472, 0x4e5866, 0x667080], dark: 0x464f5c, lit: 0xdfe6ff, top: [0x9aa2ad, 0x8a929e, 0xa8b0ba],
    fist: [0xe0a92a, 0xffd75a, 0x6fc3ff], fistD: 0x9a6a10 },
  b: { bolt: 0xc080ff, glow: 0xd2a0ff, core: 0xf6eaff, rune: 0x5a1fb0, glyph: 0x8affc8, column: 0x22162e,
    cloud: [0x4a3868, 0x3e2e58, 0x564478], dark: 0x382a52, lit: 0xe6d6ff, top: [0x7a6a8c, 0x6a5a7c, 0x86789a],
    fist: [0xb9b5a2, 0xe8e4d2, 0x9b5cf0], fistD: 0x5a3a8a },
};
const SMOKE = [0x55555d, 0x6a6a73, 0x48484f];

// The attacker's arms and legs, set after the rig's own animation every frame. arm.p raises the casting arm (the one nearer
// to the camera, so the glowing hand is never hidden behind the body), arm.n the other one, both sideways on rotation.z,
// which the rig leaves alone (0 hangs, about 1.5 is straight out, 2.6 is up beside the head). The legs keep a third of the
// rig's walk swing, so a quick step does not end in the splits. tip() is the hand of the casting arm.
function caster(K) {
  const A = K.s.A, legs = [K.part(A, 'legN'), K.part(A, 'legP')];
  let main = K.part(A, 'armP'), other = K.part(A, 'armN'), sMain = 1, sOther = -1;
  const cam = K.ctx.stage?.camera;
  if (cam && main && other) {
    K.ctx.root.updateWorldMatrix(true, true);
    const c = cam.getWorldPosition(new THREE.Vector3());
    if (other.getWorldPosition(new THREE.Vector3()).distanceTo(c) < main.getWorldPosition(new THREE.Vector3()).distanceTo(c)) { [main, other] = [other, main]; sMain = -1; sOther = 1; }
  }
  const arm = { n: 0, p: 0 };
  K.ctx.onFrame(() => {
    if (main) main.rotation.z = sMain * arm.p;
    if (other) other.rotation.z = sOther * arm.n;
    for (const l of legs) if (l) l.rotation.x *= 0.3;
  });
  const _p = new THREE.Vector3();
  arm.tip = () => {
    if (!main) return K.P(A.group.position.x, K.ah + 0.25, A.group.position.z);
    K.ctx.root.updateWorldMatrix(true, true);
    return K.ctx.root.worldToLocal(main.localToWorld(_p.set(0, -0.56, 0)));
  };
  return arm;
}
// a small sparkle that floats just above the raised hand while on (a bright cube in a thin glow), clear of the face
function orb(K, arm, look) {
  const g = new THREE.Group();
  g.add(K.box(0.075, 0.075, 0.075, look.core));
  g.add(K.box(0.12, 0.12, 0.12, look.glow, 0, 0, 0, { add: true }));
  g.scale.setScalar(0.001); K.fx.add(g);
  const o = { k: 0, at: () => g.position.clone() };
  K.ctx.onFrame(() => { const t = K.ctx.time(); g.position.copy(arm.tip()); g.position.y += 0.2; g.rotation.set(t * 3, t * 4, 0); g.scale.setScalar(Math.max(0.001, o.k * (1 + 0.15 * Math.sin(t * 30)))); });
  return o;
}
// the walk in to the casting distance, slow enough for a calm walk
const approach = (K, d = -1.55) => {
  const from = K.a.d, dur = Math.min(0.6, Math.max(0.25, Math.abs(d - from) / 2.4));
  return K.tw(dur, (k) => { K.a.d = K.lerp(from, d, k); K.a.yaw = K.s.yawG * k; }, K.inOut);
};
// the side of the fight the camera looks from (the director views across the aim): +1 along K.side, else -1
function camSign(K) {
  const cam = K.ctx.stage?.camera;
  if (!cam) return 1;
  K.ctx.root.updateWorldMatrix(true, false);
  const p = K.ctx.root.worldToLocal(cam.getWorldPosition(new THREE.Vector3()));
  return (p.x - K.C.x) * K.side.x + (p.z - K.C.z) * K.side.z >= 0 ? 1 : -1;
}
// a lit box between two points (sized w x len x w along the segment)
function segment(K, from, to, w, color, o) {
  const m = K.box(1, 1, 1, color, 0, 0, 0, o);
  const d = new THREE.Vector3().subVectors(to, from), len = Math.max(0.001, d.length());
  m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(K.up, d.normalize());
  m.scale.set(w, len, w); m.frustumCulled = false; K.fx.add(m);
  return m;
}

// cubes that slide out along the board in a ring from the centre and shrink away (an impact's dust ring)
function groundRing(K, count, radius, colors, dur = 0.45) {
  const cubes = [];
  for (let i = 0, c = K.n(count); i < c; i++) {
    const sz = 0.07 + K.rnd() * 0.06, m = K.box(sz, sz, sz, colors[i % colors.length]); K.fx.add(m);
    cubes.push({ m, sz, a: (i / c) * K.TAU + K.rnd() * 0.25, r: radius * (0.8 + K.rnd() * 0.35), y: 0.03 + K.rnd() * 0.06 });
  }
  return K.tw(dur, (k) => {
    const e = K.outQuad(k);
    for (const q of cubes) { q.m.position.set(K.C.x + Math.cos(q.a) * (0.2 + q.r * e), q.y + 0.12 * Math.sin(Math.PI * k), K.C.z + Math.sin(q.a) * (0.2 + q.r * e)); q.m.scale.setScalar(Math.max(0.001, q.sz * (1 - k * k))); }
  });
}
// a short glowing ring of small cubes on the square that widens and goes out
function glowRing(K, color, dur = 0.3) {
  const cubes = [];
  for (let i = 0, c = 16; i < c; i++) { const m = K.box(0.08, 0.04, 0.08, color, 0, 0.03, 0, { add: true }); K.fx.add(m); cubes.push(m); }
  return K.tw(dur, (k) => cubes.forEach((m, i) => { const a = (i / cubes.length) * K.TAU, r = 0.3 + 0.3 * K.outQuad(k); m.position.set(K.C.x + Math.cos(a) * r, 0.03, K.C.z + Math.sin(a) * r); m.visible = k < 1; m.scale.set(0.08 * (1 - k) + 0.001, 0.04, 0.08 * (1 - k) + 0.001); }));
}
// 3 x 3 pixel rune shapes (x is a pixel)
const RUNES = [['x.x', '.x.', '.x.'], ['xx.', '.x.', '.xx'], ['.x.', 'x.x', '.x.'], ['x..', 'xx.', 'x..'], ['.xx', '.x.', 'xx.']];

export default [
  // a: the bishop raises its arm, a spark flies up from the glowing hand and a dark storm cloud brews over the victim. The
  // cloud darkens and flickers, two sparks drip down, a beat of silence, then a thick zigzag lightning strike hits the head.
  // The victim is charred dark, smokes, shakes and topples; the cloud shrinks away upwards.
  {
    id: 'bishop-a', attacker: 'b', still: 1.98, noTurn: true, cam: { dist: 8.6, pitch: 15, yaw: 0 },
    de: 'Gewitter: der Bischof ruft eine Donnerwolke über den Gegner, ein Zickzack Blitz schlägt ein, der Gegner ist verkohlt, qualmt und kippt um',
    async run(ctx, K) {
      const { P, C, aim, side, hV, v, sfx, fx, tw, lerp, inOut, outQuad, outBack, inQuad, rnd, box, flash, sparks, n } = K;
      const look = LOOK[ctx.attackerColor] || LOOK.w;
      const arm = caster(K), glow = orb(K, arm, look);
      const yb = Math.min(2.4, hV + 1.0);                     // the cloud's base
      const at = (x, y, z) => P(C.x + aim.x * x + side.x * z, y, C.z + aim.z * x + side.z * z);   // x across the screen, z in depth

      // the cloud: a dark storm layer below, a lighter layer on top, about two squares wide, each cube grows in on its own beat
      const lumps = [];
      const lump = (c, sz, x, y, z, low) => { const m = box(sz, sz * 0.8, sz, c); m.scale.setScalar(0.001); fx.add(m); lumps.push({ m, sz, x, y, z, low, at: rnd() * 0.45, ph: rnd() * K.TAU }); };
      for (let i = 0, c = n(13); i < c; i++) lump(look.cloud[i % 3], 0.34 + rnd() * 0.16 + i * 0.002, (i / (c - 1) - 0.5) * 1.75 + (rnd() - 0.5) * 0.12, yb + 0.2 + (rnd() - 0.5) * 0.26, (rnd() - 0.5) * 0.7, true);
      for (let i = 0, c = n(9); i < c; i++) lump(look.top[i % 3], 0.3 + rnd() * 0.12 + i * 0.002, (i / (c - 1) - 0.5) * 1.2 + (rnd() - 0.5) * 0.1, yb + 0.5 + (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.45, false);
      let cloudK = 0, rumble = 0, lift = 0;
      ctx.onFrame(() => {
        const t = ctx.time();
        for (const L of lumps) {
          const g = Math.max(0, Math.min(1, (cloudK - L.at) / 0.55)), s = Math.max(0.001, L.sz * (g < 1 ? outBack(g) : 1) * (1 - lift) * (1 - lift));
          L.m.visible = lift < 0.98;
          const p = at(L.x * (0.55 + 0.45 * g), L.y + lift * 0.5 + Math.sin(t * 2.6 + L.ph) * 0.025 + Math.sin(t * 43 + L.ph) * 0.015 * rumble, L.z);
          L.m.position.copy(p); L.m.scale.set(s, s * 0.8, s);
        }
      });

      // 1. walk in, raise the arm with a glowing hand, a spark flies up to where the cloud will be
      await Promise.all([approach(K), tw(0.45, (k) => { arm.p = lerp(0, 2.8, inOut(k)); arm.n = 0.35 * k; glow.k = outQuad(k); })]);
      if (!K.live()) return;
      sfx.magic?.();
      const spark = box(0.15, 0.15, 0.15, look.glow, 0, 0, 0, { add: true }); fx.add(spark);
      const h0 = glow.at(), sky = at(0, yb + 0.25, 0);
      await tw(0.3, (k) => { const p = h0.clone().lerp(sky, k); p.y += Math.sin(Math.PI * k) * 0.5; spark.position.copy(p); spark.rotation.set(k * 9, k * 7, 0); }, inQuad);
      spark.visible = false;
      if (!K.live()) return;
      sparks(sky, 8, [look.glow, look.core]);

      // 2. the cloud brews; the victim looks up and trembles
      sfx.whoosh?.();
      await tw(0.5, (k) => { cloudK = k * 1.45; rumble = 0.6 * k; v.tip = -0.1 * outQuad(k); v.lat = Math.sin(k * 60) * 0.012 * k; });
      if (!K.live()) return;

      // 3. anticipation: the storm layer darkens, two flickers inside, two sparks drip down, then a beat of silence
      const under = (c) => { for (const L of lumps) if (L.low) L.m.material = K.mat(c); };
      under(look.dark);
      rumble = 1;
      const drip = [box(0.07, 0.07, 0.07, look.glow, 0, 0, 0, { add: true }), box(0.06, 0.06, 0.06, look.core)];
      for (const d of drip) fx.add(d);
      await tw(0.38, (k) => {
        drip.forEach((d, i) => { const u = Math.max(0, Math.min(1, k * 1.5 - i * 0.4)); d.position.copy(at(0.18 - i * 0.3, lerp(yb, hV + 0.15, inQuad(u)), 0.05)); d.visible = u > 0 && u < 1; });
        v.lat = Math.sin(k * 70) * 0.015;
        under((k > 0.18 && k < 0.27) || (k > 0.6 && k < 0.68) ? look.lit : look.dark);
      });
      under(look.dark);
      v.lat = 0;
      await tw(0.14, () => {});
      if (!K.live()) return;

      // 4. the strike: five kinked thick segments with a bright core and a pale glow edge, held for a long beat
      sfx.crack?.();
      const top = at(0, yb + 0.2, 0), bot = P(C.x, hV * 0.98, C.z), pts = [top];
      for (let i = 1; i < 5; i++) { const p = top.clone().lerp(bot, i / 5), o = (i % 2 ? 1 : -1) * (0.11 + rnd() * 0.06); pts.push(p.add(at(o, 0, (rnd() - 0.5) * 0.12).sub(P(C.x, 0, C.z)))); }
      pts.push(bot);
      const bolt = [];
      for (let i = 0; i < pts.length - 1; i++) {
        bolt.push(segment(K, pts[i], pts[i + 1], 0.12, 0xffffff));
        bolt.push(segment(K, pts[i], pts[i + 1], 0.28, look.bolt, { add: true }));
        if (i) { const j = box(0.15, 0.15, 0.15, 0xffffff, pts[i].x, pts[i].y, pts[i].z); fx.add(j); bolt.push(j); }
      }
      sparks(bot, 14, [look.glow, look.core, 0xffffff]);
      rumble = 1.6;
      // the victim is charred: a dark copy (shared geometry, own flat material) stands in for it until it is gone
      // (a copy of each material, its colour halved, so the face and the trim stay readable), with glowing embers on it
      const V = K.s.V.group, char = new THREE.Group(), inv = new THREE.Matrix4(), tints = new Map();
      const tint = (m0) => { if (!tints.has(m0)) { const m = fx.own(m0.clone()); m.color?.multiplyScalar(0.3); tints.set(m0, m); } return tints.get(m0); };
      V.updateWorldMatrix(true, true); inv.copy(V.matrixWorld).invert();
      (V.getObjectByName('rig') || V).traverse((o) => { if (o.isMesh && o.visible) { const m = new THREE.Mesh(o.geometry, Array.isArray(o.material) ? o.material.map(tint) : tint(o.material)); m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(inv, o.matrixWorld); char.add(m); } });
      const embers = [], face = camSign(K);
      for (let i = 0, c = n(5); i < c; i++) {
        const u = (rnd() - 0.5) * 1.6, r = 0.23 + rnd() * 0.04;
        const e = box(0.07, 0.07, 0.07, i % 2 ? 0xffa030 : 0xff6a1a); char.add(e); embers.push(e);
        // in the victim's own frame: spread over the side that faces the camera
        e.userData.p = new THREE.Vector3(Math.sin(u) * r, hV * (0.25 + 0.65 * rnd()), Math.cos(u) * r);
      }
      char.visible = false; fx.add(char);
      ctx.onFrame(() => {
        const t = ctx.time(), q = V.quaternion.clone().invert(), toCam = new THREE.Vector3(side.x * face, 0, side.z * face).applyQuaternion(q);
        const yaw = Math.atan2(toCam.x, toCam.z);
        embers.forEach((e, i) => { e.position.copy(e.userData.p).applyAxisAngle(K.up, yaw); e.scale.setScalar(0.1 * (0.75 + 0.25 * Math.sin(t * 25 + i * 2))); });
      });
      let charOn = true;
      ctx.onFrame(() => { const on = charOn && v.on; char.visible = on; if (on) { char.position.copy(V.position); char.quaternion.copy(V.quaternion); char.scale.copy(V.scale); V.visible = false; } });
      // smoke: dark cubes rise and grow off the victim for about a second
      const smoke = [];
      for (let i = 0, c = n(20); i < c; i++) {
        const m = box(1, 1, 1, SMOKE[i % 3]); m.scale.setScalar(0.001); fx.add(m);
        smoke.push({ m, x: (rnd() - 0.5) * 0.3, z: (rnd() - 0.5) * 0.3, y: hV * (0.6 + rnd() * 0.35), t0: rnd() * 0.6, sp: 0.8 + rnd() * 0.5, sz: 0.2 + rnd() * 0.14, life: 0.6 + rnd() * 0.3 });
      }
      const fume = tw(1.4, (k, t) => {
        const tt = t * 1.4;
        for (const S of smoke) {
          const u = (tt - S.t0) / S.life, s = u <= 0 || u >= 1 ? 0.001 : S.sz * (0.35 + 0.65 * u) * (u > 0.7 ? (1 - u) / 0.3 : 1);
          S.m.position.copy(at(S.x, S.y + Math.max(0, u) * S.sp, S.z)); S.m.scale.setScalar(Math.max(0.001, s));
        }
      });
      await tw(0.25, (k, t) => { v.sy = 1 + 0.1 * Math.sin(t * 45); v.lat = Math.sin(t * 80) * 0.035; });
      if (!K.live()) return;
      // the bolt flickers twice and goes out
      await tw(0.22, (k, t) => { const on = (t > 0.25 && t < 0.5) || (t > 0.7 && t < 0.88); for (const m of bolt) m.visible = on; v.lat = Math.sin(t * 80) * 0.03; });
      for (const m of bolt) m.visible = false;
      await tw(0.12, (k, t) => { v.sy = 1 + 0.08 * Math.sin(t * 40) * (1 - k); v.lat = Math.sin(t * 70) * 0.03 * (1 - k); });
      if (!K.live()) return;
      v.lat = 0; v.sy = 1; v.tip = 0;

      // 5. the victim goes down, the cloud shrinks away upwards, the bishop walks back
      K.finale(K.centre(0.6), { dir: K.up, flashSize: 0 });
      await tw(0.55, (k) => { lift = inQuad(k); rumble = 1.6 * (1 - k); arm.p = lerp(2.8, 0, inOut(k)); arm.n = 0.35 * (1 - k); glow.k = 1 - k; });
      if (!K.live()) return;
      await Promise.all([K.kill.fall, fume, K.back(K.a.d)]);
      charOn = false;
      if (!K.live()) return;
      await K.kill.done();
    },
  },

  // b: the bishop raises its arm, a trail of tiny runes flows from its glowing hand and a ring of glowing rune cubes forms at
  // the victim's waist. The ring spins faster and lifts the victim high into the air under a faint light column, it hangs
  // turning for a beat, then crashes down; dust and cubes splash in a ring and the runes burst away.
  {
    id: 'bishop-b', attacker: 'b', still: 1.93, noTurn: true, cam: { dist: 8.8, pitch: 15, yaw: 0 },
    de: 'Runenring: leuchtende Runen kreisen um den Gegner, heben ihn hoch in die Luft und knallen ihn auf den Boden',
    async run(ctx, K) {
      const { P, C, hV, vw, v, sfx, fx, tw, lerp, inOut, outQuad, outBack, rnd, box, flash, sparks, dust, splash, n, TAU } = K;
      const look = LOOK[ctx.attackerColor] || LOOK.w;
      const arm = caster(K), glow = orb(K, arm, look);
      const lift = Math.min(1.45, 2.8 - hV), R = 0.7, face = camSign(K);                 // the lift height, the ring radius (clear of every victim)

      // a rune: a saturated cube with a bright pixel glyph standing out of its outer and inner faces
      const count = K.lite ? 6 : 7, runes = [], glyphs = [];
      for (let i = 0; i < count; i++) {
        const g = new THREE.Group(), shape = RUNES[i % RUNES.length];
        g.add(box(0.2, 0.2, 0.2, look.rune));
        for (const z of [0.108, -0.108]) shape.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'x') { const px = box(0.046, 0.046, 0.024, look.glyph, (c - 1) * 0.052, (1 - r) * 0.052, z); g.add(px); glyphs.push(px); } }));
        g.scale.setScalar(0.001); fx.add(g);
        runes.push({ g, at: i / count, s: 0, out: 0 });
      }
      const pulse = (on) => { for (const px of glyphs) px.material = K.mat(on ? 0xffffff : look.glyph); };
      const ring = { y: hV * 0.45, ang: 0, w: 1.5, r: R };
      let last = ctx.time();
      ctx.onFrame(() => {
        const t = ctx.time(); ring.ang += ring.w * Math.max(0, t - last); last = t;
        for (const Q of runes) {
          const u = ring.ang + Q.at * TAU, r = ring.r + Q.out;
          // the ring tilts its near side down, so it faces the camera instead of showing its edge
          const toward = (Math.cos(u) * K.side.x + Math.sin(u) * K.side.z) * face;
          Q.g.position.set(C.x + Math.cos(u) * r, ring.y + Math.sin(u * 2) * 0.04 - 0.3 * toward * r + Q.out * 0.3, C.z + Math.sin(u) * r);
          Q.g.rotation.set(0, Math.PI / 2 - u, 0);
          Q.g.scale.setScalar(Math.max(0.001, Q.s));
        }
      });
      // the trail from the hand to the ring: tiny glowing cubes that stream along a curve
      const trail = [];
      for (let i = 0, c = n(9); i < c; i++) { const m = box(0.05, 0.05, 0.05, i % 2 ? look.glow : look.glyph, 0, 0, 0, { add: true }); m.visible = false; fx.add(m); trail.push(m); }
      let trailOn = false;
      ctx.onFrame(() => {
        const t = ctx.time(), h = glow.at(), to = P(C.x, ring.y, C.z).addScaledVector(h.clone().sub(P(C.x, ring.y, C.z)).setY(0).normalize(), R);
        trail.forEach((m, i) => { const u = (t * 1.8 + i / trail.length) % 1; m.visible = trailOn; m.position.copy(h).lerp(to, u); m.position.y += Math.sin(Math.PI * u) * 0.35; });
      });

      // 1. walk in, raise the arm, the trail flows and the runes pop in one by one at the waist
      await Promise.all([approach(K), tw(0.45, (k) => { arm.p = lerp(0, 2.3, inOut(k)); arm.n = 0.3 * k; glow.k = outQuad(k); })]);
      if (!K.live()) return;
      sfx.magic?.();
      trailOn = true;
      await tw(0.5, (k) => {
        for (const Q of runes) { const g = Math.max(0, Math.min(1, (k - Q.at * 0.6) / 0.4)); Q.s = g < 1 ? outBack(g) : 1; }
        ring.w = lerp(1.5, 5, k); v.lat = Math.sin(k * 50) * 0.02 * k;
      });
      if (!K.live()) return;

      // 2. the ring spins fast and climbs: the victim is lifted, turning, the arm goes up high
      sfx.whoosh?.();
      await tw(0.75, (k) => {
        const e = inOut(k);
        ring.w = lerp(5, 13, k); v.y = lift * e; ring.y = v.y + hV * 0.45;
        v.spin = TAU * inOut(k); v.lat = 0; v.tip = Math.sin(k * 9) * 0.05 * k;
        arm.p = lerp(2.3, 2.85, e);
      });
      if (!K.live()) return;
      trailOn = false;
      // a beat at the top: the victim hangs and turns slowly, the runes sparkle
      // a beat at the top: the ring tightens, the runes pulse brighter, the victim turns slowly
      sparks(P(C.x, lift + hV * 0.5, C.z), 10, [look.glow, look.glyph, look.rune]);
      await tw(0.32, (k, t) => {
        v.spin = TAU + 0.5 * t; v.lat = Math.sin(t * 50) * 0.02; ring.w = 15; ring.r = lerp(R, 0.6, outQuad(k));
        pulse(Math.sin(t * 28) > 0); for (const Q of runes) Q.s = 1 + 0.2 * k;
      });
      pulse(true);
      if (!K.live()) return;

      // 3. the slam: the arm throws down, the victim crashes down with the ring, fastest in the last third
      sfx.whoosh?.();
      await tw(0.24, (k) => { v.y = lift * (1 - k * k * k); ring.y = v.y + hV * 0.45; v.lat = 0; v.tip = 0; arm.p = lerp(2.85, 0.4, k); });
      if (!K.live()) return;
      v.y = 0;
      sfx.thud?.();
      // the impact: the victim squashes for two frames, a dust ring runs out about a square, a glowing ring flares on the square
      const ground = P(C.x, 0.06, C.z);
      groundRing(K, 22, 1.0, DUST);
      glowRing(K, look.glow);
      splash(ground, 8, 1.3, [look.glow, look.glyph, ...SPARK]);
      splash(ground, 12, 1.2, DUST);
      K.bleed(P(C.x, 0.1, C.z), { count: 14, dir: K.up, spread: 1.1, speed: [2, 3.8], size: [0.06, 0.11], life: [0.6, 1.0], colors: [0x8a8478, 0x5e5a52, 0xb8a888] });
      dust(ground, 10);
      v.sy = 0.6; v.sx = v.sz = 1.25;
      await tw(0.07, () => {});
      v.sy = 1; v.sx = v.sz = 1;
      if (!K.live()) return;
      K.finale(K.centre(0.35), { dir: K.up, flashSize: 0 });
      // the runes burst outwards and are gone within 0.4 s
      const burst = tw(0.38, (k) => { for (const Q of runes) { Q.out = 1.4 * outQuad(k); Q.s = 1 - k; } ring.y = lerp(hV * 0.45, 0.25, k); });
      await Promise.all([burst, tw(0.4, (k) => { arm.p = 0.4 * (1 - k); arm.n = 0.3 * (1 - k); glow.k = 1 - k; })]);
      if (!K.live()) return;
      await Promise.all([K.kill.fall, K.back(K.a.d)]);
      if (!K.live()) return;
      await K.kill.done();
    },
  },

  // c: the bishop raises both arms and cubes stream from its glowing hand into the air, where they snap together into a
  // giant fist straight over the victim. The fist rises and pulls back for a beat, then smashes down: the tile cracks, dust
  // rings out and the victim is pressed into a pancake. The fist rests a beat and crumbles into its cubes; the pancake stays
  // until the bishop is back.
  {
    id: 'bishop-c', attacker: 'b', still: 1.55, noTurn: true, cam: { dist: 9.6, pitch: 13, yaw: 0 },
    de: 'Riesenfaust: aus leuchtenden Würfeln baut der Bischof eine riesige Faust in der Luft, die saust herab und macht den Gegner platt',
    async run(ctx, K) {
      const { P, C, aim, side, hV, v, sfx, fx, tw, lerp, inOut, outQuad, outBack, inQuad, rnd, box, sparks, dust, splash } = K;
      const look = LOOK[ctx.attackerColor] || LOOK.w;
      const arm = caster(K), glow = orb(K, arm, look);
      const [c0, c1, c2] = look.fist;

      // the fist: knuckles down, fingers towards +z; every box has its own sizes on each axis (no shared face planes)
      const parts = [
        [0.72, 0.56, 0.46, c0, 0, 0.47, 0], [0.62, 0.26, 0.52, c2, 0, 0.84, 0],
        [0.15, 0.27, 0.43, c1, -0.27, 0.1, 0.07], [0.15, 0.29, 0.43, c1, -0.09, 0.09, 0.07], [0.15, 0.29, 0.43, c1, 0.09, 0.09, 0.07], [0.15, 0.27, 0.43, c1, 0.27, 0.1, 0.07],
        [0.19, 0.33, 0.21, c1, 0.43, 0.32, 0.13], [0.09, 0.05, 0.05, look.fistD, -0.27, 0.03, 0.285], [0.09, 0.05, 0.05, look.fistD, -0.09, 0.02, 0.285],
        [0.09, 0.05, 0.05, look.fistD, 0.09, 0.02, 0.285], [0.09, 0.05, 0.05, look.fistD, 0.27, 0.03, 0.285], [0.66, 0.06, 0.56, look.fistD, 0, 0.73, 0],
      ];
      const fist = new THREE.Group(), pieces = [];
      for (const p of parts) { const m = box(...p); fist.add(m); pieces.push({ m, home: m.position.clone(), at: rnd() * 0.5 }); }
      fx.add(fist);
      const S = 1.85, base = hV + 0.25;   // the fist's size and the height of its knuckles
      fist.scale.setScalar(S);
      const face = camSign(K), back = new THREE.Vector3(-aim.x, 0, -aim.z);
      const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(side.x * face, 0, side.z * face));
      const tilt = new THREE.Quaternion(), axis = new THREE.Vector3(side.x, 0, side.z);
      // y: height of the knuckles; pull: how far it leans back towards the bishop (radians)
      const placeFist = (y, pull = 0) => { fist.position.set(C.x, y, C.z).addScaledVector(back, pull * 0.6); tilt.setFromAxisAngle(axis, pull * (aim.x * side.z - aim.z * side.x >= 0 ? 1 : -1)); fist.quaternion.copy(tilt).multiply(turn); };
      placeFist(base);
      for (const q of pieces) q.m.visible = false;

      // 1. walk in, raise both arms with a glowing hand
      await Promise.all([approach(K, -1.65), tw(0.45, (k) => { arm.p = lerp(0, 2.8, inOut(k)); arm.n = lerp(0, 2.4, inOut(k)); glow.k = outQuad(k); })]);
      if (!K.live()) return;
      sfx.magic?.();
      // 2. the cubes stream from the hand and snap into the fist, one by one
      fist.updateWorldMatrix(true, false);
      const h0 = fist.worldToLocal(K.ctx.root.localToWorld(glow.at()));
      await tw(0.6, (k) => {
        for (const q of pieces) {
          const u = Math.max(0, Math.min(1, (k - q.at) / 0.5));
          q.m.visible = u > 0;
          q.m.position.copy(h0).lerp(q.home, outBack(u));
          q.m.position.y += Math.sin(Math.PI * u) * 0.15;
        }
        v.tip = -0.1 * outQuad(k);
      });
      for (const q of pieces) q.m.position.copy(q.home);
      if (!K.live()) return;
      sparks(P(C.x, base + 0.5 * S, C.z), 10, [look.glow, look.core]);
      // 3. wind up: the fist rises a little and pulls back for a beat, trembling; the victim shivers
      await tw(0.38, (k, t) => {
        const e = outQuad(k);
        placeFist(base + 0.1 * e + Math.sin(t * 60) * 0.015 * k, 0.3 * e);
        v.lat = Math.sin(t * 70) * 0.02 * k;
      });
      if (!K.live()) return;
      // 4. smash: arms throw down, the fist drops onto the victim
      sfx.whoosh?.();
      await tw(0.13, (k) => { placeFist(lerp(base + 0.1, hV, k), 0.3 * (1 - k)); arm.p = lerp(2.8, 0.6, k); arm.n = lerp(2.4, 0.5, k); v.lat = 0; v.tip = 0; }, inQuad);
      if (!K.live()) return;
      sfx.thud?.();
      // the hit: blood (no kit fall), a crack on the tile, a dust ring, and the victim pressed into a wide pancake
      K.finale(K.centre(0.4), { dir: K.up, fall: false, flashSize: 0 });
      const ground = P(C.x, 0.06, C.z);
      groundRing(K, 20, 1.0, DUST);
      splash(ground, 8, 1.5, [look.glow, c0, ...SPARK]);
      dust(ground, 8);
      sparks(P(C.x - aim.x * 0.5, 0.15, C.z - aim.z * 0.5), 8);
      const cracks = [];
      for (let i = 0; i < 6; i++) {
        let a = (i / 6) * K.TAU + rnd() * 0.5, r = 0.12;
        for (let j = 0; j < 3; j++) {
          // a dark sliver on the tile; neighbours in a crack sit at different heights (no shared planes where they meet)
          const len = 0.16 + rnd() * 0.1, mid = r + len / 2;
          const m = box(len, 0.006, 0.035 - j * 0.006, 0x2a241c, C.x + Math.cos(a) * mid, 0.011 + (j % 2) * 0.005, C.z + Math.sin(a) * mid);
          m.rotation.y = -a; fx.add(m);
          cracks.push(m); r += len; a += (rnd() - 0.5) * 0.7;
        }
      }
      await tw(0.1, (k) => { placeFist(lerp(hV, hV * 0.15 + 0.01, k)); v.sy = 1 - 0.85 * k; v.sx = v.sz = 1 + 0.7 * k; });
      if (!K.live()) return;
      // 5. the fist rests a beat, then crumbles into its cubes, which fall and fade
      await tw(0.3, (k, t) => placeFist(hV * 0.15 + 0.01 + Math.sin(t * 40) * 0.015 * (1 - k)));
      if (!K.live()) return;
      fist.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(K.ctx.root.matrixWorld).invert(), mm = new THREE.Matrix4();
      for (const q of pieces) {
        mm.multiplyMatrices(inv, q.m.matrixWorld); mm.decompose(q.m.position, q.m.quaternion, q.m.scale);
        fx.add(q.m);
        const out = new THREE.Vector3(q.m.position.x - C.x, 0, q.m.position.z - C.z).normalize();
        fx.body(q.m, { radius: 0.08 * S, vel: out.multiplyScalar(0.6 + rnd() * 0.8).setY(0.6 + rnd() * 1.2), ang: new THREE.Vector3(rnd() * 6 - 3, rnd() * 6 - 3, rnd() * 6 - 3), gravity: -11, bounce: 0.2, drag: 0.5, life: 0.35 + rnd() * 0.25, fade: 0.3 });
      }
      fist.visible = false;
      await tw(0.4, (k) => { arm.p = 0.6 * (1 - k); arm.n = 0.5 * (1 - k); glow.k = 1 - k; });
      if (!K.live()) return;
      // 6. the bishop walks back; the pancake and the crack stay until then, then the pancake goes out in a puff
      await K.back(K.a.d);
      if (!K.live()) return;
      K.vanish();
      await tw(0.25, (k) => { for (const m of cracks) m.scale.y = Math.max(0.001, 0.006 * (1 - k)); for (const m of cracks) m.visible = k < 1; });
      await K.kill.done();
    },
  },
];
