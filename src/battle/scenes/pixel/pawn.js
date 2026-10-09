// Pixelwelt fight variants of the pawn (CHE-371). See fights.js for the module shape. Today's pawn (pixel-gore.js) runs up and
// thrusts a spear; these two keep the pixel gore look but make the small pawn do something big: a slingshot volley from far
// back that ends with a boulder, and a frog leap high over the board that lands on the victim and flattens it.
import * as THREE from 'three';
import { DUST } from './kit.js';

const STONE = 0x8d8f96, STONE2 = 0x6c6e76, STONE3 = 0xb4b6bc, POUCH = 0x3a2416, SHADOW = 0x23232c;
const STARS = [0xffe14a, 0xfff7d6, 0xffbf5a], WHITE = [0xffffff, 0xf2f2f2, 0xe2e2e2];

// a puff of dust cubes that rises, swells and is gone in about 0.3 s (nothing settles on the board)
function puff(K, point, count = 8, dur = 0.32) {
  const cubes = [];
  for (let i = 0, c = K.n(count); i < c; i++) {
    const ang = (i / c) * K.TAU + K.rnd() * 0.5, r = 0.08 + K.rnd() * 0.12, sz = 0.07 + K.rnd() * 0.05;
    const m = K.box(sz, sz, sz, DUST[i % DUST.length], point.x + Math.cos(ang) * r, point.y + 0.03 + i * 0.004, point.z + Math.sin(ang) * r);
    m.userData.a = ang; m.userData.sz = sz; m.userData.p = m.position.clone();
    K.fx.add(m); cubes.push(m);
  }
  return K.tw(dur, (k, t) => {
    for (const m of cubes) {
      const { a, sz, p } = m.userData;
      m.position.set(p.x + Math.cos(a) * 0.22 * k, p.y + 0.4 * k, p.z + Math.sin(a) * 0.22 * k);
      m.scale.setScalar(Math.max(0.001, sz * (1 + 0.8 * k) * (1 - t * t)));
      if (t >= 1) K.fx.remove(m);
    }
  }, K.outQuad);
}

