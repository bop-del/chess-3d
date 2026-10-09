// Pixelwelt fight variants of the queen (CHE-371). See fights.js for the module shape.
// Three spells, none of them the spin, the orb or the bolt of pixel-gore.js: the queen calls a meteor shower down on the victim,
// freezes it into a block of ice with a wave of ice spikes and shatters it, or raises a whirlwind that sucks it up and spits
// it out. The arms are raised by turning the rig arms around z (rig.js only drives their x turn), so a pose holds while the
// rig breathes; glowing hand cubes follow the hands so the spell reads on both queens (the spider queen's arms are black).
// The hero queen casts golden fire and pale wind, the spider queen violet fire and violet wind; the ice is the same for both.
import * as THREE from 'three';

const ICE = [0xd8f2ff, 0xa6dcf6, 0x6fb8e6], ICE_WHITE = 0xf4fbff, ICE_TINT = 0xa8dcf5;
const UP = new THREE.Vector3(0, 1, 0);

// the yaw that turns local +z onto the aim (for things built along the aim)
const yawTo = (d) => Math.atan2(d.x, d.z);

// The queen's arms: arms(n, p) turns them outwards around z (0 hangs down, about 1.5 is level, about 2.9 is straight up),
// at(arm, f) is a point along an arm (0 the shoulder, 1 the end of the hand) in the pieces' space.
function queenRig(K) {
  const armN = K.part(K.s.A, 'armN'), armP = K.part(K.s.A, 'armP');
  const arms = (n, p = n) => { if (armN) armN.rotation.z = -n; if (armP) armP.rotation.z = p; };
  const bb = (arm) => { const m = arm?.children[0]; if (!m?.geometry) return null; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); return m.geometry.boundingBox; };
  const size = (arm) => { const b = bb(arm); return b ? { len: -b.min.y, w: b.max.x - b.min.x } : { len: 0.45, w: 0.18 }; };
  const root = K.ctx.root, _v = new THREE.Vector3();
  const at = (arm, f) => {
    if (!arm || !root) { const p = K.s.A.group.position; return new THREE.Vector3(p.x, p.y + K.ah * 1.05, p.z); }
    root.updateWorldMatrix(true, true);
    return root.worldToLocal(arm.localToWorld(_v.set(0, -size(arm).len * f, 0)).clone());
  };
  return { armN, armP, arms, at, size, list: [armN, armP].filter(Boolean) };
}

// Glowing hands: an opaque bright cube on each hand with an additive halo, optionally a glowing rim on the forearm. set(k)
// fades them in and out (0 hides them); they follow the hands every frame.
function glowHands(K, R, { core, halo, rim = 0 }) {
  const items = R.list.map((arm) => {
    const { len, w } = R.size(arm);
    const c = K.box(1, 1, 1, core), h = K.box(1, 1, 1, halo, 0, 0, 0, { add: true }), r = rim ? K.box(1, 1, 1, rim, 0, 0, 0, { add: true }) : null;
    for (const m of [c, h, r]) if (m) { m.visible = false; K.fx.add(m); }
    return { arm, len, w, c, h, r };
  });
  let on = 0;
  const _d = new THREE.Vector3(), _q = new THREE.Quaternion();
  K.ctx.onFrame(() => {
    const t = K.ctx.time();
    for (const it of items) {
      const show = on > 0.01 && K.live();
      it.c.visible = it.h.visible = show; if (it.r) it.r.visible = show;
      if (!show) continue;
      const tip = R.at(it.arm, 0.95), mid = R.at(it.arm, 0.55);
      _q.setFromUnitVectors(UP, _d.subVectors(tip, mid).normalize());
      const pulse = 1 + 0.08 * Math.sin(t * 25);
      it.c.position.copy(tip); it.c.quaternion.copy(_q); it.c.scale.set(it.w * 1.18 * on, it.w * 0.75 * on, it.w * 1.18 * on);
      it.h.position.copy(tip); it.h.quaternion.copy(_q); it.h.scale.setScalar(it.w * 1.6 * on * pulse);
      if (it.r) { it.r.position.lerpVectors(mid, tip, 0.45); it.r.quaternion.copy(_q); it.r.scale.set(it.w * 1.4 * on, it.len * 0.5, it.w * 1.4 * on); }
    }
  });
  return { set: (k) => { on = k; }, hands: () => items.map((it) => R.at(it.arm, 0.95)) };
}

// which side of the fight the camera looks from (+1 along K.side, -1 against it)
function camSide(K) {
  const cam = K.ctx.stage?.camera, root = K.ctx.root;
  if (!cam || !root) return 1;
  root.updateWorldMatrix(true, false);
  const p = root.worldToLocal(cam.getWorldPosition(new THREE.Vector3()));
  return (p.x - K.C.x) * K.side.x + (p.z - K.C.z) * K.side.z >= 0 ? 1 : -1;
}

