// Badges: rewards for what the player has done, per device (no account, no network). Pure: no DOM, no rules engine. The numbers
// come from `sources` (functions, so the store reads the live state of the puzzle path, the openings store and the daily store);
// the store only keeps which badge was earned when, plus the first win against each computer level. Badges are never taken away:
// once earned, a badge stays even if the openings are removed later.
//
// Store (localStorage 'chess3d.badges', version 1): { v: 1, earned: { <badgeId>: 'YYYY-MM-DD' }, wins: { <level>: 'YYYY-MM-DD' } }.
// Storage is anything with getItem and setItem and may be missing or throw: the badges then live in memory for the session.
// A record of a newer version is read as empty and never written over.
export const STORE_KEY = 'chess3d.badges';
export const VERSION = 1;
export const FAMILIES = ['puzzles', 'openings', 'wins', 'daily'];
export const LEVELS = ['novice', 'easy', 'normal', 'hard'];

const n = (en, de) => ({ en, de });
/** goal: the number the family counter has to reach, 'all' for every opening line, 1 for a win. */
export const BADGES = [
  { id: 'puzzles-10', family: 'puzzles', goal: 10, name: n('10 puzzles', '10 Rätsel') },
  { id: 'puzzles-50', family: 'puzzles', goal: 50, name: n('50 puzzles', '50 Rätsel') },
  { id: 'puzzles-100', family: 'puzzles', goal: 100, name: n('100 puzzles', '100 Rätsel') },
  { id: 'openings-1', family: 'openings', goal: 1, name: n('First opening', 'Erste Eröffnung') },
  { id: 'openings-5', family: 'openings', goal: 5, name: n('5 openings', '5 Eröffnungen') },
  { id: 'openings-all', family: 'openings', goal: 'all', name: n('All openings', 'Alle Eröffnungen') },
  { id: 'win-novice', family: 'wins', goal: 1, level: 'novice', name: n('Beat Novice', 'Anfänger besiegt') },
  { id: 'win-easy', family: 'wins', goal: 1, level: 'easy', name: n('Beat Easy', 'Leicht besiegt') },
  { id: 'win-normal', family: 'wins', goal: 1, level: 'normal', name: n('Beat Normal', 'Mittel besiegt') },
  { id: 'win-hard', family: 'wins', goal: 1, level: 'hard', name: n('Beat Hard', 'Schwer besiegt') },
  { id: 'daily-3', family: 'daily', goal: 3, name: n('3 days in a row', '3 Tage in Folge') },
  { id: 'daily-7', family: 'daily', goal: 7, name: n('7 days in a row', '7 Tage in Folge') },
  { id: 'daily-30', family: 'daily', goal: 30, name: n('30 days in a row', '30 Tage in Folge') },
];
const byId = new Map(BADGES.map((b) => [b.id, b]));
/**
 * The level a finished game was won at, or null: only a game in play mode against the computer, won by the side the computer is not on.
 * `state` is game.getState(), `over` its game over (the status, with `winner`), `mode` game.mode.
 */
