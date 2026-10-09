// Pixelwelt fight variants of the knight (CHE-371). See fights.js for the module shape. The knight is a rider on a horse, so
// all three variants play with the horse: a jousting charge with a long lance that tosses the victim in a high somersault, a
// rearing horse that comes down with both front hooves and stamps the victim flat into a cracked board, and a buck with both
// hind legs that kicks the victim into the sky until it twinkles out. Today's scene (pixel-gore) is a sword hew from standing;
// no variant uses a sword. The rig parts (rider, lgNF, lgPF, lgNB, lgPB, head, tail) are set in a frame callback after the
// rig's own gallop, the director puts every part back afterwards.
import * as THREE from 'three';

// Rig poses set every frame while a phase wants them (the rig animates the parts first, this runs after it on the scene clock).
function rigPoser(K) {
  const parts = {};
  for (const n of ['rider', 'lgNF', 'lgPF', 'lgNB', 'lgPB', 'head', 'tail']) parts[n] = K.part(K.s.A, n);
  const want = {};
  // the rider is never turned: on the hero knight the rider part also holds the horse's head armour, which would come off
  K.ctx.onFrame(() => { for (const n in want) { const p = parts[n]; if (p && n !== 'rider' && want[n] !== null) p.rotation.x = want[n]; } });
  return { set(o) { Object.assign(want, o); }, free() { for (const n in want) want[n] = null; }, part: (n) => parts[n] };
}

// Holds the victim's rig still while it flies: the rig would read the flight as a walk, swing the arms (a bow or a staff
// through the body) and turn the figure. lock() freezes every part where it stood; the director restores them afterwards.
function victimLock(K) {
  const g = K.s.V.group, rig = g.getObjectByName('rig');
  const saved = rig ? rig.children.map((o) => ({ o, p: o.position.clone(), r: o.rotation.clone() })) : [];
  let on = false;
  K.ctx.onFrame(() => { if (on) for (const x of saved) { x.o.position.copy(x.p); x.o.rotation.copy(x.r); } });
  return { lock() { on = true; g.userData.noTurn = true; } };
}
const clearVictim = (ctx) => { if (ctx.victimObj?.group) delete ctx.victimObj.group.userData.noTurn; };

