// Which smoke groups a change affects: the one place that maps paths to groups (test/smoke-group-list.mjs has the groups).
// Usage: node tools/affected-groups.mjs [--since=<ref>] [--json]   prints the groups a diff against main (merge base) needs.
// affectedGroups(files) is pure and unit tested (test/affected-groups.mjs). A file under src/ that no row knows runs everything, so a
// new module can never be skipped by accident. Files that no smoke group reads (docs, fast tier tests, bin, README) affect nothing.
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES, family } from '../test/smoke-group-list.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Core paths: a change here can alter every page, so every group runs. */
export const CORE = [
  /^src\/(rules|ai|game|main|scene|board|materials|pieceset|ui|controls|i18n|device)\.js$/,   // rules, rendering core, shared UI
  /^src\/pieces\//, /^src\/style\.css$/, /^index\.html$/, /^public\//,
  /^package(-lock)?\.json$/,   // includes the three.js version
  /^vite\.config\./,
  /^tools\/(_lib\.mjs|budgets\.json|result-cache\.mjs|contact-sheet\.mjs)$/,
  /^test\/(_lib[\w-]*\.mjs|smoke\.mjs|smoke-groups\.mjs|smoke-group-list\.mjs)$/,
];

/** [path pattern, groups it affects]. Group names are families: 'fixes' stands for both halves. */
export const MAP = [
  [/^src\/battle\//, ['battle']],
  [/^src\/music\//, ['music']],
  [/^src\/audio\.js$/, ['music', 'battle', 'core']],
  [/^src\/themes\//, ['themes', 'textures', 'views', 'blocks chars', 'blocks fixes']],
  [/^src\/(textures|texture-gen|texture-worker|loader-board)\.js$/, ['textures', 'themes', 'intro']],
  [/^src\/learn\//, ['learn', 'fixes']],
  [/^src\/openings\//, ['explain', 'learn', 'fixes', 'blocks fixes']],
  [/^src\/train\//, ['drill', 'fixes']],
  [/^src\/puzzles\//, ['puzzles', 'fixes']],
  [/^src\/review\//, ['review', 'fixes', 'blocks fixes']],
  [/^src\/views\//, ['views', 'tokens', 'play', 'fixes']],
  [/^src\/(trays|trays-setting)\.js$/, ['trays', 'fixes', 'blocks fixes']],
  [/^src\/goodmove\.js$/, ['goodmove']],
  [/^src\/(intro|install-hint)\.js$/, ['intro', 'fixes']],
  [/^src\/dev\//, ['core']],
  // test scripts: the group that runs the script
  [/^test\/(battle)\.mjs$/, ['battle']],
  [/^test\/music-page\.mjs$/, ['music']],
  [/^test\/(themes|textures|intro|views|tokens|play|drill|explain|learn|learnbar|review|puzzles|goodmove|fixes)\.mjs$/, null],   // null: the group named like the file, see below
  [/^test\/trays-page\.mjs$/, ['trays']],
  [/^test\/blocks-chars-page\.mjs$/, ['blocks chars']],
  [/^test\/blocks-fixes-page\.mjs$/, ['blocks fixes']],
  [/^test\/open-flag\.mjs$/, ['open']],
  [/^test\/daily-page\.mjs$/, ['puzzles']],
];

// test files that belong to a group of another name
const TEST_ALIAS = { learnbar: ['learn', 'explain'] };

const mapOne = (f) => {
  if (CORE.some((re) => re.test(f))) return 'all';
  for (const [re, groups] of MAP) {
    const m = f.match(re);
    if (!m) continue;
    if (groups) return groups;
    const base = m[1];
    return TEST_ALIAS[base] || [base];
  }
  if (/^src\//.test(f)) return 'all';   // unknown source file: never skip by accident
  return [];
};

/** files: repo relative paths. Returns { all, groups (family names in group order), reason } */
export function affectedGroups(files) {
  const set = new Set(); const why = [];
  for (const f of files) {
    const r = mapOne(f);
    if (r === 'all') return { all: true, groups: FAMILIES.slice(), reason: `${f} is a core path` };
    for (const g of r) set.add(g);
    if (r.length) why.push(f);
  }
  return { all: false, groups: FAMILIES.filter((g) => set.has(g)), reason: why.length ? `${why.length} file(s) map to groups` : 'no smoke group reads the changed files' };
}

/** Files that differ from main: committed since the merge base, staged, unstaged and untracked. null when git cannot say. */
export function changedFiles(cwd = ROOT, since = 'main') {
  try {
    const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    const base = git('merge-base', since, 'HEAD').trim();
    return [...new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter(Boolean);
  } catch (e) { return null; }
}

export { family };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const since = (process.argv.find((a) => a.startsWith('--since=')) || '--since=main').slice(8);
  const files = changedFiles(ROOT, since);
  if (!files) { console.error(`cannot diff against ${since}`); process.exit(2); }
  const r = affectedGroups(files);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ files, ...r }, null, 2));
  else console.log(`${r.all ? 'all groups' : r.groups.join(', ') || 'no groups'}  (${r.reason}; ${files.length} changed files vs ${since})`);
}
