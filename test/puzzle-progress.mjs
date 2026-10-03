// Puzzle progress store and path order (src/puzzles/progress.js, path.js): chapters, gold and silver, the finished chapter, the
// v1 migration, storage. No browser.
import { createPuzzleProgress, STORE_KEY, VERSION } from '../src/puzzles/progress.js';
import { levelOrder, chaptersOf, CHAPTER_SIZE } from '../src/puzzles/path.js';
import { PUZZLES } from '../src/puzzles/data.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

const BANDS = ['starter', 'growing', 'tricky'];
const THEMES = ['mate1', 'mate2', 'hanging', 'fork'];
// synthetic data: n puzzles per band, ratings going up in a scrambled id order, themes unevenly spread
const mk = (n) => BANDS.flatMap((band, b) => Array.from({ length: n }, (_, i) => ({ id: `${band[0]}${n - i}`, band, rating: 400 + b * 300 + i, theme: THEMES[((i >> 1) + (i % 3)) % 4] })));
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const play = (p, clean) => { const x = p.next(); p.finish(x.id, { clean }); return x; };

// ---- the order: easiest first, themes mixed in every chapter, the same on every device
{
  const puzzles = mk(100);
  const ord = levelOrder(puzzles, 'starter');
  ok('a level has all its puzzles once', ord.length === 100 && new Set(ord.map((p) => p.id)).size === 100);
  const ch = chaptersOf(ord);
  ok('100 puzzles make 10 chapters of 10 stations', ch.length === 10 && ch.every((c) => c.length === CHAPTER_SIZE));
  const maxOf = (c) => Math.max(...c.map((p) => p.rating)), minOf = (c) => Math.min(...c.map((p) => p.rating));
  ok('the chapters go from easy to hard', ch.every((c, i) => i === 0 || minOf(c) > maxOf(ch[i - 1])));
  ok('every chapter mixes the themes (at least 3, the first four stations differ)', ch.every((c) => new Set(c.map((p) => p.theme)).size >= 3 && new Set(c.slice(0, 3).map((p) => p.theme)).size === 3), JSON.stringify(ch[0].map((p) => p.theme)));
  ok('the order does not depend on the input order', levelOrder([...puzzles].reverse(), 'starter').map((p) => p.id).join() === ord.map((p) => p.id).join());
  ok('a short last chapter is kept', chaptersOf(levelOrder(mk(23), 'growing')).map((c) => c.length).join() === '10,10,3');
  // the real data
  const real = BANDS.map((b) => chaptersOf(levelOrder(PUZZLES, b)));
  ok('the real data gives 10 chapters of 10 in every level', real.every((c) => c.length === 10 && c.every((x) => x.length === 10)));
  ok('the real data: every chapter starts on its easiest rating band and mixes at least 3 themes', real.every((c) => c.every((x) => new Set(x.map((p) => p.theme)).size >= 3)));
}

// ---- gold, silver, and where the path goes on
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(30) });
  const s0 = p.stats();
  ok('first visit: station 1 is next, the rest untouched, level 1 chapter 1', s0.band === 'starter' && s0.chapter === 0 && s0.stations[0].state === 'next' && s0.stations.slice(1).every((x) => x.state === 'todo'));
  const a = play(p, true), b = play(p, false), c = play(p, true);
  const s = p.stats();
  ok('the path serves the stations in order', [a, b, c].map((x) => x.id).join() === s.stations.slice(0, 3).map((x) => x.id).join());
  ok('clean is gold, a miss or Help is silver, the next one glows', s.stations.slice(0, 4).map((x) => x.state).join() === 'gold,silver,gold,next', s.stations.map((x) => x.state).join());
  ok('solved counts gold, queued counts silver', s.solved.starter === 2 && s.queued === 1);
  p.select(b.id);
  ok('a tapped station is served next, even a played one', p.next().id === b.id);
  p.finish(b.id, { clean: true });
  ok('replaying a silver station clean makes it gold', p.stats().stations[1].state === 'gold' && p.stats().queued === 0);
  p.finish(a.id, { clean: false });
  ok('a gold station never goes back to silver', p.stats().stations[0].state === 'gold');
  ok('the path goes on with the first untouched station', p.next().id === p.stats().stations[3].id);
}

// ---- a finished chapter, then the next one; the last chapter opens the next level
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(20) });
  let seen = null;
  p.onChange((st) => { if (st.finished) seen = st.finished; });
  for (let i = 0; i < 9; i++) play(p, i % 2 === 0);
  ok('nine stations in: no chapter finished yet', p.stats().finished === null && seen === null);
  play(p, false);
  const st = p.stats();
  ok('the tenth station (silver) finishes the chapter once', st.finished && st.finished.chapter === 0 && !st.finished.level && seen && seen.chapter === 0, JSON.stringify(st.finished));
  ok('the tab shows the finished chapter while it is reported', st.view.chapter === 0 && st.stations.every((x) => x.state === 'gold' || x.state === 'silver'));
  const n = p.next();
  ok('Next goes on in chapter 2 but the finished chapter stays until the tab has shown it', p.stats().chapter === 1 && p.stats().finished?.chapter === 0 && !!n);
  p.ack();
  ok('ack clears it and the tab is back where the path is', p.stats().finished === null && p.stats().view.chapter === 1 && p.stats().stations[0].id === n.id);
  for (let i = 0; i < 10; i++) play(p, true);
  ok('the last chapter reports that it opens the next level', p.stats().finished?.level === true && p.stats().finished.chapter === 1);
  ok('the next level is where the path is', p.band() === 'growing' && p.next().band === 'growing');
  const r = p.stats();
  ok('replaying a finished chapter reports nothing', (() => { const q = createPuzzleProgress({ storage: mem(), puzzles: mk(20) }); for (let i = 0; i < 10; i++) play(q, true); q.next(); q.finish(q.stats().stations[0].id, { clean: true }); return q.stats().finished === null; })());
  ok('stats carry chapter badges', r.chapterList.length === 2 && r.chapterList.every((x) => x.size === 10));
}

