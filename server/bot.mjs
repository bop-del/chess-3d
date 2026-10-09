// The online bot (CHE-343): a player row that every player can challenge, for testing on the local server and on production. It takes
// no part in login (no key, no code). It accepts a challenge at once, moves 2 to 5 s after the human with the easy AI of the client
// (src/ai.js, no second engine), answers chat with short canned lines, and acts through the same actions as a human, so moves,
// challenges and chat trigger the same live updates and web pushes. The move search runs in slices on the event loop (never blocks
// it) and is capped in time; past the cap a random legal move is played. On when createOnlineServer gets `bot` (env ONLINE_BOT=1).
import { Chess, nameSq, sqName } from '../src/rules.js';
import { searchMove } from '../src/ai.js';

export const BOT_NAME = 'Bot';
export const BOT_LEVEL = 'easy';
export const THINK_CAP_MS = 2000;   // past this the search stops and a random legal move is played
const SLICE_MS = 10;                // one slice of the search per event loop turn
export const BOT_LINES = {
  hello: ['Hallo! Viel Spaß bei der Partie.', 'Hi! Ich bin bereit.', 'Hallo du!'],
  thanks: ['Gern geschehen!', 'Kein Problem.'],
  any: ['Hmm, mal sehen.', 'Gute Partie bisher!', 'Ich denke nach...', 'Schach macht Spaß.', 'Ich bin nur ein Bot, aber ich gebe mein Bestes.', 'Interessant!'],
};
const HELLO = /\b(hallo|hi|hey|moin|servus|guten (tag|morgen|abend))\b/i, THANKS = /\b(danke|thx|thanks)\b/i;

/** the canned answer to a chat text */
export function botReply(text, random = Math.random) {
  const list = HELLO.test(text) ? BOT_LINES.hello : THANKS.test(text) ? BOT_LINES.thanks : BOT_LINES.any;
  return list[Math.floor(random() * list.length)];
}

/** make sure the bot row exists; a human who already has the name stops the start */
export function ensureBot(db, name, now = Date.now()) {
  const p = db.prepare('SELECT * FROM players WHERE name = ?').get(name);
  if (p && !p.bot) throw new Error(`the name ${name} belongs to a player, not the bot`);
  if (!p) db.prepare('INSERT OR IGNORE INTO players (name, created, bot) VALUES (?, ?, 1)').run(name, now);
  return db.prepare('SELECT * FROM players WHERE name = ?').get(name);
}

/** Pick a move for the position, searching in slices. Resolves { uci } (null when there is no legal move). */
export function chooseMove(fen, { random = Math.random, capMs = THINK_CAP_MS, level = BOT_LEVEL } = {}) {
  return new Promise((ok) => {
    const ch = new Chess(fen), legal = ch.moves();
    const uci = (m) => sqName(m.from) + sqName(m.to) + (m.promo || '');
    if (!legal.length) return ok({ uci: null });
    const gen = searchMove(fen, 2, undefined, { level, random });
    const t0 = performance.now();
    const step = () => {
      try {
        const slice = performance.now();
        while (performance.now() - slice < SLICE_MS) {
          const r = gen.next();
          if (r.done) return ok({ uci: r.value.move ? uci(r.value.move) : uci(legal[0]) });
          if (performance.now() - t0 > capMs) break;
        }
        if (performance.now() - t0 > capMs) return ok({ uci: uci(legal[Math.floor(random() * legal.length)]), capped: true });
      } catch (e) { return ok({ uci: uci(legal[0]) }); }
      setImmediate(step);
    };
    setImmediate(step);
  });
}

/** The bot of one server. act(name, body) runs an action as the bot (the server's own path: commit, live update, push). */
export function createBot(db, { name = BOT_NAME, now = () => Date.now(), random = Math.random, act, moveDelay = () => 2000 + random() * 3000,
  chatDelay = () => 1000 + random() * 2000, capMs = THINK_CAP_MS, log = () => {} } = {}) {
  const row = ensureBot(db, name, now());
  const q = (sql) => db.prepare(sql);
  const timers = new Set(), thinking = new Set();
  let closed = false, paused = false;   // CHE-406: paused while another server holds the writer lease
  const later = (ms, fn) => {
    const t = setTimeout(() => { timers.delete(t); if (!closed && !paused) Promise.resolve().then(fn).catch((e) => log(`bot error ${e.message}`)); }, ms);
    t.unref?.(); timers.add(t);
  };
  const movesOf = (gid) => q('SELECT uci FROM moves WHERE game_id = ? ORDER BY ply').all(gid).map((m) => m.uci);
  const replay = (gid) => {
    const c = new Chess();
    for (const uci of movesOf(gid)) c.play({ from: nameSq(uci.slice(0, 2)), to: nameSq(uci.slice(2, 4)), promo: uci[4] || null });
    return c;
  };
  async function move(gid) {
    const g = q("SELECT * FROM games WHERE id = ? AND status = 'active'").get(gid);
    if (!g || (g.white_id !== row.id && g.black_id !== row.id)) return;
    const c = replay(gid);
    if (c.turn !== (g.white_id === row.id ? 'w' : 'b')) return;
    const { uci } = await chooseMove(c.fen(), { random, capMs });
    if (!uci || closed || paused) return;
    const again = q("SELECT status FROM games WHERE id = ?").get(gid);   // the game may have ended while the bot was thinking
    if (again?.status !== 'active' || movesOf(gid).length !== c.history.length) return;
    act('move', { game: gid, uci });
  }
  function scheduleMove(gid) {
    if (thinking.has(gid)) return;
    thinking.add(gid);
    later(moveDelay(), () => move(gid).finally(() => thinking.delete(gid)));
  }
  function answerOpen() {   // accept every open challenge to the bot (at once; also after a restart)
    for (const c of q("SELECT id FROM challenges WHERE to_id = ? AND status = 'open' ORDER BY id").all(row.id)) {
      try { act('challenge/answer', { id: c.id, accept: true }); } catch (e) { log(`bot cannot accept ${c.id}: ${e.code || e.message}`); }
    }
  }
  const owedMoves = () => { for (const g of q("SELECT id FROM games WHERE status = 'active' AND (white_id = ? OR black_id = ?)").all(row.id, row.id)) scheduleMove(g.id); };
  return {
    id: row.id, name: row.name, enabled: true,
    /** after any action of a human or of the bot (called by the server once it is committed) */
    after(action, me, body, out) {
      if (closed || paused) return;
      if (action === 'challenge' && me.id !== row.id && String(body.to).toLowerCase() === row.name.toLowerCase()) later(0, answerOpen);
      else if (action === 'challenge/answer' && out.game) scheduleMove(out.game);   // checked in move(): only when it is the bot's turn
      else if (action === 'move' && me.id !== row.id) scheduleMove(Number(body.game));
      else if (action === 'chat' && me.id !== row.id && String(body.to).toLowerCase() === row.name.toLowerCase()) {
        later(chatDelay(), () => { try { act('chat', { to: me.name, text: botReply(String(body.text || ''), random) }); } catch (e) { log(`bot chat failed: ${e.code || e.message}`); } });
      }
    },
    /** after a start: open challenges and games where the bot owes a move */
    resume() { paused = false; answerOpen(); owedMoves(); },
    /** the writer lease went to another server: no timers, no reactions */
    pause() { paused = true; for (const t of timers) clearTimeout(t); timers.clear(); thinking.clear(); },
    close() { closed = true; for (const t of timers) clearTimeout(t); timers.clear(); },
  };
}
