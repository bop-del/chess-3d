// The path to smoke group table (tools/affected-groups.mjs) and the Chrome slot rule (tools/_lib.mjs). Fast tier, no browser.
// Run: node test/affected-groups.mjs    Exit 0 when every case holds, 1 otherwise.
import { affectedGroups, MAP } from '../tools/affected-groups.mjs';
import { FAMILIES, GROUPS } from './smoke-group-list.mjs';
import { groupKey, groupFiles } from '../tools/result-cache.mjs';
import { slotsFor, lanePorts, startServer } from '../tools/_lib.mjs';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cases = [];
const check = (name, ok) => cases.push({ name, ok: !!ok });
const g = (files) => { const r = affectedGroups(files); return r.all ? 'ALL' : r.groups.join(','); };

check('docs only: no group', g(['README.md', 'docs/ARCHITECTURE.md', 'bin/lane', 'test/perft.mjs']) === '');
check('battle code: the battle group only', g(['src/battle/fx.js']) === 'battle');
check('theme code: the groups that draw themes, blocks characters included', g(['src/themes/blocks/rig.js']) === 'themes,textures,views,blocks chars,blocks fixes');
check('music code: music', g(['src/music/player.js']) === 'music');
check('puzzles code: puzzles and the layout fixes', g(['src/puzzles/panel.js']) === 'fixes,puzzles');
check('several files union their groups, in group order', g(['src/battle/fx.js', 'src/music/score.js']) === 'battle,music');
check('rules engine: everything', g(['src/rules.js']) === 'ALL');
check('rendering core: everything', ['src/scene.js', 'src/board.js', 'src/materials.js', 'src/main.js', 'src/style.css', 'index.html'].every((f) => g([f]) === 'ALL'));
check('piece builders: everything', g(['src/pieces/setA.js']) === 'ALL');
check('package.json and lock file (three version): everything', g(['package.json']) === 'ALL' && g(['package-lock.json']) === 'ALL');
check('vite config: everything', g(['vite.config.js']) === 'ALL');
check('shared test helpers: everything', g(['tools/_lib.mjs']) === 'ALL' && g(['test/_lib-x.mjs']) === 'ALL' && g(['test/smoke-groups.mjs']) === 'ALL' && g(['test/smoke.mjs']) === 'ALL');
check('one core file among small ones still runs everything', g(['src/battle/fx.js', 'src/rules.js']) === 'ALL');
check('an unknown new source file runs everything', g(['src/brand-new.js']) === 'ALL');
check('a group script change runs its group', g(['test/battle.mjs']) === 'battle' && g(['test/trays-page.mjs']) === 'trays' && g(['test/open-flag.mjs']) === 'open' && g(['test/music-page.mjs']) === 'music');
check('the learn bar helper runs the groups that load it', g(['test/learnbar.mjs']) === 'learn,explain');
check('every group name in the table is a real group', MAP.flatMap(([, gs]) => gs || []).every((n) => FAMILIES.includes(n)));
check('every group script exists', GROUPS.every(([, s]) => existsSync(new URL('../' + s, import.meta.url))));

// Chrome slots, decision 3: with Metal load 1 under 8 gives 4, under 16 gives 3, else 2. Without Metal unchanged (under 6: 4, under 12: 3, else 2).
check('metal: load 0 and 7.9 give 4 slots', slotsFor(0, true) === 4 && slotsFor(7.9, true) === 4);
check('metal: load 8 and 15.9 give 3 slots', slotsFor(8, true) === 3 && slotsFor(15.9, true) === 3);
check('metal: load 16 and above give 2 slots', slotsFor(16, true) === 2 && slotsFor(60, true) === 2);
check('software: 4 under load 6, 3 under 12, else 2', slotsFor(5.9, false) === 4 && slotsFor(6, false) === 3 && slotsFor(11.9, false) === 3 && slotsFor(12, false) === 2);

