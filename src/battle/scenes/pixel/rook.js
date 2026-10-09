// Pixelwelt fight variants of the rook (CHE-371). See fights.js for the module shape. The rook is a guardian of stone (White)
// or of dark rock with glowing ember cracks (Black). Today's scene topples the rook onto the victim; these three never do:
// (a) a ground pound: the guardian jumps, slams both fists into the board and a shock wave of earth chunks runs to the victim
// and launches it into the air, (b) the guardian rips a boulder out of the ground, lifts it over its head and throws it,
// (c) a cube cannon builds itself on the guardian's shoulder and fires three stone balls.
import * as THREE from 'three';

// the colours of one side: the boulder, the cannon
const LOOK = {
  w: { rock: [0x7c8088, 0x686c74, 0x90949b, 0x73777e], moss: 0x5f9a3a, crack: 0x3c3f45, crackAdd: false,
    base: 0x6b4426, barrel: 0x50565f, ring: 0x3a3f47, band: 0xf2c53a, fuse: 0xffd27a, lit: 0 },
  b: { rock: [0x6a6272, 0x5a5262, 0x7a7284, 0x625a6a], moss: 0x8a8294, crack: 0xff7a2a, crackAdd: true,
    base: 0x3a2c48, barrel: 0x2c2832, ring: 0x1e1a24, band: 0x8a8294, fuse: 0xffb36a, lit: 0xff8a3a },
};
const DIRT = [0x7a5634, 0x664628, 0x8c6640];
const GRASS = 0x5f9a3a, SOOT = 0x2b2118;
const SMOKE = [0xd9d0bd, 0xbdb4a2, 0xe8e0cf];
const FIRE = [0xffe066, 0xffb030, 0xff7a1a, 0xfff2b0];
const IRON = [0x3a3d44, 0x2a2c31, 0x50545c], CHIPS = [0x9a9da4, 0x6d7078, 0xc9c3b4];

// both arms of the attacker as a pose: x is the forward swing (negative raises the arm in front, about -3 is overhead), z turns
// the hand inwards (positive for armN, negative for armP brings the fists together over the head). The rig writes its idle
// swing every frame, so the pose is set again in every frame callback (only while on). len stretches the stone arms (a
// cartoon golem reach, used to hold the boulder at arm's length); the director puts every rig part back afterwards.
function armPose(K) {
  const arms = [K.part(K.s.A, 'armN'), K.part(K.s.A, 'armP')];
  const pose = { x: 0, z: 0, len: 1, on: true };
  K.ctx.onFrame(() => {
    if (!pose.on) return;
    if (arms[0]) { arms[0].rotation.set(pose.x, 0, pose.z); arms[0].scale.set(1, pose.len, 1); }
    if (arms[1]) { arms[1].rotation.set(pose.x, 0, -pose.z); arms[1].scale.set(1, pose.len, 1); }
  });
  return pose;
}
// where the fists are now (in the pieces' space): the bottom of both arms, averaged (the arm's own scale included)
const HAND = 0.57;
function fists(K) {
  const arms = [K.part(K.s.A, 'armN'), K.part(K.s.A, 'armP')].filter(Boolean);
  const out = new THREE.Vector3();
  if (!arms.length) return K.s.A.group.position.clone().setY(K.ah * 0.6);
  K.ctx.root.updateWorldMatrix(true, true);
  for (const arm of arms) out.add(K.ctx.root.worldToLocal(arm.localToWorld(new THREE.Vector3(0, -HAND, 0))));
  return out.multiplyScalar(1 / arms.length);
}

