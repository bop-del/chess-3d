// Online login and push, checked end to end (CHE-409, CHE-410). Prints a PASS / FAIL / N/A table, never a key, a code or an endpoint.
//   node tools/online-check.mjs                       local: two servers on one temp database, a local push receiver, the built page in headless Chrome
//   node tools/online-check.mjs --live                the live server (https://chess.borisdiebold.com or --server=<url>), the players Test A and Test B
//                                                     from ~/.cache/chess-3d/online-check.json ({ "a": code, "b": code }, mode 600); --codes=<file>
//   --skip-browser   API checks only      --skip-build   reuse .tmp/online-check-dist
// Live mode is gentle (a few requests per check, one short game that ends in a resign). It cannot see a push arrive (the server needs an
// https receiver it can reach) and cannot read the lease: those rows say N/A with the reason. After the live run the codes in the file
// are the rotated ones (the /my-code check changes them), the file is rewritten.
// Exit: 0 all PASS or N/A, 1 a FAIL, 2 setup error.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createECDH, createDecipheriv, hkdfSync } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ROOT, build, launchBrowser, lanePorts, portAnswers, sleep, settleUi } from './_lib.mjs';
import { runAdmin } from '../server/admin.mjs';
import { vapidCreateFile } from '../server/push.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const LIVE = args.includes('--live');
const LIVE_SERVER = opt('server', 'https://chess.borisdiebold.com').replace(/\/+$/, '');
const CODES = opt('codes', join(homedir(), '.cache', 'chess-3d', 'online-check.json'));
const P = lanePorts().dev;

const rows = [];
const row = (area, check, result, detail = '') => { rows.push({ area, check, result, detail }); };
const ok = (area, check, pass, detail = '') => row(area, check, pass ? 'PASS' : 'FAIL', pass ? '' : detail);
const na = (area, check, why) => row(area, check, 'N/A', why);
const b64u = (b) => Buffer.from(b).toString('base64url');
const cid = (() => { let n = 0; const t = Date.now().toString(36); return () => `chk-${t}-${++n}`; })();

function printTable() {
  const w = Math.max(...rows.map((r) => r.area.length), 4);
  for (const r of rows) console.log(`${r.result.padEnd(4)}  ${r.area.padEnd(w)}  ${r.check}${r.detail ? `  [${r.detail}]` : ''}`);
  const n = (k) => rows.filter((r) => r.result === k).length;
  console.log(`\nonline-check (${LIVE ? 'live ' + LIVE_SERVER : 'local'}): ${rows.length} rows: ${n('PASS')} pass, ${n('FAIL')} fail, ${n('N/A')} not testable automatically`);
  return n('FAIL');
}

// ------------------------------------------------------------ http helpers (node fetch, no browser)
async function call(base, path, { key, body, method = body ? 'POST' : 'GET', origin = 'http://localhost:5173' } = {}) {
  const headers = { Origin: origin };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* none */ }
  return { status: r.status, json, text };
}
const login = async (base, code) => { const r = await call(base, '/login-code', { body: { code } }); return r.status === 200 ? r.json : null; };

