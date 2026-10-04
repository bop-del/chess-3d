// Measure a smoke run: node tools/measure-smoke.mjs [--label=<name>] [--env=KEY=VAL] <smoke options>   (every other option goes to the smoke run)
// Runs `node test/run.mjs smoke <options>`, samples `ps` every 2 s and sums the RSS of the headless Chrome processes that are descendants of that
// run (never other lanes' Chromes). Prints wall time, peak Chrome count, peak RSS sum, the PASS rows (sorted) and one JSON line for a table.
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './_lib.mjs';

const argv = process.argv.slice(2);
const own = (a) => a.startsWith('--label=') || a.startsWith('--env=');
const mine = argv.filter(own), smokeArgs = argv.filter((a) => !own(a));
const label = (mine.find((a) => a.startsWith('--label=')) || '--label=run').slice(8);
const env = { ...process.env };
for (const a of mine.filter((a) => a.startsWith('--env='))) { const [k, ...v] = a.slice(6).split('='); env[k] = v.join('='); }

const t0 = Date.now();
const child = spawn(process.execPath, ['test/run.mjs', 'smoke', ...smokeArgs], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });

let peakRss = 0, peakCount = 0, samples = 0;
const sample = () => {
  let rows;
  try { rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n'); } catch (e) { return; }
  const procs = new Map();
  for (const l of rows) { const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l); if (m) procs.set(Number(m[1]), { ppid: Number(m[2]), rss: Number(m[3]), cmd: m[4] }); }
  const kids = new Map(); for (const [pid, p] of procs) { if (!kids.has(p.ppid)) kids.set(p.ppid, []); kids.get(p.ppid).push(pid); }
  const mineSet = new Set(); const stack = [child.pid];
  while (stack.length) { const p = stack.pop(); if (mineSet.has(p)) continue; mineSet.add(p); stack.push(...(kids.get(p) || [])); }
  // crashpad handlers and helpers are re-parented to 1, so also take processes whose command line carries a user-data-dir that one of our browsers uses
  const dirs = new Set(); for (const pid of mineSet) { const m = /--user-data-dir=(\S+)/.exec(procs.get(pid)?.cmd || ''); if (m) dirs.add(m[1]); }
  let rss = 0, n = 0;
  for (const [pid, p] of procs) {
    const isChrome = /chrome-headless-shell|Google Chrome|Chromium/.test(p.cmd);
    if (!isChrome) continue;
    const own = mineSet.has(pid) || [...dirs].some((d) => p.cmd.includes(d));
    if (own) { rss += p.rss; n++; }
  }
  samples++; if (rss > peakRss) peakRss = rss; if (n > peakCount) peakCount = n;
};
const timer = setInterval(sample, 2000);
const code = await new Promise((r) => child.on('close', r));
clearInterval(timer);
const wall = (Date.now() - t0) / 1000;
mkdirSync(join(ROOT, '.tmp/builder'), { recursive: true });
writeFileSync(join(ROOT, '.tmp/builder', `${label}.log`), out);
const passes = out.split('\n').filter((l) => /^PASS  /.test(l)).map((l) => l.replace(/\s+\d+(\.\d+)?s\s*$/, '').replace(/  \d[\d.]*(ms|s)\b.*$/, '')).sort();
const fails = out.split('\n').filter((l) => /^FAIL  /.test(l));
writeFileSync(join(ROOT, '.tmp/builder', `${label}.pass.txt`), passes.join('\n') + '\n');
console.log(JSON.stringify({ label, exit: code, wallSecs: Math.round(wall), peakChromeProcs: peakCount, peakRssMB: Math.round(peakRss / 1024), samples, pass: passes.length, fail: fails.length }));
if (fails.length) console.log(fails.join('\n'));
