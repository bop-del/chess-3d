// Capture scene of the Pixelwelt theme: gore in pixel style. The attacker plays the choreography of its classic Gore scene
// (pawn jabs a lance, knight hews, bishop and queen fire a bolt, rook topples, king smashes with a mace) with props built from
// boxes; blood is small red cubes (fx bodies) and the victim tips over. The setting picks the level: On is level 2 (about 24
// cubes, a ring splash, a puddle that grows and fades), Short is level 1 (about 9 cubes, a cube puff).
// Staging, time, skip and cleanup come from the director and ctx.fx, like every scene.
import * as THREE from 'three';
import { createStage, lerp, bump } from './kit-a.js';

const outQuad = (k) => 1 - (1 - k) * (1 - k);
const inQuad = (k) => k * k;
const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const TAU = Math.PI * 2;
const RED = [0xb31414, 0x8a0c0c, 0xd02020, 0x640808];
const LEVELS = [null,
  { hit: 9, ring: 0, puddle: 0, fount: 0 },
  { hit: 24, ring: 12, puddle: 12, fount: 1 }];

function seeded(seed = 7) { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }

async function gore(ctx) {
  const level = ctx.short ? 1 : 2, L = LEVELS[level];
  const s = createStage(ctx), sfx = ctx.sfx, { fx, a, v, aim, C, hV } = s;
  const type = ctx.attacker, vw = s.V.type === 'p' ? 0 : s.V.type === 'n' || s.V.type === 'b' ? 1 : 2;
  const rnd = seeded(level * 101 + (type.charCodeAt(0) | 0));
  const up = new THREE.Vector3(0, 1, 0);

  // the plank frame steps out of the low camera, as in the Blocks scene
  const frame = ctx.gimbal?.getObjectByName?.('pixel-world')?.userData.frame;
  if (frame) { ctx.signal.addEventListener('abort', () => frame(1), { once: true }); ctx.tween({ dur: 0.3, step: (e) => frame(1 - e) }); }

  // ---------------------------------------------------------------- voxel materials and blood
  const cube = fx.own(new THREE.BoxGeometry(1, 1, 1));
  const mats = new Map();
  const mat = (c, o = {}) => { const k = c + (o.add ? 'a' : ''); if (!mats.has(k)) mats.set(k, fx.own(new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...(o.add ? { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false } : {}) }))); return mats.get(k); };
  const box = (w, h, d, c, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(cube, mat(c, o)); m.scale.set(w, h, d); m.position.set(x, y, z); return m; };
  const dirIn = (d, spread) => new THREE.Vector3(d.x + (rnd() - 0.5) * 2 * spread, d.y + (rnd() - 0.5) * 2 * spread, d.z + (rnd() - 0.5) * 2 * spread).normalize();

  // red cubes thrown from a point: one fx body each, axis aligned, falling and fading like the cubes of the Blocks scene
  function bleed(point, { count, dir = up, spread = 0.9, speed = [1.2, 3.6], size = [0.035, 0.075], life = [1.2, 2.2], colors = RED, gravity = -13 } = {}) {
    for (let i = 0; i < count; i++) {
      const sz = size[0] + rnd() * (size[1] - size[0]);
      const m = box(sz, sz, sz, colors[(rnd() * colors.length) | 0]);
      m.position.copy(point);
      fx.add(m);
      const sp = speed[0] + rnd() * (speed[1] - speed[0]);
      fx.body(m, { radius: sz * 0.6, vel: dirIn(dir, spread).multiplyScalar(sp), bounce: 0.18, gravity, drag: 0.4, life: life[0] + rnd() * (life[1] - life[0]), fade: 0.35 });
    }
  }
  // dust and sparks as cubes too (no round sprites in the pixel world)
  const DUST = [0xd9d0bd, 0xc4baa5, 0xe8e0cf], SPARK = [0xffe9a6, 0xfff7d6, 0xffbf5a];
  const dust = (point, count = 8) => bleed(point, { count, dir: up, spread: 1.4, speed: [0.5, 1.4], size: [0.05, 0.1], life: [0.5, 0.9], colors: DUST, gravity: -4 });
  const sparks = (point, count = 10) => bleed(point, { count, dir: up, spread: 2.2, speed: [1.5, 3.5], size: [0.03, 0.05], life: [0.3, 0.6], colors: SPARK, gravity: -9 });
  // a bright cube that swells and goes out (the hit flash)
  function flash(point, size = 0.4) {
    const m = box(1, 1, 1, 0xfff1d0, point.x, point.y, point.z, { add: true });
    m.rotation.set(0.6, 0.7, 0); fx.add(m);
    return fx.tween(0.2, (k, t) => { m.scale.setScalar(Math.max(0.001, size * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)))); m.visible = t < 1; });
  }
  // a ring of cubes flung low and outwards (the splash)
  function splash(point, n, force = 1) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + rnd() * 0.3;
      const d = new THREE.Vector3(Math.cos(ang), 0.55 + rnd() * 0.4, Math.sin(ang));
      bleed(point, { count: 1, dir: d, spread: 0.12, speed: [1.6 * force, 3.2 * force], size: [0.05, 0.09] });
    }
  }
  // flat red tiles that grow into a puddle on the board
  function puddle(n, radius) {
    if (!n) return () => {};
    const tiles = [];
    for (let i = 0; i < n; i++) {
      const ang = rnd() * TAU, r = Math.sqrt(rnd()) * radius;
      const sz = 0.08 + rnd() * 0.06;
      const m = box(sz, 0.014, sz, RED[(rnd() * 3) | 0], C.x + Math.cos(ang) * r, 0.01 + rnd() * 0.004, C.z + Math.sin(ang) * r);
      m.userData.sz = sz; m.userData.at = r / radius; m.scale.set(0.001, 0.014, 0.001);
      fx.add(m); tiles.push(m);
    }
    return (k) => { for (const m of tiles) { const u = Math.min(1, Math.max(0, (k - m.userData.at * 0.7) / 0.3)); const z = m.userData.sz * u; m.scale.set(Math.max(0.001, z), 0.014, Math.max(0.001, z)); } };
  }

  // ---------------------------------------------------------------- the victim: tips over
  // the victim lies down toward the aim, stays a beat and goes out in a puff (the director shows it again for the flight to its tray)
  async function topple(lean0 = 0, dur = 0.55 + 0.25 * hV) {
    const off1 = v.off;
    await s.tw(dur, (k) => { v.tip = lerp(lean0, Math.PI / 2, inQuad(k)); v.off = off1 + 0.25 * k; v.lat = 0; });
    sfx.thud?.();
    dust(new THREE.Vector3(C.x + aim.x * (off1 + 0.45), 0.05, C.z + aim.z * (off1 + 0.45)), 8);
    await s.tw(0.4, (k, t) => { v.tip = Math.PI / 2 - 0.09 * Math.exp(-7 * t) * Math.abs(Math.sin(15 * t)); });
  }
  function vanish() { dust(new THREE.Vector3(C.x + aim.x * 0.6, 0.1, C.z + aim.z * 0.6), 10); v.on = false; s.V.group.visible = false; }

  // The killing blow: level dependent blood at `point`, then the victim goes down.
  let fall = Promise.resolve();
  let setPuddle = () => {}, puddleT = 0, puddleOut = -1;
  function finale(point, { dir = aim, tipFrom = 0, flatten = false } = {}) {
    sfx.splat?.();
    bleed(point, { count: L.hit, dir: new THREE.Vector3(dir.x, 0.5, dir.z).normalize(), spread: 0.8 });
    bleed(point, { count: Math.round(L.hit * 0.4), dir: up, spread: 0.5, speed: [1.5, 3.5] });
    if (L.ring) splash(new THREE.Vector3(C.x, 0.08, C.z), L.ring);
    if (L.puddle) { setPuddle = puddle(L.puddle, 0.32 + 0.12 * vw); puddleT = ctx.time(); }
    for (let i = 1; i <= L.fount; i++) fx.wait(0.12 * i).then(() => { if (s.live()) bleed(point, { count: 14, dir: up, spread: 0.35, speed: [2, 4.2] }); });
    flash(point);
    if (flatten) {
      fall = s.tw(0.12, (k) => { v.sy = 1 - 0.88 * k; v.sx = v.sz = 1 + 0.5 * k; }).then(() => s.tw(0.5, () => {})).then(() => { if (s.live()) vanish(); });
    } else fall = topple(tipFrom).then(() => s.tw(0.15, () => {})).then(() => { if (s.live()) vanish(); });
  }
  ctx.onFrame(() => { if (puddleT) setPuddle(puddleOut >= 0 ? Math.max(0, 1 - (ctx.time() - puddleOut) / 0.45) : Math.min(1, (ctx.time() - puddleT) / 0.5)); });

  // ---------------------------------------------------------------- props built from boxes (long axis +y, base at the origin)
  const vprop = (parts) => { const g = new THREE.Group(); for (const p of parts) g.add(box(...p)); return g; };
  const WOOD = 0x6b4426, STEEL = 0xd5dbe3, STEEL2 = 0x9aa3b0, GOLD = 0xf2c53a, BONE = 0xe8e4d2;
  const lance = () => vprop([[0.075, 1.1, 0.075, WOOD, 0, 0.55, 0], [0.11, 0.1, 0.11, GOLD, 0, 0.22, 0], [0.1, 0.26, 0.1, STEEL, 0, 1.23, 0], [0.055, 0.14, 0.055, STEEL, 0, 1.43, 0]]);
  const sword = () => vprop([[0.06, 0.8, 0.02, STEEL, 0, 0.5, 0], [0.03, 0.14, 0.03, STEEL2, 0, 0.93, 0], [0.26, 0.05, 0.05, GOLD, 0, 0.1, 0], [0.05, 0.18, 0.05, WOOD, 0, 0, 0]]);
  const staff = () => vprop([[0.05, 1.3, 0.05, WOOD, 0, 0.65, 0], [0.16, 0.16, 0.16, 0xfff0b0, 0, 1.38, 0, { add: true }], [0.1, 0.1, 0.1, GOLD, 0, 1.28, 0]]);
  const mace = () => vprop([[0.06, 0.85, 0.06, WOOD, 0, 0.42, 0], [0.26, 0.26, 0.26, 0x6a6f7a, 0, 0.98, 0], [0.34, 0.07, 0.07, STEEL2, 0, 0.98, 0], [0.07, 0.07, 0.34, STEEL2, 0, 0.98, 0], [0.07, 0.34, 0.07, STEEL2, 0, 0.98, 0]]);
  function hold(prop, { lift, side = 0, fwd = 0 }) {
    const hand = s.mount(lift), piv = new THREE.Group();
    piv.position.set(side, 0, fwd); piv.scale.setScalar(0.001);
    piv.add(prop); hand.add(piv);
    return piv;
  }
  const grow = (piv) => (k) => piv.scale.setScalar(Math.max(0.001, k));
  const ah = s.A.group.userData.height || 1.2;
  const bolt = (from, to, { dur = 0.22, w = 0.07, color = 0xfff2b0 } = {}) => {
    const m = box(1, 1, 1, color, 0, 0, 0, { add: true });
    const d = new THREE.Vector3().subVectors(to, from), len = Math.max(0.001, d.length());
    m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(up, d.clone().normalize()); m.frustumCulled = false;
    fx.add(m);
    return fx.tween(dur, (k, t) => { const x = w * (0.6 + 0.8 * Math.sin(Math.PI * t)); m.scale.set(x, len, x); m.visible = t < 1; });
  };
  const back = (from, to = -s.run0, dur = 0.4) => s.tw(dur, (k) => { a.d = lerp(from, to, k); a.y = 0; a.yaw = s.yawG * (1 - k); a.sy = 1; a.sx = a.sz = 1; a.tip = 0; }, inOut);
  const stepBack = (d = -1.05) => s.tw(0.35, (k) => { a.d = lerp(-s.run0, d, k); a.y = 0.3 * bump(k); a.yaw = s.yawG * k; }, inOut);

  // ---------------------------------------------------------------- the six attackers
  if (type === 'p') {
    const jabs = [1, 2, 3][vw], piv = hold(lance(), { lift: 0.4 * ah, fwd: 0.1 });
    piv.rotation.x = -Math.PI / 2 + 0.1; piv.position.y = 0;
    const hit = new THREE.Vector3(C.x - aim.x * 0.28, hV * 0.45, C.z - aim.z * 0.28);
    await Promise.all([stepBack(), s.tw(0.35, grow(piv), outQuad)]);
    await s.tw(0.3, (k) => { a.sy = 1 - 0.14 * k; a.sx = a.sz = 1 + 0.07 * k; piv.position.z = 0.1 + 0.1 * k; }, inOut);
    let lean = 0;
    for (let i = 0; i < jabs && s.live(); i++) {
      sfx.whoosh?.();
      await s.tw(0.12, (k) => { a.d = -1.05 + 0.22 * k; piv.position.z = 0.2 - 0.4 * k; a.sy = 0.86 + 0.28 * k; }, outQuad);
      if (i < jabs - 1) {
        sfx.splat?.();
        bleed(hit, { count: Math.round(L.hit * 0.6), dir: aim, spread: 0.9 });
        const l0 = lean, off0 = v.off;
        lean += 0.05 + 0.02 * i;
        const hurt = s.tw(0.3, (k, t) => { v.off = off0 + 0.07 * outQuad(Math.min(1, t * 3)); v.tip = lerp(l0, lean, outQuad(Math.min(1, t * 3))); v.lat = Math.sin(t * 30) * 0.03 * (1 - k); });
        await s.tw(0.22, (k) => { a.d = -0.83 - 0.22 * k; piv.position.z = -0.2 + 0.4 * k; a.sy = 1.14 - 0.14 * k; }, inOut);
        await hurt;
      } else finale(hit, { tipFrom: lean });
    }
    if (!s.live()) return;
    await Promise.all([back(-0.83, -s.run0, 0.5), s.tw(0.4, (k) => piv.scale.setScalar(Math.max(0.001, 1 - k))), fall]);
  } else if (type === 'n') {
    const piv = hold(sword(), { lift: 0.5 * ah });
    piv.rotation.x = 0.3;
    const hit = new THREE.Vector3(C.x - aim.x * 0.12, hV * (vw === 0 ? 0.68 : 0.56), C.z - aim.z * 0.12);
    await Promise.all([stepBack(), s.tw(0.35, grow(piv), outQuad)]);
    sfx.whoosh?.();
    await s.tw(0.45, (k) => { piv.rotation.x = lerp(0.3, 0.7, k); a.tip = -0.5 * k; a.sy = 1 + 0.05 * k; }, inOut);
    await s.tw(0.2, (k) => { piv.rotation.x = lerp(0.7, -1.9, k); a.tip = lerp(-0.5, 0.3, k); a.d = -1.05 + 0.28 * k; }, inQuad);
    if (!s.live()) return;
    sfx.slice?.();
    finale(hit, { dir: aim });
    await Promise.all([s.tw(0.35, (k) => { a.tip = lerp(0.3, 0.1, k); a.d = lerp(-0.77, -0.8, k); }, outQuad), s.tw(0.5, () => {})]);
    for (let i = 0; i < 2 && s.live(); i++) { bleed(hit, { count: 6, dir: up, spread: 0.5, speed: [0.8, 1.8] }); await s.tw(0.2, () => {}); }
    await Promise.all([s.tw(0.4, (k) => { a.d = lerp(-0.8, -s.run0, k); a.tip = lerp(0.1, 0, k); a.sy = 1; a.yaw = s.yawG * (1 - k); piv.scale.setScalar(Math.max(0.001, 1 - k)); }, inOut), fall]);
  } else if (type === 'b' || type === 'q') {
    const isQ = type === 'q', heart = s.centre(isQ ? 0.6 : 0.5);
    const piv = hold(staff(), { lift: 0, side: 0.34, fwd: -0.08 });
    const orb = box(0.3, 0.3, 0.3, 0xfff3d8, 0, 0, 0, { add: true }); orb.scale.setScalar(0.001);
    if (isQ) { fx.add(orb); piv.visible = false; } else piv.children[0].children[1].userData.orb = true;
    const orbPos = () => (isQ ? new THREE.Vector3(s.A.group.position.x, s.A.group.position.y + 1.05 * ah + 0.15, s.A.group.position.z) : s.where(piv.children[0].children[1]));
    await Promise.all([stepBack(), s.tw(0.35, grow(piv), outQuad)]);
    sfx.magic?.();
    if (isQ) await s.tw(0.6, (k) => { a.y = 0.14 * k; a.spin = TAU * k; orb.position.copy(orbPos()); orb.scale.setScalar(0.34 * k * (1 + 0.1 * Math.sin(k * 40))); }, inOut);
    else {
      const raise = s.tw(0.6, (k) => { piv.rotation.x = -0.12 * k; piv.position.y = 0.08 * k; a.y = 0.14 * k; }, inOut);
      sparks(orbPos(), 12);
      await raise;
      sfx.crack?.();
      await Promise.all([s.tw(0.45, (k) => { piv.rotation.x = lerp(-0.12, -1.12, inOut(k)); a.d = -1.05 + 0.1 * k; }), s.tw(0.45, (k) => { v.lat = Math.sin(k * 55) * 0.03 * k * k; v.tip = Math.sin(k * 41) * 0.03 * k; })]);
    }
    if (!s.live()) return;
    const from = orbPos();
    await bolt(from, heart, { dur: isQ ? 0.3 : 0.22, w: isQ ? 0.14 : 0.07 });
    if (!s.live()) return;
    v.lat = 0; v.tip = 0;
    finale(heart, { dir: up });
    await Promise.all([s.tw(0.9, (k) => { orb.scale.setScalar(Math.max(0.001, 0.34 * (1 - k))); a.y = 0.14 * (1 - outQuad(Math.min(1, k * 2))); if (!isQ) piv.rotation.x = lerp(-1.12, -0.12, inOut(Math.min(1, k * 1.5))); }), fall]);
    await s.tw(0.4, (k) => { a.d = lerp(isQ ? -1.05 : -0.95, -s.run0, k); a.y = 0; a.spin = 0; a.yaw = s.yawG * (1 - k); piv.scale.setScalar(Math.max(0.001, 1 - k)); }, inOut);
  } else if (type === 'r') {
    const hit = s.centre(0.25);
    await s.tw(0.5, (k) => { a.d = lerp(-s.run0, -1.7, k); a.yaw = s.yawG * k; }, inOut);
    sfx.whoosh?.();
    await s.tw(0.55, (k) => { a.tip = -0.5 * outQuad(k); a.sy = 1 + 0.22 * outQuad(k); a.d = lerp(-1.7, -1.45, k); }, inOut);
    await s.tw(0.36, (k) => { a.tip = lerp(-0.5, 1.4, inQuad(k)); a.sy = lerp(1.22, 1, k); a.d = lerp(-1.45, -0.85, k); }, (k) => k);
    if (!s.live()) return;
    sfx.thud?.();
    finale(hit, { dir: aim, flatten: true });
    await s.tw(0.6, (k) => { a.tip = 1.4 + 0.04 * Math.sin(k * 20) * (1 - k); });
    await Promise.all([s.tw(0.8, (k) => { a.tip = lerp(1.4, 0, outQuad(k)); a.d = lerp(-0.85, -s.run0, outQuad(k)); a.yaw = s.yawG * (1 - k); }), fall]);
  } else {
    const piv = hold(mace(), { lift: 0.55 * ah, side: 0.3, fwd: 0.1 });
    const swing = (ang) => { piv.rotation.x = -ang; };
    const hit = s.centre(0.5);
    swing(0.4);
    await Promise.all([stepBack(-0.95), s.tw(0.35, (k) => piv.scale.setScalar(Math.max(0.001, k * 1.2)), outQuad)]);
    await s.tw(0.45, (k) => { a.y = 0.4 * outQuad(k); a.sy = 1 + 0.12 * k; a.sx = a.sz = 1 - 0.05 * k; swing(lerp(0.4, -0.7, inOut(k))); }, inOut);
    sfx.whoosh?.();
    await s.tw(0.2, (k) => { swing(lerp(-0.7, 1.9, inQuad(k))); a.d = lerp(-0.95, -0.74, k); a.y = 0.4 * (1 - inQuad(k)); a.sy = 1.12 - 0.2 * k; }, (k) => k);
    if (!s.live()) return;
    sfx.crack?.();
    finale(hit, { dir: aim });
    sparks(hit, 12);
    await Promise.all([s.tw(0.4, (k) => { swing(1.9 + 0.05 * Math.sin(k * 30) * (1 - k)); a.d = lerp(-0.74, -0.8, k); }), s.tw(0.6, () => {})]);
    await Promise.all([s.tw(0.5, (k) => { swing(lerp(1.9, -0.35, inOut(k))); a.sy = 1; a.sx = a.sz = 1; a.d = lerp(-0.8, -0.95, k); }, inOut), fall]);
    await Promise.all([s.tw(0.4, (k) => { piv.scale.setScalar(Math.max(0.001, 1.2 * (1 - k))); a.d = lerp(-0.95, -s.run0, k); a.yaw = s.yawG * (1 - k); }, inOut)]);
  }
  if (L.puddle) { puddleOut = ctx.time(); await s.tw(0.45, () => {}); }
  frame?.(1);
}

const CAM = { p: { dist: 5.6, pitch: 13 }, n: { dist: 6.6, pitch: 13 }, b: { dist: 7.4, pitch: 12 }, r: { dist: 5.2, pitch: 12 }, q: { dist: 6.0, pitch: 12 }, k: { dist: 6.0, pitch: 12 } };

export default {
  attacker: '*',
  cam: { pitch: 13 },
  camFor: (type) => CAM[type],
  run(ctx) { return gore(ctx); },
};