// one chunk of the board that bursts up and sinks back: dirt with a grass cap (the cap is a little wider and stands a little
// higher, so no face shares a plane). It starts with its top under the board and is hidden again when it is back down.
function chunk(K, pos, size, peak, { up = 0.16, hold = 0.12, down = 0.3, tilt = 0.35 } = {}) {
  const { rnd, fx, tw, outBack, inQuad, aim } = K;
  const h = size * (0.9 + rnd() * 0.3);
  const g = K.vprop([[size, h, size, DIRT[(rnd() * DIRT.length) | 0], 0, -h / 2, 0], [size + 0.012, 0.05, size + 0.012, GRASS, 0, -0.019, 0]]);
  g.rotation.set((rnd() - 0.5) * tilt, Math.atan2(aim.x, aim.z) + (rnd() - 0.5) * 0.9, (rnd() - 0.5) * tilt);
  g.position.set(pos.x, -0.02, pos.z);
  fx.add(g);
  const y0 = -0.02, y1 = peak;
  return tw(up, (k) => { g.position.y = K.lerp(y0, y1, outBack(k)); })
    .then(() => tw(hold, () => {}))
    .then(() => tw(down, (k) => { g.position.y = K.lerp(y1, -h - 0.08, inQuad(k)); }))
    .then(() => { g.visible = false; });
}
const dirt = (K, point, count, speed = [1.4, 3.0]) => K.bleed(point, { count, dir: K.up, spread: 0.7, speed, size: [0.05, 0.1], life: [0.5, 0.9], colors: DIRT, gravity: -12 });
// a bright cube that swells and goes out (the hit flash); it starts tiny, so the frame it is made in never shows a full
// size cube before its first tween step
function flash(K, point, size = 0.3, color = 0xfff1d0, dur = 0.14) {
  const m = K.box(1, 1, 1, color, point.x, point.y, point.z, { add: true });
  m.rotation.set(0.6, 0.7, 0); m.scale.setScalar(0.001); K.fx.add(m);
  return K.tw(dur, (k, t) => { m.scale.setScalar(Math.max(0.001, size * Math.sin(Math.PI * Math.min(1, t)))); m.visible = t < 1; });
}
// the victim goes out where it lies: a short puff of dust at its middle (short lived, nothing stays on the board)
function puff(K) {
  const { v, aim, C, hV } = K;
  const lying = Math.abs(v.tip) > 1, d = v.off + (lying ? K.s.rbV + hV * 0.45 : 0);
  K.bleed(K.P(C.x + aim.x * d, 0.12 + v.y, C.z + aim.z * d), { count: 8, dir: K.up, spread: 1.4, speed: [0.5, 1.2], size: [0.05, 0.1], life: [0.3, 0.5], colors: SMOKE, gravity: -3 });
  v.on = false; K.s.V.group.visible = false;
}
// the victim lands lying away from the attacker and bounces a little; then it goes out
const settle = (K, hold = 0.12) => K.tw(0.3, (k, t) => { K.v.tip = Math.PI / 2 - 0.12 * Math.exp(-6 * t) * Math.abs(Math.sin(14 * t)); K.v.y = 0; })
  .then(() => K.tw(hold, () => {})).then(() => { if (K.live()) puff(K); });
// the furthest a victim's base may land past the captured square's centre (so a lying victim stays near its square)
const FAR = 0.25;

