// Pixelwelt teams (CHE-372), fast tier, no browser: the Team choice (click > ?pixteam= > stored > knights), a bad or missing value
// keeps today's figures (box for box the same as without the module), a click is stored and heard, every pair passes the figures
// contract (test/pixel-chars.mjs --team=<id>), and a piece style built with a pair makes all twelve figures and frees every geometry,
// the material and the texture on dispose.
// Run: node test/pixel-teams.mjs    Exit 0 pass, 1 on any failed check.
import { execFileSync } from 'node:child_process';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeText() {}, fillText() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }) }) };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const at = (search) => { globalThis.location = { search }; };
at('');

const { TEAM_IDS, TEAM_PAIRS, TEAM_NAMES, DEFAULT_TEAM, teamFlag, teamChoice, setTeam, onTeam, resetTeam, teamVox } = await import('../src/themes/pixel/heroes.js');
const { buildPixelVox } = await import('../src/themes/pixel/figures.js');
const { buildSetA } = await import('../src/themes/pixel/seta.js');
const { PAL } = await import('../src/themes/pixel/palette.js');
const { heroKnight, heroKing, monsterQueen, monsterKing, normalise } = await import('../src/themes/pixel/teams.js');
const { pieceStyle } = await import('../src/themes/pixel.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];

// the choice
const PAIRS = Object.keys(TEAM_PAIRS);
check('choices: knights (the default), dragons, wizards and pirates, each pair with a White and a Black team', TEAM_IDS.join() === 'knights,dragons,wizards,pirates' && DEFAULT_TEAM === 'knights' && PAIRS.join() === 'dragons,wizards,pirates' && PAIRS.every((id) => TEAM_PAIRS[id].w.side === 'w' && TEAM_PAIRS[id].b.side === 'b' && TYPES.every((t) => typeof TEAM_PAIRS[id].w.build[t] === 'function' && typeof TEAM_PAIRS[id].b.build[t] === 'function')) && TEAM_IDS.every((id) => TEAM_NAMES[id]?.en && TEAM_NAMES[id]?.de && TEAM_NAMES[id]?.swatch.length === 2));
check('nothing stored, no flag: knights, today\'s figures', teamChoice() === 'knights' && teamFlag('') === null && teamVox('w', 'p') === null);
check('?pixteam= names its pair (knights, dragons, wizards, pirates)', ['knights', 'dragons', 'wizards', 'pirates'].every((id) => teamFlag(`?theme=pixel&pixteam=${id}`) === id));
check('a bad value names nothing', ['?pixteam=zzz', '?pixteam=', '?pixteam=DRAGONS', '?pixteam=goblins'].every((q) => teamFlag(q) === null));
store.set('chess3d.pixteam', 'dragons'); check('a stored pick is used', teamChoice() === 'dragons' && teamVox('w', 'k') !== null);
at('?pixteam=knights'); check('?pixteam= beats a stored pick, the store stays', teamChoice() === 'knights' && teamVox('w', 'k') === null && store.get('chess3d.pixteam') === 'dragons');
store.set('chess3d.pixteam', 'goblins'); at(''); check('a bad stored value falls back to knights', teamChoice() === 'knights');
{
  const heard = [];
  onTeam((id) => heard.push(id));
  at('?pixteam=knights'); setTeam('dragons');
  check('a click beats the flag, is stored and heard', teamChoice() === 'dragons' && store.get('chess3d.pixteam') === 'dragons' && heard.join() === 'dragons');
  setTeam('dragons'); setTeam('skelcrew');
  check('the same pick or a bad id does nothing', heard.length === 1 && store.get('chess3d.pixteam') === 'dragons');
  resetTeam(); store.clear(); at('');
}

// the default is unchanged: without the flag every figure is the box list it was before CHE-372
{
  const OLD = { wn: heroKnight, wk: heroKing, bq: monsterQueen, bk: monsterKing };
  let same = 0;
  for (const c of ['w', 'b']) for (const t of TYPES) {
    const make = OLD[c + t], before = make ? normalise(make(PAL[c]), t) : buildSetA(c, t, PAL[c]);
    const now = buildPixelVox(c, t);   // pushClashes (figures.js) moves clashing faces a little: compare unit, part count, colours and groups
    if (now.unit === before.unit && now.parts.length === before.parts.length && now.parts.every((p, i) => p.color === before.parts[i].color && p.g === before.parts[i].g)) same++;
  }
  check('no flag: all twelve figures are today\'s (unit, parts, colours, rig groups)', same === 12, `${same} of 12`);
}

// every pair: the figures contract, and a piece style that builds and disposes without leaks
for (const id of PAIRS) {
  let out = '', ok = true;
  try { out = execFileSync(process.execPath, ['test/pixel-chars.mjs', `--team=${id}`], { encoding: 'utf8' }); } catch (e) { ok = false; out = String(e.stdout || ''); }
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL'));
  check(`${id}: figures contract (test/pixel-chars.mjs --team=${id})`, ok && fails.length === 0, fails.slice(0, 3).join(' | '));

  at(`?pixteam=${id}`);
  const style = pieceStyle({ track: (t) => t });
  let geos = 0, disposed = 0, matGone = false, texGone = false;
  const inners = [];
  for (const c of ['w', 'b']) for (const t of TYPES) inners.push(style.make(t, c));
  const seen = new Set();
  for (const inner of inners) inner.traverse((o) => { if (o.isMesh && o.name !== 'blob' && !seen.has(o.geometry)) { seen.add(o.geometry); geos++; o.geometry.addEventListener('dispose', () => { disposed++; }); } });
  const mesh = [...inners[0].getObjectsByProperty('isMesh', true)].find((o) => o.name !== 'blob');
  mesh.material.addEventListener('dispose', () => { matGone = true; });
  mesh.material.map?.addEventListener('dispose', () => { texGone = true; });
  const differs = JSON.stringify(buildPixelVox('w', 'k').parts.slice(0, 3)) !== (at(''), JSON.stringify(buildPixelVox('w', 'k').parts.slice(0, 3)));
  at(`?pixteam=${id}`);
  style.dispose();
  check(`${id}: a piece style makes all twelve figures, dispose frees every geometry, the material and the texture`, inners.length === 12 && geos > 12 && disposed >= geos && matGone && texGone, `${disposed} of ${geos} geometries`);
  check(`${id}: the White king is not today's`, differs);
}
at(''); store.clear();
console.log(failed ? `\n${failed} check(s) failed` : '\nPixelwelt teams passed');
process.exit(failed ? 1 : 0);
