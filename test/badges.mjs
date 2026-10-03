// Badges (src/progress/badges.js): thresholds, never twice, wins, the in-memory fallback. No browser.
process.env.TZ = 'Europe/Berlin';
import { createBadges, winLevel, BADGES, STORE_KEY } from '../src/progress/badges.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const mk = (over = {}) => {
  const src = { p: 0, learned: 0, total: 27, best: 0 };
  const storage = over.storage === undefined ? mem() : over.storage;
  const b = createBadges({ storage, now: () => Date.parse('2026-10-03T12:00:00Z'), sources: { puzzles: () => src.p, openings: () => ({ learned: src.learned, total: src.total }), daily: () => ({ best: src.best }) } });
  const got = [];
  b.onEarn((id) => got.push(id));
  return { b, src, got, storage };
};

ok('13 badges in four families, ids unique', BADGES.length === 13 && new Set(BADGES.map((x) => x.id)).size === 13 && new Set(BADGES.map((x) => x.family)).size === 4);
ok('every badge has an English and a German name', BADGES.every((x) => x.name.en && x.name.de));

// ---- thresholds
{
  const { b, src, got } = mk();
  ok('nothing earned at the start', b.evaluate().length === 0 && Object.keys(b.earned()).length === 0);
  src.p = 9; b.evaluate();
  ok('9 puzzles: no badge', !b.has('puzzles-10'));
  src.p = 10; b.evaluate();
  ok('10 puzzles: puzzles-10, dated', b.has('puzzles-10') && b.earned()['puzzles-10'] === '2026-10-03' && got.join() === 'puzzles-10', got.join());
  src.p = 100; b.evaluate();
  ok('100 puzzles: 50 and 100 as well', b.has('puzzles-50') && b.has('puzzles-100'));
  src.learned = 1; b.evaluate();
  ok('1 opening learned: openings-1 only', b.has('openings-1') && !b.has('openings-5') && !b.has('openings-all'));
  src.learned = 5; b.evaluate();
  ok('5 openings: openings-5', b.has('openings-5') && !b.has('openings-all'));
  src.learned = 26; b.evaluate();
  ok('26 of 27: not all', !b.has('openings-all'));
  src.learned = 27; b.evaluate();
  ok('27 of 27: openings-all', b.has('openings-all'));
  src.best = 2; b.evaluate();
  ok('daily best 2: none', !b.has('daily-3'));
  src.best = 7; b.evaluate();
  ok('daily best 7: daily-3 and daily-7, not daily-30', b.has('daily-3') && b.has('daily-7') && !b.has('daily-30'));
  src.best = 30; b.evaluate();
  ok('daily best 30: daily-30', b.has('daily-30'));
}
{
  const { b, src } = mk();
  src.total = 0; src.learned = 0; b.evaluate();
  ok('an empty openings list does not give openings-all', !b.has('openings-all'));
}

// ---- never twice, never taken away
{
  const { b, src, got } = mk();
  src.p = 10; b.evaluate(); b.evaluate(); b.evaluate();
  ok('evaluate again does not announce twice', got.length === 1, got.join());
  ok('a second evaluate returns nothing new', b.evaluate().length === 0);
  src.p = 0; b.evaluate();
  ok('a counter that falls does not take the badge away', b.has('puzzles-10'));
  ok('earn() on an earned badge is false and silent', b.earn('puzzles-10') === false && got.length === 1);
  ok('earn() of an unknown id is false', b.earn('nope') === false && b.earn('__proto__') === false);
  ok('earn() of a new id announces once', b.earn('daily-30') === true && got.length === 2 && got[1] === 'daily-30');
}
{
  // the first look on load is silent: old progress earns no toast
  const { b, src, got } = mk();
  src.p = 60; src.learned = 6;
  const fresh = b.evaluate({ silent: true });
  ok('silent evaluate earns but does not announce', fresh.length === 4 && got.length === 0 && b.has('puzzles-50') && b.has('openings-5'), `${fresh.join()} / ${got.join()}`);
  b.evaluate();
  ok('and it does not announce them later either', got.length === 0);
}

// ---- wins
{
  const { b, got } = mk();
  ok('recordWin of an unknown level is refused', b.recordWin('godlike') === false && b.recordWin('__proto__') === false && b.recordWin(undefined) === false && !Object.keys(b.wins()).length);
  ok('recordWin(easy) earns win-easy only', b.recordWin('easy') === true && b.has('win-easy') && !b.has('win-novice') && !b.has('win-normal') && !b.has('win-hard') && got.join() === 'win-easy', got.join());
  ok('a second win at the same level is not new', b.recordWin('easy') === false && got.length === 1);
  ok('the win is dated', b.wins().easy === '2026-10-03');
  b.recordWin('hard'); b.recordWin('novice'); b.recordWin('normal');
  ok('all four levels give the four win badges', ['novice', 'easy', 'normal', 'hard'].every((l) => b.has('win-' + l)));
  const p = b.progress('wins');
  ok('the wins family reports 4 of 4', p.earned === 4 && p.total === 4 && p.value === 4, JSON.stringify(p));
}

