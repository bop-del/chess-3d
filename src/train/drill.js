// Drill: a session over the cards that are due (startDue), or one adopted line played through (startPractise). Like
// Explain it is calm 3D on the real board: no computer, no battle scenes, the game plays everything that is not a quiz
// and the player plays the own moves. No DOM and no rendering here: drill-panel.js reads state(), the move hint is driven
// through `hint`, the end sweep through `sweep`.
//
// The planner gives steps { lineId, ply, mode: 'context' | 'quiz', key }. Before every step the board is brought to the
// position before that ply of that line: moves of the line that are missing are played (quickly, one per pause), and when
// the board holds a different line it is taken back to the shared prefix first (a rewind, not a reset). So the drill does
// not care whether the planner lists the opponent's moves or leaves them to this fill-in.
//
// A quiz step: the own move is asked for. A wrong move is refused (the guard answers false, the piece never leaves its
// square), the hint arrow shows the right move, the message carries the move's sentence, and the player plays it. The
// card is answered once, with whether the first try was right. Sibling moves of the card are accepted. Practise mode
// quizzes the same way but never calls store.answer.
//
// Texts (CHE-129): the player's own move leaves a text card that stays until Weiter (weiter()); the next step starts only
// after it. Moves the drill plays itself (the opponent, the fill-in of known moves) show no card: they are not what is
// being learned. A miss shows the move's sentence at once, without waiting.
//
// Time is counted in tick(dt) only, like Explain (ADR 0007): `pause` is in milliseconds, tests pass 0.
import { LINES } from '../openings/lines.js';
import { planSession, planPractise } from './planner.js';

