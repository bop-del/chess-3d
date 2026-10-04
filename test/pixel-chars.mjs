// Contract of the Pixelwelt figures, headless: all 12 build, stand on the board inside their square, keep the blocky
// proportions (the head is a cube of 8 pixels with a face), are told apart by height, have the animated parts the rig expects and
// stay inside a triangle budget. Run: node test/pixel-chars.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';
import { buildTemplate } from '../src/themes/blocks/rig.js';
import { buildPixelVox } from '../src/themes/pixel/figures.js';

const TYPES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const mat = new THREE.MeshBasicMaterial();
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

{
  const heights = {}, outline = {};
  for (const color of ['w', 'b']) {
    for (const [type, name] of Object.entries(TYPES)) {
      const tag = `${color === 'w' ? 'white' : 'black'} ${name}`;
      const vox = buildPixelVox(color, type);
      const { rig, height } = buildTemplate(color, type, mat, buildPixelVox, { shade: true });
      rig.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(rig), size = box.getSize(new THREE.Vector3());
      let tris = 0; rig.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
      const names = rig.children.map((c) => c.name);
      heights[color + type] = box.max.y; outline[color + type] = [size.x, size.z];
      check(`${tag}: stands on the board`, Math.abs(box.min.y) < 0.01, `min y ${box.min.y.toFixed(3)}`);
      const fits = type === 'n' ? size.x <= 0.6 && size.z <= 1.3 : Math.max(size.x, size.z) <= 0.99 && Math.abs(box.min.x + box.max.x) < 0.24 && Math.abs(box.min.z + box.max.z) < 0.4;
      check(`${tag}: fits its square`, fits, `${size.x.toFixed(2)} x ${size.z.toFixed(2)}`);
      check(`${tag}: height ${height.toFixed(2)} in range`, height > 0.7 && height < 2.3 && Math.abs(height - box.max.y) < 1e-6);
      check(`${tag}: triangle budget`, tris > 100 && tris < 5000, `${tris} triangles in ${names.length} parts`);
      check(`${tag}: has a head that turns`, names.includes('head'));
      if (type === 'n') check(`${tag}: four gallop legs, a tail and a rider`, ['lgNF', 'lgPF', 'lgNB', 'lgPB', 'tail', 'rider'].every((n) => names.includes(n)), names.join(','));
      const bad = vox.parts.filter((p) => !(p.w > 0 && p.h > 0 && p.d > 0) || !names.includes(p.g));
      check(`${tag}: every box is in a rig group`, bad.length === 0);
      // the head is the cube of the blocky scheme: a box 8 x 8 x 8 pixels at the top of the figure (the knight's rider is a little smaller)
      if (type !== 'n') check(`${tag}: a cube head of 8 pixels`, vox.parts.some((p) => p.g === 'head' && p.w >= 8 && p.h >= 8 && p.d >= 8 && p.w <= 8.01 && p.h <= 8.01 && p.d <= 8.01));
      check(`${tag}: a painted face (several 1 pixel boxes on the head front)`, vox.parts.filter((p) => (p.g === 'head' || p.g === 'rider') && p.h <= 1 && p.d < 0.5).length >= 4);
    }
  }
  for (const color of ['w', 'b']) {
    const h = (t) => heights[color + t];
    check(`${color}: pawn is the lowest, king and queen stand above the rook`, h('p') < h('r') && h('p') < h('b') && h('r') < h('q') && h('r') < h('k'));
    check(`${color}: queen and king both wear a crown above the head (taller than 1.4)`, h('q') > 1.4 && h('k') > 1.4);
  }
  // the six types are told apart: pairwise by height or outline
  for (const color of ['w', 'b']) {
    const ts = Object.keys(TYPES);
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const a = color + ts[i], b = color + ts[j];
      const dh = Math.abs(heights[a] - heights[b]), dw = Math.max(Math.abs(outline[a][0] - outline[b][0]), Math.abs(outline[a][1] - outline[b][1]));
      check(`${color}: ${TYPES[ts[i]]} and ${TYPES[ts[j]]} differ (height ${dh.toFixed(2)}, outline ${dw.toFixed(2)})`, dh >= 0.08 || dw >= 0.1);
    }
  }
}
console.log(failed ? `\n${failed} check(s) failed` : '\nPixelwelt figures contract passed');
process.exit(failed ? 1 : 0);