// a cube that shrinks and drifts up (a fire trail ember, a frost puff)
function ember(K, p, size, color, life = 0.3, rise = 0.25) {
  const m = K.box(size, size, size, color, p.x, p.y, p.z);
  m.rotation.set(K.rnd() * 3, K.rnd() * 3, 0); K.fx.add(m);
  const y0 = p.y;
  K.tw(life, (k, t) => { m.scale.setScalar(Math.max(0.001, size * (1 - t))); m.position.y = y0 + rise * t; m.visible = t < 1; });
}

// ---------------------------------------------------------------------------------------------- queen-a: meteor shower
// The queen turns three quarters to the camera and throws both arms straight up, her hands aglow: four small meteors (solid rock
// with lava bits, a glow shell and a fire trail) fall at once at staggered heights and crash down around the victim, which looks
// up and cowers. Then one big meteor drives it flat into a pancake, bursts into rock and fire, and the red follows a beat later.
async function meteorShower(ctx, K) {
  const { a, v, aim, side, C, hV } = K;
  const B = ctx.attackerColor === 'b';
  const FIRE = B ? [0xe080ff, 0xff8ad8, 0xa64cff, 0xffc8f0] : [0xffd040, 0xff9a20, 0xff5a10, 0xfff0a0];
  const ROCK = B ? [0x3a2450, 0x271838] : [0x3b2a20, 0x2a1d16];
  const LAVA = B ? 0xc060ff : 0xff7a1a, GLOW = B ? 0x50206a : 0x803010, EMBER = B ? 0xb050ff : 0xff7a1a;
  const SCORCH = B ? [0x9a8aa8, 0xb4a6c0, 0x7e6e8c] : [0x9a8a78, 0xb8a890, 0x84745f];   // light ash, so a dark victim still reads on it
  const R = queenRig(K);
  const glow = glowHands(K, R, B ? { core: 0xe0a0ff, halo: 0x6a2a90, rim: 0x9a4cff } : { core: 0xffd860, halo: 0x804010 });
  const craters = [];

  // a meteor: a solid rock cube with lava bits, a smaller glow shell, a trail of shrinking fire cubes
  function meteor(from, to, { size, dur }) {
    const g = new THREE.Group();
    g.add(K.box(size, size, size, ROCK[0]));
    g.add(K.box(size * 0.62, size * 0.62, size * 1.12, ROCK[1]));
    for (const [x, y, z] of [[0.42, 0.1, 0], [-0.1, 0.42, 0.2], [0.15, -0.3, 0.42], [-0.42, -0.12, -0.18]]) g.add(K.box(size * 0.34, size * 0.34, size * 0.34, LAVA, x * size, y * size, z * size));
    g.add(K.box(size * 1.3, size * 1.3, size * 1.3, GLOW, 0, 0, 0, { add: true }));
    g.position.copy(from); g.visible = false; K.fx.add(g);
    let next = 0;
    const every = (size > 0.45 ? 0.04 : 0.06) * (K.lite ? 1.6 : 1);
    const done = K.tw(dur, (k, t) => {
      g.visible = t < 1; g.position.lerpVectors(from, to, k); g.rotation.set(t * 9, t * 6, t * 4);
      while (K.live() && next <= t * dur && t < 1) {
        ember(K, g.position.clone().add(K.P((K.rnd() - 0.5) * size * 0.5, (K.rnd() - 0.5) * size * 0.5, (K.rnd() - 0.5) * size * 0.5)), size * (0.55 + K.rnd() * 0.25), FIRE[(K.rnd() * FIRE.length) | 0], 0.22 + K.rnd() * 0.08);
        next += every;
      }
    }, (k) => k * (0.55 + 0.45 * k));
    return { g, done };
  }
  // a crater: a dark scorched tile with a rim of scorched and ember cubes (all tops well above the puddle tiles)
  function crater(p, big) {
    const w = big ? 0.42 : 0.28;
    const c = K.box(w, 0.024, w, SCORCH[0], p.x, 0.022, p.z); c.rotation.y = K.rnd() * 1.5; c.userData.s = [w, 0.024, w];
    K.fx.add(c); craters.push(c);
    for (let i = 0, nr = big ? 7 : 4; i < nr; i++) {
      const ang = (i / nr) * K.TAU + K.rnd() * 0.3, r = w * 0.55, sz = 0.07 + K.rnd() * 0.04;
      const m = K.box(sz, sz * 0.7, sz, i % 2 ? EMBER : SCORCH[1 + (i % 4 === 0 ? 1 : 0)], p.x + Math.cos(ang) * r, 0.03 + i * 0.004, p.z + Math.sin(ang) * r);
      m.rotation.y = ang; m.userData.s = [sz, sz * 0.7, sz]; K.fx.add(m); craters.push(m);
    }
  }
  function impact(p) {
    K.sfx.thud?.();
    K.flash(K.P(p.x, 0.15, p.z), 0.22, B ? 0xf0d8ff : 0xfff1d0, 0.15);
    K.sparks(p, 5, FIRE);
    K.bleed(p, { count: 4, dir: K.up, spread: 1.0, speed: [1.4, 3.0], size: [0.05, 0.1], life: [0.5, 0.8], colors: ROCK, bounce: 0.3 });
    K.dust(p, 4);
    crater(p, false);
  }

  const cs = camSide(K);
  await K.stepBack(-1.3, 0.35);
  if (!K.live()) return;
  // the call: turned three quarters to the camera, both arms straight up above the crown, the hands light up
  K.sfx.magic?.();
  await K.tw(0.4, (k) => {
    R.arms(2.9 * k); a.yaw = K.s.yawG + cs * 0.75 * k; a.y = 0.1 * k; a.tip = -0.06 * k; a.sy = 1 + 0.05 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy);
    glow.set(k);
  }, K.inOut);
  if (!K.live()) return;
  for (const p of glow.hands()) K.sparks(p, 5, FIRE);

  // the shower: four small meteors in the air at once, staggered in time and height, landing around the victim
  const hold = K.tw(1.6, (k, t) => { R.arms(2.9 + 0.06 * Math.sin(t * 30)); a.y = 0.1 + 0.02 * Math.sin(t * 12); });
  const spots = [[0.45, 0.82], [-0.3, -0.85], [0.9, -0.3], [-0.5, 0.66], [0.15, -1.15], [0.95, 0.55]];
  const lookUp = K.tw(0.25, (k) => { v.tip = -0.2 * k; });
  let cowered = false;
  const falls = spots.map(([d, lat], i) => K.fx.wait(0.09 * i).then(async () => {
    if (!K.live()) return;
    const sgn = Math.sign(lat), to = K.at(d, 0.1, lat);
    const from = to.clone().addScaledVector(side, sgn * 1.3).addScaledVector(aim, 0.45).add(K.P(0, 3.0 + 0.3 * i, 0));
    if (i % 2 === 0) K.sfx.whoosh?.();
    await meteor(from, to, { size: 0.36 + 0.02 * (i % 3), dur: 0.52 + 0.04 * i }).done;
    if (!K.live()) return;
    impact(K.P(to.x, 0.06, to.z));
    if (!cowered) {   // the first hit: the victim ducks down and shivers until the big one comes
      cowered = true;
      K.tw(0.55, (k, t) => { v.sy = 1 - 0.18 * K.outQuad(Math.min(1, t * 4)); v.sx = v.sz = 1 / Math.sqrt(v.sy); v.tip = K.lerp(-0.2, 0.14, K.outQuad(Math.min(1, t * 4))); v.lat = 0.025 * Math.sin(t * 60); });
    }
  }));
  await lookUp;
  await Promise.all(falls);
  if (!K.live()) return;

  // the big one: the victim looks up at it, it comes in steep, squashes the victim into a pancake and bursts
  const size = 0.56, top = K.centre(1); top.y = hV + size * 0.5;
  const bigFrom = top.clone().addScaledVector(side, -cs * 0.7).addScaledVector(aim, 0.4).add(K.P(0, 4.4, 0));
  K.sfx.whoosh?.();
  K.tw(0.22, (k) => { v.sy = K.lerp(0.82, 1, k); v.sx = v.sz = 1 / Math.sqrt(v.sy); v.tip = K.lerp(0.14, -0.24, k); v.lat = 0; });
  const big = meteor(bigFrom, top, { size, dur: 0.45 });
  await Promise.all([big.done, hold]);
  if (!K.live()) return;
  big.g.visible = true;
  const flat = 0.2 / hV, y0 = big.g.position.y;
  K.sfx.crack?.();
  await K.tw(0.1, (k) => { v.sy = K.lerp(1, flat, k); v.sx = v.sz = K.lerp(1, 1.5, k); v.tip = K.lerp(-0.24, 0, k); big.g.position.y = K.lerp(y0, 0.2 + size * 0.5, k); }, K.inQuad);
  if (!K.live()) return;
  // the meteor bursts on the pancake: rock and fire cubes, a big crater, the pancake shows
  big.g.visible = false;
  const hit = K.P(C.x, 0.25, C.z);
  K.flash(hit, 0.3, B ? 0xf0d8ff : 0xfff1d0, 0.16);
  K.bleed(hit, { count: 10, dir: K.up, spread: 1.0, speed: [1.8, 3.8], size: [0.07, 0.14], life: [0.6, 0.9], colors: ROCK, bounce: 0.3 });
  K.sparks(hit, 10, FIRE);
  for (let i = 0, c = K.n(6); i < c; i++) { const ang = (i / c) * K.TAU; ember(K, K.P(C.x + Math.cos(ang) * 0.35, 0.12, C.z + Math.sin(ang) * 0.35), 0.1, FIRE[i % FIRE.length], 0.4, 0.5); }
  K.dust(hit, 8);
  crater(K.P(C.x, 0, C.z), true);
  // arms come down and she turns back while the pancake holds a beat, then the red
  const down = K.tw(0.45, (k) => { R.arms(2.9 * (1 - k)); a.yaw = K.s.yawG + cs * 0.75 * (1 - k); a.y = 0.1 * (1 - k); a.tip = -0.06 * (1 - k); a.sy = 1.05 - 0.05 * k; a.sx = a.sz = 1 / Math.sqrt(a.sy); glow.set(1 - k); }, K.inOut);
  await K.tw(0.22, (k, t) => { v.sx = v.sz = 1.5 + 0.06 * Math.sin(t * 40) * (1 - t); });
  if (!K.live()) return;
  K.finale(K.P(C.x, 0.12, C.z), { dir: K.up, fall: false, flashSize: 0.18 });
  await Promise.all([down, K.tw(0.35, () => {})]);
  if (!K.live()) return;
  K.vanish();
  await Promise.all([K.back(-1.3, 0.45), K.tw(0.45, (k) => { for (const m of craters) { const [x, y, z] = m.userData.s; m.scale.set(Math.max(0.001, x * (1 - k)), y, Math.max(0.001, z * (1 - k))); } })]);
  for (const m of craters) m.visible = false;
  await K.kill.fall;
  await K.kill.done();
}

