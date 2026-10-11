// Messages from "Chess 3D" to players (CHE-422, fast tier, no browser): the reserved sender (created once, cannot be invited, challenged
// or chatted with, no stats), "read" at once for a logged in player's Feedback (a badge, no push) and nothing for anonymous Feedback,
// POST /admin/message (admin secret, template or free text, feedbackId fills the quote, 409 for anonymous Feedback, limits, a push),
// and the state a client renders from (system flag, template, params, quote).
import { createECDH, randomBytes } from 'node:crypto';
import { createOnlineServer } from '../server/index.mjs';
import { openDb, SYSTEM_NAME } from '../server/db.mjs';
import { ensureSystem, quoteOf, TEMPLATES_DE } from '../server/messages.mjs';
import { vapidGenerate } from '../server/push.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
let clock = Date.UTC(2026, 9, 11, 12);
const SECRET = 'test-admin-secret-1234';
const pushes = [];
const pushFetch = async (url, init) => { pushes.push({ url, init }); return new Response(null, { status: 201 }); };
const db = openDb(':memory:');
const app = createOnlineServer({ db, now: () => clock, adminSecret: SECRET, vapid: vapidGenerate(), vapidSubject: 'mailto:test@localhost', pushFetch, gameUrl: 'http://127.0.0.1/' });
const port = await app.listen(0, '127.0.0.1');
const BASE = `http://127.0.0.1:${port}`;
const call = async (path, { key, body, method = 'POST' } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body ?? {}) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const admin = (body, secret = SECRET) => call('/admin/message', { key: secret, body });
const state = async (key) => (await call('/state', { key, method: 'GET' })).json;
const flush = () => app.push.flush();

