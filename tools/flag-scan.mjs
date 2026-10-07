// CHE-315: finds the URL flag names the game reads (the readers of the URL parameters in src/) and loads the flag registry
// docs/preview-flags.json. Shared by test/flags.mjs (fast tier) and tools/check-flags.mjs (the land check).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTRY = 'docs/preview-flags.json';
// a read of a URL parameter: <receiver>.get('name') or .has('name'), where the receiver is a URLSearchParams
// (params, q, qs, usp, params(), new URLSearchParams(...))
const READ = /(?:\b(?:params|q|qs|usp|sp)|\bparams\(\)|URLSearchParams\([^()]*(?:\([^()]*\)[^()]*)*\))\s*\.(?:get|has)\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/g;

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(js|mjs)$/.test(n)) out.push(f);
  }
  return out;
}

/** Map of flag name to the list of "file:line" places in src/ (and index.html scripts are not used) that read it. */
export function scanReaders(root = ROOT) {
  const found = new Map();
  for (const f of walk(join(root, 'src'))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(READ)) {
        if (!found.has(m[1])) found.set(m[1], []);
        found.get(m[1]).push(`${relative(root, f)}:${i + 1}`);
      }
    });
  }
  return found;
}

export function loadRegistry(root = ROOT) {
  return JSON.parse(readFileSync(join(root, REGISTRY), 'utf8'));
}

/** Names the registry knows: the preview flags plus the normal ones. */
export function registered(reg) {
  return new Set([...reg.normal, ...reg.flags.map((f) => f.flag)]);
}