export default [
  // a: the guardian stands back, brings both fists together over its head, jumps clear off the board and slams them down
  // about two squares short of the victim. A crack opens where the fists hit, and a line of earth bursts runs over the
  // squares between and launches the victim high into the air, spinning; it lands flat just behind its square and goes out.
  {
    id: 'rook-a', attacker: 'r', still: 1.95, noTurn: true, cam: { dist: 9.0, pitch: 15, yaw: 0 },
    de: 'Bodenstampfer: der Wächter springt hoch und haut beide Fäuste in den Boden, eine Erdwelle rast zum Gegner und schleudert ihn wirbelnd durch die Luft',
    async run(ctx, K) {
      const { a, v, aim, C, hV, vw, sfx, tw, lerp, inOut, outQuad, inQuad, TAU, at, P, s, box, fx, rnd } = K;
      const arm = armPose(K);
      const d1 = -2.35, top = 0.65;

      // 1. the wind up starts at once: both fists go together high over the head while it stomps to the slam point
      // (or backs off to it), then a deep crouch
      sfx.whoosh?.();
      await tw(0.42, (k) => { const u = inOut(Math.min(1, k * 1.6)); a.d = lerp(-s.run0, d1, inOut(k)); a.yaw = s.yawG * k; a.y = 0.06 * Math.abs(Math.sin(k * Math.PI * 2)); arm.x = lerp(0, -3.05, u); arm.z = 0.45 * u; });
      if (!K.live()) return;
      await tw(0.22, (k) => { const u = inOut(k); a.y = 0; a.sy = 1 - 0.18 * u; a.sx = a.sz = 1 + 0.08 * u; arm.x = -3.05; });
      if (!K.live()) return;
      // 2. the jump: straight up, feet clear of the board, stretched tall; it hangs at the top for a beat, fists together
      await tw(0.26, (k) => { a.y = top * outQuad(k); a.d = lerp(d1, d1 + 0.08, k); a.sy = lerp(0.82, 1.12, Math.min(1, k * 2.5)); a.sx = a.sz = 1 / Math.sqrt(a.sy); arm.x = -3.05 - 0.1 * k; });
      if (!K.live()) return;
      await tw(0.26, (k) => { a.y = top + 0.05 * Math.sin(Math.PI * k); a.d = lerp(d1 + 0.08, d1 + 0.1, k); a.sy = lerp(1.12, 1.05, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); });
      if (!K.live()) return;
      // 3. the slam: down hard, the fists swing over the front into the board
      await tw(0.15, (k) => { a.y = top * (1 - inQuad(k)); a.d = lerp(d1 + 0.1, d1 + 0.16, k); a.tip = 0.3 * k; a.sy = lerp(1.12, 0.84, k); a.sx = a.sz = 1 / Math.sqrt(a.sy); arm.x = lerp(-3.15, -0.62, inQuad(k)); arm.z = 0.45 * (1 - k); }, (k) => k);
      if (!K.live()) return;
      sfx.thud?.(); sfx.crack?.();
      const f = fists(K), hitD = (f.x - C.x) * aim.x + (f.z - C.z) * aim.z, imp = at(hitD, 0.04);
      flash(K, P(imp.x, 0.12, imp.z), 0.32);
      K.dust(imp, 10);
      dirt(K, imp, 6);
      // the ring at the fists: small chunks pop up around the contact point
      for (let i = 0; i < 5; i++) { const u = (i / 5) * TAU + 0.4; chunk(K, at(hitD + Math.cos(u) * 0.24, 0, Math.sin(u) * 0.24), 0.1 + 0.02 * (i % 3), 0.06 + 0.02 * (i % 2), { up: 0.1, hold: 0.2, tilt: 0.7 }); }
      // the crack: a wide jagged star of flat dark and dirt cubes just above the board (each tile on its own height, so none
      // shares a plane), with small raised dirt cubes along its edges; it grows out of the contact point
      const cracks = [];
      const arms3 = [[0, 0.62], [1.3, 0.4], [-1.25, 0.42], [2.5, 0.34], [-2.6, 0.3], [Math.PI, 0.28]];
      let hgt = 0.009;
      for (const [ang, len] of arms3) {
        const steps = Math.max(2, Math.round(len / 0.09));
        let x = 0, z = 0;
        for (let j = 0; j < steps; j++) {
          const wig = (rnd() - 0.5) * 0.9, dd = P(aim.x, 0, aim.z).applyAxisAngle(K.up, ang + wig);
          x += dd.x * 0.09; z += dd.z * 0.09;
          const w = (0.13 - 0.07 * (j / steps)) * (0.8 + rnd() * 0.4), c = j % 3 === 2 ? DIRT[1] : SOOT;
          const m = box(w, 0.008, w, c, imp.x + x, hgt, imp.z + z); hgt += 0.0011;
          m.rotation.y = rnd() * 1.6; m.userData.sc = m.scale.clone(); m.userData.at = j / steps; m.scale.setScalar(0.001); fx.add(m); cracks.push(m);
          if (j % 2 === 1) {
            const r = box(0.05, 0.04, 0.05, DIRT[j % 3], imp.x + x + dd.z * 0.07, 0.03 + hgt, imp.z + z - dd.x * 0.07);
            r.userData.sc = r.scale.clone(); r.userData.at = j / steps; r.scale.setScalar(0.001); fx.add(r); cracks.push(r);
          }
        }
      }
      const crackK = (k) => { for (const m of cracks) { const u = Math.min(1, Math.max(0, (k - m.userData.at * 0.6) / 0.4)); m.scale.copy(m.userData.sc).multiplyScalar(Math.max(0.001, u)); } };
      tw(0.2, (k) => crackK(outQuad(k)));
      // the guardian bounces back up out of the slam (not awaited: it runs while the wave travels)
      const recover = tw(0.55, (k) => { a.sy = lerp(0.84, 1, outQuad(k)); a.sx = a.sz = 1 / Math.sqrt(a.sy); a.tip = lerp(0.3, 0.04, outQuad(k)); arm.x = lerp(-0.62, -0.2, k); });

      // 4. the shock wave: a crest of earth about 0.5 high rolls over the squares between (three dirt columns with grass caps
      // across the line, rising out of the board, rolling forward and sinking under the victim), with bursts in its wake
      const end = -0.42, steps = 4, gap = 0.09, roll = gap * (steps + 1);
      const crest = new THREE.Group(), cols = [];
      [[-0.26, 0.21, 0.52], [0, 0.25, 0.56], [0.27, 0.22, 0.5]].forEach(([lat, w, h]) => {
        const c = K.vprop([[w, h, w, DIRT[cols.length], 0, -h / 2, 0], [w + 0.012, 0.05, w + 0.012, GRASS, 0, -0.019, 0]]);
        c.position.x = lat; crest.add(c); cols.push(c);
      });
      crest.rotation.y = Math.atan2(aim.x, aim.z); crest.position.copy(at(hitD, -0.52)); fx.add(crest);
      tw(roll, (k) => {
        const d = lerp(hitD + 0.15, end + 0.1, k), hgt = 0.52 * Math.min(1, k * 4) * (1 - Math.max(0, (k - 0.8) / 0.2) * 0.7);
        const p = at(d, hgt - 0.52 + 0.5); crest.position.set(p.x, p.y, p.z);
        cols.forEach((c, i) => { c.rotation.x = 0.25 * Math.sin(k * 18 + i); c.position.y = 0.04 * Math.sin(k * 22 + i * 2); });
        if (((k * 40) | 0) % 3 === 0) dirt(K, at(d, 0.4), 1, [1, 2]);
      }).then(() => tw(0.2, (k) => { crest.position.y = 0.48 - 0.6 * k; })).then(() => { crest.visible = false; });
      for (let i = 0; i < steps; i++) {
        const u = (i + 1) / (steps + 0.4), d = lerp(hitD, end, u), lat = (i % 2 ? 1 : -1) * 0.06;
        await K.ctx.wait(gap);
        if (!K.live()) return;
        sfx.thud?.();
        chunk(K, at(d, 0, lat), 0.22 + 0.04 * u, 0.13 + 0.09 * u);
        chunk(K, at(d + 0.07, 0, -lat * 3.4), 0.13 + 0.03 * u, 0.07 + 0.05 * u, { tilt: 0.7 });
        chunk(K, at(d - 0.06, 0, lat * 4.2), 0.11 + 0.02 * u, 0.06 + 0.04 * u, { tilt: 0.8 });
        dirt(K, at(d, 0.12, lat), 4);
        K.dust(at(d, 0.05), 2);
        v.lat = Math.sin(i * 2.3) * 0.035 * u;           // the victim shakes as the wave comes
      }
      await K.ctx.wait(gap);
      if (!K.live()) return;

      // 5. the launch: a big burst right under the victim throws it high; it moves away from the guardian from the first
      // frame, spins about its own axis and tips over in the air, so it lands flat just behind its square
      sfx.crack?.(); sfx.whoosh?.();
      chunk(K, at(0.02, 0, 0.15), 0.34, 0.3, { up: 0.12, hold: 0.25 });
      chunk(K, at(-0.1, 0, -0.16), 0.28, 0.22, { up: 0.12, hold: 0.22 });
      chunk(K, at(0.18, 0, -0.02), 0.24, 0.17, { up: 0.14, hold: 0.2 });
      dirt(K, at(0, 0.2), 10, [2, 3.6]);
      K.dust(at(0, 0.08), 6);
      v.lat = 0; v.tip = 0;
      K.finale(P(C.x, hV * 0.4, C.z), { dir: K.up, fall: false, flashSize: 0 }); flash(K, P(C.x, hV * 0.4, C.z), 0.26);
      const peak = [1.6, 1.5, 1.4][vw], far = Math.min(FAR, 0.2), spin0 = rnd() < 0.5 ? 1 : -1;
      let last = 0;
      await tw(0.9, (k) => {
        v.y = peak * 4 * k * (1 - k);
        v.off = far * k;
        v.tip = (Math.PI / 2) * inOut(Math.min(1, k * 1.15));
        v.spin = spin0 * TAU * outQuad(k);
        v.sy = 1 + 0.12 * Math.max(0, 1 - k * 4);       // stretched as it leaves the ground
        if (k - last > 0.15 && k < 0.75) { last = k; K.bleed(P(C.x + aim.x * v.off, v.y + hV * 0.3, C.z + aim.z * v.off), { count: 3, dir: K.up, spread: 0.9, speed: [0.6, 1.6] }); }
      });
      if (!K.live()) return;
      // 6. it lands flat: a thud, dust, a small splash; a little bounce, then it goes out
      v.y = 0; v.sy = 1;
      sfx.thud?.();
      const land = at(far + s.rbV + hV * 0.45, 0.06);
      K.dust(land, 6);
      K.splash(P(land.x, 0.08, land.z), 6, 0.6);
      K.kill.fall = settle(K);
      await recover;
      arm.on = false;
      await Promise.all([K.back(a.d), K.kill.fall]);
      if (!K.live()) return;
      tw(0.45, (k) => crackK(1 - k));                     // the crack closes while the puddle fades
      await K.kill.done();
    },
  },

  // b: the guardian crouches and rips a mossy boulder out of the board (a burst of earth and grass, a pit opens), strains
  // with it low for a beat, then heaves it high over its head with straight arms, leans back and hurls it. The boulder
  // bursts into big bouncing stone chunks on the victim, who is knocked clearly backwards. The black guardian's boulder is
  // a lighter violet rock with ember cracks.
  {
    id: 'rook-b', attacker: 'r', still: 2.88, noTurn: true, cam: { dist: 7.2, pitch: 14, yaw: 0 },
    de: 'Felsbrocken: der Wächter reißt einen riesigen Stein aus dem Boden, stemmt ihn hoch über den Kopf und wirft ihn, der Stein zerplatzt am Gegner',
    async run(ctx, K) {
      const { a, v, aim, C, hV, sfx, fx, tw, lerp, inOut, outQuad, inQuad, outBack, bump, rnd, at, P, s, box, TAU } = K;
      const look = LOOK[ctx.attackerColor] || LOOK.w;
      const arm = armPose(K);
      arm.on = false;
      const d1 = -1.95, yaw = Math.atan2(aim.x, aim.z);

      // the boulder: a lumpy cluster of four stone cubes of distinct sizes (no shared face plane), moss on the top ones
      // (narrower than their cube and standing out of its top), cracks standing a hair out of the faces (they glow on Black)
      const rock = new THREE.Group(), lumps = [];
      const lump = (sz, c, x, y, z, moss) => {
        const m = box(sz, sz * 0.92, sz, c, x, y, z); rock.add(m); lumps.push(m);
        if (moss) rock.add(box(sz * 0.8, 0.06, sz * 0.74, look.moss, x + 0.01, y + sz * 0.46 + 0.012, z - 0.01));
      };
      lump(0.5, look.rock[0], 0, 0, 0, true);
      lump(0.38, look.rock[1], 0.24, -0.08, 0.1, false);
      lump(0.34, look.rock[2], -0.2, 0.1, -0.12, true);
      lump(0.3, look.rock[3], 0.02, -0.12, -0.24, false);
      const cO = look.crackAdd ? { add: true } : undefined;
      rock.add(box(0.03, 0.22, 0.02, look.crack, -0.08, 0.02, 0.262, cO));
      rock.add(box(0.16, 0.03, 0.02, look.crack, 0.02, -0.06, 0.262, cO));
      rock.add(box(0.02, 0.2, 0.03, look.crack, 0.262, 0.04, -0.06, cO));
      rock.add(box(0.02, 0.03, 0.16, look.crack, -0.262, -0.1, 0.06, cO));
      rock.visible = false;
      rock.rotation.y = yaw + 0.35;
      const SC = 1.6;                                    // the whole cluster, about one square wide
      rock.scale.setScalar(SC);
      fx.add(rock);
      const A = s.A.group, R = 0.3 * SC;                 // R: about half the boulder's height
      const place = (f, h) => { rock.position.set(A.position.x + aim.x * f, h, A.position.z + aim.z * f); };

      // 1. walk up (or back off), crouch low, the hands dig into the board in front
      await tw(0.4, (k) => { a.d = lerp(-s.run0, d1, k); a.yaw = s.yawG * k; }, inOut);
      if (!K.live()) return;
      arm.on = true;
      await tw(0.2, (k) => { const u = inOut(k); a.tip = 0.38 * u; a.sy = 1 - 0.16 * u; a.sx = a.sz = 1 + 0.06 * u; arm.x = lerp(0, -0.55, u); });
      if (!K.live()) return;
      const pit = at(d1 + 0.8, 0);
      // the pit: a dark centre tile just above the board and a rim of dirt cubes (distinct sizes, bottoms above the board)
      const hole = box(0.7, 0.008, 0.7, SOOT, pit.x, 0.012, pit.z);
      hole.rotation.y = yaw; hole.scale.set(0.001, 0.008, 0.001); fx.add(hole);
      const rim = [];
      for (let i = 0; i < K.n(9); i++) {
        const u = (i / K.n(9)) * TAU + rnd() * 0.3, sz = 0.09 + rnd() * 0.06 + i * 0.002;
        const m = box(sz, sz * 0.8, sz, DIRT[i % 3], pit.x + Math.cos(u) * 0.46, sz * 0.4 + 0.009, pit.z + Math.sin(u) * 0.46);
        m.rotation.y = rnd() * 1.5; m.userData.s = sz; m.userData.sc = m.scale.clone(); m.scale.setScalar(0.001); fx.add(m); rim.push(m);
      }
      // 2. the rip: it pulls with effort, the boulder tears up out of the board with a burst of earth and grass
      sfx.crack?.(); sfx.thud?.();
      rock.visible = true;
      dirt(K, P(pit.x, 0.1, pit.z), 12, [1.8, 3.4]);
      K.dust(P(pit.x, 0.05, pit.z), 6);
      for (let i = 0; i < 4; i++) { const u = (i / 4) * TAU + 0.6; chunk(K, P(pit.x + Math.cos(u) * 0.5, 0, pit.z + Math.sin(u) * 0.5), 0.12 + 0.02 * i, 0.08 + 0.02 * (i % 2), { up: 0.1, hold: 0.25, tilt: 0.8 }); }
      await tw(0.28, (k) => {
        const u = outQuad(k);
        place(0.8, lerp(-R * 1.4, R + 0.03, u));
        const z = Math.max(0.001, 0.7 * Math.min(1, k * 2.5)); hole.scale.set(z, 0.008, z);
        for (const m of rim) m.scale.copy(m.userData.sc).multiplyScalar(Math.max(0.001, outBack(Math.min(1, k * 1.6))));
        a.sy = lerp(0.84, 0.92, k); a.tip = lerp(0.38, 0.3, k); arm.x = lerp(-0.55, -0.75, k);
      });
      for (const m of rim) m.scale.copy(m.userData.sc);
      if (!K.live()) return;
      // a beat of strain: the boulder low in front, everything trembles
      await tw(0.22, (k, t) => { const j = Math.sin(t * 70) * 0.012; place(0.8 + j, R + 0.03 + Math.abs(j)); a.sx = a.sz = 1.05 + j; rock.rotation.z = j * 3; });
      if (!K.live()) return;
      // 3. the heave: up over the head at arm's length (the stone arms stretch to full reach), arms straight up, the boulder
      // rests on the fists with a clear gap above the head, held there for a beat
      sfx.whoosh?.();
      const start = rock.position.clone();
      await tw(0.42, (k) => {
        const u = inOut(k);
        arm.x = lerp(-0.75, -Math.PI, u); arm.len = lerp(1, 1.4, u); a.tip = lerp(0.3, 0, u); a.sy = lerp(0.92, 1.04, u); a.sx = a.sz = 1 / Math.sqrt(a.sy);
        const top = fists(K); top.y += R + 0.02;
        rock.position.set(lerp(start.x, top.x, u), lerp(start.y, top.y, u) + 0.15 * bump(u), lerp(start.z, top.z, u));
        rock.rotation.z = 0;
      });
      if (!K.live()) return;
      await tw(0.34, (k, t) => { const top = fists(K); rock.position.set(top.x, top.y + R + 0.02, top.z); a.sy = 1.04 - 0.02 * Math.sin(t * 9); arm.x = -Math.PI; });
      if (!K.live()) return;
      // 4. lean back, then the throw: the body snaps forward, the arms swing over, the boulder leaves the hands
      await tw(0.16, (k) => { const u = inOut(k); arm.x = lerp(-Math.PI, -3.5, u); a.tip = lerp(0, -0.22, u); const top = fists(K); rock.position.set(top.x, top.y + R + 0.02, top.z); });
      if (!K.live()) return;
      sfx.whoosh?.();
      await tw(0.12, (k) => { arm.len = lerp(1.4, 1, k); arm.x = lerp(-3.5, -1.8, k); a.tip = lerp(-0.22, 0.26, k); a.d = lerp(d1, d1 + 0.1, k); const top = fists(K); rock.position.set(top.x + aim.x * 0.15 * k, top.y + R * (1 - k), top.z + aim.z * 0.15 * k); }, (k) => k);
      if (!K.live()) return;
      const from = rock.position.clone(), stop = -(s.rbV + 0.3), hit = at(stop, Math.max(0.42, hV * 0.5));
      const recover = tw(0.55, (k) => { a.tip = lerp(0.26, 0, outQuad(k)); a.sy = 1; a.sx = a.sz = 1; arm.x = lerp(-1.8, -0.2, outQuad(k)); });
      // 5. the flight: a high lob, the boulder tumbling end over end
      const rx0 = rock.rotation.x;
      await tw(0.46, (k) => {
        rock.position.set(lerp(from.x, hit.x, k), lerp(from.y, hit.y, k) + 0.55 * bump(k), lerp(from.z, hit.z, k));
        rock.rotation.x = rx0 - 5.2 * k;
      }, (k) => k);
      if (!K.live()) return;
      // 6. the hit: the boulder breaks into its big lumps and a spray of bouncing stone chunks, the victim is knocked back
      sfx.crack?.(); sfx.thud?.();
      const fly = P(aim.x, 0.55, aim.z).normalize();
      rock.updateWorldMatrix(true, true);
      for (const m of lumps) {
        const p = rock.localToWorld(m.position.clone()); ctx.root.worldToLocal(p);
        const sz = m.scale.x * SC * 0.8, piece = box(sz, sz, sz, m.material.color.getHex(), p.x, p.y, p.z);
        piece.rotation.set(rnd(), rnd(), rnd()); fx.add(piece);
        const d = P(fly.x + (rnd() - 0.5) * 1.2, 0.5 + rnd() * 0.6, fly.z + (rnd() - 0.5) * 1.2).normalize();
        fx.body(piece, { radius: sz * 0.5, vel: d.multiplyScalar(1.2 + rnd() * 1.4), bounce: 0.35, gravity: -12, drag: 0.4, life: 0.9 + rnd() * 0.3, fade: 0.3 });
      }
      rock.visible = false;
      K.bleed(hit, { count: 14, dir: fly, spread: 1.0, speed: [1.2, 3.2], size: [0.08, 0.15], life: [0.8, 1.2], colors: look.rock, gravity: -12, bounce: 0.4 });
      if (look.crackAdd) K.sparks(hit, 10, [look.crack, look.fuse, 0xffe08a]);
      K.dust(hit, 5);
      K.finale(hit, { dir: aim, fall: false, flashSize: 0 }); flash(K, hit, 0.26);   // the blood starts only now, at the contact
      // knocked back as one: the figure slides away and tips over backwards in one piece, lands flat, goes out
      const back = FAR;
      K.kill.fall = tw(0.42, (k) => { v.off = back * outQuad(k); v.tip = (Math.PI / 2) * inQuad(k); v.y = 0.12 * bump(k); })
        .then(() => { if (!K.live()) return; sfx.thud?.(); K.dust(at(back + s.rbV + hV * 0.45, 0.06), 6); return settle(K); });
      await K.ctx.wait(0.15);
      if (!K.live()) return;
      // the pit sinks away under the board while the victim goes down
      tw(0.45, (k) => { for (const m of rim) m.position.y = m.userData.s * 0.4 + 0.009 - 0.22 * inQuad(k); hole.position.y = 0.012 - 0.1 * k; })
        .then(() => { hole.visible = false; for (const m of rim) m.visible = false; });
      await recover;
      arm.on = false;
      await Promise.all([K.back(a.d), K.kill.fall]);
      if (!K.live()) return;
      await K.kill.done();
    },
  },

  // c: a cube cannon builds itself on the guardian's shoulder, cube by cube. The fuse fizzes, then three stone balls
  // bang out one after the other (recoil, a muzzle flash, smoke). The first two make the victim stagger back, the third
  // one spins it round and knocks it flat.
  {
    id: 'rook-c', attacker: 'r', still: 2.3, noTurn: true, cam: { dist: 8.2, pitch: 14, yaw: 0 },
    de: 'Schulterkanone: auf der Schulter des Wächters baut sich eine Würfelkanone, drei Steinkugeln knallen auf den Gegner, der dreht sich weg und fällt um',
    async run(ctx, K) {
      const { a, v, aim, C, hV, ah, sfx, fx, tw, lerp, inOut, outQuad, inQuad, bump, at, P, s, box } = K;
      const look = LOOK[ctx.attackerColor] || LOOK.w;
      const arm = armPose(K);
      arm.on = false;
      const d1 = -1.65;

      // the cannon on the shoulder: built facing -z (the aim) on a mount that follows the guardian; parts of distinct sizes,
      // so no face shares a plane; each part pops in on its own beat
      const mount = s.mount(0), gun = new THREE.Group();
      gun.position.set(0.33 * ah, 0.7 * ah, 0.02);
      mount.add(gun);
      const recoil = new THREE.Group(); gun.add(recoil);
      const parts = [
        [gun, box(0.26, 0.12, 0.3, look.base, 0, 0.065, 0)],
        [gun, box(0.3, 0.05, 0.08, look.ring, 0, 0.03, 0.08)],
        [recoil, box(0.15, 0.15, 0.5, look.barrel, 0, 0.2, -0.12)],
        [recoil, box(0.165, 0.165, 0.05, look.band, 0, 0.2, -0.02)],
        [recoil, box(0.19, 0.19, 0.07, look.ring, 0, 0.2, -0.39)],
        [recoil, box(0.1, 0.1, 0.08, look.ring, 0, 0.2, 0.16)],
      ];
      if (look.lit) parts.push([recoil, box(0.205, 0.205, 0.03, look.lit, 0, 0.2, -0.442, { add: true })]);   // the lit muzzle ring of Black
      parts.forEach(([g, m], i) => { m.userData.s = m.scale.clone(); m.userData.p = m.position.clone(); m.userData.from = new THREE.Vector3((i % 2 ? 1 : -1) * 0.35, 0.55 + 0.08 * i, 0.2 - 0.1 * i); m.scale.setScalar(0.001); g.add(m); });
      const fuse = box(0.06, 0.06, 0.06, look.fuse, 0, 0.3, 0.17, { add: true }); fuse.visible = false; recoil.add(fuse);
      const muzzle = parts[4][1];

      // 1. walk up (or back off) to the firing point
      await tw(0.4, (k) => { a.d = lerp(-s.run0, d1, k); a.yaw = s.yawG * k; }, inOut);
      if (!K.live()) return;
      arm.on = true;
      // 2. the cannon builds itself: one cube after the other flies in from above and snaps onto the shoulder with a spark;
      // the guardian braces (fists clench, a little crouch)
      sfx.magic?.();
      const T = 0.62, every = (T - 0.14) / Math.max(1, parts.length - 1), snapped = new Set();
      await tw(T, (k) => {
        parts.forEach(([, m], i) => {
          const u = Math.min(1, Math.max(0, (k * T - i * every) / 0.14));
          m.scale.copy(m.userData.s).multiplyScalar(u > 0 ? 0.6 + 0.4 * u : 0.001);
          m.position.copy(m.userData.from).lerp(m.userData.p, outQuad(u));
          if (u >= 1 && !snapped.has(i)) { snapped.add(i); sfx.tick?.(); K.sparks(s.where(m), 3); }
        });
        arm.x = lerp(0, -0.5, inOut(k)); a.sy = 1 - 0.06 * k; a.sx = a.sz = 1 + 0.03 * k;
      });
      for (const [, m] of parts) { m.scale.copy(m.userData.s); m.position.copy(m.userData.p); }
      if (!K.live()) return;
      fuse.visible = true;
      await tw(0.14, (k, t) => { fuse.scale.setScalar(0.6 + 0.5 * Math.abs(Math.sin(t * 40))); if (k > 0.5) K.sparks(s.where(fuse), 1); });
      fuse.visible = false;
      if (!K.live()) return;

      // one shot: recoil, flash, smoke, a stone ball flies to the victim's chest
      const shot = async (i) => {
        const big = i === 2, from = s.where(muzzle).addScaledVector(aim, 0.06);
        const to = at(-(s.rbV + 0.04), Math.max(0.35, hV * (big ? 0.5 : 0.58)));
        sfx.crack?.(); sfx.thud?.();
        K.bleed(from, { count: big ? 18 : 14, dir: aim, spread: 0.55, speed: [1.5, 3.8], size: [0.05, 0.1], life: [0.18, 0.32], colors: FIRE, gravity: 0 });   // the muzzle fire: pixel cubes
        K.bleed(from, { count: 6, dir: P(aim.x, 0.6, aim.z).normalize(), spread: 0.6, speed: [0.5, 1.4], size: [0.06, 0.12], life: [0.4, 0.7], colors: SMOKE, gravity: 1.5 });
        const ball = new THREE.Group(), r = big ? 0.24 : 0.18;
        ball.add(box(r, r, r, IRON[0])); ball.add(box(r * 0.7, r * 0.7, r * 1.1, IRON[1])); ball.add(box(r * 1.1, r * 0.66, r * 0.72, IRON[2]));   // a dark iron ball
        ball.position.copy(from); fx.add(ball);
        const kick = tw(0.24, (k) => { recoil.position.z = 0.12 * bump(Math.min(1, k * 2)) * (1 - k * 0.3); a.d = d1 - (big ? 0.12 : 0.06) * bump(k); a.tip = -(big ? 0.12 : 0.06) * bump(k); });
        let puffAt = 0;
        await tw(big ? 0.2 : 0.14, (k) => {
          ball.position.set(lerp(from.x, to.x, k), lerp(from.y, to.y, k) + 0.08 * bump(k), lerp(from.z, to.z, k)); ball.rotation.x = -9 * k;
          if (k - puffAt > 0.12) { puffAt = k; K.bleed(ball.position, { count: big ? 2 : 1, dir: K.up, spread: 1, speed: [0.2, 0.6], size: [0.06, 0.1], life: [0.3, 0.5], colors: SMOKE, gravity: 1 }); }   // the smoke trail
        }, (k) => k);
        ball.visible = false;
        K.bleed(to, { count: big ? 10 : 7, dir: K.up, spread: 1.4, speed: [0.5, 1.3], size: [0.07, 0.12], life: [0.3, 0.5], colors: SMOKE, gravity: 1 });   // its own hit puff
        return { kick, to };
      };
      // 3. two shots: the victim staggers back a step each time
      for (let i = 0; i < 2; i++) {
        const { to } = await shot(i);
        if (!K.live()) return;
        K.sparks(to, 8);
        K.bleed(to, { count: 7, dir: P(aim.x, 0.5, aim.z).normalize(), spread: 0.7 });
        K.bleed(to, { count: 7, dir: P(-aim.x, 0.8, -aim.z).normalize(), spread: 1.0, speed: [1, 2.4], size: [0.05, 0.09], life: [0.5, 0.8], colors: CHIPS, gravity: -12, bounce: 0.3 });   // chips fly
        const off0 = v.off;
        tw(0.3, (k, t) => { v.off = off0 + 0.1 * outQuad(Math.min(1, t * 3)); v.tip = 0.26 * Math.exp(-5 * t) * Math.sin(Math.min(1, t * 4) * Math.PI / 2); v.lat = Math.sin(t * 40) * 0.025 * (1 - k); });
        await K.ctx.wait(0.26);
        if (!K.live()) return;
      }
      // 4. the big third shot: the victim spins round and falls flat away from the guardian
      const { kick, to } = await shot(2);
      if (!K.live()) return;
      K.sparks(to, 10);
      K.bleed(to, { count: 6, dir: K.up, spread: 1.2, speed: [1, 2.6], size: [0.06, 0.1], life: [0.6, 0.9], colors: CHIPS, gravity: -12, bounce: 0.3 });
      v.lat = 0;
      K.finale(P(C.x + aim.x * v.off, hV * 0.5, C.z + aim.z * v.off), { dir: aim, fall: false, flashSize: 0 }); flash(K, to, 0.26);
      // it turns half way round first (standing, reeling), then falls flat away from the guardian and lies a beat
      const off0 = v.off, tip0 = v.tip, end = Math.min(FAR, off0 + 0.2), mid = lerp(off0, end, 0.4);
      K.kill.fall = tw(0.24, (k) => { v.off = lerp(off0, mid, k); v.spin = Math.PI * outQuad(k); v.tip = lerp(tip0, 0.12, k); v.y = 0.08 * bump(k); })
        .then(() => K.live() && tw(0.42, (k) => { v.off = lerp(mid, end, outQuad(k)); v.spin = Math.PI * (1 + 0.25 * k); v.tip = lerp(0.12, Math.PI / 2, inQuad(k)); v.y = 0; }))
        .then(() => { if (!K.live()) return; sfx.thud?.(); K.dust(at(end + s.rbV + hV * 0.45, 0.06), 6); return settle(K, 0.3); });
      await kick;
      // 5. the cannon goes poof in place: it shrinks into a puff of dust on the shoulder while the guardian walks back
      await K.ctx.wait(0.25);
      if (!K.live()) return;
      K.bleed(s.where(parts[2][1]), { count: 8, dir: K.up, spread: 1.3, speed: [0.4, 1.1], size: [0.06, 0.1], life: [0.3, 0.5], colors: SMOKE, gravity: 1 });
      tw(0.22, (k) => gun.scale.setScalar(Math.max(0.001, 1 - inQuad(k)))).then(() => { gun.visible = false; });
      arm.on = false;
      await Promise.all([K.back(a.d), K.kill.fall]);
      if (!K.live()) return;
      await K.kill.done();
    },
  },
];
