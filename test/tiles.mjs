// Option tiles (CHE-265, CHE-287), fast tier, no browser: every theme, Pixelwelt set, sky and backdrop id the Options rows offer has its
// picture (public/tiles/<kind>-<id>.webp, a small real webp made by tools/tile-renders.mjs), and no file lies there without a row.
// Run: node test/tiles.mjs    Exit 0 pass, 1 on any failed check.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { THEMES } from '../src/themes/registry.js';
import { SKIES, BACKDROPS } from '../src/themes/pixel/look.js';
import { SETS } from '../src/themes/pixel/sets.js';
import { tileFile } from '../src/themes/tiles.js';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

const tiles = [
  ...THEMES.filter((t) => !t.hidden).map((t) => ['theme', t.id]),
  ...SETS.map((s) => ['set', s.id]),
  ...Object.keys(SKIES).map((id) => ['sky', id]),
  ...Object.keys(BACKDROPS).map((id) => ['back', id]),
];

const missing = [], odd = [];
for (const [kind, id] of tiles) {
  const f = new URL(`../public/tiles/${tileFile(kind, id)}`, import.meta.url);
  if (!existsSync(f)) { missing.push(tileFile(kind, id)); continue; }
  const b = readFileSync(f), size = statSync(f).size;
  if (b.subarray(0, 4).toString() !== 'RIFF' || b.subarray(8, 12).toString() !== 'WEBP' || size > 12000) odd.push(`${tileFile(kind, id)} (${size} bytes)`);
}
check(`a tile picture for each of the ${tiles.length} theme, set, sky and backdrop ids`, !missing.length, missing.length ? `${missing.join(', ')}  (regenerate: node tools/tile-renders.mjs)` : `${tiles.length} files`);
check('each file is a webp under 12 KB', !odd.length, odd.join(', '));

const wanted = new Set(tiles.map(([kind, id]) => tileFile(kind, id)));
const orphans = readdirSync(new URL('../public/tiles/', import.meta.url)).filter((f) => !wanted.has(f));
check('no orphan file in public/tiles/', !orphans.length, orphans.length ? `${orphans.join(', ')}  (delete it, or regenerate: node tools/tile-renders.mjs)` : '');
process.exit(failed ? 1 : 0);
