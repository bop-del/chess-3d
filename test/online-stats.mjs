// Own mini stats (CHE-291, fast tier, no browser): POST /events accepted only with a player key, validation and limits per key,
// the daily roll up and the 90 day cleanup with a fake clock, /stats only with the admin secret, no key or secret in a log line,
// and the client sender (batching, keepalive on pagehide, quiet on failure) with a fake window.
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { dayOf, DAILY_MAX, BATCH_MAX, RAW_DAYS } from '../server/stats.mjs';
import { startStats, uaFamily, fpsTier } from '../src/online/stats.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const DAY = 24 * 3600 * 1000;
let clock = Date.UTC(2026, 9, 7, 12);
const SECRET = 'test-admin-secret-1234';
const logs = [];
const app = createOnlineServer({ db: openDb(':memory:'), now: () => clock, adminSecret: SECRET, log: (l) => logs.push(l) });
const port = await app.listen(0, '127.0.0.1');
const BASE = `http://127.0.0.1:${port}`;
const dev = { ua: 'safari', touch: true, w: 390, h: 844, gpu: 'gpu' };
const post = async (path, body, headers = {}) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: r.status, text: await r.text() };
};
const rows = (sql) => app.db.prepare(sql).all();

try {
  const felix = app.admin.invite('Felix'), mia = app.admin.invite('Mia');
  const auth = (k) => ({ Authorization: `Bearer ${k}` });
  const ev = (e) => ({ events: [{ device: dev, ...e }] });
  const good = { kind: 'feature', name: 'online.start' };

  // ------------------------------------------------------------ key check
  ok('no key: refused 401, nothing stored', (await post('/events', ev(good))).status === 401 && rows('SELECT * FROM events').length === 0);
  ok('unknown key: refused 401', (await post('/events', ev(good), auth('x'.repeat(43)))).status === 401);
  ok('a valid key: accepted 202', (await post('/events', ev(good), auth(felix.key))).status === 202 && rows('SELECT * FROM events').length === 1);
  app.admin.revoke('Mia');
  ok('a revoked player key is refused', (await post('/events', ev(good), auth(mia.key))).status === 401);

  // ------------------------------------------------------------ kinds and validation
  const all = { events: [
    { kind: 'error', message: 'boom', where: 'main.js:12', device: dev },
    { kind: 'feature', name: 'puzzle.open', device: dev },
    { kind: 'perf', tier: 'mid', loadMs: 1800, device: dev },
    { kind: 'session', length: 300, device: dev },
  ] };
  ok('error, feature, perf and session events are accepted', (await post('/events', all, auth(felix.key))).status === 202 && rows('SELECT DISTINCT kind FROM events').length === 4);
  const stored = JSON.stringify(rows('SELECT * FROM events'));
  ok('no key, IP or player id is stored with an event', !stored.includes(felix.key) && !stored.includes('127.0.0.1') && !/player/i.test(stored));
  const bads = [
    ['unknown kind', ev({ kind: 'hack' })], ['error without message', ev({ kind: 'error', where: 'x' })], ['perf with a bad tier', ev({ kind: 'perf', tier: 'ultra', loadMs: 5 })],
    ['perf with a huge load', ev({ kind: 'perf', tier: 'low', loadMs: 1e9 })], ['no device', { events: [good] }], ['empty batch', { events: [] }],
    ['batch too big', { events: Array.from({ length: BATCH_MAX + 1 }, () => ({ device: dev, ...good })) }], ['not an object', 'null'],
  ];
  for (const [n, b] of bads) { const r = await post('/events', b, auth(felix.key)); ok(`refused: ${n}`, r.status === 400, `${r.status}`); }
  clock += 61e3;
  ok('a body over 16 KB is refused 413', (await post('/events', { events: [{ device: dev, kind: 'error', message: 'x'.repeat(20000), where: 'w' }] }, auth(felix.key))).status === 413);
  await post('/events', ev({ kind: 'error', message: 'y'.repeat(900), where: 'w' }), auth(felix.key));
  ok('a long message is cut to 300 characters', Math.max(...rows("SELECT data FROM events WHERE kind = 'error'").map((r) => JSON.parse(r.data).message.length)) === 300);

  // ------------------------------------------------------------ limits per key
  let last = 0;
  for (let i = 0; i < 12; i++) last = (await post('/events', ev(good), auth(felix.key))).status;
  ok('more than 10 requests a minute per key: 429', last === 429);
  clock += 61e3;
  ok('the rate limit lifts after the window', (await post('/events', ev(good), auth(felix.key))).status === 202);
  const jim = app.admin.invite('Jim');
  let capped = 0, st = 202;
  for (let i = 0; capped < DAILY_MAX + 100 && st !== 429 && i < 200; i++) {
    if (i % 9 === 0) clock += 61e3;
    const r = await post('/events', { events: Array.from({ length: BATCH_MAX }, () => ({ device: dev, ...good })) }, auth(jim.key));
    st = r.status; if (st === 202) capped += BATCH_MAX;
  }
  ok('a daily cap per key stops the flood (429 daily-limit)', st === 429 && capped <= DAILY_MAX, `${st} ${capped}`);

  // ------------------------------------------------------------ roll up and cleanup (fake clock)
  const d0 = dayOf(clock);
  ok('maintain keeps today raw and does not roll it up', (app.stats.maintain(), rows('SELECT * FROM stats_daily WHERE day = ?'.replace('?', `'${d0}'`)).length === 0));
  clock += DAY;
  app.stats.maintain();
  const sum = rows(`SELECT n FROM stats_daily WHERE day = '${d0}' AND kind = 'feature' AND name = 'online.start'`)[0];
  const rawN = rows(`SELECT COUNT(*) AS n FROM events WHERE day = '${d0}' AND kind = 'feature' AND name = 'online.start'`)[0].n;
  ok('the next day the finished day is rolled up per day, kind, name and device class', sum && sum.n === rawN && rawN > 5, JSON.stringify(sum));
  ok('the roll up is idempotent', (app.stats.maintain(), rows(`SELECT n FROM stats_daily WHERE day = '${d0}' AND kind = 'feature' AND name = 'online.start'`)[0].n === rawN));
  ok('the device class is "ua touch" only', rows('SELECT DISTINCT device FROM stats_daily').every((r) => r.device === 'safari touch'));
  clock += (RAW_DAYS - 1) * DAY;
  app.stats.maintain();
  ok('raw events are still there at 90 days', rows('SELECT * FROM events WHERE day = ?'.replace('?', `'${d0}'`)).length > 0);
  clock += 2 * DAY;
  const r = app.stats.maintain();
  ok('raw events older than 90 days are deleted', r.purged > 0 && rows(`SELECT * FROM events WHERE day = '${d0}'`).length === 0);
  ok('the daily sums stay forever', rows(`SELECT n FROM stats_daily WHERE day = '${d0}'`).length > 0 && rows(`SELECT n FROM stats_daily WHERE day = '${d0}' AND kind = 'feature' AND name = 'online.start'`)[0].n === rawN);

  // ------------------------------------------------------------ /stats auth
  const get = async (path, headers = {}, method = 'GET', body) => {
    const x = await fetch(BASE + path, { method, headers, body });
    return { status: x.status, text: await x.text(), headers: x.headers };
  };
  const s1 = await get('/stats');
  ok('/stats without the secret: login form, no data (401)', s1.status === 401 && /type="password"/.test(s1.text) && !/online\.start/.test(s1.text));
  ok('/stats with a player key is refused', (await get('/stats', auth(felix.key))).status === 401);
  ok('/stats with a wrong secret is refused', (await get('/stats', auth('nope'))).status === 401);
  const nowClock = clock; clock = Date.parse(d0) + DAY + 3600e3;   // look at the days with data: the rolled up day, 30 day window
  const s2 = await get('/stats', auth(SECRET));
  clock = nowClock;
  ok('/stats with the secret in the header: the dashboard', s2.status === 200 && /Last 7 days/.test(s2.text) && /Last 30 days/.test(s2.text) && /online\.start/.test(s2.text) && /Errors by device/.test(s2.text), s2.status + ' ' + s2.text.replace(/<style>[^]*<\/style>/, '').slice(0, 600));
  ok('/stats is no store, not indexable, scripts blocked', /no-store/.test(s2.headers.get('cache-control')) && /default-src 'none'/.test(s2.headers.get('content-security-policy')) && /noindex/.test(s2.text));
  const s3 = await get('/stats', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'POST', `secret=${encodeURIComponent(SECRET)}`);
  ok('/stats with the secret in a form post: the dashboard', s3.status === 200 && /chess-3d stats/.test(s3.text));
  const s4 = await get('/stats?secret=' + SECRET);
  ok('the secret in a URL does not work', s4.status === 401);
  const evil = await post('/events', ev({ kind: 'error', message: '<script>alert(1)</script>', where: 'a<b' }), auth(jim.key));
  clock += DAY;
  ok('the dashboard escapes error text', !/<script>alert/.test((await get('/stats', auth(SECRET))).text));
  const off = createOnlineServer({ db: openDb(':memory:') });
  const op = await off.listen(0, '127.0.0.1');
  ok('without ONLINE_ADMIN_SECRET /stats does not exist (404)', (await fetch(`http://127.0.0.1:${op}/stats`, { headers: auth('anything') })).status === 404);
  await off.close();
  for (let i = 0; i < 7; i++) await get('/stats', auth('wrong' + i));
  ok('wrong secrets are throttled (429)', (await get('/stats', auth(SECRET))).status === 429);
  ok('GET /events (the live stream) still needs a key', (await get('/events')).status === 401);
  ok('no key or secret in any logged line', !logs.some((l) => l.includes(felix.key) || l.includes(SECRET)) && logs.every((l) => /^[A-Z]+ \/[\w/-]* \d{3}$/.test(l)), logs.find((l) => !/^[A-Z]+ \/[\w/-]* \d{3}$/.test(l)));

  // ------------------------------------------------------------ challenge/cancel
  clock += 61e3 * 3;
  const ann = app.admin.invite('Anna'), bob = app.admin.invite('Bob');
  const sj = async (k, path, body) => { const r = await post(path, body, auth(k)); return { status: r.status, json: r.text ? JSON.parse(r.text) : null }; };
  const ch = (await sj(ann.key, '/challenge', { to: 'Bob' })).json.id;
  const bobState = async () => (await fetch(BASE + '/state', { headers: auth(bob.key) }).then((r) => r.json()));
  ok('a challenge shows up for the challenged player', (await bobState()).challenges.in.length === 1);
  ok('another key cannot cancel it (nothing cancelled)', (await sj(bob.key, '/challenge/cancel', { id: ch })).json.cancelled === 0 && (await bobState()).challenges.in.length === 1);
  const c1 = await sj(ann.key, '/challenge/cancel', { id: ch, cid: 'cc1' });
  ok('the challenger withdraws it, the challenged state drops it', c1.status === 200 && c1.json.cancelled === 1 && (await bobState()).challenges.in.length === 0);
  ok('a retry with the same client id is applied once', (await sj(ann.key, '/challenge/cancel', { id: ch, cid: 'cc1' })).json.cancelled === 1);
  ok('cancelling with nothing open is fine (idempotent)', (await sj(ann.key, '/challenge/cancel', { id: ch })).json.cancelled === 0);
  ok('cancel without a key is 401', (await post('/challenge/cancel', { id: ch })).status === 401);
  await sj(ann.key, '/challenge', { to: 'Bob' });
  ok('cancel without an id withdraws the open one', (await sj(ann.key, '/challenge/cancel', {})).json.cancelled === 1);

  // ------------------------------------------------------------ the client sender
  const listeners = {}, calls = [];
  const mk = (extra = {}) => ({
    win: { __chessStats: null, screen: { width: 390, height: 844 }, addEventListener: (n, f) => { listeners[n] = f; }, removeEventListener: () => {}, performance: { getEntriesByType: () => [{ loadEventEnd: 1234 }] }, ...extra.win },
    doc: { createElement: () => ({ getContext: () => null }), addEventListener: (n, f) => { listeners['doc:' + n] = f; }, removeEventListener: () => {} },
    nav: { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit Version/17 Mobile Safari/604.1', maxTouchPoints: 5 },
    fetch: (u, o) => { calls.push({ u, o }); return extra.reject ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true }); },
    setInterval: () => 0,
  });
  ok('uaFamily and fpsTier', uaFamily('Mozilla Chrome/120 Safari/537') === 'chrome' && uaFamily('Version/17 Safari/604') === 'safari' && uaFamily('Edg/1') === 'edge' && fpsTier(60) === 'high' && fpsTier(30) === 'mid' && fpsTier(10) === 'low');
  ok('no server or no key: the sender does not start', startStats({ server: '', key: 'k', env: mk() }) === null && startStats({ server: 'http://x', key: '', env: mk() }) === null);
  const env = mk();
  const s = startStats({ server: 'http://x:1/', key: 'KEY', env });
  ok('start: one feature event queued, nothing sent yet (never blocks)', s && calls.length === 0 && s.queue().length === 1 && s.queue()[0].kind === 'feature');
  listeners.error({ message: 'oops', filename: 'http://h/a/main.js', lineno: 7 });
  listeners['doc:chess:feature']({ detail: 'puzzle.open' });
  s.flush();
  const body = JSON.parse(calls[0].o.body);
  ok('flush: one POST to /events with the key in the header, batched', calls.length === 1 && calls[0].u === 'http://x:1/events' && calls[0].o.headers.Authorization === 'Bearer KEY' && body.events.length === 3);
  ok('events carry the device (ua family, touch, screen, GPU tier), no UA string', body.events.every((e) => e.device.ua === 'safari' && e.device.touch === true && e.device.w === 390 && e.device.gpu === 'unknown') && !calls[0].o.body.includes('Mozilla'));
  ok('an error event has message and where', body.events.some((e) => e.kind === 'error' && e.message === 'oops' && e.where === 'main.js:7'));
  listeners.pagehide();
  const last2 = calls[calls.length - 1];
  ok('pagehide: session end flushed with keepalive', last2.o.keepalive === true && JSON.parse(last2.o.body).events.some((e) => e.kind === 'session'));
  ok('starting twice with the same key reuses the sender', startStats({ server: 'http://x:1/', key: 'KEY', env }) === s);
  s.stop();
  const bad = mk({ reject: true });
  const s5 = startStats({ server: 'http://x', key: 'K2', env: bad });
  s5.flush(); await new Promise((r) => setTimeout(r, 10));
  ok('a failing send is swallowed and not retried', calls.length === 3 && s5.queue().length === 0);
  s5.stop();
  // the sender against the real server
  const real = startStats({ server: BASE, key: felix.key, env: { ...mk(), fetch: (u, o) => fetch(u, o) } });
  const before = rows('SELECT COUNT(*) AS n FROM events')[0].n;
  clock += 61e3 * 3; real.feature('end.to.end'); real.flush(); await new Promise((r) => setTimeout(r, 300));
  ok('the client payload is accepted by the server', rows('SELECT COUNT(*) AS n FROM events')[0].n === before + 2 && rows("SELECT * FROM events WHERE name = 'end.to.end'").length === 1);
  real.stop();
} finally {
  await app.close();
}
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
