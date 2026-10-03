// Game review, the pure part: win chance, move classification, accuracy, the friendly sentence facts. No DOM, no three.
// Scores are centipawns from the point of view of the side to move in the position they belong to (the engine's own).
import { Chess } from '../rules.js';

// A move is marked by how much win chance (0 to 100 points) it gives away against the engine's best move.
// 10 points is about a pawn from an equal game, 25 points a bit under a knight.
export const MISTAKE_DROP = 10;
export const BLUNDER_DROP = 25;
const CAP = 1000;
const MATE_SCORE = 99000;   // an engine score from here up is a forced checkmate (ai.js counts mate as 100000 minus the ply)   // mate and huge scores count as this many centipawns

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const VAL = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };

// centipawns (mover's view) to the mover's win chance, 0 to 100
export const winPercent = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.004 * clamp(cp, -CAP, CAP))) - 1);

// win chance given away by playing a move: bestScore is the engine score before the move, replyScore the engine score of the
// position after it (the opponent's view, so the value of the played move is its negative)
export function winDrop(bestScore, replyScore) {
  return Math.max(0, winPercent(bestScore) - winPercent(-replyScore));
}

// 'best' (the engine's move), 'good', 'mistake' or 'blunder'
export function classify(drop, isBest = false) {
  if (isBest) return 'best';
  if (drop >= BLUNDER_DROP) return 'blunder';
  if (drop >= MISTAKE_DROP) return 'mistake';
  return 'good';
}

// accuracy of one move, 100 for no loss, falling quickly (the Lichess curve)
export const moveAccuracy = (drop) => clamp(103.1668 * Math.exp(-0.04354 * drop) - 3.1669, 0, 100);

// mean accuracy of a list of drops, or null with no moves
export function accuracy(drops) {
  if (!drops.length) return null;
  return drops.reduce((a, d) => a + moveAccuracy(d), 0) / drops.length;
}

const uciOf = (m) => m.from + ',' + m.to + ',' + (m.promo || '');
const whiteView = (turn, score) => clamp(turn === 'w' ? score : -score, -CAP, CAP);

// positions: the analysis of every position of the game, index 0 the start, index n after n moves (a missing entry is not
// analysed yet). Each is { turn, score, best: { from, to, promo, san } | null }.
// moves: [{ from, to, promo, san, color }]. Returns per move { kind, drop, bestMove } (kind null until both positions are known),
// the white-view evaluation per position (null when not known), and the accuracy per side.
export function reviewGame(positions, moves) {
  const out = [];
  const drops = { w: [], b: [] };
  for (let i = 0; i < moves.length; i++) {
    const a = positions[i], b = positions[i + 1], m = moves[i];
    if (!a || !b) { out.push({ kind: null, drop: 0, bestMove: null }); continue; }
    const isBest = !!a.best && uciOf(a.best) === uciOf(m);
    const drop = isBest ? 0 : winDrop(a.score, b.score);
    const kind = classify(drop, isBest);
    out.push({ kind, drop, bestMove: kind === 'mistake' || kind === 'blunder' ? a.best : null });
    drops[m.color].push(drop);
  }
  const evals = positions.map((p) => (p ? whiteView(p.turn, p.score) : null));
  return { moves: out, evals, accuracy: { w: accuracy(drops.w), b: accuracy(drops.b) } };
}

// What to say about a marked move. Returns { type, san, piece? } and the text is made from it in the user's language.
//   mate        the better move is checkmate
//   allowsMate  the played move lets the opponent force checkmate
//   win         the better move wins a piece (piece is its letter)
//   hang        the played move lets the opponent take a piece (piece is its letter)
//   check       the better move gives check
//   generic     nothing simpler to say
// fenBefore: the position the move was played in. played, best: { from, to, promo }. reply: the engine's best answer to the
// played move (the position after it) and replyScore its score, or null.
export function sentenceFacts(fenBefore, played, best, reply = null, replyScore = 0) {
  const ch = new Chess(fenBefore);
  const legal = ch.moves();
  const find = (list, m) => list.find((x) => x.from === m.from && x.to === m.to && (x.promo || null) === (m.promo || null));
  const bm = find(legal, best), pm = find(legal, played);
  if (!bm) return { type: 'generic', san: best.san };
  const san = ch.san(bm, legal);
  ch._make(bm, false);
  const mate = ch.status().reason === 'checkmate';
  const check = ch.inCheck();
  ch._unmake();
  if (mate) return { type: 'mate', san };
  if (replyScore >= MATE_SCORE) return { type: 'allowsMate', san };
  const gain = bm.captured ? VAL[bm.captured.toLowerCase()] : 0;
  const playedGain = pm && pm.captured ? VAL[pm.captured.toLowerCase()] : 0;
  if (gain >= 100 && gain > playedGain) return { type: 'win', san, piece: bm.captured.toLowerCase() };
  if (pm && reply) {
    ch._make(pm, false);
    const rm = find(ch.moves(), reply);
    ch._unmake();
    if (rm && rm.captured) {
      const lost = VAL[rm.captured.toLowerCase()];
      if (lost >= 300 && lost - playedGain >= 200) return { type: 'hang', san, piece: rm.captured.toLowerCase() };
    }
  }
  if (check) return { type: 'check', san };
  return { type: 'generic', san };
}