// ---------------------------------------------------------------------------------------------- queen-b: ice spell
// The queen spreads her arms, her hands glow icy blue in a frost puff; a wave of ice spikes runs over the board from her to the
// victim, tall at the front and settling behind. The victim throws its arms up and shivers, frost creeps up and a see through
// block of ice closes over it with the victim frozen inside. She raises one arm and snaps it down: cracks run over the block
// in steps, it trembles and bursts: the halves tip apart, ice shards of three sizes and red fly out in an arc, the spikes too.
async function iceSpell(ctx, K) {
  const { a, v, aim, C, hV } = K;
  const B = ctx.attackerColor === 'b';
  const R = queenRig(K);
  const glow = glowHands(K, R, B ? { core: 0xd8f4ff, halo: 0x2a6080, rim: 0x6fc8ff } : { core: 0xd8f4ff, halo: 0x2a6080 });
  const yaw = yawTo(aim);

  // the block is built once the victim is in its frozen pose (its arms are up), sized from its visible meshes
  let W, H, half, block, core, crystals, frost, cracks;
  const iceMat = K.fx.own(new THREE.MeshBasicMaterial({ color: ICE_TINT, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }));
  function build() {
    // the block size from the victim's visible meshes (in its own frame)
    const V = K.s.V.group, box3 = new THREE.Box3(), part = new THREE.Box3(), inv = new THREE.Matrix4(), mm = new THREE.Matrix4();
    V.updateWorldMatrix(true, true); inv.copy(V.matrixWorld).invert();
    V.traverseVisible((o) => { if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); part.copy(o.geometry.boundingBox).applyMatrix4(mm.multiplyMatrices(inv, o.matrixWorld)); box3.union(part); } });
    const ex = box3.isEmpty() ? 0.6 : Math.max(box3.max.x - box3.min.x, box3.max.z - box3.min.z) * V.scale.x;
    const tall = box3.isEmpty() ? hV : box3.max.y * V.scale.y;
    W = Math.min(1.45, Math.max(0.66, ex + 0.18)); H = Math.max(hV, tall) * 1.06 + 0.2; half = W / 2;

    // the see through block (normal blending on closed ground, no depth write) on the victim square, turned to the aim
    block = new THREE.Group();
    block.position.set(C.x, 0, C.z); block.rotation.y = yaw; K.fx.add(block);
    core = K.box(W, 1, W, ICE_TINT); core.material = iceMat; core.scale.set(W, 0.001, W); core.visible = false; block.add(core);
    // frost crystals on the four faces: they show when the frost line passes their height
    crystals = [];
    for (let i = 0, c = K.n(18); i < c; i++) {
      const f = i % 4, u = (K.rnd() - 0.5) * (W - 0.12), y = 0.06 + K.rnd() * (H - 0.16), sz = 0.06 + K.rnd() * 0.06;
      const out = half + sz * 0.2 + 0.006 + K.rnd() * 0.01;
      const m = K.box(1, 1, 1, ICE[(K.rnd() * 3) | 0], f === 0 ? out : f === 1 ? -out : u, y, f === 2 ? out : f === 3 ? -out : u);
      m.userData.sz = sz; m.userData.y = y; m.scale.setScalar(0.001);
      block.add(m); crystals.push(m);
    }
    frost = (line) => { for (const m of crystals) { const u = Math.min(1, Math.max(0, (line - m.userData.y) / 0.18)); m.scale.setScalar(Math.max(0.001, m.userData.sz * K.outBack(u))); } };
    // crack lines on the four faces: a zigzag of thin bars just off the face; neighbours sit in planes 0.0045 apart
    cracks = [];
    const zig = [[0.05, 0.98], [-0.12, 0.74], [0.1, 0.5], [-0.08, 0.27], [0.14, 0.05]];
    for (let f = 0; f < 4; f++) {
      const face = new THREE.Group(); face.rotation.y = f * Math.PI / 2; block.add(face);
      const sx = f % 2 ? -1 : 1;
      for (let i = 0; i < zig.length - 1; i++) {
        const [x0, y0] = zig[i], [x1, y1] = zig[i + 1];
        const p0 = K.P(sx * x0 * W, y0 * H, 0), p1 = K.P(sx * x1 * W, y1 * H, 0), len = p0.distanceTo(p1);
        const m = K.box(0.022, len + 0.02, 0.003, ICE_WHITE, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, -half - 0.006 - 0.0045 * (i % 2));
        m.rotation.z = Math.atan2(-(p1.x - p0.x), p1.y - p0.y); m.visible = false; m.userData.step = i;
        face.add(m); cracks.push(m);
      }
    }
  }
  const half0 = Math.min(0.72, Math.max(0.33, (K.vw === 0 ? 0.55 : 0.75) / 2 + 0.08));
  // the spikes: a wave from the queen's hands to the victim
  const AD = -1.65, NS = 8, d0 = AD + 0.42, d1 = Math.max(d0 + 0.5, -half0 - 0.04);
  const spikes = [];
  for (let i = 0; i < NS; i++) {
    const g = new THREE.Group(), h = 0.4 + 0.12 * K.rnd() + 0.02 * i, w = 0.11 + 0.012 * i;
    const p = K.at(K.lerp(d0, d1, i / (NS - 1)), 0, (i % 2 ? 1 : -1) * (0.05 + 0.04 * K.rnd()));
    g.position.set(p.x, 0.004, p.z); g.rotation.set(0.3, yaw + (K.rnd() - 0.5) * 0.4, 0, 'YXZ'); g.scale.set(1, 0.001, 1); g.visible = false;
    g.add(K.box(w, h, w, ICE[i % 3], 0, h / 2, 0));
    g.add(K.box(w * 0.55, w * 0.9, w * 0.55, ICE_WHITE, 0, h + w * 0.2, 0));
    g.userData.h = h; K.fx.add(g); spikes.push(g);
  }

  await K.stepBack(AD, 0.35);
  if (!K.live()) return;
  // wind up: arms out level, lean back, the hands glow icy blue in a frost puff
  K.sfx.magic?.();
  await K.tw(0.38, (k) => { R.arms(1.55 * k); a.tip = -0.14 * k; a.y = 0.06 * k; glow.set(k); }, K.inOut);
  if (!K.live()) return;
  for (const p of glow.hands()) K.bleed(p, { count: 6, dir: K.up, spread: 1.4, speed: [0.3, 0.9], size: [0.05, 0.09], life: [0.4, 0.6], colors: [...ICE, ICE_WHITE], gravity: -1 });
  // the cast: the arms sweep in, the wave runs: each spike shoots up tall when the front passes and settles behind it
  K.sfx.whoosh?.();
  const cast = K.tw(0.22, (k) => { R.arms(K.lerp(1.55, 0.95, k)); a.tip = K.lerp(-0.14, 0.12, k); a.y = 0.06 * (1 - k); }, K.outQuad);
  const puffed = new Set();
  const wave = K.tw(0.62, (k, t) => {
    const front = t * 1.25 * (NS - 1);
    spikes.forEach((g, i) => {
      const u = front - i;
      if (u < 0) return;
      g.visible = true;
      const s = u < 0.9 ? K.outBack(Math.min(1, u / 0.9)) * 1.25 : K.lerp(1.25, 0.75, Math.min(1, (u - 0.9) / 2.5));
      g.scale.set(1, Math.max(0.001, s), 1);
      if (!puffed.has(i) && K.live()) { puffed.add(i); K.bleed(K.P(g.position.x, 0.05, g.position.z), { count: 2, dir: K.up, spread: 1.0, speed: [0.8, 1.8], size: [0.04, 0.07], life: [0.4, 0.7], colors: ICE, gravity: -8 }); }
    });
  });
  // the victim: arms up and a shiver as the wave reaches it
  const vArmN = K.part(K.s.V, 'armN'), vArmP = K.part(K.s.V, 'armP');
  const shock = K.fx.wait(0.4).then(() => K.tw(0.22, (k) => { if (vArmN) vArmN.rotation.z = -2.5 * k; if (vArmP) vArmP.rotation.z = 2.5 * k; v.tip = -0.12 * k; v.y = 0.06 * K.bump(k); }, K.outQuad));
  await cast;
  await Promise.all([wave, shock]);
  if (!K.live()) return;

  // the freeze: frost climbs, then the block closes fast from the board up over the victim (frozen in its pose)
  build();
  let fs = 0;
  await K.tw(0.26, (k, t) => {
    frost(k * (H + 0.2)); v.lat = 0.03 * Math.sin(t * 70);
    if (K.live() && t * 0.26 >= fs && t < 1) { K.sparks(K.P(C.x, k * H, C.z).addScaledVector(aim, -half), 2, ICE); fs += 0.06; }
  });
  if (!K.live()) return;
  core.visible = true;
  K.sfx.slice?.();
  await K.tw(0.22, (k) => { const h = Math.max(0.001, H * k); core.scale.set(W, h, W); core.position.y = h / 2 + 0.004; v.lat = 0.02 * Math.sin(k * 40) * (1 - k); }, K.outQuad);
  if (!K.live()) return;
  v.lat = 0;
  // a glint runs over the front face while she raises one arm
  const glint = K.box(0.08, H * 0.7, 0.003, ICE_WHITE, 0, H * 0.5, -half - 0.03, { add: true });
  glint.rotation.z = 0.5; block.add(glint);
  const charge = K.tw(0.28, (k) => { if (R.armP) R.armP.rotation.z = K.lerp(0.95, 2.8, k); if (R.armN) R.armN.rotation.z = -K.lerp(0.95, 0.4, k); a.tip = K.lerp(0.12, -0.08, k); a.y = 0.1 * k; }, K.inOut);
  await K.tw(0.26, (k, t) => { glint.position.x = K.lerp(-half * 0.8, half * 0.8, k); glint.scale.set(0.08 * K.bump(t) + 0.001, H * 0.7, 0.003); glint.visible = t < 1; }, K.inOut);
  await charge;
  if (!K.live()) return;

  // the snap: the arm comes down, the cracks grow in steps, the block trembles
  K.sfx.whoosh?.();
  await K.tw(0.12, (k) => { if (R.armP) R.armP.rotation.z = K.lerp(2.8, 0.7, k); a.tip = K.lerp(-0.08, 0.14, k); a.y = 0.1 * (1 - k); }, K.inQuad);
  if (!K.live()) return;
  let step = -1;
  await K.tw(0.32, (k, t) => {
    const s = Math.min(3, Math.floor(t * 4.2));
    if (s !== step && t < 1) { step = s; if (K.live()) K.sfx.crack?.(); }
    for (const m of cracks) m.visible = m.userData.step <= s;
    block.position.set(C.x + 0.022 * Math.sin(t * 90) * t, 0, C.z + 0.018 * Math.cos(t * 77) * t);
  });
  if (!K.live()) return;

  // the burst: the block breaks into chunky ice cubes thrown away from the queen; shards of three sizes and red fly out in an arc
  K.sfx.shatter?.();
  block.visible = false;
  K.vanish();
  // chunky ice cubes from the whole block, thrown away from the queen
  for (let i = 0; i < 4; i++) K.bleed(K.P(C.x, H * (0.15 + 0.23 * i), C.z), { count: 3, dir: K.P(aim.x, 0.9, aim.z).normalize(), spread: 0.55, speed: [1.8, 3.4], size: [0.13, 0.2], life: [0.9, 1.3], colors: [...ICE, ICE_WHITE], gravity: -11, bounce: 0.3 });
  const arc = (count, size, speed) => { for (let i = 0, c = K.n(count); i < c; i++) { const ang = (i / c) * K.TAU + K.rnd() * 0.4; K.bleed(K.P(C.x, H * (0.25 + 0.5 * K.rnd()), C.z), { count: 1, dir: K.P(Math.cos(ang), 1.0 + K.rnd() * 0.5, Math.sin(ang)).normalize(), spread: 0.15, speed, size, life: [0.9, 1.4], colors: [...ICE, ICE_WHITE], gravity: -11, bounce: 0.3 }); } };
  arc(14, [0.05, 0.08], [2.6, 4.2]); arc(10, [0.09, 0.13], [2.2, 3.4]);
  K.finale(K.centre(0.5), { dir: K.up, fall: false, flashSize: 0.22 });
  for (const g of spikes) { const p = g.position; K.bleed(K.P(p.x, g.userData.h * 0.5, p.z), { count: 2, dir: K.up, spread: 0.9, speed: [1.2, 2.6], size: [0.05, 0.09], life: [0.6, 1.0], colors: ICE, gravity: -11 }); g.visible = false; }
  const armsDown = K.tw(0.3, (k) => { if (R.armP) R.armP.rotation.z = 0.7 * (1 - k); if (R.armN) R.armN.rotation.z = -0.4 * (1 - k); a.tip = 0.14 * (1 - k); glow.set(1 - k); });
  await armsDown;
  if (!K.live()) return;
  await K.back(AD, 0.45);
  await K.kill.fall;
  await K.kill.done();
}

