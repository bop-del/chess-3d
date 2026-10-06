// Parallel smoke tier: node test/smoke-groups.mjs [smoke options]   (the entry point of node test/run.mjs smoke)
// Builds once, serves once, then runs the groups of test/smoke.mjs as separate processes, each with its own headless Chrome from
// launchBrowser(). The machine wide slot lock (2 to 4, adaptive by load) decides how many run at the same time, the rest wait their
// turn, so two free slots still work, only slower. Same checks as a plain `node test/smoke.mjs`, same --shots contact sheets.
// Exit codes: 0 every group ran and passed, 1 a check failed, 3 nothing failed but a group was skipped for slot starvation.
// Affected groups: inside a lane worktree only the groups the diff against main affects run (tools/affected-groups.mjs, core paths run all),
// outside a lane all of them. --affected forces the diff (--since=<ref> compares with that ref instead of main), --all forces everything (do this before a release). Skipped groups are listed.
// Result cache: a group that passed cleanly for the same build and scripts prints CACHED, takes no Chrome slot and needs no build. --no-cache
// (also implied by --shots, --write-budgets and --dev) runs everything for real. Ports: derived from the lane name (tools/_lib.mjs lanePorts).
// Schedule: the groups to run start longest first, by the run times stored in the result cache (tools/result-cache.mjs groupTimings), groups without a time in list order after them.
// Shared Chrome (CHE-171, off by default): --shared-chrome (or CHESS_SHARED_CHROME=1) starts ONE headless Chrome for the whole run, holding one slot, and every group gets a BrowserContext of it instead of its own Chrome
// (launchBrowser() in tools/_lib.mjs connects through CHESS_SHARED_WS). A group asking for other args, GL or executable falls back to its own Chrome and logs why. --own-chrome (or CHESS_SHARED_CHROME=0) forces the old path.
// Options: --port=<lane preview port, 5303 in the main checkout> --dev --dev-port=<lane dev port, 5302> --skip-build --write-budgets --shots --skip-fixes, plus --only=<group,group> to run just those groups, --jobs=<n> to set the number of processes at once (default: the free Chrome slots at start, at least 2, so waiting groups do not hit the 15 minute lock timeout).
// Retry: a group whose Chrome died (Target closed, frame got detached, protocol error from a closed target) runs once more, logged to .tmp/chrome-waits.jsonl as kind retry; a second death or any real check FAIL is final (chromeCrashReason in tools/_lib.mjs).
// A group that still finds no slot is reported as SKIPPED (slot starvation), not as a failure: run it alone with node test/smoke.mjs --group=<name>.
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, appendWaitLog, chromeCrashReason, build, buildHash, freeSlots, laneName, lanePorts, launchBrowser, launchSharedHost, disposeSharedContext, sharedChromeOn, startServer, claimPort } from '../tools/_lib.mjs';
import { affectedGroups, changedFiles } from '../tools/affected-groups.mjs';
import { getResult, groupKey, groupTimings, longestFirst, putResult } from '../tools/result-cache.mjs';
import { GROUPS as ALL_GROUPS, SMOKE, family } from './smoke-group-list.mjs';
import { contactSheets } from '../tools/contact-sheet.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flag = (n) => args.includes(`--${n}`);
const PORTS = lanePorts();
const PORT = opt('port', '') ? Number(opt('port', '')) : (await claimPort()).port, DEV_PORT = opt('dev-port', '') ? Number(opt('dev-port', '')) : (await claimPort({ kind: 'dev' })).port, OUT = '.tmp/smoke-dist', SHOTS = join(ROOT, '.tmp/smoke-shots');
const QUIET_MS = Number(process.env.SMOKE_QUIET_MS || 60000);   // a child silent this long after its first output is killed
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const GROUPS = ALL_GROUPS
  .filter(([n]) => !(flag('skip-fixes') && n.startsWith('fixes')))
  .filter(([n]) => !opt('only', '') || opt('only', '').split(',').some((o) => o === n || o === family(n)));   // --only=textures,views runs just those groups (a family name runs all its parts)

