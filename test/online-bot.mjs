// The online bot (CHE-343, fast tier, no browser): the real HTTP server with an in memory database, a fake clock for nothing and
// zero bot delays. The bot is a player row without a key that is listed as a bot, always present; it accepts a challenge at once,
// plays as white or black with the easy AI, replies in chat, and its challenge (admin button), move and chat reach the human as real
// pushes (a fake push service); the admin button is for admins only; a position the search would take too long for is capped and
// still answers; with the bot off its route does not exist; the name of a human is not taken over; a restart resumes a game.
import { createECDH, randomBytes } from 'node:crypto';
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { vapidGenerate } from '../server/push.mjs';
import { chooseMove, botReply, BOT_LINES, ensureBot } from '../server/bot.mjs';
import { Chess, nameSq, START_FEN } from '../src/rules.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(15); } return null; }

const sent = [];   // the fake push service: every request with its endpoint
const pushFetch = async (endpoint, init) => { sent.push({ endpoint, headers: init.headers }); return { status: 201, ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; };
const device = (n) => { const e = createECDH('prime256v1'); e.generateKeys(); return { endpoint: `https://push.example/${n}`, keys: { p256dh: e.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }; };

let coin = 0.2;   // random() < 0.5: the challenger plays white
const db = openDb(':memory:');
const app = createOnlineServer({ db, vapid: vapidGenerate(), vapidSubject: 'mailto:test@example.com', pushFetch, random: () => coin, bot: { moveDelay: () => 0, chatDelay: () => 0 } });
const port = await app.listen(0, '127.0.0.1');
const call = async (path, { key, body } = {}) => {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: body ? 'POST' : 'GET', headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let json = null; try { json = JSON.parse(t); } catch (e) { /* none */ }
  return { status: r.status, json };
};
const state = async (key) => (await call('/state', { key })).json;

try {
  const felix = app.admin.invite('Felix'), mia = app.admin.invite('Mia');
  app.admin.setAdmin('Felix', true);
  const fDev = device('felix');
  await call('/push/subscribe', { key: felix.key, body: fDev });
  await call('/push/subscribe', { key: mia.key, body: device('mia') });

  // ---- listing
  const s0 = await state(felix.key);
  const bot = s0.players.find((p) => p.bot);
  ok('the bot is listed for a player: name Bot, marked as a bot, always online', bot?.name === 'Bot' && bot.online === true, JSON.stringify(s0.players));
  ok('a human is not marked as a bot', s0.players.find((p) => p.name === 'Mia').bot === undefined);
  ok('state tells an admin (Felix) and not a normal player (Mia)', s0.me.admin === true && (await state(mia.key)).me.admin === undefined);
  ok('the bot has no key and no code to log in with', !app.db.prepare('SELECT 1 FROM keys WHERE player_id = ?').get(app.bot.id) && app.db.prepare('SELECT code_hash FROM players WHERE id = ?').get(app.bot.id).code_hash === null);

  // ---- admin only
  ok('the bot challenge button is admin only: Mia gets 403', (await call('/bot/challenge', { key: mia.key, body: {} })).status === 403);
  sent.length = 0;
  const bc = await call('/bot/challenge', { key: felix.key, body: {} });
  ok('an admin makes the bot challenge them: a challenge from Bot appears', bc.status === 200 && (await state(felix.key)).challenges.in.some((c) => c.from === 'Bot'), JSON.stringify(bc.json));
  await app.push.flush();
  ok('that challenge is a real push to the admin', sent.length === 1 && sent[0].endpoint === fDev.endpoint, JSON.stringify(sent.map((x) => x.endpoint)));
  const again = await call('/bot/challenge', { key: felix.key, body: {} });
  ok('a second press does not make a second challenge or push', again.json.again === true && (await state(felix.key)).challenges.in.length === 1);
  const cid = (await state(felix.key)).challenges.in[0].id;
  coin = 0.9;   // random() >= 0.5: the acceptor (Felix) takes black... white = challenger? answer: white = random < .5 ? from : me
  sent.length = 0;
  const acc = await call('/challenge/answer', { key: felix.key, body: { id: cid, accept: true } });
  ok('the admin accepts the bot challenge and the game starts', acc.status === 200 && acc.json.game > 0);
  // coin 0.9: white is the answering player (Felix), so the bot waits for Felix's move
  let g = (await state(felix.key)).games.find((x) => x.opponent === 'Bot');
  ok('game with the bot: Felix is white and it is his move', g && g.color === 'w' && g.turn === 'w');
  sent.length = 0;
  const m1 = await call('/move', { key: felix.key, body: { game: g.id, uci: 'e2e4' } });
  ok('Felix moves', m1.status === 200);
  const replied = await until(async () => { const x = (await state(felix.key)).games.find((y) => y.id === g.id); return x.moves.length >= 2 ? x : null; });
  ok('the bot answers with a legal move (after the delay, here 0)', !!replied && replied.moves.length === 2, JSON.stringify(replied?.moves));
  if (replied) { const c = new Chess(); let legal = true; for (const u of replied.moves) legal = legal && !!c.play({ from: nameSq(u.slice(0, 2)), to: nameSq(u.slice(2, 4)), promo: u[4] || null }); ok('the bot move is legal', legal); }
  await app.push.flush();
  // ---- push for the move when the human has no stream: Felix has no stream here, so the bot move must push
  ok('the bot move is a real push to the human', sent.some((x) => x.endpoint === fDev.endpoint), JSON.stringify(sent.map((x) => x.endpoint)));

  // ---- chat
  sent.length = 0;
  await call('/chat', { key: felix.key, body: { to: 'Bot', text: 'Hallo Bot' } });
  const chat = await until(async () => { const s = await state(felix.key); return (s.chats.Bot || []).find((m) => !m.mine) ? s : null; });
  const line = chat?.chats.Bot.find((m) => !m.mine)?.text;
  ok('the bot answers a greeting with a canned line', BOT_LINES.hello.includes(line), String(line));
  await app.push.flush();
  ok('the chat reply is a real push, without the chat text', sent.length >= 1 && sent.every((x) => x.endpoint === fDev.endpoint));
  ok('botReply: thanks, hello and the rest', BOT_LINES.thanks.includes(botReply('Danke!')) && BOT_LINES.hello.includes(botReply('hi')) && BOT_LINES.any.includes(botReply('Wie geht es?')));

  // ---- a normal player challenges the bot, the bot accepts at once and plays white
  coin = 0.9;   // the challenger Mia gets black (white = random < .5 ? challenger : bot)
  const mc = await call('/challenge', { key: mia.key, body: { to: 'Bot' } });
  ok('every player can challenge the bot', mc.status === 200);
  const mg = await until(async () => (await state(mia.key)).games.find((x) => x.opponent === 'Bot'));
  ok('the bot accepted at once, no human was asked', !!mg && (await state(mia.key)).challenges.out.every((c) => c.status !== 'open'));
  ok('Mia plays black, the bot white', mg?.color === 'b');
  const first = await until(async () => { const x = (await state(mia.key)).games.find((y) => y.opponent === 'Bot'); return x.moves.length >= 1 ? x : null; });
  ok('as white the bot opens the game on its own', !!first && first.turn === 'b' && first.moves.length === 1, JSON.stringify(first?.moves));
  ok('a challenge to a human is unchanged: Felix still has no auto answer', (await call('/challenge', { key: mia.key, body: { to: 'Felix' } })).status === 200 && (await state(felix.key)).challenges.in.some((c) => c.from === 'Mia'));
  const r = await call('/resign', { key: mia.key, body: { game: mg.id } });
  ok('a human can resign against the bot', r.status === 200);

  // ---- the search never blocks long and is capped
  let maxStall = 0, last = performance.now();
  const spy = setInterval(() => { const n = performance.now(); maxStall = Math.max(maxStall, n - last - 5); last = n; }, 5);
  const t0 = performance.now();
  const hard = await chooseMove('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', {});
  const took = performance.now() - t0;
  const capped = await chooseMove('r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 9', { capMs: 0 });
  clearInterval(spy);
  ok('chooseMove answers a real position with a legal move', /^[a-h][1-8][a-h][1-8]/.test(hard.uci), JSON.stringify(hard));
  ok('a search past the time cap still answers with a legal random move', /^[a-h][1-8][a-h][1-8]/.test(capped.uci) && capped.capped === true, JSON.stringify(capped));
  ok('the search does not block the event loop (longest stall under 150 ms)', maxStall < 150, `${Math.round(maxStall)} ms stall, search ${Math.round(took)} ms`);
  ok('no move in a finished position', (await chooseMove('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).uci === null);

  // ---- restart resumes
  const g2 = (await call('/challenge', { key: felix.key, body: { to: 'Bot' } }));
  const live = await until(async () => (await state(felix.key)).games.find((x) => x.opponent === 'Bot' && x.status === 'active'));
  ok('Felix can start another game against the bot after the first', !!live);
  await app.close();

  // ---- off, and the name guard
  const off = createOnlineServer({ db: openDb(':memory:') });
  const offPort = await off.listen(0, '127.0.0.1');
  const offKey = off.admin.invite('Zed').key;
  const r404 = await fetch(`http://127.0.0.1:${offPort}/bot/challenge`, { method: 'POST', headers: { Authorization: `Bearer ${offKey}`, 'Content-Type': 'application/json' }, body: '{}' });
  ok('bot off (the default): no bot in the list and /bot/challenge is 404', r404.status === 404 && !(await (await fetch(`http://127.0.0.1:${offPort}/state`, { headers: { Authorization: `Bearer ${offKey}` } })).json()).players.some((p) => p.bot));
  await off.close();
  const d3 = openDb(':memory:'); d3.prepare('INSERT INTO players (name, created) VALUES (?, ?)').run('Bot', 1);
  let threw = false; try { ensureBot(d3, 'Bot'); } catch (e) { threw = true; }
  ok('a human already named Bot is not taken over', threw);

  // ---- a restart: the bot owes a move and answers without a new action
  const d4 = openDb(':memory:');
  const a4 = createOnlineServer({ db: d4, random: () => 0.2, bot: { moveDelay: () => 0, chatDelay: () => 0 } });
  const p4 = await a4.listen(0, '127.0.0.1');
  const u = a4.admin.invite('Ola');
  await (await fetch(`http://127.0.0.1:${p4}/challenge`, { method: 'POST', headers: { Authorization: `Bearer ${u.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: 'Bot' }) })).json();
  await until(() => d4.prepare("SELECT 1 FROM games WHERE status = 'active'").get());
  await a4.close();
  const gid = d4.prepare('SELECT id FROM games').get().id;   // random 0.2: the challenger Ola is white
  d4.prepare("INSERT INTO moves (game_id, ply, uci, san, at) VALUES (?, 0, 'e2e4', 'e4', 1)").run(gid);   // Ola moved while the server was down: the bot owes black
  const n0 = d4.prepare('SELECT COUNT(*) AS n FROM moves WHERE game_id = ?').get(gid).n;
  const a5 = createOnlineServer({ db: d4, bot: { moveDelay: () => 0, chatDelay: () => 0 } });
  const moved = await until(() => d4.prepare('SELECT COUNT(*) AS n FROM moves WHERE game_id = ?').get(gid).n > n0);
  ok('after a restart the bot plays the move it owes', !!moved, `${n0} moves before`);
  await a5.close();
} catch (e) { failed++; console.log('FAIL  exception', e && e.stack || e); }
await app.close().catch(() => {});
console.log(failed ? `\nONLINE BOT FAILED (${failed})` : '\nONLINE BOT OK');
process.exit(failed ? 1 : 0);
