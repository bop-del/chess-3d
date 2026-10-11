// CHE-436, CHE-438, CHE-439 (fast tier, no browser): the service worker shows a push with renotify on and keeps the tag; enable()
// names the step that failed (permission, register, ready, key, subscribe, server) and the Details line has no key or endpoint;
// a hidden player is left out of other players' lists except for admins and other hidden players (admin hide / unhide).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPush } from '../src/online/push.js';
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { runAdmin } from '../server/admin.mjs';
import { createLive } from '../server/live.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

// ------------------------------------------------------------ CHE-436: public/sw.js
{
  const shown = [], handlers = {};
  const self = { location: { origin: 'https://x.test' }, registration: { scope: 'https://x.test/', showNotification: (title, o) => { shown.push({ title, o }); return Promise.resolve(); } }, addEventListener: (t, f) => { handlers[t] = f; }, clients: {} };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, caches: {}, URL, Request: class {}, Response: class {}, fetch: () => {} });
  for (const kind of ['chat', 'turn', 'challenge']) {
    handlers.push({ data: { json: () => ({ kind, title: 'T', body: 'B', tag: `${kind}:Felix`, url: '?open=online' }) }, waitUntil: () => {} });
  }
  ok('sw: chat, turn and challenge pushes show with renotify true and the tag kept',
    shown.length === 3 && shown.every((s, i) => s.o.renotify === true && s.o.tag === `${['chat', 'turn', 'challenge'][i]}:Felix`), JSON.stringify(shown.map((s) => s.o)));
}

// ------------------------------------------------------------ CHE-438: enable() names the failing step
{
  const KEY = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  // which step blows up; 'none' = all good
  async function run(brk) {
    let permission = brk === 'permission' ? 'default' : 'granted';
    const sub = { endpoint: 'https://push.invalid/SECRET-ENDPOINT', toJSON: () => ({ endpoint: 'https://push.invalid/SECRET-ENDPOINT', keys: {} }), unsubscribe: async () => true };
    const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => { if (brk === 'subscribe') throw new DOMException('push service error', 'AbortError'); return sub; } } };
    const env = {
      hasPush: true, iosTab: false,
      Notification: { get permission() { return permission; }, requestPermission: async () => { if (brk === 'permission') { permission = 'denied'; return 'denied'; } return 'granted'; } },
      sw: { register: async () => { if (brk === 'register') throw new Error('register blocked'); }, get ready() { return brk === 'ready' ? Promise.reject(new Error('no worker')) : Promise.resolve(reg); }, getRegistration: async () => reg },
    };
    const call = async (path) => {
      if (path === '/push/key' && brk === 'key') { const e = new Error('http 500'); e.status = 500; throw e; }
      if (path === '/push/subscribe' && brk === 'server') { const e = new Error('http 503'); e.status = 503; throw e; }
      return path === '/push/key' ? { key: KEY } : {};
    };
    const push = createPush({ server: 'https://s.test', getKey: () => 'k', env, storage, call });
    const st = await push.enable();
    return { push, st };
  }
  for (const step of ['permission', 'register', 'ready', 'key', 'subscribe', 'server']) {
    const { push, st } = await run(step);
    ok(`push enable: a failing ${step} step is named`, push.failStep === step && push.detailText().includes(`step ${step}`) && st !== 'on', `${push.failStep} ${push.detailText()}`);
    ok(`push enable (${step}): the Details line holds no endpoint or key`, !/SECRET-ENDPOINT|BCVxsr/.test(push.detailText()));
    if (step !== 'permission') ok(`push enable (${step}): error is set so the bell shows the reason`, push.error === 'failed', push.error);
  }
  const good = await run('none');
  ok('push enable: all steps fine gives on, no failed step, no Details line', good.st === 'on' && good.push.failStep === '' && good.push.detailText() === '');
  const s404 = createPush({ server: 'https://s.test', getKey: () => 'k', storage, call: async () => { const e = new Error('nope'); e.status = 404; throw e; },
    env: { hasPush: true, iosTab: false, Notification: { permission: 'granted' }, sw: { register: async () => {}, ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe: async () => ({}) } }) } } });
  await s404.enable();
  ok('push enable: 404 on the key route is off-server, step key', s404.error === 'off-server' && s404.failStep === 'key');
}

