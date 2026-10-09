// Pixelwelt checkmate finale (CHE-371, preview behind ?finale=1). On a checkmate the camera pulls back to a wide, raised shot
// from behind the winners: they turn to face the camera, hop and throw both arms up in a staggered wave, while the losing side's
// tower (a tall keep of stone cubes in its colours, a banner, battlements, a flag) grows out of the grass beyond its own back
// rank in a spray of grass and dirt, cracks with dark zigzag cracks and falling chunks, tips over and breaks into a heap of
// stones that settles and sinks away. Rockets of glowing cubes with spark trails climb into the open sky over the tower and
// burst into rings and spheres of bright cubes in the winner's colours plus gold. About 4.4 s, then everything is put back.
//
// Contract with the director: playFinale({ game, controls, stage, ui, st, sfx }) -> { update(dt) -> false when finished, skip() }.
// All timing comes from the dt of update() (deterministic under ?manual=1), randomness from one seeded generator. Every cube is
// an instance of one shared unit box (two InstancedMeshes: opaque cubes and a few additive glow cubes), flat unlit materials
// with a fixed shade per face baked into the box (like the mesher of the world), no textures, no lights. The camera shot is
// fitted to the winners, the mated king, the tower and the bursts, for the aspect of the screen. A pointerdown or a key ends
// the finale at once; a new game or an undo ends it too (then the banner stays hidden). window.__finale reports
// { running, t, side, tower, peak } every frame for the clip tool.
import * as THREE from 'three';
import { PAL } from './palette.js';
import { shade } from './shade.js';

const TAU = Math.PI * 2;
const DUR = 4.4;                         // the whole finale
const CAM_IN = 0.9;                      // the camera swoops to the high opening shot
const CAM_GLIDE = 0.95, GLIDE = 0.6;     // then glides down and in to the close shot while the tower rises
const T_RISE = 0.85, RISE = 1.0;         // the tower grows out of the grass once the camera has settled
const T_CRACK = 1.95, CRACK = 0.45;      // the crack beat: zigzag cracks, a hard shake, chunks falling
const T_FALL = T_CRACK + CRACK, TOPPLE = 0.6;   // it tips over as one piece past 70 degrees, then breaks into its stones (timber)
const TIP = 1.25;                        // the angle it reaches before it breaks
const T_BREAK = T_FALL + TOPPLE;
const T_SINK = 3.45, SINK = 0.4;         // the heap sinks into the grass
const T_BACK = 3.9, BACK = 0.5;          // the camera glides back
const CELL = 0.34;                       // one stone of the tower
const ROWS = 12;                         // rows of wall below the battlements: about 3 kings tall
const GOLD = [0xf2c53a, 0xffe27a, 0xfff2b0];
const DUST = [0xd9d0bd, 0xc4baa5, 0xe8e0cf];
const SOIL = [0x62a83c, 0x8fd06a, 0x4f8f2e, 0x8a5f33, 0x6b4426, 0x9a6b3d];
const CRACK_C = 0x1b1720;
const SIDE = {
  w: {
    fire: [0x4f8cff, 0x9fe6ff, 0xfff7e0, 0x2f67c8, 0x7fb2ff],
    stone: [0xd9d3c4, 0xcac3b2, 0xbdb6a5, 0xe3ddd0], dark: 0x8d877a, banner: 0x2f67c8, trim: 0xf2c53a, window: 0x2a2f3a, door: 0x6b4426,
  },
  b: {
    fire: [0x9a5cf0, 0xb58cf0, 0xb8f040, 0xd9c2ff, 0x6f3fc0],
    stone: [0x5c566a, 0x4f4a5e, 0x666075, 0x575168], dark: 0x2c2836, banner: 0x6f3fc0, trim: 0xb8f040, window: 0xb8f040, door: 0x2c2a32,
  },
};
// raised arms for the pawns, whose arms are part of a rest pose (folded for the heroes, stretched out for the zombies)
const PAWN_ARMS = { w: { sleeve: shade(PAL.w.robe, 1.15), hand: PAL.w.skin }, b: { sleeve: PAL.b.dark, hand: PAL.b.skin } };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const outQuad = (k) => 1 - (1 - k) * (1 - k);
const outBack = (k) => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const smooth = (k) => k * k * (3 - 2 * k);
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
function seeded(seed = 7) { let x = Math.max(1, seed | 0); return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; }

