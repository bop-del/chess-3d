// The Context line (CHE-407, fast tier): the text for every mode, names, the waiting time and the drop order when space is short.
import assert from 'node:assert/strict';
import { contextParts, contextText, SEP } from '../src/context-line.js';

const DE = {
  'side.white': 'Weiß', 'side.black': 'Schwarz', 'turn.white': 'Weiß am Zug', 'turn.black': 'Schwarz am Zug', 'turn.check': 'Schach', 'turn.thinking': 'Computer denkt nach',
  'turn.checkmate': 'Schachmatt. {side} gewinnt', 'turn.draw': 'Remis', 'banner.wins': '{side} gewinnt', 'reason.resign': 'Aufgegeben', 'reason.stalemate': 'Patt',
  'ctx.online': 'Online gegen {name}', 'ctx.daily': 'Tagesrätsel', 'ctx.puzzle': 'Rätsel {n}', 'ctx.computer': 'Gegen Computer', 'ctx.computerLevel': 'Gegen Computer ({level})',
  'ctx.twoPlayers': 'Zwei Spieler', 'ctx.youSide': 'Du bist dran ({side})', 'ctx.you': 'Du bist dran', 'ctx.theirMove': '{name} ist dran', 'ctx.computerMove': 'Computer ist dran',
  'panel.kind.drill': 'Übung', 'panel.kind.openings': 'Eröffnung', 'panel.kind.puzzles': 'Rätsel', 'review.title': 'Partie ansehen',
};
const sub = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
const tDE = (k, fb, v) => sub(DE[k] ?? fb, v);
const tEN = (k, fb, v) => sub(fb, v);
const line = (c, t = tDE, fits) => contextText(contextParts({ turn: 'w', mode: 'play', ...c }, t), fits);

// every mode
assert.equal(line({}), 'Zwei Spieler · Weiß am Zug');
assert.equal(line({ turn: 'b' }), 'Zwei Spieler · Schwarz am Zug');
assert.equal(line({ vsComputer: true, computerColor: 'b', level: 'Leicht 900' }), 'Gegen Computer (Leicht) · Du bist dran', 'the rating of the level is not shown');
assert.equal(line({ vsComputer: true, computerColor: 'b', level: 'Leicht 900', turn: 'b' }), 'Gegen Computer (Leicht) · Computer ist dran');
assert.equal(line({ vsComputer: true, computerColor: 'b', turn: 'b', thinking: true }), 'Gegen Computer · Computer denkt nach');
assert.equal(line({ vsComputer: true, computerColor: 'b', level: 'Easy ~900' }, tEN), 'Vs computer (Easy) · Your move');
assert.equal(line({ mode: 'online', online: { opponent: 'Felix', color: 'w', since: '' } }), 'Online gegen Felix · Du bist dran (Weiß)');
assert.equal(line({ mode: 'online', turn: 'b', online: { opponent: 'Felix', color: 'w', since: 'seit 3 Min' } }), 'Online gegen Felix · Felix ist dran · seit 3 Min');
assert.equal(line({ mode: 'online', turn: 'w', online: { opponent: 'Felix', color: 'w', since: 'seit 2 Std' } }), 'Online gegen Felix · Du bist dran (Weiß) · seit 2 Std');
assert.equal(line({ mode: 'puzzle', puzzle: { no: 12, own: 'w' } }), 'Rätsel 12 · Du bist dran (Weiß)');
assert.equal(line({ mode: 'puzzle', turn: 'b', puzzle: { no: 12, own: 'w' } }), 'Rätsel 12 · Schwarz am Zug', 'the opponent answers: no "your move"');
assert.equal(line({ mode: 'puzzle', puzzle: { daily: true, own: 'w' } }), 'Tagesrätsel · Du bist dran (Weiß)');
assert.equal(line({ mode: 'puzzle', puzzle: null }), 'Rätsel · Weiß am Zug', 'no number known');
assert.equal(line({ mode: 'drill', name: 'Spanisch' }), 'Übung · Spanisch · Weiß am Zug');
assert.equal(line({ mode: 'opening', name: 'Italienisch', turn: 'b' }), 'Eröffnung · Italienisch · Schwarz am Zug');
assert.equal(line({ mode: 'review' }), 'Partie ansehen', 'the review owns the board: no side to move');
assert.equal(line({ mode: 'review' }, tEN), 'Game review');

// check and the end of a game
assert.equal(line({ check: true }), 'Zwei Spieler · Weiß am Zug · Schach');
assert.equal(line({ over: { reason: 'checkmate', winner: 'w' }, check: true }), 'Zwei Spieler · Schachmatt. Weiß gewinnt');
assert.equal(line({ over: { reason: 'stalemate' } }), 'Zwei Spieler · Remis · Patt');
assert.equal(line({ mode: 'online', over: { reason: 'resign', winner: 'b' }, online: { opponent: 'Felix', color: 'w', since: 'seit 3 Min' } }), 'Online gegen Felix · Schwarz gewinnt · Aufgegeben');
assert.equal(line({}, tEN), 'Two players · White to move');

// too long: the waiting time drops first, then the detail (Check), then a lesson's name; the kind and the mover stay
const online = { mode: 'online', turn: 'b', check: true, online: { opponent: 'Felix', color: 'w', since: 'seit 3 Min' } };
const full = line(online);
assert.equal(full, ['Online gegen Felix', 'Felix ist dran', 'seit 3 Min', 'Schach'].join(SEP));
const within = (n) => (txt) => txt.length <= n;
assert.equal(line(online, tDE, within(full.length)), full, 'fits: nothing dropped');
assert.equal(line(online, tDE, within(full.length - 1)), ['Online gegen Felix', 'Felix ist dran', 'Schach'].join(SEP), 'the waiting time goes first');
assert.equal(line(online, tDE, within(34)), 'Online gegen Felix · Felix ist dran', 'then the detail');
assert.equal(line(online, tDE, within(5)), 'Online gegen Felix · Felix ist dran', 'the kind and the mover are never dropped, CSS cuts them with an ellipsis');
const drill = { mode: 'drill', name: 'Sizilianisch, Najdorf', check: true };
assert.equal(line(drill, tDE, within(25)), 'Übung · Weiß am Zug', 'the name goes after the detail');
assert.equal(line(drill, tDE, within(45)), 'Übung · Sizilianisch, Najdorf · Weiß am Zug', 'the detail went first');
const cpu = { vsComputer: true, computerColor: 'b', level: 'Leicht 900', turn: 'b', check: true };
assert.equal(line(cpu), 'Gegen Computer (Leicht) · Computer ist dran · Schach');
assert.equal(line(cpu, tDE, within(43)), 'Gegen Computer (Leicht) · Computer ist dran', 'the detail first');
assert.equal(line(cpu, tDE, within(36)), 'Gegen Computer · Computer ist dran', 'then the level in brackets');
console.log('PASS context line');
