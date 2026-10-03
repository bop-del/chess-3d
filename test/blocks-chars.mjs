// Contract of the Blocks theme characters, headless: all 12 build, stand on the board inside their square, are told apart by
// height, have the animated parts the rig expects (legs, arms, head, horse legs, rider), and stay inside a triangle budget.
// Run: node test/blocks-chars.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';
import { buildTemplate } from '../src/themes/blocks/rig.js';
import { buildVox } from '../src/themes/blocks/vox.js';

const TYPES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const mat = new THREE.MeshBasicMaterial();
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

const heights = {};
for (const color of ['w', 'b']) {
  const who = color === 'w' ? 'hero' : 'critter';
  for (const [type, name] of Object.entries(TYPES)) {
    const tag = `${who} ${name}`;
    const { rig, height } = buildTemplate(color, type, mat);
    rig.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig), size = box.getSize(new THREE.Vector3());
    let tris = 0; rig.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
    const names = rig.children.map((c) => c.name);
    heights[color + type] = box.max.y;
    check(`${tag}: stands on the board`, Math.abs(box.min.y) < 0.01, `min y ${box.min.y.toFixed(3)}`);
    // a knight is a horse: it looks along its rank and may reach past its square with the head, but not into the next piece
    const fits = type === 'n' ? size.x <= 0.55 && size.z <= 1.3 : Math.max(size.x, size.z) <= 0.99 && Math.abs(box.min.x + box.max.x) < 0.24 && Math.abs(box.min.z + box.max.z) < 0.4;
    check(`${tag}: fits its square`, fits, `${size.x.toFixed(2)} x ${size.z.toFixed(2)}`);
    check(`${tag}: height ${height.toFixed(2)} in range`, height > 0.55 && height < 1.55 && Math.abs(height - box.max.y) < 1e-6);
    check(`${tag}: triangle budget`, tris > 100 && tris < 4000, `${tris} triangles in ${names.length} parts`);
    check(`${tag}: has a head or a torso that turns`, names.includes('head'));
    if (type === 'n') check(`${tag}: four gallop legs, a tail and a rider`, ['lgNF', 'lgPF', 'lgNB', 'lgPB', 'tail', 'rider'].every((n) => names.includes(n)), names.join(','));
    if (['p', 'b', 'k'].includes(type) && color === 'w') check(`${tag}: swinging legs and arms`, ['legN', 'legP', 'armN', 'armP'].every((n) => names.includes(n)), names.join(','));
    if (color === 'b' && type !== 'n') check(`${tag}: swinging legs`, names.includes('legN') && names.includes('legP'), names.join(','));
    // every box belongs to a known group and has a positive size
    const bad = buildVox(color, type).parts.filter((p) => !(p.w > 0 && p.h > 0 && p.d > 0) || !names.includes(p.g));
    check(`${tag}: every box is in a rig group`, bad.length === 0);
  }
}
for (const color of ['w', 'b']) {
  const h = (t) => heights[color + t];
  check(`${color === 'w' ? 'heroes' : 'critters'}: pawn is the lowest, king and queen the tallest of the foot pieces`, h('p') < h('r') && h('p') < h('b') && h('b') < h('k') && h('k') >= h('q') - 0.12);
}
console.log(failed ? `\n${failed} check(s) failed` : '\nBlocks characters contract passed');
process.exit(failed ? 1 : 0);
