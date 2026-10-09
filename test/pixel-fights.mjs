// Contract of the Pixelwelt capture fights (CHE-371, the owner's pick: all fights rotate), headless: two or three fights per
// attacker type with ids <type>-a, -b, -c, a German line and a still time; with no flag they rotate per type (deterministic,
// never the same one twice in a row); ?pixfight=old plays the earlier pixel gore scene; a forced id wins for its own type; the
// director loads the fights for every Pixelwelt capture and the finale on every Pixelwelt checkmate, with no flag.
// Run: node test/pixel-fights.mjs    Exit 0 pass, 1 on a failed check.
import { readFileSync } from 'node:fs';
import { VARIANTS, pick } from '../src/battle/scenes/pixel/fights.js';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const TYPES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const COUNT = { p: 2, n: 3, b: 3, r: 3, q: 3, k: 3 };

const ids = VARIANTS.map((v) => v.id);
check('17 fights with unique ids', ids.length === 17 && new Set(ids).size === ids.length, ids.join(' '));
for (const [t, name] of Object.entries(TYPES)) {
  const own = VARIANTS.filter((v) => v.attacker === t);
  check(`${name}: ${COUNT[t]} fights, ids ${name}-a, ${name}-b, ... in order`, own.length === COUNT[t] && own.every((v, i) => v.id === `${name}-${'abc'[i]}`), own.map((v) => v.id).join(' '));
  check(`${name}: each has a German line, a still time inside the scene and a run function`, own.every((v) => typeof v.de === 'string' && v.de.length > 10 && v.still > 0 && v.still < 4.5 && typeof v.run === 'function'), own.map((v) => `${v.still}`).join(' '));
  const seq = (mode) => Array.from({ length: 6 }, (_, n) => pick(t, { mode, n, square: 35 }).id);
  check(`${name}: with no flag the fights rotate deterministically, never today's earlier scene`, seq('').join() === seq('').join() && new Set(seq('')).size === own.length && !seq('').includes('classic'), seq('').join(' '));
  check(`${name}: two captures in a row never repeat a fight`, seq('').every((id, i, a) => i === 0 || id !== a[i - 1]));
  check(`${name}: ?pixfight=old plays the earlier pixel gore scene`, seq('old').every((id) => id === 'classic'));
  check(`${name}: a forced id wins for its own type`, pick(t, { mode: `${name}-b`, n: 0 }).id === `${name}-b` && pick(t, { mode: `${name}-a`, n: 1 }).id === `${name}-a`);
  const other = t === 'p' ? 'knight-a' : 'pawn-a';
  check(`${name}: a forced id of another type falls back to the rotation`, pick(t, { mode: other, n: 0 }).attacker === t);
}
const dir = readFileSync(new URL('../src/battle/director.js', import.meta.url), 'utf8');
check('director: Pixelwelt captures always load the fights (no flag)', /Object\.assign\(SCENES, import\.meta\.glob\('\.\/scenes\/pixel\/fights\.js'\)\)/.test(dir) && /style === 'pixel' \? 'pixel\/fights'/.test(dir) && !/PIXFIGHT/.test(dir));
check('director: the finale plays on every Pixelwelt checkmate (no flag)', /game\.on\('gameover', \(st\) => \{\s*if \(st\.reason !== 'checkmate' \|\| themes\?\.current\?\.\(\) !== 'pixel'\) return;/.test(dir) && /import\('\.\.\/themes\/pixel\/finale\.js'\)/.test(dir) && !/params\.get\('finale'\)/.test(dir));
process.exitCode = failed ? 1 : 0;
