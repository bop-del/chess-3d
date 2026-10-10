// Online play server (CHE-271, fast tier, no browser): the real HTTP server on a free port with an in memory database and a fake
// clock. Invite, link login, code login, wrong code throttle, revoke, challenge, decline, accept, legal and illegal moves (the server
// rejects the illegal one), a retried POST applied once, resign, draw by rule, the 3 day finish, score, chat length cap, mute, delete,
// the live stream and presence, /up, CORS, body cap; no key or code in any URL or log line, and the copied connection details never
// hold the key, a code or chat text.
import { createOnlineServer, STALE_MS, originAllowed } from '../server/index.mjs';
import { openDb, CODE_ALPHABET } from '../server/db.mjs';
import { inviteLink } from '../server/admin.mjs';
import { detailsText } from '../src/online/details.js';
import { cleanServer, takeFragment, onlineServer, DEFAULT_SERVER } from '../src/online/store.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

let clock = Date.UTC(2026, 9, 6, 12);
const logs = [];
let coin = 0.2;   // random() < 0.5: the challenger plays white
const app = createOnlineServer({ db: openDb(':memory:'), now: () => clock, heartbeatMs: 200, log: (l) => logs.push(l), random: () => coin });
const port = await app.listen(0, '127.0.0.1');
const BASE = `http://127.0.0.1:${port}`;
const ORIGIN = 'http://localhost:5173';
async function call(path, { key, body, raw, method = body || raw ? 'POST' : 'GET', origin = ORIGIN } = {}) {
  const headers = { Origin: origin };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body || raw) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }
  return { status: r.status, json, text, headers: r.headers };
}
const state = async (key) => (await call('/state', { key })).json;
let cidN = 0;
const cid = () => `c${++cidN}`;