// The victim's own colours (the four most used vertex colours of its figure), for the cube burst when it pops.
function victimColors(K) {
  const count = new Map(), c = new THREE.Color();
  K.s.V.group.traverse((m) => {
    const col = m.isMesh && m.geometry?.attributes?.color;
    if (!col) return;
    for (let i = 0; i < col.count; i += 4) { const h = c.fromBufferAttribute(col, i).getHex(); count.set(h, (count.get(h) || 0) + 1); }
  });
  const top = [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map((e) => e[0]);
  return top.length ? top : [0xe8e4d2, 0xb9b5a2, 0x6f3fc0];
}

// Places the victim by its centre (off along the aim from the square centre, height y), tumbled by tip: kit-a's pose tips
// around the base rim, so the base is moved to keep the centre on the path.
function placer(K) {
  const { v } = K, rb = K.s.rbV, h = K.hV;
  return (off, y, tip = 0, spin = 0) => {
    const sg = tip >= 0 ? 1 : -1, ua = -sg * rb, uy = h / 2, c = Math.cos(tip), sn = Math.sin(tip);
    v.off = off - sg * rb - (ua * c + uy * sn);
    v.y = y - (-ua * sn + uy * c);
    v.tip = tip; v.spin = spin; v.lat = 0;
  };
}

// The victim bursts into cubes of its own colours and is gone (the pop after a squash or a twinkle).
function pop(K, point, { count = 26, speed = [1.6, 3.6], spread = 0.9, dir = K.up } = {}) {
  K.bleed(point, { count, dir, spread, speed, size: [0.05, 0.1], life: [0.7, 1.2], colors: victimColors(K), gravity: -11, bounce: 0.25 });
  K.dust(point, 8);
  K.v.on = false; K.s.V.group.visible = false;
}

// The walk back to the stand point: backwards in profile first, the turn to the rest heading only at the very end (the rest
// heading of a knight shows the rider's back to the close-up camera).
const backProfile = (K, from, dur = 0.55) => K.tw(dur, (k) => {
  const { a, s } = K, u = Math.min(1, k / 0.8), w = Math.max(0, (k - 0.8) / 0.2);
  a.d = K.lerp(from, -s.run0, K.inOut(u)); a.y = 0; a.tip = 0; a.spin = 0; a.sy = 1; a.sx = a.sz = 1;
  a.yaw = s.yawG * (1 - K.inOut(w));
});

const teamCloth = (K) => (K.ctx.attackerColor === 'b' ? 0x6f3fc0 : 0x3a6fd0);

export default [
  // Joust: the knight backs off, crouches forward and couches a long lance with a pennant, gallops in and the lance scoops the
  // victim up and tosses it in a high somersault over its own square; it lands on its feet, squashes and bursts into cubes.
  {
    id: 'knight-a', attacker: 'n', noTurn: true,
    de: 'Lanzenangriff: der Ritter galoppiert heran, hebt den Gegner mit der Lanze hoch und wirft ihn im Salto in die Luft',
    still: 2.05,
    cam: { dist: 7.4, pitch: 18, yaw: 30 },
    cleanup: clearVictim,
    async run(ctx, K) {
      const { a, v, s, sfx, aim } = K, rig = rigPoser(K), place = placer(K), hold = victimLock(K);
      const LEN = 1.41, lift = 0.5 * K.ah;                  // the lance reaches LEN ahead of the hand, the hand is at lift
      const tipH = Math.min(0.85, Math.max(0.36, K.hV * 0.48));
      const dip = Math.asin(Math.min(0.6, Math.max(-0.3, (lift - tipH) / LEN)));
      const reach = LEN * Math.cos(dip), rV = s.rbV;
      const lance = K.vprop([
        [0.075, 1.6, 0.075, 0x6b4426, 0, 0.8, 0], [0.13, 0.26, 0.13, 0xd5dbe3, 0, 1.68, 0], [0.06, 0.13, 0.06, 0x9aa3b0, 0, 1.86, 0],
        [0.25, 0.1, 0.25, 0xf2c53a, 0, 0.5, 0], [0.022, 0.17, 0.3, teamCloth(K), 0, 1.38, 0.18], [0.024, 0.06, 0.304, 0xf2c53a, 0, 1.3, 0.181],
      ]);
      const point = new THREE.Object3D(); point.position.y = 1.9; lance.add(point);
      lance.position.y = -0.45;
      const piv = K.hold(lance, { lift, side: 0.2 });
      piv.rotation.order = 'YXZ';
      // the lance follows the hand: when the horse tips, the hand turns about the base with it and the lance tilts along
      const L = { elev: 1.35, yaw: 0 };
      ctx.onFrame(() => { const t = a.tip; piv.position.set(0.2, lift * (Math.cos(t) - 1), -lift * Math.sin(t)); piv.rotation.x = -Math.PI / 2 + L.elev - t; piv.rotation.y = L.yaw; });
      const yaw1 = Math.atan(0.2 / reach);
      const back0 = -s.run0 - 0.8, hitD = -reach - 0.6 * rV;

      // turn to the victim and back off while the lance grows into the hand
      await Promise.all([
        K.tw(0.45, (k) => { a.yaw = s.yawG * Math.min(1, k * 1.6); a.d = K.lerp(-s.run0, back0, k); }, K.inOut),
        K.tw(0.35, K.grow(piv), K.outQuad),
      ]);
      if (!K.live()) return;
      // anticipation: a forward crouch, head low, hind legs set back, the lance comes down to couched; a hoof scrapes
      sfx.whoosh?.();
      await K.tw(0.42, (k, t) => {
        a.tip = 0.12 * k; a.sy = 1 - 0.07 * k; a.sx = a.sz = 1 + 0.03 * k;
        rig.set({ lgNF: -0.25 * k + 0.3 * Math.sin(t * 16) * K.bump(k), lgPF: -0.2 * k, lgNB: 0.3 * k, lgPB: 0.3 * k, head: 0.4 * k, rider: 0.3 * k, tail: -0.3 * k });
        L.elev = K.lerp(1.35, -dip, K.inOut(k)); L.yaw = yaw1 * k;
        if (t > 0.55 && t < 0.6) K.dust(K.at(back0 + 0.25, 0.05), 4);
      });
      rig.free();
      if (!K.live()) return;
      // the charge: a gallop with the rider low, dust kicked up behind
      sfx.whoosh?.();
      let kick = 0;
      await K.tw(0.4, (k, t) => {
        a.d = K.lerp(back0, hitD, k); a.tip = 0.12 - 0.04 * t; a.sy = K.lerp(0.93, 1, t); a.sx = a.sz = K.lerp(1.03, 1, t);
        rig.set({ rider: 0.3, head: 0.25 });
        if (t > kick) { kick += 0.12; K.dust(K.at(a.d - 0.3, 0.04), 3); }
      }, K.inQuad);
      if (!K.live()) return;
      // the hit: the lance tip drives in, blood, a flash
      sfx.slice?.();
      const hit = K.at(-0.6 * rV + 0.1, tipH);
      K.finale(hit, { fall: false, ring: false, dir: K.P(aim.x * 0.4, 0, aim.z * 0.4) });   // no ring: the red stays near the impact
      K.sparks(hit, 8);
      hold.lock();
      // the scoop: the lance swings up and carries the victim on its tip
      const tipRel = () => { const p = s.where(point); return { off: (p.x - K.C.x) * aim.x + (p.z - K.C.z) * aim.z, y: p.y }; };
      let rel = { off: 0, y: K.hV / 2 };
      await K.tw(0.2, (k) => {
        a.d = K.lerp(hitD, hitD + 0.15, K.outQuad(k)); a.tip = K.lerp(0.08, 0, k); a.sy = 1; a.sx = a.sz = 1;
        L.elev = K.lerp(-dip, 0.5, k);
        const tp = tipRel();
        rel = { off: K.lerp(0, tp.off + 0.5 * rV, k), y: K.lerp(K.hV / 2, tp.y + K.hV * 0.15, k) };
        place(rel.off, rel.y, 0.5 * k);
      });
      if (!K.live()) return;
      // the flight: high and short, one forward somersault over its own square, a few red cubes trail (none at Blood Off)
      sfx.whoosh?.();
      const oL = 0.35, H = Math.max(0.85, 1.05 - 0.3 * (K.hV - 1.2)), o0 = rel.off, y0 = rel.y, dA = a.d, yL = K.hV / 2;
      const flight = K.tw(0.92, (k, t) => {
        const o = K.lerp(o0, oL, t), y = K.lerp(y0, yL, t) + 4 * H * t * (1 - t);
        place(o, y, K.lerp(0.5, K.TAU, t), Math.PI * 0.6 * t);
      });
      // the knight's triumph: the lance goes up high, the horse prances on the spot with a head toss
      const cheer = K.tw(0.92, (k, t) => {
        a.d = K.lerp(dA, dA - 0.1, k); a.y = 0.06 * Math.abs(Math.sin(t * Math.PI * 3)) * (1 - k);
        L.elev = K.lerp(0.5, 1.4, K.outQuad(k)); L.yaw = yaw1 * (1 - k);
        rig.set({ lgNF: -0.5 * Math.abs(Math.sin(t * Math.PI * 3)) * (1 - k), lgPF: -0.5 * Math.abs(Math.sin(t * Math.PI * 3 + 1)) * (1 - k), head: -0.4 * K.bump(k), rider: 0 });
      });
      await flight;
      if (!K.live()) return;
      // the landing: on its feet with a thud, a dust ring, a squash; it holds a beat and bursts into cubes of its colours
      sfx.thud?.();
      const land = K.at(oL, 0.08);
      K.splash(land, 12, 0.8, K.DUST);
      K.bleed(K.at(oL, 0.2), { count: 6, dir: K.up, spread: 0.6, speed: [1, 2] });
      await K.tw(0.4, (k) => { place(oL, yL, K.TAU); v.sy = K.lerp(1, 0.45, K.outQuad(Math.min(1, k * 4))); v.sx = v.sz = 1 / Math.sqrt(v.sy); });
      if (!K.live()) return;
      sfx.splat?.();
      pop(K, K.at(oL, K.hV * 0.3));
      await cheer;
      rig.free();
      if (!K.live()) return;
      const d1 = a.d;
      await K.kill.fall;
      await Promise.all([backProfile(K, d1), K.tw(0.4, (k) => piv.scale.setScalar(Math.max(0.001, 1 - k))), K.kill.done()]);
    },
  },

  // Hoof stomp: the knight trots up close, the horse rears up high on its hind legs and hangs there (the victim cowers and
  // shakes), then crashes down: the front hooves stamp the victim into a flat pancake, the board cracks in thick dark slabs and
  // a dust ring runs out. The horse springs back, the pancake holds a beat and pops in a fountain of its own cubes.
  {
    id: 'knight-b', attacker: 'n', noTurn: true,
    de: 'Hufstampfer: das Pferd steigt hoch auf die Hinterbeine, stampft den Gegner platt und der Boden bricht auf',
    still: 1.72,
    cam: { dist: 6.4, pitch: 15, yaw: 35 },
    async run(ctx, K) {
      const { a, v, s, fx, sfx, C, aim } = K, rig = rigPoser(K);
      const close = -0.7 - 0.6 * (s.rbV - 0.3);
      const REAR = -0.62;
      const riderFor = (tip) => -0.9 * tip;                // the rider leans into the rear and stays nearly upright (a tenth of the horse pitch)
      // trot in close, turned to the victim
      await K.tw(0.45, (k) => { a.yaw = s.yawG * Math.min(1, k * 1.8); a.d = K.lerp(-s.run0, close, k); }, K.inOut);
      if (!K.live()) return;
      // the rear: up on the hind legs, front hooves paddling, head thrown up; the victim leans away, cowers and shakes
      sfx.whoosh?.();
      const cower = (k, t) => { v.tip = 0.16 * k; v.sy = 1 - 0.1 * k; v.sx = v.sz = 1 + 0.04 * k; v.lat = Math.sin(t * 60) * 0.025 * k; };
      const paddle = (t) => ({ lgNF: -1.1 + 0.45 * Math.sin(t * 22), lgPF: -1.1 - 0.45 * Math.sin(t * 22) });
      await K.tw(0.42, (k, t) => {
        a.tip = REAR * K.outBack(k); a.d = K.lerp(close, close - 0.08, k);
        rig.set({ lgNF: -1.1 * k + 0.45 * Math.sin(t * 22), lgPF: -1.1 * k - 0.45 * Math.sin(t * 22), lgNB: 0.25 * k, lgPB: 0.25 * k, head: -0.55 * k, rider: riderFor(a.tip), tail: -0.5 * k });
        cower(k, t);
      });
      if (!K.live()) return;
      // the hang at the top: a long beat with a neigh, the hooves paddle
      sfx.magic?.();
      await K.tw(0.45, (k, t) => {
        a.tip = REAR - 0.05 * Math.sin(t * Math.PI);
        rig.set({ ...paddle(0.42 + t * 0.45), rider: riderFor(a.tip) });
        cower(1, 0.42 + t * 0.45);
      });
      if (!K.live()) return;
      // the slam: fast, down and a little forward, front legs reaching ahead so only the hooves come down on the victim
      sfx.whoosh?.();
      const dTop = close - 0.08, dHit = close + 0.16, LAND = -0.1;
      await K.tw(0.11, (k) => {
        a.tip = K.lerp(REAR, LAND, k); a.d = K.lerp(dTop, dHit, k);
        rig.set({ lgNF: K.lerp(-1.1, -0.95, k), lgPF: K.lerp(-1.1, -0.95, k), lgNB: 0.25 * (1 - k), lgPB: 0.25 * (1 - k), head: K.lerp(-0.55, -0.35, k), rider: riderFor(a.tip), tail: -0.5 });
      }, K.inQuad);
      if (!K.live()) return;
      // the impact: the whole victim goes flat in one squash (one body, nothing flies apart), blood, a crack in the board, dust
      sfx.thud?.(); sfx.crack?.();
      v.tip = 0; v.lat = 0;
      K.finale(K.at(0.38, 0.08), { dir: K.aim, fall: false });   // blood from the far rim, outwards: the flat hat stays clean
      const flat = K.tw(0.06, (k) => { v.sy = K.lerp(0.9, 0.15, k); v.sx = v.sz = K.lerp(1.04, 1.3, k); });
      for (let i = 0, c = K.n(6); i < c; i++) { const ang = (i / c) * K.TAU; K.bleed(K.P(C.x + Math.cos(ang) * 0.75, 0.06, C.z + Math.sin(ang) * 0.75), { count: 4, dir: K.up, spread: 1.4, speed: [0.5, 1.4], size: [0.05, 0.1], life: [0.5, 0.9], colors: [0x8a7458, 0x6b5a44, 0x9c8a6a], gravity: -4 }); }   // brown ground dust, away from the pancake
      // crack slabs: thick dark pixel bars in two kinked segments per ray, each slab at its own height
      const segs = [];
      const rays = 4;
      let idx = 0;
      const slab = (x0, z0, ang, len, at) => {
        const m = K.box(0.001, 0.024, 0.13, 0x17110c, x0, 0.017 + idx++ * 0.0009, z0);
        m.rotation.y = -ang; fx.add(m); segs.push({ m, x0, z0, ang, len, at });
      };
      for (let i = 0; i < rays; i++) {
        const a1 = (i / rays) * K.TAU + 0.4 + K.rnd() * 0.3, l1 = 0.32 + K.rnd() * 0.06, r0 = 0.3;
        const x1 = C.x + Math.cos(a1) * r0, z1 = C.z + Math.sin(a1) * r0;
        slab(x1, z1, a1, l1, 0);
        const a2 = a1 + (K.rnd() < 0.5 ? -1 : 1) * (0.3 + K.rnd() * 0.25);
        slab(x1 + Math.cos(a1) * l1, z1 + Math.sin(a1) * l1, a2, 0.2 + K.rnd() * 0.08, 0.5);
      }
      const setCracks = (u, fade = 1) => {
        for (const g of segs) {
          const w = Math.min(1, Math.max(0, (u - g.at) / 0.5)), l = g.len * w;
          g.m.scale.set(Math.max(0.001, l), 0.024, Math.max(0.001, 0.13 * fade));
          g.m.position.x = g.x0 + Math.cos(g.ang) * l / 2; g.m.position.z = g.z0 + Math.sin(g.ang) * l / 2;
        }
      };
      setCracks(0);
      // the horse springs back off the pancake (the flat victim shows clean), the rider jolts; the pancake holds a beat
      await K.tw(0.3, (k, t) => {
        setCracks(K.outQuad(Math.min(1, t * 3)));
        a.d = K.lerp(dHit, dHit - 0.32, K.outQuad(k)); a.tip = K.lerp(LAND, -0.28, K.outQuad(k));
        a.y = 0.05 * K.bump(k);
        rig.set({ lgNF: K.lerp(-0.95, -0.5, k), lgPF: K.lerp(-0.95, -0.4, k), head: K.lerp(-0.35, -0.2, k), rider: riderFor(a.tip) + 0.15 * Math.sin(t * 12) * Math.exp(-4 * t), tail: K.lerp(-0.5, -0.2, k) });
      });
      await flat;
      if (!K.live()) return;
      // the upward moment: the pancake pops, a fountain of its own cubes shoots up high
      sfx.splat?.();
      pop(K, K.at(0.15, 0.08), { count: 30, speed: [3, 5.5], spread: 0.4, dir: K.P(aim.x * 0.45, 1, aim.z * 0.45).normalize() });
      await K.tw(0.35, (k) => {
        a.tip = K.lerp(-0.28, 0, K.inOut(k)); a.y = 0;
        rig.set({ lgNF: K.lerp(-0.5, 0, k), lgPF: K.lerp(-0.4, 0, k), lgNB: 0, lgPB: 0, head: 0.35 * K.bump(k), rider: riderFor(a.tip), tail: 0 });
      });
      rig.free();
      if (!K.live()) return;
      await K.kill.fall;
      await Promise.all([backProfile(K, a.d), K.kill.done(), K.tw(0.35, (k) => { setCracks(1, 1 - k); })]);
      for (const g of segs) g.m.visible = false;
    },
  },

  // Buck: the knight trots up, turns its back to the victim, sinks on its haunches and kicks out with both hind legs; the
  // victim is blasted up and away into the sky, tumbling and shrinking until it goes out with a twinkle. The horse lands,
  // turns round and trots back.
  {
    id: 'knight-c', attacker: 'n', noTurn: true,
    de: 'Doppelhuf: das Pferd dreht sich um, keilt mit beiden Hinterbeinen aus und der Gegner fliegt bis in den Himmel',
    still: 1.45,
    cam: { dist: 8.6, pitch: 22, yaw: 10 },
    cleanup: clearVictim,
    async run(ctx, K) {
      const { a, v, s, fx, sfx, aim } = K, rig = rigPoser(K), place = placer(K), hold = victimLock(K);
      const dK = -0.78 - s.rbV;
      // trot in and turn round: the rear goes to the victim, a little hop on the turn
      await K.tw(0.45, (k) => { a.yaw = s.yawG * Math.min(1, k * 1.8); a.d = K.lerp(-s.run0, dK, k); }, K.inOut);
      if (!K.live()) return;
      await K.tw(0.35, (k) => { a.spin = -Math.PI * k; a.y = 0.1 * K.bump(k); rig.set({ head: 0.2 * K.bump(k), tail: 0.3 * K.bump(k) }); }, K.inOut);
      if (!K.live()) return;
      // anticipation: down on the haunches, hind legs drawn in under the body, the rider leans forward, the victim trembles
      sfx.whoosh?.();
      await K.tw(0.32, (k, t) => {
        a.tip = 0.14 * K.inOut(k); a.y = 0;
        rig.set({ lgNB: -0.45 * k, lgPB: -0.4 * k, lgNF: 0.1 * k, lgPF: 0.1 * k, head: 0.75 * k, rider: 0.35 * k, tail: 0.2 * k });
        v.lat = Math.sin(t * 55) * 0.02 * k; v.sy = 1 - 0.06 * k; v.sx = v.sz = 1 + 0.03 * k;
      });
      if (!K.live()) return;
      // the buck: the rear flies up, both hind legs shoot out backwards into the victim
      await K.tw(0.1, (k) => {
        a.tip = K.lerp(0.14, -0.62, k);
        rig.set({ lgNB: K.lerp(-0.45, 1.45, k), lgPB: K.lerp(-0.4, 0.95, k), head: K.lerp(0.75, 0.45, k), rider: K.lerp(0.35, -0.35, k), tail: K.lerp(0.2, 0.45, k) });
        const tl = rig.part('tail'); if (tl) tl.scale.y = K.lerp(1, 0.55, k);   // a short tail: a long one reads as a stick over the rump
      }, K.outQuad);
      if (!K.live()) return;
      sfx.thud?.(); sfx.crack?.();
      const hit = K.at(-0.5 * s.rbV, Math.min(K.hV * 0.5, 0.55));
      v.lat = 0; v.sy = 1; v.sx = v.sz = 1;
      K.finale(hit, { fall: false, dir: K.P(aim.x, 0.8, aim.z).normalize() });
      K.flash(hit, 0.75);
      K.sparks(hit, 12);
      K.dust(K.at(0, 0.05), 8);
      K.dust(K.at(-0.35, 0.4), 10);                         // a dust burst at the hooves
      K.dust(K.at(-0.3, 0.15), 6);
      hold.lock();
      // the blast off: up and away along the aim, tumbling, shrinking into the sky; a sparkle trail behind it
      sfx.whoosh?.();
      const end = { o: 0.9, y: 2.5 };                       // a rocket straight up and a little back, it shrinks into the far sky
      let trail = 0;
      const flight = K.tw(0.8, (k, t) => {
        const o = K.lerp(0, end.o, k), y = K.lerp(K.hV / 2, end.y, k);
        const sc = K.lerp(1, 0.12, K.inQuad(t));
        place(o, y, 0.5 * Math.sin(t * 9) * (1 - t), 5 * K.TAU * k);
        v.sx = v.sy = v.sz = sc;
        if (t > trail) { trail += 0.1; K.sparks(K.at(o, y), 3); if (t < 0.5) K.bleed(K.at(o, y), { count: 2, dir: K.up, spread: 1, speed: [0.3, 1], size: [0.04, 0.06] }); }
      }, K.outQuad);
      // the horse comes down on all fours with a bounce, the legs swing back under it
      const land = K.tw(0.4, (k, t) => {
        a.tip = -0.62 * (1 - K.inQuad(Math.min(1, k * 1.3))) + 0.05 * Math.sin(t * 14) * Math.exp(-5 * t) * (k > 0.7 ? 1 : 0);
        rig.set({ lgNB: K.lerp(1.45, 0, K.inOut(k)), lgPB: K.lerp(0.95, 0, K.inOut(k)), head: K.lerp(0.45, 0, k), rider: K.lerp(-0.35, 0, k), tail: K.lerp(0.45, 0.2, k) });
        const tl = rig.part('tail'); if (tl) tl.scale.y = K.lerp(0.55, 1, k);
      });
      await land;
      if (!K.live()) return;
      K.dust(K.at(dK, 0.05), 6);
      await flight;
      if (!K.live()) return;
      // the twinkle: a little star flashes where it vanished, then the knight turns round and trots back
      const star = K.at(end.o, end.y);
      // a bright pixel star: a long cross, a short diagonal cross and a white core, two pulses
      const cam = ctx.stage?.camera, qP = new THREE.Quaternion(), qC = new THREE.Quaternion();
      const star3 = K.box(1, 1, 1, 0xffffff, star.x, star.y, star.z, { add: true });
      const arms = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((r, i) => { const m = K.box(1, 1, 1, i < 2 ? 0xffe27a : 0xfff6c8, star.x, star.y, star.z, { add: true }); m.userData.r = r; m.userData.l = i < 2 ? 1 : 0.55; return m; });
      const holder = new THREE.Group(); holder.position.copy(star); fx.add(holder);
      for (const m of [...arms, star3]) { m.position.set(0, 0, 0); holder.add(m); }
      v.on = false; s.V.group.visible = false;
      K.sparks(star, 12, [0xfff6c8, 0xffe27a, 0xffffff]);
      sfx.magic?.();
      const twinkle = K.tw(0.95, (k, t) => {
        const z = Math.max(0.001, Math.min(1, t / 0.12, (1 - t) / 0.25) * (0.85 + 0.15 * Math.sin(t * 24)));
        if (cam && holder.parent) holder.quaternion.copy(holder.parent.getWorldQuaternion(qP).invert().multiply(cam.getWorldQuaternion(qC)));   // the star faces the camera
        for (const m of arms) { m.rotation.z = m.userData.r + t * 1.5; m.scale.set(1.4 * m.userData.l * z, 0.15 * z, 0.02); }
        star3.scale.set(0.32 * z, 0.32 * z, 0.03); star3.rotation.z = Math.PI / 4 + t * 1.5;
        holder.visible = t < 1;
      });
      await K.tw(0.35, (k) => { a.spin = -Math.PI * (1 - k); a.y = 0.08 * K.bump(k); a.tip = 0; rig.set({ tail: 0.2 * (1 - k), head: 0, rider: 0 }); }, K.inOut);
      rig.free();
      if (!K.live()) return;
      await K.kill.fall;
      await Promise.all([backProfile(K, a.d, 0.5), twinkle, K.kill.done()]);
    },
  },
];
