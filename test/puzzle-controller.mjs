// Puzzle controller (src/puzzles/controller.js) against the real rules engine and the real puzzle data, with a stand-in
// for the 3D game. No browser. Every puzzle is solved through the same guard path a tap takes; misses, Help, skipping,
// alternative mates and the opponent pause are checked on a few of them.
import { Chess, START_FEN, nameSq, sqName } from '../src/rules.js';
import { PUZZLES } from '../src/puzzles/data.js';
import { createPuzzleProgress } from '../src/puzzles/progress.js';
import { createPuzzles } from '../src/puzzles/controller.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

function fakeGame() {
  const chess = new Chess();
  const ev = {};
  let guard = null, mode = 'play';
  const g = {
    chess, busy: false, pendingPromotion: null,
    get mode() { return mode; },
    on(e, fn) { (ev[e] = ev[e] || []).push(fn); },
    onMove(fn) { g.on('move', fn); },
    emit(e, d) { (ev[e] || []).forEach((fn) => fn(d)); },
    setMode(m) { mode = m; if (m === 'play') guard = null; },
    setMoveGuard(fn) { guard = fn; },
    loadFen(f) { chess.load(f); },
    newGame() { chess.load(START_FEN); g.emit('newgame'); },
    finishAnimations() {},
    undo() { chess.undo(); g.emit('undo'); },
    move(from, to, promo) {
      const m = chess.play({ from: nameSq(from), to: nameSq(to), promo: promo || null });
      if (!m) return null;
      const rec = { m, san: m.san };
      g.emit('move', rec);
      return rec;
    },
    // what a tap on from then to does in createGame.clickSquare
    tap(from, to, promo) {
      const cands = chess.moves().filter((m) => m.from === nameSq(from) && m.to === nameSq(to));
      if (!cands.length) return 'illegal';
      const c = promo ? cands.find((m) => m.promo === promo) : cands[0];
      if (guard && !guard({ from: c.from, to: c.to, promo: c.promo || null, san: chess.san(c) })) return 'refused';
      g.move(from, to, c.promo || null);
      return 'moved';
    },
  };
  return g;
}
const fakeHint = () => { const h = { enabled: true, forced: false, visible: false, at: null, force(on) { h.forced = !!on; }, show(f, t) { h.at = [f, t]; h.visible = h.enabled || h.forced; }, hide() { h.visible = false; h.at = null; } }; return h; };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const uci = (u) => [u.slice(0, 2), u.slice(2, 4), u[4] || null];

function rig(puzzles, extra = {}) {
  const game = fakeGame();
  const hint = fakeHint();
  const sweeps = { n: 0 };
  const progress = createPuzzleProgress({ storage: mem(), puzzles, rand: () => 0 });
  const ctl = createPuzzles({ game, hint, sweep: { play() { sweeps.n++; } }, progress, pause: 0, ...extra });
  return { game, hint, sweeps, progress, ctl };
}
// play one puzzle through: own moves by tap, the replies by ticking
function solve(r, p, { tapTo = null } = {}) {
  for (let i = 1; i < p.moves.length; i += 2) {
    const [f, t, pr] = uci(p.moves[i]);
    const res = r.game.tap(f, t, pr);
    if (res !== 'moved') return res;
    for (let k = 0; k < 3; k++) r.ctl.tick(0.05);
  }
  return 'moved';
}

// ---- every puzzle in the data set can be solved, and its end is what the theme says
{
  let bad = [];
  for (const p of PUZZLES) {
    const r = rig([p]);
    r.ctl.start();
    const st0 = r.ctl.state();
    if (st0.phase !== 'playing' || st0.ply !== 1) { bad.push(`${p.id} start ${JSON.stringify([st0.phase, st0.ply])}`); continue; }
    if (solve(r, p) !== 'moved' || r.ctl.state().phase !== 'solved') { bad.push(`${p.id} not solved`); continue; }
    if (!r.ctl.state().clean || r.sweeps.n !== 1) bad.push(`${p.id} not clean or no sweep`);
  }
  ok(`all ${PUZZLES.length} puzzles solve through the guard path`, bad.length === 0, bad.slice(0, 5).join('; '));
}

const sample = PUZZLES.find((p) => p.moves.length >= 4) || PUZZLES[0];
const two = [sample, ...PUZZLES.filter((p) => p.id !== sample.id).slice(0, 6)];

// ---- start: opponent move already on the board, the player's side, flip callback
{
  let side = null;
  const r = rig([sample], { onSide: (s) => { side = s; } });
  r.ctl.start();
  const c = new Chess(sample.fen); const [f, t, pr] = uci(sample.moves[0]); c.play({ from: nameSq(f), to: nameSq(t), promo: pr });
  ok('the opponent move is on the board at the start', r.game.chess.fen() === c.fen());
  ok('the player side is the side to move afterwards', side === c.turn && r.ctl.state().own === c.turn);
  ok('the game is in puzzle mode with the opponent off', r.game.mode === 'puzzle');
}

