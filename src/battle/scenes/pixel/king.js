// Pixelwelt fight variants of the king (CHE-371). See fights.js for the module shape. Today's king (pixel-gore.js) jumps and
// smashes a mace down; these three keep the pixel gore look but give the king royal moves instead: a whirlwind with a giant
// great sword that leaves a ring of cubes and flings the victim away, a royal command that drops a giant crown from the sky
// onto the victim, and a throne that grows under the king, from which he belly flops onto the victim like on a trampoline.
import * as THREE from 'three';
import { SPARK, GOLD, STEEL, STEEL2, WOOD, BONE, DUST } from './kit.js';

const SHADOW = 0x23232c;
const LOOK = {
  w: { blade: STEEL, fuller: STEEL2, guard: GOLD, grip: WOOD, gem: 0x3a7bff, trail: [0xfff2b0, 0xffd76a, 0xfff7e0],
    crown: GOLD, band: 0xc99a22, cushion: 0x2b4fb8, jewels: [0x3a7bff, 0x3fc76a, 0xffffff], flame: null,
    throne: 0x2b4fb8, frame: GOLD, seat: 0x4a78e0, glow: [0xfff2b0, 0xffd76a, 0xffffff] },
  b: { blade: BONE, fuller: 0xb57cff, guard: 0x4a4458, grip: 0x3a2f45, gem: 0x9be36a, trail: [0xc48cff, 0x9be36a, 0xe2c8ff],
    crown: 0x4a4458, band: BONE, cushion: 0x4a2a6a, jewels: [0x9be36a, 0xb57cff, 0xe2c8ff], flame: [0x6fa83a, 0xb6e34a, 0xe2f5a0],
    throne: 0x3a3346, frame: BONE, seat: 0x5a2a7a, glow: [0xb6e34a, 0xe2f5a0, 0xc48cff] },
};
const wrap = (x) => { const t = Math.PI * 2; return ((x % t) + t) % t; };
const angOf = (v) => Math.atan2(v.x, v.z);   // a turn about +y adds to this angle
const yawOf = (v) => Math.atan2(-v.x, -v.z);  // the turn that points a group's -z along v

