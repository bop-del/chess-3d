// Pixelwelt island choice (CHE-357), fast tier, no browser: precedence (click > ?island= > stored > d), bad values fall back to d,
// a click is stored and heard by the listeners, every island builds and a rebuild disposes every geometry of the old world.
// Run: node test/pixel-island.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }) }) };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const at = (search) => { globalThis.location = { search }; };
at('');

const I = await import('../src/themes/pixel/islands.js');
const { createPixelWorld } = await import('../src/themes/pixel/world.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const reset = () => { I.resetIsland(); store.clear(); };

reset();
check('default is d (floating islands)', I.DEFAULT_ISLAND === 'd' && I.islandChoice() === 'd');
at('?island=b'); check('?island=b beats the default', I.islandChoice() === 'b');
store.set('chess3d.pixisland', 'e'); check('?island= beats a stored pick, the store stays', I.islandChoice() === 'b' && store.get('chess3d.pixisland') === 'e');
at(''); check('a stored pick is used without the flag', I.islandChoice() === 'e');
at('?island=zzz'); check('a bad flag falls through to the stored pick', I.islandChoice() === 'e');
store.set('chess3d.pixisland', 'old'); at(''); check('a bad stored value falls back to d', I.islandChoice() === 'd');
reset(); at('?island=oak'); check('?island=oak is the test-only old island, never stored or a menu id', I.islandChoice() === 'oak' && !I.ISLAND_IDS.includes('oak'));
store.set('chess3d.pixisland', 'oak'); at(''); check('a stored oak is ignored', I.islandChoice() === 'd');
reset(); at('?island=a');
const heard = []; I.onIsland((id) => heard.push(id));
I.setIsland('c');
check('a click beats the flag, is stored and heard', I.islandChoice() === 'c' && store.get('chess3d.pixisland') === 'c' && heard.join() === 'c');
I.setIsland('c'); I.setIsland('x');
check('the same pick or a bad id does nothing', heard.length === 1 && store.get('chess3d.pixisland') === 'c');
check('every island has a name, a German name and two swatch colours', I.ISLAND_IDS.every((id) => I.ISLAND_NAMES[id]?.en && I.ISLAND_NAMES[id]?.de && I.ISLAND_NAMES[id].swatch.length === 2));

// build and dispose of each island
reset(); at('');
for (const id of I.ISLAND_IDS) {
  I.resetIsland(); store.clear(); at(`?island=${id}`);
  const w = createPixelWorld({});
  let n = 0, disposed = 0;
  w.group.traverse((o) => { if (o.isMesh) { n++; o.geometry.addEventListener('dispose', () => { disposed++; }); } });
  const isl = w.group.getObjectByName('island');
  w.dispose();
  check(`island ${id}: builds (island group with blocks) and dispose frees every geometry`, !!isl && isl.userData.boxes.length > 300 && n > 0 && disposed >= n, `${disposed} of ${n} meshes`);
}
if (failed) { console.log(`${failed} CHECK(S) FAILED`); process.exit(1); }
