// Contract of the Blocks theme characters, headless: all 12 build, stand on the board inside their square, are told apart by
// height, have the animated parts the rig expects (legs, arms, head, horse legs, rider), and stay inside a triangle budget.
// Run: node test/blocks-chars.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';
import { buildTemplate } from '../src/themes/blocks/rig.js';
import { coplanarOverlaps } from '../src/themes/blocks/mesher.js';
import { buildVox, queenVariant } from '../src/themes/blocks/vox.js';

const TYPES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const mat = new THREE.MeshBasicMaterial();
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

const heights = {}, outline = {};
for (const color of ['w', 'b']) {
  const who = color === 'w' ? 'hero' : 'critter';
  for (const [type, name] of Object.entries(TYPES)) {
    const tag = `${who} ${name}`;
    const { rig, height } = buildTemplate(color, type, mat);
    rig.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig), size = box.getSize(new THREE.Vector3());
    let tris = 0; rig.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
    const names = rig.children.map((c) => c.name);
    heights[color + type] = box.max.y; outline[color + type] = [size.x, size.z];
    check(`${tag}: stands on the board`, Math.abs(box.min.y) < 0.01, `min y ${box.min.y.toFixed(3)}`);
    // a knight is a horse: it looks along its rank and may reach past its square with the head, but not into the next piece
    const fits = type === 'n' ? size.x <= 0.55 && size.z <= 1.3 : Math.max(size.x, size.z) <= 0.99 && Math.abs(box.min.x + box.max.x) < 0.24 && Math.abs(box.min.z + box.max.z) < 0.4;
    check(`${tag}: fits its square`, fits, `${size.x.toFixed(2)} x ${size.z.toFixed(2)}`);
    check(`${tag}: height ${height.toFixed(2)} in range`, height > 0.55 && height < (color === 'w' && type === 'b' ? 1.8 : 1.55) && Math.abs(height - box.max.y) < 1e-6);
    check(`${tag}: triangle budget`, tris > 100 && tris < 4000, `${tris} triangles in ${names.length} parts`);
    check(`${tag}: has a head or a torso that turns`, names.includes('head'));
    if (type === 'n') check(`${tag}: four gallop legs, a tail and a rider`, ['lgNF', 'lgPF', 'lgNB', 'lgPB', 'tail', 'rider'].every((n) => names.includes(n)), names.join(','));
    if (['p', 'k'].includes(type) && color === 'w') check(`${tag}: swinging legs and arms`, ['legN', 'legP', 'armN', 'armP'].every((n) => names.includes(n)), names.join(','));
    if (['b', 'q'].includes(type) && color === 'w') check(`${tag}: a robe or gown with swinging arms, no legs`, ['armN', 'armP'].every((n) => names.includes(n)) && !names.includes('legN'), names.join(','));
    if (color === 'b' && type !== 'n') check(`${tag}: swinging legs`, names.includes('legN') && names.includes('legP'), names.join(','));
    // every box belongs to a known group and has a positive size
    const bad = buildVox(color, type).parts.filter((p) => !(p.w > 0 && p.h > 0 && p.d > 0) || !names.includes(p.g));
    check(`${tag}: every box is in a rig group`, bad.length === 0);
  }
}
for (const color of ['w', 'b']) {
  const h = (t) => heights[color + t];
  if (color === 'w') check('heroes: pawn is the lowest of the foot pieces, king and queen stand above the rook', h('p') < h('r') && h('p') < h('b') && h('r') < h('q') && h('r') < h('k') && h('b') < 1.8);
  else check('critters: pawn is the lowest, king and queen the tallest of the foot pieces', h('p') < h('r') && h('p') < h('b') && h('b') < h('k') && h('k') >= h('q') - 0.12);
}
// the three hero pieces that used to look alike (rook, bishop, queen) are told apart at a glance: height (at least 0.12: the mitre
// sits between the rook and the queen), outline and colour
const dom = (t) => {   // colour of the most voxel volume
  const by = new Map(); for (const p of buildVox('w', t).parts) by.set(p.color, (by.get(p.color) || 0) + p.w * p.h * p.d);
  const c = [...by.entries()].sort((a, b) => b[1] - a[1])[0][0]; return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
};
for (const [a, b] of [['r', 'b'], ['r', 'q'], ['b', 'q']]) {
  const dh = Math.abs(heights['w' + a] - heights['w' + b]);
  const dw = Math.abs(outline['w' + a][0] - outline['w' + b][0]), dd = Math.abs(outline['w' + a][1] - outline['w' + b][1]);
  const dc = Math.hypot(...dom(a).map((v, i) => v - dom(b)[i]));
  check(`heroes: ${TYPES[a]} and ${TYPES[b]} differ in height (${dh.toFixed(2)}), outline (${dw.toFixed(2)} x ${dd.toFixed(2)}) and main colour (${dc.toFixed(0)})`, dh >= 0.12 && Math.max(dw, dd) >= 0.1 && dc >= 25);
}
// the bishop mitre (the owner's pick, 1.25): below the king, above the rook, and a staff stands beside it in both colours
check(`hero bishop stays below the king (${heights.wb.toFixed(2)} < ${heights.wk.toFixed(2)}) and above the rook`, heights.wb < heights.wk && heights.wb > heights.wr + 0.1);
for (const color of ['w', 'b']) {
  const parts = buildVox(color, 'b').parts, tall = parts.filter((p) => p.x < -4.5 && p.h >= 9 && p.w <= 1.5);
  check(`${color === 'w' ? 'hero' : 'critter'} bishop carries a staff (a slim tall box at the left, ${tall.length} found)`, tall.length === 1 && tall[0].h >= 12);
}
const domB = (t) => { const by = new Map(); for (const p of buildVox('b', t).parts) by.set(p.color, (by.get(p.color) || 0) + p.w * p.h * p.d); const c = [...by.entries()].sort((x, y) => y[1] - x[1])[0][0]; return rgb(c); };
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
// the red king and queen are told apart in all three queen variants (rqueen=a|b|c): outline, and a crown or body colour the king lacks;
// no variant is pink; every box is a plain positive box, no two boxes share a coplanar overlapping face, every colour is a pixel colour
const kingColours = new Set(buildVox('b', 'k').parts.map((p) => p.color));
const F = { px: 1, nx: 1, py: 1, ny: 1, pz: 1, nz: 1 };
const overlapCoplanar = (parts) => coplanarOverlaps(parts.filter((p) => !p.ry).map((p) => ({ x: p.x - p.w / 2, y: p.y, z: p.z - p.d / 2, w: p.w, h: p.h, d: p.d, color: p.color, faces: F }))).length;
for (const v of ['a', 'b', 'c']) {
  const parts = buildVox('b', 'q', v).parts, tag = `red queen ${v}`;
  const by = new Map(); for (const p of parts) by.set(p.color, (by.get(p.color) || 0) + p.w * p.h * p.d);
  const dom = rgb([...by.entries()].sort((x, y) => y[1] - x[1])[0][0]), dk = Math.hypot(...dom.map((x, i) => x - rgb([...new Set(buildVox('b', 'k').parts.map((p) => p.color))][0])[i]));
  const odd = [...by.keys()].filter((c) => !kingColours.has(c)).length;
  const pink = [...by.keys()].filter((c) => { const [r, g, b] = rgb(c); return r > 200 && b > 120 && b > g + 20 && r - g > 60; });   // rose or magenta pink
  
  check(`${tag}: no pink box (${pink.length}), a colour the king lacks (${odd}) and a body other than the pink of old`, pink.length === 0 && odd >= 2 && dom[0] > 100);
  check(`${tag}: all boxes positive and in the head or leg groups`, parts.every((p) => p.w > 0 && p.h > 0 && p.d > 0 && (p.g === 'head' || p.g.startsWith('leg'))));
  const q = buildVox('b', 'q', v), top = Math.max(...q.parts.map((p) => p.y + p.h)) * 0.08;
  check(`${tag}: stays below the king (${top.toFixed(2)})`, top <= heights.bk + 1e-6 && top > 0.8);
  check(`${tag}: no coplanar overlapping faces`, overlapCoplanar(parts) === 0, `${overlapCoplanar(parts)} found`);
}
const dk = Math.hypot(...domB('k').map((v, i) => v - domB('q')[i]));
check(`critters: king and queen differ in outline (${Math.abs(outline.bk[0] - outline.bq[0]).toFixed(2)}); default queen is variant a (${dk.toFixed(0)} colour distance, the crown tells them apart)`, Math.abs(outline.bk[0] - outline.bq[0]) >= 0.1);
check('rqueen flag: a, b, c are read, no flag is a, an unknown value is ignored', queenVariant('?theme=blocks&rqueen=b') === 'b' && queenVariant('?rqueen=c') === 'c' && queenVariant('') === 'a' && queenVariant('?rqueen=z') === 'a' && queenVariant('?rqueen=') === 'a');
const sig = (v) => JSON.stringify(buildVox('b', 'q', v).parts);
check('the three queen variants differ from each other', new Set(['a', 'b', 'c'].map(sig)).size === 3 && sig(undefined) === sig('a'));
console.log(failed ? `\n${failed} check(s) failed` : '\nBlocks characters contract passed');
process.exit(failed ? 1 : 0);
