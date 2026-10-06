// Run lock (queue, stale takeover) and the smoke group retry classifier of tools/_lib.mjs. Fast tier, no browser, temp dirs only.
// Run: node test/run-lock.mjs    Exit 0 when every case holds, 1 otherwise.
import { acquireRunLock, chromeCrashReason } from '../tools/_lib.mjs';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cases = [];
const check = (name, ok) => cases.push({ name, ok: !!ok });
const dir = mkdtempSync(join(tmpdir(), 'chess-runlock-'));
const quiet = { say: () => {}, log: () => {} };

try {
  // free lock: taken, written, released
  const a = await acquireRunLock({ dir, pid: 111, isAlive: () => true, ...quiet });
  check('free lock is taken and holds pid, start and kind', JSON.parse(readFileSync(join(dir, 'run.lock'), 'utf8')).pid === 111);
  a.release();
  check('release removes the lock file', !existsSync(join(dir, 'run.lock')));

  // stale pid is taken over
  writeFileSync(join(dir, 'run.lock'), JSON.stringify({ pid: 999999, start: new Date().toISOString(), kind: 'smoke' }));
  const b = await acquireRunLock({ dir, pid: 222, isAlive: (p) => p !== 999999, ...quiet });
  check('stale lock (owner pid gone) is taken over', JSON.parse(readFileSync(join(dir, 'run.lock'), 'utf8')).pid === 222 && b.waited < 2);
  b.release();

  // live owner: second run queues once, logs kind run, gets the lock when the owner releases
  const first = await acquireRunLock({ dir, pid: 333, isAlive: () => true, ...quiet });
  const said = [], logged = [];
  const second = acquireRunLock({ dir, pid: 444, isAlive: () => true, pollMs: 20, say: (l) => said.push(l), log: (e) => logged.push(e), kind: 'phone' });
  await new Promise((r) => setTimeout(r, 150));
  check('second run waits while the owner lives', JSON.parse(readFileSync(join(dir, 'run.lock'), 'utf8')).pid === 333);
  check('second run prints exactly one queued line', said.length === 1 && /queued/.test(said[0]));
  first.release();
  const got = await second;
  check('second run gets the lock after the release', JSON.parse(readFileSync(join(dir, 'run.lock'), 'utf8')).pid === 444);
  check('the wait is logged as kind run', logged.length === 1 && logged[0].kind === 'run' && logged[0].waitSecs > 0);
  first.release();   // a release by a non-owner must not remove the lock of the new owner
  check('a late release by an old owner keeps the new owner lock', existsSync(join(dir, 'run.lock')));
  got.release();

  // timeout
  const c = await acquireRunLock({ dir, pid: 555, isAlive: () => true, ...quiet });
  let err = ''; try { await acquireRunLock({ dir, pid: 666, isAlive: () => true, maxWaitMs: 60, pollMs: 20, ...quiet }); } catch (e) { err = e.message; }
  check('a wait over the limit throws', /held the machine/.test(err));
  c.release();
} finally { rmSync(dir, { recursive: true, force: true }); }

// retry classifier
check('Target closed with exit 1 retries', /Target closed/.test(chromeCrashReason('Error: Protocol error (Target.createTarget): Target closed\n', 1)));
check('frame got detached retries', /detached/.test(chromeCrashReason('Error: Attempted to use detached Frame or frame got detached.\n', 1)));
check('FAIL row naming the crash still retries', chromeCrashReason('FAIL  page load  Target closed\nSMOKE FAILED\n', 1) !== null);
check('protocol error from a closed session retries', chromeCrashReason('ProtocolError: Protocol error (Runtime.callFunctionOn): Session closed. Most likely the page has been closed.\n', 1) !== null);
check('real check FAIL is never retried', chromeCrashReason('FAIL  king in check detected  expected 1 got 0\n', 1) === null);
check('real FAIL next to a crash message is never retried', chromeCrashReason('FAIL  board squares  wrong\nError: Target closed\n', 1) === null);
check('exit 0 never retries', chromeCrashReason('Target closed\n', 0) === null);
check('no crash text, no retry', chromeCrashReason('FAIL  group x ended with exit 1 and no FAIL row\n', 1) === null);

for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}`);
process.exit(cases.every((c) => c.ok) ? 0 : 1);