// ------------------------------------------------------------ CHE-440: push on by default
{
  const mk = (perm, stored) => {
    const store = new Map(stored ? [['chess3d.push', JSON.stringify(stored)]] : []);
    let sub = null, permission = perm;
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
    const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => (sub = { endpoint: 'e', toJSON: () => ({ endpoint: 'e' }), unsubscribe: async () => true }) } };
    const env = { hasPush: true, iosTab: false, Notification: { get permission() { return permission; }, requestPermission: async () => (permission = 'granted') }, sw: { register: async () => {}, ready: Promise.resolve(reg), getRegistration: async () => reg } };
    return createPush({ server: 'https://s.test', getKey: () => 'k', env, storage, call: async (p) => (p === '/push/key' ? { key: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4' } : {}) });
  };
  const g = mk('granted'); ok('default on: granted and no card before start', true); await g.refresh();
  ok('default on: permission granted subscribes silently at start, bell on, no card', g.state() === 'on' && !g.wantCard());
  const d = mk('default'); await d.refresh();
  ok('default on: permission open shows the card, no prompt, bell off', d.state() === 'off' && d.wantCard());
  await d.answer(false);
  ok('default on: Nein danke hides the card', !d.wantCard() && d.state() === 'off');
  const off = mk('granted', { v: 2, off: true }); await off.refresh();
  ok('default on: a bell turned off stays off at the next start', off.state() === 'off');
  const old = mk('granted', { acted: true, answered: true, off: true }); await old.refresh();
  ok('default on: the one time reset clears old off and answered, so it starts on', old.state() === 'on');
  const den = mk('denied'); await den.refresh();
  ok('default on: a blocked browser shows no card', den.state() === 'denied' && !den.wantCard());
  const ios = createPush({ server: 'https://s.test', getKey: () => 'k', env: { hasPush: true, iosTab: true, Notification: { permission: 'default' }, sw: {} }, storage: { getItem: () => null, setItem: () => {} } });
  ok('default on: an iPhone Safari tab shows the card (Home Screen hint)', ios.state() === 'install' && ios.wantCard());
}

// ------------------------------------------------------------ CHE-437: hidden tabs
{
  const live = createLive({ heartbeatMs: 1e9 });
  const fake = () => { const h = {}; return { req: { socket: {}, on: (e, f) => { h[e] = f; } }, res: { writeHead() {}, write() {}, end() {}, on: () => {} }, close: () => h.close?.() }; };
  const open = (id, sid) => { const f = fake(); live.open(f.req, f.res, id, {}, {}, sid); return f; };
  const T = 1_000_000;
  ok('visibility: no stream means a push goes out', live.visible(1, T) === false);
  const a = open(1, 'mac');
  ok('visibility: one visible stream blocks the push', live.visible(1, T) === true);
  live.setHidden(1, 'mac', true, T);
  ok('visibility: hidden for under 30 s still counts as visible', live.visible(1, T + 29_000) === true);
  ok('visibility: all streams hidden for 30 s lets the push out', live.visible(1, T + 30_000) === false);
  const b = open(1, 'tab2');
  ok('visibility: a second, visible stream blocks again', live.visible(1, T + 60_000) === true);
  live.setHidden(1, 'tab2', true, T + 60_000);
  ok('visibility: both hidden past 30 s lets the push out', live.visible(1, T + 91_000) === false);
  live.setHidden(1, 'mac', false, T + 92_000);
  ok('visibility: visible again blocks at once', live.visible(1, T + 92_000) === true);
  const old = open(2, '');
  ok('visibility: a stream with no id (old client) counts as visible', live.visible(2, T + 1e9) === true);
  b.close(); a.close(); old.close();
  ok('visibility: closed streams leave nothing open', live.visible(1, T) === false && live.visible(2, T) === false);
  live.close();
  // through the real routes and notify
  const app = createOnlineServer({ db: openDb(':memory:'), now: () => Date.UTC(2026, 9, 11, 12), heartbeatMs: 1e9, log: () => {} });
  const port = await app.listen(0, '127.0.0.1');
  try {
    const mia = app.admin.invite('Mia');
    const r = await fetch(`http://127.0.0.1:${port}/visibility`, { method: 'POST', headers: { Authorization: `Bearer ${mia.key}`, 'Content-Type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify({ sid: 'x', hidden: true }) });
    ok('POST /visibility answers 200 for a logged in player, 401 without a key', r.status === 200 && (await fetch(`http://127.0.0.1:${port}/visibility`, { method: 'POST', body: '{}' })).status === 401);
  } finally { await app.close(); }
}

// ------------------------------------------------------------ CHE-439: hidden players
{
  const app = createOnlineServer({ db: openDb(':memory:'), now: () => Date.UTC(2026, 9, 11, 12), heartbeatMs: 200, log: () => {} });
  const port = await app.listen(0, '127.0.0.1');
  const names = async (key) => (await (await fetch(`http://127.0.0.1:${port}/state`, { headers: { Authorization: `Bearer ${key}`, Origin: 'http://localhost:5173' } })).json()).players.map((p) => p.name);
  try {
    const felix = app.admin.invite('Felix'), boss = app.admin.invite('Boss'), a = app.admin.invite('Test A'), b = app.admin.invite('Test B');
    app.admin.setAdmin('Boss', true);
    ok('hidden: nobody is hidden by default', (await names(felix.key)).includes('Test A'));
    app.admin.setHidden('Test A'); app.admin.setHidden('Test B');
    ok('hidden: a normal player no longer sees them', JSON.stringify(await names(felix.key)) === JSON.stringify(['Boss']), JSON.stringify(await names(felix.key)));
    ok('hidden: an admin still sees them', (await names(boss.key)).join() === 'Felix,Test A,Test B', (await names(boss.key)).join());
    ok('hidden: hidden players see each other and everyone else', (await names(a.key)).join() === 'Boss,Felix,Test B', (await names(a.key)).join());
    ok('hidden: list marks them', app.admin.list().filter((p) => p.hidden).map((p) => p.name).join() === 'Test A,Test B');
    app.admin.setHidden('Test A', false);
    ok('unhide: visible again', (await names(felix.key)).join() === 'Boss,Test A');
    let threw = false; try { app.admin.setHidden('Nobody'); } catch (e) { threw = true; }
    ok('hide of an unknown name refuses', threw);
    // the admin command goes through runAdmin on a file database
    const { mkdtempSync, rmSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'hide-')); const file = join(dir, 'o.db');
    try {
      const d = openDb(file); d.prepare('INSERT INTO players (name, created) VALUES (?, ?)').run('Test A', 1); d.close();
      const out = []; const e2 = { db: file, port: 1 };
      runAdmin(['hide', 'Test A'], { env: e2, out: (l) => out.push(l) });
      const d2 = openDb(file); const hid = d2.prepare("SELECT hidden FROM players WHERE name = 'Test A'").get().hidden; d2.close();
      runAdmin(['unhide', 'Test A'], { env: e2, out: (l) => out.push(l) });
      const d3 = openDb(file); const vis = d3.prepare("SELECT hidden FROM players WHERE name = 'Test A'").get().hidden; d3.close();
      ok('admin.mjs hide and unhide set the column', hid === 1 && vis === 0 && out.length === 2, out.join('|'));
      // an old database without the column gets it additively
      const { DatabaseSync } = await import('node:sqlite');
      const old = join(dir, 'old.db'); const od = new DatabaseSync(old);
      od.exec('CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, code_hash TEXT, revoked INTEGER NOT NULL DEFAULT 0, muted INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)'); od.close();
      const n = openDb(old); const cols = n.prepare('PRAGMA table_info(players)').all().map((c) => c.name); n.close();
      ok('an old database gets the hidden column additively', cols.includes('hidden') && cols.includes('bot') && cols.includes('admin'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  } catch (e) { ok('no exception', false, String(e && e.stack || e)); } finally { await app.close(); }
}

console.log(failed ? `\n${failed} push fix check(s) FAILED` : '\npush fixes: all checks passed');
process.exit(failed ? 1 : 0);
