// Goal screen data (CHE-129): the target position and marks of every line, and the goal sentence of every starter line.
// Run: node test/goal.mjs    Exit 0 when every check holds, 1 otherwise.
import { Chess } from '../src/rules.js';
import { LINES } from '../src/openings/lines.js';
import { goalOf } from '../src/openings/goal.js';
import { GOALS } from '../src/i18n.js';

let bad = 0;
const check = (cond, m) => { if (!cond) { bad++; console.log('FAIL ' + m); } };

for (const line of LINES) {
  const g = goalOf(line);
  const c = new Chess();
  for (const m of line.moves) c.playSan(m.san);
  check(g.fen === c.fen(), `${line.id}: the goal position is the position after the last move`);
  check(g.marks.length > 0 && g.marks.every((m) => c.board[m.sq]), `${line.id}: every mark sits on a piece`);
  const own = g.marks.filter((m) => m.own);
  check(own.length > 0 && own.every((m) => (c.board[m.sq] < 'a') === (line.side === 'w')), `${line.id}: own marks are on the line's side`);
  check(goalOf(line) === g, `${line.id}: cached`);
  const t = GOALS[line.id];
  check(t && t.en && t.de, `${line.id}: a goal sentence in English and German`);
  for (const k of ['en', 'de']) if (t?.[k]) {
    check(t[k].length <= 70, `${line.id} ${k}: one short line (${t[k].length} characters)`);
    check(!t[k].includes(String.fromCharCode(0x2014)) && !t[k].includes('-'.repeat(2)), `${line.id} ${k}: no em dash or double hyphen`);
  }
}
check(Object.keys(GOALS).every((id) => LINES.some((l) => l.id === id)), 'every goal belongs to a line');

// pieces that moved are marked where they ended: the Italian Game's e-pawn stands on e4, the bishop on c4
{
  const g = goalOf(LINES.find((l) => l.id === 'italian-game'));
  const sqs = new Set(g.marks.filter((m) => m.own).map((m) => m.sq));
  check(sqs.has(28) && sqs.has(26), 'Italian Game: e4 and c4 are marked');
  check(!sqs.has(12), 'Italian Game: e2 is not marked, the pawn left it');
}
// castling moves the rook too, a capture removes the mark of the captured piece
{
  const g = goalOf(LINES.find((l) => l.id === 'ruy-lopez'));
  const own = new Set(g.marks.filter((m) => m.own).map((m) => m.sq));
  check(own.has(6) && own.has(5), 'Ruy Lopez: king g1 and rook f1 are marked after O-O');
}
console.log(bad ? `GOAL FAILED (${bad})` : `goal: ${LINES.length} lines ok`);
process.exit(bad ? 1 : 0);
