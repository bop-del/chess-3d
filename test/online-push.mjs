// Web push of online play (CHE-272, fast tier, no browser): the RFC 8291 appendix A test vector (payload, keys, salt, expected
// body), the receiver side (decrypting what the server sends), the VAPID JWT (ES256, verified against the public key), the push
// routes (401 for an unknown key, 404 when push is off), and a fake push service (a local http server): a challenge, a move, a
// chat message, game over and an accept each send exactly one request to the right subscription; 410 deletes the row; a revoke
// deletes all rows of the player; a player with an open live stream gets none; a second push of one kind carries the same tag;
// a chat text never appears in a push; the admin command push-keys creates the key file once (mode 600).
import { createServer } from 'node:http';
import { createECDH, createDecipheriv, createPublicKey, createVerify, hkdfSync } from 'node:crypto';
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { runAdmin } from '../server/admin.mjs';
import { encryptPayload, vapidGenerate, vapidJwt, vapidLoad } from '../server/push.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const b64u = (b) => Buffer.from(b).toString('base64url');
const unb = (s) => Buffer.from(s, 'base64url');

// ------------------------------------------------------------ RFC 8291 appendix A
const V = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const got = encryptPayload(V.plaintext, { p256dh: V.uaPublic, auth: V.auth }, { ephemeral: { privateKey: unb(V.asPrivate) }, salt: unb(V.salt) });
ok('RFC 8291 appendix A: the request body matches the expected ciphertext byte for byte', b64u(got) === V.body, b64u(got));

/** the receiver side (RFC 8291 section 3.4), to read what the server sent */
function decrypt(body, uaPrivate, uaPublic, authSecret) {
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(uaPrivate);
  const ikm = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(asPublic), authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return { rs, text: plain.subarray(0, plain.lastIndexOf(2)).toString() };
}
// the same vector read back with the user agent private key of the RFC
const UA_PRIVATE = 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94';
ok('the receiver side reads the RFC body back', decrypt(unb(V.body), unb(UA_PRIVATE), unb(V.uaPublic), unb(V.auth)).text === V.plaintext);
let tooBig = false; try { encryptPayload('x'.repeat(5000), { p256dh: V.uaPublic, auth: V.auth }); } catch (e) { tooBig = true; }
ok('a payload over the push service limit is refused', tooBig);

// ------------------------------------------------------------ VAPID
const vk = vapidGenerate();
ok('VAPID key: private 32 bytes, public an uncompressed point of 65 bytes', unb(vk.private).length === 32 && unb(vk.public).length === 65 && unb(vk.public)[0] === 4);
const NOW = Date.UTC(2026, 9, 7, 12);
const jwt = vapidJwt(vk, 'mailto:owner@example.com', 'https://fcm.googleapis.com/fcm/send/abc', NOW);
const [h, c, s] = jwt.split('.');
const claims = JSON.parse(unb(c)), head = JSON.parse(unb(h));
const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(unb(vk.public).subarray(1, 33)), y: b64u(unb(vk.public).subarray(33)) }, format: 'jwk' });
ok('VAPID JWT: ES256 signature verifies against the public key', createVerify('SHA256').update(`${h}.${c}`).verify({ key: pub, dsaEncoding: 'ieee-p1363' }, unb(s)));
ok('VAPID JWT: alg ES256, aud is the endpoint origin, sub kept, exp under 24 hours', head.alg === 'ES256' && claims.aud === 'https://fcm.googleapis.com' && claims.sub === 'mailto:owner@example.com' && claims.exp > NOW / 1000 && claims.exp - NOW / 1000 < 24 * 3600, JSON.stringify(claims));
const bad = jwt.slice(0, -4) + (jwt.endsWith('AAAA') ? 'BBBB' : 'AAAA');
ok('VAPID JWT: a changed signature does not verify', !createVerify('SHA256').update(`${h}.${c}`).verify({ key: pub, dsaEncoding: 'ieee-p1363' }, unb(bad.split('.')[2])));

// ------------------------------------------------------------ the fake push service
const sent = [];   // { path, auth, headers, body }
const status = new Map();   // path -> status to answer
const fake = createServer((req, res) => {
  const parts = []; req.on('data', (d) => parts.push(d));
  req.on('end', () => { sent.push({ path: req.url, headers: req.headers, body: Buffer.concat(parts) }); res.writeHead(status.get(req.url) || 201); res.end(); });
});
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const FAKE = `http://127.0.0.1:${fake.address().port}`;

