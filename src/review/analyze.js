// Game review, the engine part: Hard's search (src/ai.js, depth 4, no randomness) on one position at a time. No DOM, so it runs
// in a Worker (worker.js), on the main thread as the fallback (engine.js) and in node (test/review.mjs).
import { Chess } from '../rules.js';
import { searchMove, levelById } from '../ai.js';

export const MATE = 100000;
export const DEPTH = levelById('hard').depth;
const noRandom = () => 0;

function finish(gen) {
  let r;
  do { r = gen.next(); } while (!r.done);
  return r.value;
}

// the analysis of one position: { fen, turn, score, best }. score is centipawns for the side to move (mate counts as +-MATE),
// best is { from, to, promo, san } or null when the game is over there.
// Generator: .next() runs one slice of the search, so a caller can interleave other work (see analyzeMany).
export function* analyzeSteps(fen, depth = DEPTH) {
  const ch = new Chess(fen);
  const legal = ch.moves();
  if (!legal.length) return { fen, turn: ch.turn, score: ch.inCheck() ? -MATE : 0, best: null };
  const r = yield* searchMove(fen, depth, 0, { random: noRandom });
  const m = legal.find((x) => x.from === r.move.from && x.to === r.move.to && (x.promo || null) === (r.move.promo || null));
  return { fen, turn: ch.turn, score: r.score, best: { from: m.from, to: m.to, promo: m.promo || null, san: ch.san(m, legal) } };
}
export const analyzePosition = (fen, depth = DEPTH) => finish(analyzeSteps(fen, depth));

// A short line of best play in SAN from a position: the given first move, then the search at a lower depth.
export function bestLine(fen, first, plies = 4, depth = 3) {
  const ch = new Chess(fen);
  const out = [];
  let m = first;
  for (let i = 0; i < plies && m; i++) {
    const legal = ch.moves();
    const pick = legal.find((x) => x.from === m.from && x.to === m.to && (x.promo || null) === (m.promo || null));
    if (!pick) break;
    out.push(ch.san(pick, legal));
    ch._make(pick, false);
    if (i === plies - 1 || !ch.moves().length) break;
    m = finish(searchMove(ch.fen(), depth, 0, { random: noRandom })).move;
  }
  return out;
}

// Analyse positions one after the other. onPosition(index, result) after each; shouldStop() is asked between slices.
// wait() is awaited about every `sliceMs`, so messages and the page get their turn (the default is a macrotask).
export async function analyzeMany(fens, { depth = DEPTH, onPosition = () => {}, shouldStop = () => false, sliceMs = 20,
  wait = () => new Promise((r) => setTimeout(r, 0)) } = {}) {
  for (let i = 0; i < fens.length; i++) {
    const gen = analyzeSteps(fens[i], depth);
    let t0 = Date.now(), r;
    for (;;) {
      if (shouldStop()) return false;
      r = gen.next();
      if (r.done) break;
      if (Date.now() - t0 >= sliceMs) { await wait(); t0 = Date.now(); }
    }
    onPosition(i, r.value);
  }
  return true;
}
