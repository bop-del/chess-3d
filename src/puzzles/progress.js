// Puzzle progress: the path. Each level (band) is a fixed order of puzzles in chapters of ten stations (src/puzzles/path.js).
// A station is gold (solved clean), silver (played, but with a miss or Help) or untouched. Pure: no DOM, no rules engine, no
// clock. Storage is anything with getItem and setItem (localStorage in the page, a Map wrapper in tests) and may be missing
// or throw: progress then lives in memory for the session.
//
// Rules (owner, 2026-10-03, see BACKLOG P2):
//   - a clean solve makes the station gold, a miss or Help makes it silver and the path moves on; replaying can make a silver
//     station gold, a gold station never goes back
//   - the next puzzle is the first untouched station of the first level that has one; a finished chapter just means the next
//     one is where the path goes on, the last chapter hands over to the next level. No automatic level change, nothing locked
//   - a chapter finished by the last solve is reported as `finished` until the player has seen it (ack(), select(), setView()
//     or another finish): the Learn tab shows the wave and the chime then, even when Next on the solved card went on first
//   - the tab can look at any chapter (view) and start any station (select), solved ones included
//
// Store (chess3d.puzzles, version 2): { v: 2, marks: { id: 'g' | 's' } }. Version 1 ({ band, solved: { band: [ids] }, queue,
// run }) is read once: the solved ids become gold stations, the rest is dropped.
import { levelOrder, chaptersOf, CHAPTER_SIZE } from './path.js';

export const STORE_KEY = 'chess3d.puzzles';
export const VERSION = 2;
const DEFAULT_BANDS = ['starter', 'growing', 'tricky'];