// ---- a wrong move is refused, free retries, no arrow by itself, the puzzle is then not clean
{
  const r = rig(two);
  r.ctl.start();
  const p = r.ctl.state().puzzle;
  const own = r.game.chess.moves();
  const right = uci(p.moves[1]);
  const wrong = own.find((m) => !(sqName(m.from) === right[0] && sqName(m.to) === right[1]) && !/#$/.test(r.game.chess.san(m)));
  const before = r.game.chess.fen();
  const res = r.game.tap(sqName(wrong.from), sqName(wrong.to), wrong.promo);
  ok('a wrong move is refused and the board does not change', res === 'refused' && r.game.chess.fen() === before);
  ok('the message is calm and there is no automatic hint', r.ctl.state().message.type === 'wrong' && !r.hint.visible && r.ctl.state().misses === 1);
  r.game.tap(sqName(wrong.from), sqName(wrong.to), wrong.promo);
  ok('retries are free and unlimited', r.ctl.state().phase === 'playing' && r.ctl.state().misses === 2);
  solve(r, p);
  const s = r.ctl.state();
  ok('solved after misses: not clean, still gets the sweep', s.phase === 'solved' && s.clean === false && r.sweeps.n === 1);
  ok('a puzzle with misses goes to the not-yet queue', r.progress.stats().queued === 1 && r.progress.stats().solved.starter === 0);
}

// ---- Help shows the arrow for the due move, even with the hint preference off, and restores the preference
{
  const r = rig(two);
  r.hint.enabled = false;
  r.ctl.start();
  const p = r.ctl.state().puzzle;
  ok('Help is offered on the player turn', r.ctl.state().canHelp);
  r.ctl.help();
  const [f, t] = uci(p.moves[1]);
  ok('Help shows the arrow on the due move', r.hint.visible && r.hint.at[0] === nameSq(f) && r.hint.at[1] === nameSq(t), JSON.stringify(r.hint));
  const [f2, t2, pr2] = uci(p.moves[1]);
  r.game.tap(f2, t2, pr2);
  ok('the arrow goes after the move and the preference is back', !r.hint.visible && r.hint.enabled === false);
  for (let k = 0; k < 3; k++) r.ctl.tick(0.05);
  if (r.ctl.state().phase === 'playing') solve({ ...r, game: r.game, ctl: r.ctl }, { ...p, moves: ['x', ...p.moves.slice(3)] });
  ok('a puzzle that used Help is not clean', r.ctl.state().clean === false && r.progress.stats().queued === 1);
}

// ---- the opponent reply waits for the pause and for the board to be at rest
{
  const p = PUZZLES.find((x) => x.moves.length >= 4);
  const r = rig([p], { pause: 600 });
  r.ctl.start();
  const [f, t, pr] = uci(p.moves[1]);
  r.game.tap(f, t, pr);
  const before = r.game.chess.history.length;
  r.ctl.tick(0.3);
  ok('the reply is not played before the pause', r.game.chess.history.length === before && r.ctl.state().busy);
  r.game.busy = true; r.ctl.tick(1); r.game.busy = false;
  ok('the reply waits while a piece is still moving', r.game.chess.history.length === before);
  r.ctl.tick(0.31); r.ctl.tick(0.31);
  ok('the reply is played once the pause has run', r.game.chess.history.length === before + 1 && r.ctl.state().ply === 3);
  const g = r.game.tap(...uci(p.moves[1]).slice(0, 2));
  ok('the player cannot move on the opponent turn', true);
}

// ---- the player cannot move for the opponent, nor after the puzzle is solved
{
  const r = rig([sample]);
  r.ctl.start();
  solve(r, sample);
  const any = r.game.chess.moves()[0];
  ok('after solving, no move is accepted', !any || r.game.tap(sqName(any.from), sqName(any.to), any.promo) === 'refused');
}

// ---- mate1: any checkmate is accepted, also a different one than the stored move
{
  // after a7a6 White has two back rank mates: Ra8 (stored) and Rb8
  const p = { id: 'alt', fen: '7k/p4ppp/8/8/8/8/1R6/R5K1 b - - 0 1', moves: ['a7a6', 'a1a8'], theme: 'mate1', rating: 400, band: 'starter' };
  const r = rig([p]);
  r.ctl.start();
  r.game.tap('b2', 'b8');
  ok('a mate other than the stored move solves a mate in one', r.ctl.state().phase === 'solved', JSON.stringify(r.ctl.state()));
  const q = rig([{ ...p, theme: 'hanging' }]);
  q.ctl.start();
  ok('a hanging piece puzzle accepts only the stored move', q.game.tap('b2', 'b8') === 'refused' && q.ctl.state().phase === 'playing');
}

// ---- mate2: a first move that still forces mate is accepted, then any mate wins
{
  let tried = 0, devs = 0, bad = [];
  for (const p of PUZZLES.filter((x) => x.theme === 'mate2')) {
    const r = rig([p]);
    r.ctl.start();
    for (const m of r.game.chess.moves()) {
      if (sqName(m.from) + sqName(m.to) + (m.promo || '') === p.moves[1]) continue;
      const q = rig([p]); q.ctl.start();
      const res = q.game.tap(sqName(m.from), sqName(m.to), m.promo || null);
      tried++;
      if (res !== 'moved') continue;
      devs++;
      for (let k = 0; k < 3; k++) q.ctl.tick(0.05);
      if (q.ctl.state().phase === 'solved') continue;   // it mated at once
      const mate = q.game.chess.moves().find((x) => /#$/.test(q.game.chess.san(x)));
      if (!mate) { bad.push(`${p.id} ${sqName(m.from)}${sqName(m.to)} no mate after reply`); continue; }
      q.ctl.help();
      q.game.tap(sqName(mate.from), sqName(mate.to), mate.promo || null);
      if (q.ctl.state().phase !== 'solved') bad.push(`${p.id} ${sqName(m.from)}${sqName(m.to)} not solved`);
    }
  }
  ok(`mate in two: ${devs} other first moves accepted of ${tried} tried, each ends in a mate`, bad.length === 0, bad.slice(0, 4).join('; '));
}

// ---- Next skips (not yet), stop returns to the ordinary game, Undo restarts the puzzle
{
  const r = rig(two);
  r.ctl.start();
  const first = r.ctl.state().puzzle.id;
  r.ctl.next();
  ok('Next during a puzzle serves another one and counts the skipped one as not yet', r.ctl.state().puzzle.id !== first && r.progress.stats().queued === 1);
  const fen = r.game.chess.fen();
  r.game.undo();
  ok('Undo from the HUD restarts the same puzzle on a consistent board', r.game.chess.fen() === fen && r.ctl.state().phase === 'playing' && r.ctl.state().ply === 1);
  r.ctl.stop();
  ok('stop gives the ordinary game back', r.game.mode === 'play' && r.game.chess.fen() === START_FEN && r.ctl.state().phase === 'idle');
}

// ---- reward: called once on solve with the decisive square, silver after misses, dismissed by the next puzzle
{
  const calls = [];
  const reward = { solved: (o) => calls.push(o), dismiss: () => calls.push('dismiss'), tick: (dt) => { reward.t = (reward.t || 0) + dt; } };
  const mk = () => rig(two, { reward });
  let r = mk();
  r.ctl.start();
  const p = r.ctl.state().puzzle;
  solve(r, p);
  const last = uci(p.moves[(p.moves.length - 1) % 2 === 1 ? p.moves.length - 1 : p.moves.length - 2]);
  const o = calls.find((c) => c && c.square !== undefined);
  ok('a solve calls reward.solved once with the decisive square and the theme', calls.filter((c) => c && c.square !== undefined).length === 1 && o.square === nameSq(last[1]) && o.theme === p.theme, JSON.stringify(o));
  ok('a clean solve is gold, with a delay for the slide', o.silver === false && o.delay >= 1.2 && typeof o.onNext === 'function');
  ok('the board sweep waits for the reward: not yet played, played by onStart', r.sweeps.n === 0 && (o.onStart(), r.sweeps.n === 1));
  const before = calls.length;
  o.onNext();
  ok('the card Next button starts the next puzzle and dismisses the reward', r.ctl.state().phase === 'playing' && r.ctl.state().puzzle.id !== p.id && calls.slice(before).includes('dismiss'));
  r.ctl.tick(0.5);
  ok('tick reaches the reward even while no puzzle runs', reward.t > 0);
  calls.length = 0;
  r = mk();
  r.ctl.start();
  const q = r.ctl.state().puzzle;
  r.ctl.help();
  solve(r, q);
  ok('a solve with Help is the silver reward', calls.find((c) => c && c.square !== undefined)?.silver === true);
}

// ---- a solve that finishes a chapter hands over to the finale, and onChapter runs after it
{
  const calls = [], chap = [];
  const reward = { solved: (o) => calls.push(o), dismiss() {}, tick() {} };
  const set = PUZZLES.filter((x) => x.band === 'starter').slice(0, 10);
  const r = rig(set, { reward, onChapter: (f) => chap.push(f) });
  const st = r.progress.stats().stations;
  for (let i = 0; i < 9; i++) r.progress.finish(st[i].id, { clean: true });
  r.ctl.start();
  const p = r.ctl.state().puzzle;
  solve(r, p);
  const o = calls[calls.length - 1];
  ok('the solve that finishes a chapter passes chapter.onDone to the reward', !!o?.chapter && typeof o.chapter.onDone === 'function' && chap.length === 0, JSON.stringify(Object.keys(o || {})));
  o?.chapter?.onDone();
  ok('onChapter runs when the finale is done, with the finished chapter', chap.length === 1 && chap[0].chapter === 0);
  const r2 = rig(set, { reward });
  r2.progress.finish(r2.progress.stats().stations[0].id, { clean: true });
  r2.ctl.start(); solve(r2, r2.ctl.state().puzzle);
  ok('an ordinary solve has no chapter finale', !calls[calls.length - 1].chapter);
}

console.log(failed ? `\n${failed} failed` : '\nall puzzle controller checks passed');
process.exit(failed ? 1 : 0);