// affected groups: default inside a lane worktree, --all forces everything
const lane = laneName();
const useAffected = !flag('all') && (flag('affected') || (!!lane && !opt('only', '')));
const notAffected = [];
let selected = GROUPS;
if (useAffected) {
  const files = changedFiles(ROOT, opt('since', 'main'));
  if (!files) console.log('WARN  cannot diff against main, running every group');
  else {
    const r = affectedGroups(files);
    selected = GROUPS.filter(([n]) => r.groups.includes(family(n)));
    for (const [n] of GROUPS) if (!selected.some(([m]) => m === n)) notAffected.push(n);
    console.log(`affected groups vs ${opt("since", "main")}: ${r.all ? 'all (' + r.reason + ')' : selected.map(([n]) => n).join(', ') || 'none'}${r.all ? '' : ` (${r.reason}; ${files.length} changed files)`}`);
  }
}
console.log(`ports: preview ${PORT}, dev ${DEV_PORT}${lane ? ` (lane ${lane})` : ' (main checkout)'}`);

// result cache: needs the build hash of what would be served
let buildKey = '';
if (!flag('dev') && !flag('no-cache') && !flag('shots') && !flag('write-budgets')) { try { buildKey = buildHash(); } catch (e) { /* not a git checkout: no cache */ } }
const cached = [], todo = [];
for (const g of selected) {
  const key = buildKey ? groupKey(g, buildKey) : '';
  const hit = key ? getResult(key) : null;
  if (hit) cached.push({ g, hit }); else todo.push({ g, key });
}
const JOBS = Math.max(1, Number(opt('jobs', Math.max(2, freeSlots()))));

let server = null, host = null, rehost = null;
const hostAlive = (h) => { try { return typeof h.connected === 'boolean' ? h.connected : h.isConnected(); } catch (e) { return false; } };
const fail = (m) => { console.log('FAIL  ' + m); console.log('SMOKE FAILED'); process.exit(1); };
try {
  if (!todo.length) console.log('PASS  every selected group is cached or not affected: no build, no server, no Chrome');
  else if (flag('dev')) server = await startServer({ mode: 'dev', port: DEV_PORT });
  else {
    if (!flag('skip-build')) {
      const tb = Date.now(), out = build(OUT);
      console.log(`PASS  vite build  ${((Date.now() - tb) / 1000).toFixed(1)}s`);
      const warns = out.split('\n').filter((l) => /warn|error|\(!\)/i.test(l));
      if (warns.length) console.log(`WARN  build output has no warnings  ${warns.slice(0, 2).join(' | ')}`);
    }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  if (server) console.log(`PASS  server up  ${server.base}`);
} catch (e) { fail('build and serve  ' + String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400)); }

