// The online play server (CHE-271): node:http, node:sqlite, no dependency. The server is the only truth: it validates every move
// with the game's own rules engine (src/rules.js), keeps games, scores and chat, and pushes the new state to everyone it concerns.
// HTTP API (JSON, Authorization: Bearer <key> except /up and /login-code): see server/README.md.
// Run: npm run server (ONLINE_PORT, ONLINE_DB, ONLINE_ORIGINS, ONLINE_ENV; server/README.md). Tests import createOnlineServer().
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { Chess, nameSq } from '../src/rules.js';
import { openDb, sha256, normCode, adminOps, newKey, newCode } from './db.mjs';
import { createLive } from './live.mjs';
import { createHealth, healthVerdict, serverSection, systemProbe, SAMPLE_MS } from './health.mjs';
import { createPush, overLine, vapidLoad } from './push.mjs';
import { statsFor } from './playerstats.mjs';
import { createBot, BOT_NAME } from './bot.mjs';
import { createAuthSpike } from './auth-spike.mjs';
import { createFeedback, cleanFeedback, BODY_MAX as FEEDBACK_BODY_MAX } from './feedback.mjs';
import { createStats, EVENTS_BODY_MAX, loginPage, dashboardPage, secretOk } from './stats.mjs';

export const STALE_MS = 3 * 24 * 3600 * 1000;   // a game with no move for 3 days: the waiting player may end it as a win
export const CHAT_MAX = 200;
const BODY_MAX = 4096;
const LIMITS = { move: [60, 60e3], chat: [10, 60e3], other: [30, 60e3], login: [5, 10 * 60e3], events: [10, 60e3], mycode: [5, 10 * 60e3] };   // [count, window ms]

/** Is this browser origin allowed? A list from ONLINE_ORIGINS, else the local preview origins (localhost, 127.0.0.1, the Tailscale range). */
export function originAllowed(origin, list) {
  if (!origin) return false;
  if (list?.length) return list.includes(origin);
  try {
    const u = new URL(origin);
    const h = u.hostname;
    return u.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1' || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(h) || /\.ts\.net$/.test(h));
  } catch (e) { return false; }
}

