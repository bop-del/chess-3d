// Builds src/puzzles/data.js from the Lichess puzzle database (CC0, https://database.lichess.org/#puzzles).
// Run: node tools/build-puzzles.mjs [--csv=<file.csv|file.csv.zst>] [--per-band=100] [--out=src/puzzles/data.js]
// Without --csv it downloads the .zst once to .tmp/data/ (gitignored, about 300 MB) and reuses it. Needs `zstd` on the PATH for .zst files.
// Every kept puzzle is replayed on src/rules.js: legal moves, ends as the theme says. Rerunnable, output is deterministic for one CSV.
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess, nameSq } from '../src/rules.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const PER_BAND = +arg('per-band', 100);
const OUT = resolve(ROOT, arg('out', 'src/puzzles/data.js'));
const URL_ZST = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const BANDS = [
  { id: 'starter', min: 400, max: 599 },
  { id: 'growing', min: 600, max: 799 },
  { id: 'tricky', min: 800, max: 1000 },
];
// Share of each band by theme (the rest is filled from whatever is left, most popular first).
const MIX = { mate1: 0.30, mate2: 0.25, hanging: 0.25, fork: 0.20 };
const MIN_POPULARITY = 90, MIN_PLAYS = 500;
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const themeOf = (themes) => {
  const t = themes.split(' ');
  if (!t.includes('short') && !t.includes('mateIn1') && !t.includes('mateIn2')) return null;
  if (t.includes('mateIn1')) return 'mate1';
  if (t.includes('mateIn2')) return 'mate2';
  if (t.includes('hangingPiece')) return 'hanging';
  if (t.includes('fork')) return 'fork';
  return null;
};
const material = (c, color) => c.board.reduce((s, p) => s + (p && (p === p.toUpperCase()) === (color === 'w') ? VALUE[p.toLowerCase()] : 0), 0);

// Replays the puzzle; returns null when fine, else a reason.
const check = (p) => {
  let c;
  try { c = new Chess(p.fen); } catch { return 'bad fen'; }
  const own = c.turn === 'w' ? 'b' : 'w'; // the player is the side that moves second
  const before = material(c, own) - material(c, c.turn);
  for (const uci of p.moves) {
    const m = c.play({ from: nameSq(uci.slice(0, 2)), to: nameSq(uci.slice(2, 4)), promo: uci[4] || null });
    if (!m) return 'illegal ' + uci;
  }
  const gain = material(c, own) - material(c, own === 'w' ? 'b' : 'w') - before;
  const mate = c.status().reason === 'checkmate';
  if (p.theme === 'mate1' || p.theme === 'mate2') return mate ? null : 'no mate at the end';
  if (p.theme === 'hanging') return gain >= 1 ? null : 'wins no material';
  return gain >= 2 ? null : 'fork wins too little';
};

// ---- read the CSV
let csv = arg('csv', '');
if (!csv) {
  csv = resolve(ROOT, '.tmp/data/lichess_db_puzzle.csv.zst');
  if (!existsSync(csv)) {
    mkdirSync(dirname(csv), { recursive: true });
    console.log('downloading ' + URL_ZST);
    const r = spawnSync('curl', ['-fL', '-o', csv, URL_ZST], { stdio: 'inherit' });
    if (r.status !== 0) { console.error('download failed'); process.exit(2); }
  }
}
let input = createReadStream(csv), child = null;
if (csv.endsWith('.zst')) {
  child = spawn('zstd', ['-dc', csv], { stdio: ['ignore', 'pipe', 'inherit'] });
  input = child.stdout;
}

const pool = new Map(); // key band/theme -> candidates
let rows = 0, kept = 0, rejected = 0;
for await (const line of createInterface({ input })) {
  if (rows++ === 0) continue;
  const f = line.split(',');
  const [id, fen, moves, rating, , pop, plays, themes] = f;
  const r = +rating;
  const band = BANDS.find((b) => r >= b.min && r <= b.max);
  if (!band || +pop < MIN_POPULARITY || +plays < MIN_PLAYS) continue;
  const theme = themeOf(themes);
  if (!theme) continue;
  const mv = moves.split(' ');
  if (mv.length < 2 || mv.length > 6 || mv.length % 2) continue; // one to three own moves after the opponent's
  if (theme === 'mate1' && mv.length !== 2) continue;
  if (theme === 'mate2' && mv.length !== 4) continue;
  const p = { id, fen, moves: mv, theme, rating: r, band: band.id, pop: +pop, plays: +plays };
  const key = band.id + '/' + theme;
  if (!pool.has(key)) pool.set(key, []);
  pool.get(key).push(p);
}
if (child) await new Promise((res) => child.on('close', res));

// ---- pick: per band, quota per theme, most popular (then most played) first, verified on the rules engine
const out = [];
const seen = new Set();
for (const band of BANDS) {
  const chosen = [];
  const take = (theme, n) => {
    const list = (pool.get(band.id + '/' + theme) || []).sort((a, b) => b.pop - a.pop || b.plays - a.plays || (a.id < b.id ? -1 : 1));
    for (const p of list) {
      if (n <= 0) break;
      if (seen.has(p.id)) continue;
      const bad = check(p);
      if (bad) { rejected++; continue; }
      seen.add(p.id); chosen.push(p); n--; kept++;
    }
    return n;
  };
  let short = 0;
  for (const [theme, share] of Object.entries(MIX)) short += take(theme, Math.round(PER_BAND * share));
  for (const theme of Object.keys(MIX)) if (short > 0) short = take(theme, short); // refill from any theme
  if (chosen.length < PER_BAND) console.warn(`band ${band.id}: only ${chosen.length} puzzles`);
  chosen.sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : 1));
  out.push(...chosen);
}

const lines = out.map((p) => `  { id: '${p.id}', fen: '${p.fen}', moves: ['${p.moves.join("', '")}'], theme: '${p.theme}', rating: ${p.rating}, band: '${p.band}' },`);
writeFileSync(OUT, `// Generated by tools/build-puzzles.mjs from the Lichess puzzle database (CC0, https://database.lichess.org/#puzzles). Do not edit by hand.
// fen is the position before the opponent's last move. moves[0] is that opponent move, then the player's solution
// alternates with the replies (UCI). The player is the side to move after moves[0].
export const BANDS = ['starter', 'growing', 'tricky'];
export const PUZZLES = [
${lines.join('\n')}
];
`);
const count = {};
for (const p of out) { const k = p.band + ' ' + p.theme; count[k] = (count[k] || 0) + 1; }
console.log(`${rows - 1} rows read, ${out.length} puzzles written to ${OUT.replace(ROOT + '/', '')} (${rejected} rejected on the rules engine)`);
console.log(count);
