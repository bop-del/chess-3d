// Several online games and challenges at once (CHE-335, fast tier, no browser): the real server with the in memory database and a fake
// clock. Three players A, B, C: A challenges B and C, both accept, two games run (A-B, A-C) with their own moves, chat and resign;
// one game per pair (409 you-are-playing both ways); a player in a game can still be challenged; accepting one challenge keeps the
// others open but cancels the one the other way round between the same two; the 3 day finish ends one game and leaves the other;
// `games` and the deprecated `game` field; one push per challenge, a second challenge to the same player is the same challenge.
import { createServer } from 'node:http';
import { createECDH, createDecipheriv, hkdfSync } from 'node:crypto';
import { createOnlineServer, STALE_MS } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { vapidGenerate } from '../server/push.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const b64u = (b) => Buffer.from(b).toString('base64url');

// a fake push service and one device per player
const sent = [];
const fake = createServer((req, res) => {
  const parts = []; req.on('data', (d) => parts.push(d));
  req.on('end', () => { sent.push({ path: req.url, body: Buffer.concat(parts) }); res.writeHead(201); res.end(); });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const FAKE = `http://127.0.0.1:${fake.address().port}`;
const DEV = {};
function device(path) {
  const e = createECDH('prime256v1'); e.generateKeys();
  const auth = Buffer.from(Array.from({ length: 16 }, (_, i) => (i * 5 + path.length) & 255));
  return DEV[path] = { priv: e.getPrivateKey(), pub: e.getPublicKey(), auth, sub: { endpoint: `${FAKE}${path}`, keys: { p256dh: b64u(e.getPublicKey()), auth: b64u(auth) } } };
}
function readPush(m) {   // RFC 8291 receiver side
  const d = DEV[m.path], body = m.body;
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(d.priv);
  const ikm = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(asPublic), d.auth, Buffer.concat([Buffer.from('WebPush: info\0'), d.pub, asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const dc = createDecipheriv('aes-128-gcm', cek, nonce); dc.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([dc.update(data.subarray(0, data.length - 16)), dc.final()]);
  return JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString());
}

let clock = Date.UTC(2026, 9, 7, 12);
const app = createOnlineServer({ db: openDb(':memory:'), now: () => clock, heartbeatMs: 200, random: () => 0.2, vapid: vapidGenerate(), vapidSubject: 'mailto:x' + '@' + 'example.com', gameUrl: 'https://chess.example.com/' });
const port = await app.listen(0, '127.0.0.1');
const call = async (path, { key, body } = {}) => {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: 'http://localhost:5173', ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* none */ }
  return { status: r.status, json };
};
const st = async (k) => (await call('/state', { key: k })).json;
const err = (r) => r.json?.error;

try {
  const A = app.admin.invite('Anna'), B = app.admin.invite('Ben'), C = app.admin.invite('Cleo');
  await call('/push/subscribe', { key: B.key, body: device('/b').sub });
  await call('/push/subscribe', { key: C.key, body: device('/c').sub });

  // ---- two challenges out at once, one push each
  let r = await call('/challenge', { key: A.key, body: { to: 'Ben' } });
  const idB = r.json.id;
  r = await call('/challenge', { key: A.key, body: { to: 'Cleo' } });
  const idC = r.json.id;
  await app.push.flush();
  ok('push per challenge: one request to Ben, one to Cleo, tag challenge:Anna', sent.length === 2 && readPush(sent.find((m) => m.path === '/b')).tag === 'challenge:Anna' && readPush(sent.find((m) => m.path === '/c')).kind === 'challenge');
  sent.length = 0;
  r = await call('/challenge', { key: A.key, body: { to: 'Ben' } });
  await app.push.flush();
  ok('a second challenge to the same player while one is open is the open one, no second push', r.json.id === idB && r.json.again === true && sent.length === 0);
  let sa = await st(A.key);
  ok('challenges.out lists both open challenges', sa.challenges.out.length === 2 && sa.challenges.out.every((c) => c.status === 'open') && sa.challenges.out.map((c) => c.to).sort().join() === 'Ben,Cleo');

  // ---- both accept: two games
  const sb0 = await st(B.key);
  r = await call('/challenge/answer', { key: B.key, body: { id: sb0.challenges.in[0].id, accept: true } });
  const gAB = r.json.game;
  sa = await st(A.key);
  ok('accepting one challenge keeps the other open', sa.challenges.out.length === 1 && sa.challenges.out[0].id === idC && sa.challenges.out[0].status === 'open');
  r = await call('/challenge/answer', { key: C.key, body: { id: idC, accept: true } });
  const gAC = r.json.game;
  sa = await st(A.key);
  ok('two games run for Anna (A-B, A-C), newest first', sa.games.length === 2 && sa.games[0].id === gAC && sa.games[1].id === gAB && sa.games.every((g) => g.status === 'active'));
  ok('the deprecated `game` is the newest active game; `games` is there too', sa.game.id === gAC && Array.isArray(sa.games));
  ok('players: Ben and Cleo are withMe, nobody is playing someone else', sa.players.find((p) => p.name === 'Ben').withMe && sa.players.find((p) => p.name === 'Cleo').withMe && sa.players.every((p) => !p.playing));
  const sbs = await st(B.key);
  ok('Ben sees one game (with Anna) and Cleo is "playing" for him (in a game with someone else, deprecated)', sbs.games.length === 1 && sbs.games[0].opponent === 'Anna' && sbs.players.find((p) => p.name === 'Cleo').playing === true && sbs.players.find((p) => p.name === 'Cleo').withMe === false);

  // ---- one game per pair
  ok('Anna cannot challenge Ben while their game runs: 409 you-are-playing', err(await call('/challenge', { key: A.key, body: { to: 'Ben' } })) === 'you-are-playing');
  ok('Ben cannot challenge Anna either: 409 you-are-playing', err(await call('/challenge', { key: B.key, body: { to: 'Anna' } })) === 'you-are-playing');

  // ---- a player in a game can still challenge and be challenged; accepting keeps the others
  r = await call('/challenge', { key: B.key, body: { to: 'Cleo' } });
  const idBC = r.json.id;
  ok('Ben can challenge Cleo although both are in a game with Anna', r.status === 200 && idBC > 0);
  r = await call('/challenge', { key: C.key, body: { to: 'Ben' } });
  const idCB = r.json.id;
  r = await call('/challenge', { key: C.key, body: { to: 'Anna' } });
  ok('Cleo cannot challenge Anna (game running), but Ben and she may challenge each other at once', err(r) === 'you-are-playing' && idCB > 0);
  let sc = await st(C.key);
  r = await call('/challenge/answer', { key: C.key, body: { id: sc.challenges.in.find((c) => c.from === 'Ben').id, accept: true } });
  const gBC = r.json.game;
  sc = await st(C.key); const sb = await st(B.key);
  ok('mutual challenges: accepting Ben\'s cancels Cleo\'s to Ben, one game B-C', sc.games.length === 2 && sb.games.length === 2 && sb.challenges.out.length === 0 && sc.challenges.out.every((c) => c.status !== 'open') && sb.games.some((g) => g.id === gBC));
  ok('Anna\'s games are not touched', (await st(A.key)).games.length === 2);

  // ---- moves, chat and resign stay per game
  const colorOf = async (k, gid) => (await st(k)).games.find((g) => g.id === gid).color;
  const wAB = (await colorOf(A.key, gAB)) === 'w' ? A.key : B.key, bAB = wAB === A.key ? B.key : A.key;
  const wAC = (await colorOf(A.key, gAC)) === 'w' ? A.key : C.key;
  await call('/move', { key: wAB, body: { game: gAB, uci: 'e2e4' } });
  ok('a move in A-B changes only A-B', (await st(A.key)).games.find((g) => g.id === gAB).moves.length === 1 && (await st(A.key)).games.find((g) => g.id === gAC).moves.length === 0);
  ok('a move in a game of another pair is refused: 404 no-game', err(await call('/move', { key: A.key, body: { game: gBC, uci: 'e2e4' } })) === 'no-game');
  await call('/move', { key: wAC, body: { game: gAC, uci: 'd2d4' } });
  await call('/chat', { key: A.key, body: { to: 'Ben', text: 'hallo Ben' } });
  const sb2 = await st(B.key), sc2 = await st(C.key);
  ok('chat stays per pair: Ben has the message, Cleo has none', sb2.chats.Anna?.length === 1 && !sc2.chats.Anna && sb2.unread.Anna === 1);
  // 3 day rule per game: A-B is old, A-C is fresh
  clock += STALE_MS - 1000;
  await call('/move', { key: wAC === A.key ? C.key : A.key, body: { game: gAC, uci: 'd7d5' } });   // A-C gets a fresh move
  clock += 2000;
  const sa3 = await st(A.key);
  const ab = sa3.games.find((g) => g.id === gAB), ac = sa3.games.find((g) => g.id === gAC);
  const mover = wAB;   // white moved in A-B and waits for black
  const sMover = await st(mover), abMover = sMover.games.find((g) => g.id === gAB);
  ok('3 day rule per game: canFinish only in the old game, in the fresh one not', abMover.canFinish === true && (await st(A.key)).games.find((g) => g.id === gAC).canFinish === false && ab.staleAt === ab.lastMoveAt + STALE_MS && ac.lastMoveAt > ab.lastMoveAt);
  ok('finish-stale of the fresh game is too early', err(await call('/finish-stale', { key: A.key, body: { game: gAC } })) !== undefined && (await st(A.key)).games.find((g) => g.id === gAC).status === 'active');
  r = await call('/finish-stale', { key: mover, body: { game: gAB } });
  const sf = await st(A.key);
  ok('the 3 day finish ends A-B as a win for the waiting player and leaves A-C running', r.json?.over === 'stale' && sf.games.find((g) => g.id === gAB).status === 'over' && sf.games.find((g) => g.id === gAC).status === 'active');
  ok('`game` (deprecated) is still the newest active game', sf.game.id === gAC);
  r = await call('/resign', { key: A.key, body: { game: gAC } });
  const se = await st(A.key);
  ok('resign ends only that game; the finished games stay in `games` (newest first, at most 5)', r.json?.over === 'resign' && se.games.length === 2 && se.games.every((g) => g.status === 'over') && se.games[0].id > se.games[1].id);
  ok('after both games Anna can challenge Ben again (pair free)', (await call('/challenge', { key: A.key, body: { to: 'Ben' } })).status === 200);

  // ---- declined: the last declined challenge per player, shape unchanged
  const sb4 = await st(B.key);
  await call('/challenge/answer', { key: B.key, body: { id: sb4.challenges.in[0].id, accept: false } });
  const sa5 = await st(A.key);
  ok('a declined challenge shows once in challenges.out with the old shape', sa5.challenges.out.length === 1 && sa5.challenges.out[0].status === 'declined' && sa5.challenges.out[0].to === 'Ben' && Object.keys(sa5.challenges.out[0]).sort().join() === 'at,id,status,to');
  r = await call('/challenge/cancel', { key: A.key, body: { id: 999 } });
  ok('cancel with an unknown id cancels nothing and is fine', r.status === 200 && r.json.cancelled === 0);
} catch (e) {
  failed++; console.log('FAIL  exception', e.stack || e);
} finally {
  fake.close(); await app.close?.();
}
console.log(failed ? `\n${failed} FAILED` : '\nonline multi: all checks passed');
process.exit(failed ? 1 : 0);
