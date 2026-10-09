// The living island (CHE-372, on every island): animals graze and wander on the free grass, villagers stroll round the board,
// stop to watch the game and cheer, a fisher casts into the water where there is some, a flock of birds circles high and far round the
// island (a second, smaller one under its rim), and spray (or glowing embers) dances at every waterfall and lava fall. World.js calls createLife once the island, its trees,
// clouds and sky are built, then update(dt, time) every frame and dispose() before it frees the world's geometries.
// Pixelwelt look: meshed boxes with the fixed per face shade on the flat unlit material, positions in eighths of a block, poses
// stepped at 8 frames per second. Deterministic: the whole state is a pure function of the world's time (plans are made once from a
// seeded random). light (phone, quality low): fewer creatures, birds and particles.
import * as THREE from 'three';
import { SPECIES, PX, meshPart, ROD, CROOK, LINE, BOBBER } from './alive-models.js';
import { readGround, subNav, plan, segAt, segAtS, wrapA } from './alive-nav.js';
import { createFlocks, createSpray } from './alive-fx.js';

const FPS = 8;
const SNAP = 1 / 8;
const snap = (v) => Math.round(v / SNAP) * SNAP;
const YAW_STEP = Math.PI / 16;
const PHONE = 1.15;
const SCALE = { sheep: 0.9, brownSheep: 0.9, pig: 0.9, goat: 0.9, hen: 0.8, chick: 0.8, cat: 0.85, duck: 0.8, duckling: 0.8, crab: 0.8, farmer: 0.95, girl: 0.92, fisher: 0.95 };
const ACTS = { sheep: ['graze', 'graze', 'look', 'hop'], brownSheep: ['graze', 'look', 'graze'], pig: ['graze', 'look', 'graze'], goat: ['graze', 'look', 'hop'], hen: ['peck', 'peck', 'look'], cat: ['sit', 'look', 'sit'], duck: ['dabble', 'look', 'swim'], crab: ['snap', 'look'] };

// who lives where: animals ([species, followers]), villagers, birds
const ROSTER = {
  a: { animals: [['sheep'], ['hen', ['chick', 'chick']], ['pig'], ['brownSheep'], ['cat'], ['sheep']], swim: null, birds: 'swallow' },
  b: { animals: [['crab'], ['cat'], ['hen', ['chick']], ['crab']], swim: ['duck', ['duckling', 'duckling']], birds: 'gull' },
  c: { animals: [['sheep'], ['hen', ['chick', 'chick']], ['pig'], ['cat'], ['sheep']], swim: null, birds: 'swallow' },
  d: { animals: [['sheep'], ['hen', ['chick']], ['pig'], ['brownSheep'], ['cat']], swim: ['duck', ['duckling', 'duckling']], birds: 'gull' },
  e: { animals: [['goat'], ['hen', ['chick']], ['goat'], ['cat']], swim: null, birds: 'swallow' },
  oak: { animals: [], swim: null, birds: 'swallow' },
};
const PEOPLE = ['farmer', 'girl', 'fisher'];

