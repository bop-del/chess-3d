// Puzzle data: every puzzle legal and solvable on src/rules.js, counts per band, theme lines in both languages.
// Run: node test/puzzles-data.mjs    Exit 0 when every check holds, 1 otherwise.
import { Chess, nameSq } from '../src/rules.js';
import { PUZZLES, BANDS } from '../src/puzzles/data.js';
import { THEMES } from '../src/puzzles/themes.js';

let bad = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };
const check = (cond, m) => { if (!cond) fail(m); };

check(BANDS.join() === 'starter,growing,tricky', 'bands are starter, growing, tricky');
for (const b of BANDS) {
  const n = PUZZLES.filter((p) => p.band === b).length;
  check(n >= 90 && n <= 110, `band ${b} has ${n} puzzles, expected about 100`);
}
check(PUZZLES.length >= 270, `${PUZZLES.length} puzzles, expected about 300`);
check(new Set(PUZZLES.map((p) => p.id)).size === PUZZLES.length, 'puzzle ids are unique');
check(!['\u2014', '-'.repeat(2)].some((d) => JSON.stringify(THEMES).includes(d)), 'theme lines have no em dash or double hyphen');

const range = { starter: [400, 599], growing: [600, 799], tricky: [800, 1000] };
for (const p of PUZZLES) {
  const tag = `${p.id} (${p.band}, ${p.theme})`;
  check(THEMES[p.theme]?.en && THEMES[p.theme]?.de, `${tag}: theme line in en and de`);
  check(BANDS.includes(p.band) && p.rating >= range[p.band][0] && p.rating <= range[p.band][1], `${tag}: rating ${p.rating} fits the band`);
  const n = p.moves.length;
  check(n >= 2 && n <= 6 && n % 2 === 0, `${tag}: one to three own moves, got ${n} plies`);
  if (p.theme === 'mate1') check(n === 2, `${tag}: mate in one has two plies`);
  if (p.theme === 'mate2') check(n === 4, `${tag}: mate in two has four plies`);
  let c;
  try { c = new Chess(p.fen); } catch { fail(`${tag}: bad fen`); continue; }
  let ok = true;
  for (const u of p.moves) {
    if (!c.play({ from: nameSq(u.slice(0, 2)), to: nameSq(u.slice(2, 4)), promo: u[4] || null })) { fail(`${tag}: illegal move ${u}`); ok = false; break; }
  }
  if (!ok) continue;
  if (p.theme.startsWith('mate')) check(c.status().reason === 'checkmate', `${tag}: ends in checkmate`);
}

console.log(bad ? `${bad} failed` : `ok: ${PUZZLES.length} puzzles legal and solvable`);
process.exit(bad ? 1 : 0);
