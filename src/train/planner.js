// Session planning, pure: no DOM, no clock, no storage of its own. Drill walks the steps this returns.
//
// A step is { lineId, ply, mode: 'context' | 'quiz', key } and means: at ply `ply` of that line, play the line's move
// (context, the player just watches) or ask for it (quiz, the player makes it). `key` is the position key before the
// move. A quiz step is always an own move; every opponent move is context. The first step of a stretch also carries
// `rewind`: the ply the board must be at before the step is played. 0 means a fresh board (a reset), a larger number
// means "undo back to that ply and carry on", which is how a second due continuation is reached without a reset.
//
// planSession follows chesslines #51: only own moves are scheduled, moves that are not due are played as context,
// the next stretch starts from the deepest position it shares with the previous one, and the siblings an own move
// accepts are the store's business (card.sans), not the plan's.
import { Chess } from '../rules.js';
import { LINES } from '../openings/lines.js';
import { SESSION_CARDS } from './guesses.js';

export const isOwn = (line, i) => (line.side === 'w') === (i % 2 === 0);

const cache = new WeakMap();

// The position key before every ply of a line (index i is the position before move i). Cached per line object.
export function positionKeys(line) {
  let keys = cache.get(line);
  if (keys) return keys;
  const c = new Chess();
  keys = [];
  for (const m of line.moves) {
    keys.push(c.positionKey4());
    if (!c.playSan(m.san)) throw new Error(`illegal move ${m.san} in line ${line.id}`);
  }
  cache.set(line, keys);
  return keys;
}

const clean = (san) => String(san).replace(/[+#!?]+$/, '');

// How many moves two lines have in common from the start (same SAN at the same ply).
function commonPrefix(a, b) {
  const n = Math.min(a.moves.length, b.moves.length);
  let i = 0;
  while (i < n && clean(a.moves[i].san) === clean(b.moves[i].san)) i++;
  return i;
}

// A stretch of one line from ply `from` up to and including its last quiz, or null when nothing is left to ask.
function stretch(line, from, due, done) {
  const keys = positionKeys(line);
  let last = -1;
  for (let i = from; i < line.moves.length; i++) if (isOwn(line, i) && due.has(keys[i]) && !done.has(keys[i])) last = i;
  if (last < 0) return null;
  const steps = [];
  for (let i = from; i <= last; i++) {
    const quiz = isOwn(line, i) && due.has(keys[i]) && !done.has(keys[i]);
    if (quiz) done.add(keys[i]);
    steps.push({ lineId: line.id, ply: i, mode: quiz ? 'quiz' : 'context', key: keys[i] });
  }
  steps[0].rewind = from;
  return { steps, end: last + 1 };
}

const leftToAsk = (line, due, done) => {
  const keys = positionKeys(line);
  let n = 0;
  for (let i = 0; i < keys.length; i++) if (isOwn(line, i) && due.has(keys[i]) && !done.has(keys[i])) n++;
  return n;
};

export function planSession(store, lines = LINES, now = Date.now(), { max = SESSION_CARDS } = {}) {
  const due = new Set(store.dueKeys(now));
  if (!due.size) return [];
  const adopted = new Set(store.adopted());
  const pool = lines.filter((l) => adopted.has(l.id) && l.moves?.length);
  const done = new Set();
  const plan = [];
  let cur = null;          // { line, end }: where the board stands after the previous stretch
  let quizzes = 0;

  while (quizzes < max) {
    let best = null;
    for (const line of pool) {
      const left = leftToAsk(line, due, done);
      if (!left) continue;
      // Rewind as little as possible: start from the deepest ply this line shares with where the board stands.
      const from = cur && cur.line !== line ? Math.min(commonPrefix(cur.line, line), cur.end) : 0;
      const score = [from, left];
      if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) best = { line, from, score };
    }
    if (!best) break;
    let s = stretch(best.line, best.from, due, done);
    if (!s && best.from > 0) s = stretch(best.line, 0, due, done);   // every remaining due card lies before the shared part: reset
    if (!s) break;
    plan.push(...s.steps);
    quizzes += s.steps.filter((x) => x.mode === 'quiz').length;
    cur = { line: best.line, end: s.end };
  }
  return plan;
}

// A whole line, every own move quizzed, nothing recorded. Opponent moves are context.
export function planPractise(lineId, lines = LINES) {
  const line = typeof lineId === 'string' ? lines.find((l) => l.id === lineId) : lineId;
  if (!line) return [];
  const keys = positionKeys(line);
  return line.moves.map((m, i) => ({ lineId: line.id, ply: i, mode: isOwn(line, i) ? 'quiz' : 'context', key: keys[i], ...(i === 0 ? { rewind: 0 } : {}) }));
}