const hashId = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const lcg = (seed) => { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** Life on the island: { group, update(dt, time), dispose(), creatures(), stats() }. */
export function createLife({ group, kit, island = 'd', light = false, ctx } = {}) {
  const root = new THREE.Group();
  root.name = 'life';
  group.add(root);
  const R = (ctx?.rnd || lcg)(372 + hashId(island));
  const G = readGround(group, ctx);
  const geos = [];
  const spec = ROSTER[island] || ROSTER.d;

  // ---- species geometry, built once and shared by every creature of the kind
  const kinds = {};
  const species = (name) => {
    if (kinds[name]) return kinds[name];
    const s = SPECIES[name](), parts = {};
    for (const [pn, p] of Object.entries(s.parts)) { const r = meshPart(p, p.pivot); geos.push(r.geo); parts[pn] = { ...r, pivot: p.pivot }; }
    const sc = (SCALE[name] || 1) * (s.scale || 1) * (light ? PHONE : 1);   // light (phone): a fifth larger so they read on a small screen
    return (kinds[name] = { ...s, parts, sc, r: s.r * sc + (light ? 0 : 0.04) });
  };
  let rodGeo = null;
  const extra = (def) => { const r = meshPart(def); geos.push(r.geo); return r; };

  // ---- a creature: root (position, heading) > rig (scale, bob) > one mesh per part, turned at its pivot
  const creatures = [];
  const make = (name, nav) => {
    const s = species(name), obj = new THREE.Group(), rig = new THREE.Group();
    obj.name = `life-${name}`;
    rig.scale.setScalar(PX * s.sc);
    obj.add(rig);
    const parts = {};
    for (const [pn, p] of Object.entries(s.parts)) {
      const mesh = new THREE.Mesh(p.geo, kit.mats.flat);
      mesh.name = pn; mesh.userData.boxes = p.boxes;
      mesh.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
      rig.add(mesh); parts[pn] = mesh;
    }
    root.add(obj);
    const c = { name, s, obj, rig, parts, nav, ground: nav.y, P: null, lead: null, gap: 0 };
    creatures.push(c);
    return c;
  };

  // ---- where each one lives. Nobody stands behind either back rank, near or far (|x| < 5.5 beyond the board) (from the far side a villager there reads
  // like an extra piece): spectators keep to the flanks or far back. Homes are spread farthest first; then every free cell belongs
  // to the nearest home (each creature has its own sector, so two never walk into each other); idle stops avoid flowers and edges.
  const band = (x, z) => Math.abs(x) < 6 && Math.abs(z) > 4;   // cell centres of cells touching the cone |x| < 5.5, |z| > 4.5 behind either back rank
  const base = G.walk.list.length ? subNav(G.walk, (x, z) => !band(x, z)) : null;
  const taken = [];
  const farFrom = (cands) => {
    let best = null, bd = -1;
    for (const p of cands) {
      const near = taken.reduce((m, q) => Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])), 99);
      if (near < 1.5) continue;   // never two homes on the same spot
      const d = near + R() * 1.5;
      if (d > bd) { bd = d; best = p; }
    }
    if (best) taken.push(best);
    return best;
  };
  const inner = (n, p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => n.has(p[0] + dx, p[1] + dz)) && !(n.flowers || G.walk.flowers).has(n.key(p[0], p[1]));
  const prefer = (list, good) => { const g = list.filter(good); return g.length >= Math.max(12, list.length / 3) ? g : list; };
  const stopsOf = (n) => { const all = (n.list || []).filter((p) => inner(n, p)); return all.length ? all : n.list; };
  const jitter = (nav, p, r) => { const x = p[0] + (R() - 0.5) * 0.3, z = p[1] + (R() - 0.5) * 0.3; return nav.ok(x, z, r) ? [x, z] : p; };
  const toBoard = (at) => Math.atan2(-at[0], -at[1]);

  // fishing spots: free cells beside open water at the walkers' level, the fisher facing the water at the bank
  const spots = [];
  if (base && G.water && Math.abs(G.water.y) < 0.5) {
    for (const p of base.list) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!G.water.has(p[0] + dx, p[1] + dz) || !G.water.has(p[0] + 2 * dx, p[1] + 2 * dz)) continue;
      const at = [p[0] + dx * 0.12, p[1] + dz * 0.12];
      if (base.ok(at[0], at[1], 0.45)) { spots.push({ at, cell: p, yaw: Math.atan2(dx, dz) }); break; }
    }
  }

  // 1) homes: villagers (the fisher by the water when there is some), then animals
  const homes = [];
  const people = base ? PEOPLE.slice(0, light ? 2 : 3) : [];
  const animals = base ? spec.animals.slice(0, light ? 3 : spec.animals.length) : [];
  for (const name of people) {
    const s = species(name), ok = prefer(base.list.filter((p) => base.ok(p[0], p[1], s.r)), (p) => inner(base, p));
    let home;
    if (name === 'fisher' && spots.length) { home = spots[Math.floor(R() * spots.length)].cell; taken.push(home); }
    else home = farFrom(ok.filter((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])) < 9.6).length ? ok.filter((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])) < 9.6) : ok);
    if (home) homes.push({ name, home, person: true });
  }
  for (const [name, followers = []] of animals) {
    const s = species(name), home = farFrom(prefer(base.list.filter((p) => base.ok(p[0], p[1], s.r)), (p) => inner(base, p)));
    if (home) homes.push({ name, home, followers: light ? [] : followers });
  }
  // 2) sectors: every cell to the nearest home on its patch
  const patchOf = new Map();
  (base?.patches || []).forEach((pl, i) => { for (const p of pl) patchOf.set(base.key(p[0], p[1]), i); });
  const owner = (x, z) => {
    const pi = patchOf.get(base.key(x, z));
    let best = -1, bd = Infinity;
    homes.forEach((h, i) => { if (patchOf.get(base.key(h.home[0], h.home[1])) !== pi) return; const d = Math.hypot(x - h.home[0], z - h.home[1]); if (d < bd - 1e-9) { bd = d; best = i; } });
    return best;
  };
  // 3) the creatures and their plans
  homes.forEach((h, i) => {
    const nav = subNav(base, (x, z) => owner(x, z) === i), s = species(h.name), stops = stopsOf(nav);
    if (!stops.length) return;
    const c = make(h.name, nav);
    if (h.person) {
      const mine = spots.filter((sp) => nav.ok(sp.at[0], sp.at[1], s.r));
      const fisher = h.name === 'fisher' && mine.length > 0;
      let cheer = 0;
      c.P = plan(R, nav, h.home, {
        speed: s.speed, r: s.r, loop: 170,
        pick: (RR, at) => {
          const sp = fisher && mine.find((q) => Math.abs(q.at[0] - at[0]) < 1e-6 && Math.abs(q.at[1] - at[1]) < 1e-6);
          if (sp) return { idle: 9 + RR() * 7, act: 'fish', face: sp.yaw, to: jitter(nav, stops[Math.floor(RR() * stops.length)], s.r) };
          const act = h.name === 'girl' ? (cheer++ % 2 ? 'wave' : 'watch') : h.name === 'farmer' ? (cheer++ % 3 === 2 ? 'cheer' : 'watch') : 'watch';
          const to = fisher && RR() < 0.6 ? mine[Math.floor(RR() * mine.length)].at : jitter(nav, stops[Math.floor(RR() * stops.length)], s.r);
          return { idle: 3 + RR() * 5, act, face: toBoard(at), to };
        },
      });
      if (h.name === 'fisher') gear(c, s, nav, fisher);
    } else {
      const acts = ACTS[h.name] || ['look'];
      c.P = plan(R, nav, h.home, { speed: s.speed, r: s.r, loop: 160, pick: (RR) => ({ idle: (h.name === 'hen' || h.name === 'crab' ? 2 : 3) + RR() * 5.5, act: acts[Math.floor(RR() * acts.length)], face: null, to: jitter(nav, stops[Math.floor(RR() * stops.length)], s.r) }) });
      if (c.P.S > 2) h.followers.forEach((fn, k) => {   // young only follow a mother that walks (they trail her path)
        const f = make(fn, nav); f.lead = c; f.gap = 0.65 + k * 0.45;
      });
    }
  });
  // the duck family on the water
  if (spec.swim && G.water) {
    const s = species(spec.swim[0]), home = G.water.list.filter((p) => G.water.ok(p[0], p[1], s.r))[Math.floor(R() * G.water.list.length) % Math.max(1, G.water.list.length)] || G.water.list[0];
    const c = make(spec.swim[0], G.water), acts = ACTS[spec.swim[0]], stops = G.water.list;
    c.P = plan(R, G.water, home, { speed: s.speed, r: s.r, loop: 160, pick: (RR) => ({ idle: 3 + RR() * 5, act: acts[Math.floor(RR() * acts.length)], face: null, to: jitter(G.water, stops[Math.floor(RR() * stops.length)], s.r) }) });
    (light ? spec.swim[1].slice(0, 1) : spec.swim[1]).forEach((fn, k) => { const f = make(fn, G.water); f.lead = c; f.gap = 0.55 + k * 0.4; });
  }

  // the fisher's gear: a rod (line and float hang from its tip while he fishes; pose fixed: arm -0.9, rod +0.35) where there is water
  // to fish in, else a shepherd's crook
  function gear(c, s, nav, fisher) {
    const arm = c.parts.armP;
    if (!fisher) {
      const crook = extra(CROOK), cm = new THREE.Mesh(crook.geo, kit.mats.flat);
      cm.name = 'crook'; cm.userData.boxes = crook.boxes; cm.position.set(0, -3.7, 0.6);
      arm.add(cm);
      return;
    }
    const rod = extra(ROD), rm = new THREE.Mesh(rod.geo, kit.mats.flat);
    rm.name = 'rod'; rm.userData.boxes = rod.boxes; rm.position.set(0, -3.7, 0.6); rm.rotation.x = -0.9;
    arm.add(rm); c.rod = rm;
    const A = -0.9, B = 0.35, rx = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
    const t1 = rx(ROD.tip, B), t2 = rx([t1[0], t1[1] - 3.7, t1[2] + 0.6], A), pv = s.parts.armP.pivot;
    const tip = [pv[0] + t2[0], pv[1] + t2[1], pv[2] + t2[2]], water = (G.water.y - nav.y) / (PX * s.sc);
    const line = extra(LINE), bob = extra(BOBBER);
    const lm = new THREE.Mesh(line.geo, kit.mats.flat), bm = new THREE.Mesh(bob.geo, kit.mats.flat);
    lm.name = 'line'; lm.userData.boxes = line.boxes; lm.position.set(tip[0], tip[1], tip[2]); lm.scale.y = Math.max(0.1, tip[1] - water);
    bm.name = 'float'; bm.userData.boxes = bob.boxes; bm.position.set(tip[0], water, tip[2]);
    c.rig.add(lm, bm); c.line = lm; c.float = bm; c.waterPx = water;
    lm.scale.x = lm.scale.z = 0; bm.scale.setScalar(0);   // folded to nothing until the fisher casts, but drawn: the GPU holds them from the start, so a rebuild finds the same memory whatever the time
  }

  // ---- sky and water
  const flocks = createFlocks({ kit, specs: [
    // the high flock loops behind the island: its near pass (y about 2.5) crosses the sky over the far rim in the orbit and phone views
    { n: light ? 4 : 7, rx: 22, rz: 6, cz: -24, y: 2.5, yFar: 4, period: 44, dir: 1, phase: 0.45, kind: spec.birds, scale: 1.5 },
    // the second flock flies in the band of sky the White view sees over the island's far rim (under the rim, far out)
    { n: light ? 3 : 5, rx: 22, rz: 7, cz: -27, y: -8, yFar: -14, period: 40, dir: -1, phase: 0.55, kind: spec.birds === 'gull' ? 'swallow' : 'gull', scale: 1.7 },
  ] });
  geos.push(...flocks.geos);
  root.add(flocks.group);
  let crater = null;
  for (const [k, c] of G.cols) if (c.liquid === 'lava' && c.top > 1 && (!crater || c.top > crater.y)) crater = { x: Math.floor(k / 1024) - 512 + 0.5, y: c.top, z: (k % 1024) - 512 + 0.5 };
  const spray = G.falls.length || crater ? createSpray({ kit, falls: G.falls, crater, light, R }) : null;
  if (spray) { geos.push(...spray.geos); root.add(spray.group); }
  // never culled: every life geometry reaches the GPU on the first frame, so the GPU memory after a rebuild does not depend on where
  // the creatures walk (the leak checks compare renderer.info); a few dozen small draws more
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });

  // ---- poses, a pure function of the stepped time
  const SW = [0, 1, 0, -1];
  const pose = (c, act, f, tl) => {
    const P = c.parts, k = c.s.kind, sw = act === 'walk' ? SW[f % 4] : 0, px = PX * c.s.sc;
    c.rig.position.y = 0; c.rig.rotation.x = 0;
    if (P.head) { P.head.rotation.set(0, 0, 0); }
    if (k === 'person') {
      P.legN.rotation.x = 0.6 * sw; P.legP.rotation.x = -0.6 * sw;
      P.armN.rotation.set(-0.5 * sw, 0, 0); P.armP.rotation.set((c.name === 'girl' ? 0.2 : 0.5) * sw, 0, 0);
      if (c.rod) c.rod.rotation.x = -0.9;
      if (c.line) { const k = act === 'fish' ? 1 : 0; c.line.scale.x = c.line.scale.z = k; c.float.scale.setScalar(k); }
      if (act === 'walk') c.rig.position.y = (f % 2) * 0.5 * px;
      else if (act === 'fish') {
        P.armP.rotation.x = -0.9; c.rod.rotation.x = 0.35; P.head.rotation.x = 0.15;
        const bite = Math.floor(tl * 0.5) % 5 === 3;   // now and then the float dips
        c.float.position.y = c.waterPx - (bite && f % 2 ? 1 : 0);
      } else {
        const cyc = tl % 6;
        P.head.rotation.y = [0, 0.25, 0.25, 0, -0.25, -0.25][Math.floor(tl * 1.2) % 6];
        if (act === 'cheer' && cyc > 1 && cyc < 2.5) {
          P.armN.rotation.x = -2.9; P.armP.rotation.x = -2.9;
          c.rig.position.y = [0, 2, 3, 2][f % 4] * px;
        } else if (act === 'wave' && cyc > 0.5 && cyc < 3) {
          P.armP.rotation.set(-2.7, 0, [0.35, 0.1, -0.15, 0.1][f % 4]);
        } else if (act === 'watch' && cyc > 4.5) {
          P.armN.rotation.z = 0; P.head.rotation.x = [0, 0.12][f % 2];   // a nod at a good move
        }
      }
      return;
    }
    if (P.legA) {
      const a = k === 'crab' ? 0 : 0.55 * sw;
      P.legA.rotation.set(a, 0, k === 'crab' ? 0.4 * sw : 0); P.legB.rotation.set(-a, 0, k === 'crab' ? -0.4 * sw : 0);
    }
    if (act === 'walk') {
      c.rig.position.y = (f % 2) * 0.5 * px;
      if (k === 'bird') P.head.rotation.x = (f % 2) * 0.25;
      if (k === 'swim') c.rig.position.y = -px;
      if (P.tail) P.tail.rotation.x = 0;
      return;
    }
    const cyc = tl % 3.5;
    if (act === 'graze') P.head.rotation.x = cyc < 2.4 ? 0.75 + (f % 4 < 2 ? 0.1 : 0) : 0;
    else if (act === 'peck') P.head.rotation.x = cyc < 2 && f % 4 < 2 ? 0.9 : 0;
    else if (act === 'look') P.head.rotation.y = [0, 0.5, 0.5, 0, -0.5, -0.5][Math.floor(tl * 1.4) % 6];
    else if (act === 'hop') c.rig.position.y = (cyc < 0.5 ? [0, 2, 3, 2][f % 4] : 0) * px;
    else if (act === 'snap' && P.head) P.head.rotation.x = f % 4 < 2 ? -0.35 : 0;
    else if (act === 'sit') {
      c.rig.rotation.x = -0.3; c.rig.position.y = 1.3 * px; P.head.rotation.x = 0.3;   // up on its haunches: the rump tips down, nothing goes under the grass
      P.head.rotation.y = [0, 0.3, 0.3, 0, 0, -0.3][Math.floor(tl * 0.8) % 6];
    } else if (act === 'dabble') {
      if (cyc < 1.6) { c.rig.rotation.x = 0.55; P.head.rotation.x = 1.0; }
    }
    if (k === 'swim') c.rig.position.y += (Math.floor(tl * 2) % 2 ? -1 : -0.5) * px;
    if (P.tail) P.tail.rotation.z = [0.3, 0.15, 0, -0.15, -0.3, -0.15, 0, 0.15][f % 8];
  };

  const place = (ts) => {
    const f = Math.round(ts * FPS);
    for (const c of creatures) {
      let x, z, yaw, act, tl;
      if (c.lead) {
        const L = c.lead, P = L.P, tt = ((ts % P.L) + P.L) % P.L, g = P.segs[segAt(P, tt)];
        const k = g.t1 > g.t0 ? (tt - g.t0) / (g.t1 - g.t0) : 0, sLead = g.s0 + (g.s1 - g.s0) * k;
        if (P.S > 0) {
          const ss = (((sLead - c.gap) % P.S) + P.S) % P.S, w = P.walks[segAtS(P, ss)], kk = w.s1 > w.s0 ? (ss - w.s0) / (w.s1 - w.s0) : 0;
          x = w.x0 + (w.x1 - w.x0) * kk; z = w.z0 + (w.z1 - w.z0) * kk; yaw = w.yaw1;
        } else { x = g.x0; z = g.z0 - c.gap; yaw = g.yaw1; }
        act = g.act === 'walk' ? 'walk' : c.s.kind === 'swim' ? (g.act === 'dabble' ? 'dabble' : 'look') : 'peck';
        tl = tt - g.t0 + c.gap * 3;
      } else {
        const P = c.P, tt = ((ts % P.L) + P.L) % P.L, g = P.segs[segAt(P, tt)];
        const k = g.t1 > g.t0 ? (tt - g.t0) / (g.t1 - g.t0) : 0;
        x = g.x0 + (g.x1 - g.x0) * k; z = g.z0 + (g.z1 - g.z0) * k;
        const turn = Math.min(1, (tt - g.t0) / 0.375);
        yaw = g.yaw0 + wrapA(g.yaw1 - g.yaw0) * turn;
        act = g.act; tl = tt - g.t0;
      }
      c.obj.position.set(snap(x), c.ground, snap(z));
      c.obj.rotation.y = Math.round((yaw - (c.s.kind === 'crab' ? Math.PI / 2 : 0)) / YAW_STEP) * YAW_STEP;
      c.act = act;
      pose(c, act, f, tl);
    }
    flocks.update(ts);
    spray?.update(ts);
  };

  let last = null;
  const api = {
    group: root,
    update(dt, time) {
      const f = Math.floor(time * FPS);
      if (f === last) return;
      last = f;
      place(f / FPS);
    },
    dispose() {
      root.removeFromParent();
      for (const g of geos) g.dispose();
      spray?.mesh.dispose();
    },
    /** Test hooks: where each creature stands now, how near the flock comes, counts, what it made. */
    creatures: () => creatures.map((c) => ({ family: creatures.indexOf(c.lead || c), name: c.name, x: c.obj.position.x, y: c.obj.position.y, z: c.obj.position.z, r: c.s.r, swim: c.s.kind === 'swim', act: c.act, rot: c.obj.rotation.y })),
    flockNear: () => flocks.near(),
    /** Where every particle is now (test hook). */
    sprayAt: () => { const out = [], M = new THREE.Matrix4(), v = new THREE.Vector3(); for (let i = 0; i < (spray?.count ?? 0); i++) { spray.mesh.getMatrixAt(i, M); v.setFromMatrixPosition(M); const k = new THREE.Vector3().setFromMatrixScale(M).x; out.push({ x: v.x, y: v.y + k / 2, z: v.z }); } return out; },
    flock: flocks.birds.map((b) => b.mesh),
    falls: G.falls.length + (crater ? 1 : 0),
    particles: spray?.count ?? 0,
    created: { geometries: geos, materials: [] },
    stats() {
      let meshes = 0, tris = 0;
      root.traverse((o) => { if (o.isMesh && o.visible) { meshes++; tris += Math.min(o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count, o.geometry.drawRange.count) / 3 * (o.isInstancedMesh ? o.count : 1); } });
      return { meshes, tris, creatures: creatures.length, birds: flocks.birds.length, particles: spray?.count ?? 0 };
    },
  };
  root.userData.life = api;
  place(0);
  return api;
}
