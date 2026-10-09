// The living Pixelwelt island (CHE-372, on every island), fast tier, no browser: for every island the life builds (villagers, animals, a
// flock, spray where a fall exists), and over 60 simulated seconds no creature stands on the board, a captured pieces area or the
// label ring, walkers stand exactly on the top of their ground (swimmers on the water), the flock keeps far out and no bird or
// villager covers a square from the default views; the state is the same for the same time, light builds fewer, every creature
// part is free of coplanar faces in each pose frame, dispose frees what it made, and a plain world (no flag) builds it on every island.
// Run: node test/pixel-alive.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }) }) };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const at = (search) => { globalThis.location = { search }; };
at('');

const { createPixelWorld } = await import('../src/themes/pixel/world.js');
const { resetIsland } = await import('../src/themes/pixel/islands.js');
const { coplanarOverlaps } = await import('../src/themes/blocks/mesher.js');
const { SPECIES, meshPart, ROD, LINE, BOBBER } = await import('../src/themes/pixel/alive-models.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

// the board and the captured pieces areas (src/trays.js SLAB and ROWS, as world.js inTray), the label ring |x|, |z| < 5
const inTray = (x, z, m = 0) => (Math.abs(Math.abs(x) - 5.75) < 1.45 / 2 + m && Math.abs(z - 0.96) < 4.9 / 2 + m) || (Math.abs(x) < 4 + m && Math.abs(Math.abs(z) - 5.2) < 1.45 / 2 + m);
const inRing = (x, z) => Math.abs(x) < 5 && Math.abs(z) < 5;

/** The ground under a point read straight from the island's blocks: the top of the highest cell or water box whose footprint holds it. */
function groundAt(world, x, z) {
  let top = null, water = null;
  for (const name of ['island', 'islets']) for (const g of world.group.children.filter((o) => o.name === name)) for (const b of g.userData.boxes) {
    if (x < b.x || x >= b.x + b.w || z < b.z || z >= b.z + b.d) continue;
    const liquid = b.faces.py === 'water' || b.faces.py === 'lava', cell = b.w === 1 && b.h === 1 && b.d === 1;
    if (!cell && !liquid) continue;
    if (top === null || b.y + b.h > top) { top = b.y + b.h; water = liquid ? b.faces.py : null; }
  }
  return { top, water };
}

// a point that covers a square from a camera: it lies between the camera and the board top, on the line to a square
const cams = [['White view', 0], ['Black view', Math.PI]].map(([n, yaw]) => { const p = 46 * Math.PI / 180, d = 15; return [n, new THREE.Vector3(Math.sin(yaw) * Math.cos(p) * d, Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d)]; });
const covers = (cam, p) => { if (p.y <= 0 || p.y >= cam.y) return false; const t = cam.y / (cam.y - p.y), x = cam.x + (p.x - cam.x) * t, z = cam.z + (p.z - cam.z) * t; return Math.abs(x) < 4 && Math.abs(z) < 4; };

const snapshot = (life) => JSON.stringify(life.creatures().map((c) => [c.name, c.x, c.y, c.z, c.rot, c.act])) + JSON.stringify(life.flock.map((m) => [m.position.x, m.position.y, m.position.z]));

for (const id of ['a', 'b', 'c', 'd', 'e']) {
  resetIsland(); at(`?island=${id}`);
  const w = createPixelWorld({});
  const life = w.group.getObjectByName('life')?.userData.life;
  if (!life) { check(`island ${id}: life builds`, false, 'no life group'); continue; }
  const list = life.creatures(), people = list.filter((c) => ['farmer', 'girl', 'fisher'].includes(c.name)), animals = list.filter((c) => !people.includes(c));
  const wantFall = { a: 0, b: 1, c: 0, d: 1, e: 2 }[id];
  check(`island ${id}: life builds (villagers, animals, flock, spray at each fall)`, people.length === 3 && animals.length >= 4 && life.flock.length >= 7 && life.falls === wantFall && (wantFall ? life.particles > 20 : life.particles === 0),
    `${people.length} villagers, ${animals.length} animals (${[...new Set(animals.map((c) => c.name))].join(', ')}), ${life.flock.length} birds, ${life.falls} falls, ${life.particles} particles`);
  if (id === 'b' || id === 'd') check(`island ${id}: a duck family swims`, list.filter((c) => c.swim).length === 3);

  // 60 s in steps of an animation frame: where everyone stands
  const bad = [], cover = [], banned = [], close = [], spray = [];
  const inBand = (c) => { const r = c.r - 1 / 16; return Math.abs(c.x) - r < 5.5 && Math.abs(c.z) + r > 4.5; };   // r less the 1/16 snap of the stepped position
  let flockNear = Infinity, birdCover = 0, walked = 0;
  const start = new Map(list.map((c, i) => [i, [c.x, c.z]]));
  for (let s = 0; s < 480; s++) {
    w.update(0.125);
    life.creatures().forEach((c, i) => {
      const g = groundAt(w, c.x, c.z);
      if (inRing(c.x, c.z) || inTray(c.x, c.z)) bad.push(`${c.name} on the board area at ${c.x},${c.z}`);
      else if (g.top === null || Math.abs(c.y - g.top) > 1e-6) bad.push(`${c.name} at ${c.x},${c.y},${c.z} over ground ${g.top}`);
      else if (c.swim ? g.water !== 'water' : g.water) bad.push(`${c.name} ${c.swim ? 'out of' : 'in'} the water at ${c.x},${c.z}`);
      for (const [n, cam] of cams) if (!c.swim && covers(cam, new THREE.Vector3(c.x, c.y + 1.1, c.z))) cover.push(`${c.name} from the ${n}`);
      if (!c.swim && inBand(c)) banned.push(`${c.name} at ${c.x},${c.z}`);
      if (s === 479 && Math.hypot(c.x - start.get(i)[0], c.z - start.get(i)[1]) > 0.5) walked++;
    });
    const cs = life.creatures();
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) if (cs[i].family !== cs[j].family && cs[i].swim === cs[j].swim && Math.hypot(cs[i].x - cs[j].x, cs[i].z - cs[j].z) < cs[i].r + cs[j].r) close.push(`${cs[i].name} and ${cs[j].name} at ${cs[i].x},${cs[i].z}`);
    for (const p of life.sprayAt()) for (const [n, cam] of cams) if (covers(cam, p)) spray.push(`a particle at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)} from the ${n}`);
    flockNear = Math.min(flockNear, life.flockNear());
    for (const m of life.flock) for (const [, cam] of cams) if (covers(cam, m.position)) birdCover++;
  }
  check(`island ${id}: 60 s, everyone on its own ground, never on the board, a tray or the label ring`, bad.length === 0, bad.slice(0, 3).join('; '));
  check(`island ${id}: nobody stands behind either back rank, near or far (|x| < 5.5, |z| > 4.5)`, banned.length === 0, banned.slice(0, 3).join('; '));
  check(`island ${id}: no two creatures (other than a mother and her young) come closer than their radii`, close.length === 0, close.slice(0, 3).join('; '));
  check(`island ${id}: no spray particle covers a square from the White or Black view`, spray.length === 0, spray.slice(0, 3).join('; '));
  check(`island ${id}: no villager or animal covers a square from the White or Black view`, cover.length === 0, cover.slice(0, 3).join('; '));
  check(`island ${id}: the flock circles far out and never covers a square from the White or Black view`, flockNear > 12 && birdCover === 0, `nearest ${flockNear.toFixed(1)} from the centre, ${birdCover} covering`);
  check(`island ${id}: life moves (creatures away from where they started after 60 s)`, walked >= 3, `${walked} of ${list.length}`);

  // the flock shows in the sky of the default White view part of the time: on screen (16:9 and phone portrait) and not behind the island
  {
    const solid = [];
    w.group.updateMatrixWorld(true);
    w.group.traverse((o) => { if (o.isMesh && ['island', 'islets', 'tree'].includes(o.parent?.name)) solid.push(o); });
    const rc = new THREE.Raycaster(), v = new THREE.Vector3(), d = new THREE.Vector3(), seen = {};
    for (const aspect of [16 / 9, 390 / 844]) {
      const cam = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
      cam.position.copy(cams[0][1]).multiplyScalar(aspect > 1 ? 1 : 1.6); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();   // the phone frames the board from farther out
      let n = 0;
      for (let s = 0; s < 140; s++) {
        w.update(0.5);
        if (life.flock.some((m) => { v.copy(m.position).project(cam); if (Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1) return false; d.copy(m.position).sub(cam.position); rc.far = d.length(); rc.set(cam.position, d.normalize()); return !rc.intersectObjects(solid, false).length; })) n++;
      }
      seen[aspect > 1 ? 'desktop' : 'phone'] = n;
    }
    check(`island ${id}: the flock is seen from the White view part of the time`, seen.desktop >= 20 && seen.phone >= 5, `${seen.desktop} of 140 half seconds on desktop, ${seen.phone} on the phone`);
  }

  // deterministic: a second world at the same times is in the same state
  const w2 = createPixelWorld({}), life2 = w2.group.getObjectByName('life').userData.life;
  for (let s = 0; s < 400; s++) w2.update(0.5);
  check(`island ${id}: the same time gives the same state (deterministic)`, snapshot(life) === snapshot(life2));

  // every geometry it made is freed by dispose (materials: it makes none, the world's flat material is shared)
  let disposed = 0;
  const made = life.created.geometries;
  for (const g of made) g.addEventListener('dispose', () => { disposed++; });
  w2.dispose();
  w.dispose();
  check(`island ${id}: dispose frees every geometry it made, it makes no materials`, made.length > 5 && disposed >= made.length && life.created.materials.length === 0, `${disposed} of ${made.length}`);

  // light: fewer of everything
  at(`?island=${id}`);
  const wl = createPixelWorld({ light: true }), ll = wl.group.getObjectByName('life').userData.life;
  const sl = ll.stats(), badL = [];
  for (let s = 0; s < 240; s++) { wl.update(0.25); for (const c of ll.creatures()) { const g = groundAt(wl, c.x, c.z); if (inRing(c.x, c.z) || inTray(c.x, c.z) || g.top === null || Math.abs(c.y - g.top) > 1e-6) badL.push(`${c.name} at ${c.x},${c.z}`); } }
  check(`island ${id}: light (creatures a fifth larger) stays on its own ground for 60 s`, badL.length === 0, badL.slice(0, 3).join('; '));
  check(`island ${id}: light builds fewer creatures, birds and particles`, sl.creatures < list.length && sl.birds < life.flock.length && (!wantFall || sl.particles < life.particles), `${sl.creatures} creatures, ${sl.birds} birds, ${sl.particles} particles, ${sl.meshes} meshes, ${sl.tris} triangles`);
  wl.dispose();
}

