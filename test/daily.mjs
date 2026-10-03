// Daily puzzle (src/puzzles/daily.js): the puzzle of a date, the streak rules, the store. No browser.
process.env.TZ = 'Europe/Berlin';   // todayKey reads the local date: pin the zone so the checks mean the same everywhere
import { createDaily, dailyIndex, todayKey, dayNumber, dateOfDay, STORE_KEY } from '../src/puzzles/daily.js';
import { PUZZLES } from '../src/puzzles/data.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const addDays = (d, n) => dateOfDay(dayNumber(d) + n);

// ---- the puzzle of a date
{
  ok('dates: a real date parses, an impossible one does not', dayNumber('2026-10-03') === 20729 && dayNumber('2026-02-30') === null && dayNumber('abc') === null && dayNumber('2026-1-3') === null, String(dayNumber('2026-10-03')));
  const fixed = ['2026-01-01', '2026-10-03', '2027-02-28', '2030-12-31'];
  const ids = fixed.map((d) => dailyIndex(d, PUZZLES).id);
  ok('fixed dates give fixed puzzles (pinned: a change here moves every player\'s daily puzzle)', ids.join() === 'xYUur,20E67,Nb9iv,uEQpt', ids.join());
  ok('the same date gives the same puzzle', fixed.every((d, i) => dailyIndex(d, PUZZLES).id === ids[i] && dailyIndex(d, PUZZLES).id === dailyIndex(d, [...PUZZLES].reverse()).id));
  ok('the puzzle comes from the whole set, every band', ['starter', 'growing', 'tricky'].every((b) => Array.from({ length: 300 }, (_, i) => dailyIndex(addDays('2026-01-01', i), PUZZLES)).some((p) => p.band === b)));
  let minDistinct = 30, worstFrom = '';
  for (let i = 0; i < 400; i++) {
    const from = addDays('2025-01-01', i);
    const n = new Set(Array.from({ length: 30 }, (_, k) => dailyIndex(addDays(from, k), PUZZLES).id)).size;
    if (n < minDistinct) { minDistinct = n; worstFrom = from; }
  }
  ok('30 consecutive dates give at least 28 different puzzles (400 start dates)', minDistinct >= 28, `${minDistinct} from ${worstFrom}`);
  const start = dateOfDay(Math.ceil(dayNumber('2026-03-01') / PUZZLES.length) * PUZZLES.length);   // the first day of a block
  const block = new Set(Array.from({ length: PUZZLES.length }, (_, i) => dailyIndex(addDays(start, i), PUZZLES).id));
  ok('a whole block of days gives every puzzle exactly once', block.size === PUZZLES.length, String(block.size));
  ok('an empty set and a bad date do not throw', dailyIndex('2026-10-03', []) === null && !!dailyIndex('not a date', PUZZLES));
}

// ---- today
{
  const at = (iso) => () => Date.parse(iso);
  ok('today is the local date: Berlin switches at local midnight (22:00Z in summer, 23:00Z in winter)',
    todayKey(at('2026-10-03T21:59:59Z')) === '2026-10-03' && todayKey(at('2026-10-03T22:00:00Z')) === '2026-10-04' &&
    todayKey(at('2026-01-15T22:59:59Z')) === '2026-01-15' && todayKey(at('2026-01-15T23:00:00Z')) === '2026-01-16');
  ok('01:30 local is already the new day, not the old one', todayKey(at('2026-10-03T23:30:00Z')) === '2026-10-04');
  ok('a leap day and a year border follow local time', todayKey(at('2028-02-28T23:30:00Z')) === '2028-02-29' && todayKey(at('2026-12-31T23:00:00Z')) === '2027-01-01');
  ok('the override replaces it, a bad override does not', todayKey(at('2026-10-03T12:00:00Z'), '2026-12-24') === '2026-12-24' && todayKey(at('2026-10-03T12:00:00Z'), 'x') === '2026-10-03' && todayKey(at('2026-10-03T12:00:00Z'), '2026-13-01') === '2026-10-03');
}

