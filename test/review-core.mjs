// Game review core: win chance, mistake and blunder thresholds, accuracy, the engine on a scripted game, the sentence facts.
// No browser. Run: node test/review-core.mjs
import { MISTAKE_DROP, BLUNDER_DROP, winPercent, winDrop, classify, moveAccuracy, accuracy, reviewGame, sentenceFacts } from '../src/review/classify.js';
import { analyzePosition, bestLine, analyzeMany, MATE } from '../src/review/analyze.js';
import { Chess, START_FEN } from '../src/rules.js';

let fail = 0;
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : extra ? ': ' + extra : ''}`); };
const near = (a, b, e = 0.01) => Math.abs(a - b) <= e;

// ---- win chance
check('win chance: equal is 50', near(winPercent(0), 50));
check('win chance: symmetric', near(winPercent(300) + winPercent(-300), 100));
check('win chance: rises with the score', winPercent(100) > 50 && winPercent(500) > winPercent(100));
check('win chance: mate scores stay in range', winPercent(99999) <= 100 && winPercent(-99999) >= 0);

// ---- thresholds: a pawn is a mistake, a knight is a blunder, a small slip is neither
check('thresholds are 10 and 25 points', MISTAKE_DROP === 10 && BLUNDER_DROP === 25);
const drop = (cp) => winDrop(0, cp);   // from equal, the reply position scores +cp for the opponent: the mover lost cp
check('small slip (30 cp) is good', classify(drop(30)) === 'good', String(drop(30)));
check('a pawn (110 cp) is a mistake', classify(drop(110)) === 'mistake', String(drop(110)));
check('a knight (320 cp) is a blunder', classify(drop(320)) === 'blunder', String(drop(320)));
check('exactly the mistake line', classify(MISTAKE_DROP) === 'mistake' && classify(MISTAKE_DROP - 0.01) === 'good');
check('exactly the blunder line', classify(BLUNDER_DROP) === 'blunder' && classify(BLUNDER_DROP - 0.01) === 'mistake');
check('the best move is never marked', classify(40, true) === 'best');
check('no loss when the reply is as good as the best', winDrop(120, -120) === 0);
check('a gain is not a loss (never negative)', winDrop(0, -300) === 0);
check('already lost stays unmarked (800 down, 1000 down)', classify(winDrop(-800, 1000)) === 'good', String(winDrop(-800, 1000)));
check('already won stays unmarked', classify(winDrop(900, -700)) === 'good', String(winDrop(900, -700)));
check('missing a mate is a blunder', classify(winDrop(MATE - 3, 0)) === 'blunder');

// ---- accuracy
check('accuracy: no loss is 100', near(moveAccuracy(0), 100, 0.01));
check('accuracy: falls with the loss', moveAccuracy(10) < moveAccuracy(5) && moveAccuracy(30) < moveAccuracy(10));
check('accuracy: never below 0', moveAccuracy(100) === 0);
check('accuracy of a side is the mean', near(accuracy([0, 0]), 100, 0.01) && near(accuracy([0, 20]), (moveAccuracy(0) + moveAccuracy(20)) / 2));
check('accuracy: no moves is null', accuracy([]) === null);

// ---- reviewGame on made up numbers
{
  const mv = (from, to, color) => ({ from, to, promo: null, san: 'x', color });
  const best = (from, to) => ({ from, to, promo: null, san: 'x' });
  // white plays the best move, black plays a blunder (the reply position is much better for white), white plays a free move
  const positions = [
    { turn: 'w', score: 20, best: best(12, 28) },
    { turn: 'b', score: -20, best: best(52, 36) },
    { turn: 'w', score: 400, best: best(5, 33) },     // after black's move 1: white is far better: black gave away ~400
    { turn: 'b', score: -380, best: best(1, 18) },
  ];
  const moves = [mv(12, 28, 'w'), mv(1, 18, 'b'), mv(5, 33, 'w')];
  const r = reviewGame(positions, moves);
  check('reviewGame: the best move is best', r.moves[0].kind === 'best' && r.moves[0].drop === 0);
  check('reviewGame: black\'s move 1 is a blunder with the better move attached', r.moves[1].kind === 'blunder' && r.moves[1].bestMove.from === 52, JSON.stringify(r.moves[1]));
  check('reviewGame: white keeps its advantage with the best move', r.moves[2].kind === 'best');
  check('reviewGame: evaluations are from white\'s view', r.evals[0] === 20 && r.evals[1] === 20 && r.evals[2] === 400 && r.evals[3] === 380, JSON.stringify(r.evals));
  check('reviewGame: black is less accurate than white', r.accuracy.b < r.accuracy.w && near(r.accuracy.w, 100, 0.5));
  const part = reviewGame([positions[0], null, positions[2], null], moves);
  check('reviewGame: a move waits until both positions are analysed', part.moves.every((m) => m.kind === null) && part.evals[1] === null);
}

// ---- the engine on a position
{
  const mate = analyzePosition('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 3);
  check('engine: finds mate in one (Ra8#)', mate.best && mate.best.san === 'Ra8#' && mate.score > MATE - 10, JSON.stringify(mate));
  const over = analyzePosition('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 3);
  check('engine: a stalemate scores 0 and has no best move', over.best === null && over.score === 0);
  const matedFen = new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'); matedFen.play({ from: 0, to: 56 });
  const mated = analyzePosition(matedFen.fen(), 3);
  check('engine: a checkmated side scores minus mate', mated.best === null && mated.score === -MATE, String(mated.score));
  const free = analyzePosition('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', 3);
  check('engine: takes the free knight', free.best.san === 'Qxd5', free.best.san);
  const line = bestLine('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', mate.best, 4);
  check('line: a mate is a one move line', line.join(' ') === 'Ra8#', line.join(' '));
  const l2 = bestLine(START_FEN, analyzePosition(START_FEN, 3).best, 4);
  check('line: four plies from the start', l2.length === 4 && /^[a-hNBRQKO]/.test(l2[0]), l2.join(' '));
}

// ---- a scripted game: fool's mate. White's f3 and g4 are marked, Qh4# is best, the game ends in mate
{
  const ch = new Chess();
  const mv = [];
  for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) {
    const m = ch.play({ from: 'abcdefgh'.indexOf(f[0]) + 8 * (f[1] - 1), to: 'abcdefgh'.indexOf(t[0]) + 8 * (t[1] - 1) });
    mv.push({ from: m.from, to: m.to, promo: null, san: m.san, color: m.color });
  }
  const walk = new Chess();
  const fens = [walk.fen()];
  for (const m of mv) { walk.play(m); fens.push(walk.fen()); }
  const positions = new Array(fens.length).fill(null);
  let seen = 0;
  const ok = await analyzeMany(fens, { depth: 3, onPosition: (i, r) => { positions[i] = r; seen++; } });
  check('scripted game: every position is analysed in order', ok && seen === 5 && positions.every(Boolean));
  const r = reviewGame(positions, mv);
  check('scripted game: g4 (move 3) is a blunder, Qh4# is the best move', r.moves[2].kind === 'blunder' && r.moves[3].kind === 'best', JSON.stringify(r.moves.map((m) => m.kind)));
  check('scripted game: the better move for g4 is not g4', r.moves[2].bestMove && !(r.moves[2].bestMove.from === mv[2].from && r.moves[2].bestMove.to === mv[2].to));
  check('scripted game: the final position is mate for white', positions[4].best === null && positions[4].score === -MATE);
  check('scripted game: white is less accurate than the player of the best moves', r.accuracy.w < r.accuracy.b || r.accuracy.w < 100);
  const stopped = await analyzeMany(fens, { depth: 3, shouldStop: () => true });
  check('analyzeMany stops when asked', stopped === false);
  const f = sentenceFacts(fens[2], mv[2], r.moves[2].bestMove, positions[3].best, positions[3].score);
  check('sentence facts: g4 allows the mate', f.type === 'allowsMate', JSON.stringify(f));
  check('sentence facts: a type and a SAN', ['allowsMate', 'mate', 'win', 'hang', 'check', 'generic'].includes(f.type) && typeof f.san === 'string', JSON.stringify(f));
}

// ---- sentence facts on made up positions
{
  const P = (from, to) => ({ from: 'abcdefgh'.indexOf(from[0]) + 8 * (from[1] - 1), to: 'abcdefgh'.indexOf(to[0]) + 8 * (to[1] - 1), promo: null });
  const mateFen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  check('facts: the better move is mate', sentenceFacts(mateFen, P('g2', 'g3'), P('a1', 'a8')).type === 'mate');
  const winFen = '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1';
  const w = sentenceFacts(winFen, P('d1', 'd2'), P('d1', 'd5'));
  check('facts: the better move wins a knight', w.type === 'win' && w.piece === 'n', JSON.stringify(w));
  const hang = sentenceFacts('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1', P('d1', 'd4'), P('e1', 'e2'), P('d5', 'd4'), 0);
  check('facts: the played move leaves the queen to be taken', hang.type === 'hang' && hang.piece === 'q', JSON.stringify(hang));
  const chk = sentenceFacts('4k3/8/8/8/8/8/4P3/R3K3 w - - 0 1', P('e2', 'e3'), P('a1', 'a8'));
  check('facts: the better move gives check', chk.type === 'mate' || chk.type === 'check', JSON.stringify(chk));
  const am = sentenceFacts(START_FEN, P('a2', 'a3'), P('e2', 'e4'), P('e7', 'e5'), MATE - 1);
  check('facts: the played move allows checkmate', am.type === 'allowsMate' && am.san === 'e4', JSON.stringify(am));
  check('facts: nothing special', sentenceFacts(START_FEN, P('a2', 'a3'), P('e2', 'e4')).type === 'generic');
}

console.log(fail ? `\n${fail} FAILED` : '\nreview core OK');
process.exit(fail ? 1 : 0);
