// Explain mode controller: walk one line on the 3D board. A line opens on its goal screen (phase 'preview': the position
// its last move reaches, the pieces that moved marked, go() starts the walk). Then the player makes the own moves, the game
// plays the opponent moves after a pause, and every move leaves a text card that stays until the player taps Weiter
// (weiter()): the next opponent move waits for it, no timer. No DOM and no rendering here: the panel reads state(), the
// hint arrow is driven through `hint`, the goal marks through `marks`. Legality is the rules engine's answer, the line
// decides which legal move is due.
//
// The opponent pause is a parameter (ADR 0007): the game passes about 900 (milliseconds), tests pass 0. It is counted in
// tick(dt) while the board is at rest, so a test that steps time controls it and no real clock is involved.
import * as data from './lines.js';
import { goalOf } from './goal.js';

const clean = (san) => String(san).replace(/[+#!?]+$/, '');

// The starter list, read the way test/openings.mjs reads it.
export const LINES = data.OPENINGS || data.LINES || data.default || [];

// A line can be walked once every move carries its sentence in both languages. The rest stay visible but inert.
export function playable(line) {
  return !!line?.moves?.length && line.moves.every((m) => m.en && m.de);
}

export function createExplain({ game, hint = null, marks = null, lines = LINES, pause = 900, onSide = null }) {
  const listeners = [];
  let line = null;
  let ply = 0;
  let message = null;       // { type: 'refused', san } after a wrong move, else null
  let card = null;          // the text card that waits for Weiter: { ply } of the move it explains, { ply, last } for the last move, { ending } once the line is through
  let previewing = false;   // the goal screen is up: the board shows the line's last position, nothing can be moved
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
    const show = hintOn && due && isOwn(ply) && !card && !previewing && !game.busy && !game.pendingPromotion;
    const sq = show && squares();
    if (sq) hint.show(sq.from, sq.to); else hint.hide();
  }

  function state() {
    return {
      phase: !line ? 'list' : previewing ? 'preview' : finished() ? 'finished' : 'walking',
      line, ply, total: total(), message, card,
      canContinue: !!card && !card.ending,   // Weiter is live: a card waits
      due: dueMove() && !previewing ? { ...dueMove(), own: isOwn(ply) } : null,
      goal: line ? goalOf(line) : null,
      hint: hintOn,
      canBack: !!line && !previewing && ply > 0,
    };
  }

  function say(m) { message = m; }

  function guard(move) {
    const due = dueMove();
    if (!line || !due || !isOwn(ply) || card) return false;   // a waiting card holds the board: Weiter first
    if (clean(move.san) === clean(due.san)) return true;
    say({ type: 'refused', san: due.san });
    emit();
    return false;
  }

  function afterMove() {
    wait = null;
    message = null;
    card = finished() ? { ply: ply - 1, last: true } : { ply: ply - 1 };
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
  game.on('undo', () => { if (line && !internal && !previewing) { ply = game.chess.history.length; wait = null; message = null; card = ply ? { ply: ply - 1 } : null; syncHint(); emit(); } });
  game.on('newgame', () => { if (line && !internal) { ply = 0; wait = null; message = null; card = null; previewing = false; marks?.hide(); syncHint(); emit(); } });

  function begin() {
    previewing = false;
    marks?.hide();
    internal++;
    game.setMode('explain');
    game.setMoveGuard(guard);
    game.newGame({ instant: true });
    internal--;
    ply = 0; wait = null; message = null; card = null;
    onSide?.(line.side);
    syncHint();
    emit();
  }

  // The goal screen: the board shows where the line ends, the pieces that moved are marked, the guard refuses every move.
  function preview() {
    previewing = true;
    internal++;
    game.setMode('explain');
    game.setMoveGuard(() => false);
    game.loadFen(goalOf(line).fen);
    internal--;
    ply = 0; wait = null; message = null; card = null;
    hint?.hide();
    marks?.show(goalOf(line).marks);
    onSide?.(line.side);
    emit();
  }

  return {
    state, lines, playable,
    on(fn) { listeners.push(fn); },

    // A line opens on its goal screen; `{ preview: false }` walks it at once.
    start(id, { preview: goal = true } = {}) {
      const l = typeof id === 'string' ? lines.find((x) => x.id === id) : id;
      if (!l || !playable(l)) return false;
      line = l;
      if (goal) preview(); else begin();
      return true;
    },
    // Los: from the goal screen back to the start position, the walk begins.
    go() { if (line && previewing) begin(); },
    // Weiter: the waiting text card is done. The last move's card gives way to the ending text, which stays.
    weiter() {
      if (!card || card.ending) return;
      const last = card.last;
      message = null;
      card = last && line.ending ? { ending: true } : null;
      syncHint();
      emit();
    },
    // Back to the list: the ordinary game takes the board again.
    stop() {
      if (!line) return;
      line = null; ply = 0; wait = null; message = null; card = null; previewing = false;
      hint?.hide();
      marks?.hide();
      internal++;
      game.setMode('play');
      game.newGame({ instant: true });
      internal--;
      emit();
    },
    restart() { if (line) begin(); },   // Nochmal: the walk from the start (not the goal screen)

    // The due move, played for the player (or the opponent's move without its pause).
    next() {
      const due = dueMove();
      if (!due || previewing) return;
      card = null;
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
      ply = target; wait = null; message = null; card = ply ? { ply: ply - 1 } : null;
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
      if (previewing || card || !dueMove() || isOwn(ply)) { wait = null; return; }
      if (game.busy || game.pendingPromotion) return;
      if (wait === null) wait = pause / 1000;
      wait -= dt;
      if (wait <= 0) { wait = null; this.next(); }
    },
  };
}
