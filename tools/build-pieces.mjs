// Builds src/music/pieces/*.js from the Mutopia LilyPond sources (public domain music, see each piece's `credit`).
//   node tools/build-pieces.mjs        downloads the .ly files into .tmp/music-src once, converts, writes the piece files
// The result is committed: the game never fetches anything. This script documents where the note data came from.
// Two sets (pieces/index.js): `a` the first five, `b` the calm lesser known ones (CHE-180). The build refuses a source whose
// header licence is not Public Domain or CC0 (Mutopia also has CC-BY and CC-BY-SA files: not allowed here), prints each licence
// line and each piece's tempo and length, and warns when the parts of a piece end at different quarters (a parser drift).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './_lib.mjs';
import { parse, flatten, mergeTies } from './ly-to-notes.mjs';

const BASE = 'https://www.mutopiaproject.org/ftp/';
const SRC = join(ROOT, '.tmp/music-src'), OUT = join(ROOT, 'src/music/pieces');
const SATIE = { vel: [0, 70, 42, 52] };   // blocks in file order: global, top, middle, bottom
const PIECES = [   // set a
  { id: 'gymnopedie1', file: 'SatieE/gymnopedie_1/gymnopedie_1.ly', title: 'Gymnopédie No. 1', composer: 'Erik Satie', bpm: 56, pedal: 3, ...SATIE, credit: 'Mutopia Project, Evin Robertson (Public Domain)' },
  { id: 'gymnopedie2', file: 'SatieE/gymnopedie_2/gymnopedie_2.ly', title: 'Gymnopédie No. 2', composer: 'Erik Satie', bpm: 54, pedal: 3, ...SATIE, credit: 'Mutopia Project, Evin Robertson (Public Domain)' },
  { id: 'gymnopedie3', file: 'SatieE/gymnopedie_3/gymnopedie_3.ly', title: 'Gymnopédie No. 3', composer: 'Erik Satie', bpm: 52, pedal: 3, ...SATIE, credit: 'Mutopia Project, Evin Robertson (Public Domain)' },
  { id: 'prelude-c', file: 'BachJS/BWV846/wtk1-prelude1/wtk1-prelude1.ly', title: 'Prelude in C major, BWV 846', composer: 'Johann Sebastian Bach', bpm: 58, pedal: 4, vel: [74, 50], credit: 'Mutopia Project, Tobias Erbsland (Public Domain)' },
  { id: 'air', file: 'BachJS/BWV1068/bach_air_bmv_1068/bach_air_bmv_1068.ly', title: 'Air, Orchestral Suite No. 3', composer: 'Johann Sebastian Bach', bpm: 52, ring: 0.5, use: ['flute', 'guitarUpper', 'guitarLower'], vel: [74, 46, 46], credit: 'Mutopia Project, Mike Blackstock (Public Domain)' },
  // set b: calm, slow, lesser known. Checked against Mutopia (2026-10-04): the Satie Gnossiennes, Chopin 28-1/9, Field, Liszt, Schumann Op. 15 (CC-BY) are not public domain typesettings, so they are not here.
  { set: 'b', id: 'chopin-prelude-4', file: 'ChopinFF/O28/Chop-28-4/Chop-28-4.ly', title: 'Prelude in E minor, Op. 28 No. 4', composer: 'Frédéric Chopin', bpm: 56, pedal: 2, vel: [0, 0, 0, 66, 40, 0, 0], credit: 'Mutopia Project, Magnus Lewis-Smith (Public Domain)' },
  { set: 'b', id: 'faure-apres-un-reve', file: 'FaureG/O7/apres/apres.ly', title: 'Après un rêve, Op. 7 No. 1', composer: 'Gabriel Fauré', bpm: 60, pedal: 3, use: ['chant', 'droit', 'gauche'], vel: [66, 44, 40], credit: 'Mutopia Project, Tak-Shing Chan (Public Domain)' },
  { set: 'b', id: 'mendelssohn-gondola', file: 'Mendelssohn-BartholdyF/O30/LiederOhneWorte_-_Op30_No6/LiederOhneWorte_-_Op30_No6.ly', title: 'Venetian Gondola Song, Op. 30 No. 6', composer: 'Felix Mendelssohn', bpm: 66, pedal: 3, vel: [0, 50, 50, 36], credit: 'Mutopia Project, Ryan Prince (Public Domain)' },
  { set: 'b', id: 'mendelssohn-op85-1', file: 'Mendelssohn-BartholdyF/O85/LiederOhneWorte_-_Op85_No1/LiederOhneWorte_-_Op85_No1.ly', title: 'Song without Words, Op. 85 No. 1', composer: 'Felix Mendelssohn', bpm: 56, pedal: 2, vel: [0, 0, 0, 62, 42, 0], credit: 'Mutopia Project, Ryan Prince (Public Domain)' },
  { set: 'b', id: 'bach-aria-516', file: 'BachJS/BWV516/BWV-516/BWV-516.ly', title: 'Aria, BWV 516 (Warum betrübst du dich)', composer: 'Johann Sebastian Bach', bpm: 56, ring: 0.5, vel: [72, 54, 0, 0], credit: 'Mutopia Project, Steven McDougall (Public Domain)' },
];
const LICENCE = /^\s*(?:license|copyright)\s*=\s*"([^"]*)"/m;   // Mutopia headers: `license` (or a plain string `copyright`) names the licence

mkdirSync(SRC, { recursive: true }); mkdirSync(OUT, { recursive: true });
const r3 = (x) => Math.round(x * 1000) / 1000;
for (const p of PIECES) {
  const local = join(SRC, p.id + '.ly');
  if (!existsSync(local)) writeFileSync(local, Buffer.from(await (await fetch(BASE + p.file)).arrayBuffer()));
  const licence = (LICENCE.exec(readFileSync(local, 'utf8')) || [])[1] || 'none found';
  if (!/^(Public Domain|Creative Commons Zero.*|CC0.*)$/i.test(licence)) throw new Error(`${p.id}: licence "${licence}" is not Public Domain or CC0`);
  const blocks = parse(local, p.use ? { use: p.use } : {});
  let all = [], end = 0;
  const ends = [];
  blocks.forEach((b, i) => {
    const ev = []; const e = flatten(b, 0, ev, i); end = Math.max(end, e);
    const merged = mergeTies(ev).filter(() => p.vel[i] > 0);
    if (merged.length) ends.push(e);
    for (const x of merged) all.push({ m: x.m, s: x.s, l: x.l, v: p.vel[i] });
  });
  if (p.set === 'b' && Math.max(...ends) - Math.min(...ends) > 8) console.warn(`  WARN ${p.id}: parts end at different quarters (${ends.map(r3).join(', ')}), check the converter`);
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
  console.log(`${p.id}: ${all.length} notes, ${r3(end)} quarters, ${p.bpm} bpm, ${(r3(end) / p.bpm).toFixed(1)} min, licence ${licence}`);
}
