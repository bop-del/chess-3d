// "Good move?": one good move for the player, shown with the hint arrow. The search is Hard's (depth 4, no randomness),
// time sliced so the page stays responsive. The arrow stays until the player moves, undoes or starts a new game.
// state(): 'idle' | 'thinking' | 'showing'. on(fn) calls fn({ state, move }) on every change.
import { searchMove } from './ai.js';

const SLICE_MS = 8;
const DEPTH = 4;

export function createGoodMove({ game, hint, depth = DEPTH, schedule = (fn) => setTimeout(fn, 0) }) {
  let state = 'idle';
  let move = null;
  let token = 0;          // bumps on every clear, so a search that is no longer wanted drops its result
  let pending = null;     // the promise of the search in progress
  const listeners = [];
  const set = (s, m = null) => { state = s; move = m; listeners.forEach((fn) => fn({ state, move })); };

  // The player's turn, nothing animating, nothing else owning the arrow. Explain and Drill play in a mode other than 'play'.
  function allowed() {
    const st = game.getState();
    if (st.over || st.thinking || st.busy || game.pendingPromotion) return false;
    if (game.mode !== 'play') return false;
    if (st.vsComputer && st.turn === st.computerColor) return false;
    return true;
  }

  function clear() {
    token++;
    pending = null;
    hint.hide();
    if (state !== 'idle') set('idle');
  }

  function ask() {
    if (state === 'thinking' && pending) return pending;
    if (!allowed()) return Promise.resolve(null);
    clear();
    const mine = token;
    const fen = game.getState().fen;
    const gen = searchMove(fen, depth, 0);
    set('thinking');
    pending = new Promise((resolve) => {
      const step = () => {
        if (mine !== token) { resolve(null); return; }
        const t0 = performance.now();
        let r;
        while (performance.now() - t0 < SLICE_MS) { r = gen.next(); if (r.done) break; }
        if (!r || !r.done) { schedule(step); return; }
        const m = r.value.move;
        // the position moved on while we thought: the answer no longer fits
        if (!m || game.getState().fen !== fen || !allowed()) { if (mine === token) { pending = null; set('idle'); } resolve(null); return; }
        pending = null;
        hint.show(m.from, m.to);
        set('showing', { from: m.from, to: m.to, promo: m.promo || null });
        resolve(move);
      };
      schedule(step);
    });
    return pending;
  }

  game.on('move', clear);
  game.on('undo', clear);
  game.on('newgame', clear);
  // a mode switch (Explain, Drill) or the computer taking over the turn also ends it
  game.on('change', () => { if (state !== 'idle' && (game.mode !== 'play' || game.getState().thinking)) clear(); });

  return {
    ask, clear,
    state: () => state,
    move: () => move,
    canAsk: allowed,
    on(fn) { listeners.push(fn); },
  };
}
