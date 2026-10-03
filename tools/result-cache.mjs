// Smoke group result cache in ~/.cache/chess-3d/results. A group that passed cleanly for the same build and the same scripts passes again,
// so it is not run again. Key: sha1 over (group name and args, build content hash, content of the group script and everything it imports,
// the GL backend actually used). Only passes (no FAIL, not skipped) are stored, with their WARN lines, which a cache hit prints again. A different source file changes the build hash and invalidates every
// group; a changed test script invalidates the groups that run it.
//   groupKey(group, buildKey)   the cache key for a [name, script, args] group
//   getResult(key) / putResult(key, info)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ROOT, defaultGl } from './_lib.mjs';
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
  h.update([name, script, ...extra, buildKey, defaultGl()].join('\0'));
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