// ---- which game over is a win
{
  const st = (o) => ({ vsComputer: true, computerColor: 'b', level: 'normal', ...o });
  const mate = { winner: 'w', reason: 'checkmate' };
  ok('the player (white) mates the computer: a win at its level', winLevel(st({}), mate, 'play') === 'normal');
  ok('the player as black: a win when black wins', winLevel(st({ computerColor: 'w' }), { winner: 'b' }, 'play') === 'normal' && winLevel(st({ computerColor: 'w' }), { winner: 'w' }, 'play') === null);
  ok('the computer wins: no win', winLevel(st({}), { winner: 'b' }, 'play') === null);
  ok('a draw: no win', winLevel(st({}), { winner: null, reason: 'stalemate' }, 'play') === null);
  ok('two players (no computer): no win', winLevel(st({ vsComputer: false }), mate, 'play') === null);
  ok('puzzle, explain and drill modes: no win', ['puzzle', 'explain', 'drill'].every((m) => winLevel(st({}), mate, m) === null));
  ok('no level or an unknown level: no win', winLevel(st({ level: null }), mate, 'play') === null && winLevel(st({ level: 'godlike' }), mate, 'play') === null);
  ok('no game over: no win', winLevel(st({}), null, 'play') === null);
}

// ---- progress lines
{
  const { b, src } = mk();
  src.p = 3; src.learned = 2; src.best = 1;
  const p = b.progress('puzzles'), o = b.progress('openings'), d = b.progress('daily');
  ok('puzzles: value 3, 7 left for the first', p.value === 3 && p.items[0].left === 7 && p.items[2].left === 97 && p.earned === 0, JSON.stringify(p));
  ok('openings: value 2 of 27, all needs 25 more', o.value === 2 && o.max === 27 && o.items[0].left === 0, JSON.stringify(o));
  ok('openings: left for openings-5 is 3, for all 25', o.items[1].left === 3 && o.items[2].left === 25, JSON.stringify(o.items.map((i) => i.left)));
  ok('daily: best 1, 2 left for the first', d.value === 1 && d.items[0].left === 2);
}

// ---- storage
{
  const { b, src, storage } = mk();
  src.p = 10; b.evaluate(); b.recordWin('normal');
  const raw = JSON.parse(storage.getItem(STORE_KEY));
  ok('the record is { v: 1, earned, wins } under chess3d.badges', STORE_KEY === 'chess3d.badges' && raw.v === 1 && raw.earned['puzzles-10'] && raw.wins.normal === '2026-10-03', JSON.stringify(raw));
  const b2 = createBadges({ storage, sources: {} });
  ok('a new store reads the record back', b2.has('puzzles-10') && b2.has('win-normal') && b2.wins().normal === '2026-10-03');
  const got2 = []; b2.onEarn((id) => got2.push(id)); b2.evaluate();
  ok('and announces nothing on load', got2.length === 0);
}
{
  const bad = mem();
  bad.setItem(STORE_KEY, JSON.stringify({ v: 1, earned: { 'puzzles-10': '2026-01-01', ghost: '2026-01-01', 'daily-3': 'yesterday' }, wins: { easy: '2026-01-02', godlike: '2026-01-02' } }));
  const b = createBadges({ storage: bad, sources: {} });
  ok('unknown ids, wrong dates and unknown levels are dropped, the good ones kept', b.has('puzzles-10') && !b.has('daily-3') && !('ghost' in b.earned()) && b.wins().easy === '2026-01-02' && !('godlike' in b.wins()));
  const junk = mem(); junk.setItem(STORE_KEY, '{not json');
  ok('unreadable storage starts empty and still works', Object.keys(createBadges({ storage: junk, sources: {} }).earned()).length === 0);
  const newer = mem(); newer.setItem(STORE_KEY, JSON.stringify({ v: 9, earned: { 'puzzles-10': '2026-01-01' } }));
  const nb = createBadges({ storage: newer, sources: { puzzles: () => 10 } });
  nb.evaluate();
  ok('a record of a newer version is read as empty, and works in memory', nb.earned()['puzzles-10'] !== '2026-01-01' && nb.has('puzzles-10'));
  ok('and it is never written over', JSON.parse(newer.getItem(STORE_KEY)).v === 9 && JSON.parse(newer.getItem(STORE_KEY)).earned['puzzles-10'] === '2026-01-01');
}
{
  // blocked storage: getItem or setItem throws, or there is no storage at all
  const throws = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  for (const [name, storage] of [['throwing', throws], ['missing', null]]) {
    const { b, src } = mk({ storage });
    src.p = 10; b.evaluate(); b.recordWin('hard');
    ok(`in-memory fallback (${name} storage): earned and kept for the session`, b.has('puzzles-10') && b.has('win-hard'));
  }
}

// ---- export, import, reset
{
  const { b } = mk();
  b.recordWin('easy');
  const data = b.exportData();
  const { b: c } = mk();
  ok('import of an export gives the same badges', c.importData(data) === true && c.has('win-easy') && c.wins().easy === '2026-10-03');
  ok('import refuses a wrong version and junk', c.importData({ v: 2 }) === false && c.importData(null) === false && c.importData('x') === false);
  c.reset();
  ok('reset empties', Object.keys(c.earned()).length === 0 && Object.keys(c.wins()).length === 0);
}

console.log(failed ? `\nbadges: ${failed} FAILED` : '\nbadges: all passed');
process.exit(failed ? 1 : 0);
