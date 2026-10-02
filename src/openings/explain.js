// Explain mode controller: walk one line on the 3D board. The player makes the own moves, the game plays the opponent
// moves after a pause, every move shows its sentence. No DOM and no rendering here: the panel reads state() and the
// hint arrow is driven through `hint`. Legality is the rules engine's answer, the line decides which legal move is due.
//
// The opponent pause is a parameter (ADR 0007): the game passes about 900 (milliseconds), tests pass 0. It is counted in
// tick(dt) while the board is at rest, so a test that steps time controls it and no real clock is involved.
import * as data from './lines.js';

const clean = (san) => String(san).replace(/[+#!?]+$/, '');

// The starter list, read the way test/openings.mjs reads it.
export const LINES = data.OPENINGS || data.LINES || data.default || [];

// A line can be walked once every move carries its sentence in both languages. The rest stay visible but inert.
export function playable(line) {
  return !!line?.moves?.length && line.moves.every((m) => m.en && m.de);
}

export function createExplain({ game, hint = null, lines = LINES, pause = 900, onSide = null }) {
  const listeners = [];
  let line = null;
  let ply = 0;
  let message = null;       // { type: 'intro' | 'move' | 'refused' | 'yourMove', ply?, san? }
  let wait = null;          // seconds left before the due opponent move is played, null when nothing is waiting
  let internal = 0;         // > 0 while the controller itself moves or undoes, so the game events are its own
  let hintOn = hint ? hint.enabled : true;

  const emit = () => listeners.forEach((fn) => fn(state()));
  const total = () => (line ? line.moves.length : 0);
  const finished = () => !!line && ply >= total();
  const dueMove = () => (line && !finished() ? line.moves[ply] : null);
  // The move is the player's when the side to move is the side the line is for: not "white", the Scandinavian is Black's.
  const isOwn = (i) => (line.side === 'w') === (i % 2 === 0);

  function squares() {
    const due = dueMove();
    const m = due && game.chess.moveFromSan(due.san);
    return m ? { from: m.from, to: m.to } : null;
  }

  function syncHint() {
    if (!hint) return;
    const due = dueMove();
    const show = hintOn && due && isOwn(ply) && !game.busy && !game.pendingPromotion;
    const sq = show && squares();
    if (sq) hint.show(sq.from, sq.to); else hint.hide();
  }

  function state() {
    return {
      phase: !line ? 'list' : finished() ? 'finished' : 'walking',
      line, ply, total: total(), message,
      due: dueMove() ? { ...dueMove(), own: isOwn(ply) } : null,
      hint: hintOn,
      canBack: !!line && ply > 0,
    };
  }

  function say(m) { message = m; }

  function guard(move) {
    const due = dueMove();
    if (!line || !due || !isOwn(ply)) return false;
    if (clean(move.san) === clean(due.san)) return true;
    say({ type: 'refused', san: due.san });
    emit();
    return false;
  }

  function afterMove() {
    wait = null;
    if (finished()) { say({ type: 'move', ply: ply - 1, end: true }); }
    else say({ type: 'move', ply: ply - 1 });
    syncHint();
    emit();
  }

  game.onMove((rec) => {
    if (!line) return;
    const due = dueMove();
    if (!due || clean(rec.san) !== clean(due.san)) return;   // not this line's move: the guard stops the player, a script can desync it
    ply += 1;
    afterMove();
  });
  game.on('undo', () => { if (line && !internal) { ply = game.chess.history.length; wait = null; say(ply ? { type: 'move', ply: ply - 1 } : { type: 'intro' }); syncHint(); emit(); } });
  game.on('newgame', () => { if (line && !internal) { ply = 0; wait = null; say({ type: 'intro' }); syncHint(); emit(); } });

  function begin() {
    internal++;
    game.setMode('explain');
    game.setMoveGuard(guard);
    game.newGame({ instant: true });
    internal--;
    ply = 0; wait = null;
    say({ type: 'intro' });
    onSide?.(line.side);
    syncHint();
    emit();
  }

  return {
    state, lines, playable,
    on(fn) { listeners.push(fn); },

    start(id) {
      const l = typeof id === 'string' ? lines.find((x) => x.id === id) : id;
      if (!l || !playable(l)) return false;
      line = l;
      begin();
      return true;
    },
    // Back to the list: the ordinary game takes the board again.
    stop() {
      if (!line) return;
      line = null; ply = 0; wait = null; message = null;
      hint?.hide();
      internal++;
      game.setMode('play');
      game.newGame({ instant: true });
      internal--;
      emit();
    },
    restart() { if (line) begin(); },

    // The due move, played for the player (or the opponent's move without its pause).
    next() {
      const due = dueMove();
      if (!due) return;
      game.finishAnimations();
      game.playSan(due.san, { animate: true });
    },
    // Back to the previous own move: takes back the opponent's reply too. Back from the first position is a no-op.
    back() {
      if (!line || ply === 0) return;
      let target = 0;
      for (let i = ply - 1; i > 0; i--) if (isOwn(i)) { target = i; break; }
      game.finishAnimations();
      internal++;
      while (game.chess.history.length > target) { game.undo(); game.finishAnimations(); }
      internal--;
      ply = target; wait = null;
      say(ply ? { type: 'move', ply: ply - 1 } : { type: 'intro' });
      syncHint();
      emit();
    },
    setHint(on) {
      hintOn = !!on;
      if (hint) hint.enabled = hintOn;
      syncHint();
      emit();
    },

    // Called every frame with the frame time. Plays the opponent move once the pause has run, and keeps the hint in step
    // with whether the board is listening (it is hidden while a piece is still moving).
    tick(dt) {
      if (!line) return;
      syncHint();
      if (!dueMove() || isOwn(ply)) { wait = null; return; }
      if (game.busy || game.pendingPromotion) return;
      if (wait === null) wait = pause / 1000;
      wait -= dt;
      if (wait <= 0) { wait = null; this.next(); }
    },
  };
}
