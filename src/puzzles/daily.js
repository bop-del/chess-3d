// The daily puzzle: one puzzle per calendar day, the same for everyone, and a streak per device. Pure: no DOM, no rules engine.
// No server, no account, no network: the puzzle is derived from the date alone (the player's local calendar date, so the new
// puzzle and the streak day start at local midnight; players in different time zones may differ), the streak lives in localStorage (anything with getItem and setItem, may be missing or throw: then it
// lives in memory for the session, like src/puzzles/progress.js).
//
// Which puzzle: the whole set (all levels) sorted by id, so the order is the same on every device. The days are counted from
// the epoch; a block of N days (N = number of puzzles) walks through the sorted list in steps of a stride that is coprime
// with N, so no puzzle comes twice inside a block, and the offset and stride of each block come from a hash of the block
// number, so the order looks shuffled and still needs nothing but the date.
//
// Streak: a day is done when the daily puzzle is solved, clean ('g') or after misses or Help ('s'), both count. streak(today)
// is the run of consecutive done days ending today, or ending yesterday while today is still open. A missed day resets it.
//
// Store (chess3d.daily, version 1): { v: 1, days: { 'YYYY-MM-DD': 'g' | 's' }, best }. A record of a newer version is read as
// empty and never written over.
export const STORE_KEY = 'chess3d.daily';
export const VERSION = 1;

const DAY_MS = 86400000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since the epoch of a 'YYYY-MM-DD' (UTC), null when it is not a real date. */
export function dayNumber(dateStr) {
  const m = DATE_RE.exec(String(dateStr));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return Math.round(ms / DAY_MS);
}
/** 'YYYY-MM-DD' of a day number. */
export const dateOfDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** The key of today (the local calendar date of `now`): `now` is a function returning ms, `override` a 'YYYY-MM-DD' (the ?daily= flag), ignored when it is not a real date. */
export function todayKey(now = Date.now, override = null) {
  if (override && dayNumber(override) !== null) return override;
  const d = new Date(now());
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// FNV-1a over a string, 32 bit
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** The daily puzzle of a date: the same puzzle for the same date on every device. */
export function dailyIndex(dateStr, puzzles) {
  const list = [...puzzles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = list.length;
  if (!n) return null;
  const day = dayNumber(dateStr);
  if (day === null) return list[hash(String(dateStr)) % n];   // not a date: still stable, never a crash
  const block = Math.floor(day / n), pos = day - block * n;
  const h = hash(`chess3d-daily-${block}`);
  let stride = 1 + (h >>> 8) % Math.max(1, n - 1);
  while (n > 1 && gcd(stride, n) !== 1) stride = stride % (n - 1) + 1;
  return list[(h + pos * stride) % n];
}

export function createDaily({ storage = null, puzzles, now = Date.now, override = null, key = STORE_KEY }) {
  const listeners = [];
  let days = {}, best = 0, writable = true;

  function parse(raw) {
    const out = { days: {}, best: 0 };
    if (raw && typeof raw === 'object' && raw.v === VERSION && raw.days && typeof raw.days === 'object') {
      for (const [d, m] of Object.entries(raw.days)) if (dayNumber(d) !== null && (m === 'g' || m === 's')) out.days[d] = m;
      out.best = Number.isInteger(raw.best) && raw.best > 0 ? raw.best : 0;
    }
    return out;
  }
  try {
    const raw = storage && JSON.parse(storage.getItem(key));
    if (raw && Number.isInteger(raw.v) && raw.v > VERSION) writable = false;
    ({ days, best } = parse(raw));
  } catch (e) { /* missing, blocked or unreadable: starts empty */ }

  function save() {
    if (!writable) return;
    try { storage?.setItem(key, JSON.stringify({ v: VERSION, days, best })); } catch (e) { /* storage may be blocked or full */ }
  }
  const emit = () => listeners.forEach((fn) => fn());
  const today = () => todayKey(now, override);

  function runEndingAt(day) {
    let n = 0;
    while (days[dateOfDay(day - n)]) n++;
    return n;
  }
  function streakOf(dateStr) {
    const d = dayNumber(dateStr);
    if (d === null) return 0;
    return days[dateStr] ? runEndingAt(d) : runEndingAt(d - 1);   // today still open: yesterday's run is alive
  }

  return {
    today,
    /** The puzzle of today. */
    puzzle: () => dailyIndex(today(), puzzles),
    /** 'g', 's' or null: how today was solved. */
    done: () => days[today()] || null,
    streak: (dateStr = today()) => streakOf(dateStr),
    best: () => Math.max(best, streakOf(today())),
    /** The daily puzzle was solved: clean means no miss and no Help. Only today's own record is written. */
    finish(clean) {
      const d = today();
      days[d] = clean || days[d] === 'g' ? 'g' : 's';
      best = Math.max(best, streakOf(d));
      save();
      emit();
    },
    onChange(fn) { listeners.push(fn); },
    exportData() { return { v: VERSION, days: { ...days }, best: Math.max(best, streakOf(today())) }; },
    importData(raw) {
      if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return false;
      ({ days, best } = parse(raw)); writable = true;
      save();
      emit();
      return true;
    },
    reset() {
      days = {}; best = 0; writable = true;
      save();
      emit();
    },
  };
}