function device(path) {   // a user agent: keys and a subscription pointing at the fake service
  const e = createECDH('prime256v1'); e.generateKeys();
  const auth = Buffer.from(Array.from({ length: 16 }, (_, i) => (i * 7 + path.length) & 255));
  return DEV[path] = { path, priv: e.getPrivateKey(), pub: e.getPublicKey(), auth, sub: { endpoint: `${FAKE}${path}`, keys: { p256dh: b64u(e.getPublicKey()), auth: b64u(auth) } } };
}
const DEV = {};
const readAny = (m) => read(DEV[m.path], m);
const read = (d, m) => { const x = decrypt(m.body, d.priv, d.pub, d.auth); return JSON.parse(x.text); };

const logs = [];
let coin = 0.2;   // the challenger plays white
const clock = Date.UTC(2026, 9, 7, 12);
const app = createOnlineServer({ db: openDb(':memory:'), now: () => clock, heartbeatMs: 200, log: (l) => logs.push(l), random: () => coin,
  vapid: vk, vapidSubject: 'mailto:owner@example.com', gameUrl: 'https://chess.example.com/' });
const off = createOnlineServer({ db: openDb(':memory:'), now: () => clock, heartbeatMs: 200 });
const port = await app.listen(0, '127.0.0.1'), offPort = await off.listen(0, '127.0.0.1');
const ORIGIN = 'http://localhost:5173';
async function call(base, path, { key, body, method = body ? 'POST' : 'GET' } = {}) {
  const headers = { Origin: ORIGIN };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(`http://127.0.0.1:${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* none */ }
  return { status: r.status, json, text };
}
const A = (path, o) => call(port, path, o);
let n = 0; const cid = () => `p${++n}`;
const settle = async () => { await app.push.flush(); };

try {
  const felix = app.admin.invite('Felix'), mia = app.admin.invite('Mia');
  off.admin.invite('Zoe');
  const dF = device('/f1'), dM = device('/m1'), dM2 = device('/m2');

  // ---- routes
  ok('GET /push/key gives the public key', (await A('/push/key', { key: felix.key })).json?.key === vk.public);
  ok('/push/key with an unknown key: 401 and nothing else', (await A('/push/key', { key: 'x'.repeat(43) })).status === 401);
  ok('/push/subscribe without a key: 401', (await A('/push/subscribe', { body: dF.sub })).status === 401);
  ok('/push/unsubscribe with an unknown key: 401', (await A('/push/unsubscribe', { key: 'x'.repeat(43), body: { endpoint: dF.sub.endpoint } })).status === 401);
  ok('subscribe: bad endpoint (http, not local) and bad keys are refused with 400',
    (await A('/push/subscribe', { key: felix.key, body: { endpoint: 'http://example.com/x', keys: dF.sub.keys } })).status === 400 &&
    (await A('/push/subscribe', { key: felix.key, body: { endpoint: dF.sub.endpoint, keys: { p256dh: 'AAAA', auth: dF.sub.keys.auth } } })).status === 400 &&
    (await A('/push/subscribe', { key: felix.key, body: { endpoint: dF.sub.endpoint, keys: { p256dh: dF.sub.keys.p256dh, auth: 'AAAA' } } })).status === 400);
  ok('subscribe answers { ok: true }', (await A('/push/subscribe', { key: felix.key, body: dF.sub })).json?.ok === true);
  await A('/push/subscribe', { key: mia.key, body: dM.sub });
  await A('/push/subscribe', { key: mia.key, body: dM2.sub });
  await A('/push/subscribe', { key: mia.key, body: dM2.sub });   // the same endpoint again
  const rows = app.db.prepare('SELECT player, endpoint, p256dh, auth, created FROM push_subs ORDER BY endpoint').all();
  ok('push_subs holds one row per endpoint (Felix 1, Mia 2) with the columns of the contract', rows.length === 3 && Object.keys(rows[0]).join() === 'player,endpoint,p256dh,auth,created', JSON.stringify(rows.map((r) => r.endpoint)));
  const zoe = off.admin.byName('Zoe');
  ok('push off (no key file): every push route is 404, also with a good key', (await call(offPort, '/push/key', { key: off.admin.invite('Zed', {}).key })).status === 404 && (await call(offPort, '/push/subscribe', { body: dF.sub })).status === 404 && zoe !== undefined);

  // ---- events (nobody has a live stream open: pushes go out)
  let r = await A('/challenge', { key: felix.key, body: { to: 'Mia', cid: cid() } });
  await settle();
  ok('a challenge sends one request to each subscription of Mia and none to Felix', sent.length === 2 && sent.every((m) => m.path.startsWith('/m')), JSON.stringify(sent.map((m) => m.path)));
  const m1 = sent.find((m) => m.path === '/m1'), p1 = read(dM, m1);
  ok('the payload has kind, German title, tag challenge:<from>, an url on the game origin and data.with',
    p1.kind === 'challenge' && p1.title === 'Felix fordert dich heraus' && p1.tag === 'challenge:Felix' && p1.url === 'https://chess.example.com/?open=online' && p1.data.with === 'Felix', JSON.stringify(p1));
  ok('the request carries aes128gcm, a TTL and a VAPID header whose JWT audience is the endpoint origin',
    m1.headers['content-encoding'] === 'aes128gcm' && Number(m1.headers.ttl) > 0 && new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${vk.public}$`).test(m1.headers.authorization) &&
    JSON.parse(unb(m1.headers.authorization.split(' ')[1].split('.')[1])).aud === FAKE);
  sent.length = 0;

  r = await A('/challenge/answer', { key: mia.key, body: { id: (await A('/state', { key: mia.key })).json.challenges.in[0].id, accept: true, cid: cid() } });
  await settle();
  const gid = r.json.game;
  ok('an accept sends exactly one request, to Felix, "Mia hat deine Herausforderung angenommen", tag accepted:Mia', sent.length === 1 && sent[0].path === '/f1' && read(dF, sent[0]).title === 'Mia hat deine Herausforderung angenommen' && read(dF, sent[0]).tag === 'accepted:Mia' && read(dF, sent[0]).data.game === gid, JSON.stringify(sent.map((m) => m.path)));
  sent.length = 0;

  await A('/move', { key: felix.key, body: { game: gid, uci: 'e2e4', cid: cid() } });
  await settle();
  const t1 = sent.map(readAny);
  ok('a move sends one request per subscription of the player on turn, "Felix hat gezogen, du bist dran", tag turn:<game>', sent.length === 2 && t1[0].kind === 'turn' && t1[0].title === 'Felix hat gezogen, du bist dran' && t1[0].tag === `turn:${gid}` && t1[0].url.endsWith(`?open=online&with=Felix`), JSON.stringify(t1[0]));
  sent.length = 0;
  await A('/move', { key: mia.key, body: { game: gid, uci: 'e7e5', cid: cid() } });
  await A('/move', { key: felix.key, body: { game: gid, uci: 'g1f3', cid: cid() } });
  await settle();
  const t2 = sent.filter((m) => m.path === '/m1').map((m) => read(dM, m)).filter((x) => x.kind === 'turn');
  ok('a second push of one kind carries the same tag (it replaces the first on the device)', t1.length && t2.length === 1 && t2[0].tag === t1[0].tag);
  sent.length = 0;

  const SECRET = 'geheimer Chattext 42';
  await A('/chat', { key: felix.key, body: { to: 'Mia', text: SECRET, cid: cid() } });
  await settle();
  const cp = sent.map((m) => { const d = DEV[m.path]; return decrypt(m.body, d.priv, d.pub, d.auth).text; });
  ok('a chat message sends one request per subscription: "Neue Nachricht von Felix", tag chat:Felix, never the text', sent.length === 2 && JSON.parse(cp[0]).title === 'Neue Nachricht von Felix' && JSON.parse(cp[0]).tag === 'chat:Felix' && !cp.join().includes(SECRET) && !logs.join().includes(SECRET), cp[0]);
  sent.length = 0;

  // ---- a live stream suppresses the push
  const ac = new AbortController();
  const stream = await fetch(`http://127.0.0.1:${port}/events`, { headers: { Authorization: `Bearer ${mia.key}`, Origin: ORIGIN }, signal: ac.signal });
  await stream.body.getReader().read();   // the first state: the stream is open
  await A('/move', { key: mia.key, body: { game: gid, uci: 'b8c6', cid: cid() } });
  await A('/move', { key: felix.key, body: { game: gid, uci: 'f1c4', cid: cid() } });   // Mia is on turn and has a stream open
  await A('/chat', { key: felix.key, body: { to: 'Mia', text: 'hallo', cid: cid() } });
  await settle();
  ok('a player with an open live stream gets no push (Felix, with no stream, still gets the push for Mia\'s move)', sent.filter((m) => m.path.startsWith('/m')).length === 0 && sent.length === 1 && sent[0].path === '/f1', JSON.stringify(sent.map((m) => m.path)));
  ac.abort();
  await new Promise((r2) => setTimeout(r2, 150));

  // ---- game over and 410
  status.set('/m1', 410);
  await A('/resign', { key: mia.key, body: { game: gid, cid: cid() } });
  await settle();
  const ov = sent.filter((m) => m.path === '/f1').map((m) => read(dF, m)).filter((x) => x.kind === 'over');
  ok('resign: game over push to the winner, "Du hast gewonnen." with tag over:<game>', ov.length === 1 && ov[0].kind === 'over' && ov[0].tag === `over:${gid}` && ov[0].title === 'Partie gegen Mia zu Ende' && ov[0].body === 'Du hast gewonnen.', JSON.stringify(ov));
  const over2 = sent.filter((m) => m.path === '/m1' || m.path === '/m2');
  ok('game over also reaches the loser; the 410 answer deleted that subscription row only', over2.length === 2 && app.push.count(app.admin.byName('Mia').id) === 1 && app.db.prepare("SELECT COUNT(*) AS n FROM push_subs WHERE endpoint LIKE '%/m1'").get().n === 0, `${over2.length} ${app.push.count(app.admin.byName('Mia').id)}`);
  ok('the log never holds a full endpoint', !logs.join('\n').includes('/m1') && !logs.join('\n').includes('/f1') && logs.some((l) => l.includes('410')));

  // ---- unsubscribe, revoke
  ok('unsubscribe removes the row', (await A('/push/unsubscribe', { key: mia.key, body: { endpoint: dM2.sub.endpoint } })).json?.ok === true && app.push.count(app.admin.byName('Mia').id) === 0);
  await A('/push/subscribe', { key: mia.key, body: dM.sub }); await A('/push/subscribe', { key: mia.key, body: dM2.sub });
  const miaId = app.admin.byName('Mia').id;
  app.admin.revoke('Mia');
  ok('revoke deletes all subscriptions of the player (Felix keeps his)', app.push.count(miaId) === 0 && app.push.count(app.admin.byName('Felix').id) === 1);
  await A('/push/subscribe', { key: felix.key, body: dM.sub });   // an endpoint moves to its latest owner
  ok('one row per endpoint: a second player subscribing the same endpoint takes it over', app.db.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE endpoint = ?').get(dM.sub.endpoint).n === 1);
  ok('delete of a player deletes their subscriptions', (app.admin.delete('Felix'), app.db.prepare('SELECT COUNT(*) AS n FROM push_subs').get().n === 0));

  // ---- /my-code
  const f2 = app.admin.invite('Nora'), oldCode = f2.code;
  ok('/my-code: unknown key 401', (await A('/my-code', { key: 'x'.repeat(43), body: {} })).status === 401);
  const mc = await A('/my-code', { key: f2.key, body: {} });
  ok('/my-code gives { ok, code } of the player; the old code stops working, the new one logs in, the key stays valid',
    mc.json?.ok === true && /^NORA-[A-Z2-9]{4}$/.test(mc.json.code) && mc.json.code !== oldCode && (await A('/login-code', { body: { code: oldCode } })).status === 401 && (await A('/login-code', { body: { code: mc.json.code } })).json?.name === 'Nora' && (await A('/state', { key: f2.key })).status === 200);
  ok('/my-code never reaches the log', !logs.join('\n').includes(mc.json.code));
  let lim = 0; for (let i = 0; i < 6; i++) lim = (await A('/my-code', { key: f2.key, body: {} })).status;
  ok('/my-code is rate limited (429 after 5 in 10 minutes)', lim === 429);

  // ---- admin push-keys
  const dir = mkdtempSync(join(tmpdir(), 'chess-push-'));
  try {
    const file = join(dir, 'vapid.json'), outs = [];
    process.env.ONLINE_VAPID_FILE = file;
    runAdmin(['push-keys'], { env: { db: ':memory:', port: 0 }, out: (l) => outs.push(l) });
    const k = vapidLoad(file);
    ok('admin push-keys writes the key file with mode 600 and prints the public key only', (statSync(file).mode & 0o777) === 0o600 && unb(k.public).length === 65 && outs.join('\n').includes(k.public) && !outs.join('\n').includes(k.private));
    let refused = false; try { runAdmin(['push-keys'], { env: { db: ':memory:', port: 0 }, out: () => {} }); } catch (e) { refused = /not overwritten/.test(e.message); }
    ok('push-keys refuses to overwrite an existing file', refused && readFileSync(file, 'utf8').includes(k.private));
    delete process.env.ONLINE_VAPID_FILE;
    let nofile = false; try { runAdmin(['push-keys'], { env: { db: ':memory:', port: 0 }, out: () => {} }); } catch (e) { nofile = /ONLINE_VAPID_FILE/.test(e.message); }
    ok('push-keys without ONLINE_VAPID_FILE says what is missing', nofile);
    ok('vapidLoad of a missing file is null (push off)', vapidLoad(join(dir, 'none.json')) === null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
} finally {
  await app.close(); await off.close(); fake.closeAllConnections?.(); fake.close();
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
