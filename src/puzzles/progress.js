// Puzzle progress: which band the player is in, which puzzles are solved, which ones come back. Pure: no DOM, no
// rules engine, no clock. Storage is anything with getItem and setItem (localStorage in the page, a Map wrapper in
// tests) and may be missing or throw: progress then lives in memory for the session.
//
// Rules (owner and lead, see CONTEXT.md):
//   - up a band after UP_AFTER puzzles in a row solved clean, down after DOWN_AFTER in a row that were not clean
//   - a clean puzzle is solved for good, until its band is used up; a puzzle with misses or Help is "not yet": it goes
//     to the queue and comes back after at least GAP other puzzles
//   - endless: no daily limit, no streak counter shown, nothing is ever locked
export const STORE_KEY = 'chess3d.puzzles';
export const VERSION = 1;
export const UP_AFTER = 3;
export const DOWN_AFTER = 3;
export const GAP = 2;
const DEFAULT_BANDS = ['starter', 'growing', 'tricky'];

export function createPuzzleProgress({ storage = null, puzzles, bands = DEFAULT_BANDS, rand = Math.random, key = STORE_KEY }) {
  const byId = new Map(puzzles.map((p) => [p.id, p]));
  const pool = (band) => puzzles.filter((p) => p.band === band);
  const listeners = [];
  let current = null;

  const blank = () => ({ v: VERSION, band: bands[0], solved: Object.fromEntries(bands.map((b) => [b, []])), queue: [], run: { clean: 0, slip: 0 } });

  function load() {
    const s = blank();
    let raw = null;
    try { raw = storage && JSON.parse(storage.getItem(key)); } catch (e) { raw = null; }
    if (!raw || raw.v !== VERSION || typeof raw !== 'object') return s;
    if (bands.includes(raw.band)) s.band = raw.band;
    for (const b of bands) {
      const ids = raw.solved && Array.isArray(raw.solved[b]) ? raw.solved[b] : [];
      s.solved[b] = [...new Set(ids)].filter((id) => byId.get(id)?.band === b);   // ids of a rebuilt data set that are gone drop out
    }
    if (Array.isArray(raw.queue)) {
      for (const e of raw.queue) {
        if (e && byId.has(e.id) && !s.queue.some((q) => q.id === e.id)) s.queue.push({ id: e.id, wait: Math.max(0, Math.min(GAP, e.wait | 0)) });
      }
    }
    if (raw.run) s.run = { clean: Math.max(0, raw.run.clean | 0), slip: Math.max(0, raw.run.slip | 0) };
    return s;
  }
  let state = load();

  function save() {
    try { storage?.setItem(key, JSON.stringify(state)); } catch (e) { /* storage may be blocked or full */ }
  }
  const emit = () => listeners.forEach((fn) => fn(stats()));

  // The band the player is really served from: the chosen band, or the nearest one that has puzzles at all.
  function activeBand() {
    const i = bands.indexOf(state.band);
    for (let d = 0; d < bands.length; d++) {
      for (const j of [i - d, i + d]) if (j >= 0 && j < bands.length && pool(bands[j]).length) return bands[j];
    }
    return state.band;
  }

  function pick() {
    const avoid = current?.id;
    const due = state.queue.filter((e) => e.wait <= 0 && e.id !== avoid);
    if (due.length) return byId.get(due[0].id);
    const band = activeBand();
    const queued = new Set(state.queue.map((e) => e.id));
    const solved = new Set(state.solved[band]);
    let fresh = pool(band).filter((p) => !solved.has(p.id) && !queued.has(p.id) && p.id !== avoid);
    if (fresh.length) return fresh[Math.floor(rand() * fresh.length)];
    // The band is used up. Puzzles that are still "not yet" come first, then the band starts over.
    const waiting = state.queue.filter((e) => e.id !== avoid);
    if (waiting.length) return byId.get(waiting[0].id);
    state.solved[band] = [];
    fresh = pool(band).filter((p) => p.id !== avoid);
    if (!fresh.length) fresh = pool(band);
    return fresh.length ? fresh[Math.floor(rand() * fresh.length)] : null;
  }

  function stats() {
    const band = activeBand();
    return {
      band, bandIndex: bands.indexOf(band), bands,
      solved: Object.fromEntries(bands.map((b) => [b, state.solved[b].length])),
      size: Object.fromEntries(bands.map((b) => [b, pool(b).length])),
      queued: state.queue.length,
      run: { ...state.run },
    };
  }

  function move(delta) {
    const i = bands.indexOf(state.band) + delta;
    if (i < 0 || i >= bands.length) { state.run = { clean: 0, slip: 0 }; return; }
    state.band = bands[i];
    state.run = { clean: 0, slip: 0 };
  }

  return {
    band: () => activeBand(),
    stats,
    next() {
      const p = pick();
      current = p;
      save();
      emit();
      return p;
    },
    // A puzzle ended: clean means solved with no miss and no Help.
    finish(id, { clean }) {
      const p = byId.get(id);
      if (!p) return;
      for (const e of state.queue) e.wait = Math.max(0, e.wait - 1);
      if (clean) {
        state.queue = state.queue.filter((e) => e.id !== id);
        if (!state.solved[p.band].includes(id)) state.solved[p.band].push(id);
        state.run.clean += 1; state.run.slip = 0;
        if (state.run.clean >= UP_AFTER) move(+1);
      } else {
        state.queue = state.queue.filter((e) => e.id !== id);
        state.queue.push({ id, wait: GAP });
        state.run.slip += 1; state.run.clean = 0;
        if (state.run.slip >= DOWN_AFTER) move(-1);
      }
      if (current?.id === id) current = null;
      save();
      emit();
    },
    reset() {
      state = blank();
      current = null;
      save();
      emit();
    },
    onChange(fn) { listeners.push(fn); },
  };
}
