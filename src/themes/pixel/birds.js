// Pixelwelt birds (CHE-238): blocky birds that fly past behind and above the island, drawn like everything else of the theme (meshed
// boxes, flat unlit material with a pixel texture, positions and wing frames stepped like animation frames). Three variants:
//   a  one crow crosses the sky      b  a small flock of five flies in a V      c  a robin lands on the tree, sits a while, flies on
// They fly high (above 6) and far (at least 11 from the board centre), so from the default views they never cover a square; from
// the far side a bird can cross the view for about a second. Automatic (owner's picks, round r27): one flight at a time, the three in a
// random order (each once per round of three), a random 2 to 4 minutes apart, on a timer of their own that moves and taps do not reset;
// only while Living pieces is on and not paused (src/living-state.js). ?birds=a|b|c plays that variant at once and uses it for the
// automatic flights too (test hook).
import * as THREE from 'three';
import { Mesher } from '../blocks/mesher.js';
import { living } from '../../living-state.js';

export const BIRD_VARIANTS = ['a', 'b', 'c'];
export const BIRD_GAP = [120, 240];         // seconds between two automatic flights
const SNAP = 1 / 8;                       // positions step in eighths of a block
const FLAP_FPS = 8;
const SIZE = 4;                        // a bird is about a block and a half to two blocks long: the sky is far away
const COLORS = {
  a: { body: 0x2c2f3d, wing: 0x1d1f2a, beak: 0xe8a63a },
  b: { body: 0xf3f1ea, wing: 0xc9ced6, beak: 0xe8a63a },
  c: { body: 0x8a5a3a, wing: 0x6d4529, beak: 0xe8a63a, breast: 0xd9602f },
};
const snap = (v) => Math.round(v / SNAP) * SNAP;
const ease = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - (1 - x) * (1 - x);
const easeIn = (x) => x * x;
const bez = (a, c, b, t) => new THREE.Vector3().copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * (1 - t) * t).addScaledVector(b, t * t);

// one bird: a group facing +z with body, head (and its beak), tail and two wings that turn at the shoulders
function makeBird(variant, mat) {
  const c = COLORS[variant], g = new THREE.Group();
  g.name = 'bird';
  g.scale.setScalar(SIZE);
  const part = (name, build, pivot = [0, 0, 0]) => {
    const m = new Mesher({ shade: true });
    build(m);
    const geo = m.geometries().get('b');
    geo.translate(-pivot[0], -pivot[1], -pivot[2]);
    const mesh = new THREE.Mesh(geo, mat);
    const grp = new THREE.Group();
    grp.name = name; grp.position.set(...pivot); grp.add(mesh);
    g.add(grp);
    return grp;
  };
  const o = (color) => ({ color, uvUnit: 4 });
  part('body', (m) => {
    m.box('b', -0.13, -0.1, -0.26, 0.26, 0.2, 0.5, o(c.body));
    if (c.breast) m.box('b', -0.131, -0.1, 0.0, 0.262, 0.1, 0.24, o(c.breast));
    m.box('b', -0.1, -0.05, -0.44, 0.2, 0.04, 0.18, o(c.wing));   // tail
  });
  const head = part('head', (m) => {
    m.box('b', -0.09, 0, 0, 0.18, 0.18, 0.18, o(c.body));
    m.box('b', -0.035, 0.05, 0.18, 0.07, 0.05, 0.1, o(c.beak));
    m.box('b', -0.092, 0.1, 0.1, 0.184, 0.04, 0.04, o(0x101010));   // the eye line
  }, [0, 0.05, 0.2]);
  const wing = (name, s) => part(name, (m) => m.box('b', s > 0 ? 0 : -0.55, -0.02, -0.16, 0.55, 0.04, 0.34, o(c.wing)), [s * 0.12, 0.06, 0]);
  const wl = wing('wingL', -1), wr = wing('wingR', 1);
  return { group: g, head, wl, wr, variant };
}

// the paths: pos(t) -> [x, y, z] and heading from the next sample; the bird is shown while 0 <= t <= dur
function flightA() { return { dur: 10, birds: [{ off: [0, 0, 0], at: 0 }], path: (t) => { const u = t / 10; return new THREE.Vector3(-24 + 48 * u, 9.5 + 0.8 * Math.sin(u * 9) + 1.2 * u, -11 - 2 * u); }, flap: () => 1 }; }
function flightB() {
  const offs = [[0, 0, 0], [-2.2, 0.1, -2], [2.2, 0.1, -2], [-4.4, 0.2, -4], [4.4, 0.2, -4]];
  return { dur: 15, birds: offs.map((off, i) => ({ off, at: i * 0.13 })), path: (t) => { const u = t / 15; return new THREE.Vector3(26 - 52 * u, 11.5 + 0.6 * Math.sin(u * 6), -17 + 2 * Math.sin(u * 3)); }, flap: (t) => (Math.sin(t * 0.8) > 0.8 ? 0 : 1) };
}
function flightC(land) {
  const from = new THREE.Vector3(-26, 13, -3), ctl = new THREE.Vector3(-17, 15, -6), away = new THREE.Vector3(24, 14, -15), ctlOut = new THREE.Vector3(-2, 13, -12);
  const T1 = 5, T2 = 9.5, T3 = 15;
  return { dur: T3, birds: [{ off: [0, 0, 0], at: 0 }], sit: [T1, T2], faceSit: Math.PI / 2,
    path: (t) => {
      if (t < T1) return bez(from, ctl, land, easeOut(t / T1));
      if (t < T2) return land.clone();
      return bez(land, ctlOut, away, easeIn((t - T2) / (T3 - T2)));
    },
    flap: (t) => (t < T1 - 0.9 ? 1 : t < T1 ? 0.5 : t < T2 ? -1 : t < T2 + 0.5 ? 0.5 : 1) };   // 1 flaps, 0.5 fast glide, -1 folded (sitting)
}

