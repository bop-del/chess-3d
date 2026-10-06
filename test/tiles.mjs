// Option tiles (CHE-265), fast tier, no browser: every theme, Pixelwelt set, sky and backdrop id has its style A picture
// (public/tiles/<kind>-<id>.webp, a small real webp made by tools/tile-renders.mjs), a style C line icon and a style B pixel icon
// that draws without error; ?tiles= is read as a, b, c or nothing.
// Run: node test/tiles.mjs    Exit 0 pass, 1 on any failed check.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { THEMES } from '../src/themes/registry.js';
import { SKIES, BACKDROPS } from '../src/themes/pixel/look.js';
import { SETS } from '../src/themes/pixel/sets.js';
import { tileStyle, tileFile, lineIcon, drawPixelIcon } from '../src/themes/tiles.js';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

const tiles = [
  ...THEMES.filter((t) => !t.hidden).map((t) => ['theme', t.id, t.swatch]),
  ...SETS.map((s) => ['set', s.id, { sky: s.sky, backdrop: s.backdrop }]),
  ...Object.keys(SKIES).map((id) => ['sky', id, null]),
  ...Object.keys(BACKDROPS).map((id) => ['back', id, null]),
];

const missing = [], odd = [];
for (const [kind, id] of tiles) {
  const f = new URL(`../public/tiles/${tileFile(kind, id)}`, import.meta.url);
  if (!existsSync(f)) { missing.push(tileFile(kind, id)); continue; }
  const b = readFileSync(f), size = statSync(f).size;
  if (b.subarray(0, 4).toString() !== 'RIFF' || b.subarray(8, 12).toString() !== 'WEBP' || size > 12000) odd.push(`${tileFile(kind, id)} (${size} bytes)`);
}
check(`style A: a tile picture for each of the ${tiles.length} theme, set, sky and backdrop ids`, !missing.length, missing.join(', ') || `${tiles.length} files`);
check('style A: each file is a webp under 12 KB', !odd.length, odd.join(', '));

const noLine = tiles.filter(([kind, id]) => !/<(path|circle)/.test(lineIcon(kind, id))).map(([k, i]) => `${k}-${i}`);
check('style C: a line icon for every tile', !noLine.length, noLine.join(', '));

const calls = [];
const stub = { width: 0, height: 0, getContext: () => ({ set fillStyle(v) { calls.push(v); }, fillRect() {}, clearRect() {} }) };
const bad = [];
for (const [kind, id, colours] of tiles) { try { calls.length = 0; drawPixelIcon({ ...stub }, kind, id, colours || undefined); if (!calls.length) bad.push(`${kind}-${id} drew nothing`); } catch (e) { bad.push(`${kind}-${id}: ${e.message}`); } }
check('style B: every pixel icon draws', !bad.length, bad.join(', '));

check('?tiles= reads a, b, c and ignores anything else', tileStyle('?tiles=a') === 'a' && tileStyle('?x=1&tiles=c') === 'c' && tileStyle('?tiles=d') === null && tileStyle('') === null && tileStyle('?tiles=ab') === null);
process.exit(failed ? 1 : 0);
