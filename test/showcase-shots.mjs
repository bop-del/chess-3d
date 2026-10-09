// Showcase film shots (CHE-374): every shot of SHOTS (src/showcase/camera.js) and EXTRA_SHOTS (src/showcase/shots-extra.js)
// sampled over its progress on wide and portrait fits: finite, above the ground, never on the look point, no jumps; the
// extra shots also keep clear of the pieces (y >= 1.3 within 1.2 squares of a square) and within 22 * fit.wide of the centre.
// Run: node test/showcase-shots.mjs    Exit 0 when every check holds, 1 otherwise.
import * as THREE from 'three';
import { SHOTS, ease } from '../src/showcase/camera.js';
import { EXTRA_SHOTS } from '../src/showcase/shots-extra.js';

let bad = 0, ok = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };

const FITS = [{ wide: 1, close: 1 }, { wide: 2.2, close: 1.48 }];
const SQUARES = ['a1', 'h8', 'a8', 'h1', 'e4', 'd5', 'a5', 'h4', 'e1', 'd8'];
const MOVES = [['e2', 'e4', 'w'], ['g1', 'f3', 'w'], ['a1', 'a8', 'w'], ['h1', 'a8', 'w'], ['b8', 'c6', 'b'], ['e8', 'g8', 'b'], ['d1', 'h5', 'w'], ['h7', 'h6', 'b'], ['e4', 'e4', 'w']];
const STEPS = 40;

// the options each shot is sampled with
function cases(kind) {
  const at = SQUARES.map((s) => ({ at: s }));
  const moves = MOVES.map(([from, to, color]) => ({ from, to, color }));
  switch (kind) {
    case 'establish': case 'end': return [{}, { yaw: 2 }];
    case 'wide': return [{}, { yaw: Math.PI, focus: new THREE.Vector3(3, 0, -3) }];
    case 'top': return [{}, ...at.map((o) => ({ ...o, yaw: 1 }))];
    case 'dolly': return moves.flatMap((m) => [{ ...m, side: 1 }, { ...m, side: -1 }]);
    case 'crane': case 'pushin': return [...at, ...moves.map(({ from, to }) => ({ at: to, from }))];
    case 'over': case 'lowtrack': return moves;
    case 'hero': case 'mate': case 'reveal': case 'spiral': return at.flatMap((o) => [{ ...o, yaw: 0 }, { ...o, yaw: 2.5 }]);
    case 'battle': return [{ target: new THREE.Vector3(0.5, 0.6, -0.5), yaw: 0.5, pitch: 0.2, dist: 7 }, { target: new THREE.Vector3(-3.5, 0.6, 3.5), yaw: 3, pitch: 1.2, dist: 2.5 }];
    case 'whip': return [{ yaw0: 0, yaw1: Math.PI / 2 }, { yaw0: 3, yaw1: -1 }];
    default: return [{}];
  }
}

// distance in the floor plane from (x, z) to the nearest square centre
const nearSquare = (x, z) => Math.hypot(x - Math.min(3.5, Math.max(-3.5, x)), z - Math.min(3.5, Math.max(-3.5, z)));

function sample(factory, opts, fit) {
  const shot = factory({ ...opts, fit });
  const span = shot.dur > 1e6 ? 20 : shot.dur;   // the endless end shot: its first 20 seconds
  const out = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const pts = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = span * i / STEPS;
    const u = shot.linear ? t / shot.dur : (shot.ease || ease.inOut)(Math.min(1, t / shot.dur));
    shot.pose(u, t, out);
    pts.push({ pos: out.pos.clone(), look: out.look.clone() });
  }
  return { shot, pts };
}

function check(kind, factory, extra) {
  const fails = new Set();
  for (const fit of FITS) for (const opts of cases(kind)) {
    const label = `${kind} ${JSON.stringify(opts, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v))} fit ${fit.wide}`;
    const { pts } = sample(factory, opts, fit);
    const note = (rule, m) => { if (!fails.has(rule)) { fails.add(rule); fail(`${label}: ${m}`); } };
    const steps = [];
    for (let i = 0; i < pts.length; i++) {
      const { pos, look } = pts[i];
      if (![pos.x, pos.y, pos.z, look.x, look.y, look.z].every(Number.isFinite)) { note('finite', `not finite at step ${i}`); continue; }
      if (pos.y < 0.5) note('ground', `y ${pos.y.toFixed(2)} < 0.5 at step ${i}`);
      if (pos.distanceTo(look) < 1.5) note('look', `${pos.distanceTo(look).toFixed(2)} from the look point at step ${i}`);
      if (extra) {
        if (nearSquare(pos.x, pos.z) <= 1.2 && pos.y < 1.3) note('pieces', `y ${pos.y.toFixed(2)} < 1.3 over the board at step ${i}`);
        const r = Math.hypot(pos.x, pos.y, pos.z);
        if (r > 22 * fit.wide) note('far', `${r.toFixed(1)} from the centre at step ${i}`);
      }
      if (i) steps.push(pos.distanceTo(pts[i - 1].pos));
    }
    const sorted = [...steps].sort((a, b) => a - b), median = sorted[sorted.length >> 1], max = sorted.at(-1);
    if (median > 1e-6 && max > 6 * median) note('jump', `step ${max.toFixed(3)} is ${(max / median).toFixed(1)} times the median ${median.toFixed(3)}`);
  }
  if (fails.size === 0) { ok++; console.log(`PASS ${kind}${extra ? ' (extra)' : ''}`); }
}

for (const [kind, f] of Object.entries(SHOTS)) check(kind, f, false);
for (const [kind, f] of Object.entries(EXTRA_SHOTS)) check(kind, f, true);
for (const kind of Object.keys(EXTRA_SHOTS)) if (SHOTS[kind]) fail(`extra shot ${kind} clashes with a SHOTS name`);

console.log(bad ? `${bad} failed` : `all ${ok} shots pass`);
process.exit(bad ? 1 : 0);
