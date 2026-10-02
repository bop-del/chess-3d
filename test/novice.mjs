// Novice level: the hanging piece rule, the weak move rate, depth 2, level plumbing. Run: node test/novice.mjs
import { searchMove, LEVELS, NOVICE_WEAK } from '../src/ai.js';
import { Chess, START_FEN } from '../src/rules.js';

let fail = 0;
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ': ' + extra : ''}`); };
const run = (fen, opts) => { const g = searchMove(fen, 2, undefined, opts); let r; while (!(r = g.next()).done); return r.value; };
const uci = (m) => 'abcdefgh'[m.from & 7] + ((m.from >> 3) + 1) + 'abcdefgh'[m.to & 7] + ((m.to >> 3) + 1);
// a seeded random function (mulberry32), so the test is the same on every run
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

check('levels', LEVELS.map((l) => `${l.id}:${l.depth}:${l.elo}`).join(' ') === 'novice:2:700 easy:2:900 normal:3:1200 hard:4:1450');

// hanging piece: white queen d1 can take an undefended black knight on d5 (a free piece). Always taken, whatever the random says.
const FREE = '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1';
for (const r of [0, 0.1, 0.34, 0.5, 0.99]) check(`free knight is taken (random ${r})`, uci(run(FREE, { level: 'novice', random: () => r }).move) === 'd1d5');
// a pawn takes a defended knight: worth more than the capturer, so it wins outright
const TRADE_UP = '4k3/8/2p5/3n4/4P3/8/8/4K3 w - - 0 1';
check('pawn takes defended knight', uci(run(TRADE_UP, { level: 'novice', random: () => 0.1 }).move) === 'e4d5');
// a queen would take a defended pawn: not outright, so the weak branch (random below the chance) is free to play anything weaker
const DEFENDED = '4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1';
check('defended pawn is not grabbed by the depth 2 search (best branch sees the recapture)', uci(run(DEFENDED, { level: 'novice', random: () => 0.99 }).move) !== 'd1d5');
// the biggest gain wins: a free queen beats a free pawn (two undefended pieces, the rooks can take either)
check('free queen over free pawn', uci(run('4k3/8/8/q4p2/8/8/8/R4RK1 w - - 0 1', { level: 'novice', random: () => 0.5 }).move) === 'a1a5');

// weak move rate: from the start position, over many seeds, count moves outside the best pool (Easy margin 50)
let weak = 0, n = 2000;
const best = new Set();
{
  const g = searchMove(START_FEN, 2, 50, { random: () => 0 }); let r; while (!(r = g.next()).done);
  // the best pool at depth 2: moves within 50 of the top, found by sampling Easy style
  for (let i = 0; i < 400; i++) { const gg = searchMove(START_FEN, 2, 50, { random: seeded(i) }); let rr; while (!(rr = gg.next()).done); best.add(uci(rr.value.move)); }
}
for (let i = 0; i < n; i++) { const m = run(START_FEN, { level: 'novice', random: seeded(1000 + i) }).move; if (!best.has(uci(m))) weak++; }
const rate = weak / n;
check('weak move rate near the setting', rate > NOVICE_WEAK * 0.5 && rate < NOVICE_WEAK * 1.1, `${(rate * 100).toFixed(1)}% outside the best pool (setting ${NOVICE_WEAK * 100}%)`);

// same search depth as Easy: the same node count
const start = run(START_FEN, { level: 'novice', random: seeded(1) });
check('depth 2 search, as Easy', start.nodes === run(START_FEN, { level: 'easy' }).nodes, `${start.nodes} nodes`);
// level wins over depth, the old signature still works
const e = run(START_FEN, { level: 'easy' }); const old = run(START_FEN, undefined);
check('level easy and the old signature search', e.nodes > 20 && old.nodes > 20);
// deterministic with the same random
const a = uci(run(START_FEN, { level: 'novice', random: seeded(7) }).move), b = uci(run(START_FEN, { level: 'novice', random: seeded(7) }).move);
check('deterministic', a === b);
// no moves
check('no legal move', run('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', { level: 'novice' }).move === null);
// always legal
{
  const ch = new Chess(START_FEN); let ok = true;
  for (let i = 0; i < 60 && ok; i++) {
    const r = run(ch.fen(), { level: 'novice', random: seeded(i) });
    if (!r.move) break;
    ok = ch.moves().some((m) => m.from === r.move.from && m.to === r.move.to && m.promo === r.move.promo);
    if (ok) ch.play(r.move);
  }
  check('plays legal moves', ok);
}
process.exit(fail ? 1 : 0);
