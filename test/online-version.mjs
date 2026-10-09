// Server and client API version check (CHE-405, fast tier, no browser): the compare logic, the fetch of GET /version (404 is API 0,
// no answer is unknown), the check that runs on login and reconnect, and the real server route.
import assert from 'node:assert/strict';
import { compareApi, fetchVersion, createVersionCheck, CLIENT_API, NEEDS_SERVER_API } from '../src/online/version.js';
import { createOnlineServer } from '../server/index.mjs';
import { versionInfo, API, MIN_CLIENT } from '../server/version.mjs';
import { neededApi, judge, liveApi } from '../tools/server-api.mjs';
import { openDb } from '../server/db.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const L = { clientApi: 2, needs: 3 };

ok('server API at the need: ok', compareApi({ api: 3, minClient: 1 }, L) === 'ok');
ok('server API above the need: ok', compareApi({ api: 9, minClient: 2 }, L) === 'ok');
ok('server API below the need: server-old', compareApi({ api: 2, minClient: 1 }, L) === 'server-old');
ok('a server without the route (404) is API 0: server-old', compareApi({ missing: true }, L) === 'server-old');
ok('minClient above the client API: client-old', compareApi({ api: 3, minClient: 3 }, L) === 'client-old');
ok('the server being too old wins over a high minClient', compareApi({ api: 1, minClient: 9 }, L) === 'server-old');
ok('no answer or a broken body: unknown', compareApi(null, L) === 'unknown' && compareApi({}, L) === 'unknown' && compareApi({ api: 'x' }, L) === 'unknown');
ok('a frontend only release never alarms: same numbers, any commit', compareApi({ api: NEEDS_SERVER_API, minClient: CLIENT_API, commit: 'abc' }) === 'ok');

const reply = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
ok('fetchVersion: 200 gives the body', (await fetchVersion('http://x/', reply(200, { api: 1 }))).api === 1);
ok('fetchVersion: 404 gives missing', (await fetchVersion('http://x', reply(404, null))).missing === true);
ok('fetchVersion: 500 and a thrown error give null', (await fetchVersion('http://x', reply(500, {}))) === null && (await fetchVersion('http://x', async () => { throw new TypeError('net'); })) === null);
let url = ''; await fetchVersion('http://x///', async (u) => { url = u; return reply(200, {})(); });
ok('fetchVersion: one slash, no key in the request', url === 'http://x/version');

// the check: tells onChange only when the verdict changes, keeps the last known verdict when there is no answer
let answer = { missing: true }; const seen = [];
const fetchFn = async () => (answer === 'down' ? Promise.reject(new TypeError('net')) : answer.missing ? { status: 404, ok: false } : { status: 200, ok: true, json: async () => answer });
const c = createVersionCheck({ server: 'http://x', fetchFn, onChange: (v) => seen.push(v), ...L });
ok('login against an old server: server-old once', (await c.run()) === 'server-old' && seen.join() === 'server-old');
await c.run();
ok('same verdict again: no second call to onChange', seen.length === 1);
answer = 'down';
ok('a failed check keeps the verdict (the connection line tells the rest)', (await c.run()) === 'server-old' && seen.length === 1);
answer = { api: 3, minClient: 1 };
ok('reconnect after the server update: ok', (await c.run()) === 'ok' && seen.join() === 'server-old,ok');
answer = { api: 3, minClient: 5 };
ok('then a client too old: client-old', (await c.run()) === 'client-old' && seen.at(-1) === 'client-old');

// the release check part (tools/server-api.mjs)
ok('neededApi reads the constant from the module text', neededApi('x\nexport const NEEDS_SERVER_API = 7;\n') === 7 && neededApi('nothing') === null);
ok('release check: live at or above the need is ok', judge({ needed: 1, live: { api: 1, commit: 'abcdef012' } }).state === 'ok' && judge({ needed: 1, live: { api: 2 } }).state === 'ok');
ok('release check: live below the need is red, and says deploy first', judge({ needed: 2, live: { api: 1 } }).state === 'red' && /deploy the server first/.test(judge({ needed: 2, live: { api: 0 } }).line));
ok('release check: no answer is only unknown (a warning)', judge({ needed: 1, live: null }).state === 'unknown');
ok('liveApi: 404 is API 0, a body gives api and commit, an error gives null', (await liveApi('http://x', reply(404, null))).api === 0 && (await liveApi('http://x', reply(200, { api: 3, commit: 'c' }))).commit === 'c' && (await liveApi('http://x', async () => { throw new Error('n'); })) === null);

// the server side
ok('versionInfo: api, minClient and the commit from KAMAL_VERSION', JSON.stringify(versionInfo({ KAMAL_VERSION: '0123456789abcdef' })) === JSON.stringify({ api: API, minClient: MIN_CLIENT, commit: '0123456789abcdef' }));
ok('versionInfo: no env gives an empty commit, ONLINE_COMMIT is the fallback', versionInfo({}).commit === '' && versionInfo({ ONLINE_COMMIT: 'abc' }).commit === 'abc');
ok('the client needs no more than the server speaks, the server serves this client', NEEDS_SERVER_API <= API && MIN_CLIENT <= CLIENT_API);
const app = createOnlineServer({ db: openDb(':memory:'), now: () => Date.UTC(2026, 9, 9, 12), log: () => {} });
const port = await app.listen(0, '127.0.0.1');
try {
  const r = await fetch(`http://127.0.0.1:${port}/version`, { headers: { Origin: 'http://localhost:5173' } });
  const j = await r.json();
  ok('GET /version: public (no key), 200, JSON with api, minClient, commit', r.status === 200 && j.api === API && j.minClient === MIN_CLIENT && typeof j.commit === 'string' && Object.keys(j).length === 3, JSON.stringify(j));
  ok('GET /version: no-store and CORS for the page origin', r.headers.get('cache-control') === 'no-store' && r.headers.get('access-control-allow-origin') === 'http://localhost:5173');
} finally { await app.close(); }
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