// ---------------------------------------------------------------------------------------------- queen-c: whirlwind
// The queen raises her arms and circles her glowing hands: a tornado of cubes rises around the victim from the board up, lifts it
// and spins it high; then the funnel bursts and spits the victim out in a high arc, it crashes down beside the square in a splat.
async function whirlwind(ctx, K) {
  const { a, v, C, hV } = K;
  const B = ctx.attackerColor === 'b';
  const WIND = B ? [0xe4d6f2, 0xb89cd6, 0x8c70b0, 0xf2eaff] : [0xeef6ff, 0xc9dbe8, 0xa6bccc, 0xffffff];
  const R = queenRig(K);
  const glow = glowHands(K, R, B ? { core: 0xe0a0ff, halo: 0x6a2a90, rim: 0x9a4cff } : { core: 0xeef8ff, halo: 0x305070 });
  const TH = 2.2, lift = Math.max(0.45, Math.min(1.05, TH - hV * 1.05));

  // the funnel: rings of cubes orbiting, wider at the top; each ring shows when the growth line passes its height
  const T = new THREE.Group(); T.position.set(C.x, 0, C.z); K.fx.add(T);
  const rings = [];
  for (let r = 0; r < 7; r++) {
    // a band: flat cubes along most of the ring in one colour per ring (light and dark rings alternate), a gap breaks it
    const y = 0.08 + r * 0.31, rad = 0.2 + 0.03 * K.vw + r * 0.15, cubes = [], col = WIND[r % 2 ? 2 : (r % 4 === 0 ? 0 : 3)];
    for (let i = 0, c = K.n(6 + r); i < c; i++) {
      const sz = 0.07 + 0.012 * r, m = K.box(1, 1, 1, i % 5 === 4 ? WIND[1] : col);
      m.userData = { sz, a0: (i / c) * K.TAU * 0.8, dy: (K.rnd() - 0.5) * 0.04, dr: (K.rnd() - 0.5) * 0.04, len: (K.TAU * 0.8 * rad / c) * 0.85 };
      m.visible = false; T.add(m); cubes.push(m);
    }
    rings.push({ y, rad, w: 7 + r * 0.9, cubes });
  }
  let grow = 0, spin = 0, burst = 0, speed = 1, last = ctx.time();
  K.ctx.onFrame(() => {
    if (!K.live()) return;
    const now = ctx.time(); spin += speed * Math.max(0, now - last); last = now;
    T.position.x = C.x + 0.06 * Math.sin(spin * 3.1) * grow; T.position.z = C.z + 0.06 * Math.cos(spin * 2.3) * grow;
    for (const ring of rings) {
      const u = Math.min(1, Math.max(0, (grow * TH - ring.y) / 0.4));
      for (const m of ring.cubes) {
        const d = m.userData, s = d.sz * u * (1 - burst);
        m.visible = s > 0.002;
        const ang = d.a0 + spin * ring.w, rr = (ring.rad + d.dr) * (1 + 1.6 * burst) * (0.6 + 0.4 * u);
        m.position.set(Math.cos(ang) * rr, ring.y + d.dy + burst * 0.4, Math.sin(ang) * rr);
        m.rotation.set(0, -ang, 0); m.scale.set(Math.max(0.001, d.len * (rr / ring.rad) * u * (1 - burst)), Math.max(0.001, s * 0.8), Math.max(0.001, s * 0.8));
      }
    }
  });

  await K.stepBack(-1.45, 0.35);
  if (!K.live()) return;
  // arms up, the hands circle and glow, the wind starts at the victim's feet
  K.sfx.magic?.();
  await K.tw(0.35, (k) => { R.arms(2.3 * k); a.y = 0.08 * k; glow.set(k); grow = 0.2 * k; }, K.inOut);
  if (!K.live()) return;
  const wave = K.tw(1.7, (k, t) => { const w = Math.sin(t * 24); R.arms(2.3 + 0.35 * w, 2.3 - 0.35 * w); a.tip = 0.05 * Math.sin(t * 12); a.y = 0.08 + 0.02 * Math.sin(t * 12); });
  // the funnel rises around the victim, which shakes and starts to turn
  K.sfx.whoosh?.();
  K.dust(K.P(C.x, 0.05, C.z), 10);
  await K.tw(0.5, (k, t) => { grow = K.lerp(0.2, 1, k); speed = 1 + k; v.lat = 0.03 * Math.sin(t * 60); v.spin = 0.8 * k * k; v.tip = 0.08 * Math.sin(t * 20); }, K.outQuad);
  if (!K.live()) return;
  // sucked up: the victim rises, spins faster and faster and wobbles
  K.sfx.whoosh?.();
  const sp0 = v.spin;
  await K.tw(0.85, (k, t) => { v.y = lift * K.inOut(k); v.spin = sp0 + K.TAU * 4 * k * k; v.tip = 0.3 * Math.sin(t * 9) * k; v.lat = 0.05 * Math.sin(t * 13); speed = 2 + 1.5 * k; });
  if (!K.live()) return;
  // the spit: the funnel bursts outwards, the victim flies out in a high arc and crashes down beside the square
  K.sfx.crack?.();
  K.dust(K.P(C.x, lift + hV * 0.5, C.z), 10);
  K.sparks(K.P(C.x, lift + hV * 0.5, C.z), 10, WIND);
  K.tw(0.3, (k) => { burst = k; });
  const armsDown = wave.then(() => K.tw(0.3, (k) => { R.arms(2.3 * (1 - k)); a.y = 0.08 * (1 - k); a.tip = 0; glow.set(1 - k); }, K.inOut));
  // land just past the own square, on the side with more room (away from the nearest other piece)
  const others = (K.s.V.group.parent?.children || []).filter((g) => g !== K.s.V.group && g !== K.s.A.group && g.visible && g.userData?.height);
  const room = (lat) => { const p = K.at(0.55 - hV * 0.5, 0, lat); let best = 9; for (const g of others) best = Math.min(best, Math.hypot(g.position.x - p.x, g.position.z - p.z)); return best; };
  const off1 = 0.55, lat1 = room(0.7) >= room(-0.7) ? 0.7 : -0.7, sp1 = v.spin, tip0 = v.tip, y0 = v.y;
  await K.tw(0.5, (k) => { v.off = off1 * k; v.lat = lat1 * k; v.y = K.lerp(y0, 0, k) + 0.45 * K.bump(k); v.spin = sp1 + K.TAU * 1.5 * K.outQuad(k); v.tip = K.lerp(tip0, -Math.PI / 2, K.inQuad(k)); });
  if (!K.live()) return;
  // the crash: the splat where it lands, a bounce, then it lies still and goes out in a puff
  const land = K.at(off1 - hV * 0.35, 0.12, lat1);   // it lies back over its own square, away from the pieces beyond
  K.sfx.thud?.();
  K.finale(land, { dir: K.up, fall: false, ring: false, puddleAt: 0, flashSize: 0.2 });
  K.splash(K.P(land.x, 0.08, land.z), K.L.ring);
  K.dust(K.P(land.x, 0.05, land.z), 8);
  await K.tw(0.35, (k, t) => { v.tip = -Math.PI / 2 + 0.12 * Math.exp(-7 * t) * Math.abs(Math.sin(15 * t)); v.y = 0; });
  await armsDown;
  if (!K.live()) return;
  K.vanish();
  await K.back(-1.45, 0.45);
  await K.kill.fall;
  await K.kill.done();
}

export default [
  { id: 'queen-a', attacker: 'q', de: 'Meteorregen: die Königin reißt die Arme hoch, Meteore prasseln rund um den Gegner nieder, der dicke letzte macht ihn platt wie einen Pfannkuchen', still: 1.45, cam: { dist: 7.4, pitch: 16, yaw: 0 }, run: meteorShower },
  { id: 'queen-b', attacker: 'q', de: 'Eiszauber: eine Welle aus Eisspitzen rast zum Gegner, er friert im Eisblock ein und zerspringt mit dem Block in tausend Splitter', still: 2.84, cam: { dist: 6.4, pitch: 13, yaw: 0 }, run: iceSpell },
  { id: 'queen-c', attacker: 'q', de: 'Wirbelsturm: die Königin lässt einen Tornado aus Würfeln wirbeln, der saugt den Gegner hoch, dreht ihn wild und spuckt ihn im hohen Bogen aus', still: 1.85, cam: { dist: 8.0, pitch: 13, yaw: 0 }, run: whirlwind },
];