// Slingshot: the pawn backs off far, a big dark wooden Y fork held upright in front, the band pulled back level to the chin.
// Two big pebbles with a trail bonk the victim on the head (each one a flinch, the second bigger), then a lumpy boulder wider
// than the pawn pops into the pouch at the fork, the pawn sags and leans back under it and lets fly: the boulder hits the
// chest, the victim goes over backwards, the boulder bounces up and over and rolls away behind it. A victory hop with the
// slingshot raised.
const sling = {
  id: 'pawn-a', attacker: 'p', still: 2.72, noTurn: true,
  de: 'Steinschleuder: der Bauer schießt zwei Kiesel an den Kopf, dann einen riesigen Felsbrocken, der den Gegner umhaut',
  cam: { dist: 7.4, pitch: 12, yaw: 10 },
  async run(ctx, K) {
    const { a, v, s, box, fx, sfx, lerp, bump, outQuad, inOut, rnd } = K;
    const black = K.ctx.attackerColor === 'b';
    const band = K.level > 0 ? 0xe0262a : 0xff8a1a;              // a bright band (orange with Blood Off: no red at all)
    const wood = black ? 0xa0703c : 0x4a2a14, wood2 = black ? 0x8a5a2e : 0x5e3518;
    // a lumpy boulder: three offset boxes in two stone greys, no two faces in one plane
    const lumpy = (z) => {
      const g = new THREE.Group();
      g.add(box(z, z * 0.85, z * 0.9, STONE), box(z * 0.8, z * 0.8, z * 0.75, STONE2, z * 0.18, z * 0.2, -z * 0.1), box(z * 0.7, z * 0.7, z * 0.8, STONE2, -z * 0.2, -z * 0.12, z * 0.12));
      g.rotation.set(0.3, 0.5, 0.15);
      return g;
    };

    // the fork, upright (prongs up), thick enough to read as a Y on a phone; the band runs from the prong tips to the pouch
    const fork = new THREE.Group();
    fork.add(box(0.1, 0.26, 0.09, wood, 0, 0.13, 0));
    fork.add(box(0.5, 0.09, 0.1, wood2, 0, 0.29, 0));
    for (const x of [-1, 1]) { const p = box(0.09, 0.28, 0.085, wood, x * 0.2, 0.43, 0); p.rotation.z = -x * 0.3; fork.add(p); }   // the prongs spread into a V
    const bands = [box(1, 1, 1, band), box(1, 1, 1, band)];
    const pouch = box(0.13, 0.08, 0.06, POUCH);
    const pebble = box(0.16, 0.16, 0.16, STONE);
    const BOULDER = 0.52;                                         // in fork units: about 0.68 on the board, wider than the pawn
    const boulder = lumpy(BOULDER);
    fork.add(...bands, pouch, pebble, boulder);
    pebble.visible = false; boulder.visible = false; boulder.scale.setScalar(0.001);
    const piv = K.hold(fork);
    const SC = 1.3, TIP = 0.52;                                   // TIP: the height of the prong tips in fork units
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
    // pull: how far the pouch is drawn back towards the pawn (fork local +z), level with the prong tips
    const setPull = (pull) => {
      const pz = 0.02 + pull;
      pouch.position.set(0, TIP - 0.04, pz);
      pebble.position.set(0, TIP - 0.04, pz - 0.1);
      boulder.position.set(0, TIP - 0.04, pz + BOULDER * 0.5);   // behind the pouch, so the prongs never cut it
      bands.forEach((m, i) => {
        _a.set(i ? 0.24 : -0.24, TIP - 0.04, 0); _b.set(i ? 0.06 : -0.06, TIP - 0.04, pz);
        _d.subVectors(_b, _a); const len = _d.length();
        m.position.copy(_a).addScaledVector(_d, 0.5);
        m.quaternion.setFromUnitVectors(K.up, _d.normalize());
        m.scale.set(0.055, len, 0.05);
      });
    };
    setPull(0);
    // the fork stays at the hands when the pawn leans, squashes or hops: the hand point turns with the pawn's tip
    const hand = { f: 0.3, h: 0.48 }, extra = { f: 0, h: 0 };
    ctx.onFrame(() => {
      const f = (hand.f + extra.f) * a.sz, h = (hand.h + extra.h) * a.sy, c = Math.cos(a.tip), sn = Math.sin(a.tip);
      piv.position.set(0, -f * sn + h * c, -(f * c + h * sn));
      piv.rotation.x = -a.tip * 0.5;
    });

    const head = () => K.at(-0.1 - 0.1 * K.vw, K.hV * 0.82);
    const chest = () => K.at(-(0.3 + 0.06 * K.vw) - 0.24, Math.max(0.36, K.hV * 0.5));
    // one pebble with a short trail of smaller, paler cubes: it leaves the pouch and flies to the head
    const shoot = async () => {
      const from = s.where(pebble), to = head();
      pebble.visible = false;
      const m = box(0.2, 0.2, 0.2, STONE);
      const trail = [0.15, 0.11, 0.07].map((z, i) => box(z, z, z, i ? STONE3 : STONE2));
      fx.add(m); m.position.copy(from);
      for (const t of trail) { fx.add(t); t.position.copy(from); }
      sfx.whoosh?.();
      const at = (k, o) => o.position.lerpVectors(from, to, Math.max(0, k)).setY(lerp(from.y, to.y, Math.max(0, k)) + 0.08 * bump(Math.max(0, k)));
      await K.tw(0.16, (k) => { at(k, m); m.rotation.set(k * 7, k * 5, 0); trail.forEach((t, i) => { at(k - 0.14 * (i + 1), t); t.visible = k > 0.1 * (i + 1); }); });
      for (const t of trail) fx.remove(t);
      return m;
    };
    // a bonk: the head snaps back, a burst of white cubes and stars, a wobble; the pebble drops away
    const bonk = (m, big) => {
      const p = head();
      sfx.crack?.();
      K.flash(p, big ? 0.3 : 0.22, 0xfff4c0);
      K.bleed(p, { count: big ? 10 : 6, dir: K.P(-K.aim.x, 0.8, -K.aim.z), spread: 0.9, speed: [1.2, 2.6], size: [0.04, 0.07], life: [0.35, 0.6], colors: WHITE, gravity: -8 });
      K.sparks(p, big ? 8 : 5, STARS);
      if (big) K.bleed(p, { count: 4, dir: K.P(K.aim.x, 0.6, K.aim.z), spread: 0.6, speed: [0.8, 2] });
      fx.body(m, { radius: 0.1, vel: K.P(-K.aim.x * 1.4 + K.side.x * (rnd() - 0.5), 2.2, -K.aim.z * 1.4 + K.side.z * (rnd() - 0.5)), ang: K.P(6, 2, 0), bounce: 0.35, gravity: -12, life: 0.6, fade: 0.25 });
      const amp = big ? 0.3 : 0.17;
      return K.tw(big ? 0.45 : 0.35, (k, t) => {
        const snap = Math.min(1, t / 0.08);
        v.tip = amp * snap * Math.exp(-4.5 * t) * Math.cos(t * 15);
        v.lat = Math.sin(t * 34) * (big ? 0.05 : 0.03) * (1 - t);
        v.sy = 1 - (big ? 0.12 : 0.07) * bump(Math.min(1, t * 3)); v.sx = v.sz = 1 / Math.sqrt(v.sy);
      });
    };
    const draw = (dur, pull, d1, sy) => { const d0 = a.d, sy0 = a.sy, p0 = pouch.position.z - 0.02; return K.tw(dur, (k) => { setPull(lerp(p0, pull, k)); a.d = lerp(d0, d1, k); a.sy = lerp(sy0, sy, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); }, inOut); };
    const loose = (dur = 0.07) => { const p0 = pouch.position.z - 0.02, sy0 = a.sy, d0 = a.d, t0 = a.tip; return K.tw(dur, (k) => { setPull(p0 * (1 - k) - 0.06 * bump(k)); a.sy = lerp(sy0, 1.04, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); a.d = d0 + 0.06 * k; a.tip = lerp(t0, 0.05, k); }, outQuad); };

    await Promise.all([K.stepBack(-1.8, 0.4), K.tw(0.35, K.grow(piv, SC), K.outBack)]);
    // two pebbles, each pulled back to the chin
    for (let i = 0; i < 2 && K.live(); i++) {
      pebble.visible = true;
      await draw(i ? 0.18 : 0.26, 0.24, -1.85, 0.95);
      if (!K.live()) return;
      const fly = shoot();
      await loose();
      const m = await fly;
      if (!K.live()) return;
      bonk(m, i === 1);
      await K.tw(i ? 0.18 : 0.12, (k) => { a.tip = lerp(0.05, 0, k); });
    }
    if (!K.live()) return;
    // the boulder: the arms go out, it pops into the pouch at the fork, then the pawn draws it back, sagging and leaning back
    sfx.whoosh?.();
    boulder.visible = true;
    await K.tw(0.22, (k) => { extra.f = 0.45 * outQuad(k); boulder.scale.setScalar(Math.max(0.001, K.outBack(k))); setPull(0.06 * k); });
    await K.tw(0.5, (k, t) => {
      setPull(lerp(0.06, 0.13, inOut(k)));
      a.tip = -0.24 * inOut(k); a.sy = lerp(1, 0.8, inOut(k)); a.sx = a.sz = 1 / Math.sqrt(a.sy); a.d = lerp(-1.8, -1.92, k);
      piv.rotation.z = Math.sin(t * 70) * 0.035 * k;
      v.tip = -0.08 * k; v.lat = Math.sin(t * 50) * 0.02 * k;      // the victim sees it coming
    });
    if (!K.live()) return;
    piv.rotation.z = 0;
    // the shot: the boulder flies level into the chest
    const from = s.where(boulder), to = chest(), size = BOULDER * SC;
    boulder.visible = false;
    const rock = lumpy(size);
    fx.add(rock); rock.position.copy(from);
    sfx.whoosh?.();
    const t0 = a.tip, sy0 = a.sy;
    await K.tw(0.2, (k) => {
      rock.position.lerpVectors(from, to, k); rock.rotation.set(0.3 - k * 4, 0.5, 0.15 + k * 1.5); extra.f = 0.45 * (1 - outQuad(k));
      setPull(0.13 * (1 - Math.min(1, k * 3))); a.tip = lerp(t0, 0.06, Math.min(1, k * 2)); a.sy = lerp(sy0, 1.05, Math.min(1, k * 2)); a.sx = a.sz = 1 / Math.sqrt(a.sy);
    });
    if (!K.live()) return;
    // impact at the chest: the victim is thrown back and topples, the boulder rebounds up and over and rolls away behind it
    sfx.thud?.();
    K.sparks(to, 10, STARS);
    K.dust(to, 6);
    const off0 = v.off;
    K.finale(to, { tipFrom: 0.5 });
    const knock = K.tw(0.1, (k) => { v.off = off0 + 0.32 * outQuad(k); v.tip = lerp(-0.08, 0.5, outQuad(k)); v.lat = 0; v.sy = 1; v.sx = v.sz = 1; });
    const r0 = rock.position.clone();
    await K.tw(0.06, (k) => { rock.position.copy(r0).addScaledVector(K.aim, 0.2 * k); });
    fx.body(rock, { radius: size * 0.5, vel: K.P(K.aim.x * 2.3, 4.6, K.aim.z * 2.3), ang: K.P(K.side.x * 7, 0, K.side.z * 7), bounce: 0.35, gravity: -12, drag: 0.3, life: 1.5, fade: 0.3 });
    await knock;
    // victory: the slingshot goes up over the head, a little hop
    const f0 = extra.f;
    await K.tw(0.5, (k, t) => {
      a.d = lerp(-1.92, -1.8, k); a.y = 0.38 * bump(t); a.tip = lerp(0.06, 0, k); a.sy = lerp(1.05, 1, k); a.sx = a.sz = 1 / Math.sqrt(a.sy);
      const u = outQuad(Math.min(1, t * 2));
      extra.h = 0.5 * u; extra.f = lerp(f0, -0.35, u);
    });
    await K.tw(0.25, (k) => piv.scale.setScalar(Math.max(0.001, SC * (1 - k))), K.inQuad);
    await K.back(-1.8, 0.5);
    await K.kill.fall;
    await K.kill.done();
  },
};