// ---- looking at another chapter, everything done
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(20).filter((x) => x.band === 'starter') });
  p.setView('starter', 1);
  ok('the tab can look at another chapter', p.stats().view.chapter === 1 && p.stats().chapter === 0);
  p.setView(null);
  ok('and go back to where the path is', p.stats().view.chapter === 0);
  for (let i = 0; i < 20; i++) play(p, i !== 3);
  const x = p.next();
  ok('all stations played: the next start is the first silver one', x.id === levelOrder(mk(20).filter((q) => q.band === 'starter'), 'starter')[3].id);
  ok('an unknown id cannot be selected', p.select('nope') === false);
  ok('no puzzles at all gives null', createPuzzleProgress({ storage: mem(), puzzles: [] }).next() === null);
}

// ---- storage: saved, versioned, v1 migrates, survives garbage, prunes unknown ids
{
  const st = mem();
  const puzzles = mk(30);
  const p = createPuzzleProgress({ storage: st, puzzles });
  const a = play(p, true), b = play(p, false);
  const saved = JSON.parse(st.getItem(STORE_KEY));
  ok('saved under chess3d.puzzles with version 2', STORE_KEY === 'chess3d.puzzles' && VERSION === 2 && saved.v === 2 && saved.marks[a.id] === 'g' && saved.marks[b.id] === 's', JSON.stringify(saved));
  const q = createPuzzleProgress({ storage: st, puzzles });
  ok('a new instance reads the same progress', q.stats().solved.starter === 1 && q.stats().queued === 1);
  const r = createPuzzleProgress({ storage: st, puzzles: puzzles.filter((x) => x.id !== a.id && x.id !== b.id) });
  ok('ids that left the data set drop out', r.stats().solved.starter === 0 && r.stats().queued === 0);
  // v1 -> v2
  const old = mem();
  old.setItem(STORE_KEY, JSON.stringify({ v: 1, band: 'growing', solved: { starter: [a.id, 'gone'], growing: [], tricky: [] }, queue: [{ id: b.id, wait: 2 }], run: { clean: 1, slip: 0 } }));
  const m = createPuzzleProgress({ storage: old, puzzles });
  ok('a version 1 store: solved ids become gold stations, the rest is dropped', m.stats().solved.starter === 1 && m.stats().queued === 0);
  m.finish(m.next().id, { clean: true });
  ok('and it is saved as version 2 on the next change', JSON.parse(old.getItem(STORE_KEY)).v === 2);
  st.setItem(STORE_KEY, '{not json');
  ok('garbage storage gives a fresh start', createPuzzleProgress({ storage: st, puzzles }).stats().solved.starter === 0);
  st.setItem(STORE_KEY, JSON.stringify({ v: 99, marks: { [a.id]: 'g' } }));
  ok('an unknown version gives a fresh start', createPuzzleProgress({ storage: st, puzzles }).stats().solved.starter === 0);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createPuzzleProgress({ storage: broken, puzzles });
  s.finish(s.next().id, { clean: true });
  ok('blocked storage keeps working in memory', s.stats().solved.starter === 1);
  ok('no storage at all works', createPuzzleProgress({ puzzles }).next() !== null);
  p.reset();
  ok('reset starts over', p.stats().solved.starter === 0 && p.stats().queued === 0 && p.band() === 'starter');
}

// ---- Export and Import carry the path
{
  const puzzles = mk(20);
  const a = createPuzzleProgress({ storage: mem(), puzzles });
  play(a, true); play(a, false);
  const data = JSON.parse(JSON.stringify(a.exportData()));
  const b = createPuzzleProgress({ storage: mem(), puzzles });
  ok('importData takes an exported path', b.importData(data) && b.stats().solved.starter === 1 && b.stats().queued === 1);
  ok('importData refuses garbage and keeps what is there', !b.importData({ v: 7 }) && !b.importData(null) && b.stats().solved.starter === 1);
  ok('importData reads a version 1 record', b.importData({ v: 1, solved: { starter: [data && Object.keys(data.marks)[0]] } }) && b.stats().solved.starter === 1);
}

// ---- onChange fires on next, finish and reset
{
  const p = createPuzzleProgress({ storage: mem(), puzzles: mk(5) });
  let n = 0;
  p.onChange(() => n++);
  p.finish(p.next().id, { clean: true }); p.reset();
  ok('onChange fires', n === 3, String(n));
}

console.log(failed ? `\n${failed} failed` : '\nall puzzle progress checks passed');
process.exit(failed ? 1 : 0);
