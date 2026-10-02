// Puzzle progress store (src/puzzles/progress.js): bands, no repeats, the not-yet queue, storage. No browser.
import { createPuzzleProgress, STORE_KEY, UP_AFTER, DOWN_AFTER, GAP } from '../src/puzzles/progress.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

const BANDS = ['starter', 'growing', 'tricky'];
const mk = (n) => BANDS.flatMap((band) => Array.from({ length: n }, (_, i) => ({ id: `${band[0]}${i}`, band })));
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
// a fixed "random" so runs repeat: always the first candidate
const first = () => 0;

// ---- no repeats while the band has more
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(6), rand: first });
  const seen = new Set();
  let dup = false;
  for (let i = 0; i < 2; i++) { const x = p.next(); if (seen.has(x.id)) dup = true; seen.add(x.id); p.finish(x.id, { clean: true }); }
  ok('a solved puzzle does not come back while the band has others', !dup && seen.size === 2);
  ok('starts in the starter band', p.band() === 'starter');
}

// ---- up after UP_AFTER clean in a row, a slip in between resets the count
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(20), rand: first });
  for (let i = 0; i < UP_AFTER - 1; i++) p.finish(p.next().id, { clean: true });
  ok('two clean in a row stay in the band', p.band() === 'starter');
  p.finish(p.next().id, { clean: false });
  for (let i = 0; i < UP_AFTER - 1; i++) p.finish(p.next().id, { clean: true });
  ok('a slip resets the clean run', p.band() === 'starter');
  p.finish(p.next().id, { clean: true });
  ok(`${UP_AFTER} clean in a row go up a band`, p.band() === 'growing', p.band());
  ok('the new band serves its own puzzles', p.next().band === 'growing');
}

// ---- down after DOWN_AFTER not clean in a row, never below the first band
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(20), rand: first });
  for (let i = 0; i < DOWN_AFTER + 1; i++) p.finish(p.next().id, { clean: false });
  ok('the first band has no band below', p.band() === 'starter');
  for (let i = 0; i < UP_AFTER * 2; i++) p.finish(p.next().id, { clean: true });
  ok('two bands up', p.band() === 'tricky', p.band());
  for (let i = 0; i < UP_AFTER * 3; i++) p.finish(p.next().id, { clean: true });
  ok('the last band has no band above', p.band() === 'tricky');
  for (let i = 0; i < DOWN_AFTER; i++) p.finish(p.next().id, { clean: false });
  ok(`${DOWN_AFTER} not clean in a row go down a band`, p.band() === 'growing', p.band());
}

// ---- the not-yet queue: comes back after GAP others, and is solved once clean
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(8), rand: first });
  const a = p.next();
  p.finish(a.id, { clean: false });
  const order = [];
  for (let i = 0; i < GAP; i++) { const x = p.next(); order.push(x.id); p.finish(x.id, { clean: true }); }
  ok('a not-yet puzzle is not served within the gap', !order.includes(a.id), order.join());
  const back = p.next();
  ok(`a not-yet puzzle comes back after ${GAP} others`, back.id === a.id, `${back.id} vs ${a.id}`);
  p.finish(back.id, { clean: true });
  ok('solved clean it is out of the queue', p.stats().queued === 0);
}

// ---- a band that is used up: not-yet first, then it starts over
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(3).filter((x) => x.band === 'starter'), rand: first });
  const ids = [];
  for (let i = 0; i < 3; i++) { const x = p.next(); ids.push(x.id); p.finish(x.id, { clean: i !== 1 }); }
  ok('three puzzles served once each', new Set(ids).size === 3);
  const x = p.next();
  ok('the not-yet puzzle is served when the band is used up', x.id === ids[1], x.id);
  p.finish(x.id, { clean: true });
  const y = p.next();
  ok('then the band starts over', !!y && p.stats().solved.starter === 0 || p.stats().solved.starter <= 1);
}

// ---- an empty band is skipped, a single puzzle band repeats instead of failing
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: [{ id: 'g0', band: 'growing' }, { id: 'g1', band: 'growing' }], rand: first });
  ok('an empty first band falls back to the nearest band that has puzzles', p.next()?.band === 'growing');
  const q = createPuzzleProgress({ storage: mem(), puzzles: [{ id: 's0', band: 'starter' }], rand: first });
  const a = q.next(); q.finish(a.id, { clean: true });
  ok('a one puzzle set still serves a puzzle', q.next()?.id === 's0');
  ok('no puzzles at all gives null', createPuzzleProgress({ storage: mem(), puzzles: [] }).next() === null);
}

// ---- storage: saved, versioned, survives garbage, prunes unknown ids
{
  const st = mem();
  const puzzles = mk(10);
  const p = createPuzzleProgress({ storage: st, puzzles, rand: first });
  const a = p.next(); p.finish(a.id, { clean: true });
  const b = p.next(); p.finish(b.id, { clean: false });
  const saved = JSON.parse(st.getItem(STORE_KEY));
  ok('saved under chess3d.puzzles with a version', STORE_KEY === 'chess3d.puzzles' && saved.v === 1);
  const q = createPuzzleProgress({ storage: st, puzzles, rand: first });
  ok('a new instance reads the same progress', q.stats().solved.starter === 1 && q.stats().queued === 1);
  const r = createPuzzleProgress({ storage: st, puzzles: puzzles.filter((x) => x.id !== a.id && x.id !== b.id), rand: first });
  ok('ids that left the data set drop out', r.stats().solved.starter === 0 && r.stats().queued === 0);
  st.setItem(STORE_KEY, '{not json');
  ok('garbage storage gives a fresh start', createPuzzleProgress({ storage: st, puzzles }).stats().solved.starter === 0);
  st.setItem(STORE_KEY, JSON.stringify({ v: 99, band: 'tricky' }));
  ok('an unknown version gives a fresh start', createPuzzleProgress({ storage: st, puzzles }).band() === 'starter');
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createPuzzleProgress({ storage: broken, puzzles, rand: first });
  s.finish(s.next().id, { clean: true });
  ok('blocked storage keeps working in memory', s.stats().solved.starter === 1);
  ok('no storage at all works', createPuzzleProgress({ puzzles, rand: first }).next() !== null);
  p.reset();
  ok('reset starts over', p.stats().solved.starter === 0 && p.stats().queued === 0 && p.band() === 'starter');
}

// ---- onChange fires on next, finish and reset
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(5), rand: first });
  let n = 0;
  p.onChange(() => n++);
  p.finish(p.next().id, { clean: true }); p.reset();
  ok('onChange fires', n === 3, String(n));
}

console.log(failed ? `\n${failed} failed` : '\nall puzzle progress checks passed');
process.exit(failed ? 1 : 0);