// ---- streak rules
{
  let clock = Date.parse('2026-10-03T08:00:00Z');
  const st = mem();
  const mk = (s = st) => createDaily({ storage: s, puzzles: PUZZLES, now: () => clock });
  const d = mk();
  const goTo = (iso) => { clock = Date.parse(iso + 'T08:00:00Z'); };
  ok('a fresh store: no streak, nothing done, puzzle chosen', d.streak() === 0 && d.best() === 0 && d.done() === null && !!d.puzzle() && d.puzzle().id === dailyIndex('2026-10-03', PUZZLES).id);
  d.finish(true);
  ok('solving today: done gold, streak 1', d.done() === 'g' && d.streak() === 1 && d.best() === 1);
  goTo('2026-10-04');
  ok('the next day is open and keeps yesterday\'s run', d.done() === null && d.streak() === 1);
  d.finish(false);
  ok('a solve with misses or Help counts (silver)', d.done() === 's' && d.streak() === 2 && d.best() === 2);
  goTo('2026-10-05'); d.finish(true);
  ok('three days in a row', d.streak() === 3);
  goTo('2026-10-06');
  ok('open day: still 3', d.streak() === 3);
  goTo('2026-10-07');
  ok('a missed day resets the run (open day after a gap: 0)', d.streak() === 0 && d.best() === 3);
  d.finish(true);
  ok('after the gap the run starts again at 1, best stays 3', d.streak() === 1 && d.best() === 3);
  goTo('2026-10-04');
  ok('looking at an earlier day: that day\'s own run', d.streak() === 2 && d.done() === 's');
  goTo('2026-10-07'); d.finish(false);
  ok('a gold day never turns silver', d.done() === 'g');
  const d2 = mk();
  ok('the store survives a reload', d2.streak() === 1 && d2.best() === 3 && d2.done() === 'g');
  const raw = JSON.parse(st.m.get(STORE_KEY));
  ok('store shape: { v: 1, days, best }', raw.v === 1 && raw.best === 3 && raw.days['2026-10-03'] === 'g' && raw.days['2026-10-04'] === 's' && Object.keys(raw).sort().join() === 'best,days,v', JSON.stringify(raw));
  // month and year borders
  const e = mk(mem());
  for (const day of ['2026-12-30', '2026-12-31', '2027-01-01']) { goTo(day); e.finish(true); }
  ok('a run crosses a year border', e.streak() === 3);
  const f = mk(mem());
  for (const day of ['2028-02-28', '2028-02-29', '2028-03-01']) { goTo(day); f.finish(true); }
  ok('a run crosses a leap day', f.streak() === 3);
  // change events, export, import, reset
  let fired = 0;
  d.onChange(() => { fired++; });
  const exp = d.exportData();
  const g = mk(mem()); goTo('2026-10-07');
  ok('import takes a record of this version and reports it', g.importData(exp) === true && g.streak() === 1 && g.best() === 3 && g.importData({ v: 9 }) === false && g.importData(null) === false);
  d.reset();
  ok('reset empties it and tells the listeners', d.streak() === 0 && d.best() === 0 && fired === 1 && JSON.parse(st.m.get(STORE_KEY)).best === 0);
}

// ---- storage that is missing, blocked, hostile or from the future
{
  let clock = Date.parse('2026-10-03T08:00:00Z');
  const mem0 = createDaily({ storage: null, puzzles: PUZZLES, now: () => clock });
  mem0.finish(true);
  ok('no storage: works in memory', mem0.streak() === 1);
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const b = createDaily({ storage: boom, puzzles: PUZZLES, now: () => clock });
  b.finish(true);
  ok('blocked storage: works in memory, no throw', b.streak() === 1 && b.done() === 'g');
  const junk = mem(); junk.setItem(STORE_KEY, '{not json');
  ok('an unreadable record reads as empty', createDaily({ storage: junk, puzzles: PUZZLES, now: () => clock }).streak() === 0);
  const hostile = mem(); hostile.setItem(STORE_KEY, JSON.stringify({ v: 1, days: { '2026-10-02': 'g', 'evil': 'g', '2026-10-01': 'x', '2026-02-31': 'g' }, best: -4 }));
  const h = createDaily({ storage: hostile, puzzles: PUZZLES, now: () => clock });
  ok('bad days and a bad best are dropped, good days kept', h.streak() === 1 && h.best() === 1);
  const future = mem(); const rec = JSON.stringify({ v: 2, days: { '2026-10-02': 'g' }, best: 9 }); future.setItem(STORE_KEY, rec);
  const fu = createDaily({ storage: future, puzzles: PUZZLES, now: () => clock });
  fu.finish(true);
  ok('a record of a newer version is not written over', future.getItem(STORE_KEY) === rec && fu.streak() === 1);
  // the ?daily= override writes that date's own record only
  const o = mem();
  const od = createDaily({ storage: o, puzzles: PUZZLES, now: () => clock, override: '2026-06-15' });
  od.finish(true);
  const days = Object.keys(JSON.parse(o.getItem(STORE_KEY)).days);
  ok('the date override writes only that date\'s record', days.join() === '2026-06-15' && od.today() === '2026-06-15' && od.puzzle().id === dailyIndex('2026-06-15', PUZZLES).id, days.join());
}

console.log(failed ? `\nDAILY FAILED (${failed})` : '\nDAILY OK');
process.exit(failed ? 1 : 0);
