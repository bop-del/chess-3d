// Capture tray layout, headless. Real piece footprints and heights (measured from the built geometry) go through
// src/trays.js: a full tray (15), every size up to it, and the worst cases (all queens, mixed) stay inside the slab margin,
// never overlap, and come out ordered by value. Run: node test/trays.mjs   Exit 0 pass, 1 on a failed check.
import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import { createPieceMaterials } from '../src/materials.js';
import { buildPawn, buildRook, buildKnight } from '../src/pieces/setA.js';
import { buildBishop, buildQueen } from '../src/pieces/setB.js';
import { layoutTray, checkLayout, VALUE_ORDER } from '../src/trays.js';

export function runTrayChecks() {
  const out = [];
  const mats = createPieceMaterials();
  const B = { p: buildPawn, r: buildRook, n: buildKnight, b: buildBishop, q: buildQueen };
  const real = {};
  for (const [t, f] of Object.entries(B)) {
    const g = f(mats.white); g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), s = box.getSize(new THREE.Vector3());
    real[t] = { type: t, dia: Math.max(s.x, s.z), h: s.y };
  }
  const mk = (str) => [...str].map((c) => ({ ...real[c] }));
  const cases = {
    'full tray (8p 2n 2b 2r q)': 'pppppppp' + 'nnbbrrq',
    'full tray, capture order reversed': 'qrrbbnn' + 'pppppppp',
    'nine queens and more (promotions, 15 pieces)': 'qqqqqqqqqqqqqqq',
    'one piece': 'q', 'two pawns': 'pp', 'seven': 'pnbrqpp',
  };
  for (const [name, str] of Object.entries(cases)) {
    const items = mk(str), lay = layoutTray(items), bad = checkLayout(items, lay);
    out.push({ name: `tray layout: ${name}`, pass: bad.length === 0, detail: bad.length ? bad.slice(0, 3).join('; ') : `scale ${lay.scale.toFixed(2)}, inside the margin, no overlap` });
  }
  // every count from 1 to 15, grown one capture at a time in a plausible order
  let bad = [];
  const seq = 'ppnpbpprpnpbrqp';
  for (let n = 1; n <= 15; n++) { const items = mk(seq.slice(0, n)); bad.push(...checkLayout(items, layoutTray(items)).map((m) => `${n}: ${m}`)); }
  out.push({ name: 'tray layout: every fill level 1 to 15', pass: bad.length === 0, detail: bad.slice(0, 3).join('; ') || 'ok' });
  // value order: z grows from the far end toward the camera as the value drops (the queen stands at the back)
  const items = mk('pnbrqpp'), lay = layoutTray(items);
  const order = items.map((it, i) => i).sort((a, b) => lay.slots[a].z - lay.slots[b].z || lay.slots[a].x - lay.slots[b].x);
  const vals = order.map((i) => VALUE_ORDER[items[i].type]);
  out.push({ name: 'tray layout: ordered by value, queen first', pass: vals.every((v, i) => i === 0 || v >= vals[i - 1]), detail: order.map((i) => items[i].type).join('') });
  // a full tray keeps (nearly) the normal piece size
  const full = layoutTray(mk('pppppppp' + 'nnbbrrq'));
  out.push({ name: 'tray layout: a full tray keeps the pieces at least 0.5 scale', pass: full.scale >= 0.5, detail: `scale ${full.scale.toFixed(2)}` });
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = runTrayChecks();
  for (const r of res) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  ${r.detail}`);
  process.exit(res.every((r) => r.pass) ? 0 : 1);
}
