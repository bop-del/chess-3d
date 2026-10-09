// The kit of the Pixelwelt fight variants (CHE-371): what every variant needs on top of the stage of kit-a.js, lifted from
// pixel-gore.js so today's look stays one style. Flat unlit cubes only (MeshBasicMaterial, no textures to repeat), blood as
// red fx bodies, dust and sparks as cubes, the victim tips over or is flattened and goes out in a puff. The blood level
// follows the settings like pixel-gore: On is level 2, Short is level 1, Blood Off is level 0 (no red at all).
// lite is true at quality Low: variants should throw fewer cubes there (the kit already scales the counts it makes).
import * as THREE from 'three';
import { createStage, lerp, bump } from '../kit-a.js';

export { lerp, bump };
export const outQuad = (k) => 1 - (1 - k) * (1 - k);
export const inQuad = (k) => k * k;
export const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const outBack = (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
export const TAU = Math.PI * 2;
export const RED = [0xb31414, 0x8a0c0c, 0xd02020, 0x640808];
export const DUST = [0xd9d0bd, 0xc4baa5, 0xe8e0cf];
export const SPARK = [0xffe9a6, 0xfff7d6, 0xffbf5a];
export const WOOD = 0x6b4426, STEEL = 0xd5dbe3, STEEL2 = 0x9aa3b0, GOLD = 0xf2c53a, BONE = 0xe8e4d2;
const LEVELS = [{ hit: 0, ring: 0, puddle: 0, fount: 0 },
  { hit: 9, ring: 0, puddle: 0, fount: 0 },
  { hit: 24, ring: 12, puddle: 12, fount: 1 }];

export function seeded(seed = 7) { let x = Math.max(1, seed | 0); return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }

/** Everything a variant needs, made once per run. seed makes the cube spray of a variant its own (and stable). */
export function pixKit(ctx, { seed = 1 } = {}) {
  const level = ctx.gore === false ? 0 : ctx.short ? 1 : 2, L = LEVELS[level];
  const lite = ctx.stage?.quality === 'low';
  const s = createStage(ctx), sfx = ctx.sfx, { fx, a, v, aim, side, C, hV } = s;
  const vw = s.V.type === 'p' ? 0 : s.V.type === 'n' || s.V.type === 'b' ? 1 : 2;
  const rnd = seeded(level * 101 + seed * 7919 + (ctx.attacker.charCodeAt(0) | 0));
  const up = new THREE.Vector3(0, 1, 0);
  const n = (count) => (lite ? Math.ceil(count * 0.6) : count);

  // ---------------------------------------------------------------- voxel materials
  const cube = fx.own(new THREE.BoxGeometry(1, 1, 1));
  const mats = new Map();
  const mat = (c, o = {}) => { const k = c + (o.add ? 'a' : ''); if (!mats.has(k)) mats.set(k, fx.own(new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...(o.add ? { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false } : {}) }))); return mats.get(k); };
  const box = (w, h, d, c, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(cube, mat(c, o)); m.scale.set(w, h, d); m.position.set(x, y, z); return m; };
  const dirIn = (d, spread) => new THREE.Vector3(d.x + (rnd() - 0.5) * 2 * spread, d.y + (rnd() - 0.5) * 2 * spread, d.z + (rnd() - 0.5) * 2 * spread).normalize();

  // ---------------------------------------------------------------- cubes thrown from a point (blood, dust, sparks, debris)
  function bleed(point, { count, dir = up, spread = 0.9, speed = [1.2, 3.6], size = [0.035, 0.075], life = [1.2, 2.2], colors = RED, gravity = -13, bounce = 0.18 } = {}) {
    if (colors === RED && !L.hit) return;
    for (let i = 0, c = n(count); i < c; i++) {
      const sz = size[0] + rnd() * (size[1] - size[0]);
      const m = box(sz, sz, sz, colors[(rnd() * colors.length) | 0]);
      m.position.copy(point);
      fx.add(m);
      const sp = speed[0] + rnd() * (speed[1] - speed[0]);
      fx.body(m, { radius: sz * 0.6, vel: dirIn(dir, spread).multiplyScalar(sp), bounce, gravity, drag: 0.4, life: life[0] + rnd() * (life[1] - life[0]), fade: 0.35 });
    }
  }
  const dust = (point, count = 8) => bleed(point, { count, dir: up, spread: 1.4, speed: [0.5, 1.4], size: [0.05, 0.1], life: [0.5, 0.9], colors: DUST, gravity: -4 });
  const sparks = (point, count = 10, colors = SPARK) => bleed(point, { count, dir: up, spread: 2.2, speed: [1.5, 3.5], size: [0.03, 0.05], life: [0.3, 0.6], colors, gravity: -9 });
  // a bright cube that swells and goes out (the hit flash)
  function flash(point, size = 0.4, color = 0xfff1d0, dur = 0.2) {
    const m = box(1, 1, 1, color, point.x, point.y, point.z, { add: true });
    m.rotation.set(0.6, 0.7, 0); m.scale.setScalar(0.001); fx.add(m);        // tiny until the first tween step (a still on the hit frame showed it at full size)
    return fx.tween(dur, (k, t) => { m.scale.setScalar(Math.max(0.001, size * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)))); m.visible = t < 1; });
  }
  // a ring of cubes flung low and outwards (the splash)
  function splash(point, count, force = 1, colors = RED) {
    for (let i = 0, c = n(count); i < c; i++) {
      const ang = (i / c) * TAU + rnd() * 0.3;
      const d = new THREE.Vector3(Math.cos(ang), 0.55 + rnd() * 0.4, Math.sin(ang));
      bleed(point, { count: 1, dir: d, spread: 0.12, speed: [1.6 * force, 3.2 * force], size: [0.05, 0.09], colors });
    }
  }
  // flat red tiles that grow into a puddle on the board: returns set(k), 0 to 1 grows, back to 0 shrinks. The tiles stand at
  // slightly different heights so no two overlap in one plane.
  function puddle(count, radius) {
    if (!count) return () => {};
    const tiles = [];
    for (let i = 0; i < count; i++) {
      const ang = rnd() * TAU, r = Math.sqrt(rnd()) * radius;
      const sz = 0.08 + rnd() * 0.06;
      const m = box(sz, 0.014, sz, RED[(rnd() * 3) | 0], C.x + Math.cos(ang) * r, 0.01 + i * 0.0007, C.z + Math.sin(ang) * r);
      m.userData.sz = sz; m.userData.at = r / radius; m.scale.set(0.001, 0.014, 0.001);
      fx.add(m); tiles.push(m);
    }
    return (k) => { for (const m of tiles) { const u = Math.min(1, Math.max(0, (k - m.userData.at * 0.7) / 0.3)); const z = m.userData.sz * u; m.scale.set(Math.max(0.001, z), 0.014, Math.max(0.001, z)); } };
  }

  // ---------------------------------------------------------------- the victim goes down
  async function topple(lean0 = 0, dur = 0.55 + 0.25 * vw) {
    const off1 = v.off;
    await s.tw(dur, (k) => { v.tip = lerp(lean0, Math.PI / 2, inQuad(k)); v.off = off1 + 0.25 * k; v.lat = 0; });
    sfx.thud?.();
    dust(new THREE.Vector3(C.x + aim.x * (off1 + 0.45), 0.05, C.z + aim.z * (off1 + 0.45)), 8);
    await s.tw(0.4, (k, t) => { v.tip = Math.PI / 2 - 0.09 * Math.exp(-7 * t) * Math.abs(Math.sin(15 * t)); });
  }
  function vanish() { dust(new THREE.Vector3(C.x + aim.x * (0.6 + v.off), 0.1 + v.y, C.z + aim.z * (0.6 + v.off)), 10); v.on = false; s.V.group.visible = false; }

  // The killing blow: level dependent blood at point, a flash, then the victim goes down (topple, flatten, or none when the
  // variant takes the victim away itself). kill.fall is the promise of the fall; kill.done() fades the puddle (await it last).
  const kill = { fall: Promise.resolve() };
  let setPuddle = () => {}, puddleT = 0, puddleOut = -1;
  function finale(point, { dir = aim, tipFrom = 0, flatten = false, fall = true, ring = true, puddleAt = 1, flashSize = 0.26 } = {}) {
    sfx.splat?.();
    bleed(point, { count: L.hit, dir: new THREE.Vector3(dir.x, 0.5, dir.z).normalize(), spread: 0.8 });
    bleed(point, { count: Math.round(L.hit * 0.4), dir: up, spread: 0.5, speed: [1.5, 3.5] });
    if (L.ring && ring) splash(new THREE.Vector3(C.x, 0.08, C.z), L.ring);
    if (L.puddle && puddleAt) { setPuddle = puddle(n(L.puddle), (0.32 + 0.12 * vw) * puddleAt); puddleT = ctx.time(); }
    for (let i = 1; i <= L.fount; i++) fx.wait(0.12 * i).then(() => { if (s.live()) bleed(point, { count: 14, dir: up, spread: 0.35, speed: [2, 4.2] }); });
    if (flashSize) flash(point, flashSize, 0xfff1d0, 0.13);        // small and short: the hit itself stays visible (critic round 1)
    if (!fall) return kill.fall;
    if (flatten) kill.fall = s.tw(0.12, (k) => { v.sy = 1 - 0.88 * k; v.sx = v.sz = 1 + 0.5 * k; }).then(() => s.tw(0.5, () => {})).then(() => { if (s.live()) vanish(); });
    else kill.fall = topple(tipFrom).then(() => s.tw(0.15, () => {})).then(() => { if (s.live()) vanish(); });
    return kill.fall;
  }
  ctx.onFrame(() => { if (puddleT) setPuddle(puddleOut >= 0 ? Math.max(0, 1 - (ctx.time() - puddleOut) / 0.45) : Math.min(1, (ctx.time() - puddleT) / 0.5)); });
  kill.done = async () => { if (puddleT) { puddleOut = ctx.time(); await s.tw(0.45, () => {}); } };

  // ---------------------------------------------------------------- props built from boxes (long axis +y, base at the origin)
  const vprop = (parts) => { const g = new THREE.Group(); for (const p of parts) g.add(box(...p)); return g; };
  const props = {
    sword: () => vprop([[0.06, 0.8, 0.02, STEEL, 0, 0.5, 0], [0.03, 0.14, 0.03, STEEL2, 0, 0.93, 0], [0.26, 0.05, 0.05, GOLD, 0, 0.1, 0], [0.05, 0.18, 0.05, WOOD, 0, 0, 0]]),
    staff: () => vprop([[0.05, 1.3, 0.05, WOOD, 0, 0.65, 0], [0.16, 0.16, 0.16, 0xfff0b0, 0, 1.38, 0, { add: true }], [0.1, 0.1, 0.1, GOLD, 0, 1.28, 0]]),
    mace: () => vprop([[0.06, 0.85, 0.06, WOOD, 0, 0.42, 0], [0.26, 0.26, 0.26, 0x6a6f7a, 0, 0.98, 0], [0.34, 0.07, 0.07, STEEL2, 0, 0.98, 0], [0.07, 0.07, 0.34, STEEL2, 0, 0.98, 0], [0.07, 0.34, 0.07, STEEL2, 0, 0.98, 0]]),
  };
  // a prop in the attacker's hand: a pivot that follows the attacker; it starts tiny, grow(piv) brings it in
  function hold(prop, { lift = 0, side: sx = 0, fwd = 0 } = {}) {
    const hand = s.mount(lift), piv = new THREE.Group();
    piv.position.set(sx, 0, fwd); piv.scale.setScalar(0.001);
    piv.add(prop); hand.add(piv);
    return piv;
  }
  const grow = (piv, to = 1) => (k) => piv.scale.setScalar(Math.max(0.001, k * to));
  const ah = s.A.group.userData.height || 1.2;
  // a lit bar between two points that flares and goes out
  const bolt = (from, to, { dur = 0.22, w = 0.07, color = 0xfff2b0 } = {}) => {
    const m = box(1, 1, 1, color, 0, 0, 0, { add: true });
    const d = new THREE.Vector3().subVectors(to, from), len = Math.max(0.001, d.length());
    m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(up, d.clone().normalize()); m.frustumCulled = false;
    fx.add(m);
    return fx.tween(dur, (k, t) => { const x = w * (0.6 + 0.8 * Math.sin(Math.PI * t)); m.scale.set(x, len, x); m.visible = t < 1; });
  };
  // the attacker walks back to its stand point (where the director lets it step onto the square)
  const back = (from = a.d, dur = 0.4) => s.tw(dur, (k) => { a.d = lerp(from, -s.run0, k); a.y = 0; a.yaw = s.yawG * (1 - k); a.sy = 1; a.sx = a.sz = 1; a.tip = 0; a.spin = 0; }, inOut);
  const stepBack = (d = -1.05, dur = 0.35) => s.tw(dur, (k) => { a.d = lerp(-s.run0, d, k); a.y = 0.3 * bump(k); a.yaw = s.yawG * k; }, inOut);
  // a rig part of a piece (head, body, armN, armP, legN, legP, rider, ...), or null; the director puts every part back
  const part = (piece, name) => piece.group.getObjectByName('rig')?.getObjectByName(name) || null;
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const at = (d, y = 0, lat = 0) => new THREE.Vector3(C.x + aim.x * d + side.x * lat, y, C.z + aim.z * d + side.z * lat);

  return {
    ctx, s, fx, sfx, a, v, aim, side, C, hV, vw, ah, level, L, lite, rnd, up, n,
    mat, box, bleed, dust, sparks, flash, splash, puddle, topple, vanish, finale, kill,
    vprop, props, hold, grow, bolt, back, stepBack, part, P, at,
    lerp, bump, outQuad, inQuad, inOut, outBack, TAU,
    tw: s.tw, live: s.live, centre: s.centre, where: s.where, mount: s.mount,
  };
}
