// Messages from "Chess 3D" to one player (CHE-422): answers to Feedback. The sender is a reserved player row (system = 1) that is created
// on start and has no key and no code, so nobody can log in as it, be challenged or chat with it. A message is a row in `messages` like a
// chat line; `text` holds the German rendering (admin dumps, old clients), `meta` the JSON { tpl, params, feedbackId, quote } the client
// renders in the player's language. Free text has no tpl. The send path is POST /admin/message (server/index.mjs).
import { SYSTEM_NAME } from './db.mjs';

export const QUOTE_MAX = 80;
export const TPL_ADMIN = ['accepted', 'shipped', 'fixed'];   // 'read' is sent by the server itself when a logged in player sends Feedback
/** the German text of each template (the owner's wording); the client has de and en for the same keys */
export const TEMPLATES_DE = {
  read: () => 'Danke! Wir haben deine Nachricht bekommen und lesen sie.',
  accepted: () => 'Gute Idee! Das bauen wir ein.',
  shipped: ({ v }) => `Dein Vorschlag ist jetzt im Spiel (Version ${v}). Viel Spaß!`,
  fixed: ({ v }) => `Der Fehler, den du gemeldet hast, ist behoben (Version ${v}). Danke fürs Melden!`,
};
const NEEDS_V = ['shipped', 'fixed'];
export const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,19}$/;

/** the first 80 characters of a Feedback text on one line */
export const quoteOf = (text) => [...String(text ?? '').replace(/\s+/g, ' ').trim()].slice(0, QUOTE_MAX).join('');

/** the params of a template checked: { params } or { error } */
export function cleanTemplate(tpl, params) {
  if (!TPL_ADMIN.includes(tpl)) return { error: 'bad-template' };
  if (!NEEDS_V.includes(tpl)) return { params: {} };
  const v = params && typeof params === 'object' ? params.v : undefined;
  if (typeof v !== 'string' || !VERSION_RE.test(v)) return { error: 'bad-params' };
  return { params: { v } };
}

/** The reserved sender: created when missing; returns its row. */
export function ensureSystem(db, now = () => Date.now()) {
  const q = (sql) => db.prepare(sql);
  let p = q('SELECT * FROM players WHERE name = ?').get(SYSTEM_NAME);
  if (!p) {
    q('INSERT INTO players (name, created, system) VALUES (?, ?, 1)').run(SYSTEM_NAME, now());
    p = q('SELECT * FROM players WHERE name = ?').get(SYSTEM_NAME);
  } else if (!p.system || p.code_hash || p.revoked) {
    q('UPDATE players SET system = 1, code_hash = NULL, revoked = 0 WHERE id = ?').run(p.id);
    q('DELETE FROM keys WHERE player_id = ?').run(p.id);
    p = q('SELECT * FROM players WHERE name = ?').get(SYSTEM_NAME);
  }
  return p;
}

/** Store one message from the sender to a player. `tpl` + `params`, or `text`. Returns the message id. */
export function addSystemMessage(db, sys, toId, { tpl, params = {}, text, feedbackId, quote, now = () => Date.now() }) {
  const meta = {};
  if (tpl) { meta.tpl = tpl; meta.params = params; }
  if (feedbackId != null) meta.feedbackId = feedbackId;
  if (quote) meta.quote = quote;
  const body = tpl ? TEMPLATES_DE[tpl](params) : text;
  const r = db.prepare('INSERT INTO messages (from_id, to_id, text, at, meta) VALUES (?, ?, ?, ?, ?)')
    .run(sys.id, toId, body, now(), Object.keys(meta).length ? JSON.stringify(meta) : null);
  return Number(r.lastInsertRowid);
}