const gap = () => BIRD_GAP[0] + living.rand() * (BIRD_GAP[1] - BIRD_GAP[0]);

export function createBirds({ kit, parent, tree }) {
  const mat = new THREE.MeshBasicMaterial({ map: kit.T.cloud, vertexColors: true, color: kit.mats.cloud.color.getHex() });
  const group = new THREE.Group();
  group.name = 'birds';
  group.visible = false;
  parent.add(group);
  let run = null, clock = 0, nextAuto = gap(), bag = [], lastPlayed = null;
  const landing = () => {
    tree.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(tree);
    return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.1 * SIZE, (box.min.z + box.max.z) / 2);
  };
  function stop() {
    if (!run) return;
    for (const b of run.birds) { group.remove(b.bird.group); b.bird.group.traverse((o) => o.geometry?.dispose()); }
    run = null; group.visible = false;
  }
  function play(variant = 'a') {
    if (!BIRD_VARIANTS.includes(variant)) return 0;
    stop();
    const f = variant === 'a' ? flightA() : variant === 'b' ? flightB() : flightC(landing());
    if (variant !== 'c') {   // CHE-299 birdlow: the flight goes lower, behind the island, on the side the camera looks at, so it crosses the top of the default views
      const path = f.path, dy = variant === 'a' ? -13 : -15, flip = (globalThis.__chess?.stage?.camera?.position.z ?? 1) < 0 ? -1 : 1;
      f.path = (t) => { const v = path(t); return new THREE.Vector3(v.x * flip, v.y + dy, v.z * flip); };
    }
    run = { f, t: 0, variant, birds: f.birds.map((b) => ({ ...b, bird: makeBird(variant, mat) })) };
    for (const b of run.birds) group.add(b.bird.group);
    group.visible = true;
    place(0);
    return f.dur;
  }
  function place(dt) {
    const { f } = run, t = run.t;
    run.birds.forEach((b, i) => {
      const tt = t - b.at;
      const g = b.bird.group;
      if (tt < 0 || tt > f.dur) { g.visible = false; return; }
      g.visible = true;
      const p = f.path(tt), q = f.path(Math.min(f.dur, tt + 0.08)), sitting = f.sit && tt >= f.sit[0] && tt <= f.sit[1];
      const dir = q.clone().sub(p);
      const fl = f.flap(tt);
      const lead = variantOffset(b.off, dir);
      g.position.set(snap(p.x + lead.x), snap(p.y + lead.y), snap(p.z + lead.z));
      g.rotation.y = sitting ? f.faceSit : dir.lengthSq() > 1e-8 ? Math.atan2(dir.x, dir.z) : g.rotation.y;
      g.rotation.x = sitting ? 0 : -Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 0.5;
      const frame = Math.floor((tt + i * 0.07) * FLAP_FPS) % 2;
      const ang = fl < 0 ? -0.1 : fl === 0 ? 0.15 : frame ? 0.7 : -0.5;
      b.bird.wl.rotation.z = -ang; b.bird.wr.rotation.z = ang;
      b.bird.head.rotation.x = sitting ? 0.35 * (Math.floor(tt * 2.5) % 3 === 0 ? 1 : 0) : 0;   // the robin pecks while it sits
    });
  }
  const variantOffset = (off, dir) => { const a = Math.atan2(dir.x, dir.z), c = Math.cos(a), s = Math.sin(a); return new THREE.Vector3(off[0] * c + off[2] * s, off[1], -off[0] * s + off[2] * c); };
  function pickAuto() {
    const v = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('birds') : null;
    if (BIRD_VARIANTS.includes(v)) return v;
    if (!bag.length) {   // a shuffled round of the three; the first of a new round is never the last one of the old
      bag = [...BIRD_VARIANTS];
      for (let i = 2; i > 0; i--) { const j = Math.floor(living.rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag[0] === lastPlayed) bag.push(bag.shift());
    }
    return bag.shift();
  }
  return {
    group,
    get active() { return !!run; },
    get variant() { return run?.variant ?? null; },
    play, stop,
    update(dt) {
      if (run) {
        run.t += dt;
        if (run.t > run.f.dur + 0.5) stop(); else place(dt);
        return;
      }
      if (!living.on || !living.auto || living.paused) return;
      clock += dt;
      if (clock >= nextAuto) { clock = 0; nextAuto = gap(); lastPlayed = pickAuto(); play(lastPlayed); }
    },
    dispose() { stop(); group.removeFromParent(); mat.dispose(); },
  };
}

/** Hooks the birds into a Pixelwelt world: the group joins the world group, update and dispose are wrapped, world.birds is the API. */
export function withBirds(world) {
  const tree = world.group.children.find((o) => o.name === 'tree-foot') || world.group;
  const birds = createBirds({ kit: world.kit, parent: world.group, tree });
  const update = world.update, dispose = world.dispose;
  world.update = (dt) => { update(dt); birds.update(dt); };
  world.dispose = () => { birds.dispose(); dispose(); };
  world.birds = birds;
  const flag = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('birds') : null;
  if (BIRD_VARIANTS.includes(flag)) birds.play(flag);
  return world;
}