export function createOnlineServer({ db = openDb(':memory:'), now = () => Date.now(), origins = [], heartbeatMs = 20000, sampleMs = SAMPLE_MS, firstSampleMs = 10000, probe, dbFile = '', trustProxy = false, adminSecret = '', vapid = null, vapidSubject = '', gameUrl = '', authSpike = {}, pushFetch, log = () => {}, random = Math.random, bot: botOpts = null } = {}) {
  const admin = adminOps(db, now);
  const spike = createAuthSpike({ origins, originOk: (o) => originAllowed(o, origins), ...authSpike });   // CHE-341: a spike, off without a client id
  const stats = createStats(db, { now });
  const feedback = createFeedback(db, { now });   // CHE-404
  const health = createHealth(db, { now, probe: probe || systemProbe({ dbFile: dbFile || ':memory:' }), gauges: {
    present: () => live.ids().length, streams: () => live.streamCount(), games: () => q("SELECT COUNT(*) AS n FROM games WHERE status = 'active'").get().n,
  } });   // CHE-306: the server history; the gauges read live, which is created below
  stats.maintain(); health.prune();   // CHE-291: roll up and clean on start, then once a day
  const statsTimer = setInterval(() => { try { stats.maintain(); health.prune(); } catch (e) { console.error(e); } }, 24 * 3600 * 1000);
  statsTimer.unref();
  const sampleSafe = () => { try { health.sample(); } catch (e) { console.error(e); } };
  const sampleTimer = setInterval(sampleSafe, sampleMs), firstTimer = setTimeout(sampleSafe, firstSampleMs);   // CHE-306: one row per 5 minutes, one soon after start
  sampleTimer.unref(); firstTimer.unref();
  const q = (sql) => db.prepare(sql);
  const push = createPush(db, { vapid, subject: vapidSubject, gameUrl, now, log, ...(pushFetch ? { fetchFn: pushFetch } : {}) });   // CHE-272: off without a VAPID key
  const playerById = (id) => q('SELECT * FROM players WHERE id = ?').get(id);
  const playerByName = (name) => q('SELECT * FROM players WHERE name = ?').get(String(name));
  const authKey = (key) => {
    if (!key) return null;
    const row = q('SELECT p.* FROM keys k JOIN players p ON p.id = k.player_id WHERE k.key_hash = ?').get(sha256(key));
    return row && !row.revoked ? row : null;
  };
  // CHE-335: any number of games per player, one active game per pair
  const activeGames = (pid) => q("SELECT * FROM games WHERE status = 'active' AND (white_id = ? OR black_id = ?) ORDER BY id DESC").all(pid, pid);
  const activeGameWith = (a, b) => q("SELECT * FROM games WHERE status = 'active' AND ((white_id = ? AND black_id = ?) OR (white_id = ? AND black_id = ?)) ORDER BY id DESC LIMIT 1").get(a, b, b, a);
  const lastGame = (pid) => q('SELECT * FROM games WHERE white_id = ? OR black_id = ? ORDER BY id DESC LIMIT 1').get(pid, pid);
  const movesOf = (gid) => q('SELECT uci, san FROM moves WHERE game_id = ? ORDER BY ply').all(gid);

  // ------------------------------------------------------------ rate limits (in memory, per key or per IP)
  const hits = new Map();
  function limited(bucket, id, count = true) {
    const [max, win] = LIMITS[bucket];
    const k = `${bucket}:${id}`, t = now();
    const list = (hits.get(k) || []).filter((x) => t - x < win);
    if (list.length >= max) { hits.set(k, list); return true; }
    if (count) list.push(t);
    hits.set(k, list);
    return false;
  }
  const loginBlocked = (ip) => limited('login', ip, false);
  const loginFailed = (ip) => limited('login', ip, true);

  // ------------------------------------------------------------ state
  function scoreTable(pid) {
    const by = new Map();
    for (const g of q("SELECT * FROM games WHERE status = 'over' AND (white_id = ? OR black_id = ?)").all(pid, pid)) {
      const other = g.white_id === pid ? g.black_id : g.white_id;
      const s = by.get(other) || { w: 0, l: 0, d: 0 };
      if (!g.winner_id) s.d++; else if (g.winner_id === pid) s.w++; else s.l++;
      by.set(other, s);
    }
    return by;
  }
  function gameJson(g, pid) {
    const mv = movesOf(g.id);
    const color = g.white_id === pid ? 'w' : 'b';
    const opp = playerById(color === 'w' ? g.black_id : g.white_id);
    const turn = mv.length % 2 ? 'b' : 'w';
    const winner = g.winner_id ? (g.winner_id === g.white_id ? 'w' : 'b') : null;
    return {
      id: g.id, color, opponent: opp?.name || '?', white: playerById(g.white_id)?.name || '?', black: playerById(g.black_id)?.name || '?',
      moves: mv.map((m) => m.uci), sans: mv.map((m) => m.san), turn, status: g.status, result: g.result, reason: g.reason, winner,
      lastMoveAt: g.last_move_at, staleAt: g.last_move_at + STALE_MS,
      canFinish: g.status === 'active' && turn !== color && now() >= g.last_move_at + STALE_MS,
    };
  }
  function stateFor(pid) {
    const me = playerById(pid);
    if (!me || me.revoked) return null;
    const score = scoreTable(pid);
    const mineAll = activeGames(pid);
    const players = q('SELECT * FROM players WHERE id != ? AND revoked = 0 ORDER BY name COLLATE NOCASE').all(pid).map((p) => {
      const s = score.get(p.id) || { w: 0, l: 0, d: 0 };
      return {
        name: p.name, online: live.online(p.id) || !!p.bot, ...(p.bot ? { bot: true } : {}),   // CHE-343: the bot is always there
        playing: activeGames(p.id).some((x) => x.white_id !== pid && x.black_id !== pid),   // deprecated for the v1.10 client: in a game with someone else, blocks nothing now
        withMe: !!activeGameWith(pid, p.id),
        score: s, played: s.w + s.l + s.d,
        unread: q('SELECT COUNT(*) AS n FROM messages WHERE from_id = ? AND to_id = ? AND read = 0').get(p.id, pid).n,
      };
    });
    const cin = q("SELECT c.id, c.created AS at, p.name AS from_name FROM challenges c JOIN players p ON p.id = c.from_id WHERE c.to_id = ? AND c.status = 'open' ORDER BY c.id").all(pid)
      .map((c) => ({ id: c.id, from: c.from_name, at: c.at }));
    // every open challenge out, plus the last one to each player when that one was declined (so the answer can be acknowledged)
    const out = q('SELECT c.*, p.name AS to_name FROM challenges c JOIN players p ON p.id = c.to_id WHERE c.from_id = ? ORDER BY c.id').all(pid)
      .filter((c, _, all) => c.status === 'open' || (c.status === 'declined' && !all.some((d) => d.to_id === c.to_id && d.id > c.id)))
      .map((c) => ({ id: c.id, to: c.to_name, status: c.status, at: c.created }));
    const g = mineAll[0] || lastGame(pid);
    const recent = q("SELECT * FROM games WHERE status = 'over' AND ended >= ? AND (white_id = ? OR black_id = ?) ORDER BY id DESC LIMIT 5").all(now() - 7 * 24 * 3600 * 1000, pid, pid);
    const games = [...mineAll, ...recent].map((x) => gameJson(x, pid));
    const chats = {}, unread = {};
    for (const p of players) {
      const other = playerByName(p.name);
      const rows = q(`SELECT * FROM (SELECT m.id, m.from_id, m.text, m.at FROM messages m WHERE (m.from_id = ? AND m.to_id = ?) OR (m.from_id = ? AND m.to_id = ?) ORDER BY m.id DESC LIMIT 50) ORDER BY id`)
        .all(pid, other.id, other.id, pid);
      if (rows.length) chats[p.name] = rows.map((r) => ({ id: r.id, from: r.from_id === pid ? me.name : p.name, mine: r.from_id === pid, text: r.text, at: r.at }));
      if (p.unread) unread[p.name] = p.unread;
    }
    return {
      me: { name: me.name, muted: !!me.muted, ...(me.admin ? { admin: true } : {}) }, now: now(), players, challenges: { in: cin, out },
      games, game: g ? gameJson(g, pid) : null,   // game: deprecated, the newest active game else the last one (the v1.10 client reads it)
      chats, unread,
    };
  }

  // ------------------------------------------------------------ live
  const live = createLive({
    heartbeatMs,
    onPresence: () => { health.touch(); broadcast(); },
    onStream: () => health.touch(),
    onBeat: () => { for (const id of live.ids()) { const p = playerById(id); if (!p || p.revoked) live.drop(id); } },
  });
  /** CHE-272: the web push of one action, after it is committed. Never a chat text, only the sender name. A live stream suppresses it. */
  function pushAfter(name, me, body, out) {
    if (!push.enabled) return;
    const to = (pid, kind, o) => push.notify(pid, kind, { streamOpen: live.online(pid), ...o });
    const overTo = (g) => {
      const row = q('SELECT * FROM games WHERE id = ?').get(g.id);
      for (const pid of [row.white_id, row.black_id]) {
        const from = playerById(pid === row.white_id ? row.black_id : row.white_id).name;
        to(pid, 'over', { from, line: overLine(from, row.winner_id === pid, !row.winner_id), tag: `over:${row.id}`, query: '?open=online', data: { with: from, game: row.id } });
      }
    };
    if (name === 'bot/challenge' && !out.again) {   // CHE-343: the bot asks the admin
      to(me.id, 'challenge', { from: botName, tag: `challenge:${botName}`, query: '?open=online', data: { with: botName } });
    } else if (name === 'challenge' && !out.again) {
      const other = playerByName(body.to);
      to(other.id, 'challenge', { from: me.name, tag: `challenge:${me.name}`, query: '?open=online', data: { with: me.name } });
    } else if (name === 'challenge/answer' && out.game) {
      const g = q('SELECT * FROM games WHERE id = ?').get(out.game);
      const from = g.white_id === me.id ? g.black_id : g.white_id;
      to(from, 'accepted', { from: me.name, tag: `accepted:${me.name}`, query: '?open=online', data: { with: me.name, game: g.id } });
    } else if (name === 'move' || name === 'resign' || name === 'finish-stale') {
      const g = q('SELECT * FROM games WHERE id = ?').get(Number(body.game));
      if (g.status === 'over') overTo(g);
      else {
        const next = g.white_id === me.id ? g.black_id : g.white_id;
        to(next, 'turn', { from: me.name, tag: `turn:${g.id}`, query: `?open=online&with=${encodeURIComponent(me.name)}`, data: { with: me.name, game: g.id } });
      }
    } else if (name === 'chat') {
      const other = playerByName(body.to);
      to(other.id, 'chat', { from: me.name, tag: `chat:${me.name}`, query: `?open=online&with=${encodeURIComponent(me.name)}`, data: { with: me.name } });
    }
  }
  function broadcast() { for (const id of live.ids()) { const s = stateFor(id); if (s) live.send(id, 'state', s); else live.drop(id); } }

  // ------------------------------------------------------------ actions
  class Fail extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
  const fail = (status, code) => { throw new Fail(status, code); };
  const replay = (gid) => {
    const c = new Chess();
    for (const m of movesOf(gid)) c.play({ from: nameSq(m.uci.slice(0, 2)), to: nameSq(m.uci.slice(2, 4)), promo: m.uci[4] || null });
    return c;
  };
  function endGame(g, { result, reason, winnerId }) {
    q("UPDATE games SET status = 'over', result = ?, reason = ?, winner_id = ?, ended = ? WHERE id = ?").run(result, reason, winnerId ?? null, now(), g.id);
  }
  const myGame = (me, gid) => {
    const g = q('SELECT * FROM games WHERE id = ?').get(Number(gid));
    if (!g || (g.white_id !== me.id && g.black_id !== me.id)) fail(404, 'no-game');
    if (g.status !== 'active') fail(409, 'game-over');
    return g;
  };

  const ACTIONS = {
    challenge(me, { to }) {
      const other = playerByName(to);
      if (!other || other.revoked || other.id === me.id) fail(404, 'unknown-player');
      if (activeGameWith(me.id, other.id)) fail(409, 'you-are-playing');   // one game per pair, either way round
      const open = q("SELECT id FROM challenges WHERE from_id = ? AND to_id = ? AND status = 'open'").get(me.id, other.id);
      if (open) return { id: open.id, again: true };   // already asked: the same challenge, no second push
      const r = q("INSERT INTO challenges (from_id, to_id, status, created) VALUES (?, ?, 'open', ?)").run(me.id, other.id, now());
      return { id: Number(r.lastInsertRowid) };
    },
    'bot/challenge'(me) {   // CHE-343: the bot challenges the calling admin (a button in the Online tab)
      if (!me.admin) fail(403, 'admin-only');
      const b = playerById(bot.id);
      if (activeGameWith(me.id, b.id)) fail(409, 'you-are-playing');
      const open = q("SELECT id FROM challenges WHERE from_id = ? AND to_id = ? AND status = 'open'").get(b.id, me.id);
      if (open) return { id: open.id, again: true };
      const r = q("INSERT INTO challenges (from_id, to_id, status, created) VALUES (?, ?, 'open', ?)").run(b.id, me.id, now());
      return { id: Number(r.lastInsertRowid) };
    },
    'challenge/answer'(me, { id, accept }) {
      const c = q("SELECT * FROM challenges WHERE id = ? AND to_id = ? AND status = 'open'").get(Number(id), me.id);
      if (!c) fail(404, 'no-challenge');
      if (!accept) { q("UPDATE challenges SET status = 'declined', answered = ? WHERE id = ?").run(now(), c.id); return { declined: true }; }
      if (activeGameWith(me.id, c.from_id)) fail(409, 'you-are-playing');
      const white = random() < 0.5 ? c.from_id : me.id, black = white === me.id ? c.from_id : me.id;   // colours drawn at random
      const r = q("INSERT INTO games (white_id, black_id, status, created, last_move_at) VALUES (?, ?, 'active', ?, ?)").run(white, black, now(), now());
      q("UPDATE challenges SET status = 'accepted', answered = ? WHERE id = ?").run(now(), c.id);
      // a second game against the same person is not possible: only the open challenge the other way round is void, all others stay
      q("UPDATE challenges SET status = 'cancelled', answered = ? WHERE status = 'open' AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))").run(now(), me.id, c.from_id, c.from_id, me.id);
      return { game: Number(r.lastInsertRowid) };
    },
    'challenge/cancel'(me, { id }) {   // the challenger withdraws an open challenge (only their own; none open is fine, so a retry is harmless)
      const r = id == null
        ? q("UPDATE challenges SET status = 'cancelled', answered = ? WHERE from_id = ? AND status = 'open'").run(now(), me.id)
        : q("UPDATE challenges SET status = 'cancelled', answered = ? WHERE id = ? AND from_id = ? AND status = 'open'").run(now(), Number(id), me.id);
      return { cancelled: Number(r.changes) };
    },
    move(me, { game, uci }) {
      const g = myGame(me, game);
      if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) fail(400, 'illegal');
      const c = replay(g.id);
      const color = g.white_id === me.id ? 'w' : 'b';
      if (c.turn !== color) fail(409, 'not-your-turn');
      const m = c.play({ from: nameSq(uci.slice(0, 2)), to: nameSq(uci.slice(2, 4)), promo: uci[4] || null });
      if (!m) fail(400, 'illegal');
      const ply = c.history.length - 1;
      q('INSERT INTO moves (game_id, ply, uci, san, at) VALUES (?, ?, ?, ?, ?)').run(g.id, ply, uci, m.san, now());
      q('UPDATE games SET last_move_at = ? WHERE id = ?').run(now(), g.id);
      const st = c.status();   // checkmate and the draws by rule: stalemate, threefold repetition, 50 moves, insufficient material
      if (st.over) endGame(g, { result: st.result, reason: st.reason, winnerId: st.winner ? (st.winner === 'w' ? g.white_id : g.black_id) : null });
      return { ply, san: m.san, over: st.over ? st.reason : null };
    },
    resign(me, { game }) {
      const g = myGame(me, game);
      const winnerId = g.white_id === me.id ? g.black_id : g.white_id;
      endGame(g, { result: winnerId === g.white_id ? '1-0' : '0-1', reason: 'resign', winnerId });
      return { over: 'resign' };
    },
    'finish-stale'(me, { game }) {
      const g = myGame(me, game);
      const color = g.white_id === me.id ? 'w' : 'b';
      const turn = movesOf(g.id).length % 2 ? 'b' : 'w';
      if (turn === color) fail(409, 'your-turn');
      if (now() < g.last_move_at + STALE_MS) fail(409, 'too-early');
      endGame(g, { result: color === 'w' ? '1-0' : '0-1', reason: 'stale', winnerId: me.id });
      return { over: 'stale' };
    },
    chat(me, { to, text }) {
      if (me.muted) fail(403, 'muted');
      const other = playerByName(to);
      if (!other || other.revoked || other.id === me.id) fail(404, 'unknown-player');
      const t = String(text ?? '').replace(/\s+/g, ' ').trim();
      if (!t) fail(400, 'empty');
      if ([...t].length > CHAT_MAX) fail(400, 'too-long');
      const r = q('INSERT INTO messages (from_id, to_id, text, at) VALUES (?, ?, ?, ?)').run(me.id, other.id, t, now());
      return { id: Number(r.lastInsertRowid) };
    },
    'chat/read'(me, body) {
      const other = playerByName(body.with);
      if (!other) fail(404, 'unknown-player');
      q('UPDATE messages SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0').run(other.id, me.id);
      return { read: true };
    },
  };

  /** one action in one transaction (a retried POST with the same cid is answered above, before this) */
  function runAction(name, me, body, cid) {
    let out;
    db.exec('BEGIN IMMEDIATE');
    try {
      out = { ok: true, ...ACTIONS[name](me, body) };
      if (cid) q('INSERT INTO actions (player_id, cid, response, at) VALUES (?, ?, ?, ?)').run(me.id, cid, JSON.stringify(out), now());
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return out;
  }
  /** after the commit: the live update, the web push, the bot's turn to react */
  function settle(name, me, body, out) {
    health.touch();
    broadcast();
    try { pushAfter(name, me, body, out); } catch (e) { console.error(e); }
    try { bot?.after(name, me, body, out); } catch (e) { console.error(e); }
  }

  // ------------------------------------------------------------ http
  function cors(req) {
    const o = req.headers.origin;
    return originAllowed(o, origins) ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600' } : {};
  }
  function send(req, res, status, body) {
    const h = { ...cors(req), 'Cache-Control': 'no-store' };
    if (body === undefined) { res.writeHead(status, h); res.end(); return; }
    res.writeHead(status, { ...h, 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }
  const readBody = (req, max = BODY_MAX, parse = JSON.parse) => new Promise((ok, bad) => {
    let size = 0; const parts = [];
    req.on('data', (d) => { size += d.length; if (size > 16 * max) req.destroy(); else if (size <= max) parts.push(d); });   // drained up to 16 times the cap so the 413 reaches the client
    req.on('end', () => { if (size > max) return bad(new Fail(413, 'too-large')); try { const s = Buffer.concat(parts).toString('utf8'); ok(s ? parse(s) : {}); } catch (e) { bad(new Fail(400, 'bad-json')); } });
    req.on('error', bad);
  });
  const ipOf = (req) => (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';

  async function handle(req, res) {
    const path = new URL(req.url, 'http://x').pathname;
    let status = 200, counted = true;
    try {
      if (req.method === 'OPTIONS') { status = 204; return send(req, res, 204); }
      if (req.method === 'GET' && path === '/up') { status = 200; res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); return res.end('ok'); }
      if (spike.enabled && path === '/auth-spike') { await spike.handle(req, res, path, readBody); status = res.statusCode; return; }   // CHE-341 spike, no key, no database
      if ((req.method === 'GET' || req.method === 'HEAD') && path === '/health') {   // CHE-307: for an external monitor, public, derived from server_health
        counted = false;
        const v = healthVerdict(db, { now: now() });
        status = v.ok ? 200 : 503;
        res.writeHead(status, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? undefined : v.ok ? 'ok' : v.reasons.join(', '));
      }
      if (req.method === 'POST' && path === '/login-code') {
        const ip = ipOf(req);
        if (loginBlocked(ip)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
        const body = await readBody(req);
        const p = body.code ? q('SELECT * FROM players WHERE code_hash = ? AND revoked = 0').get(sha256(normCode(body.code))) : null;
        if (!p) { loginFailed(ip); status = 401; return send(req, res, 401, { error: 'wrong-code' }); }
        // the code gives a new device key (the link key on another device stays valid; keys are stored only as hashes)
        const key = newKey();
        q('INSERT INTO keys (key_hash, player_id, created) VALUES (?, ?, ?)').run(sha256(key), p.id, now());
        return send(req, res, 200, { key, name: p.name });
      }
      if (path === '/stats') {   // CHE-291: the dashboard, only with the admin secret (header, or a form post; never in a URL or a log)
        if (!adminSecret) { status = 404; return send(req, res, 404); }
        if (req.method !== 'GET' && req.method !== 'POST') { status = 405; return send(req, res, 405); }
        const ip = ipOf(req);
        if (loginBlocked(ip)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
        const html = (code, body) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); res.end(body); };
        const h = String(req.headers.authorization || '');
        let given = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
        if (!given && req.method === 'POST') given = String((await readBody(req, 1024, (t) => Object.fromEntries(new URLSearchParams(t)))).secret || '');
        if (!given) { status = 401; return html(401, loginPage(false)); }
        if (!secretOk(given, adminSecret)) { loginFailed(ip); status = 401; return html(401, loginPage(true)); }
        return html(200, dashboardPage(stats.report(7), stats.report(30), serverSection(health, { now: now() })));
      }
      if (path === '/feedback') {   // CHE-404: POST from anyone (no login needed), GET only with the admin secret
        const ip = ipOf(req);
        if (req.method === 'POST') {
          const body = await readBody(req, FEEDBACK_BODY_MAX);
          const dev = typeof body?.device === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.device) ? body.device : `ip:${ip}`;
          const c = cleanFeedback(body);   // a refused body does not count against the limit
          if (c.error) { status = c.status; return send(req, res, c.status, { error: c.error }); }
          if (feedback.limited(dev, ip)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
          const h0 = String(req.headers.authorization || '');
          const who = h0.startsWith('Bearer ') ? authKey(h0.slice(7).trim()) : null;
          const id = feedback.add(c.row, who && !who.revoked ? who.name : '');
          status = 201; return send(req, res, 201, { ok: true, id });
        }
        if (req.method !== 'GET') { status = 405; return send(req, res, 405); }
        if (!adminSecret) { status = 404; return send(req, res, 404); }
        if (loginBlocked(ip)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
        const h1 = String(req.headers.authorization || '');
        const given = h1.startsWith('Bearer ') ? h1.slice(7).trim() : '';
        if (!given || !secretOk(given, adminSecret)) { loginFailed(ip); status = 401; return send(req, res, 401); }
        return send(req, res, 200, { items: feedback.since(new URL(req.url, 'http://x').searchParams.get('since')) });
      }
      const auth = String(req.headers.authorization || '');
      const me = authKey(auth.startsWith('Bearer ') ? auth.slice(7).trim() : '');
      const known = ['/state', '/events', '/my-code', ...Object.keys(ACTIONS).filter((a) => bot || a !== 'bot/challenge').map((a) => '/' + a), ...(push.enabled ? ['/push/key', '/push/subscribe', '/push/unsubscribe'] : [])];   // push off: its routes do not exist (404)
      const playerPath = req.method === 'GET' && path.startsWith('/player/');   // CHE-290
      if (!known.includes(path) && !playerPath) { status = 404; return send(req, res, 404); }
      if (!me) { status = 401; return send(req, res, 401); }   // an unknown key gets 401 and nothing else
      if (req.method === 'POST' && path === '/events') {   // CHE-291: usage events of a logged in player
        if (limited('events', me.id)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
        const out = stats.ingest(me.id, await readBody(req, EVENTS_BODY_MAX));
        if (out.error) { status = out.status; return send(req, res, out.status, { error: out.error }); }
        status = 202; return send(req, res, 202, { ok: true, n: out.n });
      }
      if (path === '/my-code') {   // CHE-272: a fresh login code for the calling player; the old code stops working, keys stay valid. The code is never logged.
        if (req.method !== 'POST') { status = 405; return send(req, res, 405); }
        if (limited('mycode', me.id)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
        const code = newCode(me.name);
        q('UPDATE players SET code_hash = ? WHERE id = ?').run(sha256(code), me.id);
        return send(req, res, 200, { ok: true, code });
      }
      if (path.startsWith('/push/')) {   // CHE-272
        if (path === '/push/key') { if (req.method !== 'GET') { status = 405; return send(req, res, 405); } return send(req, res, 200, { key: push.publicKey() }); }
        if (req.method !== 'POST') { status = 405; return send(req, res, 405); }
        if (limited('other', me.id)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
        const body = await readBody(req);
        if (path === '/push/subscribe') { const err = push.subscribe(me.id, body); if (err) { status = 400; return send(req, res, 400, { error: err }); } }
        else push.unsubscribe(me.id, body.endpoint);
        return send(req, res, 200, { ok: true });
      }
      if (playerPath) {   // CHE-290: the numbers of one player and your head to head with them; unknown, revoked or deleted: 404
        let name = ''; try { name = decodeURIComponent(path.slice('/player/'.length)); } catch (e) { /* bad escape: no such player */ }
        const p = name && playerByName(name);
        if (!p || p.revoked) { status = 404; return send(req, res, 404, { error: 'unknown-player' }); }
        const own = p.id === me.id;
        return send(req, res, 200, { name: p.name, own, ...statsFor(db, p.id, { vs: own ? null : me.id }) });
      }
      if (req.method === 'GET' && path === '/state') return send(req, res, 200, stateFor(me.id));
      if (req.method === 'GET' && path === '/events') { live.open(req, res, me.id, stateFor(me.id), cors(req)); return; }
      if (req.method !== 'POST') { status = 405; return send(req, res, 405); }
      const name = path.slice(1);
      const body = await readBody(req);
      if (limited(name === 'move' ? 'move' : name === 'chat' ? 'chat' : 'other', me.id)) { status = 429; return send(req, res, 429, { error: 'slow-down' }); }
      const cid = typeof body.cid === 'string' && body.cid.length <= 64 ? body.cid : null;
      if (cid) {
        const done = q('SELECT response FROM actions WHERE player_id = ? AND cid = ?').get(me.id, cid);
        if (done) return send(req, res, 200, JSON.parse(done.response));   // a retried POST is applied once
      }
      const out = runAction(name, me, body, cid);
      send(req, res, 200, out);
      settle(name, me, body, out);
    } catch (e) {
      if (e instanceof Fail) { status = e.status; if (!res.headersSent) send(req, res, e.status, { error: e.code }); }
      else { status = 500; console.error(e); if (!res.headersSent) send(req, res, 500, { error: 'server' }); }
    } finally {
      if (counted) health.request(status);
      log(`${req.method} ${path} ${status}`);   // never the Authorization header, never a body
    }
  }

  // CHE-343: the bot acts through the server's own path, as a player row without a key
  const botName = botOpts?.name || BOT_NAME;
  const bot = botOpts ? createBot(db, { now, log, random: botOpts.random || Math.random, ...botOpts, name: botName, act: (name, body) => {
    const me = db.prepare('SELECT * FROM players WHERE name = ?').get(botName), out = runAction(name, me, body, null);
    settle(name, me, body, out);
    return out;
  } }) : null;
  bot?.resume();

  const server = createServer((req, res) => { handle(req, res); });
  server.keepAliveTimeout = 65000;
  return {
    server, db, admin, live, stats, feedback, health, push, bot, stateFor, broadcast,
    listen: (port, host) => new Promise((ok) => server.listen(port, host, () => ok(server.address().port))),
    close: () => new Promise((ok) => { push.flush().catch(() => {}); bot?.close(); clearInterval(statsTimer); clearInterval(sampleTimer); clearTimeout(firstTimer); health.stop(); live.close(); server.closeAllConnections?.(); server.close(() => ok()); }),
  };
}

// ------------------------------------------------------------ run as a program: npm run server
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function loadEnv() {
  const f = process.env.ONLINE_ENV;
  if (f) { if (!existsSync(f)) throw new Error(`ONLINE_ENV file not found: ${f}`); process.loadEnvFile(f); }
  return {
    port: Number(process.env.ONLINE_PORT || process.env.PORT || 5502),
    host: process.env.ONLINE_HOST || '0.0.0.0',
    db: process.env.ONLINE_DB || resolve(ROOT, '.tmp/online/online.db'),
    origins: (process.env.ONLINE_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: process.env.ONLINE_TRUST_PROXY === '1',
    adminSecret: process.env.ONLINE_ADMIN_SECRET || '',
    vapidFile: process.env.ONLINE_VAPID_FILE || '',   // CHE-272: no file, no push
    vapidSubject: process.env.ONLINE_VAPID_SUBJECT || '',
    gameUrl: process.env.ONLINE_GAME_URL || '',
    bot: process.env.ONLINE_BOT === '1' ? { name: process.env.ONLINE_BOT_NAME || BOT_NAME } : null,   // CHE-343: the bot, on in the env file of the test and the production server
    authSpike: { clientId: process.env.AUTH_SPIKE_CLIENT_ID || '', returnUrl: process.env.AUTH_SPIKE_RETURN || '' },   // CHE-341
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = loadEnv();
  const vapid = vapidLoad(env.vapidFile);
  if (!vapid || !/^(mailto:|https:)/.test(env.vapidSubject)) console.log(`push is off (${vapid ? 'ONLINE_VAPID_SUBJECT is not a mailto: or https: address' : 'no ONLINE_VAPID_FILE'})`);
  const app = createOnlineServer({ db: openDb(env.db), dbFile: env.db, origins: env.origins, trustProxy: env.trustProxy, adminSecret: env.adminSecret, vapid, vapidSubject: env.vapidSubject, gameUrl: env.gameUrl, authSpike: env.authSpike, bot: env.bot, log: (l) => console.log(`${new Date().toISOString()} ${l}`) });
  const port = await app.listen(env.port, env.host);
  console.log(`online server on http://${env.host}:${port} (db ${env.db})`);
  const stop = () => { app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