if (flag('shots')) {
  mkdirSync(SHOTS, { recursive: true });
  for (const f of readdirSync(SHOTS)) if (f.endsWith('.png')) rmSync(join(SHOTS, f));
}
const base = server ? server.base : '';
const pass = ['--skip-build', `--base=${base}`, ...args.filter((a) => /^--(write-budgets|shots|tabs=)/.test(a) || a === '--skip-fixes')];
const totals = { np: server ? 2 : 1, nw: 0, nf: 0 }, skipped = [];   // the build and the server rows printed above (or the one cached row)
for (const { g: [name], hit } of cached) { totals.np += hit.pass; totals.nw += (hit.warns || []).length; console.log(`--- group ${name} CACHED (passed ${hit.pass} checks in ${hit.secs}s at ${hit.t.slice(0, 16).replace('T', ' ')}, same build and scripts)`); for (const w of hit.warns || []) console.log(w); }
const runGroup = ({ g: [name, script, extra], key }, attempt = 1) => new Promise((resolve) => {
  const tg = Date.now();
  const c = spawn(process.execPath, [script, ...(script === SMOKE ? pass : [`--base=${base}`]), ...extra], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const contexts = new Set(); c.on('message', (m) => { if (m && m.sharedContext) contexts.add(m.sharedContext); });   // shared Chrome: the browser contexts this child opened
  let out = ''; const trace = (d) => { out += d; if (process.env.SMOKE_TRACE) { mkdirSync(join(ROOT, '.tmp/smoke-trace'), { recursive: true }); appendFileSync(join(ROOT, '.tmp/smoke-trace', name.replace(/\W+/g, '-') + '.log'), String(d).split('\n').filter(Boolean).map((l) => `${((Date.now() - t0) / 1000).toFixed(1)}s ${l}`).join('\n') + '\n'); } };   // SMOKE_TRACE=1: every output line of every group with the time it arrived, in .tmp/smoke-trace/
  // Safety net: a child silent for QUIET_MS after its first output (so not while it waits for a Chrome slot) is killed, by its own PID only.
  // A stall after the last check then costs 60 s, not minutes; the group is judged by its rows. With SMOKE_TRACE the process list is saved
  // first (.tmp/smoke-trace/<group>.stall.txt) and the child is asked for its active handles (SIGUSR2, see tools/_lib.mjs).
  let killedQuiet = false, quiet;
  const arm = () => { clearTimeout(quiet); quiet = setTimeout(() => {
    killedQuiet = true;
    if (process.env.SMOKE_TRACE) {
      try { c.kill('SIGUSR2'); } catch (e) { /* ignore */ }
      let tree = ''; try { tree = 'LSOF\n' + execFileSync('lsof', ['-nP', '-p', String(c.pid)], { encoding: 'utf8' }) + '\nPS\n'; } catch (e) { /* ignore */ }
      try { tree += execFileSync('ps', ['-axo', 'pid,ppid,stat,etime,command'], { encoding: 'utf8' }).split('\n').filter((l) => /chess-3d|Chrome|node|vite/i.test(l)).join('\n'); } catch (e) { /* ignore */ }
      mkdirSync(join(ROOT, '.tmp/smoke-trace'), { recursive: true });
      appendFileSync(join(ROOT, '.tmp/smoke-trace', name.replace(/\W+/g, '-') + '.stall.txt'), `${secs()} quiet for ${QUIET_MS / 1000}s, child pid ${c.pid}\n${tree}\n`);
    }
    setTimeout(() => { try { c.kill('SIGKILL'); } catch (e) { /* ignore */ } }, process.env.SMOKE_TRACE ? 1500 : 0);
  }, QUIET_MS); };
  const onData = (d) => { if (/waiting for a headless Chrome slot/.test(String(d))) { clearTimeout(quiet); return; } arm(); };   // waiting for a slot is not a stall: the timer starts again at the next line
  c.stdout.on('data', onData); c.stderr.on('data', onData);
  c.stdout.on('data', trace); c.stderr.on('data', trace);
  c.on('close', async (code) => {
    clearTimeout(quiet);
    if (host) for (const id of contexts) await disposeSharedContext(host, id);   // a crashed or killed group must not leave its pages in the shared Chrome
    if (killedQuiet) {
      out += `\nWARN  killed quiet child  group ${name} printed nothing for ${QUIET_MS / 1000}s after its last row, judged by its rows\n`;
      code = /^PASS  /m.test(out) ? 0 : 1;
    }
    if (/slots busy for over/.test(out)) {   // never got a Chrome: slot starvation, not a failure of the checks
      skipped.push(name);
      console.log(`--- group ${name} SKIPPED, no headless Chrome slot (${((Date.now() - tg) / 1000).toFixed(1)}s): run ${script === SMOKE ? `node test/smoke.mjs --group=${extra[0].slice(8)}${extra[1] ? ' ' + extra[1] : ''}` : `node ${script}`} --skip-build --base=${base}`);
      return resolve();
    }
    const why = killedQuiet ? null : chromeCrashReason(out, code);   // the Chrome died under the group: once more, a second death is a real FAIL; a real check FAIL is never retried
    if (why && attempt === 1) {
      console.log(`--- group ${name} RETRY (${((Date.now() - tg) / 1000).toFixed(1)}s): Chrome died (${why}), running it once more\n${out.trimEnd().split('\n').slice(-6).map((l) => '      ' + l).join('\n')}`);
      appendWaitLog({ kind: 'retry', group: name, reason: why });
      if (host && !hostAlive(host)) {   // the shared Chrome itself died: every group in it crashed, so the retry needs a fresh one (one launch for all the groups that retry)
        rehost ||= (async () => { try { await host.close(); } catch (e) { /* dead already */ } host = await launchSharedHost({ w: 1280, h: 720 }); console.log('      shared headless Chrome died, started a new one'); })().finally(() => { rehost = null; });
        try { await rehost; } catch (e) { out += '\nFAIL  shared Chrome could not be restarted for the retry  ' + String(e.message).slice(0, 200); totals.nf++; console.log(`--- group ${name} (${((Date.now() - tg) / 1000).toFixed(1)}s)\n${out.trimEnd()}`); return resolve(); }
      }
      return resolve(runGroup({ g: [name, script, extra], key }, 2));
    }
    const rows = (s) => (out.match(new RegExp(`^${s}  `, 'gm')) || []).length;   // count the result rows, battle.mjs prints no summary line
    const nf = rows('FAIL'), nw = rows('WARN');
    totals.np += rows('PASS'); totals.nw += nw; totals.nf += nf;
    if (key && code === 0 && !nf) putResult(key, { group: name, pass: rows('PASS'), warns: out.split('\n').filter((l) => /^WARN  /.test(l)), secs: Math.round((Date.now() - tg) / 100) / 10 });
    if (code !== 0 && !nf) { totals.nf++; out += '\nFAIL  group ' + name + ' ended with exit ' + code + ' and no FAIL row'; }
    console.log(`--- group ${name} (${((Date.now() - tg) / 1000).toFixed(1)}s)\n${out.trimEnd()}`);
    resolve();
  });
});
try {
  if (todo.length && sharedChromeOn(args)) { host = await launchSharedHost({ w: 1280, h: 720 }); console.log('      shared headless Chrome started (one slot, groups use browser contexts)'); }
  const queue = longestFirst(todo, groupTimings());   // longest known group first, from the stored run times; no time yet: the list order
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => { for (let g; (g = queue.shift());) await runGroup(g); }));

  if (flag('shots')) {
    let b = null;
    try { b = await launchBrowser({ w: 1280, h: 720 }); for (const f of await contactSheets(b, SHOTS)) console.log(`      contact sheet: ${f.slice(ROOT.length + 1)}`); }
    catch (e) { console.log('WARN  contact sheet  ' + String(e.message).slice(0, 200)); }
    finally { try { await b?.close(); } catch (e) { /* ignore */ } }
  }
} finally { try { await host?.close(); } catch (e) { /* ignore */ } server?.stop(); }
console.log(`\nsmoke: ${totals.np + totals.nw + totals.nf} checks: ${totals.np} pass, ${totals.nw} warn, ${totals.nf} fail (${secs()})`);
if (notAffected.length) console.log(`SKIPPED (not affected by this diff): ${notAffected.join(', ')}. node test/run.mjs smoke --all runs them.`);
if (cached.length) console.log(`CACHED: ${cached.map(({ g: [n] }) => n).join(', ')} (${cached.length} of ${selected.length} selected groups, no Chrome slot used)`);
for (const n of skipped) console.log(`SKIP  group ${n}: no headless Chrome slot, its checks did not run`);
const rerun = skipped.map((n) => n.replace(/ \d\/\d$/, '')).filter((n, i, a) => a.indexOf(n) === i).join(', ');
console.log(totals.nf ? 'SMOKE FAILED' : skipped.length ? `SMOKE INCOMPLETE: no Chrome slot for ${skipped.join(', ')}. Rerun: node test/smoke.mjs --group=<name> --skip-build (${rerun})` : totals.nw ? 'SMOKE OK WITH WARNINGS' : 'SMOKE OK');
process.exit(totals.nf ? 1 : skipped.length ? 3 : 0);   // 0 all groups ran and passed, 1 a check failed, 3 nothing failed but a group was skipped
