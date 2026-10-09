// Online tab logic without DOM (CHE-301), tested in test/online-cards.mjs: what the second button of a player card does, and the
// state of the floating chat (open with a player, shown or collapsed to the pill).

/** wins : losses from your side, the draws only when there are some; '' when never played */
export const scoreOf = (s) => (!s || !(s.w + s.l + s.d) ? '' : `${s.w} : ${s.l}${s.d ? `  ½ ${s.d}` : ''}`);

/** the second button of a card (CHE-335): 'game' (a running game with this player: "Zur Partie"), 'asked' (your challenge is open: "Zurückziehen"),
 * 'incoming' (they challenged you: answered in the card above the list), else 'challenge' (gold). `game`: a running game with this player. */
export function secondAction(p, { game = false, out = [], inc = [] } = {}) {
  const has = (l) => (Array.isArray(l) ? l.includes(p.name) : l === p.name);
  if (game) return 'game';
  if (has(out)) return 'asked';
  if (has(inc)) return 'incoming';
  return 'challenge';
}

/** the line of a card with a running game: 'mine' (your move, highlighted) or 'theirs' ("<name> ist dran") */
export const gameLine = (g) => (g.turn === g.color ? 'mine' : 'theirs');

/** the number on the bell: running games where it is your move */
export const myTurnCount = (games = []) => games.filter((g) => g.status === 'active' && g.turn === g.color).length;

const MIN = 60000, HOUR = 3600000, DAY = 86400000;

/** a span of time in coarse words (CHE-403, Waiting time): { unit: 'min' | 'h' | 'd', n }, rounded down, at least 1 minute */
export function spanOf(ms) {
  const m = Math.floor(Math.max(0, ms) / MIN);
  if (m < 60) return { unit: 'min', n: Math.max(1, m) };
  const h = Math.floor(m / 60);
  return h < 24 ? { unit: 'h', n: h } : { unit: 'd', n: Math.floor(h / 24) };
}

/** the Waiting time of a running game: ms since the last move, on the server's clock (`now` is nowServer()) */
export const waitingMs = (g, now) => Math.max(0, now - (g.lastMoveAt || now));

/** the limit line of a running game (CHE-403): null until the last day before the 3 day limit, then { left: span, over, mine }.
 * `mine` is your move: the opponent wins when the time runs out. Else you are the waiting player and can end the game. */
export function limitInfo(g, now) {
  if (g.status !== 'active' || !g.staleAt) return null;
  const left = g.staleAt - now;
  if (left > DAY) return null;
  return { left: spanOf(left), over: left <= 0, mine: g.turn === g.color };
}

/** the full move number of the game ("Zug 12"): the move being played now */
export const moveNo = (g) => Math.floor((g.moves?.length || 0) / 2) + 1;

/** the running games for the block at the top of the Online tab: only active ones, yours to move first, then the longest waiting first */
export function runningGames(games = [], now = Date.now()) {
  return games.filter((g) => g.status === 'active').map((g) => ({ g, mine: g.turn === g.color, wait: waitingMs(g, now) }))
    .sort((a, b) => (b.mine - a.mine) || (b.wait - a.wait) || (b.g.id - a.g.id)).map((x) => x.g);
}

/** the chat window: { with, shown, min }. actions: open(name), to(name) switcher, min, expand, close */
export function chatStep(st, action, name = '') {
  switch (action) {
    case 'open': return { with: name, shown: true, min: false };
    case 'to': return st.shown ? { ...st, with: name } : st;
    case 'min': return st.shown ? { ...st, min: true } : st;
    case 'expand': return st.shown ? { ...st, min: false } : st;
    case 'close': return { with: null, shown: false, min: false };
    default: return st;
  }
}
/** what is on screen for a chat state: the window, the collapsed pill, or nothing */
export const chatView = (st, known = true) => (!st.with || !st.shown || !known ? 'none' : st.min ? 'pill' : 'window');

/** Player card numbers without DOM (CHE-290): what a `GET /player/<name>` answer shows. `empty` when the player has no finished game. */
export function statView(s) {
  if (!s || !s.games) return { empty: true, games: 0, wins: 0, losses: 0, draws: 0, bar: { w: 0, d: 0, l: 0 }, streak: { type: null, n: 0 }, bestWins: 0, h2h: null, avgMoves: 0, avgMinutes: '', openings: [] };
  const w = Math.round((s.wins * 100) / s.games), d = Math.round((s.draws * 100) / s.games);
  const hh = s.headToHead, d2 = s.details || {};
  const m = d2.avgMinutes || 0;
  return {
    empty: false, games: s.games, wins: s.wins, losses: s.losses, draws: s.draws,
    bar: { w, d: Math.min(d, 100 - w), l: Math.max(0, 100 - w - Math.min(d, 100 - w)) },   // percent of the bar, always 100 together
    streak: { type: s.streak?.current?.type || null, n: s.streak?.current?.n || 0 },
    bestWins: s.streak?.best?.wins || 0,
    h2h: hh && hh.games ? { w: hh.wins, l: hh.losses, d: hh.draws, games: hh.games, line: scoreOf({ w: hh.wins, l: hh.losses, d: hh.draws }) } : null,
    avgMoves: Math.round(d2.avgMoves || 0),
    avgMinutes: !m ? '' : m < 1 ? '<1' : String(m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).replace('.', ','),   // German decimal comma
    openings: (d2.openings || []).slice(0, 3),   // three at most
  };
}
