// Flake ledger (CHE-431): every check that failed and then passed on a retry is one line in .tmp/flakes.jsonl
// { t, group, check, reason }. The smoke runner (test/smoke-groups.mjs) writes it when the retry of a group passes; preland and land print
// failingChecks() so a red names the checks, not only counts. flakeCounts() is the 14 day window the private tooling uses to turn two
// retries of one check into a lesson and a root cause item (private lib/flake-lessons.mjs). Pure functions plus two small file helpers.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// own ROOT, not from _lib.mjs: lane-preland imports this module and must not load puppeteer-core (private test-lane-keys copies tools/ without node_modules)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// One ledger for all lanes: a lane worktree is removed when it lands, so the file sits in the main checkout (git common dir). FLAKES_FILE overrides (tests).
const mainRoot = () => { try { return resolve(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), '..'); } catch (e) { return ROOT; } };
export const FLAKES_FILE = process.env.FLAKES_FILE || join(mainRoot(), '.tmp', 'flakes.jsonl');
export const WINDOW_DAYS = 14;
export const LESSON_AT = 2;   // retries of one check inside the window that make a lesson

const CRASH_ROW = /^FAIL  group .* ended with exit/;

/** The FAIL rows of a run's output, trimmed and unique, in order. A group "ended with exit" row is a consequence, not a check. */
export function failingChecks(out, max = 12) {
  const rows = String(out).split('\n').map((l) => l.trim()).filter((l) => /^FAIL\b/.test(l) && !CRASH_ROW.test(l));
  return [...new Set(rows.map((l) => l.replace(/\s+/g, ' ').slice(0, 160)))].slice(0, max);
}

/** The name the ledger files a first-attempt failure under: the first FAIL row without its FAIL prefix, else the crash reason. */
export function checkName(out, reason = '') {
  const first = failingChecks(out, 1)[0];
  return (first ? first.replace(/^FAIL\s+/, '') : String(reason)).slice(0, 160) || 'unknown';
}

export function recordFlake({ group, check, reason = '' }, { file = FLAKES_FILE, now = new Date() } = {}) {
  try { mkdirSync(dirname(file), { recursive: true }); appendFileSync(file, JSON.stringify({ t: now.toISOString(), group, check, reason }) + '\n'); return true; } catch (e) { return false; }
}

export function readFlakes(file = FLAKES_FILE) {
  let text = ''; try { text = readFileSync(file, 'utf8'); } catch (e) { return []; }
  return text.split('\n').map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter((e) => e && e.group && e.check && e.t);
}

/** Entries inside the window, grouped by group and check: [{ group, check, count, first, last }] most retries first. */
export function flakeCounts(entries, { now = new Date(), days = WINDOW_DAYS } = {}) {
  const from = now.getTime() - days * 864e5, by = new Map();
  for (const e of entries) {
    const t = Date.parse(e.t); if (!(t >= from && t <= now.getTime() + 864e5)) continue;
    const k = `${e.group}\u0000${e.check}`, row = by.get(k) || { group: e.group, check: e.check, count: 0, first: e.t, last: e.t };
    row.count++; if (e.t < row.first) row.first = e.t; if (e.t > row.last) row.last = e.t; by.set(k, row);
  }
  return [...by.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}
