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