try {
  // ------------------------------------------------------------ invite and login
  const felix = app.admin.invite('Felix'), mia = app.admin.invite('Mia'), anna = app.admin.invite('Anna');
  ok('invite: a 32 byte base64url key and a NAME-XXXX code without 0, O, 1, I',
    /^[A-Za-z0-9_-]{43}$/.test(felix.key) && new RegExp(`^FELIX-[${CODE_ALPHABET}]{4}$`).test(felix.code) && !/[01OI]/.test(felix.code.slice(6)), `${felix.key} ${felix.code}`);
  const dump = JSON.stringify([...app.db.prepare('SELECT * FROM players').all(), ...app.db.prepare('SELECT * FROM keys').all()]);
  ok('the database holds keys and codes only as hashes', !dump.includes(felix.key) && !dump.includes(felix.code) && !dump.includes(mia.code));
  let threw = false; try { app.admin.invite('felix'); } catch (e) { threw = true; }
  ok('invite of an existing name refuses without --new', threw);
  const link = inviteLink({ game: 'http://localhost:5173/', server: BASE, key: felix.key });
  const lu = new URL(link);
  ok('the invite link carries the key only in the fragment', lu.hash === `#online=${felix.key}` && !lu.search.includes(felix.key) && lu.searchParams.get('online') === BASE && lu.searchParams.get('open') === 'online', link);

  const s1 = await call('/state', { key: felix.key });
  ok('link login: the key from the link opens /state', s1.status === 200 && s1.json.me.name === 'Felix' && s1.json.players.length === 2);
  const bad = await call('/state', { key: 'x'.repeat(43) });
  ok('an unknown key gets 401 and nothing else', bad.status === 401 && bad.text === '');
  ok('no key gets 401', (await call('/state')).status === 401);
  const up = await call('/up', { origin: '' });
  ok('GET /up answers 200 without auth', up.status === 200 && up.text === 'ok');

  // ------------------------------------------------------------ GET /health (CHE-307)
  const ins = (at, req, r5xx, diskFree) => app.db.prepare('INSERT OR REPLACE INTO server_health (at, started, uptime_s, present_max, streams_max, games_max, loop_max_ms, rss_max, req, r4xx, r5xx, load1, load5, load15, mem_free, mem_total, disk_free, disk_total, db_bytes) VALUES (?, 0, 0, 0, 0, 0, 0, 0, ?, 0, ?, 0, 0, 0, 1, 1, ?, 100, 0)').run(at, req, r5xx, diskFree);
  app.db.exec('DELETE FROM server_health');
  const h1 = await call('/health', { origin: '' });
  ok('GET /health: 200 ok, no auth, text/plain, no-store', h1.status === 200 && h1.text === 'ok' && /^text\/plain/.test(h1.headers.get('content-type')) && h1.headers.get('cache-control') === 'no-store');
  const hh = await call('/health', { method: 'HEAD', origin: '' });
  ok('HEAD /health: same status, no body', hh.status === 200 && hh.text === '');
  app.db.exec('DELETE FROM server_health');
  for (let i = 0; i < 4; i++) ins(clock - (3 - i) * 300000, 100, 12, 90);
  const h2 = await call('/health', { origin: '' });
  ok('GET /health: 503 with one short reason on 12% errors', h2.status === 503 && h2.text === 'error rate 12% over 15 min', h2.text);
  ok('HEAD /health: 503 without body', (await call('/health', { method: 'HEAD', origin: '' })).status === 503);
  app.db.exec('DELETE FROM server_health');
  for (let i = 0; i < 4; i++) ins(clock - (3 - i) * 300000, 10, 0, 9);
  const h3 = await call('/health', { origin: '' });
  ok('GET /health: 503 disk 91% used', h3.status === 503 && h3.text === 'disk 91% used', h3.text);
  ok('the 503 body holds no key, code, name or path', ![felix.key, felix.code, 'Felix', '/data'].some((x) => h3.text.includes(x)) && !h3.text.includes('\n'));
  ok('/up stays 200 while /health is 503', (await call('/up', { origin: '' })).status === 200);
  app.db.exec('DELETE FROM server_health');
  const cnt = () => { app.health.sample(); return app.db.prepare('SELECT req FROM server_health ORDER BY at DESC LIMIT 1').get().req; };
  cnt();
  for (let i = 0; i < 3; i++) await call('/health', { origin: '' });
  clock += 1;
  ok('three /health calls leave the request counter at 0', cnt() === 0);
  for (let i = 0; i < 6; i++) await call('/health', { origin: '' });
  ok('/health is not throttled like wrong codes', (await call('/health', { origin: '' })).status === 200);
  app.db.exec('DELETE FROM server_health');

  const lc = await call('/login-code', { body: { code: ` ${mia.code.toLowerCase().replace('-', ' - ')} ` } });
  ok('code login: a typed code (lower case, spaces) gives a key for the same player', lc.status === 200 && lc.json.name === 'Mia' && lc.json.key && lc.json.key !== mia.key);
  const miaKey2 = lc.json.key;
  ok('the code key and the link key both work', (await state(miaKey2)).me.name === 'Mia' && (await state(mia.key)).me.name === 'Mia');

  // ------------------------------------------------------------ revoke
  app.admin.revoke('Anna');
  ok('revoke: the key stops working', (await call('/state', { key: anna.key })).status === 401);
  ok('revoke: the code stops working', (await call('/login-code', { body: { code: anna.code } })).status === 401);
  ok('revoke: the player leaves the list', !(await state(felix.key)).players.some((p) => p.name === 'Anna'));

  // ------------------------------------------------------------ challenge, decline, accept
  let r = await call('/challenge', { key: felix.key, body: { to: 'Mia' } });
  ok('challenge', r.status === 200 && r.json.ok);
  let sm = await state(mia.key);
  ok('the challenged player sees it', sm.challenges.in.length === 1 && sm.challenges.in[0].from === 'Felix');
  r = await call('/challenge/answer', { key: mia.key, body: { id: sm.challenges.in[0].id, accept: false } });
  let sf = await state(felix.key);
  ok('decline: the challenger sees declined', r.status === 200 && sf.challenges.out[0]?.status === 'declined' && sf.challenges.out[0].to === 'Mia' && !sf.game);
  await call('/challenge', { key: felix.key, body: { to: 'Mia' } });
  sm = await state(mia.key);
  r = await call('/challenge/answer', { key: mia.key, body: { id: sm.challenges.in[0].id, accept: true } });
  sf = await state(felix.key); sm = await state(mia.key);
  ok('accept: one game for both, colours drawn (challenger white with this coin)', r.status === 200 && sf.game?.id === r.json.game && sm.game?.id === r.json.game && sf.game.color === 'w' && sm.game.color === 'b' && sf.game.opponent === 'Mia');
  const gid = sf.game.id;
  ok('a player in a game cannot challenge', (await call('/challenge', { key: felix.key, body: { to: 'Mia' } })).json?.error === 'you-are-playing');

  // ------------------------------------------------------------ moves
  r = await call('/move', { key: mia.key, body: { game: gid, uci: 'e7e5', cid: cid() } });
  ok('a move out of turn is refused', r.status === 409 && r.json.error === 'not-your-turn');
  r = await call('/move', { key: felix.key, body: { game: gid, uci: 'e2e5', cid: cid() } });
  ok('an illegal move is rejected by the server', r.status === 400 && r.json.error === 'illegal');
  r = await call('/move', { key: felix.key, body: { game: gid, uci: 'e2e4; drop', cid: cid() } });
  ok('a malformed move is rejected', r.status === 400 && r.json.error === 'illegal');
  const c1 = cid();
  r = await call('/move', { key: felix.key, body: { game: gid, uci: 'e2e4', cid: c1 } });
  const again = await call('/move', { key: felix.key, body: { game: gid, uci: 'e2e4', cid: c1 } });
  sm = await state(mia.key);
  ok('a legal move is stored with its SAN', r.status === 200 && r.json.san === 'e4' && sm.game.moves.join() === 'e2e4' && sm.game.turn === 'b');
  ok('a retried POST (same client id) is applied once', again.status === 200 && again.json.ply === 0 && sm.game.moves.length === 1);
  for (const [k, u] of [[mia.key, 'e7e5'], [felix.key, 'g1f3'], [mia.key, 'b8c6']]) await call('/move', { key: k, body: { game: gid, uci: u, cid: cid() } });
  ok('moves from both devices of a player count (the code key moves too)', (await call('/move', { key: miaKey2, body: { game: gid, uci: 'a7a6', cid: cid() } })).json?.error === 'not-your-turn');

  // ------------------------------------------------------------ resign
  r = await call('/resign', { key: mia.key, body: { game: gid } });
  sf = await state(felix.key);
  ok('resign: the game is over, the other player wins', r.status === 200 && sf.game.status === 'over' && sf.game.reason === 'resign' && sf.game.winner === 'w' && sf.game.result === '1-0');
  ok('no move after the end', (await call('/move', { key: felix.key, body: { game: gid, uci: 'f1c4', cid: cid() } })).status === 409);
  let pf = sf.players.find((p) => p.name === 'Mia');
  ok('score from Felix\'s side: 1 : 0', pf.score.w === 1 && pf.score.l === 0 && pf.score.d === 0);

  // ------------------------------------------------------------ draw by rule (threefold repetition)
  coin = 0.9;   // the challenged player plays white
  await call('/challenge', { key: felix.key, body: { to: 'Mia' } });
  sm = await state(mia.key);
  await call('/challenge/answer', { key: mia.key, body: { id: sm.challenges.in[0].id, accept: true } });
  sm = await state(mia.key);
  const g2 = sm.game.id;
  ok('the coin decides the colours (now the challenged plays white)', sm.game.color === 'w');
  const seq = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
  for (let i = 0; i < seq.length; i++) await call('/move', { key: i % 2 ? felix.key : mia.key, body: { game: g2, uci: seq[i], cid: cid() } });
  sf = await state(felix.key);
  ok('draw by rule: threefold repetition ends the game as a draw', sf.game.status === 'over' && sf.game.result === '1/2-1/2' && sf.game.reason === 'threefold repetition' && sf.game.winner === null, JSON.stringify(sf.game));
  pf = sf.players.find((p) => p.name === 'Mia');
  ok('score counts the draw: 1 : 0 ½ 1', pf.score.w === 1 && pf.score.l === 0 && pf.score.d === 1);

  // ------------------------------------------------------------ the 3 day finish
  coin = 0.2;
  await call('/challenge', { key: mia.key, body: { to: 'Felix' } });
  sf = await state(felix.key);
  await call('/challenge/answer', { key: felix.key, body: { id: sf.challenges.in[0].id, accept: true } });
  sm = await state(mia.key);
  const g3 = sm.game.id;   // Mia white
  await call('/move', { key: mia.key, body: { game: g3, uci: 'd2d4', cid: cid() } });
  ok('finish too early is refused', (await call('/finish-stale', { key: mia.key, body: { game: g3 } })).json?.error === 'too-early');
  clock += STALE_MS - 60e3;
  ok('still refused a minute before 3 days', (await call('/finish-stale', { key: mia.key, body: { game: g3 } })).json?.error === 'too-early' && !(await state(mia.key)).game.canFinish);
  clock += 120e3;
  ok('the player to move cannot finish', (await call('/finish-stale', { key: felix.key, body: { game: g3 } })).json?.error === 'your-turn');
  ok('after 3 days the waiting player is offered the finish', (await state(mia.key)).game.canFinish === true);
  r = await call('/finish-stale', { key: mia.key, body: { game: g3 } });
  sm = await state(mia.key);
  ok('the finish counts as a win for the waiting player', r.status === 200 && sm.game.reason === 'stale' && sm.game.winner === 'w' && sm.game.result === '1-0');
  ok('score from Mia\'s side: 1 : 1 ½ 1', JSON.stringify(sm.players.find((p) => p.name === 'Felix').score) === JSON.stringify({ w: 1, l: 1, d: 1 }));

  // ------------------------------------------------------------ chat
  r = await call('/chat', { key: felix.key, body: { to: 'Mia', text: 'x'.repeat(201), cid: cid() } });
  ok('chat: more than 200 characters is refused', r.status === 400 && r.json.error === 'too-long');
  const c2 = cid();
  r = await call('/chat', { key: felix.key, body: { to: 'Mia', text: 'y'.repeat(200), cid: c2 } });
  await call('/chat', { key: felix.key, body: { to: 'Mia', text: 'y'.repeat(200), cid: c2 } });
  await call('/chat', { key: felix.key, body: { to: 'Mia', text: 'Gut gespielt!', cid: cid() } });
  sm = await state(mia.key);
  ok('chat: 200 characters pass, a retried message is stored once, the other side has 2 unread', r.status === 200 && sm.chats.Felix.length === 2 && sm.unread.Felix === 2 && sm.players.find((p) => p.name === 'Felix').unread === 2);
  await call('/chat/read', { key: mia.key, body: { with: 'Felix' } });
  ok('chat/read clears the unread count', !(await state(mia.key)).unread.Felix);
  ok('chat works while the other is offline and the history stays', (await state(felix.key)).chats.Mia.at(-1).text === 'Gut gespielt!');
  app.admin.mute('Mia');
  ok('mute: a muted player cannot write', (await call('/chat', { key: mia.key, body: { to: 'Felix', text: 'hi', cid: cid() } })).json?.error === 'muted' && (await state(mia.key)).me.muted);
  app.admin.mute('Mia', false);
  ok('unmute: writing works again', (await call('/chat', { key: mia.key, body: { to: 'Felix', text: 'hi', cid: cid() } })).status === 200);
  ok('admin chat prints the conversation', app.admin.chat('Felix')[0].messages.length === 3);

  // ------------------------------------------------------------ live stream, presence, CORS, body cap
  const ac = new AbortController();
  const ev = await fetch(BASE + '/events', { headers: { Authorization: `Bearer ${mia.key}` }, signal: ac.signal });
  const reader = ev.body.getReader(); let buf = '';
  const until = async (re, ms = 3000) => { const end = Date.now() + ms; while (!re.test(buf) && Date.now() < end) { const { value, done } = await Promise.race([reader.read(), new Promise((res) => setTimeout(() => res({}), 300))]); if (done) break; if (value) buf += new TextDecoder().decode(value); } return re.test(buf); };
  ok('the live stream: no-cache, no proxy buffering, the full state first', ev.headers.get('cache-control').includes('no-cache') && ev.headers.get('x-accel-buffering') === 'no' && await until(/event: state\ndata: \{"me":\{"name":"Mia"/));
  ok('the live stream sends the heartbeat comment', await until(/: hb\n\n/));
  ok('presence: Mia is online for Felix while her stream is open', (await state(felix.key)).players.find((p) => p.name === 'Mia').online === true);
  buf = '';
  await call('/chat', { key: felix.key, body: { to: 'Mia', text: 'live', cid: cid() } });
  ok('a change is pushed at once', await until(/"text":"live"/));
  ac.abort();
  await new Promise((res) => setTimeout(res, 150));
  ok('presence: offline once the stream closes', (await state(felix.key)).players.find((p) => p.name === 'Mia').online === false);
  const cr = await call('/state', { key: felix.key });
  const cf = await call('/state', { key: felix.key, origin: 'https://evil.example' });
  ok('CORS: a local game origin is allowed, a foreign one gets no allow header', cr.headers.get('access-control-allow-origin') === ORIGIN && !cf.headers.get('access-control-allow-origin'));
  ok('CORS: an explicit list adds to the preview origins', originAllowed('https://chess.example', ['https://chess.example']) && originAllowed(ORIGIN, ['https://chess.example']) && originAllowed(`http://${['100', '101', '1', '2'].join('.')}:5400`, []));
  const L = ['https://chess.example'];
  ok('CORS: with a list set, a listed origin and the local preview origins are allowed', originAllowed('https://chess.example', L) && originAllowed(`http://${['100', '95', '180', '72'].join('.')}:4173`, L) && originAllowed('http://localhost:4173', L) && originAllowed('http://127.0.0.1:5400', L) && originAllowed('http://mac.tail1234.ts.net:4173', L));
  ok('CORS: with a list set, a foreign https, a public http and an empty origin stay rejected', !originAllowed('https://evil.example', L) && !originAllowed('http://8.8.8.8:4173', L) && !originAllowed('https://localhost:4173', L) && !originAllowed('', L) && !originAllowed(undefined, L));
  ok('a body over 4 KB is refused', (await call('/chat', { key: felix.key, raw: JSON.stringify({ to: 'Mia', text: 'z'.repeat(5000) }) })).status === 413);

  // ------------------------------------------------------------ wrong code throttle (per IP, 5 per 10 minutes)
  const tries = [];
  for (let i = 0; i < 5; i++) tries.push((await call('/login-code', { body: { code: 'FELIX-ZZZZ' } })).status);
  const sixth = await call('/login-code', { body: { code: felix.code } });
  ok('wrong code throttle: 5 wrong tries, then even the right code waits', tries.every((s) => s === 401) && sixth.status === 429, `${tries} ${sixth.status}`);
  clock += 10 * 60e3 + 1000;
  ok('after 10 minutes the code works again', (await call('/login-code', { body: { code: felix.code } })).status === 200);

  // ------------------------------------------------------------ delete
  app.admin.delete('Mia');
  sf = await state(felix.key);
  ok('delete: the player, the shared games and the chat are gone', !sf.players.some((p) => p.name === 'Mia') && !sf.game && !Object.keys(sf.chats).length && (await call('/state', { key: mia.key })).status === 401);

  // ------------------------------------------------------------ no key in any URL or log, the copied details
  const secrets = [felix.key, mia.key, anna.key, miaKey2, felix.code, mia.code, anna.code];
  ok('no key or code in any logged line (method, path, status only)', logs.length > 30 && !logs.some((l) => secrets.some((s) => l.includes(s))) && logs.every((l) => /^[A-Z]+ \/[\w/-]* \d{3}$/.test(l)), logs.find((l) => secrets.some((s) => l.includes(s))) || logs.find((l) => !/^[A-Z]+ \/[\w/-]* \d{3}$/.test(l)));
  const text = detailsText({ cause: 'server', lastOk: clock, request: 'GET /events', status: 500, error: `boom ${felix.key} and ${mia.code} and FELIX-ZZZZ`, host: '127.0.0.1:5702', version: 'v1.8.0', time: clock }, [felix.key]);
  ok('the copied details never contain the key or a code', !text.includes(felix.key) && !text.includes(mia.code) && !text.includes('FELIX-ZZZZ') && text.includes('http status: 500') && text.includes('server host: 127.0.0.1:5702'), text);
  ok('the details text has no chat field', !/chat|message:/i.test(text));
  ok('release default (CHE-326): no flag uses the fallback, ?online= wins, a dev build has no default', onlineServer('', 'https://chess.borisdiebold.com') === 'https://chess.borisdiebold.com' && onlineServer('?online=http://localhost:5502', 'https://chess.borisdiebold.com') === 'http://localhost:5502' && DEFAULT_SERVER === '');
  // CHE-416: fake preview data does not overwrite the remembered server of the tab
  {
    const mem = new Map(); globalThis.sessionStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
    onlineServer('?online=https://chess.borisdiebold.com', '');
    const fake = onlineServer('?online=http://preview.invalid&onlinepv=list', '');
    ok('fake preview data (CHE-416): used for the page, not remembered', fake === 'http://preview.invalid' && onlineServer('', '') === 'https://chess.borisdiebold.com');
    delete globalThis.sessionStorage;
  }
  // CHE-416: CHESS_ONLINE_DEFAULT sets the default without CHESS_RELEASE (no service worker); a release build keeps the live server
  {
    const def = async (env) => { const keep = { r: process.env.CHESS_RELEASE, d: process.env.CHESS_ONLINE_DEFAULT }; delete process.env.CHESS_RELEASE; delete process.env.CHESS_ONLINE_DEFAULT; Object.assign(process.env, env);
      try { const m = await import('../vite.config.js?' + JSON.stringify(env)); return m.default.define; } finally { for (const [k, v] of [['CHESS_RELEASE', keep.r], ['CHESS_ONLINE_DEFAULT', keep.d]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } } };
    const a = await def({ CHESS_ONLINE_DEFAULT: 'https://chess.borisdiebold.com' }), b = await def({}), c = await def({ CHESS_RELEASE: '1' });
    ok('build env CHESS_ONLINE_DEFAULT (CHE-416): server default without the service worker', a.__ONLINE_DEFAULT__ === '"https://chess.borisdiebold.com"' && a.__SW_DEFAULT__ === 'false' && b.__ONLINE_DEFAULT__ === '""' && c.__ONLINE_DEFAULT__ === '"https://chess.borisdiebold.com"' && c.__SW_DEFAULT__ === 'true');
  }
  ok('the server flag is cleaned (no credentials, no other scheme)', cleanServer('http://u:p@h:1/') === '' && cleanServer('javascript:alert(1)') === '' && cleanServer('http://127.0.0.1:5702/') === 'http://127.0.0.1:5702');
  // the fragment is stripped at once and stored (a stand in for location, history and storage)
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  let replaced = null;
  const got = takeFragment({ hash: `#online=${felix.key}`, pathname: '/', search: `?online=${encodeURIComponent(BASE)}` }, { state: null, replaceState: (s, t, u) => { replaced = u; } });
  ok('the link fragment is stored and stripped from the address bar', got?.key === felix.key && JSON.parse(store.get('chess3d.online')).key === felix.key && replaced === `/?online=${encodeURIComponent(BASE)}` && !replaced.includes(felix.key));
} catch (e) {
  ok('no exception', false, String(e && e.stack || e));
} finally {
  await app.close();
}
console.log(failed ? `\n${failed} online server check(s) FAILED` : '\nonline server: all checks passed');
process.exit(failed ? 1 : 0);
