// Builds src/music/pieces/*.js from the Mutopia LilyPond sources (public domain music, see each piece's `credit`).
//   node tools/build-pieces.mjs        downloads the .ly files into .tmp/music-src once, converts, writes the piece files
// The result is committed: the game never fetches anything. This script documents where the note data came from.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './_lib.mjs';
import { parse, flatten, mergeTies } from './ly-to-notes.mjs';

const BASE = 'https://www.mutopiaproject.org/ftp/';
const SRC = join(ROOT, '.tmp/music-src'), OUT = join(ROOT, 'src/music/pieces');
const SATIE = { vel: [0, 70, 42, 52] };   // blocks in file order: global, top, middle, bottom
const PIECES = [
  { id: 'gymnopedie1', file: 'SatieE/gymnopedie_1/gymnopedie_1.ly', title: 'Gymnopédie No. 1', composer: 'Erik Satie', bpm: 56, pedal: 3, ...SATIE, credit: 'Mutopia Project, Evin Robertson (Public Domain)' },
  { id: 'gymnopedie2', file: 'SatieE/gymnopedie_2/gymnopedie_2.ly', title: 'Gymnopédie No. 2', composer: 'Erik Satie', bpm: 54, pedal: 3, ...SATIE, credit: 'Mutopia Project, Evin Robertson (Public Domain)' },
  { id: 'gymnopedie3', file: 'SatieE/gymnopedie_3/gymnopedie_3.ly', title: 'Gymnopédie No. 3', composer: 'Erik Satie', bpm: 52, pedal: 3, ...SATIE, credit: 'Mutopia Project, Evin Robertson (Public Domain)' },
  { id: 'prelude-c', file: 'BachJS/BWV846/wtk1-prelude1/wtk1-prelude1.ly', title: 'Prelude in C major, BWV 846', composer: 'Johann Sebastian Bach', bpm: 58, pedal: 4, vel: [74, 50], credit: 'Mutopia Project, Tobias Erbsland (Public Domain)' },
  { id: 'air', file: 'BachJS/BWV1068/bach_air_bmv_1068/bach_air_bmv_1068.ly', title: 'Air, Orchestral Suite No. 3', composer: 'Johann Sebastian Bach', bpm: 52, ring: 0.5, use: ['flute', 'guitarUpper', 'guitarLower'], vel: [74, 46, 46], credit: 'Mutopia Project, Mike Blackstock (Public Domain)' },
];

mkdirSync(SRC, { recursive: true }); mkdirSync(OUT, { recursive: true });
const r3 = (x) => Math.round(x * 1000) / 1000;
for (const p of PIECES) {
  const local = join(SRC, p.id + '.ly');
  if (!existsSync(local)) writeFileSync(local, Buffer.from(await (await fetch(BASE + p.file)).arrayBuffer()));
  const blocks = parse(local, p.use ? { use: p.use } : {});
  let all = [], end = 0;
  blocks.forEach((b, i) => {
    const ev = []; end = Math.max(end, flatten(b, 0, ev, i));
    for (const x of mergeTies(ev)) if (p.vel[i] > 0) all.push({ m: x.m, s: x.s, l: x.l, v: p.vel[i] });
  });
  all.sort((a, b) => a.s - b.s || a.m - b.m);
  const rows = all.map((x) => `[${x.m},${r3(x.s)},${r3(x.l)},${x.v}]`);
  const lines = []; for (let i = 0; i < rows.length; i += 12) lines.push('  ' + rows.slice(i, i + 12).join(','));
  const ring = p.ring === undefined ? '' : `  ring: ${p.ring},\n`;
  writeFileSync(join(OUT, p.id + '.js'), `// ${p.title}, ${p.composer}. Public domain music; note data converted from Mutopia LilyPond (${p.file}) by tools/build-pieces.mjs.
// Credit: ${p.credit}. Rows: [midi, start, length, velocity] in quarter notes.
export default {
  id: '${p.id}',
  title: '${p.title}',
  composer: '${p.composer}',
  bpm: ${p.bpm},
  pedal: ${p.pedal || 0},
${ring}  quarters: ${r3(end)},
  notes: [
${lines.join(',\n')},
  ],
};
`);
  console.log(`${p.id}: ${all.length} notes, ${r3(end)} quarters, ${(r3(end) * 60 / p.bpm / 60).toFixed(1)} min`);
}
