// Music data and logic, no browser: the two sets, every piece well formed and in range, public domain credit lines, the score
// expansion is sane, the set choice. The rendered audio (peak, silences, clicks) is checked in test/music-page.mjs.
// Run: node test/music.mjs   (also part of the fast tier through test/run.mjs)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SETS, SET_IDS, DEFAULT_SET, PIECE_IDS, chooseSet, setIds } from '../src/music/pieces/index.js';
import { prepare, expand } from '../src/music/score.js';
import { hz } from '../src/music/piano.js';

const DIR = fileURLToPath(new URL('../src/music/pieces/', import.meta.url));
const SET_A = ['gymnopedie1', 'gymnopedie2', 'gymnopedie3', 'prelude-c', 'air'];   // today's set: the same pieces, the same order

export async function runMusicChecks() {
  const out = [];
  const add = (name, pass, detail = '') => out.push({ name, pass, detail });

  // sets and the choice of one
  add('two sets, b is the default', SET_IDS.join() === 'a,b' && DEFAULT_SET === 'b', SET_IDS.join(' ') + ' default ' + DEFAULT_SET);
  add('set a is today\'s five pieces, unchanged', setIds('a').join() === SET_A.join(), setIds('a').join(' '));
  add('set b has 5 to 7 pieces', setIds('b').length >= 5 && setIds('b').length <= 7, setIds('b').join(' '));
  add('piece ids are unique across the sets', new Set(PIECE_IDS).size === PIECE_IDS.length, PIECE_IDS.join(' '));
  const files = readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.slice(0, -3)).sort();
  add('every piece file is listed in a set and every listed piece has its file', files.join() === [...PIECE_IDS].sort().join(), files.join(' '));
  const choice = [['a', 'a'], ['b', 'b'], ['A', 'a'], ['B', 'b'], [null, 'b'], [undefined, 'b'], ['', 'b'], ['c', 'b'], ['ab', 'b'], ['__proto__', 'b'], ['constructor', 'b'], ['toString', 'b'], ['0', 'b']];
  const bad = choice.filter(([v, want]) => chooseSet(v) !== want).map(([v, want]) => `${String(v)} -> ${chooseSet(v)} (want ${want})`);
  add('musicset: a and b pick their set (any case), anything else is ignored and gives the default', bad.length === 0, bad.join('; '));
  add('setIds follows chooseSet', setIds('a') !== setIds('b') && setIds('nope').join() === setIds('b').join() && setIds(undefined).join() === setIds(DEFAULT_SET).join());
  add('LOADERS give a module per piece', Object.values(SETS).every((s) => Object.values(s).every((f) => typeof f === 'function')));

  for (const id of PIECE_IDS) {
    const set = SET_IDS.find((s) => Object.hasOwn(SETS[s], id));
    const text = readFileSync(DIR + id + '.js', 'utf8');
    const p = (await import(`../src/music/pieces/${id}.js`)).default;
    const bad = [];
    // licence: a Credit line naming the source and a public domain or CC0 licence, nothing share alike or attribution
    const credit = /^\/\/ Credit: (.+?)\. Rows:/m.exec(text);
    if (!credit) bad.push('no Credit line');
    else if (!/^Mutopia Project, .+ \((Public Domain|CC0)\)$/.test(credit[1])) bad.push(`credit "${credit[1]}" is not a Mutopia credit with (Public Domain) or (CC0)`);
    if (/CC[- ]?BY|Attribution|Share ?Alike|Creative Commons Attribution/i.test(text.split('\n').slice(0, 3).join('\n'))) bad.push('header names a CC-BY licence');
    if (!/^\/\/ .+Public domain music; note data converted from Mutopia LilyPond \(.+\.ly\) by tools\/build-pieces\.mjs\./.test(text)) bad.push('no source line');
    if (p.id !== id) bad.push('id');
    if (!p.title || !p.composer) bad.push('title or composer');
    if (!(p.bpm >= 40 && p.bpm <= 90)) bad.push('bpm');
    if (!(p.quarters > 60)) bad.push('quarters');
    let prev = -1, lastEnd = 0, vmax = 0;
    for (const n of p.notes) {
      const [m, s, l, v] = n;
      if (n.length !== 4 || !Number.isInteger(m) || m < 21 || m > 108) bad.push(`pitch ${n}`);
      else if (!(hz(m) > 20 && hz(m) < 5000)) bad.push(`hz ${n}`);
      if (!(s >= 0 && l > 0 && l <= 40)) bad.push(`time ${n}`);
      if (!(v >= 20 && v <= 100)) bad.push(`velocity ${n}`);
      if (s < prev - 1e-9) bad.push(`order ${n}`);
      prev = s; lastEnd = Math.max(lastEnd, s + l); vmax = Math.max(vmax, v);
      if (bad.length > 4) break;
    }
    if (lastEnd > p.quarters + 1) bad.push(`notes run past quarters (${lastEnd} > ${p.quarters})`);
    if (lastEnd < p.quarters - 4) bad.push(`quarters is later than the last note (${lastEnd} < ${p.quarters})`);   // a bar of rests at the end is fine, more means a wrong length
    const ev = prepare(p), { events, seconds } = expand(p);
    if (ev.length !== p.notes.length) bad.push('prepare count');
    const minutes = seconds / 60;
    if (!(seconds > 90 && seconds < 600)) bad.push(`length ${seconds.toFixed(0)} s`);
    const slow = expand(p, 0.8).seconds, fast = expand(p, 1.1).seconds;
    if (!(slow > seconds && fast < seconds)) bad.push('tempo scale');
    // no note starts after the end of the score, and no stretch of 3 s or more without a sounding key inside the piece
    const lastStart = Math.max(...events.map((e) => e.t));
    if (lastStart > seconds) bad.push('a note starts after the end');
    const iv = events.map((e) => [e.t, e.t + e.hold]).sort((a, b) => a[0] - b[0]);
    let reach = iv[0][1], gap = 0;
    for (const [s, e] of iv) { gap = Math.max(gap, s - reach); reach = Math.max(reach, e); }
    if (set === 'b') {   // the calm set: slow, soft, 1.5 to 5 minutes, no gap (set a is kept as it was: Gymnopédie 3 rests 3.5 s once)
      if (gap >= 3) bad.push(`${gap.toFixed(1)} s without a sounding key`);
      if (!(p.bpm >= 50 && p.bpm <= 66)) bad.push(`bpm ${p.bpm} outside 50 to 66`);
      if (!(minutes >= 1.5 && minutes <= 5)) bad.push(`${minutes.toFixed(1)} min outside 1.5 to 5`);
      if (vmax > 74) bad.push(`velocity ${vmax} above today's range (74)`);
    }
    add(`piece ${id} (set ${set}): ${p.notes.length} notes, ${p.bpm} bpm, ${minutes.toFixed(1)} min`, bad.length === 0, bad.slice(0, 4).join('; '));
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('music.mjs')) {
  const res = await runMusicChecks();
  for (const r of res) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
  process.exit(res.some((r) => !r.pass) ? 1 : 0);
}
