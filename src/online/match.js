// The online game on the 3D board (CHE-271): drives the existing game (src/game.js) from the server's state. The server is the only
// truth: the board shows its moves; a move the player makes is sent with a client id and kept until the server has it (a retry with
// the same id is applied once, so no move is lost or sent twice). Without a connection the board is locked (the move guard refuses).
// The player can leave the game on the board (Play starts a local game, a lesson takes the board); the Online tab brings it back.
import { sqName } from '../rules.js';

export function createMatch({ game, controls, api, onChange = () => {}, setBoard = () => {} }) {
  let games = [];            // the server's games (state.games) last seen (CHE-335: one per opponent, any number)
  let g = null;              // the game on the board: its last state from the server, or null
  let attached = false;      // the board shows the online game
  let applying = false;      // our own moves on the board: not sent, not a reason to detach
  let local = [];            // the moves on the board, uci
  let pending = null;        // { uci, cid, game } sent or to be sent
  let left = 0;              // the id of a game the player left on purpose (not attached again by itself)
  let prevAi = null;
  let cidN = 0;
  const cidOf = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${++cidN}`;
  const uciOf = (m) => sqName(m.from) + sqName(m.to) + (m.promo || '');
  const changed = () => { setBoard(attached); onChange(); };

  function guard() {
    if (!attached || !g) return true;
    return api.connected && !pending && g.status === 'active' && game.getState().turn === g.color;
  }
  /** put the game with this id on the board (the one on it leaves cleanly: queue and unsent move cleared); false when it is not an active game or the board is busy */
  function attach(id = g?.id) {
    const gj = games.find((x) => x.id === id);
    if (!gj || gj.status !== 'active' || game.mode !== 'play') return false;
    if (g && g.id !== gj.id) { queue.length = 0; pending = null; }
    g = gj;
    applying = true;
    try {
      if (!attached) { const st = game.getState(); prevAi = { on: st.vsComputer, color: st.computerColor, level: st.level }; }
      game.setVsComputer(false);
      game.newGame({ instant: true });
      game.playMoves(gj.moves, { instant: true });
      local = [...gj.moves];
      game.setMoveGuard(guard);
      if (controls && controls.side !== gj.color) controls.flip();   // your own pieces in front
    } finally { applying = false; }
    attached = true; left = 0;
    changed();
    return true;
  }
  function detach({ restore = true } = {}) {
    if (!attached) return;
    attached = false;
    if (game.mode === 'play') game.setMoveGuard(null);
    if (restore && prevAi?.on) game.setVsComputer(true, { color: prevAi.color, level: prevAi.level || undefined });
    prevAi = null;
    changed();
  }

  // the board left the online game: a new local game, an undo, a lesson
  game.on('newgame', () => { if (!applying && attached) { left = g?.id || 0; detach(); } });
  game.on('undo', () => { if (!applying && attached) { left = g?.id || 0; detach(); } });
  game.on('change', () => { if (attached && !applying && game.mode !== 'play') { left = g?.id || 0; detach({ restore: false }); } });
  // the player moved on the board: send it
  game.on('move', (rec) => {
    if (!attached || applying || !g || rec.m.color !== g.color) return;
    const uci = uciOf(rec.m);
    local.push(uci);
    pending = { uci, cid: cidOf(), game: g.id };
    send();
    changed();
  });

  let sending = false;
  async function send() {
    if (!pending || sending) return;
    if (!api.connected) return;   // sent again once the connection is back
    sending = true;
    const p = pending;
    try {
      await api.post('/move', { game: p.game, uci: p.uci, cid: p.cid });
      if (pending === p) pending = null;
    } catch (e) {
      if (!e.net && e.status !== 401 && !(e.status >= 500) && pending === p) {
        pending = null;   // refused (illegal, not your turn, game over): the board follows the server again
        if (g && attached) resync();
      }
    } finally { sending = false; }
    changed();
    if (pending && pending !== p) send();
  }
  // a retry of an unsent move: when the connection comes back and every 2 s
  const retryT = setInterval(() => { if (pending && api.connected) send(); }, 2000);

  function resync() {
    if (!g || g.status !== 'active') return;
    applying = true;
    try { game.newGame({ instant: true }); game.playMoves(g.moves, { instant: true }); local = [...g.moves]; game.setMoveGuard(guard); }
    finally { applying = false; }
    changed();
  }

  // the server's moves that the board does not have yet are played one by one, animated, when the board is not busy
  const queue = [];
  function pump() {
    if (!attached || !queue.length || game.busy || game.pendingPromotion) return;
    const u = queue.shift();
    applying = true;
    let ok = null;
    try { ok = game.move(u.slice(0, 2), u.slice(2, 4), u[4] || undefined); } finally { applying = false; }
    if (ok) local.push(u); else { queue.length = 0; resync(); }
    onChange();
  }
  const pumpT = setInterval(pump, 120);

  function endOnBoard() {
    if (!attached || !g || g.status !== 'over') return;
    const st = game.getState();
    if (st.over) return;   // the rules ended it on the board already (mate, a draw by rule)
    if (g.reason === 'resign' || g.reason === 'stale') game.end({ result: g.result, reason: g.reason, winner: g.winner });
  }

  /** a new state from the server. The board never switches by itself, except for one case: no active online game is on it and exactly one is running */
  function update(state) {
    games = state.games || (state.game ? [state.game] : []);
    if (g) {
      const now = games.find((x) => x.id === g.id) || null;   // the board game, from its newest state
      if (!now) { g = null; queue.length = 0; pending = null; if (attached) detach(); return; }
      g = now;
    }
    if (!attached || g?.status === 'over') {   // nothing running on the board
      const act = games.filter((x) => x.status === 'active');
      if (act.length === 1 && act[0].id !== left && game.mode === 'play') attach(act[0].id);   // the page opened with one game, or a new one is your only one
    }
    if (!attached) return;
    // the board is attached: bring it to the server's moves
    const sm = g.moves;
    const prefix = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);
    const have = [...local, ...queue];
    if (sm.length === have.length && prefix(sm, have)) { /* in step */ }
    else if (prefix(have, sm)) queue.push(...sm.slice(have.length));
    else if (pending && prefix(sm, have)) { /* our move is on its way */ }
    else { queue.length = 0; resync(); }
    if (pending && sm.length > local.length - 1 && sm[local.length - 1] === pending.uci) pending = null;
    if (g.status === 'over') {
      // wait for the last moves to play, then end it on the board when the rules did not
      const finish = () => { if (queue.length || game.busy) { setTimeout(finish, 200); return; } endOnBoard(); };
      finish();
    }
    changed();
  }

  return {
    update, attach, detach,
    get attached() { return attached; },
    get game() { return g; },
    get pending() { return !!pending; },
    get locked() { return attached && !!g && g.status === 'active' && !api.connected; },
    retrySend: () => send(),
    stop() { clearInterval(retryT); clearInterval(pumpT); detach(); },
  };
}
