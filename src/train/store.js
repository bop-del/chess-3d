// The repertoire and the cards, in one versioned record under localStorage 'chess3d.train'.
//
// A card is a position before one of the player's own moves (key = positionKey4), not a line's property: lines that
// pass through the same position share it, so practising one raises the bar of every opening through it. Cards are
// never deleted and a level never changes by removing a line: removal only drops the line id from the repertoire and
// from the cards, and a card with no line left is dormant. Dormancy is not stored, it is "no line ids" (dueKeys
// filters on it). Re-adopting wakes the cards where they were.
//
// Record: { version, ever, adopted: [id], cards: { key: { level, best, due, lines: [id] } } }
import { LINES } from '../openings/lines.js';
import { addDE, t } from '../i18n.js';
import { next, dueAt } from './ladder.js';
import { positionKeys, isOwn } from './planner.js';

export const VERSION = 1;
export const STORAGE_KEY = 'chess3d.train';

addDE({
  'train.import.json': 'Diese Datei ist kein gültiges JSON.',
  'train.import.shape': 'Diese Datei ist keine Sicherung deiner Eröffnungen.',
  'train.import.version': 'Diese Sicherung stammt aus einer neueren Version des Spiels.',
  'train.import.adopted': 'Die Liste der Eröffnungen in der Datei ist ungültig.',
  'train.import.unknownLine': 'Die Datei nennt eine Eröffnung, die es hier nicht gibt: {id}',
  'train.import.card': 'Eine Karte in der Datei ist beschädigt: {key}',
});

// Older records are brought up to VERSION here, one step per version. Returns null when it cannot.
function migrate(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isInteger(rec.version) || rec.version < 1) return null;
  if (rec.version > VERSION) return null;
  // while (rec.version < VERSION) { rec = STEPS[rec.version](rec); }   // no older versions exist yet
  return rec;
}

const empty = () => ({ version: VERSION, ever: false, adopted: [], cards: {} });

