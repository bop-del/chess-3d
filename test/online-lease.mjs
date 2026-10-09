// The writer lease (CHE-406, fast tier, no browser): two real servers on ONE database file. Both answer requests; only the holder of
// the lease runs the background work (health samples, bot, push). A graceful stop hands over at the next beat, a crashed holder is
// taken over once its heartbeat expired, a fresh row waits the grace for a server from before the lease, and the lease table is one row.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { createLease, LEASE_TTL_MS } from '../server/lease.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(10); } return null; }

const dir = mkdtempSync(join(tmpdir(), 'chess-lease-'));
const file = join(dir, 'online.db');
let clock = Date.UTC(2026, 9, 9, 12);
const now = () => clock;
const opts = { now, firstSampleMs: 40, sampleMs: 1e9, bot: { moveDelay: () => 0, chatDelay: () => 0 }, lease: { beatMs: 1e9, graceMs: 0 } };   // beats are ticked by hand
const apps = [];
const make = (extra = {}) => { const db = openDb(file); const a = createOnlineServer({ db, dbFile: file, ...opts, ...extra }); a.samples = 0; const real = a.health.sample.bind(a.health); a.health.sample = () => { a.samples++; return real(); }; apps.push(a); return a; };
const call = async (app, port, path, { key, body } = {}) => {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: body ? 'POST' : 'GET', headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let json = null; try { json = JSON.parse(t); } catch (e) { /* none */ }
  return { status: r.status, json };
};

try {
  // ---- two servers, one file
  const a = make(), b = make();
  const pa = await a.listen(0, '127.0.0.1'), pb = await b.listen(0, '127.0.0.1');
  ok('the first server holds the lease, the second does not', a.lease.held() && !b.lease.held(), `${a.lease.held()} ${b.lease.held()}`);
  ok('the lease table has one row, owned by the first server', a.db.prepare('SELECT COUNT(*) AS n FROM writer_lease').get().n === 1 && a.lease.owner().owner === a.lease.id);
  const ola = a.admin.invite('Ola');
  ok('both servers answer requests (the second sees the invite of the first)', (await call(a, pa, '/state', { key: ola.key })).status === 200 && (await call(b, pb, '/state', { key: ola.key })).status === 200);
  await sleep(150);
  ok('only the writer runs the health sampling', a.samples === 1 && b.samples === 0, `${a.samples} ${b.samples}`);
  await call(b, pb, '/challenge', { key: ola.key, body: { to: 'Bot' } });
  await sleep(120);
  ok('a challenge to the bot through the second server is not answered while the first holds the lease', a.db.prepare("SELECT COUNT(*) AS n FROM challenges WHERE status = 'open'").get().n === 1);

  // ---- a tick of the second does not steal a live lease
  clock += 4000; a.lease.tick(); clock += 4000;
  b.lease.tick();
  ok('a second server does not take a lease that is renewed', !b.lease.held() && a.lease.held());

  // ---- graceful stop: the lease is given back, the second takes over at its next beat
  await a.close();
  ok('a graceful stop deletes the lease row', a.db.prepare('SELECT COUNT(*) AS n FROM writer_lease').get().n === 0);
  b.lease.tick();
  ok('the second server takes over at its next beat', b.lease.held() && b.lease.owner().owner === b.lease.id);
  const took = await until(() => b.samples === 1);
  ok('the new writer starts the background work (health sample)', !!took, `${b.samples}`);
  const accepted = await until(() => b.db.prepare("SELECT COUNT(*) AS n FROM challenges WHERE status = 'accepted'").get().n === 1);
  ok('the new writer bot answers the challenge it missed', !!accepted);

  // ---- a crashed holder: no row delete, the heartbeat expires
  const c = make(), cPort = await c.listen(0, '127.0.0.1');
  ok('a third server waits behind the live writer', !c.lease.held());
  clock += LEASE_TTL_MS - 1000; c.lease.tick();
  ok('before the heartbeat expired nobody takes over', !c.lease.held() && b.lease.owner().owner === b.lease.id);
  clock += 2000; c.lease.tick();
  ok('after the heartbeat expired the waiting server takes over', c.lease.held() && c.lease.owner().owner === c.lease.id);
  b.lease.tick();
  ok('the silent old holder notices it lost the lease and stops its duties', !b.lease.held());
  const bSamples = b.samples; await sleep(100);
  ok('the lost writer does not sample any more', b.samples === bSamples);

  // ---- the grace for a server from before the lease
  const g1 = openDb(':memory:');
  const g = createLease(g1, { now, graceMs: 35000 });
  g.tick(); ok('with no row, the first claim waits the grace', !g.held());
  clock += 36000; g.tick(); ok('after the grace the lease is taken', g.held());
  g.close();

  // ---- the lease keeps renewing
  const h = createLease(openDb(':memory:'), { now });
  h.tick(); const first = h.owner().beat; clock += 3000; h.tick();
  ok('the holder renews the heartbeat', h.owner().beat === first + 3000);
  h.close();

  // ---- no lease option: always the writer (the other tests)
  const solo = createOnlineServer({ db: openDb(':memory:'), firstSampleMs: 20, sampleMs: 1e9 });
  ok('a server without a lease option is the only writer and has no lease', solo.lease === null);
  await solo.close();
  await c.close(); await b.close();
} catch (e) { failed++; console.log('FAIL  exception', e && e.stack || e); }
for (const x of apps) await x.close().catch(() => {});
rmSync(dir, { recursive: true, force: true });
console.log(failed ? `\nLEASE FAILED (${failed})` : '\nLEASE OK');
process.exit(failed ? 1 : 0);
