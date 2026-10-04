// The path to smoke group table (tools/affected-groups.mjs) and the Chrome slot rule (tools/_lib.mjs). Fast tier, no browser.
// Run: node test/affected-groups.mjs    Exit 0 when every case holds, 1 otherwise.
import { affectedGroups, MAP } from '../tools/affected-groups.mjs';
import { FAMILIES, GROUPS } from './smoke-group-list.mjs';
import { groupKey, groupFiles, longestFirst } from '../tools/result-cache.mjs';
import { slotsFor, lanePorts, startServer, claimPort, portAnswers, safeDecode } from '../tools/_lib.mjs';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cases = [];
const check = (name, ok) => cases.push({ name, ok: !!ok });
const g = (files) => { const r = affectedGroups(files); return r.all ? 'ALL' : r.groups.join(','); };

check('docs only: no group', g(['README.md', 'docs/ARCHITECTURE.md', 'bin/lane', 'test/perft.mjs']) === '');
check('battle code: the battle group only', g(['src/battle/fx.js']) === 'battle');
check('theme code: the groups that draw themes, blocks characters included', g(['src/themes/blocks/rig.js']) === 'views,themes,textures,blocks chars,pixel chars,blocks fixes');
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

// startServer never reuses a server this process did not start: a throwaway server stands in for another lane's preview.
const dir = mkdtempSync(join(tmpdir(), 'chess-port-'));
const serve = (html) => new Promise((ok) => { const srv = createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(html); }); srv.listen(0, '127.0.0.1', () => ok(srv)); });
const refused = async (port) => { try { await startServer({ mode: 'preview', port, outDir: 'dist', cwd: dir }); return ''; } catch (e) { return e.message; } };
const servers = [];
try {
  mkdirSync(join(dir, 'dist')); writeFileSync(join(dir, 'dist', 'index.html'), '<html>build A</html>');
  const other = await serve('<html>build B</html>'), same = await serve('<html>build A</html>');
  servers.push(other, same);
  const mOther = await refused(other.address().port), mSame = await refused(same.address().port);
  check('a different build on the port is refused, naming the port', mOther.includes(`port ${other.address().port} `) && /did not start/.test(mOther));
  check('the very same build on the port is refused too, never reused', mSame.includes(`port ${same.address().port} `) && /refusing to reuse/.test(mSame));
  // a server this process started is reused on a second call; no port given: the next free port, never an occupied one
  const probe = await serve(''); const busy = probe.address().port; servers.push(probe);
  const first = await startServer({ mode: 'preview', outDir: join(dir, 'dist') });
  const again = await startServer({ mode: 'preview', port: first.port, outDir: join(dir, 'dist') });
  check('a server this run started is reused on a second call', again.base === first.base);
  const other2 = await startServer({ mode: 'preview', outDir: join(dir, 'dist') });
  check('no port given: the next free port, a different one each time', other2.port !== first.port && !(await portAnswers(busy) && other2.port === busy));
  try { await startServer({ mode: 'preview', port: first.port, outDir: join(dir, 'dist'), subPath: '/x/' }); check('same port with other settings is refused', false); }
  catch (e) { check('same port with other settings is refused', /other settings/.test(e.message)); }
  first.stop(); other2.stop();
  let freed = false; for (let i = 0; i < 20 && !freed; i++) { freed = !(await portAnswers(first.port)); if (!freed) await new Promise((r) => setTimeout(r, 250)); }
  check('a stopped server frees its port', freed);
} finally { for (const sv of servers) sv.close(); rmSync(dir, { recursive: true, force: true }); }

// claimPort: concurrent callers get different ports, a port that answers is skipped, release frees it
{
  const [c1, c2, c3] = await Promise.all([claimPort(), claimPort(), claimPort()]);
  check('three concurrent claims get three different ports', new Set([c1.port, c2.port, c3.port]).size === 3);
  check('a claim starts at the lane port or above', c1.port >= lanePorts().preview && c1.lane === lanePorts().lane);
  const dev = await claimPort({ kind: 'dev' });
  check('a dev claim starts in the dev range', dev.port >= lanePorts().dev);
  const p1 = c1.port; c1.release();
  const again = await claimPort();
  check('a released port is claimable again', again.port === p1);
  again.release();
  // a program we did not start answers on the next port: it is skipped, the claim moves on
  const squat = await new Promise((ok) => { const srv = createServer((q, r) => r.end('')); srv.listen(p1, '127.0.0.1', () => ok(srv)); });
  const skip = await claimPort();
  check('a port that answers without our claim is skipped', skip.port !== p1 && skip.port > p1);
  squat.close(); skip.release();
  for (const c of [c2, c3, dev]) c.release();
}

// hostile URLs in a message must not throw (the release check printed "URI malformed" for %%% once)
check('safeDecode survives a malformed escape', safeDecode('/?help=%%%') === '/?help=%%%' && safeDecode('/?a=%41') === '/?a=A' && safeDecode('/?hud=%ff') === '/?hud=%ff');

// smoke schedule: longest known group first, groups without a time keep their order after the timed ones
{
  const items = [['a'], ['b'], ['c'], ['d'], ['e']].map((x) => ({ g: x }));
  const names = (l) => l.map((x) => x.g[0]).join('');
  check('longestFirst sorts by known time, descending', names(longestFirst(items, { a: 5, c: 30, e: 12 })) === 'ceabd');
  check('longestFirst without any timing keeps the list order', names(longestFirst(items, {})) === 'abcde');
  check('longestFirst does not change its input', names(items) === 'abcde');
}

for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}`);
process.exit(cases.every((c) => c.ok) ? 0 : 1);