// A unit box with a fixed shade per face in its vertex colours (top brightest, bottom darkest), so a flat unlit cube still reads as 3D.
function shadedBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const s = [0.86, 0.72, 1.0, 0.5, 0.93, 0.64];            // px, nx, py, ny, pz, nz (the face order of BoxGeometry)
  const col = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) col.set([s[f], s[f], s[f]], (f * 4 + v) * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// The camera pose that shows every point: yaw and pitch are given, target and distance are fitted so the projected points fill
// the frame inside the margins (vertical field of view 35 degrees, like the stage camera).
function fitShot(points, yaw, pitch, aspect, { mx = 0.06, top = 0.05, bottom = 0.08, low = 0.4 } = {}) {
  const tanV = Math.tan((35 / 2) * Math.PI / 180), tanH = tanV * aspect;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = new THREE.Vector3(-cp * Math.sin(yaw), -sp, -cp * Math.cos(yaw));
  const r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const u = new THREE.Vector3().crossVectors(r, f);
  const T = new THREE.Vector3();
  for (const p of points) T.add(p);
  T.multiplyScalar(1 / Math.max(1, points.length));
  let d = 14;
  const C = new THREE.Vector3(), q = new THREE.Vector3();
  for (let it = 0; it < 60; it++) {
    C.copy(T).addScaledVector(f, -d);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of points) {
      q.subVectors(p, C);
      const z = Math.max(0.5, q.dot(f));
      const x = q.dot(r) / z / tanH, y = q.dot(u) / z / tanV;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    // centre the picture across; spare height (a narrow screen) goes the share `low` below and the rest above, so the winners
    // stay low and the sky holds the bursts; then scale the distance so the larger extent just fits
    const spare = Math.max(0, 2 - top - bottom - (y1 - y0)), wantY0 = -(1 - bottom) + spare * low;
    T.addScaledVector(r, ((x0 + x1) / 2) * d * tanH * 0.8).addScaledVector(u, (y0 - wantY0) * d * tanV * 0.8);
    const need = Math.max((x1 - x0) / 2 / (1 - mx), (y1 - y0) / 2 / (1 - (top + bottom) / 2));
    d = Math.min(40, Math.max(6, d * Math.pow(need, 0.7)));
  }
  return { target: T, dist: d };
}

// The ground height under a point of the pieces' space, read from the island's block list (its userData.boxes, the grass top is
// y = 0 on flat ground). -50 where there is no ground. Without an island the ground is flat everywhere.
function groundOf(stage, root) {
  const island = stage?.scene?.getObjectByName?.('island');
  const boxes = island?.userData?.boxes;
  if (!boxes?.length) return () => 0;
  root.updateWorldMatrix(true, false); island.updateWorldMatrix(true, false);
  const M = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(island.matrixWorld);
  const tops = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const q of boxes) {
    if (q.w < 0.99 || q.d < 0.99) continue;                  // props, not ground
    a.set(q.x, q.y, q.z).applyMatrix4(M); b.set(q.x + q.w, q.y + q.h, q.z + q.d).applyMatrix4(M);
    const top = Math.max(a.y, b.y);
    for (let ix = Math.round(Math.min(a.x, b.x)); ix < Math.round(Math.max(a.x, b.x)); ix++) {
      for (let iz = Math.round(Math.min(a.z, b.z)); iz < Math.round(Math.max(a.z, b.z)); iz++) {
        const k = ix + ',' + iz;
        if (!(tops.get(k) >= top)) tops.set(k, top);
      }
    }
  }
  return (x, z) => tops.get(Math.floor(x) + ',' + Math.floor(z)) ?? -50;
}

// Where the losing tower stands and which way it falls (an angle, world x = sin, z = cos). Candidates beyond the loser's back
// rank (sz: +1 white's end, -1 black's end) on flat grass, falling along flat grass without crossing the board; the best one
// keeps the most room between every piece and the tower's foot and its fall line, and falls away from the board and a little
// sideways (a side view of the fall reads best).
function placeTower(sz, pieces, ground, TOP) {
  const flat = (x, z) => Math.abs(ground(x, z)) < 0.05;
  const segDist = (px, pz, ax, az, dx, dz, len) => { const u = Math.max(0, Math.min(len, (px - ax) * dx + (pz - az) * dz)); return Math.hypot(px - ax - dx * u, pz - az - dz * u); };
  let best = null;
  for (const zz of [4.9, 5.5, 6.1]) for (const xx of [5.0, -5.0, 4.4, -4.4, 5.6, -5.6, 3.2, -3.2, 1.6, -1.6, 0]) {
    const x = xx * sz, z = zz * sz, r = Math.hypot(x, z);
    let foot = true;
    for (const ox of [-0.95, 0, 0.95]) for (const oz of [-0.95, 0, 0.95]) if (!flat(x + ox, z + oz)) foot = false;
    if (!foot) continue;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2, dx = Math.sin(ang), dz = Math.cos(ang), len = TOP + 0.4, reach = TOP * 1.7;   // stones skid on past the top
      let ok = true;
      for (let d = 0.9; d <= reach && ok; d += 0.35) for (const o of [-0.9, 0, 0.9]) {
        const px = x + dx * d - dz * o, pz = z + dz * d + dx * o;
        if (!flat(px, pz) || (Math.abs(px) < 4.4 && Math.abs(pz) < 4.4)) { ok = false; break; }
      }
      if (!ok) continue;
      let room = 2;
      for (const o of pieces) {
        const px = o.position.x, pz = o.position.z;
        room = Math.min(room, Math.hypot(px - x, pz - z) - 1.3, segDist(px, pz, x, z, dx, dz, len) - 0.8);
      }
      const side = Math.abs(dx * (z / r) - dz * (x / r));    // across the line from the board centre: a side view of the fall
      const away = dx * (x / r) + dz * (z / r);              // away from the board: the rubble ends up far from every piece
      const score = Math.min(room, 1.5) + 0.35 * side + 0.45 * away + (Math.abs(xx) === 5 && zz === 4.9 ? 0.2 : 0) - (zz - 4.9) * 0.15;
      if (!best || score > best.score + 1e-9) best = { score, x, z, ang, room };
    }
  }
  if (!best) return { TOWER: new THREE.Vector3(4.95 * sz, 0, 4.75 * sz), fallAng: Math.atan2(4.75 * sz, 4.95 * sz) + Math.PI / 2 };
  return { TOWER: new THREE.Vector3(best.x, 0, best.z), fallAng: best.ang };
}

