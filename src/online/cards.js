// Online tab logic without DOM (CHE-301), tested in test/online-cards.mjs: what the second button of a player card does, and the
// state of the floating chat (open with a player, shown or collapsed to the pill).

/** wins : losses from your side, the draws only when there are some; '' when never played */
export const scoreOf = (s) => (!s || !(s.w + s.l + s.d) ? '' : `${s.w} : ${s.l}${s.d ? `  ½ ${s.d}` : ''}`);

/** the second button of a card: 'challenge' (gold, works), or a disabled one: 'playing', 'asked', 'busy' (you are in a game or already with this player) */
export function secondAction(p, { active = false, outTo = '' } = {}) {
  if (p.playing) return 'playing';
  if (outTo === p.name) return 'asked';
  if (active || p.withMe) return 'busy';
  return 'challenge';
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