export function winLevel(state, over, mode) {
  if (mode !== 'play' || !state || !state.vsComputer || !over || !over.winner || over.winner === state.computerColor) return null;
  return LEVELS.includes(state.level) ? state.level : null;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateOf = (ms) => {
  const d = new Date(ms);
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const count = (fn, fallback = 0) => { try { const v = fn(); return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback; } catch (e) { return fallback; } };

/**
 * sources: { puzzles: () => gold stations, openings: () => ({ learned, total }), daily: () => ({ best }) }; each may be missing (counts 0).
 * `now` is a function returning ms.
 */
export function createBadges({ storage = null, sources = {}, now = Date.now, key = STORE_KEY } = {}) {
  const listeners = [], changeListeners = [];
  let earned = {}, wins = {}, writable = true;

  function parse(raw) {
    const out = { earned: {}, wins: {} };
    if (raw && typeof raw === 'object' && raw.v === VERSION) {
      for (const [id, d] of Object.entries(raw.earned && typeof raw.earned === 'object' ? raw.earned : {})) if (byId.has(id) && typeof d === 'string' && DATE_RE.test(d)) out.earned[id] = d;
      for (const [lv, d] of Object.entries(raw.wins && typeof raw.wins === 'object' ? raw.wins : {})) if (LEVELS.includes(lv) && typeof d === 'string' && DATE_RE.test(d)) out.wins[lv] = d;
    }
    return out;
  }
  try {
    const raw = storage && JSON.parse(storage.getItem(key));
    if (raw && Number.isInteger(raw.v) && raw.v > VERSION) writable = false;
    ({ earned, wins } = parse(raw));
  } catch (e) { /* missing, blocked or unreadable: starts empty */ }

  function save() {
    if (!writable) return;
    try { storage?.setItem(key, JSON.stringify({ v: VERSION, earned, wins })); } catch (e) { /* storage may be blocked or full */ }
  }
  const changed = () => changeListeners.forEach((fn) => { try { fn(); } catch (e) { /* a listener must not stop the others */ } });

  // the counter of each family: how far the player is now
  const openings = () => { try { const o = sources.openings?.() || {}; return { learned: count(() => o.learned), total: count(() => o.total) }; } catch (e) { return { learned: 0, total: 0 }; } };
  function value(b) {
    if (b.family === 'puzzles') return count(() => sources.puzzles?.());
    if (b.family === 'openings') return openings().learned;
    if (b.family === 'daily') return count(() => sources.daily?.().best);
    return wins[b.level] ? 1 : 0;
  }
  function goalOf(b) {
    if (b.goal !== 'all') return b.goal;
    return Math.max(1, openings().total);   // every line; never 0, so an empty list does not give the badge for nothing
  }
  const reached = (b) => value(b) >= goalOf(b);

  function award(id, silent) {
    if (earned[id]) return false;
    earned[id] = dateOf(now());
    save();
    if (!silent) listeners.forEach((fn) => { try { fn(id, byId.get(id)); } catch (e) { /* a listener must not stop the others */ } });
    return true;
  }

  return {
    /** The earned badges: { id: 'YYYY-MM-DD' }. */
    earned: () => ({ ...earned }),
    has: (id) => !!earned[id],
    wins: () => ({ ...wins }),
    /**
     * One family: { family, earned, total, value, items: [{ id, goal, earned, date, left }] }. `value` is the counter (puzzles solved,
     * openings learned, best daily streak, wins), `left` how much is missing for that badge (0 once earned).
     */
    progress(family) {
      const list = BADGES.filter((b) => b.family === family);
      const items = list.map((b) => {
        const g = goalOf(b), v = value(b);
        return { id: b.id, goal: g, earned: !!earned[b.id], date: earned[b.id] || null, left: earned[b.id] ? 0 : Math.max(0, g - v) };
      });
      const v = family === 'wins' ? Object.keys(wins).length : family === 'openings' ? openings().learned : value(list[0] || {});
      return { family, earned: items.filter((i) => i.earned).length, total: items.length, value: v, max: family === 'openings' ? openings().total : family === 'wins' ? LEVELS.length : null, items };
    },
    /** Looks at the sources and earns what is reached. `silent` earns without the onEarn call (the first look on load). Returns the new ids. */
    evaluate({ silent = false } = {}) {
      const fresh = BADGES.filter((b) => !earned[b.id] && reached(b)).map((b) => b.id);
      for (const id of fresh) award(id, silent);
      changed();   // the counters may have moved even when nothing new was earned: the panel redraws its progress lines
      return fresh;
    },
    /** The player beat the computer at this level (the first time counts). Returns true when it was new. */
    recordWin(level) {
      if (!LEVELS.includes(level) || wins[level]) return false;
      wins[level] = dateOf(now());
      save();
      this.evaluate();
      return true;
    },
    /** Earns one badge now, whatever the sources say (tests). Returns true when it was new. */
    earn(id) {
      if (!byId.has(id) || !award(id, false)) return false;
      changed();
      return true;
    },
    onEarn(fn) { listeners.push(fn); },
    /** Called after every evaluate, import and reset: something the panel shows may have changed. */
    onChange(fn) { changeListeners.push(fn); },
    exportData: () => ({ v: VERSION, earned: { ...earned }, wins: { ...wins } }),
    importData(raw) {
      if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return false;
      ({ earned, wins } = parse(raw)); writable = true;
      save();
      changed();
      return true;
    },
    reset() { earned = {}; wins = {}; writable = true; save(); changed(); },
  };
}