// The arms of the king (rig parts armP and armN) and a holder that copies the right hand's world pose every frame, so a
// prop sits in the hand whatever the arm does. The holder lives in the fx space; arm turns and the lean of the whole figure
// are ours while set (the director puts every transform back afterwards).
function armRig(ctx, K) {
  const arm = K.part(K.s.A, 'armP'), armN = K.part(K.s.A, 'armN'), rig = K.s.A.group.getObjectByName('rig');
  const holder = new THREE.Group();
  K.fx.add(holder);
  let len = 0.68;
  const mesh = arm?.children?.[0];
  if (mesh?.geometry) { mesh.geometry.computeBoundingBox(); len = Math.max(0.2, -mesh.geometry.boundingBox.min.y); }
  // lift: the right arm turned out sideways, fwd: turned forward (pi is straight up), fwdN: the left arm forward, lean: the figure
  const st = { lift: 0, fwd: 0, fwdN: 0, lean: 0 };
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const _h = new THREE.Vector3(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion();
  const sync = () => {
    if (!arm || !holder.parent) return;
    if (st.lean && rig) rig.rotation.z = st.lean;
    arm.rotation.set(-st.fwd, 0, st.lift);
    if (armN && st.fwdN) armN.rotation.set(-st.fwdN, 0, 0);
    const par = holder.parent;
    par.updateWorldMatrix(true, false); arm.updateWorldMatrix(true, false);
    holder.position.copy(par.worldToLocal(arm.localToWorld(_h.set(0, -len * 0.92, 0))));
    arm.getWorldQuaternion(_q); par.getWorldQuaternion(_qp);
    holder.quaternion.copy(_qp.invert().multiply(_q).multiply(flip));   // the prop's +y runs on along the arm
    holder.updateMatrix();
  };
  ctx.onFrame(sync);
  // the shoulder in the pieces' space (measured once, at rest)
  const shoulder = () => (arm ? K.s.where(arm) : K.P(K.s.A.group.position.x, K.ah * 0.62, K.s.A.group.position.z));
  return { arm, holder, len, st, sync, shoulder };
}

// A group of boxes breaks into loose cubes: cubes in its colours fly off from its own boxes, then it is hidden.
function shatter(K, group, colors, count, { speed = [1, 2.6], up = 0.6, life = [0.5, 0.9], gravity = -9, hide = true } = {}) {
  const meshes = []; group.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
  if (!meshes.length) { group.visible = false; return; }
  const c0 = K.s.where(group);
  for (let i = 0, c = K.n(count); i < c; i++) {
    const p = K.s.where(meshes[(K.rnd() * meshes.length) | 0]);
    const d = K.P(p.x - c0.x, 0, p.z - c0.z); if (d.lengthSq() < 1e-4) d.set(K.rnd() - 0.5, 0, K.rnd() - 0.5);
    d.normalize(); d.y = up + K.rnd() * 0.5;
    K.bleed(p, { count: 1, dir: d.normalize(), spread: 0.35, speed, size: [0.06, 0.11], life, colors, gravity, bounce: 0.3 });
  }
  if (hide) group.visible = false;
}

// The blood of a hit without the big white flash of K.finale (it would cover the victim): cubes, a ring splash, a fount and a
// puddle around the victim's square that this variant fades itself. Level 0 throws no red at all.
function gore(K, point, { dir = K.aim, ring = true, puddleR = 0.32 + 0.12 * K.vw, flash = 0.2, pool = true } = {}) {
  const { L, ctx } = K;
  K.sfx.splat?.();
  K.bleed(point, { count: L.hit, dir: K.P(dir.x, 0.5, dir.z).normalize(), spread: 0.8 });
  K.bleed(point, { count: Math.round(L.hit * 0.4), dir: K.up, spread: 0.5, speed: [1.5, 3.5] });
  if (L.ring && ring) K.splash(K.P(K.C.x, 0.08, K.C.z), L.ring);
  for (let i = 1; i <= L.fount; i++) K.fx.wait(0.12 * i).then(() => { if (K.live()) K.bleed(point, { count: 14, dir: K.up, spread: 0.35, speed: [2, 4.2] }); });
  if (flash) K.flash(point, flash, 0xfff1d0);
  let set = () => {}, t0 = ctx.time(), out = -1;
  const puddle = L.puddle && pool;
  if (puddle) set = K.puddle(K.n(L.puddle), puddleR);
  const stop = ctx.onFrame(() => set(out >= 0 ? Math.max(0, 1 - (ctx.time() - out) / 0.45) : Math.min(1, (ctx.time() - t0) / 0.5)));
  return async () => { if (!puddle) return; out = ctx.time(); await K.tw(0.45, () => {}); set(0); stop?.(); };
}

// Whirlwind: the king draws a giant great sword out sideways and whirls around one to two full turns like a spinning top,
// leaning out, the blade flat at shoulder height and a ring of cubes left behind its tip. On the last turn the blade dips
// and cleaves the victim, which is flung far to the side, tumbling and dripping red cubes. The sword breaks into cubes.
const whirl = {
  id: 'king-a', attacker: 'k', still: 2.18, noTurn: true,
  de: 'Wirbelschwert: der König dreht sich mit seinem Riesenschwert wie ein Kreisel, der Gegner fliegt weit zur Seite',
  cam: { dist: 10.4, pitch: 22, yaw: -50 },
  async run(ctx, K) {
    const { a, v, s, fx, sfx, box, lerp, bump, outQuad, inQuad, inOut, outBack, aim, side, C, hV, TAU } = K;
    const look = LOOK[ctx.attackerColor === 'b' ? 'b' : 'w'];
    const R = armRig(ctx, K);
    const planted = K.part(s.A, 'sword');          // the hero king's own planted sword, if the figure tags it

    // the great sword, built along +y from the hand: grip, guard with a gem, a broad blade with a fuller and a point
    const sword = new THREE.Group();
    // about as long as the king is tall and a third of a square wide
    sword.add(box(0.09, 0.34, 0.09, look.grip, 0, 0, 0), box(0.14, 0.12, 0.14, look.guard, 0, -0.2, 0),
      box(0.72, 0.11, 0.13, look.guard, 0, 0.2, 0), box(0.13, 0.13, 0.15, look.gem, 0, 0.2, 0),
      box(0.34, 1.85, 0.06, look.blade, 0, 1.17, 0), box(0.1, 1.5, 0.07, look.fuller, 0, 1.05, 0),
      box(0.18, 0.16, 0.054, look.blade, 0, 2.15, 0));
    if (ctx.attackerColor === 'b') for (let i = 0; i < 5; i++) sword.add(box(0.07, 0.11, 0.044, BONE, (i % 2 ? 1 : -1) * 0.19, 0.55 + i * 0.32, 0));   // bone teeth
    const piv = new THREE.Group(); piv.scale.setScalar(0.001); piv.add(sword); R.holder.add(piv);
    const TIP = 2.22, S = 1;
    const bladePoint = (u, out) => out.set(0, TIP * u * piv.scale.y, 0).applyMatrix4(R.holder.matrix);

    // the strike geometry: the arm is turned out by th so the blade crosses the victim at hitY at distance Rhit
    const hitY = Math.min(1.15, Math.max(0.55, hV * 0.55));     // waist height of the victim, never at the floor
    const FLAT = Math.PI / 2 + 0.1;                              // the whirl: the blade a little above flat
    await K.stepBack(-1.25, 0.3);
    if (!K.live()) return;
    const sh = R.shoulder(), A0 = s.A.group.position;
    const shOut = Math.hypot(sh.x - A0.x, sh.z - A0.z), shY = sh.y - A0.y;
    const reach = R.len * 0.92 + TIP * S * 0.72;
    const th = Math.acos(Math.min(0.92, Math.max(-0.1, (shY - hitY) / reach)));
    const Rhit = shOut + reach * Math.sin(th);
    const armDir0 = K.P(sh.x - A0.x, 0, sh.z - A0.z).normalize();
    const sHit = wrap(angOf(aim) - angOf(armDir0)) + TAU;     // one to two full turns, the last one ends with the blade on the aim
    const sEnd = Math.ceil(sHit / TAU - 1e-6) * TAU;          // the follow through ends facing the victim again
    // a flat blade at shoulder height passes over a short victim; a tall one is kept out of reach until the last turn
    const clear = hV + 0.12 < shY;
    const dFar = clear ? -(Rhit + 0.15) : -(shOut + reach + 0.5 + 0.1 * K.vw);

    // draw: the king backs off to the whirl start, the arm goes out flat and the sword grows into the hand with a glint
    sfx.whoosh?.();
    if (planted) planted.visible = false;
    const _p = new THREE.Vector3();
    await s.tw(0.4, (k, t) => { a.d = lerp(-1.25, dFar, k); R.st.lift = lerp(0, FLAT, outQuad(t)); piv.scale.setScalar(Math.max(0.001, S * outBack(t))); a.sy = 1 - 0.08 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); }, inOut);
    if (!K.live()) return;
    sfx.magic?.();
    K.sparks(bladePoint(1, _p).clone(), 10, look.trail);
    await s.tw(0.16, (k) => { R.st.lean = -0.12 * k; R.st.lift = FLAT + 0.12 * k; });
    if (!K.live()) return;

    // the trail: cubes laid along the real arc of the blade tip (and, sparser, the middle of the blade), each shrinking
    // away in a quarter second, so a ring forms around the king while he turns
    let trail = false;
    const last = [null, null];
    const SP = K.lite ? [0.2, 0] : [0.12, 0.22];
    const lay = (p, sz, c) => {
      const m = box(sz, sz, sz, c, p.x, p.y, p.z);
      m.rotation.set(0.5, 0.8, 0); fx.add(m);
      fx.tween(0.25, (k) => { m.scale.setScalar(Math.max(0.001, sz * (1 - k))); if (k >= 1) fx.remove(m); });
    };
    const _c = new THREE.Vector3();
    ctx.onFrame(() => {
      if (!trail) { last[0] = last[1] = null; return; }
      _c.copy(s.A.group.position);
      [[1, 0.14], [0.6, 0.1]].forEach(([u, sz], j) => {
        if (!SP[j]) return;
        const p = bladePoint(u, new THREE.Vector3());
        const now = { ang: Math.atan2(p.x - _c.x, p.z - _c.z), r: Math.hypot(p.x - _c.x, p.z - _c.z), y: p.y };
        const q = last[j];
        if (q) {
          let da = now.ang - q.ang; while (da < -Math.PI) da += TAU; while (da > Math.PI) da -= TAU;
          const arc = Math.abs(da) * (now.r + q.r) / 2, n = Math.min(14, Math.floor(arc / SP[j]));
          for (let i = 1; i <= n; i++) {
            const f = i / n, ang = q.ang + da * f, r = lerp(q.r, now.r, f);
            lay(_p.set(_c.x + Math.sin(ang) * r, lerp(q.y, now.y, f), _c.z + Math.cos(ang) * r), sz, look.trail[(i + j) % look.trail.length]);
          }
          if (n) last[j] = now;
        } else last[j] = now;
      });
    });

    // the whirl: faster and faster, the blade flat at shoulder height; it dips onto the victim only in the last half turn
    sfx.whoosh?.();
    trail = true;
    let dustAt = 0, turns = 0;
    await s.tw(1.25, (k, t) => {
      a.spin = sHit * (0.3 * t + 0.7 * t * t);
      a.d = lerp(dFar, -Rhit, clear ? inOut(t) : Math.pow(t, 5));
      a.sy = lerp(0.92, 1.03, Math.min(1, t * 3)); a.sx = a.sz = 1 / Math.sqrt(a.sy);
      R.st.lean = -0.12 - 0.12 * Math.min(1, t * 2);
      R.st.lift = lerp(FLAT, th, inOut(Math.min(1, Math.max(0, 1 - (sHit - a.spin) / (Math.PI * 0.8))))) - R.st.lean;   // the lean would lower the arm
      const turn = Math.floor(a.spin / TAU);
      if (turn > turns) { turns = turn; sfx.whoosh?.(); }
      if (Math.floor(t * 8) > dustAt && t < 1) { dustAt = Math.floor(t * 8); K.dust(K.P(s.A.group.position.x, 0.05, s.A.group.position.z), 2); }
      v.lat = Math.sin(t * 40) * 0.02 * t; v.tip = -0.12 * t * t;             // the victim shivers and leans away
    });
    if (!K.live()) return;

    // the cleave: blood, sparks, a short small flash; the victim is flung far along the swing, tumbling
    sfx.slice?.(); sfx.crack?.();
    const hit = K.at(0, hitY, 0);
    trail = false;
    const fling = K.P(aim.x * 0.8 + side.x * 0.6, 0, aim.z * 0.8 + side.z * 0.6).normalize();
    const fade = gore(K, hit, { dir: fling, flash: 0.22 });
    K.sparks(hit, 10, look.trail);
    const dist = 2.3 + 0.15 * (2 - K.vw), height = 0.95 + 0.15 * (2 - K.vw);
    const fa = aim.x * fling.x + aim.z * fling.z, fs = side.x * fling.x + side.z * fling.z;
    const vAt = () => K.P(C.x + aim.x * v.off + side.x * v.lat, v.y + 0.3, C.z + aim.z * v.off + side.z * v.lat);
    const flight = (async () => {
      let drip = 0;
      await s.tw(0.82, (k, t) => {
        v.off = fa * dist * outQuad(t); v.lat = fs * dist * outQuad(t); v.y = height * bump(t);
        v.spin = TAU * 1.5 * outQuad(t); v.tip = lerp(-0.12, Math.PI / 2 + TAU, t);
        if (K.level > 0 && t < 0.85 && Math.floor(t * 22) > drip) { drip = Math.floor(t * 22); K.bleed(vAt(), { count: 2, dir: K.up, spread: 0.6, speed: [0.4, 1.2], life: [0.6, 1] }); }
      });
      if (!K.live()) return;
      v.tip = Math.PI / 2;
      sfx.thud?.();
      const land = K.P(C.x + aim.x * v.off + side.x * v.lat, 0.06, C.z + aim.z * v.off + side.z * v.lat);
      K.dust(land, 10);
      await s.tw(0.24, (k, t) => { v.tip = Math.PI / 2 - 0.12 * Math.exp(-6 * t) * Math.abs(Math.sin(14 * t)); v.y = 0.1 * bump(t * 2) * (t < 0.5 ? 1 : 0); });
      if (!K.live()) return;
      K.dust(K.P(land.x, 0.12, land.z), 12);
      v.on = false; s.V.group.visible = false;
    })();

    // follow through to face the victim's square again, the arm comes up flat, the lean goes
    await s.tw(0.3, (k) => { a.spin = lerp(sHit, sEnd, k); a.sy = lerp(1.03, 1, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); R.st.lean = lerp(-0.24, 0, k); R.st.lift = lerp(th + 0.24, FLAT, k); }, outQuad);
    if (!K.live()) return;
    // the great sword: back into the planted sword with a shrink, or (a king without one) burst into cubes
    if (planted) {
      await s.tw(0.22, (k) => { piv.scale.setScalar(Math.max(0.001, S * (1 - inQuad(k)))); R.st.lift = lerp(FLAT, 0.2, k); });
      planted.visible = true;
    } else {
      // the sword shrinks away into the hand with a sparkle while the arm lowers; nothing of it stays behind
      sfx.magic?.();
      K.sparks(bladePoint(0.6, _p).clone(), 8, look.trail);
      await s.tw(0.28, (k) => { R.st.lift = lerp(FLAT, 0.15, k); piv.scale.setScalar(Math.max(0.001, S * (1 - inQuad(k)))); }, inOut);
      piv.visible = false;
    }
    R.st.lift = 0; R.st.lean = 0; a.spin = 0;
    if (!K.live()) return;
    await Promise.all([K.back(-Rhit, 0.42), flight]);
    await fade();
    await K.kill.done();
  },
};


