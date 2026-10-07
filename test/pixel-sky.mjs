// Pixelwelt skies, backdrops and sets (CHE-239), fast tier, no browser (the world is built in node with a stub canvas).
//   1 choice   precedence of the flags, the stored value, the click on this page (a Set picks both axes); bad values fall back to the
//              default set Inselmorgen (sunrise and islands)
//   2 manual   under ?manual=1 the world never changes the sky by itself
//   3 build    every sky x backdrop builds, every mesh is unlit and opaque, no coplanar overlapping faces, and dispose frees every geometry
//   4 swap     setLook through every combination in one world: every geometry that goes out of the layer is disposed (no leak), the layer
//              ends as small as a fresh one
//   5 weather  storm has rain and bolts, snow flakes, night stars and a moon; the phone and low quality count is half
//   6 sets     ids unique, every set names a known sky and backdrop, one line German text
//   7 night    the board squares keep their contrast under every multiplier
// Run: node test/pixel-sky.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }) }) };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const at = (search) => { globalThis.location = { search }; };
at('');

const L = await import('../src/themes/pixel/look.js');
const { createPixelWorld } = await import('../src/themes/pixel/world.js');
const { coplanarOverlaps } = await import('../src/themes/blocks/mesher.js');
const { light } = await import('../src/themes/pixel.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const reset = () => { L.resetLook(); store.clear(); };

// 1 choice
{
  reset(); at('');
  check('default for a new player: the set Inselmorgen (sunrise and islands)', L.look().sky === 'sunrise' && L.look().backdrop === 'islands' && L.currentSetId() === L.DEFAULT_SET);
  at('?pixlight=a'); check('the old flag ?pixlight is gone: the default', L.look().sky === 'sunrise');
  at('?sky=day'); check('?sky=day is gone (not a kept sky): the default', L.look().sky === 'sunrise');
  at('?sky=auto'); check('?sky=auto is gone: the default', L.look().sky === 'sunrise');
  at('?backdrop=mountains'); check('?backdrop=mountains and sea are gone: the default', L.look().backdrop === 'islands');
  at('?sky=storm&backdrop=castle'); check('?sky and ?backdrop', L.look().sky === 'storm' && L.look().backdrop === 'castle');
  at('?backdrop=none'); check('?backdrop=none', L.look().backdrop === 'none' && L.currentSetId() === null);
  at('?set=sturmburg'); check('?set=sturmburg is storm and castle', L.look().sky === 'storm' && L.look().backdrop === 'castle');
  at('?set=bergnacht'); check('?set=bergnacht is gone: the default', L.look().sky === 'sunrise' && L.look().backdrop === 'islands');
  at('?set=sturmburg&sky=snow'); check('an explicit ?sky wins over ?set, the backdrop stays', L.look().sky === 'snow' && L.look().backdrop === 'castle');
  at('?sky=lava&backdrop=moon&set=nope'); check('bad values fall back to the default', L.look().sky === 'sunrise' && L.look().backdrop === 'islands');
  at(''); L.setChoice({ sky: 'snow', backdrop: 'none' });
  check('a pick is stored per browser', store.get('chess3d.pixsky') === 'snow' && store.get('chess3d.pixbackdrop') === 'none');
  L.resetLook(); check('a stored pick is the choice of the next load', L.look().sky === 'snow' && L.look().backdrop === 'none');
  at('?sky=night'); check('a flag wins over the stored pick for that load', L.look().sky === 'night' && L.look().backdrop === 'none');
  L.setChoice({ sky: 'evening' }); check('a click on this page wins over the flag', L.look().sky === 'evening');
  L.setChoice({ set: 'winterdorf' }); check('a click on a Set picks sky and backdrop and stores both', L.look().sky === 'snow' && L.look().backdrop === 'castle' && L.currentSetId() === 'winterdorf' && store.get('chess3d.pixsky') === 'snow' && store.get('chess3d.pixbackdrop') === 'castle');
  store.set('chess3d.pixsky', 'garbage'); store.set('chess3d.pixbackdrop', 'sea'); L.resetLook(); at(''); check('garbage and removed stored values fall back', L.look().sky === 'sunrise' && L.look().backdrop === 'islands');
  store.set('chess3d.pixsky', 'day'); store.set('chess3d.pixbackdrop', 'mountains'); L.resetLook(); check('a stored day or mountains (an earlier build) falls back', L.look().sky === 'sunrise' && L.look().backdrop === 'islands');
  let seen = null; const off = L.onLook((l) => { seen = l; }); L.setChoice({ backdrop: 'castle' }); off();
  check('onLook gets the new look', seen?.backdrop === 'castle');
}

// 2 manual
{
  reset(); at('?manual=1');
  const w = createPixelWorld({}), seenSkies = [];
  const sky = w.group.userData.sky;
  for (let i = 0; i < 40; i++) { w.update(30); seenSkies.push(sky.state.sky); }
  check('?manual=1: 20 minutes of world time never change the sky', new Set(seenSkies).size === 1 && seenSkies[0] === 'sunrise', seenSkies[0]);
  w.dispose();
}

// helpers for the world checks
const geos = (root) => { const s = new Set(); root.traverse((o) => { if (o.geometry) s.add(o.geometry); }); return s; };
const meshes = (root) => { const a = []; root.traverse((o) => { if (o.isMesh) a.push(o); }); return a; };
const track = (set) => { for (const g of set) if (!g.userData.__watched) { g.userData.__watched = true; g.addEventListener('dispose', () => { g.userData.__disposed = true; }); } };

// 3 build and dispose, every combination
{
  const bad = [], leaks = [], clash = [];
  let n = 0, boxes = 0;
  for (const sk of L.SKY_IDS) for (const bd of ['none', ...L.BACKDROP_IDS]) {
    reset(); at(`?sky=${sk}&backdrop=${bd}`);
    const w = createPixelWorld({});
    n++;
    const ms = meshes(w.group);
    for (const m of ms) {
      const cloud = m.parent?.name === 'cloud', id = `${sk}/${bd}/${m.parent?.name}/${m.name}`;
      if (!m.material.isMeshBasicMaterial) bad.push(`lit ${id}`);
      else if (!cloud && (m.material.opacity !== 1 || m.material.transparent)) bad.push(`translucent ${id}`);
      else if (m.material !== w.kit.mats.flat && !m.material.map) bad.push(`plain ${id}`);
    }
    w.group.traverse((o) => { if (o.userData.boxes && o.name !== 'island' && o.name !== 'tree' && o.name !== 'cloud') { boxes += o.userData.boxes.length; for (const r of coplanarOverlaps(o.userData.boxes)) clash.push(`${sk}/${bd}/${o.name} ${r.face}`); } });
    const all = geos(w.group); track(all);
    w.dispose();
    const left = [...all].filter((g) => !g.userData.__disposed).length;
    if (left) leaks.push(`${sk}/${bd}: ${left} of ${all.size}`);
  }
  check(`${n} combinations build: every mesh unlit and opaque, flat or textured`, bad.length === 0, bad.slice(0, 3).join('; '));
  check('no coplanar overlapping faces in the sky layer and the backdrops', clash.length === 0 && boxes > 1000, `${boxes} boxes${clash.length ? ', ' + clash.slice(0, 3).join('; ') : ''}`);
  check('dispose frees every geometry of every combination', leaks.length === 0, leaks.slice(0, 3).join('; '));
}

// 4 swap in one world
{
  reset(); at('');
  const w = createPixelWorld({}), sky = w.group.userData.sky, layer = sky.layer;
  const leaked = [];
  let steps = 0, prev = geos(layer); track(prev);
  const order = []; for (const s of L.SKY_IDS) for (const b of ['none', ...L.BACKDROP_IDS]) order.push([s, b]);
  for (const [s, b] of order) {
    sky.setLook({ sky: s, backdrop: b }); steps++;
    const now = geos(layer);
    for (const g of prev) if (!now.has(g) && !g.userData.__disposed) leaked.push(`${s}/${b}`);
    track(now); prev = now;
  }
  sky.setLook({ sky: 'storm', backdrop: 'castle' });
  reset(); at('?sky=storm&backdrop=castle');
  const fresh = createPixelWorld({}), freshCount = meshes(fresh.group.userData.sky.layer).length;
  check(`${steps} swaps in one world: every replaced geometry is disposed`, leaked.length === 0, leaked.slice(0, 3).join('; '));
  check('after the swaps the layer is as small as a fresh one', meshes(layer).length === freshCount, `${meshes(layer).length} meshes, fresh ${freshCount}`);
  const col = (hex) => new THREE.Color(hex).getHex();
  sky.setLook({ sky: 'night', backdrop: 'none' });
  check('a swap moves the multiplier colour of the world (night)', w.kit.mats.grassTop.color.getHex() === col(L.SKIES.night.mul));
  sky.setLook({ sky: 'evening', backdrop: 'none' });
  check('and back (evening)', w.kit.mats.grassTop.color.getHex() === col(L.WARM.world) && w.kit.mats.sun.color.getHex() === 0xffffff);
  w.dispose(); fresh.dispose();
}

// 5 weather, stars, moon
{
  const probe = (search, light = false) => { reset(); at(search); const w = createPixelWorld({ light }); return { w, sky: w.group.userData.sky, layer: w.group.userData.sky.layer }; };
  let r = probe('?sky=storm');
  for (let i = 0; i < 10; i++) r.w.update(0.5);
  check('storm: rain falls and a bolt struck in the first seconds', r.layer.getObjectByName('weather')?.count > 0 && r.sky.state.flashes >= 1, `${r.sky.state.particles} drops, ${r.sky.state.flashes} bolts`);
  const flashes = []; for (let i = 0; i < 400; i++) { r.w.update(0.1); flashes.push(r.sky.state.flash > 0); }
  check('the storm flashes now and then, not all the time', flashes.filter(Boolean).length > 3 && flashes.filter(Boolean).length < 80);
  r.w.dispose();
  const full = probe('?sky=storm'), low = probe('?sky=storm', true);
  check('fewer rain drops on phones and low quality', low.sky.state.particles * 2 <= full.sky.state.particles + 1 && low.sky.state.particles > 0, `${full.sky.state.particles} to ${low.sky.state.particles}`);
  full.w.dispose(); low.w.dispose();
  r = probe('?sky=snow'); check('snow: flakes fall', r.layer.getObjectByName('weather')?.count > 0 && r.sky.state.flashes === 0);
  const meanY = () => { const im = r.layer.getObjectByName('weather'), m = new THREE.Matrix4(); let t = 0; for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); t += m.elements[13]; } return t / im.count; };
  const y0 = meanY(); r.w.update(0.3); const y1 = meanY();
  check('the flakes move down with time', y1 < y0);
  r.w.dispose();
  r = probe('?sky=night'); check('night: stars and a moon, no weather', !!r.layer.getObjectByName('stars') && !!r.layer.getObjectByName('moon') && !r.layer.getObjectByName('weather') && r.w.group.getObjectByName('sun').visible === false);
  r.w.dispose();
  {   // treefade (CHE-299): the camera at the oak shrinks it softly, a far camera brings it back
    reset(); at('');
    const cam = new THREE.PerspectiveCamera(); cam.position.set(-8.5, 3, -8.5); cam.updateMatrixWorld(true);
    const w = createPixelWorld({ view: () => ({ camera: cam }) }), tree = w.group.getObjectByName('tree-foot');
    w.update(0.1); const mid = tree.scale.x; for (let i = 0; i < 10; i++) w.update(0.1);
    check('treefade: the oak shrinks softly while the camera is inside its box', mid > 0.1 && mid < 1 && tree.scale.x < 0.01 && !tree.visible, `${mid.toFixed(2)} then ${tree.scale.x.toFixed(3)}`);
    cam.position.set(0, 20, 20); cam.updateMatrixWorld(true); for (let i = 0; i < 10; i++) w.update(0.1);
    check('treefade: the oak is back at full size with the camera away', tree.scale.x === 1 && tree.visible);
    w.dispose();
  }
  const lowestStar = (rr) => { const g = rr.layer.getObjectByName('stars'); let lo = Infinity; g.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) lo = Math.min(lo, p.getY(i)); } }); return lo; };
  r = probe('?sky=night&backdrop=castle'); check('starclip: no stars below y -6 over the castle meadow (CHE-299)', lowestStar(r) >= -7, `lowest ${lowestStar(r).toFixed(1)}`);
  r.w.dispose();
  r = probe('?sky=evening'); check('evening: no stars, no weather, the sun is up', !r.layer.getObjectByName('stars') && !r.layer.getObjectByName('weather') && r.w.group.getObjectByName('sun').visible);
  r.w.dispose();
  r.w.dispose();
  r = probe('?sky=sunrise'); check('sunrise: the sun stands low', r.w.group.getObjectByName('sun').position.y < 6 && r.w.group.getObjectByName('sun').visible);
  r.w.dispose();
}

