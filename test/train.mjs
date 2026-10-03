// Training core: the ladder, the guessed numbers, the store (cards, removal, export and import) and the planner.
// Run: node test/train.mjs    Exit 0 when every check holds, 1 otherwise. No browser.
import { LADDER_H, next, dueAt } from '../src/train/ladder.js';
import { GUESSES } from '../src/train/guesses.js';
import { createStore, STORAGE_KEY, VERSION } from '../src/train/store.js';
import { planSession, planPractise, positionKeys, isOwn } from '../src/train/planner.js';
import { LINES } from '../src/openings/lines.js';

let bad = 0;
const check = (cond, m) => { if (!cond) { bad++; console.log('FAIL ' + m); } };
const H = 3600e3;

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
let clock = 1_000_000_000_000;
const mk = (storage = memory()) => ({ storage, store: createStore({ storage, now: () => clock }) });

// --- ladder
{
  check(LADDER_H.join() === '4,24,72,168,336,720,2160,4320', 'ladder hours are the eight guessed intervals');
  check(next(1, true) === 2 && next(7, true) === 8 && next(8, true) === 8, 'right answer climbs one and caps at 8');
  check(next(3, false) === 1 && next(2, false) === 1 && next(1, false) === 1 && next(8, false) === 6, 'a miss drops two and floors at 1');
  check(dueAt(1, 0) === 4 * H && dueAt(8, 0) === 4320 * H, 'dueAt adds the level interval');
  check(GUESSES.length >= 3 && GUESSES.every((g) => g.name && g.wrongIf && /\w/.test(g.wrongIf)), 'every guess carries its falsifying observation');
  check(GUESSES.every((g) => !/\d+\s*(times|sessions|days in a row)/.test(g.wrongIf)), 'falsifying observations are about what he does, not a count');
}

const italian = LINES.find((l) => l.id === 'italian-game');
const ruy = LINES.find((l) => l.id === 'ruy-lopez');
const sicilian = LINES.find((l) => l.id === 'sicilian-defense');
const ownCount = (l) => l.moves.filter((_, i) => isOwn(l, i)).length;

// --- store basics
{
  const { store, storage } = mk();
  check(!store.everAdopted() && store.adopted().length === 0 && store.dueKeys(clock).length === 0, 'fresh store is empty');
  store.adopt('italian-game');
  check(store.isAdopted('italian-game') && store.everAdopted(), 'adopt marks the line and ever');
  const cards = store.cardsOf('italian-game');
  check(cards.length === ownCount(italian), `adopt creates one card per own move (${cards.length})`);
  check(cards.every((c) => c.level === 1 && c.best === 0 && c.due === clock && c.lines.join() === 'italian-game'), 'new cards: level 1, best 0, due now');
  check(store.dueKeys(clock).length === cards.length, 'new cards are due at once');
  check(store.progress('italian-game') === 0, 'a new line shows an empty bar');
  check(JSON.parse(storage.m.get(STORAGE_KEY)).version === VERSION, 'record is versioned under chess3d.train');
  let n = 0; store.onChange(() => n++);
  store.adopt('italian-game');
  check(n === 0 && store.adopted().length === 1, 'adopting twice is inert');

  // answers
  const k0 = cards[0].key;
  store.answer(k0, true);
  let c = store.card(k0);
  check(c.level === 2 && c.best === 2 && c.due === clock + 24 * H, 'right answer: level 2, best 2, due in a day');
  store.answer(k0, true); store.answer(k0, true);
  check(store.card(k0).level === 4 && store.card(k0).best === 4, 'climbs');
  store.answer(k0, false);
  c = store.card(k0);
  check(c.level === 2 && c.best === 4, 'a miss drops two, best never falls');
  check(!store.dueKeys(clock).includes(k0) && store.dueKeys(clock + 25 * H).includes(k0), 'due follows the ladder');
  const p = store.progress('italian-game');
  check(Math.abs(p - (4 / 8) / ownCount(italian)) < 1e-9, 'progress is the mean of best over 8');
  store.answer('no such key', true);
  check(n === 4, 'unknown key answer is ignored, each real change notifies once');

  // persistence
  const again = createStore({ storage, now: () => clock });
  check(again.isAdopted('italian-game') && again.card(k0).best === 4 && again.card(k0).level === 2, 'a second store reads the same record');
}