try {
  // ---- the reserved sender
  const sys = app.db.prepare('SELECT * FROM players WHERE name = ?').get(SYSTEM_NAME);
  ok('Chess 3D exists after start, flagged system, no code', !!sys && sys.system === 1 && sys.code_hash === null);
  ok('ensureSystem again creates no second row', (ensureSystem(db), app.db.prepare("SELECT COUNT(*) AS n FROM players WHERE name = 'Chess 3D'").get().n === 1));
  let err = ''; try { app.admin.invite('Chess 3D'); } catch (e) { err = e.message; }
  ok('the name cannot be invited', /reserved/.test(err), err);
  err = ''; try { app.admin.invite('chess 3d', { fresh: true }); } catch (e) { err = e.message; }
  ok('not in another case either, and not with --new', /reserved/.test(err), err);
  err = ''; try { app.admin.revoke('Chess 3D'); } catch (e) { err = e.message; }
  ok('it cannot be revoked', /sender/.test(err), err);

  const felix = app.admin.invite('Felix'), mia = app.admin.invite('Mia');
  ok('a player sees no Chess 3D before its first message', !(await state(felix.key)).players.some((p) => p.name === SYSTEM_NAME));

  // ---- Feedback: read at once for a logged in player, nothing for a guest
  const fb = (key, text, device) => call('/feedback', { key, body: { kind: 'wish', text, device } });
  const long = 'Ich wünsche mir einen Modus, in dem man gegen die Zeit spielt und die Figuren sich verwandeln können, wenn man gewinnt.';
  const guest = await fb(null, 'from a guest', 'dev-guest111');
  ok('anonymous Feedback: no message to anyone', guest.status === 201 && app.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n === 0);
  pushes.length = 0;
  const f1 = await fb(felix.key, long, 'dev-felix111');
  await flush();
  const s1 = await state(felix.key);
  const sysP = s1.players.find((p) => p.name === SYSTEM_NAME);
  ok('logged in Feedback: the read message is there at once, unread 1', f1.status === 201 && sysP?.unread === 1 && s1.unread[SYSTEM_NAME] === 1, JSON.stringify(sysP));
  const m1 = s1.chats[SYSTEM_NAME]?.[0];
  ok('read message: template, German text, 80 character quote, not mine', m1?.tpl === 'read' && m1.text === TEMPLATES_DE.read() && m1.quote === quoteOf(long) && [...m1.quote].length === 80 && m1.mine === false, JSON.stringify(m1));
  ok('read sends NO push', pushes.length === 0);
  ok('Chess 3D is pinned first, flagged, without presence, game or score', s1.players[0].name === SYSTEM_NAME && sysP.system === true && sysP.online === false && sysP.withMe === false && sysP.played === 0);
  ok('another player still sees nothing', !(await state(mia.key)).players.some((p) => p.name === SYSTEM_NAME));
  ok('chat/read clears the badge', (await call('/chat/read', { key: felix.key, body: { with: SYSTEM_NAME } })).json.ok && !(await state(felix.key)).unread[SYSTEM_NAME]);

  // ---- nobody can talk to it, challenge it or look at its numbers
  ok('chat to Chess 3D: 403 read-only', (await call('/chat', { key: felix.key, body: { to: SYSTEM_NAME, text: 'hallo' } })).json?.error === 'read-only');
  ok('challenge Chess 3D: 404', (await call('/challenge', { key: felix.key, body: { to: SYSTEM_NAME } })).status === 404);
  ok('stats of Chess 3D: 404', (await call(`/player/${encodeURIComponent(SYSTEM_NAME)}`, { key: felix.key, method: 'GET' })).status === 404);
  ok('no login with a code or a key for it', (await call('/login-code', { body: { code: 'CHESS-AAAA' } })).status === 401);

  // ---- POST /admin/message: auth
  ok('no secret: 401', (await call('/admin/message', { body: { to: 'Felix', text: 'x' } })).status === 401);
  ok('wrong secret: 401', (await admin({ to: 'Felix', text: 'x' }, 'nope')).status === 401);
  ok('a player key is not the admin secret: 401', (await admin({ to: 'Felix', text: 'x' }, felix.key)).status === 401);
  ok('GET is 405', (await call('/admin/message', { key: SECRET, method: 'GET' })).status === 405);

  // ---- templates, feedbackId, quote
  const sub = (() => { const e = createECDH('prime256v1'); e.generateKeys(); return { endpoint: 'http://127.0.0.1:9/push/felix', keys: { p256dh: e.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } }; })();
  ok('subscribe a device for Felix', (await call('/push/subscribe', { key: felix.key, body: sub })).json?.ok === true);
  pushes.length = 0;
  const a1 = await admin({ feedbackId: f1.json.id, tpl: 'accepted' });
  await flush();
  const s2 = await state(felix.key);
  const m2 = s2.chats[SYSTEM_NAME].at(-1);
  ok('accepted by feedbackId: 200, resolves the player, fills the quote', a1.status === 200 && a1.json.to === 'Felix' && m2.tpl === 'accepted' && m2.quote === quoteOf(long) && m2.text === 'Gute Idee! Das bauen wir ein.', JSON.stringify(a1) + JSON.stringify(m2));
  ok('it pushes like a chat message (one request to the device)', pushes.length === 1 && pushes[0].url === sub.endpoint, String(pushes.length));
  const a2 = await admin({ feedbackId: f1.json.id, tpl: 'shipped', params: { v: '1.14.0' } });
  ok('shipped carries the version into the German text', a2.status === 200 && (await state(felix.key)).chats[SYSTEM_NAME].at(-1).text === 'Dein Vorschlag ist jetzt im Spiel (Version 1.14.0). Viel Spaß!');
  const a3 = await admin({ to: 'Felix', tpl: 'fixed', params: { v: '1.14.1' } });
  const m3 = (await state(felix.key)).chats[SYSTEM_NAME].at(-1);
  ok('fixed by name: no quote, params in the state', a3.status === 200 && m3.tpl === 'fixed' && m3.params.v === '1.14.1' && !m3.quote && /behoben \(Version 1\.14\.1\)/.test(m3.text), JSON.stringify(m3));
  ok('shipped without a version: 400', (await admin({ to: 'Felix', tpl: 'shipped' })).status === 400);
  ok('a version with markup: 400', (await admin({ to: 'Felix', tpl: 'fixed', params: { v: '<b>1</b>' } })).status === 400);
  ok('read is not an admin template: 400', (await admin({ to: 'Felix', tpl: 'read' })).status === 400);
  ok('an unknown template: 400', (await admin({ to: 'Felix', tpl: 'party' })).status === 400);

  // ---- free text
  const t1 = await admin({ to: 'Mia', text: '  Hallo   Mia,\n danke für die Idee!  ' });
  const mm = (await state(mia.key)).chats[SYSTEM_NAME]?.[0];
  ok('free text: plain, whitespace collapsed, no tpl', t1.status === 200 && mm?.text === 'Hallo Mia, danke für die Idee!' && !mm.tpl && !mm.quote, JSON.stringify(mm));
  ok('free text with a feedbackId carries the quote', (await admin({ feedbackId: f1.json.id, text: 'Wir schauen es uns an.' })).status === 200 && (await state(felix.key)).chats[SYSTEM_NAME].at(-1).quote === quoteOf(long));
  clock += 61e3;   // the negative cases count against the limit too
  ok('empty text: 400', (await admin({ to: 'Mia', text: '   ' })).status === 400);
  ok('text over 200 characters: 400', (await admin({ to: 'Mia', text: 'x'.repeat(201) })).status === 400);
  ok('no recipient: 400', (await admin({ text: 'x' })).status === 400);
  ok('unknown player: 404', (await admin({ to: 'Nobody', text: 'x' })).status === 404);
  ok('to Chess 3D itself: 404', (await admin({ to: SYSTEM_NAME, text: 'x' })).status === 404);
  ok('unknown feedbackId: 404', (await admin({ feedbackId: 999, tpl: 'accepted' })).status === 404);
  ok('anonymous Feedback: 409 no-player', (await admin({ feedbackId: guest.json.id, tpl: 'accepted' })).json?.error === 'no-player');
  ok('to and feedbackId of different players: 400', (await admin({ feedbackId: f1.json.id, to: 'Mia', tpl: 'accepted' })).status === 400);

  // ---- rate limit like chat: 10 per minute
  clock += 61e3;
  const codes = []; for (let i = 0; i < 12; i++) codes.push((await admin({ to: 'Mia', text: `n${i}` })).status);
  ok('rate limit: 10 per minute, then 429', codes.slice(0, 10).every((c) => c === 200) && codes[10] === 429, codes.join(','));

  // ---- a deleted player takes the thread with them; Chess 3D stays
  app.admin.delete('Mia');
  ok('deleting a player removes their thread, the sender stays', !!app.admin.byName(SYSTEM_NAME) && app.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE to_id = ?').get(sys.id).n === 0);
} catch (e) { failed++; console.log('FAIL  test crashed: ' + (e.stack || e)); }
finally { await app.close(); }
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