// Lane ports: stable hash of the worktree directory name, preview 5400 to 5498, dev 5500 to 5598, main checkout keeps 5303 and 5302.
const a = lanePorts('/x/.herdr/worktrees/chess-3d/s16-smoke-affected-ports', true), b = lanePorts('/y/.herdr/worktrees/chess-3d/s16-smoke-affected-ports', true);
check('lane ports are stable for a lane name', a.preview === b.preview && a.dev === b.dev);
check('lane ports are inside their ranges', a.preview >= 5400 && a.preview <= 5498 && a.dev >= 5500 && a.dev <= 5598 && a.dev - a.preview === 100);
check('different lanes mostly get different ports', new Set(['s1', 's2', 's3', 's4', 's5', 's6', 'p7', 'q8'].map((n) => lanePorts('/w/' + n, true).preview)).size >= 6);
check('main checkout keeps 5303 and 5302', lanePorts('/w/main-checkout', false).preview === 5303 && lanePorts('/w/main-checkout', false).dev === 5302);

// Result cache keys: build hash, group script and its imports decide; another group's script does not.
const rt = mkdtempSync(join(tmpdir(), 'chess-key-'));
try {
  mkdirSync(join(rt, 'test')); mkdirSync(join(rt, 'tools'));
  writeFileSync(join(rt, 'test', 'a.mjs'), "import { h } from './h.mjs';"); writeFileSync(join(rt, 'test', 'h.mjs'), 'export const h = 1;'); writeFileSync(join(rt, 'test', 'b.mjs'), '1');
  writeFileSync(join(rt, 'test', 'smoke.mjs'), 'x'); writeFileSync(join(rt, 'test', 'drill.mjs'), 'd'); writeFileSync(join(rt, 'test', 'learn.mjs'), 'l');
  const ga = ['a', 'test/a.mjs', []], gb = ['b', 'test/b.mjs', []], gd = ['drill', 'test/smoke.mjs', ['--group=drill']], gl = ['learn', 'test/smoke.mjs', ['--group=learn']];
  const k = (g, b = 'B1') => groupKey(g, b, rt);
  const before = [k(ga), k(gb), k(gd), k(gl)];
  check('the same inputs give the same key', k(ga) === before[0]);
  check('a new build hash changes every key', k(ga, 'B2') !== before[0] && k(gb, 'B2') !== before[1]);
  writeFileSync(join(rt, 'test', 'h.mjs'), 'export const h = 2;');
  check('a changed import of a group script changes that key only', k(ga) !== before[0] && k(gb) === before[1]);
  writeFileSync(join(rt, 'test', 'drill.mjs'), 'd2');
  check('smoke.mjs groups follow only their own module', k(gd) !== before[2] && k(gl) === before[3]);
  check('a group lists its script and imports', groupFiles('test/a.mjs', [], rt).length === 2);
} finally { rmSync(rt, { recursive: true, force: true }); }

// A foreign build on the port fails loudly, the same build is reused: a throwaway server stands in for another lane's preview.
const dir = mkdtempSync(join(tmpdir(), 'chess-port-'));
const serve = (html) => new Promise((ok) => { const srv = createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(html); }); srv.listen(0, '127.0.0.1', () => ok(srv)); });
try {
  mkdirSync(join(dir, 'dist')); writeFileSync(join(dir, 'dist', 'index.html'), '<html>build A</html>');
  const other = await serve('<html>build B</html>'), same = await serve('<html>build A</html>');
  let msg = ''; try { await startServer({ mode: 'preview', port: other.address().port, outDir: 'dist', cwd: dir }); } catch (e) { msg = e.message; }
  check('a different build on the port is refused, with a message that says so', /already serves a different build/.test(msg));
  let reused = null; try { reused = await startServer({ mode: 'preview', port: same.address().port, outDir: 'dist', cwd: dir }); } catch (e) { /* checked below */ }
  check('the same build on the port is reused, not tested twice', reused && typeof reused.stop === 'function');
  other.close(); same.close();
} finally { rmSync(dir, { recursive: true, force: true }); }

for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}`);
process.exit(cases.every((c) => c.ok) ? 0 : 1);
