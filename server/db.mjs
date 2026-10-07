// The online play database (CHE-271): node:sqlite, no dependency. Players with their invite (keys and the code stored only as
// sha256), challenges, games, moves, chat messages and the client ids of applied actions (a retried POST is applied once).
// Everything is kept forever for now (owner decision 11). openDb(':memory:') serves the tests.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
export const newKey = () => randomBytes(32).toString('base64url');
// codes: NAME-XXXX, four characters from an alphabet without 0, O, 1 and I (easy to read aloud and to type on a phone)
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const codeName = (name) => String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12) || 'PLAYER';
export const newCode = (name) => `${codeName(name)}-${Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')}`;
/** what a typed code is compared as: upper case, no spaces, a missing dash tolerated */
export function normCode(s) {
  const c = String(s || '').toUpperCase().replace(/\s+/g, '');
  const m = c.match(/^([A-Z]+)-?([A-Z2-9]{4})$/);
  return m ? `${m[1]}-${m[2]}` : c;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, code_hash TEXT, revoked INTEGER NOT NULL DEFAULT 0, muted INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS keys (key_hash TEXT PRIMARY KEY, player_id INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS challenges (id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, answered INTEGER);
CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY, white_id INTEGER NOT NULL, black_id INTEGER NOT NULL, status TEXT NOT NULL, result TEXT, reason TEXT, winner_id INTEGER, created INTEGER NOT NULL, last_move_at INTEGER NOT NULL, ended INTEGER);
CREATE TABLE IF NOT EXISTS moves (game_id INTEGER NOT NULL, ply INTEGER NOT NULL, uci TEXT NOT NULL, san TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (game_id, ply));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS actions (player_id INTEGER NOT NULL, cid TEXT NOT NULL, response TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (player_id, cid));
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, device TEXT NOT NULL, value INTEGER, data TEXT);
CREATE TABLE IF NOT EXISTS stats_daily (day TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, device TEXT NOT NULL, n INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (day, kind, name, device));
CREATE TABLE IF NOT EXISTS server_health (at INTEGER PRIMARY KEY, started INTEGER NOT NULL, uptime_s INTEGER NOT NULL, present_max INTEGER NOT NULL, streams_max INTEGER NOT NULL, games_max INTEGER NOT NULL, loop_max_ms REAL NOT NULL, rss_max INTEGER NOT NULL, req INTEGER NOT NULL, r4xx INTEGER NOT NULL, r5xx INTEGER NOT NULL, load1 REAL NOT NULL, load5 REAL NOT NULL, load15 REAL NOT NULL, mem_free INTEGER NOT NULL, mem_total INTEGER NOT NULL, disk_free INTEGER, disk_total INTEGER, db_bytes INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS events_day ON events (day);
CREATE INDEX IF NOT EXISTS games_white ON games (white_id);
CREATE INDEX IF NOT EXISTS games_black ON games (black_id);
CREATE INDEX IF NOT EXISTS messages_pair ON messages (from_id, to_id);
`;

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  return db;
}

/** The admin side of the data (server/admin.mjs and the tests): invites, revoke, delete, mute, chat dump. */
export function adminOps(db, now = () => Date.now()) {
  const byName = (name) => db.prepare('SELECT * FROM players WHERE name = ?').get(String(name));
  function issue(p) {
    const key = newKey(), code = newCode(p.name);
    db.prepare('DELETE FROM keys WHERE player_id = ?').run(p.id);
    db.prepare('INSERT INTO keys (key_hash, player_id, created) VALUES (?, ?, ?)').run(sha256(key), p.id, now());
    db.prepare('UPDATE players SET code_hash = ?, revoked = 0 WHERE id = ?').run(sha256(code), p.id);
    return { name: p.name, key, code };
  }
  return {
    byName,
    /** a new player (or, with fresh, a fresh key and code for an existing one: the old ones stop working) */
    invite(name, { fresh = false } = {}) {
      name = String(name || '').trim();
      if (!name || name.length > 24) throw new Error('a name of 1 to 24 characters is needed');
      let p = byName(name);
      if (p && !fresh) throw new Error(`${p.name} is invited already; use --new for a fresh link and code`);
      if (!p) { db.prepare('INSERT INTO players (name, created) VALUES (?, ?)').run(name, now()); p = byName(name); }
      return issue(p);
    },
    revoke(name) {
      const p = byName(name); if (!p) throw new Error(`no player ${name}`);
      db.prepare('UPDATE players SET revoked = 1, code_hash = NULL WHERE id = ?').run(p.id);
      db.prepare('DELETE FROM keys WHERE player_id = ?').run(p.id);
      return p.name;
    },
    delete(name) {
      const p = byName(name); if (!p) throw new Error(`no player ${name}`);
      const games = db.prepare('SELECT id FROM games WHERE white_id = ? OR black_id = ?').all(p.id, p.id);
      for (const g of games) db.prepare('DELETE FROM moves WHERE game_id = ?').run(g.id);
      db.prepare('DELETE FROM games WHERE white_id = ? OR black_id = ?').run(p.id, p.id);
      db.prepare('DELETE FROM challenges WHERE from_id = ? OR to_id = ?').run(p.id, p.id);
      db.prepare('DELETE FROM messages WHERE from_id = ? OR to_id = ?').run(p.id, p.id);
      db.prepare('DELETE FROM actions WHERE player_id = ?').run(p.id);
      db.prepare('DELETE FROM keys WHERE player_id = ?').run(p.id);
      db.prepare('DELETE FROM players WHERE id = ?').run(p.id);
      return p.name;
    },
    mute(name, on = true) {
      const p = byName(name); if (!p) throw new Error(`no player ${name}`);
      db.prepare('UPDATE players SET muted = ? WHERE id = ?').run(on ? 1 : 0, p.id);
      return p.name;
    },
    /** every conversation of a player, oldest first: [{ with, messages: [{ from, text, at }] }] */
    chat(name) {
      const p = byName(name); if (!p) throw new Error(`no player ${name}`);
      const rows = db.prepare(`SELECT m.*, a.name AS from_name, b.name AS to_name FROM messages m JOIN players a ON a.id = m.from_id JOIN players b ON b.id = m.to_id
        WHERE m.from_id = ? OR m.to_id = ? ORDER BY m.id`).all(p.id, p.id);
      const by = new Map();
      for (const r of rows) {
        const other = r.from_id === p.id ? r.to_name : r.from_name;
        if (!by.has(other)) by.set(other, []);
        by.get(other).push({ from: r.from_name, text: r.text, at: r.at });
      }
      return [...by].map(([w, messages]) => ({ with: w, messages }));
    },
    list() { return db.prepare('SELECT name, revoked, muted, created FROM players ORDER BY name').all(); },
  };
}