// --- shared cards and siblings
{
  const { store } = mk();
  store.adopt('italian-game'); store.adopt('ruy-lopez');
  const shared = store.cardsOf('italian-game').filter((c) => c.lines.length === 2);
  check(shared.length >= 2, `italian and ruy share cards (${shared.length})`);
  const before = store.progress('ruy-lopez');
  store.answer(shared[0].key, true);
  check(store.progress('ruy-lopez') > before && store.progress('italian-game') > 0, 'a shared card raises every opening through it');
  const bc4 = store.cardsOf('italian-game').find((c) => c.sans.includes('Bc4'));
  check(bc4 && bc4.sans.includes('Bb5'), 'sibling own moves are accepted on one card');

  // removal
  const snap = JSON.stringify(store.cardsOf('ruy-lopez').map((c) => [c.key, c.level, c.best, c.due]));
  const allKeys = Object.keys(JSON.parse(store.exportJSON()).cards).length;
  store.remove('italian-game');
  check(!store.isAdopted('italian-game') && store.everAdopted(), 'remove drops the line, ever stays');
  const rec = JSON.parse(store.exportJSON());
  check(Object.keys(rec.cards).length === allKeys, 'no card is deleted');
  check(JSON.stringify(store.cardsOf('ruy-lopez').map((c) => [c.key, c.level, c.best, c.due])) === snap, 'levels are untouched');
  check(Object.values(rec.cards).every((c) => !c.lines.includes('italian-game')), 'its id is gone from the cards');
  const dormant = store.cardsOf('italian-game').filter((c) => c.lines.length === 0);
  check(dormant.length > 0, 'cards only the removed line used are dormant');
  check(!store.dueKeys(clock + 1e12).some((k) => dormant.find((c) => c.key === k)), 'dormant cards are never due');
  check(dormant[0].sans.length > 0, 'a dormant card still names its move');
  const lvl = store.card(shared[0].key).level;
  store.adopt('italian-game');
  check(store.card(shared[0].key).level === lvl && store.card(shared[0].key).lines.length === 2, 're-adopting wakes cards where they were');
  store.remove('italian-game'); store.remove('ruy-lopez');
  check(store.adopted().length === 0 && store.everAdopted() && store.dueKeys(clock + 1e12).length === 0, 'removing everything leaves ever true and nothing due');
}

// --- export and import
{
  const a = mk();
  a.store.adopt('sicilian-defense');
  a.store.answer(a.store.cardsOf('sicilian-defense')[0].key, true);
  const text = a.store.exportJSON();
  const b = mk();
  check(b.store.importJSON(text).ok, 'import accepts an export');
  check(b.store.isAdopted('sicilian-defense') && b.store.card(a.store.cardsOf('sicilian-defense')[0].key).best === 2, 'import restores repertoire and levels');
  check(JSON.parse(b.storage.m.get(STORAGE_KEY)).adopted[0] === 'sicilian-defense', 'import is saved');
  const rec = JSON.parse(text);
  const fails = {
    'not json': '{nope',
    'array': '[]',
    'no version': JSON.stringify({ adopted: [], cards: {} }),
    'newer version': JSON.stringify({ ...rec, version: VERSION + 1 }),
    'bad adopted': JSON.stringify({ ...rec, adopted: 'x' }),
    'unknown line': JSON.stringify({ ...rec, adopted: ['no-such-line'] }),
    'bad card': JSON.stringify({ ...rec, cards: { k: { level: 99, best: 0, due: 0, lines: [] } } }),
    'missing cards': JSON.stringify({ version: 1, adopted: [] }),
  };
  for (const [name, text2] of Object.entries(fails)) {
    const c = mk();
    c.store.adopt('italian-game');
    const r = c.store.importJSON(text2);
    check(!r.ok && typeof r.error === 'string' && r.error.length > 10, `import rejects ${name} with a sentence`);
    check(c.store.isAdopted('italian-game') && !c.store.isAdopted('sicilian-defense'), `a rejected import (${name}) changes nothing`);
  }
  const n = mk(memory());
  n.storage.setItem(STORAGE_KEY, JSON.stringify({ ...rec, version: VERSION + 1 }));
  const s = createStore({ storage: n.storage, now: () => clock });
  s.adopt('italian-game');
  check(JSON.parse(n.storage.m.get(STORAGE_KEY)).version === VERSION + 1, 'a record from a newer version is never overwritten');
  const broken = memory(); broken.setItem(STORAGE_KEY, 'garbage');
  check(createStore({ storage: broken, now: () => clock }).adopted().length === 0, 'garbage in storage starts empty');
  const thrower = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const t2 = createStore({ storage: thrower, now: () => clock });
  t2.adopt('italian-game');
  check(t2.isAdopted('italian-game'), 'blocked storage still works in memory');
}