// every part of every creature, the rod and the bird frames: no coplanar faces (rule 2 for every pose, not only the one built)
{
  const bad = [];
  for (const [name, f] of Object.entries(SPECIES)) for (const [pn, p] of Object.entries(f().parts)) { const r = meshPart(p, p.pivot); if (coplanarOverlaps(r.boxes).length) bad.push(`${name}.${pn}`); r.geo.dispose(); }
  for (const p of [ROD, LINE, BOBBER]) { const r = meshPart(p); if (coplanarOverlaps(r.boxes).length) bad.push('rod'); r.geo.dispose(); }
  resetIsland(); at('?island=d');
  const w = createPixelWorld({}), life = w.group.getObjectByName('life').userData.life;
  const frames = new Set();
  for (let s = 0; s < 16; s++) { w.update(0.125); for (const m of life.flock) frames.add(m.geometry.drawRange.start); }
  check('creature parts and every bird wing frame are free of coplanar faces', bad.length === 0 && frames.size >= 3, `${Object.keys(SPECIES).length} species, ${frames.size} bird frames${bad.length ? ', clash in ' + bad.join(', ') : ''}`);
  w.dispose();
}

// no flag: every island is alive (the default since the owner's pick)
for (const id of ['a', 'b', 'c', 'd', 'e']) {
  resetIsland(); at(`?island=${id}`);
  const w = createPixelWorld({}), mine = [];
  w.group.traverse((o) => { if (/^life/.test(o.name)) mine.push(o.name); });
  check(`island ${id} without a flag: the living island is built`, mine.length > 0, `${mine.length} life objects`);
  w.dispose();
}
at('');

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nPIXEL ALIVE PASSED');
process.exit(failed ? 1 : 0);