// Royal command: the king throws one arm straight up, a glow on his fingertip, and a giant crown of cubes (more than a
// square and a half wide, nearly as tall as he is) appears just above the victim while its shadow grows on the square. He
// snaps his finger down at the victim: the crown drops and slams it flat into the board in a ring of dust. For a beat the
// victim's hands and feet poke out under the rim and wiggle, then red cubes pop out all round; the crown wobbles, hops and
// bursts into cubes.
const command = {
  id: 'king-b', attacker: 'k', still: 2.05,
  de: 'Königsbefehl: der König zeigt in den Himmel, eine Riesenkrone fällt herunter und macht den Gegner platt',
  cam: { dist: 8.8, pitch: 21, yaw: -18 },
  async run(ctx, K) {
    const { a, v, s, fx, sfx, box, lerp, outQuad, inQuad, inOut, outBack, aim, side, C, hV, TAU, rnd } = K;
    const black = ctx.attackerColor === 'b', look = LOOK[black ? 'b' : 'w'];
    const R = armRig(ctx, K);

    // the giant crown, base at its origin: four walls (no two share a face plane), a band, spikes with jewels or flames,
    // a cushion and an orb on top
    const W = 1.16, T = 0.16, H = 0.9;           // the victim's square and a small margin
    const crown = new THREE.Group();
    crown.add(box(W, H, T, look.crown, 0, H / 2, (W - T) / 2), box(W, H, T, look.crown, 0, H / 2, -(W - T) / 2),
      box(T, H - 0.01, W - 2 * T - 0.01, look.crown, (W - T) / 2, H / 2, 0), box(T, H - 0.01, W - 2 * T - 0.01, look.crown, -(W - T) / 2, H / 2, 0));
    crown.add(box(W + 0.05, 0.16, W + 0.05, look.band, 0, 0.16, 0), box(W + 0.04, 0.1, W + 0.04, look.band, 0, H - 0.12, 0));
    crown.add(box(W - 2 * T + 0.02, 0.34, W - 2 * T + 0.02, look.cushion, 0, H - 0.1, 0), box(0.8, 0.22, 0.8, look.cushion, 0, H + 0.16, 0));
    crown.add(box(0.28, 0.28, 0.28, look.crown, 0, H + 0.41, 0), box(0.11, 0.28, 0.11, look.jewels[0], 0, H + 0.66, 0), box(0.28, 0.1, 0.1, look.jewels[0], 0, H + 0.68, 0));
    const flames = [];
    for (const [x, z, tall] of [[-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1], [0, -1, 0.7], [0, 1, 0.7], [-1, 0, 0.7], [1, 0, 0.7]]) {
      const px = x * (W - T) / 2, pz = z * (W - T) / 2, h = 0.46 * tall;
      crown.add(box(T + 0.03, h + 0.02, T + 0.03, look.crown, px, H - 0.01 + h / 2, pz));
      if (look.flame) {
        const f = box(T - 0.04, 0.32 * tall, T - 0.04, look.flame[1], px, H + h + 0.14 * tall, pz);
        f.userData.base = f.position.y; f.userData.ph = rnd() * TAU; f.userData.tall = tall; crown.add(f); flames.push(f);
      } else crown.add(box(T - 0.05, 0.13, T - 0.05, look.jewels[2], px, H + h + 0.06, pz));
      if (z !== 0 && x === 0) for (const sgn of [-1, 1]) crown.add(box(0.2, 0.2, 0.05, look.jewels[(sgn + 1) / 2], 0.38 * sgn, H * 0.52, z * (W / 2 + 0.018)));
      if (x !== 0 && z === 0) for (const sgn of [-1, 1]) crown.add(box(0.05, 0.2, 0.2, look.jewels[(sgn + 1) / 2], x * (W / 2 + 0.018), H * 0.52, 0.38 * sgn));
    }
    const holderC = new THREE.Group(); holderC.add(crown); fx.add(holderC);
    const hover = hV + 0.2;
    holderC.position.set(C.x, hover, C.z); holderC.scale.setScalar(0.001);
    const rFace = yawOf(aim);
    holderC.rotation.y = rFace + 0.6;
    ctx.onFrame((dt, t) => { for (const f of flames) { const u = Math.sin(t * 14 + f.userData.ph); f.scale.y = 0.32 * f.userData.tall * (1 + 0.3 * u); f.position.y = f.userData.base + 0.03 * u; } });
    const shadow = box(1, 0.004, 1, SHADOW, C.x, 0.0095, C.z);
    shadow.scale.set(0.001, 0.004, 0.001); shadow.rotation.y = rFace; fx.add(shadow);
    // a glow on the fingertip of the raised hand
    const tipGlow = box(1, 1, 1, look.glow[0], 0, 0.1, 0, { add: true }), GL = 0.16;
    tipGlow.scale.setScalar(0.001); R.holder.add(tipGlow);
    const finger = () => s.where(tipGlow);

    // the command: the king steps back, the arm swings out and straight up (a turn about z, which the rig leaves alone)
    await K.stepBack(-2.3, 0.4);
    if (!K.live()) return;
    sfx.magic?.();
    await s.tw(0.24, (k) => { R.st.lift = lerp(0, Math.PI, k); a.sy = 1 + 0.07 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); a.tip = -0.06 * k; }, outBack);
    if (!K.live()) return;
    K.bleed(finger(), { count: 8, dir: K.up, spread: 0.3, speed: [0.8, 1.6], size: [0.03, 0.05], life: [0.4, 0.7], colors: look.glow, gravity: 1.5 });

    // the crown appears just above the victim with a sparkle, hovers and turns slowly; its shadow grows on the square;
    // the victim looks up and shivers; the finger keeps glowing and sparkling
    K.sparks(K.P(C.x, hover + 0.6, C.z), 12, black ? look.trail : SPARK);
    let rise = 0;
    await s.tw(0.72, (k, t) => {
      holderC.scale.setScalar(Math.max(0.001, outBack(Math.min(1, t * 3))));
      holderC.position.y = hover + 0.05 * Math.sin(t * 10);
      holderC.rotation.y = rFace + 0.6 * (1 - inOut(t));
      const sh = lerp(0.3, 1.15, t); shadow.scale.set(sh, 0.004, sh);
      R.st.lift = Math.PI;
      tipGlow.scale.setScalar(Math.max(0.001, GL * Math.min(1, t * 5) * (1 + 0.25 * Math.sin(t * 30))));
      if (Math.floor(t * 8) > rise) { rise = Math.floor(t * 8); K.bleed(finger(), { count: 2, dir: K.up, spread: 0.25, speed: [0.6, 1.2], size: [0.03, 0.05], life: [0.4, 0.6], colors: look.glow, gravity: 1.5 }); }
      v.tip = -0.16 * outQuad(t); v.lat = Math.sin(t * 50) * 0.015 * t;
    });
    if (!K.live()) return;

    // the snap: the arm comes down to point at the victim and the crown drops like a stone
    sfx.whoosh?.();
    await s.tw(0.09, (k) => { R.st.lift = lerp(Math.PI, 0.2, k); R.st.fwd = lerp(0, 1.05, k); a.tip = lerp(-0.06, 0.1, k); tipGlow.scale.setScalar(Math.max(0.001, GL * (1 - k))); });
    await s.tw(0.24, (k, t) => {
      holderC.position.y = lerp(hover, hV, inQuad(t));
      const sh = lerp(1.15, W, inQuad(t)); shadow.scale.set(sh, 0.004, sh);
      a.sy = lerp(1.07, 1, t); a.sx = a.sz = 1 / Math.sqrt(a.sy);
      v.tip = lerp(-0.16, 0, t);
    });
    if (!K.live()) return;
    // the slam: the crown presses the victim flat into the board
    sfx.crack?.();
    await s.tw(0.08, (k, t) => { holderC.position.y = lerp(hV, 0.008, t); v.sy = Math.max(0.08, holderC.position.y / hV); v.sx = v.sz = 1 + 0.3 * t; v.lat = 0; });
    v.on = false; s.V.group.visible = false;
    shadow.visible = false;
    sfx.thud?.();
    const rim = W / 2 + 0.03;
    // a ring of dust cubes that spreads about a square out from the rim
    for (let i = 0, c = K.lite ? 12 : 18; i < c; i++) {
      const ang = (i / c) * TAU, d = K.P(Math.sin(ang), 0, Math.cos(ang));
      K.bleed(K.P(C.x + d.x * (rim + 0.06), 0.06, C.z + d.z * (rim + 0.06)), { count: 1, dir: K.P(d.x, 0.12, d.z).normalize(), spread: 0.1, speed: [1.7, 2.4], size: [0.07, 0.12], life: [0.5, 0.7], colors: DUST, gravity: -2, bounce: 0.1 });
    }

    // the victim's hands and feet poke out under the rim and wiggle for a beat (the colours of the victim's side)
    const vw = black ? { hand: 0xe0b48a, foot: 0x4a3324 } : { hand: 0x7fa04a, foot: 0x2a2530 };   // hero skin or monster moss
    const limbs = [];
    for (const [dx, dz, foot] of [[-0.25, -1, 1], [0.25, -1, 1], [-1, 0.15, 0], [1, 0.15, 0]]) {
      // dz -1: towards the king (the feet), dx +-1: the sides (the hands); along the aim and side vectors
      const dirL = dz === -1 ? K.P(-aim.x, 0, -aim.z) : K.P(side.x * dx, 0, side.z * dx);
      const off = dz === -1 ? K.P(side.x * dx, 0, side.z * dx) : K.P(aim.x * dz, 0, aim.z * dz);
      const len = foot ? 0.26 : 0.3, m = box(foot ? 0.16 : 0.17, foot ? 0.1 : 0.1, len, foot ? vw.foot : vw.hand);
      const g = new THREE.Group(); g.add(m); m.position.z = -len / 2;
      g.position.set(C.x + dirL.x * (rim - 0.05) + off.x, 0.012 + (foot ? 0.045 : 0.035), C.z + dirL.z * (rim - 0.05) + off.z);
      g.rotation.y = yawOf(dirL); g.scale.set(1, 1, 0.001); fx.add(g); limbs.push(g);
    }
    await s.tw(0.1, (k) => { for (const g of limbs) g.scale.z = Math.max(0.001, outBack(k)); });
    const r0 = limbs.map((g) => g.rotation.y);
    await s.tw(0.32, (k, t) => { limbs.forEach((g, i) => { g.rotation.y = r0[i] + 0.35 * Math.sin(t * 34 + i * 1.7); }); });
    if (!K.live()) return;

    // the pop: red cubes burst out all round the rim, the limbs go limp and slide back under
    const fade = gore(K, K.at(-rim - 0.05, 0.12), { dir: K.P(-aim.x, 0.3, -aim.z), ring: false, puddleR: W * 0.66, flash: 0 });
    const ringN = K.n(K.L.ring + Math.round(K.L.hit * 0.6));
    for (let i = 0; i < ringN; i++) {
      const ang = (i / ringN) * TAU + rnd() * 0.2, d = K.P(Math.sin(ang), 0, Math.cos(ang));
      K.bleed(K.P(C.x + d.x * (rim + 0.05), 0.1, C.z + d.z * (rim + 0.05)), { count: 1, dir: K.P(d.x, 0.7 + rnd() * 0.5, d.z).normalize(), spread: 0.15, speed: [2, 3.6], size: [0.07, 0.12] });
    }
    K.sparks(K.P(C.x + aim.x * -rim, 0.15, C.z + aim.z * -rim), 8, black ? look.trail : SPARK);
    const limp = s.tw(0.3, (k) => { limbs.forEach((g, i) => { g.rotation.y = r0[i]; g.scale.set(1, Math.max(0.001, 1 - 0.5 * k), Math.max(0.001, 1 - inQuad(k))); }); });

    // the wobble: the crown squashes and springs back, the king lowers his arm
    await s.tw(0.42, (k, t) => {
      const w = Math.exp(-5 * t) * Math.sin(t * 22);
      holderC.scale.set(1 + 0.1 * w, 1 - 0.18 * w, 1 + 0.1 * w);
      R.st.fwd = lerp(1.05, 0.25, inOut(t)); R.st.lift = lerp(0.2, 0, t); a.tip = lerp(0.1, 0, t);
    });
    await limp;
    for (const g of limbs) g.visible = false;
    if (!K.live()) return;

    // the exit: a little hop, then the crown bursts into cubes; the puddle shows where the victim stood
    sfx.magic?.();
    await s.tw(0.16, (k) => { holderC.position.y = 0.008 + 0.25 * outQuad(k); R.st.fwd = lerp(0.25, 0, k); });
    holderC.updateWorldMatrix(true, true);
    shatter(K, holderC, [look.crown, look.crown, look.band, ...look.jewels], 30, { speed: [1.2, 2.8], up: 0.7, hide: false });
    await s.tw(0.3, (k, t) => { holderC.scale.setScalar(Math.max(0.001, 1 - inQuad(t))); holderC.rotation.y = rFace + 2.4 * t; holderC.position.y = 0.26 + 0.2 * t; });
    holderC.visible = false;
    R.st.fwd = 0;
    if (!K.live()) return;
    await K.back(-2.3, 0.45);
    await fade();
    await K.kill.done();
  },
};