export function createPuzzleProgress({ storage = null, puzzles, bands = DEFAULT_BANDS, key = STORE_KEY }) {
  const byId = new Map(puzzles.map((p) => [p.id, p]));
  const order = Object.fromEntries(bands.map((b) => [b, levelOrder(puzzles, b)]));
  const chapters = Object.fromEntries(bands.map((b) => [b, chaptersOf(order[b])]));
  const listeners = [];
  let forced = null;     // a station the player tapped: served by the next next()
  let finished = null;   // { band, chapter, level } of a chapter the last solve finished
  let view = null;       // { band, chapter } the tab looks at, null: where the path is

  // Marks from a stored or imported record (version 2, or version 1 which is migrated), anything else gives none.
  function parse(raw) {
    const marks = {};
    if (raw && typeof raw === 'object') {
      if (raw.v === VERSION && raw.marks && typeof raw.marks === 'object') {
        for (const [id, m] of Object.entries(raw.marks)) if (byId.has(id) && (m === 'g' || m === 's')) marks[id] = m;   // ids of a rebuilt data set that are gone drop out
      } else if (raw.v === 1 && raw.solved && typeof raw.solved === 'object') {
        for (const b of bands) for (const id of Array.isArray(raw.solved[b]) ? raw.solved[b] : []) if (byId.get(id)?.band === b) marks[id] = 'g';
      }
    }
    return marks;
  }
  function load() {
    let raw = null;
    try { raw = storage && JSON.parse(storage.getItem(key)); } catch (e) { raw = null; }
    return parse(raw);
  }
  let marks = load();
  let writable = true;   // false when the stored record is from a newer version: never save over it
  try { const r = storage && JSON.parse(storage.getItem(key)); if (r && Number.isInteger(r.v) && r.v > VERSION) writable = false; } catch (e) { /* unreadable: treated as empty */ }

  function save() {
    if (!writable) return;
    try { storage?.setItem(key, JSON.stringify({ v: VERSION, marks })); } catch (e) { /* storage may be blocked or full */ }
  }
  const emit = () => listeners.forEach((fn) => fn(stats()));
  const marked = (p) => !!marks[p.id];

  // The level the path is in: the first with an untouched station, else the last one that has puzzles at all.
  function activeBand() {
    const open = bands.find((b) => order[b].some((p) => !marked(p)));
    if (open) return open;
    return [...bands].reverse().find((b) => order[b].length) || bands[0];
  }
  // The station the path goes on with: first untouched, else the first silver one, else the first.
  function pick() {
    const list = order[activeBand()];
    return list.find((p) => !marked(p)) || list.find((p) => marks[p.id] === 's') || list[0] || null;
  }
  const chapterOf = (p) => Math.floor(order[p.band].indexOf(p) / CHAPTER_SIZE);
  const chapterDone = (band, ch) => (chapters[band][ch] || []).every(marked);

  function station(p, i, nextId) {
    const m = marks[p.id];
    return { id: p.id, index: i, theme: p.theme, rating: p.rating, state: m === 'g' ? 'gold' : m === 's' ? 'silver' : p.id === nextId ? 'next' : 'todo' };
  }

  function stats() {
    const band = activeBand();
    const nextP = pick();
    const here = nextP ? chapterOf(nextP) : 0;
    const v = finished ? { band: finished.band, chapter: finished.chapter } : view && chapters[view.band]?.[view.chapter] ? view : { band, chapter: here };
    const list = chapters[v.band] || [];
    const nextId = v.band === band && nextP && !marked(nextP) ? nextP.id : null;
    const count = (b, s) => order[b].filter((p) => marks[p.id] === s).length;
    return {
      band, bandIndex: bands.indexOf(band), bands,
      chapter: here,                                   // where the path is (0 based)
      view: { ...v, chapters: list.length },           // what the tab shows
      chapterList: list.map((c, i) => ({ index: i, size: c.length, done: c.every(marked), gold: c.filter((p) => marks[p.id] === 'g').length, here: v.band === band && i === here })),
      stations: (list[v.chapter] || []).map((p, i) => station(p, i, nextId)),
      finished: finished ? { ...finished } : null,
      solved: Object.fromEntries(bands.map((b) => [b, count(b, 'g')])),
      queued: bands.reduce((n, b) => n + count(b, 's'), 0),   // silver stations: played, not gold yet
      size: Object.fromEntries(bands.map((b) => [b, order[b].length])),
    };
  }

  return {
    band: () => activeBand(),
    stats,
    // The puzzle to play now: the station the player tapped, else where the path goes on.
    next() {
      const p = forced && byId.get(forced) || pick();
      forced = null; view = null;   // a reported finished chapter stays until the tab has shown it (ack, select, setView, the next finish)
      emit();
      return p;
    },
    // Tap a station: the next start() plays it. False for an unknown id.
    select(id) {
      if (!byId.has(id)) return false;
      forced = id; finished = null;
      return true;
    },
    // The tab looks at a chapter (0 based) of a level; null goes back to where the path is.
    setView(band = null, chapter = 0) {
      view = band && chapters[band]?.[chapter] ? { band, chapter } : null;
      finished = null;
      emit();
    },
    // The player moved on from a finished chapter.
    ack() { if (finished) { finished = null; emit(); } },
    // A puzzle ended: clean means solved with no miss and no Help.
    finish(id, { clean }) {
      const p = byId.get(id);
      if (!p) return;
      const ch = chapterOf(p), wasDone = chapterDone(p.band, ch);
      if (clean) marks[id] = 'g';
      else if (marks[id] !== 'g') marks[id] = 's';
      forced = null; finished = null;
      if (!wasDone && chapterDone(p.band, ch)) finished = { band: p.band, chapter: ch, level: ch === chapters[p.band].length - 1 };
      view = null;
      save();
      emit();
    },
    // The Menu's Export and Import carry the path: a plain record, the same as the store.
    exportData() { return { v: VERSION, marks: { ...marks } }; },
    importData(raw) {
      if (!raw || typeof raw !== 'object' || (raw.v !== VERSION && raw.v !== 1)) return false;
      marks = parse(raw); writable = true; forced = null; finished = null; view = null;
      save();
      emit();
      return true;
    },
    reset() {
      marks = {}; writable = true; forced = null; finished = null; view = null;
      save();
      emit();
    },
    onChange(fn) { listeners.push(fn); },
  };
}
