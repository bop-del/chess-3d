// Parallel smoke tier: node test/smoke-groups.mjs [smoke options]   (the entry point of node test/run.mjs smoke)
// Builds once, serves once, then runs the groups of test/smoke.mjs as separate processes, each with its own headless Chrome from
// launchBrowser(). The machine wide slot lock (2 to 4, adaptive by load) decides how many run at the same time, the rest wait their
// turn, so two free slots still work, only slower. Same checks as a plain `node test/smoke.mjs`, same --shots contact sheets.
// Exit codes: 0 every group ran and passed, 1 a check failed, 3 nothing failed but a group was skipped for slot starvation.
// Options: --port=5303 --dev --dev-port=5302 --skip-build --write-budgets --shots --skip-fixes, plus --only=<group,group> to run just those groups, --jobs=<n> to set the number of processes at once (default: the free Chrome slots at start, at least 2, so waiting groups do not hit the 15 minute lock timeout).
// A group that still finds no slot is reported as SKIPPED (slot starvation), not as a failure: run it alone with node test/smoke.mjs --group=<name>.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, build, freeSlots, launchBrowser, startServer } from '../tools/_lib.mjs';
import { contactSheets } from '../tools/contact-sheet.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flag = (n) => args.includes(`--${n}`);
const PORT = Number(opt('port', 5303)), DEV_PORT = Number(opt('dev-port', 5302)), OUT = '.tmp/smoke-dist', SHOTS = join(ROOT, '.tmp/smoke-shots');
const JOBS = Math.max(1, Number(opt('jobs', Math.max(2, freeSlots()))));
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
// longest first: the two fix halves (about 60 s each), then the rest. battle, views, tokens and play are their own scripts (test/battle.mjs, views.mjs, tokens.mjs, play.mjs), on the same server.
const SMOKE = 'test/smoke.mjs';
const GROUPS = [['fixes 1/2', SMOKE, ['--group=fixes', '--part=0/2']], ['fixes 2/2', SMOKE, ['--group=fixes', '--part=1/2']], ['battle', 'test/battle.mjs', []], ['music', 'test/music-page.mjs', []], ['themes', 'test/themes.mjs', []], ['textures', 'test/textures.mjs', []], ['intro', 'test/intro.mjs', []], ['learn', SMOKE, ['--group=learn']], ['drill', SMOKE, ['--group=drill']], ['core', SMOKE, ['--group=core']], ['explain', SMOKE, ['--group=explain']], ['views', 'test/views.mjs', []], ['tokens', 'test/tokens.mjs', []], ['play', 'test/play.mjs', []], ['goodmove', SMOKE, ['--group=goodmove']], ['puzzles', SMOKE, ['--group=puzzles']]]
  .filter(([n]) => !(flag('skip-fixes') && n.startsWith('fixes')))
  .filter(([n]) => !opt('only', '') || opt('only', '').split(',').includes(n));   // --only=textures,views runs just those groups

let server = null;
const fail = (m) => { console.log('FAIL  ' + m); console.log('SMOKE FAILED'); process.exit(1); };
try {
  if (flag('dev')) server = await startServer({ mode: 'dev', port: DEV_PORT });
  else {
    if (!flag('skip-build')) {
      const tb = Date.now(), out = build(OUT);
      console.log(`PASS  vite build  ${((Date.now() - tb) / 1000).toFixed(1)}s`);
      const warns = out.split('\n').filter((l) => /warn|error|\(!\)/i.test(l));
      if (warns.length) console.log(`WARN  build output has no warnings  ${warns.slice(0, 2).join(' | ')}`);
    }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  console.log(`PASS  server up  ${server.base}`);
} catch (e) { fail('build and serve  ' + String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400)); }

if (flag('shots')) {
  mkdirSync(SHOTS, { recursive: true });
  for (const f of readdirSync(SHOTS)) if (f.endsWith('.png')) rmSync(join(SHOTS, f));
}
const pass = ['--skip-build', `--base=${server.base}`, ...args.filter((a) => /^--(write-budgets|shots|tabs=)/.test(a) || a === '--skip-fixes')];
const totals = { np: 2, nw: 0, nf: 0 }, skipped = [];   // 2: the build and the server rows printed above
const runGroup = ([name, script, extra]) => new Promise((resolve) => {
  const tg = Date.now();
  const c = spawn(process.execPath, [script, ...(script === SMOKE ? pass : [`--base=${server.base}`]), ...extra], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
  c.on('close', (code) => {
    if (/slots busy for over/.test(out)) {   // never got a Chrome: slot starvation, not a failure of the checks
      skipped.push(name);
      console.log(`--- group ${name} SKIPPED, no headless Chrome slot (${((Date.now() - tg) / 1000).toFixed(1)}s): run ${script === SMOKE ? `node test/smoke.mjs --group=${extra[0].slice(8)}${extra[1] ? ' ' + extra[1] : ''}` : `node ${script}`} --skip-build --base=${server.base}`);
      return resolve();
    }
    const rows = (s) => (out.match(new RegExp(`^${s}  `, 'gm')) || []).length;   // count the result rows, battle.mjs prints no summary line
    const nf = rows('FAIL'), nw = rows('WARN');
    totals.np += rows('PASS'); totals.nw += nw; totals.nf += nf;
    if (code !== 0 && !nf) { totals.nf++; out += '\nFAIL  group ' + name + ' ended with exit ' + code + ' and no FAIL row'; }
    console.log(`--- group ${name} (${((Date.now() - tg) / 1000).toFixed(1)}s)\n${out.trimEnd()}`);
    resolve();
  });
});
const queue = GROUPS.slice();
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => { for (let g; (g = queue.shift());) await runGroup(g); }));

if (flag('shots')) {
  let b = null;
  try { b = await launchBrowser({ w: 1280, h: 720 }); for (const f of await contactSheets(b, SHOTS)) console.log(`      contact sheet: ${f.slice(ROOT.length + 1)}`); }
  catch (e) { console.log('WARN  contact sheet  ' + String(e.message).slice(0, 200)); }
  finally { try { await b?.close(); } catch (e) { /* ignore */ } }
}
server.stop();
console.log(`\nsmoke: ${totals.np + totals.nw + totals.nf} checks: ${totals.np} pass, ${totals.nw} warn, ${totals.nf} fail (${secs()})`);
for (const n of skipped) console.log(`SKIP  group ${n}: no headless Chrome slot, its checks did not run`);
const rerun = skipped.map((n) => n.replace(/ \d\/\d$/, '')).filter((n, i, a) => a.indexOf(n) === i).join(', ');
console.log(totals.nf ? 'SMOKE FAILED' : skipped.length ? `SMOKE INCOMPLETE: no Chrome slot for ${skipped.join(', ')}. Rerun: node test/smoke.mjs --group=<name> --skip-build (${rerun})` : totals.nw ? 'SMOKE OK WITH WARNINGS' : 'SMOKE OK');
process.exit(totals.nf ? 1 : skipped.length ? 3 : 0);   // 0 all groups ran and passed, 1 a check failed, 3 nothing failed but a group was skipped