export function playFinale({ game, controls, stage, ui, st, sfx }) {
  const side = st?.winner === 'b' ? 'b' : 'w', loser = side === 'w' ? 'b' : 'w';
  const W = SIDE[side], L = SIDE[loser];
  const lite = stage?.quality === 'low';
  const n = (c) => (lite ? Math.ceil(c * 0.6) : c);
  const rnd = seeded(side === 'w' ? 3701 : 3702);
  const say = (name) => { try { sfx?.[name]?.(); } catch (e) { /* a missing voice is fine */ } };
  const root = game.root;
  const win = typeof window !== 'undefined' ? window : null;
  const aspect = stage?.camera?.aspect || (win ? win.innerWidth / Math.max(1, win.innerHeight) : 16 / 9);
  const portrait = aspect < 0.87;

  // ---------------------------------------------------------------- where things stand
  const pieces = root.children.filter((o) => o.userData?.piece && o.visible);
  const onBoard = (o) => Math.abs(o.position.x) <= 4 && Math.abs(o.position.z) <= 4;
  const TOP = (ROWS + 1) * CELL;
  const ground = groundOf(stage, root);
  // The losing tower stands beyond the loser's back rank on flat grass, and it falls along open flat ground away from the board.
  // Place and fall direction are picked at runtime: every piece (on the board, captured beside it) keeps clear of the foot and
  // of the fall line, so a real game with pieces anywhere still has a clean fall.
  const { TOWER, fallAng } = placeTower(loser === 'w' ? 1 : -1, pieces, ground, TOP);
  const towerYaw = Math.atan2(-TOWER.x, -TOWER.z);          // the tower's front (+z local) faces the board centre
  const fallX = Math.sin(fallAng), fallZ = Math.cos(fallAng);
  const fallA = fallAng - Math.PI / 2 - towerYaw;             // turns the topple frame so its +x is the fall direction

  // ---------------------------------------------------------------- the winners
  const cheer = [];
  const armMats = new Map();
  const armMat = (c) => { if (!armMats.has(c)) armMats.set(c, new THREE.MeshBasicMaterial({ color: c, vertexColors: true, toneMapped: false })); return armMats.get(c); };
  const geo = shadedBox();
  for (const wrap of pieces) {
    const info = wrap.userData.piece;
    if (info.color !== side || !onBoard(wrap)) continue;    // captured pieces beside the board stay put
    const rig = wrap.getObjectByName('rig');
    const arms = rig ? ['armN', 'armP'].map((k) => rig.getObjectByName(k)).filter(Boolean) : [];
    const c = { wrap, rig, arms, y: wrap.position.y, s: wrap.scale.clone(), wq: wrap.quaternion.clone(), q: arms.map((a) => a.quaternion.clone()),
      lat: 0, delay: 0, turn: 0, h: wrap.userData.height || 1.2, rest: null, own: null };
    // pawns: hide the rest pose arms, give them two arms of their own that can go up
    const rest = rig?.getObjectByName('poseRest');
    if (!arms.length && rest) {
      const box = new THREE.Box3();
      rest.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().translate(o.position)); } });
      const head = rig.getObjectByName('head');
      if (!box.isEmpty() && head) {
        const w = box.max.y - box.min.y, len = w * 3.2, sy = head.position.y - w * 0.55, sx = w * 1.5 + 0.006;
        const pal = PAWN_ARMS[side];
        c.own = [];
        for (const s of [-1, 1]) {
          const pivot = new THREE.Group();
          pivot.position.set(s * sx, sy, 0);
          const sleeve = new THREE.Mesh(geo, armMat(pal.sleeve)); sleeve.scale.set(w, len, w); sleeve.position.y = len / 2 - w / 2;
          const hand = new THREE.Mesh(geo, armMat(pal.hand)); hand.scale.set(w * 1.06, w * 0.6, w * 1.06); hand.position.y = len - w / 2 + w * 0.3 + 0.002;
          pivot.add(sleeve, hand);
          pivot.userData.s = s;
          c.own.push(pivot);
        }
        c.rest = { o: rest, v: rest.visible };
      }
    }
    cheer.push(c);
  }
  const matedKing = pieces.find((o) => o.userData.piece.color === loser && o.userData.piece.type === 'k' && onBoard(o));

  // ---------------------------------------------------------------- the shot
  // from behind the winners towards the tower, a little to the side; the winners turn round to face it (a three quarter view)
  const Wc = new THREE.Vector3();
  for (const c of cheer) Wc.add(c.wrap.position);
  if (cheer.length) Wc.multiplyScalar(1 / cheer.length); else Wc.set(-TOWER.x * 0.5, 0, -TOWER.z * 0.5);
  // the swing round from the player's view is kept short (at most 100 degrees; a phone, whose tall frame needs the
  // winners and the tower in line, swings fully): from the far side the shot looks across
  const wantYaw = Math.atan2(Wc.x - TOWER.x, Wc.z - TOWER.z) - (portrait ? 0.2 : 0.4);
  const yaw0 = controls?.camera?.yaw ?? wantYaw, swing = portrait ? Math.PI : 1.75;
  const camYaw = yaw0 + Math.max(-swing, Math.min(swing, wrapPi(wantYaw - yaw0)));
  const pitch = portrait ? 0.6 : 0.38;                     // a phone looks down more: the board fills the tall frame, less empty sky
  const latX = Math.cos(camYaw), latZ = -Math.sin(camYaw);

  // the rockets: bursts in the open sky above the tower and to its right (the side away from the floating islands' trees in the
  // default island), a little towards the camera so nothing hides them
  const toCam = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
  const PLAN = [
    { at: 0.3, l: 1.6, h: 1.6, a: 0.5, kind: 'sphere' },
    { at: 0.6, l: 2.6, h: 0.9, a: 0.9, kind: 'ring' },
    { at: 0.95, l: 1.2, h: 2.4, a: 1.3, kind: 'sphere', big: true },
    { at: 1.35, l: 3.4, h: 1.9, a: 0.8, kind: 'ring' },
    { at: 1.75, l: 0.3, h: 2.6, a: 0.6, kind: 'sphere' },
    { at: 2.15, l: 2.0, h: 2.2, a: 1.0, kind: 'sphere', big: true },
    { at: 2.5, l: 0.9, h: 1.2, a: 0.4, kind: 'ring' },
  ];
  const plan = lite ? [PLAN[0], PLAN[2], PLAN[4], PLAN[5]] : PLAN;
  const rockets = plan.map((r, i) => {
    const to = new THREE.Vector3(TOWER.x + latX * r.l + toCam.x * r.a, TOP * 0.85 + r.h * 0.8, TOWER.z + latZ * r.l + toCam.z * r.a);
    const from = new THREE.Vector3(TOWER.x + latX * (r.l * 0.7 + (r.l < 0 ? -0.9 : 0.9)) + toCam.x * (r.a + 0.4), 0.1, TOWER.z + latZ * (r.l * 0.7 + (r.l < 0 ? -0.9 : 0.9)) + toCam.z * (r.a + 0.4));
    const pal = [...W.fire, ...GOLD];
    return { ...r, i, from, to, climb: 0.6, head: null, fired: false, burst: false, trail: 0,
      c1: pal[(i * 3) % pal.length], c2: GOLD[i % GOLD.length], c3: W.fire[(i * 2 + 1) % W.fire.length] };
  });

  // Two fitted poses. The opening one (the swoop) is high, so the camera passes above trees and leaf blocks on its way round,
  // and wide, with the first bursts. Once the tower starts to rise the camera glides down and in to the close one: winners head
  // to feet with room, the mated king, the tower with its flag and where it falls, the bursts' centres (their rims may leave
  // the frame). On a phone the side margins are wider, the controls' own touch framing shifts the picture a little.
  const pts = [];
  const add = (x, y, z) => pts.push(new THREE.Vector3(x, y, z));
  for (const c of cheer) { const p = c.wrap.position; add(p.x + latX * 0.4, -0.05, p.z + latZ * 0.4); add(p.x - latX * 0.4, -0.05, p.z - latZ * 0.4); add(p.x, c.h + 0.75, p.z); }
  if (matedKing) { const p = matedKing.position; add(p.x + latX * 0.7, 0, p.z + latZ * 0.7); add(p.x - latX * 0.7, 0.5, p.z - latZ * 0.7); }
  for (const s of [-1, 1]) { add(TOWER.x + latX * s * 1.1, 0, TOWER.z + latZ * s * 1.1); add(TOWER.x + latX * s * 1.1, TOP + 0.9, TOWER.z + latZ * s * 1.1); }
  add(TOWER.x + fallX * TOP, 0, TOWER.z + fallZ * TOP);
  const close = pts.slice();
  close.push(new THREE.Vector3(TOWER.x, TOP + 1.8, TOWER.z));     // some sky over the tower for the bursts
  for (const r of rockets) { add(r.to.x + latX * 0.8, r.to.y + 0.6, r.to.z + latZ * 0.8); add(r.to.x - latX * 0.8, r.to.y, r.to.z - latZ * 0.8); }
  const marg = portrait ? { mx: 0.18, top: 0.06, bottom: 0.08, low: 0.5 } : { mx: 0.05, top: 0.04, bottom: 0.06 };
  const wide = fitShot(close, camYaw, 0.7, aspect, marg);   // high enough to pass over leaf blocks, not much further out
  const near = fitShot(close, camYaw, pitch, aspect, marg);
  // controls.cinematic pulls narrow screens back by max(1, 0.75 / aspect): ask for that much less
  const narrow = Math.max(1, 0.75 / aspect);
  const poseA = { target: wide.target, yaw: camYaw, pitch: 0.7, dist: wide.dist * 1.05 / narrow };
  const poseB = { target: near.target, yaw: camYaw, pitch, dist: near.dist / narrow };
  const shot = near;

  // the wave runs across the camera's view; each winner turns to face the camera, a little to its side
  for (const c of cheer) c.lat = c.wrap.position.x * latX + c.wrap.position.z * latZ;
  const lats = cheer.map((c) => c.lat), lo = Math.min(...lats, 0), hi = Math.max(...lats, 0);
  for (const c of cheer) {
    c.delay = 0.35 + 0.55 * ((c.lat - lo) / Math.max(1e-3, hi - lo)) + rnd() * 0.06;
    const facing = Math.PI + (c.wrap.children[0]?.rotation.y || 0);   // a rig looks to -z; the inner turn adds pi for black, a quarter for knights
    const toCamera = Math.atan2(shot.target.x + toCam.x * 50 - c.wrap.position.x, shot.target.z + toCam.z * 50 - c.wrap.position.z);
    c.turn = wrapPi(toCamera - 0.45 - facing);
  }

  // ---------------------------------------------------------------- the cubes
  const MAX = 900;
  const matSolid = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  const matGlow = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const solid = new THREE.InstancedMesh(geo, matSolid, MAX);
  const glow = new THREE.InstancedMesh(geo, matGlow, 200);
  for (const m of [solid, glow]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); }
  solid.name = 'finale-cubes'; glow.name = 'finale-glow'; glow.renderOrder = 5;
  solid.setColorAt(0, new THREE.Color()); glow.setColorAt(0, new THREE.Color());

  const parts = [];                   // free cubes: debris, dust, sparks, firework stars
  const glows = [];                   // glowing cubes: rocket heads, trails, sparkles
  const tmpC = new THREE.Color(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), dq = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
  let peak = 0;

  function spawn(o) {
    const p = {
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0.08, sy: 0.08, sz: 0.08, c: 0xffffff, age: 0, life: 1.2, g: -9, drag: 0.3,
      bounce: 0.25, floor: 0, q: null, wx: (rnd() - 0.5) * 8, wy: (rnd() - 0.5) * 8, wz: (rnd() - 0.5) * 8,
      fade: 0.35, still: false, heap: false, k: rnd(), ...o,
    };
    if (!p.q) p.q = new THREE.Quaternion().setFromEuler(tmpE.set(rnd() * TAU, rnd() * TAU, rnd() * TAU));
    parts.push(p);
    return p;
  }
  function spawnGlow(o) { const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.12, c: 0xfff1d0, age: 0, life: 0.3, ...o }; glows.push(p); return p; }
  function puff(x, y, z, count, { spread = 1, speed = [0.4, 1.3], size = [0.06, 0.12], life = [0.5, 0.9], colors = DUST, up = 0.8, g = -3, drag = 1.6 } = {}) {
    for (let i = 0, c = n(count); i < c; i++) {
      const a = rnd() * TAU, s = speed[0] + rnd() * (speed[1] - speed[0]), sz2 = size[0] + rnd() * (size[1] - size[0]);
      spawn({ x: x + Math.cos(a) * 0.3 * spread, y, z: z + Math.sin(a) * 0.3 * spread, vx: Math.cos(a) * s * spread, vy: up * s + rnd() * 0.6, vz: Math.sin(a) * s * spread,
        sx: sz2, sy: sz2, sz: sz2, c: colors[(rnd() * colors.length) | 0], life: life[0] + rnd() * (life[1] - life[0]), g, drag, bounce: 0.15, fade: 0.6 });
    }
  }

  // ---------------------------------------------------------------- the tower: a 5 x 5 keep of stones, hollow, with a cap, battlements, a banner and a flag
  const bricks = [];                  // { lx, ly, lz, w, h, d, c, rot (about local z), at (crack slabs appear) }
  const brick = (ix, iy, iz, c) => bricks.push({ lx: ix * CELL, ly: (iy + 0.5) * CELL, lz: iz * CELL, w: CELL * 0.985, h: CELL * 0.985, d: CELL * 0.985, c });
  const stone = () => L.stone[(rnd() * L.stone.length) | 0];
  for (let iy = 0; iy < ROWS; iy++) {
    for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) {
      const ring = Math.abs(ix) === 2 || Math.abs(iz) === 2;
      if (!ring && iy !== ROWS - 1) continue;              // hollow below, a cap on top
      let c = stone();
      const front = iz === 2, back = iz === -2;
      if (front && ix === 0 && iy <= 1) c = L.door;        // the door
      if (front && Math.abs(ix) === 1 && (iy === 7 || iy === 3)) c = L.window;
      if ((back || Math.abs(ix) === 2) && !front && iy === 7 && (ix === 0 || iz === 0)) c = L.window;
      if (iy === ROWS - 1 && ring) c = L.dark;             // a darker ledge under the battlements
      brick(ix, iy, iz, c);
    }
  }
  for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) {          // battlements: every other stone of the ring
    if (!(Math.abs(ix) === 2 || Math.abs(iz) === 2) || (ix + iz) % 2 !== 0) continue;
    brick(ix, ROWS, iz, stone());
  }
  // the banner of the side on the front face: cloth a little in front of the wall, a trim line, a notched lower edge
  const FZ = 2.5 * CELL + 0.03;
  for (let iy = 4; iy <= 10; iy++) for (const ix of [-1, 0]) {
    if (iy === 4 && ix === 0) continue;
    bricks.push({ lx: (ix - 0.5) * CELL + CELL * 0.5, ly: (iy + 0.5) * CELL, lz: FZ, w: CELL * 0.98, h: CELL * 0.98, d: 0.04, c: iy === 5 ? L.trim : L.banner });
  }
  for (let k = 0; k < 4; k++) bricks.push({ lx: 0, ly: TOP + 0.08 + k * 0.16 + 0.002, lz: 0, w: 0.06, h: 0.16, d: 0.06, c: 0x8a5f33 });   // the pole
  for (let fx = 0; fx < 3; fx++) for (let fy = 0; fy < 2; fy++) bricks.push({ lx: 0.11 + fx * 0.16, ly: TOP + 0.42 + fy * 0.14, lz: 0, w: 0.16, h: 0.14, d: 0.035, c: fy === 0 && fx === 2 ? L.trim : L.banner, flag: fx });
  // three zigzag cracks on the front, in front of wall and banner, each slab a little further out than the last (no shared planes)
  const CZ = FZ + 0.045, SEG = 0.34;
  [[-0.42, TOP * 0.92, 1], [0.2, TOP * 0.7, -1], [0.55, TOP * 0.97, 1]].forEach(([x0, y0, sgn], ci) => {
    let x = x0, y = y0;
    for (let k = 0; k < 5; k++) {
      const rot = (k % 2 ? 0.55 : -0.55) * sgn, dx = -Math.sin(rot), dy = Math.cos(rot);
      bricks.push({ lx: x - dx * SEG / 2, ly: y - dy * SEG / 2, lz: CZ + (k % 2) * 0.007 + ci * 0.002, w: 0.075, h: SEG + 0.04, d: 0.03, c: CRACK_C, rot, at: T_CRACK + ci * 0.1 + k * 0.05 });
      x -= dx * SEG; y -= dy * SEG;
      if (Math.abs(x) > 0.7) x = Math.sign(x) * 0.7;
    }
  });

  // ---------------------------------------------------------------- the tower over time
  const M = new THREE.Matrix4(), Mb = new THREE.Matrix4(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4();
  // rise, shake and topple: T(place, rise) * Ry(yaw + fallA) * pivot(Rz(-topple)) * Rx(shake) * Rz(shake) * Ry(-fallA)
  function towerMatrix(tt, out) {
    const up = clamp01((tt - T_RISE) / RISE);
    const rise = (outBack(up) - 1) * (TOP + 1.0);           // starts below the grass, overshoots a little, settles
    let sx = 0, sz2 = 0, top = 0;
    if (tt > T_RISE + RISE) { const k = clamp01((tt - T_RISE - RISE) / 0.3); sx += 0.012 * Math.sin(tt * 30) * (1 - k); }   // the landing judder
    if (tt > T_CRACK) {
      const k = clamp01((tt - T_CRACK) / CRACK), calm = 1 - clamp01((tt - T_FALL) / 0.15);
      const amp = (0.025 + 0.035 * k) * calm;
      sx = amp * Math.sin((tt - T_CRACK) * 41); sz2 = amp * 0.8 * Math.sin((tt - T_CRACK) * 29 + 1);
    }
    if (tt > T_FALL) { const k = clamp01((tt - T_FALL) / TOPPLE); top = TIP * k * k; }   // tips over, faster and faster
    const piv = 2.5 * CELL;
    out.makeTranslation(TOWER.x, rise, TOWER.z);
    out.multiply(mA.makeRotationY(towerYaw + fallA));
    out.multiply(mA.makeTranslation(piv, 0, 0)).multiply(mA.makeRotationZ(-top)).multiply(mA.makeTranslation(-piv, 0, 0));
    out.multiply(mA.makeRotationX(sx)).multiply(mA.makeRotationZ(sz2));
    out.multiply(mA.makeRotationY(-fallA));
    return out;
  }
  // the matrix of one brick (unit box scaled to it) under the tower matrix
  function brickMatrix(b, TM, out) {
    let z = b.lz;
    if (b.flag != null) z += Math.sin(t * 9 - b.flag * 1.3) * 0.03 * (b.flag + 1);   // the flag flutters
    out.copy(TM).multiply(mB.makeTranslation(b.lx, b.ly, z));
    if (b.rot) out.multiply(mB.makeRotationZ(b.rot));
    let g = 1;
    if (b.at != null) g = clamp01((t - b.at) / 0.06);       // a crack slab snaps open
    return out.multiply(mB.makeScale(b.w, b.h * Math.max(0.001, g), b.d));
  }

  // ---------------------------------------------------------------- state, banner, input
  let t = 0, done = false, towerFallen = 0;
  const sounds = new Set();
  const once = (key, fn) => { if (!sounds.has(key)) { sounds.add(key); fn(); } };
  const banner = typeof document !== 'undefined' ? document.getElementById('banner') : null;
  if (banner) banner.hidden = true;
  const report = () => { if (win) win.__finale = { running: !done, t, side, tower: towerFallen, peak, at: [TOWER.x, TOWER.z, fallAng] }; };
  report();
  controls?.cinematic?.({ ...poseA, dur: CAM_IN });
  const camTarget = new THREE.Vector3();
  // the glide from the high opening pose to the close one, driven every frame (each call holds the pose, no blend of its own)
  function cameraStep() {
    if (t < CAM_GLIDE || t > CAM_GLIDE + GLIDE + 0.05 || cameraBack) return;
    const k = smooth(clamp01((t - CAM_GLIDE) / GLIDE));
    camTarget.lerpVectors(poseA.target, poseB.target, k);
    controls?.cinematic?.({ target: camTarget, yaw: camYaw, pitch: poseA.pitch + (poseB.pitch - poseA.pitch) * k, dist: poseA.dist + (poseB.dist - poseA.dist) * k, dur: 0.001 });
  }
  let cameraBack = false;

  const onSkip = (e) => {
    if (done) return;
    if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    e.preventDefault?.(); e.stopImmediatePropagation?.();
    finish({ showBanner: true, camDur: 0.3 });
  };
  if (win?.addEventListener) { win.addEventListener('pointerdown', onSkip, true); win.addEventListener('keydown', onSkip, true); }
  game.on?.('newgame', () => { if (!done) finish({ showBanner: false, camDur: 0.3 }); });
  game.on?.('undo', () => { if (!done) finish({ showBanner: false, camDur: 0.3 }); });

  function finish({ showBanner = true, camDur = BACK } = {}) {
    if (done) return;
    done = true;
    if (win?.removeEventListener) { win.removeEventListener('pointerdown', onSkip, true); win.removeEventListener('keydown', onSkip, true); }
    for (const c of cheer) {
      c.wrap.position.y = c.y; c.wrap.scale.copy(c.s); c.wrap.quaternion.copy(c.wq);
      c.arms.forEach((a, i) => a.quaternion.copy(c.q[i]));
      if (c.own) for (const p of c.own) p.removeFromParent();
      if (c.rest) c.rest.o.visible = c.rest.v;
    }
    for (const m of [solid, glow]) { m.removeFromParent(); m.dispose(); }
    geo.dispose(); matSolid.dispose(); matGlow.dispose();
    for (const m of armMats.values()) m.dispose();
    parts.length = 0; glows.length = 0; bricks.length = 0;
    if (!cameraBack) { cameraBack = true; controls?.restore?.({ dur: camDur }); }
    if (banner && showBanner) banner.hidden = false;
    report();
  }

  // ---------------------------------------------------------------- the fall
  const heap = new Map();             // heights of the heap of fallen stones on a 0.14 grid
  const cellKey = (x, z) => `${Math.round(x / 0.14)},${Math.round(z / 0.14)}`;
  let fallen = false;
  // the stones keep the speed they had in the topple (a little less), spread a little, and tumble down into a heap
  function collapse() {
    fallen = true;
    towerMatrix(t, M); towerMatrix(t - 0.02, Mb);
    const p1 = new THREE.Vector3(), p0 = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const b of bricks) {
      if (b.at != null) continue;                            // the cracks go with the wall
      brickMatrix(b, M, tmpM).decompose(p1, q, s);
      brickMatrix(b, Mb, tmpM).decompose(p0, tmpQ, tmpS);
      const hk = b.ly / TOP;
      spawn({
        x: p1.x, y: p1.y, z: p1.z, sx: b.w, sy: b.h, sz: b.d, c: b.c, q: q.clone(),
        vx: (p1.x - p0.x) / 0.02 * 0.85 + (rnd() - 0.5) * 0.7, vy: (p1.y - p0.y) / 0.02 * 0.5 + rnd() * 0.9 * hk, vz: (p1.z - p0.z) / 0.02 * 0.85 + (rnd() - 0.5) * 0.7,
        wx: (rnd() - 0.5) * 7, wy: (rnd() - 0.5) * 5, wz: (rnd() - 0.5) * 7, g: -13, drag: 0.15, bounce: 0.22, life: 99, heap: true,
      });
    }
  }
  // a stone that comes down next to a piece is pushed clear of it, so nothing clips through the pieces
  function clearOfPieces(p) {
    for (const o of pieces) {
      const dx = p.x - o.position.x, dz = p.z - o.position.z, d = Math.hypot(dx, dz), R = 0.42 + Math.max(p.sx, p.sz) * 0.5;
      if (d < R) { const k = R / Math.max(1e-3, d); p.x = o.position.x + (d < 1e-3 ? R : dx * k); p.z = o.position.z + dz * (d < 1e-3 ? 0 : k); }
    }
  }

  // ---------------------------------------------------------------- the cheer
  function cheerPose() {
    const env = 1 - smooth(clamp01((t - 3.4) / 0.4));         // everyone settles before the camera goes back
    for (const c of cheer) {
      const lt = t - c.delay;
      if (lt < 0) continue;
      const on = smooth(clamp01(lt / 0.25)) * env;
      const per = 0.5, ph = (lt % per) / per;
      const hop = Math.sin(Math.PI * ph);
      c.wrap.position.y = c.y + hop * 0.42 * on;
      const squash = ph < 0.12 ? (1 - ph / 0.12) : ph > 0.9 ? (ph - 0.9) / 0.1 : 0;    // a short squash at each landing
      c.wrap.scale.set(c.s.x * (1 + 0.1 * squash * on), c.s.y * (1 - 0.14 * squash * on), c.s.z * (1 + 0.1 * squash * on));
      // turn to the camera; pieces that cannot raise arms add a happy twirl on every second hop
      let turn = c.turn * smooth(clamp01(lt / 0.35)) * env;
      if (!c.arms.length && !c.own && Math.floor(lt / per) % 2 === 1) turn += smooth(ph) * TAU * on;
      c.wrap.quaternion.copy(c.wq);
      c.wrap.rotateY(turn);
      // arms: straight up over the head at the top of each hop, a little open at the landing
      const lift = (2.6 + 0.5 * hop) * on, open = (0.1 + 0.3 * (1 - hop)) * on;
      c.arms.forEach((a, i) => {
        a.rotation.x = a.rotation.x * (1 - on) - lift;
        a.rotation.z = a.rotation.z * (1 - on) + (i === 0 ? open : -open);
      });
      if (c.own) {
        const up = on > 0.02;
        if (up && !c.own[0].parent) { for (const p of c.own) c.rig.add(p); c.rest.o.visible = false; }
        if (!up && c.own[0].parent) { for (const p of c.own) p.removeFromParent(); c.rest.o.visible = c.rest.v; }
        for (const p of c.own) p.rotation.set(0, 0, -p.userData.s * (0.12 + 0.3 * (1 - hop) * on + (1 - on) * 2.7));   // swings up from hanging at the side
      }
    }
  }

  // ---------------------------------------------------------------- the fireworks
  function burst(r) {
    const count = n(r.big ? 62 : 44);
    const sp = r.big ? 4.3 : 3.5;
    const tilt = 0.5 + rnd() * 0.4;
    for (let i = 0; i < count; i++) {
      let dx, dy, dz;
      if (r.kind === 'ring') {
        // a ring in the plane facing the camera, tipped back a little
        const a = (i / count) * TAU, u = Math.cos(a), v = Math.sin(a);
        dx = u * latX + v * Math.sin(tilt) * -toCam.x; dz = u * latZ + v * Math.sin(tilt) * -toCam.z; dy = v * Math.cos(tilt);
      } else {
        const k = (i + 0.5) / count, phi = Math.acos(1 - 2 * k), th = i * 2.39996;
        dx = Math.sin(phi) * Math.cos(th); dy = Math.cos(phi); dz = Math.sin(phi) * Math.sin(th);
      }
      const s = sp * (0.92 + rnd() * 0.16);
      const c = i % 5 === 0 ? r.c2 : i % 2 ? r.c1 : r.c3;
      const size = (r.big ? 0.14 : 0.12) * (0.85 + rnd() * 0.3);
      spawn({ x: r.to.x, y: r.to.y, z: r.to.z, vx: dx * s, vy: dy * s + 0.4, vz: dz * s, sx: size, sy: size, sz: size, c, g: -2.6, drag: 1.9, bounce: 0, life: 1.1 + rnd() * 0.35, fade: 0.45, floor: -50 });
    }
    // an inner sparkle of small glowing gold cubes
    for (let i = 0, c = n(r.big ? 14 : 9); i < c; i++) {
      const a = rnd() * TAU, b = Math.acos(2 * rnd() - 1), s = 1.0 + rnd() * 1.4;
      spawnGlow({ x: r.to.x, y: r.to.y, z: r.to.z, vx: Math.sin(b) * Math.cos(a) * s, vy: Math.cos(b) * s, vz: Math.sin(b) * Math.sin(a) * s, s: 0.07, c: 0xffe9a6, life: 0.35 + rnd() * 0.25 });
    }
  }
  function rocketsStep(dt) {
    for (const r of rockets) {
      const lt = t - r.at;
      if (lt < 0 || r.burst) continue;
      if (!r.fired) { r.fired = true; if (r.i === 0 || r.i === 3) say('whoosh'); }
      const k = clamp01(lt / r.climb), e = outQuad(k);
      const x = r.from.x + (r.to.x - r.from.x) * e, y = r.from.y + (r.to.y - r.from.y) * e, z = r.from.z + (r.to.z - r.from.z) * e;
      if (!r.head) r.head = spawnGlow({ s: 0.1, c: 0xffc860, life: 99 });
      r.head.x = x; r.head.y = y; r.head.z = z;
      r.trail += dt;
      while (r.trail > 0.02) {
        r.trail -= 0.02;
        spawnGlow({ x: x + (rnd() - 0.5) * 0.05, y: y - 0.06, z: z + (rnd() - 0.5) * 0.05, s: 0.08, c: rnd() < 0.5 ? 0xffbf5a : 0xffe9a6, life: 0.3, vy: -0.5 });
      }
      if (k >= 1) {
        r.burst = true; r.head.life = 0;
        burst(r);
        if (r.i === 0 || r.i === 5) say('magic');
      }
    }
  }

  // ---------------------------------------------------------------- one frame
  const edge = (period) => ((t / period) | 0) !== (((t - 1e-6 - lastDt) / period) | 0);
  let lastDt = 0;
  function step(dt) {
    lastDt = dt;
    t += dt;
    // the rise: grass and dirt thrown up round the foot of the tower
    if (t > T_RISE && t < T_RISE + RISE * 0.85) {
      once('rise', () => say('thud'));
      if (edge(0.05)) {
        for (let i = 0; i < n(3); i++) {
          const a = rnd() * TAU, rr = 0.85 + rnd() * 0.2, s = 0.7 + rnd() * 1.1;
          const sz2 = 0.07 + rnd() * 0.07;
          spawn({ x: TOWER.x + Math.cos(a) * rr, y: 0.05, z: TOWER.z + Math.sin(a) * rr, vx: Math.cos(a) * s, vy: 2.2 + rnd() * 1.8, vz: Math.sin(a) * s,
            sx: sz2, sy: sz2, sz: sz2, c: SOIL[(rnd() * SOIL.length) | 0], g: -12, drag: 0.4, bounce: 0.25, life: 0.9 + rnd() * 0.3, fade: 0.3 });
        }
      }
    }
    // the crack beat: the cracks snap open (brickMatrix), the tower shakes (towerMatrix), chunks fall off the battlements
    if (t > T_CRACK && !fallen) {
      once('crack', () => say('crack'));
      if (t < T_FALL + 0.1 && edge(0.09)) {
        towerMatrix(t, M);
        for (let i = 0; i < n(2); i++) {
          const lx = (rnd() - 0.5) * 1.3, lz = (rnd() < 0.5 ? -1 : 1) * 0.68;
          const p = new THREE.Vector3(lx, TOP + 0.1, lz).applyMatrix4(M);
          const c = stone(), s2 = 0.1 + rnd() * 0.08;
          spawn({ x: p.x, y: p.y, z: p.z, vx: (rnd() - 0.5) * 0.8, vy: 0.3 + rnd() * 0.6, vz: (rnd() - 0.5) * 0.8, sx: s2, sy: s2, sz: s2, c, g: -13, drag: 0.1, bounce: 0.25, life: 99, heap: true });
        }
      }
    }
    if (t >= T_BREAK && !fallen) {
      collapse();
      say('thud'); say('shatter');
      const d = TOP * 0.6;                                   // dust where it hits the grass
      puff(TOWER.x + fallX * d, 0.1, TOWER.z + fallZ * d, 30, { spread: 2.4, speed: [0.6, 1.7], size: [0.08, 0.16], life: [0.8, 1.2], up: 0.6 });
    }
    towerFallen = fallen ? 0.5 + 0.5 * clamp01((t - T_BREAK) / 0.5) : 0.5 * clamp01((t - T_FALL) / TOPPLE);
    rocketsStep(dt);
    cheerPose();
    cameraStep();
    if (t >= T_BACK && !cameraBack) { cameraBack = true; controls?.restore?.({ dur: BACK }); }

    // free cubes
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (!p.still) {
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.q.premultiply(dq.setFromEuler(tmpE.set(p.wx * dt, p.wy * dt, p.wz * dt)));
        const hh = Math.max(p.sx, p.sy, p.sz) * 0.5;
        const floor = p.heap ? heap.get(cellKey(p.x, p.z)) ?? ground(p.x, p.z) : p.floor;
        if (p.y - hh < floor) {
          if (p.heap) clearOfPieces(p);
          p.y = floor + hh;
          if (p.vy < -1.6 && p.bounce > 0) {
            p.vy = -p.vy * p.bounce; p.vx *= 0.62; p.vz *= 0.62; p.wx *= 0.5; p.wy *= 0.5; p.wz *= 0.5;   // stones skid on along the fall
          } else if (p.heap) {
            // it comes to rest: lies flat with its own turn, the heap grows under it
            p.still = true; p.vx = p.vy = p.vz = 0;
            p.q.setFromEuler(tmpE.set((rnd() - 0.5) * 0.25, rnd() * TAU, (rnd() - 0.5) * 0.25));
            p.y = floor + p.sy * 0.5 + 0.004;
            heap.set(cellKey(p.x, p.z), floor + p.sy * 0.8 + 0.006 * rnd());
            p.base = ground(p.x, p.z);
          } else { p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; p.wx = p.wy = p.wz = 0; }
        }
      }
      if (p.age >= p.life || p.y < -8) parts.splice(i, 1);
    }
    for (let i = glows.length - 1; i >= 0; i--) {
      const g = glows[i];
      g.age += dt;
      g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      if (g.age >= g.life) glows.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- draw into the instances
  function draw() {
    let k = 0;
    if (!fallen && t > T_RISE) {
      towerMatrix(t, M);
      for (const b of bricks) {
        if (k >= MAX) break;
        if (b.at != null && t < b.at) continue;
        brickMatrix(b, M, tmpM);
        if (tmpM.elements[13] + b.h < -0.05) continue;       // still under the grass
        solid.setMatrixAt(k, tmpM);
        solid.setColorAt(k, tmpC.setHex(b.c));
        k++;
      }
    }
    // the heap sinks into the grass at the end: every stone goes down and shrinks with it, so none is left hanging
    const sinkAt = (p) => clamp01((t - T_SINK - p.k * 0.12) / SINK);
    for (const p of parts) {
      if (k >= MAX) break;
      let s, y = p.y;
      if (p.heap) {
        const sk = Math.ceil(sinkAt(p) * 4) / 4;              // in pixel steps
        s = 1 - sk; y = (p.base || 0) + (p.y - (p.base || 0)) * (1 - sk);
      } else s = Math.ceil((1 - clamp01((p.age / p.life - (1 - p.fade)) / p.fade)) * 4) / 4;
      if (s <= 0) continue;
      tmpP.set(p.x, y, p.z);
      tmpS.set(p.sx * s, p.sy * s, p.sz * s);
      solid.setMatrixAt(k, tmpM.compose(tmpP, p.q, tmpS));
      solid.setColorAt(k, tmpC.setHex(p.c));
      k++;
    }
    solid.count = k;
    let g = 0;
    tmpQ.setFromEuler(tmpE.set(0.6, 0.7, 0));
    for (const p of glows) {
      if (g >= 200) break;
      const u = clamp01(p.age / p.life);
      const s = p.life > 50 ? p.s : p.s * (1 - u);
      tmpP.set(p.x, p.y, p.z); tmpS.setScalar(Math.max(0.001, s));
      glow.setMatrixAt(g, tmpM.compose(tmpP, tmpQ, tmpS));
      glow.setColorAt(g, tmpC.setHex(p.c));
      g++;
    }
    glow.count = g;
    for (const m of [solid, glow]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    peak = Math.max(peak, k + g);
  }

  return {
    update(dt) {
      if (done) { report(); return false; }
      const d = Math.min(0.1, Math.max(0, dt || 0));
      try {
        step(d);
        if (!done) draw();
      } catch (e) {
        console.warn('finale failed', e);
        finish({ showBanner: true, camDur: 0.3 });
        return false;
      }
      if (t >= DUR) { finish({ showBanner: true }); return false; }
      report();
      return true;
    },
    skip() { finish({ showBanner: true, camDur: 0.3 }); },
  };
}
