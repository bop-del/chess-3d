// Chrome registry and reaper of tools/_lib.mjs (CHE-270). Fast tier: fake process tables, temp dirs, no real kill.
// Run: node test/reap-chromes.mjs    Exit 0 when every case holds, 1 otherwise.
import { registerChrome, unregisterChrome, reapChromes, orphanChromes } from '../tools/_lib.mjs';
import { mkdtempSync, existsSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cases = [];
const check = (name, ok) => cases.push({ name, ok: !!ok });
const dir = mkdtempSync(join(tmpdir(), 'chess-chromes-'));
const profile = (n) => join(tmpdir(), `puppeteer_dev_chrome_profile-fake${n}`);

try {
  registerChrome({ pid: 500, profile: profile(1), owner: 10, dir });
  check('register writes one file with pid, profile, owner, start', (() => { const e = JSON.parse(readFileSync(join(dir, '500.json'), 'utf8')); return e.pid === 500 && e.profile === profile(1) && e.owner === 10 && e.start; })());
  unregisterChrome(500, dir);
  check('unregister removes it', !existsSync(join(dir, '500.json')));

  const run = async (entries, procs, alive, extra = {}) => {
    for (const e of entries) registerChrome({ dir, ...e });
    const kills = [], logs = [], gone = new Set();
    const table = () => new Map(Object.entries(procs).filter(([pid]) => !gone.has(Number(pid))).map(([pid, command]) => [Number(pid), { ppid: 1, command }]));
    const reaped = await reapChromes({
      dir, table, wait: async () => {}, log: (l) => logs.push(l),
      isAlive: (pid) => alive.has(pid) && !gone.has(pid),
      kill: (pid, sig) => { kills.push([pid, sig]); if (sig === (extra.dies || 'SIGTERM')) gone.add(pid); },
    });
    return { kills, logs, reaped };
  };

  // owner gone, chrome alive with its profile: SIGTERM only when it dies by it
  let r = await run([{ pid: 600, profile: profile(2), owner: 20 }], { 600: `chrome --user-data-dir=${profile(2)}` }, new Set([600]));
  check('dead owner: SIGTERM, no SIGKILL when it exits', r.kills.length === 1 && r.kills[0][1] === 'SIGTERM' && r.reaped.length === 1);
  check('reap is logged as kind reap with pid and how', r.logs[0]?.kind === 'reap' && r.logs[0].pid === 600 && r.logs[0].how === 'SIGTERM');
  check('entry removed after reap', readdirSync(dir).length === 0);

  // stubborn chrome: SIGKILL after the wait
  r = await run([{ pid: 601, profile: profile(3), owner: 21 }], { 601: `chrome --user-data-dir=${profile(3)}` }, new Set([601]), { dies: 'SIGKILL' });
  check('survives SIGTERM: SIGKILL follows', r.kills.map((k) => k[1]).join() === 'SIGTERM,SIGKILL' && r.logs[0].how === 'SIGKILL');

  // live owner: untouched
  r = await run([{ pid: 602, profile: profile(4), owner: 22 }], { 602: `chrome --user-data-dir=${profile(4)}` }, new Set([602, 22]));
  check('live owner: nothing killed, entry kept', r.kills.length === 0 && existsSync(join(dir, '602.json')));
  unregisterChrome(602, dir);

  // pid reused by another program: no kill, entry dropped
  r = await run([{ pid: 603, profile: profile(5), owner: 23 }], { 603: '/usr/bin/vim notes.txt' }, new Set([603]));
  check('pid reused (command lacks the profile): no kill, entry dropped', r.kills.length === 0 && r.logs.length === 0 && !existsSync(join(dir, '603.json')));

  // chrome already gone: entry dropped, no log
  r = await run([{ pid: 604, profile: profile(6), owner: 24 }], {}, new Set());
  check('chrome gone: entry dropped quietly', r.kills.length === 0 && r.logs.length === 0 && !existsSync(join(dir, '604.json')));

  // a Chrome not in the registry is never touched
  r = await run([], { 700: `chrome --user-data-dir=${profile(7)}` }, new Set([700]));
  check('unregistered Chrome is never touched', r.kills.length === 0);

  // orphan lister
  const t = new Map([
    [1, { ppid: 0, command: 'launchd' }],
    [800, { ppid: 1, command: `chrome-headless-shell --user-data-dir=/tmp/puppeteer_dev_chrome_profile-abc` }],
    [801, { ppid: 1, command: `chrome-headless-shell --type=renderer --user-data-dir=/tmp/puppeteer_dev_chrome_profile-abc` }],
    [802, { ppid: 55, command: `chrome-headless-shell --user-data-dir=/tmp/puppeteer_dev_chrome_profile-def` }],
    [803, { ppid: 1, command: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }],
  ]);
  check('orphans: only puppeteer main processes with parent launchd', JSON.stringify(orphanChromes(t).map((o) => o.pid)) === '[800]');
} finally { rmSync(dir, { recursive: true, force: true }); }

for (const c of cases) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
process.exit(cases.every((c) => c.ok) ? 0 : 1);
