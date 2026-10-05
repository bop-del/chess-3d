// The goal screen of a line: the position its last move reaches, and the squares to mark on it. Pure, no DOM and no board:
// the Explain controller loads the FEN into the game and hands the marks to the hint layer.
//
// A mark is a square where a piece that moved in the line ends up. `own` is true for the side the line is for (strong
// mark), false for the other side (quiet mark). A piece that was captured on the way has no mark, a piece that moved twice
// is marked once, on its last square. Works the same for a starter line and for any line a player adds later: it needs
// nothing but the moves.
import { Chess } from './../rules.js';

const clean = (san) => String(san).replace(/[+#!?]+$/, '');
const cache = new WeakMap();

export function goalOf(line) {
  let g = cache.get(line);
  if (g) return g;
  const chess = new Chess();
  const at = new Array(64).fill(null);                 // the piece standing on a square: { color, moved }
  for (let sq = 0; sq < 64; sq++) if (chess.board[sq]) at[sq] = { color: chess.board[sq] < 'a' ? 'w' : 'b', moved: false };
  for (const m of line.moves) {
    const mv = chess.moveFromSan(clean(m.san));
    if (!mv) throw new Error(`illegal move ${m.san} in line ${line.id}`);
    const piece = at[mv.from];
    if (mv.flag === 'e') at[mv.to + (mv.color === 'w' ? -8 : 8)] = null;
    else if (mv.flag === 'k') { at[mv.to - 1] = at[mv.to + 1]; at[mv.to + 1] = null; if (at[mv.to - 1]) at[mv.to - 1].moved = true; }
    else if (mv.flag === 'q') { at[mv.to + 1] = at[mv.to - 2]; at[mv.to - 2] = null; if (at[mv.to + 1]) at[mv.to + 1].moved = true; }
    at[mv.to] = piece; at[mv.from] = null;
    if (piece) piece.moved = true;
    chess.play(mv);
  }
  const marks = [];
  for (let sq = 0; sq < 64; sq++) if (at[sq] && at[sq].moved) marks.push({ sq, own: at[sq].color === line.side });
  g = { fen: chess.fen(), marks };
  cache.set(line, g);
  return g;
}