// 6 sets
{
  const ids = L.SETS.map((s) => s.id);
  check('the 3 picked sets (Sturmburg, Inselmorgen, Winterdorf), unique ids', ids.join() === 'sturmburg,inselmorgen,winterdorf' && new Set(ids).size === ids.length, ids.join(', '));
  check('the kept skies are evening, night, sunrise, storm, snow and the backdrops islands, castle', L.SKY_IDS.join() === 'evening,night,sunrise,storm,snow' && L.BACKDROP_IDS.join() === 'islands,castle' && !L.SKIES.day && !L.BACKDROPS.sea && !L.BACKDROPS.mountains);
  check('every set names a known sky and backdrop and has a German line', L.SETS.every((s) => L.SKY_IDS.includes(s.sky) && L.BACKDROP_IDS.includes(s.backdrop) && s.de && s.en && s.line.length > 10));
  check('the light of every sky carries a bg, a tint and the exposure', L.SKY_IDS.every((s) => { const l = L.skyLight(s); return l.bg.top && l.bg.bottom && l.post.tint && l.exposure > 0.5; }));
  at('?sky=night'); check('light() follows the sky', light().bg.top === '#050820');
}

// 7 readability: the board squares keep their contrast under every multiplier (sand 0xdbcf97, cobble 0x797b7f, as drawn)
{
  const lum = (hex, mul) => { const c = (s) => ((hex >> s) & 255) * ((mul >> s) & 255) / 255 / 255; return 0.2126 * c(16) + 0.7152 * c(8) + 0.0722 * c(0); };
  const rows = L.SKY_IDS.map((s) => { const m = L.SKIES[s].mul, a = lum(0xdbcf97, m), b = lum(0x797b7f, m); return [s, a / b, a]; });
  check('board contrast (light over dark square) at least 1.5 in every sky, light squares not darker than 0.35', rows.every(([, r, a]) => r >= 1.5 && a >= 0.35), rows.map(([s, r, a]) => `${s} ${r.toFixed(2)}/${a.toFixed(2)}`).join(', '));
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nPIXEL SKY PASSED');
process.exit(failed ? 1 : 0);