// Frog leap: the pawn squats wide and flat like a frog, springs high with a tucked forward flip (knees
// out), its shadow grows on the board while the victim looks up and trembles, and it stomps down: the victim is squashed
// into a wide pancake (its head a flat lump on top), a rim of cubes sprays from the edges, the pancake springs like a trampoline for
// up to three ever lower bounces, the pawn hops off and the pancake stays until the pawn is home.
const stomp = {
  id: 'pawn-b', attacker: 'p', still: 1.9, noTurn: true,
  de: 'Froschsprung: der Bauer springt hoch in die Luft und landet mit voller Wucht auf dem Gegner, der wird platt wie ein Pfannkuchen',
  cam: { dist: 7.2, pitch: 16, yaw: 10 },
  async run(ctx, K) {
    const { a, v, fx, sfx, lerp, bump, outQuad, inQuad, inOut, TAU, C, hV } = K;
    const H = Math.min(hV + 0.6, 1.8);                           // the top of the leap above the board
    const legs = [K.part(K.s.A, 'legN'), K.part(K.s.A, 'legP')];
    // the frog pose: knees up in front (seen from the side) and a little out; kept every frame so the walk swing cannot undo it
    let frogK = 0;
    const frog = (k) => { frogK = k; };
    ctx.onFrame(() => { legs.forEach((l, i) => { if (l) { l.rotation.x = -1.15 * frogK; l.rotation.z = (i ? 0.45 : -0.45) * frogK; } }); });
    const vHead = K.part(K.s.V, 'head');
    // the shadow under the pawn while it flies: a dark tile on the board that grows as the pawn comes down
    const shadow = K.box(1, 0.01, 1, SHADOW, 0, 0.009, 0);
    shadow.scale.set(0.001, 0.01, 0.001); fx.add(shadow);
    let flying = false, bd = 0;                                   // bd: where the pawn's body is along the aim while it flips
    ctx.onFrame(() => {
      const k = Math.max(0, 1 - a.y / (H + 0.6)), w = flying ? 0.3 + 0.34 * k : 0.001;
      shadow.position.set(C.x + K.aim.x * bd, 0.009, C.z + K.aim.z * bd);
      shadow.rotation.y = Math.atan2(K.aim.x, K.aim.z);
      shadow.scale.set(w, 0.01, w);
    });
    // place the pawn so its body centre is at (d, y) while it is tipped by tip (the stage tips it round the front rim)
    const RB = 0.28;
    const fly = (d, y, tip, sy) => {
      const c = 0.45 * sy, fwd = -RB * Math.cos(tip) + c * Math.sin(tip), up = RB * Math.sin(tip) + c * Math.cos(tip);
      a.d = d - (RB + fwd); a.y = y + c - up; a.tip = tip; bd = d;
    };

    await K.stepBack(-1.35, 0.3);
    // the frog squat: wide and flat, feet on the board, knees out
    await K.tw(0.32, (k, t) => { a.sy = lerp(1, 0.55, outQuad(k)); a.sx = a.sz = 1 + 0.5 * outQuad(k); frog(0.9 * k); a.d = -1.35 + Math.sin(t * 40) * 0.012 * k; }, inOut);
    if (!K.live()) return;
    // spring: stretched long at take off, then tucked with a forward flip on the way up
    sfx.whoosh?.();
    puff(K, K.at(-1.35, 0.02), 9);
    flying = true;
    await K.tw(0.58, (k, t) => {
      const sy = t < 0.18 ? lerp(1.35, 0.8, t / 0.18) : 0.8;
      a.sy = sy; a.sx = a.sz = t < 0.18 ? 1 / Math.sqrt(sy) : 1.18;
      frog(t < 0.18 ? 0.2 : 1);
      fly(lerp(-1.35, -0.3, t), H * outQuad(t), TAU * inOut(Math.max(0, (t - 0.12) / 0.88)), sy);
      v.tip = -0.15 * t; v.lat = Math.sin(t * 40) * 0.02 * t;   // the victim looks up
    });
    if (!K.live()) return;
    // hang time over the victim, frog legs out
    await K.tw(0.14, (k, t) => { fly(lerp(-0.3, -0.04, k), H + 0.05 * bump(t), 0, 0.85); a.sy = 0.85; a.sx = a.sz = 1.12; frog(1); v.tip = -0.15; v.lat = Math.sin(t * 60) * 0.03; }, inOut);
    if (!K.live()) return;
    // the stomp: down fast, legs together, stretched
    sfx.whoosh?.();
    await K.tw(0.17, (k) => { a.tip = 0; bd = a.d = lerp(-0.04, 0, k); a.y = lerp(H, hV, k); a.sy = lerp(0.85, 1.25, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); frog(1 - k); v.tip = -0.15 * (1 - k); v.lat = 0; }, inQuad);
    if (!K.live()) return;
    // impact: the victim goes flat and wide, its head stays a flat lump on top, a rim of cubes sprays from the edges
    sfx.thud?.();
    flying = false; shadow.visible = false;
    v.tip = 0;
    const low = K.P(C.x, 0.14, C.z), WIDE = 2.5, FLAT = 0.16, rim = 0.42 + 0.08 * K.vw;
    K.finale(low, { dir: K.side, fall: false, ring: false });
    for (let i = 0, c = K.n(16); i < c; i++) {
      const ang = (i / c) * TAU, out = K.P(Math.cos(ang), 0.45, Math.sin(ang)), at = K.P(C.x + Math.cos(ang) * rim, 0.1, C.z + Math.sin(ang) * rim);
      K.bleed(at, { count: 1, dir: out, spread: 0.15, speed: [2.6, 4.2], size: [0.06, 0.09] });
      K.bleed(at, { count: 1, dir: K.P(out.x, 0.7, out.z), spread: 0.2, speed: [2, 3.4], size: [0.06, 0.1], life: [0.5, 0.8], colors: DUST, gravity: -6 });
    }
    K.sparks(K.P(C.x, 0.35, C.z), 8);
    const lumps = (k) => { for (const [p, y] of [[vHead, 1.7]]) if (p) p.scale.set(lerp(1, 0.62, k), lerp(1, y, k), lerp(1, 0.62, k)); };
    const top = (sy) => hV * sy * 1.05;                          // the top of the pancake under the pawn
    await K.tw(0.12, (k) => { v.sy = lerp(1, FLAT, k); v.sx = v.sz = lerp(1, WIDE, k); lumps(k); a.y = top(v.sy); a.sy = lerp(1.25, 0.5, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); }, outQuad);
    await K.tw(0.16, (k) => { a.sy = lerp(0.5, 1, k * k); a.sx = a.sz = 1 / Math.sqrt(a.sy); a.y = top(v.sy); });
    // the trampoline: up to three ever lower bounces, the pancake dips at each landing and springs back
    const hops = [0.85, 0.4, 0.16];                                // the first one slow (about 0.3 s up) so it reads
    for (let i = 0; i < hops.length && K.live(); i++) {
      const hop = hops[i], dur = [0.62, 0.34, 0.22][i];
      await K.tw(dur, (k, t) => { a.y = top(FLAT) + hop * bump(t); a.sy = t < 0.12 || t > 0.88 ? 0.85 : 1.1; a.sx = a.sz = 1 / Math.sqrt(a.sy); a.spin = i === 0 ? TAU * inOut(t) : 0; frog(bump(t) * 0.6); });
      if (!K.live()) return;
      sfx.thud?.();
      if (i === 0) K.bleed(low, { count: 6, dir: K.P(K.aim.x, 0.5, K.aim.z), spread: 1.2, speed: [1, 2.4] });
      for (const sd of [-1, 1]) puff(K, K.P(C.x + K.side.x * sd * 0.62, 0.04, C.z + K.side.z * sd * 0.62), 3, 0.25);
      await K.tw(0.16, (k, t) => {
        const dip = Math.exp(-5 * t) * Math.cos(t * 13) * (0.45 - 0.1 * i) * (1 - t);
        v.sy = FLAT * (1 - dip); v.sx = v.sz = WIDE * (1 + 0.12 * dip);
        a.y = top(v.sy); a.sy = 1 - 0.2 * bump(Math.min(1, t * 2)); a.sx = a.sz = 1 / Math.sqrt(a.sy);
      });
    }
    if (!K.live()) return;
    v.sy = FLAT; v.sx = v.sz = WIDE;
    // off the pancake with a backward hop; the pancake stays until the pawn is back
    const y0 = a.y;
    await K.tw(0.38, (k, t) => { a.d = lerp(0, -0.9, inOut(t)); a.y = lerp(y0, 0, t) + 0.5 * bump(t); a.sy = 1; a.sx = a.sz = 1; a.spin = 0; frog(0); });
    if (!K.live()) return;
    sfx.thud?.();
    await K.tw(0.1, (k) => { a.sy = 1 - 0.18 * bump(k); a.sx = a.sz = 1 / Math.sqrt(a.sy); });
    await K.back(-0.9, 0.38);
    if (!K.live()) return;
    K.vanish();
    await K.kill.done();
  },
};

export default [sling, stomp];
