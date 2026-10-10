// Feedback (CHE-404, fast tier, no browser): POST /feedback needs no login, validation and size limits, 5 per hour per device,
// the admin GET only with the secret and in id order, the login name from a key, and the client helpers (context, picture, send).
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { TEXT_MAX, PICTURE_MAX, PER_DEVICE } from '../server/feedback.mjs';
import { buildContext, sendFeedback, deviceId, fitPicture } from '../src/feedback/core.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
let clock = Date.UTC(2026, 9, 9, 12);
const SECRET = 'test-admin-secret-1234';
const logs = [];
const app = createOnlineServer({ db: openDb(':memory:'), now: () => clock, adminSecret: SECRET, log: (l) => logs.push(l) });
const port = await app.listen(0, '127.0.0.1');
const BASE = `http://127.0.0.1:${port}`;
const post = async (body, headers = {}) => {
  const r = await fetch(BASE + '/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const get = async (query = '', headers = {}) => {
  const r = await fetch(`${BASE}/feedback${query}`, { headers });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const JPEG = '/9j/4AAQSkZJRgABAQ' + 'A'.repeat(100);
const good = (n = 1) => ({ kind: 'bug', text: `the knight jumps wrong ${n}`, device: 'dev-aaaaaaaa', context: { version: '1.12.0', fen: 'x' } });

try {
  const r1 = await post(good());
  ok('anyone can send, no login: 201 with an id', r1.status === 201 && r1.json.id === 1, JSON.stringify(r1));
  ok('stored with kind, text and context, no picture', (() => { const row = app.db.prepare('SELECT * FROM feedback WHERE id = 1').get(); return row.kind === 'bug' && row.text.startsWith('the knight') && JSON.parse(row.context).version === '1.12.0' && row.picture === null && row.name === ''; })());

  const bads = [
    ['unknown kind', { ...good(), kind: 'rant' }], ['empty text', { ...good(), text: '   ' }], ['no text', { kind: 'wish' }],
    ['text over 2000', { ...good(), text: 'x'.repeat(TEXT_MAX + 1) }], ['picture that is no jpeg', { ...good(), picture: 'AAAA' }],
    ['picture with bad characters', { ...good(), picture: '/9j/<script>' }], ['context as a list', { ...good(), context: [1] }], ['not an object', 'null'],
  ];
  for (const [n, b] of bads) { clock += 1; const r = await post(b); ok(`refused: ${n}`, r.status === 400, `${r.status}`); }
  ok('text of exactly 2000 characters is accepted', (await post({ ...good(), device: 'dev-bbbbbbbb', text: 'y'.repeat(TEXT_MAX) })).status === 201);
  ok('a picture over the cap is refused 413', (await post({ ...good(), device: 'dev-cccccccc', picture: '/9j/' + 'A'.repeat(PICTURE_MAX) })).status === 413);
  ok('a body far over the cap is refused 413', (await post({ ...good(), device: 'dev-cccccccc', context: { x: 'z'.repeat(400000) } })).status === 413);
  ok('a small JPEG is stored', (await post({ ...good(), device: 'dev-dddddddd', picture: JPEG })).status === 201 && app.db.prepare('SELECT picture FROM feedback WHERE picture IS NOT NULL').get().picture === JPEG);
  ok('a context over 6000 characters is refused 413', (await post({ ...good(), device: 'dev-eeeeeeee', context: { x: 'z'.repeat(7000) } })).status === 413);

  // ------------------------------------------------------------ limits: 5 per hour per device
  clock += 2 * 3600e3;
  const sent = [];
  for (let i = 0; i < PER_DEVICE + 1; i++) sent.push((await post({ ...good(i), device: 'dev-limited1' })).status);
  ok('5 per hour per device, the sixth is 429', sent.slice(0, PER_DEVICE).every((s) => s === 201) && sent[PER_DEVICE] === 429, sent.join(','));
  ok('another device is not blocked', (await post({ ...good(), device: 'dev-other111' })).status === 201);
  clock += 3600e3 + 1;
  ok('an hour later the device may send again', (await post({ ...good(), device: 'dev-limited1' })).status === 201);
  clock += 2 * 3600e3;
  const ipSent = [];
  for (let i = 0; i < 22; i++) ipSent.push((await post({ ...good(i), device: `dev-spread${String(i).padStart(3, '0')}` })).status);
  ok('20 per hour per IP even with fresh device ids', ipSent.filter((s) => s === 201).length === 20 && ipSent[20] === 429, ipSent.join(','));
  clock += 3600e3 + 1;
  ok('a missing device id falls back to the IP', (await post({ kind: 'wish', text: 'no device' })).status === 201);

  // ------------------------------------------------------------ names
  const felix = app.admin.invite('Felix');
  clock += 3600e3 + 1;
  await post({ ...good(), device: 'dev-felix111', name: 'Anna' }, { Authorization: `Bearer ${felix.key}` });
  const named = app.db.prepare('SELECT * FROM feedback ORDER BY id DESC LIMIT 1').get();
  ok('a logged in player is named from the key, not from the body', named.name === 'Felix' && named.player === 'Felix', JSON.stringify(named));
  clock += 3600e3 + 1;
  await post({ ...good(), device: 'dev-anna1111', name: 'Anna' });
  ok('a visitor may give a name (cut to 40 characters)', app.db.prepare('SELECT name FROM feedback ORDER BY id DESC LIMIT 1').get().name === 'Anna');

  // ------------------------------------------------------------ admin read
  ok('GET without the secret: 401', (await get()).status === 401);
  ok('GET with a wrong secret: 401', (await get('', { Authorization: 'Bearer nope' })).status === 401);
  const all = await get('', { Authorization: `Bearer ${SECRET}` });
  ok('GET with the secret lists items oldest first', all.status === 200 && all.json.items.length > 5 && all.json.items[0].id === 1 && all.json.items.every((x, i, a) => !i || a[i - 1].id < x.id));
  const since = await get('?since=3', { Authorization: `Bearer ${SECRET}` });
  ok('?since=<id> returns only newer items', since.json.items.every((x) => x.id > 3) && since.json.items[0].id === 4);
  ok('an item has kind, text, context and the picture', (() => { const p = all.json.items.find((x) => x.picture); return p && p.kind === 'bug' && p.context.version === '1.12.0' && p.picture === JPEG; })());
  const plain = createOnlineServer({ db: openDb(':memory:'), now: () => clock });
  const p2 = await plain.listen(0, '127.0.0.1');
  ok('without ONLINE_ADMIN_SECRET the admin GET does not exist (404)', (await fetch(`http://127.0.0.1:${p2}/feedback`)).status === 404);
  ok('...but sending still works', (await fetch(`http://127.0.0.1:${p2}/feedback`, { method: 'POST', body: JSON.stringify({ kind: 'wish', text: 'hi' }) })).status === 201);
  await plain.close();
  ok('no secret and no key in a log line', !logs.some((l) => l.includes(SECRET) || l.includes(felix.key)));
  ok('the other methods are refused 405', (await fetch(`${BASE}/feedback`, { method: 'DELETE' })).status === 405);

  // ------------------------------------------------------------ client helpers (fake window)
  const win = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, screen: { width: 390, height: 844 }, __chessErrors: ['boom one', 'boom two', 'b3', 'b4', 'b5', 'b6'], location: { search: '?theme=pixel&view=top' } };
  const ctx = buildContext({ win, nav: { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit Safari/605', maxTouchPoints: 5, language: 'de' }, version: '1.12.0', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: ['e2e4'], theme: 'pixel', view: 'top' });
  ok('context: version, device, screen, theme, view, fen, moves', ctx.version === '1.12.0' && ctx.device.touch === true && ctx.device.ua === 'safari' && ctx.screen.w === 390 && ctx.theme === 'pixel' && ctx.view === 'top' && ctx.fen.startsWith('rnbq') && ctx.moves[0] === 'e2e4');
  ok('context: only the last 5 console errors, each cut', ctx.errors.length === 5 && ctx.errors[0] === 'boom two');
  ok('context never holds chat, keys or a login', !/chat|key|token/i.test(JSON.stringify(ctx)));
  ok('a device id is made once and kept', (() => { const store = new Map(); const st = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }; const a = deviceId(st), b = deviceId(st); return a === b && /^[A-Za-z0-9_-]{8,64}$/.test(a); })());
  ok('deviceId survives a blocked storage', (() => { const st = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }; return /^[A-Za-z0-9_-]{8,64}$/.test(deviceId(st)); })());
  ok('fitPicture: the first quality that fits under the cap', fitPicture((q) => 'A'.repeat(Math.round(q * 300000)), 150000) === 'A'.repeat(Math.round(0.4 * 300000)));
  ok('fitPicture: nothing fits, no picture', fitPicture(() => 'A'.repeat(900000), 150000) === null);
  const calls = [];
  const fakeFetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201, json: async () => ({ ok: true, id: 7 }) }; };
  const out = await sendFeedback({ server: 'https://s.example/', kind: 'wish', text: ' more music ', name: 'Mia', picture: JPEG, context: ctx, device: 'dev-12345678', key: 'KEY', fetch: fakeFetch });
  const sentBody = JSON.parse(calls[0].init.body);
  ok('sendFeedback posts to /feedback with the key when logged in', out.ok && calls[0].url === 'https://s.example/feedback' && calls[0].init.headers.Authorization === 'Bearer KEY' && sentBody.text === 'more music' && sentBody.picture === JPEG && sentBody.device === 'dev-12345678');
  ok('sendFeedback reports 429 as slow-down and a network error as offline', (await sendFeedback({ server: 'https://s.example', kind: 'bug', text: 'x', fetch: async () => ({ ok: false, status: 429, json: async () => ({ error: 'slow-down' }) }) })).error === 'slow-down'
    && (await sendFeedback({ server: 'https://s.example', kind: 'bug', text: 'x', fetch: async () => { throw new TypeError('fail'); } })).error === 'offline');
  ok('sendFeedback reports any other http error as rejected (CHE-417)', (await sendFeedback({ server: 'https://s.example', kind: 'bug', text: 'x', fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }) })).error === 'rejected'
    && (await sendFeedback({ server: 'https://s.example', kind: 'bug', text: 'x', fetch: async () => ({ ok: false, status: 500, json: async () => ({ error: 'boom' }) }) })).error === 'rejected');
} finally {
  await app.close();
}
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
