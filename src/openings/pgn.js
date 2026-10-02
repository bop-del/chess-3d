// PGN with variations, into a tree of positions. Port of the chesslines parser onto src/rules.js (no chess.js).
// A variation is an alternative to the move before it: on '(' rewind one ply, on ')' restore. An illegal move throws,
// so a typo in a line never passes quietly.
import { Chess } from '../rules.js';

const node = (san, chess) => ({ san, fen: chess.fen(), key: chess.positionKey4(), children: [] });

export function parse(pgn) {
  const game = new Chess();
  game.trackKeys = false;
  const root = node(null, game);
  let cursor = root;
  let parent = root;
  const stack = [];

  for (const token of tokenise(pgn)) {
    if (token === '(') {
      stack.push([cursor, parent, game.fen()]);
      game.load(parent.fen);
      cursor = parent;
      continue;
    }
    if (token === ')') {
      if (!stack.length) throw new Error('Unbalanced ) in PGN');
      const [c, p, fen] = stack.pop();
      cursor = c;
      parent = p;
      game.load(fen);
      continue;
    }
    const move = game.playSan(token);
    if (!move) throw new Error(`Illegal move in PGN: ${token}`);
    const child = node(move.san, game);
    cursor.children.push(child);
    parent = cursor;
    cursor = child;
  }
  if (stack.length) throw new Error('Unbalanced ( in PGN');
  return root;
}

// The main line as a list of SAN strings, following the first child at every node.
export function mainLine(root) {
  const out = [];
  for (let n = root.children[0]; n; n = n.children[0]) out.push(n.san);
  return out;
}

function* tokenise(pgn) {
  const body = pgn
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*/g, ' ')
    .replace(/\$\d+/g, ' ')
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/([()])/g, ' $1 ');
  for (const token of body.split(/\s+/)) {
    if (!token) continue;
    if (token === '1-0' || token === '0-1' || token === '1/2-1/2' || token === '*') continue;
    yield token;
  }
}