// --- planner
{
  const { store } = mk();
  check(planSession(store, LINES, clock).length === 0, 'nothing adopted: empty plan');
  store.adopt('italian-game');
  let plan = planSession(store, LINES, clock);
  const quizzes = plan.filter((s) => s.mode === 'quiz');
  check(quizzes.length === ownCount(italian) && plan.length === italian.moves.length, 'all new cards due: the whole line, own moves quizzed');
  check(plan.every((s, i) => s.ply === i && s.lineId === 'italian-game'), 'plies in order');
  check(plan.filter((s) => s.mode === 'context').every((s) => !isOwn(italian, s.ply)), 'opponent moves are context');
  check(plan[0].rewind === 0 && plan.slice(1).every((s) => s.rewind === undefined), 'one fresh start');

  // only some due: others are context, trailing context is cut
  const keys = positionKeys(italian);
  for (const c of store.cardsOf('italian-game')) store.answer(c.key, true);       // all level 2, due in a day
  check(planSession(store, LINES, clock).length === 0, 'nothing due: empty plan');
  const k = keys[4];                                                                 // Bc4 position
  const at = clock + 25 * H;
  store.answer(keys[2], false); store.answer(keys[2], false);                         // Nf3 position back to level 1, due in 4 h
  plan = planSession(store, LINES, at);
  check(plan.length > 0 && plan[plan.length - 1].mode === 'quiz', 'a plan ends on its last quiz');
  check(plan.filter((s) => s.mode === 'quiz').length === store.dueKeys(at).length, 'every due card is quizzed once');
  const quizPlies = plan.filter((s) => s.mode === 'quiz').map((s) => s.ply);
  check(plan.some((s) => s.mode === 'context' && isOwn(italian, s.ply)) || quizPlies.length === ownCount(italian), 'own moves that are not due are context');

  // dormancy: removed lines are never scheduled
  store.remove('italian-game');
  check(planSession(store, LINES, clock + 1e13).length === 0, 'a removed line is never scheduled');
}

// rewind instead of reset, and one quiz per shared card
{
  const { store } = mk();
  store.adopt('italian-game'); store.adopt('ruy-lopez');
  const plan = planSession(store, LINES, clock);
  const quizKeys = plan.filter((s) => s.mode === 'quiz').map((s) => s.key);
  check(new Set(quizKeys).size === quizKeys.length, 'a shared card is quizzed once per session');
  const starts = plan.filter((s) => s.rewind !== undefined);
  check(starts.length === 2 && starts[0].rewind === 0, 'two stretches');
  check(starts[1].rewind >= 4 && starts[1].lineId !== starts[0].lineId, `the second line continues from the shared part, not a reset (rewind ${starts[1].rewind})`);
  const second = plan.slice(plan.indexOf(starts[1]));
  check(second[0].ply === starts[1].rewind, 'a stretch starts at its rewind ply');
  // a different opening forces a reset
  store.adopt('sicilian-defense');
  const p2 = planSession(store, LINES, clock);
  const sic = p2.find((s) => s.lineId === 'sicilian-defense' && s.rewind !== undefined);
  check(sic && sic.rewind <= 1 && p2.filter((s) => s.rewind !== undefined).length === 3, 'a line sharing only the first move rewinds to it at most (no deeper claim)');
  // siblings: the start position accepts both adopted first moves
  store.adopt('london-system');
  check(store.cardsOf('london-system')[0].sans.includes('d4') && store.cardsOf('italian-game')[0].sans.includes('d4') && store.cardsOf('italian-game')[0].sans.includes('e4'), 'siblings from different lines are accepted on the shared start card');
  // cap
  const capped = planSession(store, LINES, clock, { max: 3 });
  check(capped.filter((s) => s.mode === 'quiz').length >= 3 && capped.length < planSession(store, LINES, clock, { max: 99 }).length, 'the session cap stops at a line boundary');
}

// practise
{
  const plan = planPractise('sicilian-defense');
  check(plan.length === sicilian.moves.length, 'practise covers the whole line');
  check(plan.every((s, i) => s.ply === i && (s.mode === 'quiz') === isOwn(sicilian, i)), 'every own move quizzed, the rest context');
  check(plan[0].rewind === 0 && planPractise('nope').length === 0, 'fresh board, unknown line gives nothing');
  const { store } = mk(); store.adopt('sicilian-defense');
  const before = store.exportJSON();
  planPractise('sicilian-defense');
  check(store.exportJSON() === before, 'planning practice touches nothing');
}

// --- a record that fails sanitising is not lost (R12)
{
  const storage = memory();
  const good = { level: 2, best: 2, due: clock, lines: ['italian-game'] };
  const raw = JSON.stringify({ version: VERSION, ever: true, adopted: ['italian-game', 'gone-line'], cards: { ok: good, broken: { level: 'x' } } });
  storage.setItem(STORAGE_KEY, raw);
  const { store } = mk(storage);
  check(store.isAdopted('italian-game') && !store.isAdopted('gone-line'), 'storage load keeps the good line, drops the unknown one');
  check(storage.getItem(STORAGE_KEY + '.bak') === raw, 'the original record is kept under a backup key when something was dropped');
  const shape = memory(); shape.setItem(STORAGE_KEY, '[1,2]');
  const { store: s2 } = mk(shape); s2.adopt('italian-game');
  check(shape.getItem(STORAGE_KEY) === '[1,2]', 'an unreadable shape is never overwritten');
  const blocked = { get getItem() { throw new Error('SecurityError'); } };
  let made = true; try { const s3 = createStore({ storage: blocked, now: () => clock }); s3.adopt('italian-game'); } catch (e) { made = false; }
  check(made, 'a throwing storage works in memory');
}

console.log(bad ? `\n${bad} check(s) failed` : 'train: all checks passed');
process.exit(bad ? 1 : 0);