export function createStore({ storage = globalThis.localStorage, now = Date.now, lines = LINES } = {}) {
  const listeners = [];
  const byId = new Map(lines.map((l) => [l.id, l]));
  // own move index: key -> [{ id, san }] over all lines, to derive the accepted siblings of a card
  const index = new Map();
  for (const line of lines) {
    const keys = positionKeys(line);
    line.moves.forEach((m, i) => {
      if (!isOwn(line, i)) return;
      if (!index.has(keys[i])) index.set(keys[i], []);
      index.get(keys[i]).push({ id: line.id, san: m.san });
    });
  }
  const ownKeys = (line) => positionKeys(line).filter((_, i) => isOwn(line, i));

  let rec = empty();
  let writable = true;   // false when the stored record is from a newer version: never overwrite it
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = sanitize(JSON.parse(raw));
      if (parsed.ok) rec = parsed.rec;
      else if (parsed.code === 'version') writable = false;
    }
  } catch (e) { /* unreadable or blocked storage: start empty, keep working in memory */ }

  function save() {
    if (!writable) return;
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch (e) { /* storage full or blocked */ }
  }
  function changed() { save(); listeners.forEach((fn) => fn()); }

  // Validate a parsed record (storage or import). Returns { ok, rec } or { ok: false, code, detail }.
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, code: 'shape' };
    if (Number.isInteger(raw.version) && raw.version > VERSION) return { ok: false, code: 'version' };
    const m = migrate(raw);
    if (!m) return { ok: false, code: 'shape' };
    if (!Array.isArray(m.adopted) || m.adopted.some((id) => typeof id !== 'string')) return { ok: false, code: 'adopted' };
    for (const id of m.adopted) if (!byId.has(id)) return { ok: false, code: 'unknownLine', detail: { id } };
    if (!m.cards || typeof m.cards !== 'object' || Array.isArray(m.cards)) return { ok: false, code: 'shape' };
    const adopted = [...new Set(m.adopted)];
    const cards = {};
    for (const [key, c] of Object.entries(m.cards)) {
      const ok = c && typeof c === 'object' && Number.isInteger(c.level) && c.level >= 1 && c.level <= 8
        && Number.isInteger(c.best) && c.best >= 0 && c.best <= 8 && Number.isFinite(c.due) && Array.isArray(c.lines)
        && c.lines.every((id) => typeof id === 'string');
      if (!ok) return { ok: false, code: 'card', detail: { key: key.slice(0, 40) } };
      cards[key] = { level: c.level, best: Math.max(c.best, 0), due: c.due, lines: c.lines.filter((id) => adopted.includes(id)) };
    }
    return { ok: true, rec: { version: VERSION, ever: !!m.ever || adopted.length > 0, adopted, cards } };
  }

  function ensureCards(id) {
    const line = byId.get(id);
    for (const key of ownKeys(line)) {
      const c = rec.cards[key] || (rec.cards[key] = { level: 1, best: 0, due: now(), lines: [] });
      if (!c.lines.includes(id)) c.lines.push(id);
    }
  }
  ensureConsistent();
  function ensureConsistent() { for (const id of rec.adopted) ensureCards(id); }

  // The own moves a card accepts: the siblings of the adopted lines through it, or of all lines when it is dormant.
  function sansOf(key, lineIds) {
    const all = index.get(key) || [];
    const use = lineIds.length ? all.filter((e) => lineIds.includes(e.id)) : all;
    return [...new Set(use.map((e) => e.san))];
  }
  const view = (key) => {
    const c = rec.cards[key];
    return c ? { key, sans: sansOf(key, c.lines), lines: [...c.lines], level: c.level, best: c.best, due: c.due } : null;
  };

  return {
    VERSION,
    adopted: () => [...rec.adopted],
    isAdopted: (id) => rec.adopted.includes(id),
    everAdopted: () => rec.ever,

    adopt(id) {
      if (!byId.has(id) || rec.adopted.includes(id)) return;
      rec.adopted.push(id);
      rec.ever = true;
      ensureCards(id);
      changed();
    },

    remove(id) {
      if (!rec.adopted.includes(id)) return;
      rec.adopted = rec.adopted.filter((x) => x !== id);
      for (const c of Object.values(rec.cards)) c.lines = c.lines.filter((x) => x !== id);
      changed();
    },

    // The cards on the line's own moves, in line order, dormant ones included.
    cardsOf(id) {
      const line = byId.get(id);
      return line ? ownKeys(line).map(view).filter(Boolean) : [];
    },
    card: view,

    // A scheduled answer. Practise never calls this.
    answer(key, ok) {
      const c = rec.cards[key];
      if (!c) return;
      c.level = next(c.level, ok);
      c.best = Math.max(c.best, c.level);
      c.due = dueAt(c.level, now());
      changed();
    },

    // The Mine bar: how much of the line can be played, the mean of best level over its cards, 0 to 1.
    progress(id) {
      const line = byId.get(id);
      if (!line) return 0;
      const keys = ownKeys(line);
      if (!keys.length) return 0;
      return keys.reduce((s, k) => s + (rec.cards[k] ? rec.cards[k].best : 0) / 8, 0) / keys.length;
    },

    dueKeys(at = now()) {
      return Object.keys(rec.cards).filter((k) => rec.cards[k].lines.length > 0 && rec.cards[k].due <= at);
    },

    exportJSON() { return JSON.stringify(rec, null, 2); },

    importJSON(text) {
      let raw;
      try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: t('train.import.json', 'This file is not valid JSON.') }; }
      const r = sanitize(raw);
      if (!r.ok) {
        const msg = {
          shape: ['train.import.shape', 'This file is not a backup of your openings.'],
          version: ['train.import.version', 'This backup comes from a newer version of the game.'],
          adopted: ['train.import.adopted', 'The list of openings in this file is not valid.'],
          unknownLine: ['train.import.unknownLine', 'The file names an opening this game does not have: {id}'],
          card: ['train.import.card', 'A card in this file is damaged: {key}'],
        }[r.code];
        return { ok: false, error: t(msg[0], msg[1], r.detail) };
      }
      rec = r.rec;
      writable = true;
      ensureConsistent();
      changed();
      return { ok: true };
    },

    onChange(fn) { listeners.push(fn); },
  };
}
