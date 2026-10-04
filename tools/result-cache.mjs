// Smoke group result cache in ~/.cache/chess-3d/results. A group that passed cleanly for the same build and the same scripts passes again,
// so it is not run again. Key: sha1 over (group name and args, build content hash, content of the group script and everything it imports,
// the GL backend actually used). Only passes (no FAIL, not skipped) are stored, with their WARN lines, which a cache hit prints again. A different source file changes the build hash and invalidates every
// group; a changed test script invalidates the groups that run it.
//   groupKey(group, buildKey)   the cache key for a [name, script, args] group
//   getResult(key) / putResult(key, info)
//   groupTimings(dir)           newest known run time in seconds per group name, from the stored passes of any build (the schedule input of the smoke run)
//   longestFirst(items, timings)  items ([name, ...] or { g: [name, ...] }) sorted by known time, longest first; groups without a time keep their place after the timed ones
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ROOT, defaultGl, browserKind } from './_lib.mjs';
import { SMOKE } from '../test/smoke-group-list.mjs';

export const RESULTS_DIR = join(homedir(), '.cache', 'chess-3d', 'results');
const KEEP = 400;

// relative imports, static or dynamic with a literal path
const IMPORT_RE = /(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
function deps(file, seen = new Set()) {
  if (seen.has(file) || !existsSync(file)) return seen;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(IMPORT_RE)) deps(resolve(dirname(file), m[1]), seen);
  return seen;
}

/** Files whose content decides what a group does. smoke.mjs loads its group modules by name (test/<group>.mjs), so only the one of this group counts. */
export function groupFiles(script, extra = [], root = ROOT) {
  const files = deps(join(root, script));
  if (script === SMOKE) {
    const g = (extra.find((a) => a.startsWith('--group=')) || '').slice(8);
    if (g) deps(join(root, 'test', g + '.mjs'), files);
  }
  return [...files].sort();
}

export function groupKey([name, script, extra], buildKey, root = ROOT) {
  const h = createHash('sha1');
  h.update([name, script, ...extra, buildKey, defaultGl(), browserKind()].join('\0'));
  for (const f of groupFiles(script, extra, root)) { h.update('\0' + f.slice(root.length)); h.update(readFileSync(f)); }
  return h.digest('hex').slice(0, 20);
}

export function getResult(key) {
  try { return JSON.parse(readFileSync(join(RESULTS_DIR, key + '.json'), 'utf8')); } catch (e) { return null; }
}

export function putResult(key, info) {
  try {
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(join(RESULTS_DIR, key + '.json'), JSON.stringify({ ...info, t: new Date().toISOString() }));
    const all = readdirSync(RESULTS_DIR).filter((n) => n.endsWith('.json')).map((n) => ({ n, t: statSync(join(RESULTS_DIR, n)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const old of all.slice(KEEP)) rmSync(join(RESULTS_DIR, old.n), { force: true });
  } catch (e) { /* the cache is best effort */ }
}

/** Newest stored run time per group name. Passes of every build count: the time of a group hardly depends on the build, the key does. Cached rows (secs 0) are never stored. */
export function groupTimings(dir = RESULTS_DIR) {
  const t = {};
  try {
    const rows = readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => { try { return JSON.parse(readFileSync(join(dir, n), 'utf8')); } catch (e) { return null; } }).filter((r) => r && r.group && r.secs > 0 && r.t);
    rows.sort((a, b) => (a.t < b.t ? -1 : 1));   // oldest first, so the newest wins
    for (const r of rows) t[r.group] = r.secs;
  } catch (e) { /* no cache yet */ }
  return t;
}

/** Longest known group first (the long groups then start at once and the short ones fill the gaps at the end). Stable: groups with no timing keep their list order, after the timed ones. */
export function longestFirst(items, timings, nameOf = (x) => (x.g || x)[0]) {
  const known = (x) => timings[nameOf(x)] > 0;
  const timed = items.filter(known).sort((a, b) => timings[nameOf(b)] - timings[nameOf(a)]);
  return [...timed, ...items.filter((x) => !known(x))];
}
