// Puzzle controller: one puzzle at a time on the 3D board. No DOM and no rendering here: the Learn tab reads state()
// and the hint arrow is driven through `hint`. Legality is the rules engine's answer, the puzzle decides which legal move
// is due. The data is in the Lichess shape (src/puzzles/data.js): `fen` is the position before the opponent's last move,
// moves[0] is that opponent move, then the player's solution alternates with the replies.
//
// The opponent pause is a parameter, like Explain mode (ADR 0007): about 600 ms in the page, 0 in tests. It is counted in
// tick(dt) while the board is at rest, so a test that steps time controls it and no real clock is involved.
//
// Misses cost nothing: a wrong move is refused (the piece stays, a calm message) and the player tries again. Help shows
// the gold arrow for the due move. A puzzle with a miss or with Help counts as "not yet" and comes back later.
const sqOf = (name) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
const sqName = (sq) => 'abcdefgh'[sq & 7] + ((sq >> 3) + 1);
// the decisive move lands and sits this long before the reward starts (owner: the moment should come later)
const SETTLE = 0.8;
const parseUci = (u) => ({ from: sqOf(u.slice(0, 2)), to: sqOf(u.slice(2, 4)), promo: u[4] || null });

export function createPuzzles({ game, hint = null, sweep = null, progress, reward = null, onChapter = null, pause = 600, onSide = null }) {
  const listeners = [];
  let puzzle = null;
  let phase = 'idle';        // idle | playing | solved
  let ply = 0;               // index into puzzle.moves of the move that is due next
  let misses = 0;
  let helped = false;
  let message = null;        // { type: 'start' | 'wrong' | 'again' | 'right' | 'solved' | 'help' }
  let wait = null;           // seconds left before the due opponent reply is played, null when none is waiting
  let internal = 0;          // > 0 while the controller itself moves, so the game events are its own
  let allowed = false;       // the guard said yes to a player move that is about to arrive as a 'move' event
  let deviated = false;      // a mate in two was answered with another first move that still forces mate: the line is the engine's now
  let pendingDev = false;    // the guard accepted a deviating first move that has not been played yet
  let lastTo = null, lastDelay = 0;         // the square the player's last move went to: the decisive piece, where the reward bursts

  const total = () => (puzzle ? puzzle.moves.length : 0);
  const emit = () => listeners.forEach((fn) => fn(state()));
  // Plies 1, 3, 5 ... are the player's: moves[0] is the opponent move that sets the puzzle up.
  const isOwn = (i) => i % 2 === 1;
  const mates = () => game.chess.moves().filter((m) => /#$/.test(game.chess.san(m)));
  const due = () => {
    if (!puzzle || phase !== 'playing' || ply >= total()) return null;
    if (deviated && isOwn(ply)) { const m = mates()[0]; return m ? { from: m.from, to: m.to, promo: m.promo || null } : null; }
    return parseUci(puzzle.moves[ply]);
  };

  // After the move, does every reply of the opponent allow a mate in one? The engine plays it and takes it back.
  function forcesMate(move) {
    const c = game.chess;
    const m = c.play({ from: move.from, to: move.to, promo: move.promo || null });
    if (!m) return false;
    let yes = false;
    const replies = c.moves();
    if (replies.length) {
      yes = true;
      for (const r of replies) {
        c.play(r);
        const mated = c.moves().some((x) => /#$/.test(c.san(x)));
        c.undo();
        if (!mated) { yes = false; break; }
      }
    }
    c.undo();
    return yes;
  }

  // The side the player has: the side to move once moves[0] has been played.
  function ownColor() {
    if (!puzzle) return null;
    const turn = puzzle.fen.split(' ')[1];
    return turn === 'w' ? 'b' : 'w';
  }

  function hideHint() {
    hint?.hide();
    hint?.force(false);
  }
  function showHint() {
    const d = due();
    if (!hint || !d || !isOwn(ply)) return;
    if (!hint.enabled) hint.force(true);   // Help is the player asking: it shows even with the hint switch off
    hint.show(d.from, d.to);
  }

  function state() {
    const d = due();
    return {
      phase, puzzle, band: puzzle ? puzzle.band : progress.band(), theme: puzzle ? puzzle.theme : null,
      ply, total: total(), message, misses, helped,
      clean: phase === 'solved' ? misses === 0 && !helped : null,
      own: ownColor(), canHelp: phase === 'playing' && !!d && isOwn(ply) && !helped,
      hint: hint ? hint.visible : false,
      busy: wait !== null,
    };
  }
  const say = (type) => { message = { type }; };

  // The player's move, asked before the game makes it. The stored move always passes. In a mate puzzle (mate1, mate2) any
  // checkmate does, and in a mate in two a different first move does when every reply allows a mate in one. Hanging piece
  // and fork puzzles accept only the stored move.
  function guard(move) {
    if (phase !== 'playing' || !isOwn(ply) || game.busy) return false;
    const d = due();
    const exact = !deviated && move.from === d.from && move.to === d.to;
    const mateTheme = puzzle.theme === 'mate1' || puzzle.theme === 'mate2';
    if (exact || (mateTheme && /#$/.test(move.san))) {
      allowed = true;
      return true;
    }
    if (puzzle.theme === 'mate2' && !deviated && ply === 1 && forcesMate(move)) {
      allowed = true;
      pendingDev = true;
      return true;
    }
    misses += 1;
    say(misses > 1 ? 'again' : 'wrong');
    hideHint();
    emit();
    return false;
  }

  function solved() {
    phase = 'solved';
    wait = null;
    say('solved');
    hideHint();
    progress.finish(puzzle.id, { clean: misses === 0 && !helped });
    emit();
    // the gold sweep runs from the player's edge over the player's own pieces, the same call as in the Drill
    const side = ownColor(), squares = [];
    game.chess.board.forEach((pc, sq) => { if (pc && (pc < 'a' ? 'w' : 'b') === side) squares.push(sq); });
    const sweepNow = () => sweep?.play?.({ side, squares });   // with the reward when there is one, so it starts after the move has landed and sat
    // the reward: a burst on the decisive piece, the chime and the card with its Next button. A puzzle that needed misses or
    // Help gets the silver one, the same as its station will.
    // a solve that finishes a chapter goes on to the board finale and then onChapter (main.js opens the Learn path)
    const fin = progress.stats().finished;
    const chapter = fin && onChapter ? { onDone: () => onChapter(fin) } : null;
    reward?.solved?.({ square: lastTo, silver: misses > 0 || helped, delay: lastDelay + SETTLE, theme: puzzle.theme, onNext: () => ctl.next(), chapter, onStart: sweepNow });
    if (!reward) sweepNow();
    if (chapter && !reward) onChapter(fin);
  }

  game.onMove((rec) => {
    if (phase !== 'playing' || internal) return;
    if (!allowed) return;
    allowed = false;
    lastTo = rec.m.to;
    {   // the slide takes this long to land (the same estimate as the move sounds): the reward waits for it
      const m = rec.m, dist = Math.hypot((m.to & 7) - (m.from & 7), (m.to >> 3) - (m.from >> 3));
      lastDelay = m.piece === 'n' ? 0.8 : 0.4 + 0.07 * dist;
    }
    const dev = pendingDev; pendingDev = false;
    // a promotion is chosen after the guard: the wrong piece is a miss, not a solution
    const d = deviated ? null : due();
    if (d && d.promo && rec.m.promo && rec.m.promo !== d.promo && !/#$/.test(rec.san)) {
      misses += 1; say('wrong');
      internal++; game.finishAnimations(); game.undo(); game.finishAnimations(); internal--;
      emit();
      return;
    }
    if (dev && !/#$/.test(rec.san)) deviated = true;
    ply = /#$/.test(rec.san) ? total() : ply + 1;
    hideHint();
    if (ply >= total()) { solved(); return; }
    say('right');
    wait = null;
    emit();
  });
  // Undo or New game from the HUD while a puzzle runs: start the same puzzle over, so the board and the plies agree.
  game.on('undo', () => { if (puzzle && phase === 'playing' && !internal) load(puzzle, { keepScore: true }); });
  game.on('newgame', () => { if (puzzle && phase !== 'idle' && !internal) load(puzzle, { keepScore: true }); });

  function playReply() {
    const m = deviated ? game.chess.moves()[0] : null;
    const d = m ? { from: m.from, to: m.to, promo: m.promo || null } : parseUci(puzzle.moves[ply]);
    internal++;
    game.finishAnimations();
    game.move(sqName(d.from), sqName(d.to), d.promo);
    internal--;
    ply += 1;
    wait = null;
    say('your');
    emit();
  }

  // Put the puzzle on the board: the position before the opponent's move, then that move played with its slide.
  function load(p, { keepScore = false } = {}) {
    reward?.dismiss?.();
    puzzle = p;
    phase = 'playing';
    ply = 0; wait = null; allowed = false; deviated = false; pendingDev = false;
    if (!keepScore) { misses = 0; helped = false; }
    hideHint();
    internal++;
    game.setMode('puzzle');
    game.setMoveGuard(guard);
    game.loadFen(p.fen);
    internal--;
    onSide?.(ownColor());
    say('start');
    // the opponent's last move is played at once with its slide, so the player sees what just happened
    internal++;
    const d = parseUci(p.moves[0]);
    game.move(sqName(d.from), sqName(d.to), d.promo);
    internal--;
    ply = 1;
    emit();
  }

  const ctl = {
    state,
    on(fn) { listeners.push(fn); },

    // Pick the next puzzle from the progress store and put it on the board.
    start() {
      const p = progress.next();
      if (!p) return false;
      load(p);
      return true;
    },
    // After a solved puzzle: the same as start. During a puzzle: skip it, which counts as not yet.
    next() {
      if (phase === 'playing' && puzzle) progress.finish(puzzle.id, { clean: false });
      return this.start();
    },
    // The gold arrow for the due move. The puzzle then counts as not yet.
    help() {
      if (phase !== 'playing' || !isOwn(ply) || game.busy) return false;
      helped = true;
      say('help');
      showHint();
      emit();
      return true;
    },
    // Back to the ordinary game on a fresh board.
    stop() {
      if (phase === 'idle') return;
      if (phase === 'playing' && puzzle && (misses || helped)) progress.finish(puzzle.id, { clean: false });
      hideHint();
      reward?.dismiss?.();
      phase = 'idle'; puzzle = null; wait = null; message = null; misses = 0; helped = false;
      internal++;
      game.setMode('play');
      game.newGame({ instant: true });
      internal--;
      emit();
    },
    // Every frame, with the frame time: plays the opponent's reply once the pause has run and the board is at rest.
    tick(dt) {
      reward?.tick?.(dt);
      if (phase !== 'playing') return;
      if (!due() || isOwn(ply)) { wait = null; return; }
      if (game.busy || game.pendingPromotion) return;
      if (wait === null) wait = pause / 1000;
      wait -= dt;
      if (wait <= 0) playReply();
    },
  };
  return ctl;
}
