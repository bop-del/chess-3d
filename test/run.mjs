// Test runner: node test/run.mjs [fast|smoke|phone|all]   (default fast; npm test calls it)
//   fast   no browser, seconds: rules (perft and game logic), piece geometry contract, text lint, audit planner rules, novice level
//   smoke  parallel groups (test/smoke-groups.mjs): vite build, preview on the lane's own port (5303 in the main checkout), only the groups the diff against main affects inside a lane (--all forces every group), cached passes print CACHED, one headless Chrome per group, scripted game, gimbal, budgets, pixel checks, fix checks, explain, drill, learn, battle scenes, themes
//          --shared-chrome (or CHESS_SHARED_CHROME=1): one Chrome for the whole smoke run, a BrowserContext per group (the default since CHE-186); --own-chrome (or =0) the old path, one Chrome per group (tools/README.md)
//   phone  phone sizes and real touch, the scripts at the same time (install in 2 parts), each cached by build, scripts and GL backend (CACHED, --no-cache reruns): tools/phoneshots.mjs (shots, contact sheets, tap target audit), test/touch.mjs, test/install.mjs (Add to Home Screen reminder)
//   one smoke or phone run at a time on the machine (CHE-257): a lock file in ~/.cache/chess-3d, a second run prints one queued line and waits, the wait is logged to .tmp/chrome-waits.jsonl (kind run). A --shots run does not wait: it runs with --jobs=2 (at most 2 groups at once) next to the other run
//   all    fast, then smoke. The release check is separate and slow (fresh npm ci): node tools/release-check.mjs
// Extra options after the tier are passed to the smoke run, for example: node test/run.mjs smoke --skip-build --skip-fixes, --affected, --all, --no-cache
// Exit codes: 0 all pass, 1 a check failed, 2 usage error, 3 nothing failed but a smoke group was skipped (no Chrome slot).
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireRunLock, buildHash } from '../tools/_lib.mjs';
import { getResult, groupKey, putResult } from '../tools/result-cache.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [tier = 'fast', ...rest] = process.argv.slice(2);
if (!['fast', 'smoke', 'phone', 'all'].includes(tier)) { console.error('usage: node test/run.mjs [fast|smoke|phone|all] [smoke options]'); process.exit(2); }

const results = [];
let runLock = null;
if (tier === 'smoke' || tier === 'phone' || tier === 'all') {
  if (rest.includes('--shots')) { if (!rest.some((a) => a.startsWith('--jobs='))) rest.push('--jobs=2'); console.log('      --shots run: no machine wide wait, at most 2 groups at once (--jobs=2)'); }
  else if (tier !== 'all') runLock = await acquireRunLock({ kind: tier });
}
const run = (name, script, args = [], { show = false } = {}) => {
  const t = Date.now();
  const r = spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', stdio: show ? 'inherit' : ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const secs = (Date.now() - t) / 1000;
  const ok = r.status === 0;
  results.push({ name, ok, secs, status: r.status });
  console.log(`${ok ? 'PASS' : r.status === 3 ? 'INCOMPLETE' : 'FAIL'}  ${name}  ${secs.toFixed(1)}s`);
  if (!ok && !show) {
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n');
    const bad = out.filter((l) => /^FAIL|FAILED|Error/.test(l));
    console.log((bad.length ? bad : out.slice(-12)).slice(0, 25).map((l) => '      ' + l).join('\n'));
  }
  return ok;
};

/** Independent browser steps at the same time (each has its own Chrome slot, port and dist folder): output is held per step and printed when it ends.
 *  Result cache (tools/result-cache.mjs, the same key shape as the smoke groups): a step that passed cleanly for the same build, scripts and GL backend prints CACHED and
 *  takes no Chrome slot. --no-cache runs every step for real. The cache needs a git checkout (the build hash); without one every step runs. */
