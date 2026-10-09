// The ?pieces= preview sets in node (CHE-368): node test/piecesets.mjs
// Every variant (crystal, mech) at every quality builds all 12 pieces, heights follow the classic ranking
// (targets within 0.1), every piece fits its square, low builds no more triangles than high and never uses transmission,
// clones share geometry, update runs, and dispose frees every geometry, material and texture it made (no leaks). The pieceset
// hook: a forced style wins over the theme's, the theme's style is still disposed when it changes, and no force means no change.
import * as THREE from 'three';
import { reporter } from '../tools/_lib.mjs';
import { createPieceSet } from '../src/pieceset.js';

const R = reporter();
const TARGET = { p: 0.9, r: 1.0, n: 1.2, b: 1.35, q: 1.6, k: 1.85 };
const TYPES = Object.keys(TARGET);
const VARIANTS = [['crystal', null], ['mech', null]];

// counts what was made and what was disposed: every geometry, material and texture created while building
function tracker() {
  const made = new Set(), freed = new Set();
  const watch = (o) => { if (o && !made.has(o)) { made.add(o); o.addEventListener?.('dispose', () => freed.add(o)); } };
  return { made, freed, watch };
}
const tris = (g) => { let n = 0; g.traverse((o) => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; };

for (const [id] of VARIANTS) {
  const mod = await import(`../src/pieces/${id}.js`);
  const counts = {};
  for (const quality of ['low', 'medium', 'high']) {
    const name = `${id} ${quality}`;
    const style = mod.createStyle({ quality });
    const T = tracker();
    const H = {}, wide = {}, meshes = {};
    let trans = false, total = 0;
    const root = new THREE.Group();
    for (const color of ['w', 'b']) {
      for (const type of TYPES) {
        style.warm(type, color);
        const inner = style.make(type, color);
        const wrap = new THREE.Group(); wrap.add(inner); root.add(wrap);
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner);
        if (color === 'w') { H[type] = +style.height(type, color).toFixed(3); wide[type] = +Math.max(box.max.x - box.min.x, box.max.z - box.min.z).toFixed(3); }
        let n = 0;
        inner.traverse((o) => {
          if (!o.isMesh) return;
          n++;
          T.watch(o.geometry);
          for (const mt of [].concat(o.material)) { T.watch(mt); if (mt.transmission > 0) trans = true; for (const v of Object.values(mt)) if (v?.isTexture) T.watch(v); }
        });
        meshes[type + color] = n;
        total += tris(inner);
      }
    }
    counts[quality] = total;
    R.expect(`${name}: heights follow the ranking, each within 0.1 of its target`, TYPES.every((t) => Math.abs(H[t] - TARGET[t]) <= 0.1) && H.p < H.r && H.r < H.n && H.n < H.b && H.b < H.q && H.q < H.k, JSON.stringify(H));
    R.expect(`${name}: every piece fits its square (at most 0.8 wide)`, TYPES.every((t) => wide[t] <= 0.8), JSON.stringify(wide));
    R.expect(`${name}: at most 8 meshes per piece`, Object.values(meshes).every((n) => n <= 8), `max ${Math.max(...Object.values(meshes))}`);
    if (quality !== 'high') R.expect(`${name}: no transmission (the phone path)`, !trans, String(trans));
    // a second clone shares geometry and materials with the first
    const a = style.make('k', 'w'), b = style.make('k', 'w');
    const ga = [], gb = [];
    a.traverse((o) => o.isMesh && ga.push(o.geometry)); b.traverse((o) => o.isMesh && gb.push(o.geometry));
    R.expect(`${name}: clones share their geometry`, ga.length > 0 && ga.every((g, i) => g === gb[i]), `${ga.length} meshes`);
    let ok = true;
    try { for (let i = 0; i < 30; i++) style.update(1 / 30, root); } catch (e) { ok = false; console.error(e); }
    R.expect(`${name}: update runs over a board of pieces`, ok, '30 frames');
    style.dispose();
    const leaked = [...T.made].filter((o) => !T.freed.has(o));
    R.expect(`${name}: dispose frees every geometry, material and texture (no leaks)`, leaked.length === 0, `${T.made.size} freed`, `${leaked.length} of ${T.made.size} not freed: ${leaked.slice(0, 4).map((o) => o.type || o.constructor.name).join(', ')}`);
  }
  R.expect(`${id}: low builds fewer triangles than high`, counts.low < counts.high, `low ${Math.round(counts.low)}, high ${Math.round(counts.high)} for 12 pieces`);
  R.expect(`${id}: high stays under 3000 triangles a piece on average`, counts.high / 12 < 3000, `${Math.round(counts.high / 12)}`);
}

// the pieceset hook: force() wins over the theme's style, without touching it until the theme changes
{
  const mat = () => ({ body: new THREE.MeshStandardMaterial(), accent: new THREE.MeshStandardMaterial() });
  const set = createPieceSet({ white: mat(), black: mat() });
  const fake = (id) => { const s = { id, disposed: 0, make: () => new THREE.Group(), height: () => 1, dispose() { s.disposed++; } }; return s; };
  R.expect('no force: no style, the classic pieces', set.style === null && set.make('p', 'w').userData.style === null, 'null');
  const theme1 = fake('tournament'), theme2 = fake('wood'), theme3 = fake('pixel'), forced = fake('crystal');
  set.setStyle(theme1);
  set.force(forced);
  R.expect('force wins over the theme style', set.style === forced && set.make('k', 'b').userData.style === 'crystal', set.style.id);
  set.setStyle(theme2);
  R.expect('a theme change under a forced set keeps the set and disposes the old theme style', set.style === forced && theme1.disposed === 1 && theme2.disposed === 0, JSON.stringify({ t1: theme1.disposed, t2: theme2.disposed }));
  set.setStyle(theme3);
  R.expect('a theme with its own figures (Pixelwelt) wins over the forced set', set.style === theme3, set.style.id);
  set.setStyle(theme2);
  R.expect('back to a lit theme the forced set shows again', set.style === forced, set.style.id);
  set.force(null);
  R.expect('force(null) disposes the set and gives the theme style back', set.style === theme2 && forced.disposed === 1, set.style.id);
}

process.exitCode = R.summary().nf ? 1 : 0;