// Throne trampoline: a royal throne of cubes grows from the board under the king and lifts him up. He crouches on the seat,
// throws both arms up and leaps off it in an arc, turns flat in the air and lands a belly flop on the victim, which is
// squashed into a wide springy pad. The pad dips and springs, the king bounces high up off it once and lands on his feet
// beside it, and the pad pops in a burst of red cubes and dust. The throne sinks back into the board meanwhile.
const slam = {
  id: 'king-c', attacker: 'k', still: 2.23, noTurn: true,
  de: 'Thronsprung: ein Thron wächst unter dem König, er springt mit dem Bauch auf den Gegner und hüpft wie vom Trampolin wieder hoch',
  cam: { dist: 9.2, pitch: 17, yaw: 5 },
  async run(ctx, K) {
    const { a, v, s, fx, sfx, box, lerp, bump, outQuad, inQuad, inOut, outBack, aim, C, TAU, rnd } = K;
    const look = LOOK[ctx.attackerColor === 'b' ? 'b' : 'w'];
    const R = armRig(ctx, K);

    // the throne, base at its origin, front towards the victim (-z): a block, a cushion, a tall back with a panel and a
    // crest, two armrests with knobs and a trim at the foot
    const th = new THREE.Group();
    th.add(box(0.9, 0.56, 0.8, look.throne, 0, 0.28, 0), box(0.96, 0.08, 0.86, look.frame, 0, 0.06, 0),
      box(0.8, 0.1, 0.7, look.seat, 0, 0.6, -0.02),
      box(0.94, 1.31, 0.2, look.throne, 0, 1.155, 0.31), box(0.6, 0.9, 0.04, look.seat, 0, 1.15, 0.2),
      box(1.02, 0.12, 0.26, look.frame, 0, 1.8, 0.31), box(0.5, 0.2, 0.24, look.frame, 0, 1.95, 0.31), box(0.16, 0.16, 0.16, look.jewels[0], 0, 2.12, 0.31));
    for (const sx of [-1, 1]) th.add(box(0.14, 0.26, 0.74, look.frame, sx * 0.43, 0.75, -0.01), box(0.18, 0.12, 0.18, look.jewels[1], sx * 0.43, 0.92, -0.33));
    const SEAT = 0.65;
    // the legs keep still while the king is up on the throne and in the air (the rig would swing them as he moves)
    const legs = ['legN', 'legP'].map((n) => K.part(s.A, n)).filter(Boolean).map((o) => ({ o, p: o.position.clone() }));
    let still = false;
    ctx.onFrame(() => { if (still) for (const l of legs) { l.o.rotation.x = 0; l.o.position.copy(l.p); } });
    const D = -2.35;                                     // where the throne stands, along the aim from the victim
    const tg = new THREE.Group(); tg.add(th); fx.add(tg);
    const tp = K.at(D, 0.008);
    tg.position.copy(tp); tg.rotation.y = yawOf(aim); tg.scale.set(1, 0.001, 1);

    // the throne grows under the king and lifts him up, dust cubes burst at its foot
    await K.stepBack(D, 0.34);
    if (!K.live()) return;
    still = true;
    sfx.magic?.();
    K.dust(K.P(tp.x, 0.06, tp.z), 10);
    await s.tw(0.5, (k, t) => { const u = Math.max(0.001, outBack(t)); tg.scale.set(1, u, 1); a.y = SEAT * u; });
    if (!K.live()) return;
    K.sparks(K.P(tp.x, 2.1, tp.z), 10, look.glow);

    // the wind up: a deep crouch on the seat, both arms go up
    await s.tw(0.32, (k) => { a.sy = 1 - 0.2 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); R.st.fwd = R.st.fwdN = lerp(0.001, Math.PI * 0.95, k); a.tip = -0.12 * k; }, inOut);
    if (!K.live()) return;

    // the leap: an arc, the king turns flat in the air and comes down chest first on the victim, which is pressed down
    // like a trampoline; the throne sinks back into the board, a few cubes crumble off it
    sfx.whoosh?.();
    const dLand = -(K.s.rbA + 1.15);
    const sq = (t) => Math.min(1, Math.max(0, (t - 0.82) / 0.18));
    const sink = s.tw(0.6, (k, t) => {
      tg.scale.set(1, Math.max(0.001, 1 - inOut(t)), 1);
      if (rnd() < 0.4) K.bleed(K.P(tp.x + (rnd() - 0.5) * 0.8, 0.1 + 2 * (1 - inOut(t)) * rnd(), tp.z + (rnd() - 0.5) * 0.8), { count: 1, dir: K.up, spread: 1, speed: [0.3, 0.9], size: [0.06, 0.1], life: [0.4, 0.6], colors: [look.throne, look.frame, look.seat], gravity: -12 });
    }).then(() => { tg.visible = false; K.dust(K.P(tp.x, 0.06, tp.z), 8); });
    await s.tw(0.58, (k, t) => {
      a.d = lerp(D, dLand, t);
      a.y = lerp(SEAT, 0.06, t) + 0.55 * bump(t);
      a.sy = lerp(0.8, 1.06, Math.min(1, t * 4)); a.sx = a.sz = 1 / Math.sqrt(a.sy);
      a.tip = lerp(-0.12, Math.PI / 2, inOut(Math.min(1, Math.max(0, (t - 0.15) / 0.85))));
      R.st.fwd = R.st.fwdN = lerp(Math.PI * 0.95, Math.PI, t);
      v.tip = -0.2 * outQuad(t) * (1 - sq(t)); v.lat = Math.sin(t * 50) * 0.015 * t * (1 - sq(t));   // the victim looks up and shivers
      v.sy = 1 - 0.8 * sq(t); v.sx = v.sz = 1 + 0.6 * sq(t);
    });
    if (!K.live()) return;

    // the landing: a thud, a ring of dust cubes, the victim squashed into a wide pad under the king; the pad dips
    sfx.thud?.();
    v.tip = 0; v.lat = 0;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU, d = K.P(Math.sin(ang), 0, Math.cos(ang));
      K.bleed(K.P(C.x + d.x * 0.6, 0.06, C.z + d.z * 0.6), { count: K.lite ? 1 : 2, dir: K.P(d.x, 0.3, d.z).normalize(), spread: 0.3, speed: [1, 2], size: [0.06, 0.11], life: [0.4, 0.7], colors: DUST, gravity: -4 });
    }
    await s.tw(0.12, (k) => { v.sy = lerp(0.2, 0.11, outQuad(k)); v.sx = v.sz = lerp(1.6, 1.75, k); a.y = lerp(0.06, 0.02, k); });
    if (!K.live()) return;

    // the bounce: the pad springs, the king is thrown high up off it, turns upright in the air and lands on his feet
    // beside it; the pad wobbles
    sfx.whoosh?.();
    const dBeside = dLand - 0.45;
    await s.tw(0.75, (k, t) => {
      a.y = 0.02 + 1.6 * bump(t); a.d = lerp(dLand, dBeside, t);
      a.tip = lerp(Math.PI / 2, 0, inOut(Math.min(1, t * 1.6)));
      a.spin = 0;
      R.st.fwd = R.st.fwdN = lerp(Math.PI, 0.4, t);
      const w = Math.exp(-4 * t) * Math.sin(t * 26);
      v.sy = 0.24 + 0.16 * w; v.sx = v.sz = 1.6 - 0.25 * w;
    });
    if (!K.live()) return;
    sfx.thud?.();
    K.dust(K.P(s.A.group.position.x, 0.06, s.A.group.position.z), 8);

    // the pop: the pad bursts in red cubes and dust (no puddle: the crown of king-b has one)
    const at = K.at(0, 0.12);
    gore(K, at, { dir: K.up, ring: true, pool: false, flash: 0.22 });
    K.bleed(at, { count: Math.round(K.L.hit * 0.6), dir: K.up, spread: 1.2, speed: [1.2, 3], size: [0.05, 0.09] });
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU, d = K.P(Math.sin(ang), 0, Math.cos(ang));
      K.bleed(K.P(C.x + d.x * 0.4, 0.08, C.z + d.z * 0.4), { count: K.lite ? 1 : 2, dir: K.P(d.x, 0.5, d.z).normalize(), spread: 0.3, speed: [1, 2.2], size: [0.06, 0.11], life: [0.5, 0.8], colors: DUST, gravity: -4 });
    }
    K.sparks(K.at(0, 0.2), 10, look.glow);
    v.on = false; s.V.group.visible = false;
    sfx.splat?.();
    await s.tw(0.25, (k) => { R.st.fwd = R.st.fwdN = lerp(0.4, 0.001, k); a.sy = 1; a.sx = a.sz = 1; });
    R.st.fwd = 0; R.st.fwdN = 0; still = false;
    if (!K.live()) return;
    await Promise.all([K.back(dBeside, 0.4), sink]);
    await K.kill.done();
  },
};

export default [whirl, command, slam];