const runParallel = (steps, { cache = true } = {}) => {
  let buildKey = ''; if (cache) { try { buildKey = buildHash(); } catch (e) { /* not a git checkout: no cache */ } }
  return Promise.all(steps.map(([name, script, args = []]) => new Promise((done) => {
    const t = Date.now();
    const key = buildKey ? groupKey([name, script, args], buildKey) : '';
    const hit = key ? getResult(key) : null;
    if (hit) {
      results.push({ name, ok: true, secs: 0, status: 0, cached: true });
      console.log(`--- ${name} CACHED (passed ${hit.pass} checks in ${hit.secs}s at ${hit.t.slice(0, 16).replace('T', ' ')}, same build and scripts)\n${(hit.warns || []).join('\n')}${hit.warns?.length ? '\n' : ''}PASS  ${name}  CACHED`);
      return done();
    }
    const c = spawn(process.execPath, [script, ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
    c.on('close', (status) => {
      const secs = (Date.now() - t) / 1000, ok = status === 0;
      results.push({ name, ok, secs, status });
      const rows = (r) => (out.match(new RegExp(`^${r}  `, 'gm')) || []).length;
      if (key && ok && !rows('FAIL')) putResult(key, { group: name, pass: rows('PASS'), warns: out.split('\n').filter((l) => /^WARN  /.test(l)), secs: Math.round(secs * 10) / 10 });
      console.log(`--- ${name}\n${out.trimEnd()}\n${ok ? 'PASS' : status === 3 ? 'INCOMPLETE' : 'FAIL'}  ${name}  ${secs.toFixed(1)}s`);
      done();
    });
  })));
};

const t0 = Date.now();
if (tier === 'fast' || tier === 'all') {
  console.log('--- fast tier (no browser)');
  run('rules: perft and game logic (test/perft.mjs)', 'test/perft.mjs');
  run('piece geometry contract (test/geometry.mjs)', 'test/geometry.mjs');
  run('capture tray layout (test/trays.mjs)', 'test/trays.mjs');
  run('block characters contract (test/blocks-chars.mjs)', 'test/blocks-chars.mjs');
  run('Pixelwelt figures contract (test/pixel-chars.mjs)', 'test/pixel-chars.mjs');
  run('Pixelwelt rules: closed ground, no coplanar faces, clamped textures, one material set (test/pixel-rules.mjs)', 'test/pixel-rules.mjs');
  run('Pixelwelt skies, backdrops, sets: choice, build and dispose, weather (test/pixel-sky.mjs)', 'test/pixel-sky.mjs');
  run('living pieces: signature moves and Pixelwelt birds (test/living.mjs)', 'test/living.mjs');
  run('text lint (test/lint.mjs)', 'test/lint.mjs');
  run('audit planner rules (test/audit-plan.mjs)', 'test/audit-plan.mjs');
  run('bin/lane flag parsing (test/lane-args.mjs)', 'test/lane-args.mjs');
  run('bin/lane agent identity prepend (test/lane-identity.mjs)', 'test/lane-identity.mjs');
  run('bin/lane kickoff verify and resend (test/kickoff.mjs)', 'test/kickoff.mjs');
  run('affected smoke groups, Chrome slots, lane ports (test/affected-groups.mjs)', 'test/affected-groups.mjs');
  run('run lock and group retry classifier (test/run-lock.mjs)', 'test/run-lock.mjs');
  run('opening lines are legal (test/openings.mjs)', 'test/openings.mjs');
  run('goal screens: target position, marks, goal sentences (test/goal.mjs)', 'test/goal.mjs');
  run('puzzle progress (test/puzzle-progress.mjs)', 'test/puzzle-progress.mjs');
  run('puzzle controller (test/puzzle-controller.mjs)', 'test/puzzle-controller.mjs');
  run('daily puzzle and streak (test/daily.mjs)', 'test/daily.mjs');
  run('badges: thresholds, wins, storage (test/badges.mjs)', 'test/badges.mjs');
  run('puzzle data is legal and solvable (test/puzzles-data.mjs)', 'test/puzzles-data.mjs');
  run('music data and logic (test/music.mjs)', 'test/music.mjs');
  run('novice level (test/novice.mjs)', 'test/novice.mjs');
  run('News rules and text (test/news.mjs)', 'test/news.mjs');
  run('chess clock (test/clock.mjs)', 'test/clock.mjs');
  run('adaptive quality governor (test/adapt.mjs)', 'test/adapt.mjs');
  run('game review core: classification, accuracy, engine (test/review-core.mjs)', 'test/review-core.mjs');
  run('training core: ladder, store, planner (test/train.mjs)', 'test/train.mjs');
}
if ((tier === 'smoke' || tier === 'all') && (tier === 'smoke' || results.every((r) => r.ok))) {
  if (!runLock && !rest.includes('--shots')) runLock = await acquireRunLock({ kind: 'smoke' });   // tier all: only after the fast tier passed, so a red fast tier never queues
  console.log('--- smoke tier (headless Chrome)');
  run('smoke (test/smoke-groups.mjs)', 'test/smoke-groups.mjs', rest, { show: true });
} else if (tier === 'all') console.log('--- smoke tier skipped because the fast tier failed');
if (tier === 'phone') {
  console.log('--- phone tier (headless Chrome, phone sizes, real touch)');
  // the scripts do not share state: one Chrome slot, port and dist folder each, so they run at the same time (the slot lock keeps it to what the machine allows)
  const shared = rest.filter((a) => !a.startsWith('--port=') && a !== '--no-cache');   // one port for several servers would clash: each script claims its own
  await runParallel([['phone screenshots and tap target audit (tools/phoneshots.mjs)', 'tools/phoneshots.mjs', shared], ['real touch (test/touch.mjs)', 'test/touch.mjs', shared], ['install reminder and manifest 1/2 (test/install.mjs)', 'test/install.mjs', [...shared, '--part=0/2']], ['install reminder and manifest 2/2 (test/install.mjs)', 'test/install.mjs', [...shared, '--part=1/2']]], { cache: !rest.includes('--no-cache') });
}

runLock?.release();
const bad = results.filter((r) => !r.ok).length;
console.log(`\n${results.length} steps, ${bad} failed, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (!bad && tier === 'all') console.log('Next: run the release check separately (fresh npm ci, slow): node tools/release-check.mjs');
process.exit(results.some((r) => r.status === 1) || (bad && !results.some((r) => r.status === 3)) ? 1 : bad ? 3 : 0);
