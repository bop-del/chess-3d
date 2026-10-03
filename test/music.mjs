// Music data and logic, no browser: every piece is well formed and in range, the score expansion is sane, the settings clamp.
// Run: node test/music.mjs   (also part of the fast tier through test/run.mjs)
import { PIECE_IDS } from '../src/music/pieces/index.js';
import { prepare, expand } from '../src/music/score.js';
import { hz } from '../src/music/piano.js';

export async function runMusicChecks() {
  const out = [];
  const add = (name, pass, detail = '') => out.push({ name, pass, detail });
  add('five pieces listed', PIECE_IDS.length === 5, PIECE_IDS.join(' '));
  for (const id of PIECE_IDS) {
    const p = (await import(`../src/music/pieces/${id}.js`)).default;
    const bad = [];
    if (p.id !== id) bad.push('id');
    if (!(p.bpm >= 40 && p.bpm <= 90)) bad.push('bpm');
    if (!(p.quarters > 60)) bad.push('quarters');
    let prev = -1, lastEnd = 0;
    for (const n of p.notes) {
      const [m, s, l, v] = n;
      if (n.length !== 4 || !Number.isInteger(m) || m < 21 || m > 108) bad.push(`pitch ${n}`);
      else if (!(hz(m) > 20 && hz(m) < 5000)) bad.push(`hz ${n}`);
      if (!(s >= 0 && l > 0 && l <= 40)) bad.push(`time ${n}`);
      if (!(v >= 20 && v <= 100)) bad.push(`velocity ${n}`);
      if (s < prev - 1e-9) bad.push(`order ${n}`);
      prev = s; lastEnd = Math.max(lastEnd, s + l);
      if (bad.length > 4) break;
    }
    if (lastEnd > p.quarters + 1) bad.push(`notes run past quarters (${lastEnd} > ${p.quarters})`);
    const ev = prepare(p), seconds = expand(p).seconds;
    if (ev.length !== p.notes.length) bad.push('prepare count');
    if (!(seconds > 90 && seconds < 600)) bad.push(`length ${seconds.toFixed(0)} s`);
    const slow = expand(p, 0.8).seconds, fast = expand(p, 1.1).seconds;
    if (!(slow > seconds && fast < seconds)) bad.push('tempo scale');
    add(`piece ${id}: ${p.notes.length} notes, ${(seconds / 60).toFixed(1)} min`, bad.length === 0, bad.slice(0, 4).join('; '));
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('music.mjs')) {
  const res = await runMusicChecks();
  for (const r of res) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
  process.exit(res.some((r) => !r.pass) ? 1 : 0);
}