// ------------------------------------------------------------ push receiver (local mode): decrypts what the server sends
function decrypt(body, uaPrivate, uaPublic, authSecret) {
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(uaPrivate);
  const ikm = Buffer.from(hkdfSync('sha256', ecdh.computeSecret(asPublic), authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return JSON.parse(plain.subarray(0, plain.lastIndexOf(2)).toString());
}
async function makeReceiver() {
  const got = [];   // { dev, message }
  const status = new Map();   // dev -> status to answer
  const devs = new Map();
  const srv = createServer((req, res) => {
    const parts = []; req.on('data', (d) => parts.push(d));
    req.on('end', () => {
      const dev = req.url.slice(1), d = devs.get(dev);
      let message = null; try { message = decrypt(Buffer.concat(parts), d.priv, d.pub, d.auth); } catch (e) { /* undecryptable */ }
      got.push({ dev, message });
      res.writeHead(status.get(dev) || 201); res.end();
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return {
    got, status,
    device(name) {
      const e = createECDH('prime256v1'); e.generateKeys();
      const auth = Buffer.from(Array.from({ length: 16 }, (_, i) => (i * 11 + name.length * 3) & 255));
      const d = { priv: e.getPrivateKey(), pub: e.getPublicKey(), auth, sub: { endpoint: `${base}/${name}`, keys: { p256dh: b64u(e.getPublicKey()), auth: b64u(auth) } } };
      devs.set(name, d); return d;
    },
    count: (dev) => got.filter((g) => g.dev === dev).length,
    kinds: (dev) => got.filter((g) => g.dev === dev).map((g) => g.message?.kind),
    clear: () => { got.length = 0; },
    close: () => new Promise((r) => srv.close(r)),
  };
}

// ------------------------------------------------------------ local servers
const procs = [];
function startServer(port, env) {
  return new Promise((ok2, bad) => {
    const c = spawn(process.execPath, [join(ROOT, 'server/index.mjs')], { cwd: ROOT, env: { ...process.env, ONLINE_PORT: String(port), ONLINE_HOST: '127.0.0.1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const timer = setTimeout(() => bad(new Error('server did not start: ' + log.slice(-300))), 10000);
    c.stdout.on('data', (d) => { log += d; if (/online server on/.test(log)) { clearTimeout(timer); ok2(c); } });
    c.stderr.on('data', (d) => { log += d; });
    c.on('exit', (code) => { clearTimeout(timer); bad(new Error(`server exited ${code}: ${log.slice(-300)}`)); });
    procs.push(c);
  });
}
async function stopProc(c) { if (!c || c.exitCode !== null) return; c.removeAllListeners('exit'); c.kill('SIGTERM'); for (let i = 0; i < 60 && c.exitCode === null; i++) await sleep(50); if (c.exitCode === null) c.kill('SIGKILL'); }

// ------------------------------------------------------------ a one game helper: A challenges B, B accepts; returns the game and who is white
async function startGame(base, A, B) {
  const ch = await call(base, '/challenge', { key: A.key, body: { to: B.name, cid: cid() } });
  if (ch.status !== 200) return { error: `challenge ${ch.status} ${ch.json?.error || ''}` };
  const ans = await call(base, '/challenge/answer', { key: B.key, body: { id: ch.json.id, accept: true, cid: cid() } });
  if (ans.status !== 200) return { error: `accept ${ans.status} ${ans.json?.error || ''}` };
  const st = (await call(base, '/state', { key: A.key })).json;
  const g = st.games.find((x) => x.opponent === B.name && x.status === 'active');
  if (!g) return { error: 'no active game in the state' };
  return { game: g.id, white: g.color === 'w' ? A : B, black: g.color === 'w' ? B : A };
}

// ============================================================ the run
const A = { name: '', key: '', code: '' }, B = { name: '', key: '', code: '' };
let base = LIVE_SERVER, tmp = '', receiver = null, s1 = null, s2 = null, dbFile = '';
let browser = null, staticSrv = null;

try {
  if (LIVE) {
    if (!existsSync(CODES)) throw new Error(`${CODES} not found: the lead writes {"a": code, "b": code} there`);
    if ((statSync(CODES).mode & 0o077) !== 0) throw new Error(`${CODES} must have mode 600`);
    const c = JSON.parse(readFileSync(CODES, 'utf8'));
    A.code = c.a; B.code = c.b;
  } else {
    tmp = mkdtempSync(join(tmpdir(), 'chess-online-check-'));
    dbFile = join(tmp, 'online.db');
    const vapid = join(tmp, 'vapid.json'); vapidCreateFile(vapid);
    receiver = await makeReceiver();
    const p1 = P + 240, p2 = P + 241;
    if (await portAnswers(p1) || await portAnswers(p2)) throw new Error(`ports ${p1} or ${p2} are in use`);
    base = `http://127.0.0.1:${p1}`;
    const base2 = `http://127.0.0.1:${p2}`;
    const env = { ONLINE_DB: dbFile, ONLINE_VAPID_FILE: vapid, ONLINE_VAPID_SUBJECT: 'mailto:check' + '@' + 'example.com', ONLINE_GAME_URL: 'https://chess.example.com/', ONLINE_LEASE_GRACE_MS: '0' };
    process.env.ONLINE_DB = dbFile; process.env.ONLINE_PORT = String(p1);
    const quiet = { out: () => {} };
    const ia = runAdmin(['invite', 'Test A'], quiet), ib = runAdmin(['invite', 'Test B'], quiet);   // runAdmin returns { name, key, code }
    A.code = ia.code; B.code = ib.code; A.link = ia; B.link = ib;
    s1 = await startServer(p1, env);
    await sleep(300);   // the first server claims the writer lease at its first beat
    s2 = await startServer(p2, env);
    row('setup', `two local servers on one database, push on, lease grace 0`, 'PASS');
    A.base2 = base2;
  }
  const A0 = await login(base, A.code), B0 = await login(base, B.code);
  if (!A0 || !B0) throw new Error('login by code failed for the test players (is the code in the file the current one?)');
  Object.assign(A, A0); Object.assign(B, B0);

  // ---- login by code
  {
    const st = await call(base, '/state', { key: A.key });
    ok('login code', 'POST /login-code gives a key and the name, and the key opens /state', A.name === 'Test A' && st.status === 200 && st.json?.me?.name === 'Test A', `${st.status} ${A.name}`);
    const lower = await login(base, A.code.toLowerCase().replace('-', ' '));
    ok('login code', 'a typed code is tolerated: lower case and a space instead of the dash', !!lower);
    if (LIVE) na('login code', 'a wrong code is refused (401 wrong-code)', 'live: skipped, wrong codes fill the 5 per 10 minutes throttle of this IP (checked locally)');
    else { const bad = await call(base, '/login-code', { body: { code: 'NOPE-2222' } }); ok('login code', 'a wrong code is refused (401 wrong-code)', bad.status === 401 && bad.json?.error === 'wrong-code', String(bad.status)); }
    const A2 = await login(base, A.code);
    const s2k = A2 && (await call(base, '/state', { key: A2.key })).status === 200, s1k = (await call(base, '/state', { key: A.key })).status === 200;
    ok('second session', 'a second login with the code gives a second key; both keys work side by side (logout of one does not touch the other)', !!A2 && A2.key !== A.key && s1k && s2k);
    A.key2 = A2?.key;
  }

  // ---- game, chat, push (the game runs on both modes; the push part only local)
  const g = await startGame(base, A, B);
  if (g.error) ok('game', 'challenge, accept and start a game', false, g.error);
  else {
    ok('game', 'challenge, accept and start a game', true);
    const W = g.white, K = g.black;
    const mv = await call(base, '/move', { key: W.key, body: { game: g.game, uci: 'e2e4', cid: cid() } });
    const ct = await call(base, '/chat', { key: K.key, body: { to: W.name, text: 'hallo vom check', cid: cid() } });
    ok('game', 'a move and a chat message go through', mv.status === 200 && ct.status === 200, `move ${mv.status} ${mv.json?.error || ''}, chat ${ct.status} ${ct.json?.error || ''}`);
    const fresh = await login(base, A.code);   // a new session (a reload with a lost page): state comes from the server
    const st = fresh && (await call(base, '/state', { key: fresh.key })).json;
    const gg = st?.games?.find((x) => x.id === g.game);
    ok('reload', 'a fresh session sees the running game, its moves and the chat', !!gg && gg.moves.length === 1 && JSON.stringify(st.chats || {}).includes('hallo vom check'), JSON.stringify({ games: st?.games?.length, moves: gg?.moves?.length }));
    const dup = await call(base, '/move', { key: W.key, body: { game: g.game, uci: 'e2e4', cid: cid() } });
    ok('game', 'an illegal repeat move is refused (400)', dup.status === 400 || dup.status === 409, String(dup.status));

    // ---- push, local only
    if (LIVE) {
      const k = await call(base, '/push/key', { key: A.key });
      row('push', `live server push is ${k.status === 200 ? 'on (GET /push/key 200)' : 'off (' + k.status + ')'}`, k.status === 200 ? 'PASS' : 'FAIL', k.status === 200 ? '' : 'push routes missing');
      for (const ev of ['challenge', 'accepted', 'turn', 'chat']) na('push', `exactly one push for ${ev}`, 'needs an https receiver the VPS can reach (the server refuses http endpoints); see the device steps');
      na('push', 'no push with an open live stream', 'same reason');
      na('push', 'an expired subscription (404/410) is removed', 'same reason; the server log line "subscription removed" is the proof');
      na('lease', 'only one server sends', 'needs the lease row via ssh (the lead reads it)');
      await call(base, '/resign', { key: W.key, body: { game: g.game, cid: cid() } });
    } else {
      await call(base, '/resign', { key: W.key, body: { game: g.game, cid: cid() } });
      await pushSuite();
    }
  }

  // ---- the browser layer
  if (!args.includes('--skip-browser')) await browserSuite();

  // ---- after a deploy: a restarted server on the same database (local) keeps keys and code
  if (!LIVE) {
    const keyBefore = A.key;
    await stopProc(s1); s1 = null;
    s1 = await startServer(P + 240, { ONLINE_DB: dbFile, ONLINE_LEASE_GRACE_MS: '0' });
    const st = await call(base, '/state', { key: keyBefore });
    const again = await login(base, A.code);
    ok('after deploy', 'a restarted server on the same database: the old key and the code still work', st.status === 200 && !!again, String(st.status));
  } else {
    na('after deploy', 'login survives a server deploy', 'no deploy from here; owner step: log in, wait for the next deploy, reload the app');
  }

  // ---- a fresh code last (the old code and the codes in the file change)
  {
    const old = A.code;
    const r = await call(base, '/my-code', { key: A.key, body: {} });
    const newCode = r.json?.code;
    ok('my-code', 'POST /my-code gives a fresh code', r.status === 200 && typeof newCode === 'string' && newCode !== old, String(r.status));
    if (newCode) {
      const o = await call(base, '/login-code', { body: { code: old } });
      ok('my-code', 'the old code fails (401)', o.status === 401, String(o.status));
      ok('my-code', 'the keys of before stay valid', (await call(base, '/state', { key: A.key })).status === 200 && (!A.key2 || (await call(base, '/state', { key: A.key2 })).status === 200));
      const n = await login(base, newCode);
      ok('my-code', 'the new code logs in', !!n);
      A.code = newCode;
      if (LIVE) writeFileSync(CODES, JSON.stringify({ a: A.code, b: B.code }) + '\n', { mode: 0o600 });
    }
  }
} catch (e) {
  row('setup', 'run', 'FAIL', String(e.message || e).slice(0, 300));
  process.exitCode = 2;
} finally {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { staticSrv?.close(); } catch (e) { /* ignore */ }
  for (const c of procs) { try { await stopProc(c); } catch (e) { /* ignore */ } }
  try { await receiver?.close(); } catch (e) { /* ignore */ }
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  const failed = printTable();
  if (failed) process.exitCode = process.exitCode || 1;
  process.exit(process.exitCode || 0);
}

// ============================================================ push suite (local)
async function pushSuite() {
  const area = 'push';
  const a = receiver.device('a'), b = receiver.device('b'), b2 = receiver.device('b2');
  const sub = async (who, d) => (await call(base, '/push/subscribe', { key: who.key, body: d.sub })).status;
  ok(area, 'subscribe Test A and Test B (https or local endpoints, valid keys)', (await sub(A, a)) === 200 && (await sub(B, b)) === 200);
  const settle = async (dev, want) => { for (let i = 0; i < 40 && receiver.count(dev) < want; i++) await sleep(100); await sleep(500); };   // wait for it, then a moment for a duplicate
  const only = (dev, kind, others) => receiver.count(dev) === 1 && receiver.kinds(dev)[0] === kind && others.every((o) => receiver.count(o) === 0);
  const one = async (label, dev, kind, others, act) => { receiver.clear(); await act(); await settle(dev, 1); ok(area, label, only(dev, kind, others), `${dev}: ${receiver.kinds(dev).join() || 'none'}; others ${others.map((o) => receiver.count(o)).join()}`); };

  // challenge A -> B, no stream open
  let chId = null;
  await one('exactly one push for a challenge, to the challenged player only', 'b', 'challenge', ['a'], async () => { const r = await call(base, '/challenge', { key: A.key, body: { to: B.name, cid: cid() } }); chId = r.json?.id; });
  // accept B -> A
  await one('exactly one push for an accepted challenge, to the challenger only', 'a', 'accepted', ['b'], async () => { await call(base, '/challenge/answer', { key: B.key, body: { id: chId, accept: true, cid: cid() } }); });
  const st = (await call(base, '/state', { key: A.key })).json;
  const gm = st.games.find((x) => x.opponent === B.name && x.status === 'active');
  const white = gm.color === 'w' ? A : B, black = gm.color === 'w' ? B : A;
  const dev = (p) => (p === A ? 'a' : 'b');
  await one('exactly one push for a move, to the player on move only', dev(black), 'turn', [dev(white)], async () => { await call(base, '/move', { key: white.key, body: { game: gm.id, uci: 'e2e4', cid: cid() } }); });
  await one('exactly one push for a chat message, to the receiver only, without the text', dev(white), 'chat', [dev(black)], async () => { await call(base, '/chat', { key: black.key, body: { to: white.name, text: 'geheimer text', cid: cid() } }); });
  ok(area, 'the chat text is not in any push', !JSON.stringify(receiver.got.map((x) => x.message)).includes('geheimer'));
  // open stream: none
  const ac = new AbortController();
  const stream = await fetch(`${base}/events`, { headers: { Authorization: `Bearer ${white.key}` }, signal: ac.signal });
  const reader = stream.body.getReader(); reader.read().catch(() => {});
  await sleep(300);
  receiver.clear();
  await call(base, '/chat', { key: black.key, body: { to: white.name, text: 'mit stream', cid: cid() } });
  await sleep(1200);
  ok(area, 'no push while the receiver has a live stream open', receiver.count(dev(white)) === 0, receiver.kinds(dev(white)).join());
  ac.abort(); await sleep(500);
  await one('after the stream closes the next event pushes again, once', dev(white), 'chat', [dev(black)], async () => { await call(base, '/chat', { key: black.key, body: { to: white.name, text: 'ohne stream', cid: cid() } }); });
  // a retried POST (same cid) is applied once, so one push
  const same = cid();
  receiver.clear();
  await call(base, '/chat', { key: black.key, body: { to: white.name, text: 'retry', cid: same } });
  await call(base, '/chat', { key: black.key, body: { to: white.name, text: 'retry', cid: same } });
  await settle(dev(white), 1);
  ok(area, 'a retried POST (same cid) sends one push, not two', receiver.count(dev(white)) === 1, String(receiver.count(dev(white))));
  // game over
  receiver.clear();
  await call(base, '/resign', { key: black.key, body: { game: gm.id, cid: cid() } });
  await settle('a', 1);
  ok(area, 'game over: one push to each player', receiver.count('a') === 1 && receiver.count('b') === 1 && receiver.kinds('a')[0] === 'over', `${receiver.count('a')} ${receiver.count('b')}`);
  // expired subscription: 410 removes it
  await sub(white, b2);   // a second device of the white player (same player, own endpoint)
  receiver.status.set('b2', 410);
  const wdev = dev(white);
  receiver.clear();
  await call(base, '/challenge', { key: black.key, body: { to: white.name, cid: cid() } });
  await settle(wdev, 1);
  ok(area, 'an expired subscription (410) got its one last try', receiver.count('b2') === 1, String(receiver.count('b2')));
  const q = await call(base, '/state', { key: white.key });
  const cid2 = q.json.challenges.in[0]?.id;
  receiver.clear();
  if (cid2) await call(base, '/challenge/answer', { key: white.key, body: { id: cid2, accept: false, cid: cid() } });
  await call(base, '/challenge', { key: black.key, body: { to: white.name, cid: cid() } });
  await settle(wdev, 1);
  ok(area, 'after the 410 that subscription gets nothing more, the other device still gets one', receiver.count('b2') === 0 && receiver.count(wdev) === 1, `b2 ${receiver.count('b2')}, ${wdev} ${receiver.count(wdev)}`);
  // lease
  const rd = new DatabaseSync(dbFile, { readOnly: true });
  const lease = rd.prepare('SELECT owner, beat FROM writer_lease').all();
  rd.close();
  ok('lease', 'the lease table has exactly one row (one writer)', lease.length === 1, String(lease.length));
  receiver.clear();
  const c2 = await call(A.base2, '/chat', { key: black.key, body: { to: white.name, text: 'ueber server zwei', cid: cid() } });   // the second server answers the request
  await sleep(1500);
  const via2 = receiver.got.length;
  receiver.clear();
  await call(base, '/chat', { key: black.key, body: { to: white.name, text: 'zweiter weg', cid: cid() } });
  await settle(wdev, 1);
  ok('lease', 'the same event handled by the non-writer sends no push, by the writer exactly one (only one server sends)', c2.status === 200 && via2 === 0 && receiver.count(wdev) === 1, `via second ${via2}, via first ${receiver.count(wdev)}`);
}

// ============================================================ browser suite
async function browserSuite() {
  const area = 'browser';
  const OUT = '.tmp/online-check-dist';
  if (!args.includes('--skip-build')) build(OUT);
  const serveDir = join(ROOT, '.tmp/online-check-serve');
  rmSync(serveDir, { recursive: true, force: true }); mkdirSync(serveDir, { recursive: true });
  cpSync(join(ROOT, OUT), serveDir, { recursive: true });
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
  staticSrv = createServer((req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p.endsWith('/')) p += 'index.html';
    try { const body = readFileSync(join(serveDir, p)); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body); } catch (e) { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => staticSrv.listen(P + 242, '127.0.0.1', r));
  const PAGE = `http://127.0.0.1:${P + 242}`;
  browser = await launchBrowser({ w: 1280, h: 720 });
  const Q = `quality=low&intro=0&ai=0&sound=0&manual=0&online=${encodeURIComponent(base)}&open=online`;
  const open = async (ctx, url) => {
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('chess3d.lang', 'de'); sessionStorage.setItem('seeded', '1'); } } catch (e) { /* blocked */ } });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    await settleUi(page);
    return page;
  };
  const stored = (page) => page.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('chess3d.online') || 'null'); return v ? { name: v.name, has: !!v.key, server: v.server, key: v.key } : null; } catch (e) { return null; } });
  const until = async (page, fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch (e) { return false; } };
  const typeCode = async (page, code) => { await page.type('.ocode input', code); await page.click('.ocode button[type=submit]'); return until(page, () => window.__chessOnline?.status === 'connected' || !!window.__chessOnline?.state?.me, null, 20000); };

  // 1. login by typing the code, in a fresh browser profile (a context)
  const ctx1 = await browser.createBrowserContext(), ctx2 = await browser.createBrowserContext(), ctx3 = await browser.createBrowserContext();
  const p1 = await open(ctx1, `${PAGE}/?${Q}`);
  ok(area, 'login by typing the code in the Online tab', await typeCode(p1, A.code));
  const s1v = await stored(p1);
  ok(area, 'the login is stored in localStorage chess3d.online (server, key, name)', !!s1v?.has && s1v.name === 'Test A' && s1v.server === base, JSON.stringify({ ...s1v, key: undefined }));
  // 2. reload
  await p1.reload({ waitUntil: 'load' });
  await p1.waitForFunction(() => window.__chessReady, { timeout: 120000, polling: 100 }); await settleUi(p1);
  ok(area, 'after a reload the session is still there (no code asked, connected)', await until(p1, () => !!window.__chessOnline?.state?.me && !document.querySelector('.ologin:not([hidden])'), null, 20000));
  // 3. a running game and its chat survive the reload
  const gp = await startGame(base, A, B);
  if (!gp.error) {
    await call(base, '/chat', { key: B.key, body: { to: A.name, text: 'reload-chat', cid: cid() } });
    await p1.reload({ waitUntil: 'load' });
    await p1.waitForFunction(() => window.__chessReady, { timeout: 120000, polling: 100 }); await settleUi(p1);
    const seen = await until(p1, () => (window.__chessOnline?.state?.games || []).some((x) => x.status === 'active' && x.opponent === 'Test B'), null, 20000);
    const chat = await p1.evaluate(() => JSON.stringify(window.__chessOnline?.state?.chats || {}).includes('reload-chat'));
    ok(area, 'a running game and its chat are still there after a reload', seen && chat, `game ${seen} chat ${chat}`);
    await call(base, '/resign', { key: A.key, body: { game: gp.game, cid: cid() } });
  } else ok(area, 'a running game and its chat are still there after a reload', false, gp.error);
  // 4. second profile: its own storage, own login by code, both work
  const p2 = await open(ctx2, `${PAGE}/?${Q}`);
  ok(area, 'a second browser profile starts logged out (own storage, like Safari vs the home screen app)', !(await stored(p2)));
  ok(area, 'login by code in the second profile works', await typeCode(p2, A.code));
  const k1 = (await stored(p1))?.key, k2 = (await stored(p2))?.key;
  ok(area, 'the two profiles hold two different keys that both work', !!k1 && !!k2 && k1 !== k2 && (await call(base, '/state', { key: k1 })).status === 200 && (await call(base, '/state', { key: k2 })).status === 200);
  // 5. logout in one profile does not log the other out
  await p1.evaluate(() => localStorage.removeItem('chess3d.online'));
  await p2.reload({ waitUntil: 'load' }); await p2.waitForFunction(() => window.__chessReady, { timeout: 120000, polling: 100 }); await settleUi(p2);
  ok(area, 'logout (login removed) in one profile leaves the other profile logged in', await until(p2, () => !!window.__chessOnline?.state?.me, null, 20000));
  await p1.reload({ waitUntil: 'load' }); await p1.waitForFunction(() => window.__chessReady, { timeout: 120000, polling: 100 }); await settleUi(p1);
  ok(area, 'the logged out profile asks for the code again and logs in again', await until(p1, () => !!document.querySelector('.ologin:not([hidden]) .ocode input'), null, 15000) && await typeCode(p1, A.code));
  // 6. invite link (local: the link carries the key in the fragment)
  if (!LIVE && B.link) {
    const url = new URL(B.link.key ? `${PAGE}/?online=${encodeURIComponent(base)}&open=online#online=${B.link.key}` : PAGE);
    const p3 = await open(ctx3, url.toString().replace(/&?quality[^&]*/, '') + '');
    const sv = await stored(p3);
    const hashGone = await p3.evaluate(() => !location.hash);
    ok(area, 'invite link login: the key from the fragment is stored, the address bar is cleaned', !!sv?.has && hashGone, JSON.stringify({ has: sv?.has, hashGone }));
    ok(area, 'invite link login: the page connects as the invited player', await until(p3, () => window.__chessOnline?.state?.me?.name === 'Test B', null, 20000));
    ok(area, 'a login by link in one profile is not in another (Safari link vs home screen app: needs the code or a second link there)', !(await stored(p2).then((s) => s && s.name === 'Test B')));
  } else na(area, 'invite link login', 'live: the link key is not in the codes file; owner step on the device');
  // 7. app update: new service worker build, old caches go, the login stays
  {
    const ctx4 = await browser.createBrowserContext();
    const pu = await open(ctx4, `${PAGE}/?${Q}&sw=1`);
    await typeCode(pu, B.code);
    const ready = await pu.evaluate(async () => { const r = await navigator.serviceWorker.ready; for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise((x) => setTimeout(x, 100)); return { active: !!r.active, caches: await caches.keys() }; }).catch(() => null);
    if (!ready || !ready.active) na(area, 'login survives an app update (service worker)', 'the service worker did not register in this build');
    else {
      const fs = await import('node:fs');
      const swPath = join(serveDir, 'sw.js'), src = fs.readFileSync(swPath, 'utf8');
      fs.writeFileSync(swPath, src.replace(/const BUILD = '[^']*'/, "const BUILD = 'check-updated'"));
      const before = ready.caches.filter((k) => k.startsWith('chess3d-'));
      await pu.evaluate(() => caches.open('other-app-cache').then((c) => c.put('/x', new Response('1'))));   // not ours: must survive
      const res = await pu.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg.update();
        for (let i = 0; i < 100 && !reg.waiting; i++) await new Promise((x) => setTimeout(x, 100));
        if (!reg.waiting) return { error: 'no waiting worker' };
        reg.waiting.postMessage({ type: 'skip-waiting' });
        for (let i = 0; i < 100 && !(reg.active && reg.active.state === 'activated' && !reg.waiting); i++) await new Promise((x) => setTimeout(x, 100));
        await new Promise((x) => setTimeout(x, 500));
        return { caches: await caches.keys(), login: !!JSON.parse(localStorage.getItem('chess3d.online') || 'null')?.key };
      });
      fs.writeFileSync(swPath, src);
      if (res.error) ok(area, 'login survives an app update (service worker)', false, res.error);
      else {
        ok(area, 'app update: the old chess3d- cache is deleted, the new one is there, a foreign cache stays', before.length > 0 && !res.caches.includes(before[0]) && res.caches.includes('chess3d-check-updated') && res.caches.includes('other-app-cache'), JSON.stringify({ before, after: res.caches }));
        ok(area, 'app update: the login in localStorage is untouched', res.login);
        await pu.reload({ waitUntil: 'load' }); await pu.waitForFunction(() => window.__chessReady, { timeout: 120000, polling: 100 }); await settleUi(pu);
        ok(area, 'app update: after the reload on the new build the session is still there', await until(pu, () => window.__chessOnline?.state?.me?.name === 'Test B', null, 20000));
      }
    }
  }
  // 8. what a script cannot see
  na(area, 'Safari to home screen app: login does not carry over', 'storage of the home screen app is apart from Safari (shown by the two profiles above); confirm on the iPhone');
  na(area, 'Safari deletes script storage after 7 days without a visit', 'browser policy, not testable; home screen apps are exempt (risk and recommendation in the report)');
}
