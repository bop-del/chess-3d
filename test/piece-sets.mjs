// Preview piece sets contract, headless (CHE-367, ?pieces=fantasy|animals). Builds every piece of each set in both colours through
// createPieceSet and checks height (today's ranking, 5 %), footprint, centering, triangle budget (phones), at most three meshes on the
// two side materials plus the one dark material, finite attributes, shadows; then disposes everything. Also: no flag keeps the Staunton
// set, an unknown flag value gives no set. Run: node test/piece-sets.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import { createPieceSet, loadPieceVariant } from '../src/pieceset.js';
import { HEIGHT } from '../src/pieces/kit.js';

export const SETS = ['fantasy', 'animals'];
const NAMES = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };
const HEIGHT_TOL = 0.05, FOOT_MIN = 0.5, FOOT_MAX = 0.85, CENTER_TOL = 0.05, MIN_Y = 0.01, TRI_MIN = 6000, TRI_MAX = 40000, MAX_MESHES = 3;

const side = () => ({ body: new THREE.MeshStandardMaterial(), accent: new THREE.MeshStandardMaterial() });
const materials = () => ({ white: side(), black: side(), dark: null, apply() {}, current: null });

export async function runPieceSetChecks() {
  const out = [];
  const add = (name, pass, detail) => out.push({ name, pass, detail });
  for (const set of SETS) {
    const builders = await loadPieceVariant(set);
    add(`${set}: the set loads`, !!builders && Object.keys(NAMES).every((t) => typeof builders[t] === 'function'), builders ? Object.keys(builders).join(' ') : 'null');
    if (!builders) continue;
    const mats = materials();
    const ps = createPieceSet(mats, builders);
    const geos = new Set();
    for (const color of ['w', 'b']) {
      const m = color === 'w' ? mats.white : mats.black;
      for (const [type, name] of Object.entries(NAMES)) {
        const tag = `${set} ${color === 'w' ? 'white' : 'black'} ${name}`;
        const g = ps.make(type, color);
        g.updateMatrixWorld(true);
        const inner = g.children[0];
        inner.rotation.y = 0; inner.updateMatrixWorld(true);   // measure in the piece's own frame
        const box = new THREE.Box3().setFromObject(inner);
        const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
        let tris = 0, meshes = 0, nonFinite = 0, noShadow = 0, foreign = 0;
        inner.traverse((o) => {
          if (!o.isMesh) return;
          meshes++; geos.add(o.geometry);
          if (!o.castShadow || !o.receiveShadow) noShadow++;
          if (o.material !== m.body && o.material !== m.accent && o.material !== mats.dark) foreign++;
          const pos = o.geometry.attributes.position;
          tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
          for (const attr of [pos, o.geometry.attributes.normal]) {
            if (!attr) { nonFinite++; continue; }
            for (let i = 0; i < attr.array.length; i++) if (!Number.isFinite(attr.array[i])) { nonFinite++; break; }
          }
        });
        const hErr = Math.abs(box.max.y - HEIGHT[type]) / HEIGHT[type];
        add(`${tag}: height`, hErr <= HEIGHT_TOL, `${box.max.y.toFixed(3)} vs ${HEIGHT[type]} (${(hErr * 100).toFixed(1)}%)`);
        add(`${tag}: footprint`, size.x >= FOOT_MIN && size.x <= FOOT_MAX && size.z >= FOOT_MIN && size.z <= FOOT_MAX, `${size.x.toFixed(3)} x ${size.z.toFixed(3)}`);
        add(`${tag}: centered`, Math.abs(ctr.x) <= CENTER_TOL && Math.abs(ctr.z) <= CENTER_TOL, `${ctr.x.toFixed(3)}, ${ctr.z.toFixed(3)}`);
        add(`${tag}: sits on the board`, Math.abs(box.min.y) <= MIN_Y, `min y ${box.min.y.toFixed(3)}`);
        add(`${tag}: triangles and meshes`, tris >= TRI_MIN && tris <= TRI_MAX && meshes >= 1 && meshes <= MAX_MESHES, `${Math.round(tris)} in ${meshes} meshes`);
        add(`${tag}: side materials only (plus the one dark)`, foreign === 0, foreign ? `${foreign} meshes with another material` : 'ok');
        add(`${tag}: finite positions and normals, shadows`, nonFinite === 0 && noShadow === 0, nonFinite ? `${nonFinite} bad arrays` : noShadow ? `${noShadow} meshes without shadows` : 'ok');
      }
    }
    // black shares white's geometry (clones), and every geometry disposes cleanly
    let disposed = 0;
    for (const geo of geos) { geo.addEventListener('dispose', () => disposed++); geo.dispose(); }
    add(`${set}: black shares the geometry of white, all of it disposes`, geos.size <= 6 * MAX_MESHES && disposed === geos.size, `${geos.size} geometries, ${disposed} disposed`);
  }
  // no flag: the Staunton set; an unknown value: no set
  const ps = createPieceSet(materials(), null);
  const names = [];
  ps.make('k', 'w').traverse((o) => { if (o.isMesh) names.push(o.name); });
  add('no flag: the Staunton king (no preview meshes)', names.length > 0 && !names.some((n) => /^(fantasy|animals)-/.test(n)), names.join(' ') || 'unnamed meshes');
  add('unknown ?pieces value: no set', (await loadPieceVariant('nope')) === null && (await loadPieceVariant(null)) === null, 'null');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const t0 = performance.now();
  const res = await runPieceSetChecks();
  for (const r of res) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}  ${r.detail}`);
  const bad = res.filter((r) => !r.pass).length;
  console.log(bad ? `${bad} FAILED of ${res.length}` : `ALL ${res.length} PASSED`, `(${((performance.now() - t0) / 1000).toFixed(1)}s)`);
  process.exit(bad ? 1 : 0);
}
