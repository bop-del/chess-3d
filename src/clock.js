// The chess clock: a pure core (no DOM, no real time) and the glue that binds it to a game. The loop drives it with tick(dt), so
// ?manual=1 and __chess.step(seconds) drive it like everything else.
//
//   createClock({ preset, onFlag }) -> { start(turn), switchTo(turn), tick(dt), remaining(color), pause(), resume(), stop(), reset(preset?),
//     choose(preset), setUntimed(color|null), suspend(on), state() }
//   PRESETS: off, 3+2, 5+0, 10+0, 15+10 (minutes plus increment seconds). Default off, which does nothing at all.
//   flagVerdict(chess, flagged) -> { result, winner, reason: 'time' }: the side that ran out loses, unless the other side has a bare king.
//   createGameClock({ game, preset }) -> the clock, bound to the game (the rules are in bindGame below).
//
// Rules: the clock of the side to move runs, from the first move of White (so a player can look at the board first). A move adds the
// increment to the side that made it. Against the computer only the player's clock runs (setUntimed names the computer's side).
// Lessons and puzzles (game.mode other than 'play') never run the clock. Undo does not touch the clocks.
export const PRESETS = {
  off: null,
  '3+2': { base: 180, inc: 2 },
  '5+0': { base: 300, inc: 0 },
  '10+0': { base: 600, inc: 0 },
  '15+10': { base: 900, inc: 10 },
};
export const PRESET_IDS = Object.keys(PRESETS);
export const isPreset = (p) => typeof p === 'string' && Object.hasOwn(PRESETS, p);
/** A preset id from user input: ?clock=5+0 arrives as "5 0" (a plus in a query string is a space). Null when it is not a preset. */
export const normalizePreset = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, '+').toLowerCase();
  return isPreset(s) ? s : null;
};

/** m:ss, and under 10 seconds s.t with tenths. Never negative. */
export function formatTime(sec) {
  const s = Number.isFinite(sec) && sec > 0 ? sec : 0;
  if (s < 10) return (Math.floor(s * 10 + 1e-9) / 10).toFixed(1);
  const whole = Math.floor(s + 1e-9);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const other = (c) => (c === 'w' ? 'b' : 'w');

export function createClock({ preset = 'off', onFlag } = {}) {
  let id = isPreset(preset) ? preset : 'off';
  let next = id;                       // the preset the next game starts with (the chooser sets it)
  let cfg = PRESETS[id];
  const t = { w: 0, b: 0 };
  let active = null, running = false, paused = false, suspended = false, flagged = null, untimed = null;

  function apply() {
    id = next;
    cfg = PRESETS[id];
    t.w = t.b = cfg ? cfg.base : 0;
    active = null; running = false; paused = false; flagged = null;
  }
  apply();

  const live = () => !!cfg && !suspended && !flagged;
  const self = {
    /** The side `turn` starts running, nothing is credited. */
    start(turn) { if (!live()) return; active = turn === 'b' ? 'b' : 'w'; running = true; },
    /** `turn` is to move now: the side that just moved gets the increment, then the clock of `turn` runs. */
    switchTo(turn) {
      if (!live()) return;
      turn = turn === 'b' ? 'b' : 'w';
      if (running && active === turn) return;
      const mover = other(turn);
      if (mover !== untimed) t[mover] += cfg.inc;
      active = turn; running = true;
    },
    tick(dt) {
      if (!live() || !running || paused || active == null || active === untimed || !(dt > 0)) return;
      t[active] -= dt;
      if (t[active] <= 0) {
        t[active] = 0;
        flagged = active; running = false;
        onFlag?.(flagged);
      }
    },
    remaining(color) { return t[color === 'b' ? 'b' : 'w']; },
    pause() { paused = true; },
    resume() { paused = false; },
    /** The game is over: nothing runs any more (the times stay as they are). */
    stop() { running = false; },
    /** New game: the times go back to the chosen preset, nothing runs until the first move. */
    reset(preset) { if (preset !== undefined) next = isPreset(preset) ? preset : 'off'; apply(); },
    /** The preset the next game will use; the running game keeps its own. */
    choose(preset) { next = isPreset(preset) ? preset : 'off'; },
    /** The computer's side: its clock never runs and it gets no increment. */
    setUntimed(color) { untimed = color === 'w' || color === 'b' ? color : null; },
    /** A lesson or puzzle has the board: the clock neither runs nor shows. */
    suspend(on) { suspended = !!on; },
    state() {
      return {
        preset: id, next, enabled: !!cfg, base: cfg ? cfg.base : 0, inc: cfg ? cfg.inc : 0,
        running: running && !paused, paused, suspended, active, flagged, untimed,
        started: active != null, w: t.w, b: t.b,
      };
    },
  };
  return self;
}

/** The result when `flagged` ran out of time: a loss on time, or a draw when the other side has only its king (insufficient
 *  material beyond a bare king is not considered). `chess` is the rules engine (chess.board holds a letter or null per square). */
export function flagVerdict(chess, flagged) {
  const winner = other(flagged);
  const mine = winner === 'w' ? (p) => p < 'a' : (p) => p >= 'a';
  let bare = true;
  for (const p of chess.board) if (p && mine(p) && p.toLowerCase() !== 'k') { bare = false; break; }
  if (bare) return { result: '1/2-1/2', winner: null, reason: 'time' };
  return { result: winner === 'w' ? '1-0' : '0-1', winner, reason: 'time' };
}

/** Binds a clock to a game (src/game.js or a stand in with the same events): moves switch it, a new game resets it, a finished game
 *  stops it, lessons suspend it, the computer's side is untimed, and a flag ends the game through game.end(). */
export function bindGame({ clock, game }) {
  let mode = game.mode;
  const sync = () => {
    const st = game.getState();
    const m = game.mode;
    if (m !== mode) {            // a lesson or puzzle took the board, or gave it back: the clock starts over
      mode = m;
      clock.reset();
    }
    clock.suspend(m !== 'play');
    clock.setUntimed(st.vsComputer && m === 'play' ? st.computerColor : null);
    if (st.over) clock.stop();
  };
  game.on('change', sync);
  game.on('newgame', () => { clock.reset(); sync(); });
  game.on('move', (rec) => {
    if (game.mode !== 'play') return;
    if (game.getState().over) { clock.stop(); return; }
    clock.switchTo(other(rec.m.color));
  });
  sync();
  return clock;
}

export function createGameClock({ game, preset = 'off' }) {
  const clock = createClock({ preset, onFlag: (color) => game.end(flagVerdict(game.chess, color)) });
  return bindGame({ clock, game });
}
