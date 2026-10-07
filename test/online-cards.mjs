// Online tab logic (CHE-301, fast tier): the second button of a player card and the floating chat state.
import assert from 'node:assert/strict';
import { secondAction, scoreOf, chatStep, chatView } from '../src/online/cards.js';

const P = (o) => ({ name: 'Nina', playing: false, withMe: false, ...o });
assert.equal(secondAction(P({})), 'challenge');
assert.equal(secondAction(P({ playing: true })), 'playing');
assert.equal(secondAction(P({}), { outTo: 'Nina' }), 'asked');
assert.equal(secondAction(P({}), { outTo: 'Felix' }), 'challenge');
assert.equal(secondAction(P({}), { active: true }), 'busy');
assert.equal(secondAction(P({ withMe: true })), 'busy');
assert.equal(scoreOf(null), '');
assert.equal(scoreOf({ w: 0, l: 0, d: 0 }), '');
assert.equal(scoreOf({ w: 2, l: 1, d: 0 }), '2 : 1');
assert.equal(scoreOf({ w: 0, l: 3, d: 1 }), '0 : 3  ½ 1');

let c = { with: null, shown: false, min: false };
assert.equal(chatView(c), 'none');
assert.deepEqual(chatStep(c, 'min'), c, 'minimising a closed chat does nothing');
c = chatStep(c, 'open', 'Nina');
assert.equal(chatView(c), 'window');
c = chatStep(c, 'to', 'Felix');
assert.equal(c.with, 'Felix');
c = chatStep(c, 'min');
assert.equal(chatView(c), 'pill');
c = chatStep(c, 'expand');
assert.equal(chatView(c), 'window');
c = chatStep(c, 'min');
c = chatStep(c, 'open', 'Mia');
assert.deepEqual(c, { with: 'Mia', shown: true, min: false }, 'opening a chat expands a collapsed one');
assert.equal(chatView(c, false), 'none', 'an unknown player shows nothing');
assert.equal(chatView(chatStep(c, 'close')), 'none');
console.log('online cards: ok');

// CHE-290: statView
import { statView } from '../src/online/cards.js';
assert.equal(statView(null).empty, true);
assert.equal(statView({ games: 0 }).empty, true);
const SV = statView({
  games: 6, wins: 3, losses: 2, draws: 1, streak: { current: { type: 'loss', n: 2 }, best: { wins: 2, losses: 2, draws: 1 } },
  headToHead: { games: 4, wins: 3, losses: 0, draws: 1 }, details: { avgMoves: 3.4, avgMinutes: 6.8, openings: [{ name: 'a', n: 4 }, { name: 'b', n: 3 }, { name: 'c', n: 2 }, { name: 'd', n: 1 }] },
});
assert.deepEqual([SV.games, SV.wins, SV.losses, SV.draws], [6, 3, 2, 1]);
assert.equal(SV.bar.w + SV.bar.d + SV.bar.l, 100, 'the bar is always 100 percent');
assert.deepEqual(SV.streak, { type: 'loss', n: 2 });
assert.equal(SV.bestWins, 2);
assert.equal(SV.h2h.line, '3 : 0  ½ 1', 'head to head from the asker with the draws');
assert.equal(SV.avgMoves, 3);
assert.equal(SV.avgMinutes, '6,8', 'German decimal comma');
assert.equal(SV.openings.length, 3, 'three openings at most');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1, details: { avgMinutes: 0.4 } }).avgMinutes, '<1');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1, details: { avgMinutes: 42.4 } }).avgMinutes, '42');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1 }).h2h, null, 'no head to head without a game against them');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1, headToHead: { games: 0, wins: 0, losses: 0, draws: 0 } }).h2h, null);
for (const [w, l, d] of [[1, 1, 1], [1, 0, 2], [7, 3, 0], [0, 0, 1], [2, 1, 4]]) { const v = statView({ games: w + l + d, wins: w, losses: l, draws: d }); assert.equal(v.bar.w + v.bar.d + v.bar.l, 100, `bar ${w}/${l}/${d}`); assert.ok(v.bar.l >= 0 && v.bar.d >= 0); }
console.log('online cards statView: ok');