const clean = (san) => String(san).replace(/[+#!?]+$/, '');

export function createDrill({ game, hint = null, store, sweep = null, lines = LINES, pause = 600, onSide = null, now = Date.now }) {
  const listeners = [];
  const byId = (id) => lines.find((l) => l.id === id) || null;

  let phase = 'idle';          // 'idle' | 'running' | 'finished'
  let mode = 'due';            // 'due' | 'practise'
  let steps = [];
  let idx = 0;
  let awaiting = false;        // a quiz step is open: the guard lets the own move through
  let missed = false;          // the open quiz step has had a wrong move
  let message = null;          // { type: 'prompt' | 'move' | 'miss', lineId, ply }
  let wait = 0;                // seconds before the next auto move
  let internal = 0;            // > 0 while the drill itself moves, undoes or resets, so game events are its own
  let hintOn = false;          // the player's Hint switch in the learning bar: the arrow for the move that is asked
  let lastSide = 'w';
  let card = null;             // { lineId, ply }: the text of the player's own move, waiting for Weiter

  const step = () => steps[idx] || null;
  const lineOf = (s) => (s ? byId(s.lineId) : null);
  const emit = () => listeners.forEach((fn) => fn(state()));
  const played = () => game.getState().moves.map(clean);

  function state() {
    const s = step();
    const line = phase === 'idle' ? null : lineOf(s) || lineOf(steps[steps.length - 1]);
    return { phase, mode, line, ply: s ? s.ply : (line ? line.moves.length : 0), message, awaiting, hint: hintOn, card, canContinue: !!card };
  }

  function acceptable(s) {
    const line = lineOf(s);
    const set = new Set([clean(line.moves[s.ply].san)]);
    const card = mode === 'due' ? store.card(s.key) : null;
    if (card) for (const x of card.sans) set.add(clean(x));
    return set;
  }

  function showHint(on) {
    if (!hint) return;
    const s = step();
    const line = lineOf(s);
    const m = on && s && line && game.chess.moveFromSan(line.moves[s.ply].san);
    if (!m) { hint.hide(); return; }
    if (!hint.enabled) hint.force(true);   // a wrong move shows the answer even when the player switched hints off
    hint.show(m.from, m.to);
  }

  function guard(move) {
    const s = step();
    if (phase !== 'running' || !awaiting || !s) return false;
    if (acceptable(s).has(clean(move.san))) return true;
    missed = true;
    message = { type: 'miss', lineId: s.lineId, ply: s.ply };
    showHint(true);
    emit();
    return false;
  }

  game.onMove((rec) => {
    if (phase !== 'running' || internal) return;
    const s = step();
    if (!awaiting || !s) return;
    awaiting = false;
    const line = lineOf(s);
    if (mode === 'due') store.answer(s.key, !missed);
    missed = false;
    hint?.hide();
    message = { type: 'move', lineId: s.lineId, ply: s.ply };
    card = { lineId: s.lineId, ply: s.ply };
    lastSide = line.side;
    idx += 1;
    wait = pause / 1000;
    emit();
  });
  // a take back or a new game from outside ends the session quietly: the drill no longer owns the board
  game.on('undo', () => { if (phase === 'running' && !internal) stop(); });
  game.on('newgame', () => { if (phase === 'running' && !internal) stop(); });

  function begin(list, m) {
    steps = list; idx = 0; mode = m; awaiting = false; missed = false; wait = 0; message = null; card = null;
    phase = 'running';
    internal++;
    game.setMode('drill');
    game.setMoveGuard(guard);
    game.newGame({ instant: true });
    internal--;
    const first = lineOf(steps[0]);
    lastSide = first.side;
    onSide?.(first.side);
    emit();
  }

  function finish() {
    phase = 'finished'; awaiting = false;
    hint?.hide();
    game.setMoveGuard(null);
    if (mode === 'due' && sweep) {
      const squares = [];
      for (let sq = 0; sq < 64; sq++) {
        const p = game.chess.board[sq];
        if (p && (p < 'a' ? 'w' : 'b') === lastSide) squares.push(sq);
      }
      Promise.resolve(sweep.play({ side: lastSide, squares })).catch(() => {});
    }
    emit();
  }

  function stop() {
    if (phase === 'idle') return;
    const wasMine = game.mode === 'drill';
    phase = 'idle'; steps = []; idx = 0; awaiting = false; missed = false; message = null; card = null; wait = 0; hintOn = false;
    hint?.hide();
    hint?.force(false);
    if (wasMine) {
      internal++;
      game.setMode('play');
      game.newGame({ instant: true });
      internal--;
    }
    emit();
  }

  // Bring the board to the position before the step's ply. Returns true once it is there, false while it has done a
  // piece of work this call (one rewind, or one move played) and wants the pause before the next.
  function align(s) {
    const line = lineOf(s);
    const have = played();
    let common = 0;
    while (common < have.length && common < s.ply && have[common] === clean(line.moves[common].san)) common++;
    if (have.length > common) {
      game.finishAnimations();
      internal++;
      while (game.chess.history.length > common) { game.undo(); game.finishAnimations(); }
      internal--;
      onSide?.(line.side);
      return false;
    }
    if (have.length < s.ply) {
      const m = line.moves[have.length];
      internal++;
      game.playSan(m.san, { animate: true });
      internal--;
      message = { type: 'move', lineId: s.lineId, ply: have.length };
      emit();
      return false;
    }
    return true;
  }

  function advance() {
    const s = step();
    if (!s) { finish(); return; }
    if (!align(s)) { wait = pause / 1000; return; }
    const line = lineOf(s);
    lastSide = line.side;
    if (s.mode === 'context') {
      internal++;
      game.playSan(line.moves[s.ply].san, { animate: true });
      internal--;
      message = { type: 'move', lineId: s.lineId, ply: s.ply };
      idx += 1;
      wait = pause / 1000;
      emit();
      return;
    }
    awaiting = true; missed = false;
    message = { type: 'prompt', lineId: s.lineId, ply: s.ply };
    emit();
  }

  return {
    state, lines,
    on(fn) { listeners.push(fn); },

    // A scheduled session over what is due. false when nothing is due (nothing changes then).
    startDue() {
      const list = planSession(store, lines, now());
      if (!list || !list.length) return false;
      begin(list, 'due');
      return true;
    },
    // One whole line, every own move quizzed, no card changes.
    startPractise(lineId) {
      const list = planPractise(lineId, lines);
      if (!list || !list.length || !byId(lineId)) return false;
      begin(list, 'practise');
      return true;
    },
    stop,
    // Weiter: the waiting text card is done, the drill goes on after its pause.
    weiter() { if (!card) return; card = null; wait = pause / 1000; emit(); },
    // Again (Nochmal): a practise run from its start. A scheduled session answers real cards, so it never repeats.
    restart() {
      if (phase === 'idle' || mode !== 'practise' || !steps.length) return false;
      begin(steps, mode);
      return true;
    },
    // The Hint switch: the arrow for the move that is asked stays on while it is on.
    setHint(on) { hintOn = !!on; if (!hintOn && !missed) hint?.hide(); emit(); },
    // Show me: the asked move is played for the player. The card counts as missed, like a wrong first try.
    showMe() {
      const s = step();
      if (phase !== 'running' || !awaiting || !s || game.busy || game.pendingPromotion) return false;
      missed = true;
      game.finishAnimations();
      return !!game.playSan(lineOf(s).moves[s.ply].san, { animate: true });
    },

    // Every frame (or __chess.step): plays the next auto move once the board is at rest and the pause has run.
    tick(dt) {
      if (phase !== 'running') return;
      const s = step();
      if (awaiting && s && !game.busy && !game.pendingPromotion) { showHint(missed || hintOn); return; }
      if (awaiting || card || game.busy || game.pendingPromotion) return;
      wait -= dt;
      if (wait <= 0) { wait = 0; advance(); }
    },
  };
}
