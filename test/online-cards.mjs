// Online tab logic (CHE-301, fast tier): the second button of a player card and the floating chat state.
import assert from 'node:assert/strict';
import { secondAction, gameLine, myTurnCount, scoreOf, chatStep, chatView, spanOf, waitingMs, limitInfo, moveNo, runningGames } from '../src/online/cards.js';

const P = (o) => ({ name: 'Nina', playing: false, withMe: false, ...o });
assert.equal(secondAction(P({})), 'challenge');
assert.equal(secondAction(P({}), { out: ['Nina'] }), 'asked', 'your challenge is open: Zurückziehen');
assert.equal(secondAction(P({}), { out: 'Nina' }), 'asked', 'a plain name works too');
assert.equal(secondAction(P({}), { out: ['Felix'] }), 'challenge', 'a challenge to somebody else does not matter');
assert.equal(secondAction(P({}), { inc: ['Nina'] }), 'incoming');
assert.equal(secondAction(P({}), { out: ['Nina'], inc: ['Nina'] }), 'asked', 'both ways: withdraw your own');
assert.equal(secondAction(P({}), { game: true }), 'game', 'a running game: Zur Partie');
assert.equal(secondAction(P({}), { game: true, out: ['Nina'], inc: ['Nina'] }), 'game');
assert.equal(secondAction(P({ playing: true })), 'challenge', 'a player in a game with someone else can be challenged');
assert.equal(gameLine({ turn: 'w', color: 'w' }), 'mine');
assert.equal(gameLine({ turn: 'b', color: 'w' }), 'theirs');
assert.equal(myTurnCount([{ status: 'active', turn: 'w', color: 'w' }, { status: 'active', turn: 'b', color: 'w' }, { status: 'over', turn: 'w', color: 'w' }, { status: 'active', turn: 'b', color: 'b' }]), 2, 'only running games where it is your move');
assert.equal(myTurnCount(), 0);
assert.equal(scoreOf(null), '');
assert.equal(scoreOf({ w: 0, l: 0, d: 0 }), '');
assert.equal(scoreOf({ w: 2, l: 1, d: 0 }), '2 : 1');
assert.equal(scoreOf({ w: 0, l: 3, d: 1 }), '½ : 3½', 'a draw is half a point each, the half glued to the number');
assert.equal(scoreOf({ w: 3, l: 0, d: 1 }), '3½ : ½');
assert.equal(scoreOf({ w: 1, l: 3, d: 2 }), '2 : 4');
assert.equal(scoreOf({ w: 0, l: 0, d: 1 }), '½ : ½');
{   // CHE-421 fix: second person moved text, own form
  const { lastMoveText } = await import('../src/online/view.js');
  const T = (k, d, v = {}) => d.replace(/\{(\w+)\}/g, (_, n) => v[n]);
  const c = { t: T };
  const g = (turn) => ({ moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'].slice(0, turn === 'w' ? 4 : 3), color: 'w', turn, opponent: 'Felix' });
  assert.equal(lastMoveText(c, g('w')), 'Felix moved a knight to c6');
  assert.equal(lastMoveText(c, g('b')), 'You moved a knight to f3');
  const src = (await import('node:fs')).readFileSync(new URL('../src/online/strings.js', import.meta.url), 'utf8');
  for (const k of 'pnbrqk') assert.ok(src.includes(`'online.movedYou.${k}'`), `German movedYou.${k}`);
  assert.ok(src.includes("'online.movedYou.p': 'Du hast einen Bauern nach {sq} gezogen'"));
}
{   // CHE-420: no score yet is "noch keine Partie beendet", never "noch keine Partie" (a game may be running)
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/online/strings.js', import.meta.url), 'utf8');
  assert.ok(/'online\.noGameYet': 'noch keine Partie beendet'/.test(src) && /'online\.st\.none': 'noch keine Partie beendet'/.test(src));
  assert.ok(!/noch keine Partie'/.test(src));
}

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

// CHE-403: Waiting time, the last day line, the running games block order
const MIN = 60000, H = 3600000, D = 24 * H;
assert.deepEqual(spanOf(0), { unit: 'min', n: 1 }, 'under a minute reads 1 min');
assert.deepEqual(spanOf(90 * 1000), { unit: 'min', n: 1 });
assert.deepEqual(spanOf(12 * MIN + 59000), { unit: 'min', n: 12 });
assert.deepEqual(spanOf(59 * MIN), { unit: 'min', n: 59 });
assert.deepEqual(spanOf(60 * MIN), { unit: 'h', n: 1 });
assert.deepEqual(spanOf(3 * H + 40 * MIN), { unit: 'h', n: 3 }, 'hours round down');
assert.deepEqual(spanOf(24 * H), { unit: 'd', n: 1 });
assert.deepEqual(spanOf(2 * D + 23 * H), { unit: 'd', n: 2 });
assert.deepEqual(spanOf(-5), { unit: 'min', n: 1 });
const NOW = 1e12, G = (o) => ({ id: 1, status: 'active', color: 'w', turn: 'w', moves: [], lastMoveAt: NOW - 5 * MIN, staleAt: NOW - 5 * MIN + 72 * H, ...o });
assert.equal(waitingMs(G({}), NOW), 5 * MIN);
assert.equal(waitingMs(G({ lastMoveAt: NOW + 9 * MIN }), NOW), 0, 'a clock a little ahead never gives a negative time');
assert.equal(limitInfo(G({}), NOW), null, 'far from the limit: no line');
assert.equal(limitInfo(G({ staleAt: NOW + D + 1 }), NOW), null, 'just over a day left: no line');
assert.deepEqual(limitInfo(G({ staleAt: NOW + 5 * H + 10 * MIN, turn: 'b' }), NOW), { left: { unit: 'h', n: 5 }, over: false, mine: false }, 'their move: you can end it');
assert.deepEqual(limitInfo(G({ staleAt: NOW + 30 * MIN, turn: 'w' }), NOW), { left: { unit: 'min', n: 30 }, over: false, mine: true }, 'your move: they win');
assert.equal(limitInfo(G({ staleAt: NOW - 1, turn: 'b' }), NOW).over, true);
assert.equal(limitInfo(G({ status: 'over', staleAt: NOW + H }), NOW), null, 'a finished game has none');
assert.equal(moveNo(G({ moves: [] })), 1);
assert.equal(moveNo(G({ moves: ['e2e4'] })), 1, 'white has moved, black plays move 1');
assert.equal(moveNo(G({ moves: ['e2e4', 'e7e5'] })), 2);
assert.equal(moveNo(G({ moves: Array(23).fill('x') })), 12);
const run = runningGames([
  G({ id: 1, turn: 'b', lastMoveAt: NOW - 3 * D }), G({ id: 2, turn: 'w', lastMoveAt: NOW - 1 * H }), G({ id: 3, turn: 'w', lastMoveAt: NOW - 5 * H }),
  G({ id: 4, turn: 'b', lastMoveAt: NOW - 10 * MIN }), G({ id: 5, status: 'over', turn: 'w', lastMoveAt: NOW - 9 * D }),
], NOW).map((g) => g.id);
assert.deepEqual(run, [3, 2, 1, 4], 'yours to move first, then the longest waiting first; a finished game is not listed');
assert.deepEqual(runningGames([], NOW), []);
assert.deepEqual(runningGames(undefined, NOW), []);
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
assert.equal(SV.h2h.line, '3½ : ½', 'head to head from the asker with the draws');
assert.equal(SV.avgMoves, 3);
assert.equal(SV.avgMinutes, '6,8', 'German decimal comma');
assert.equal(SV.openings.length, 3, 'three openings at most');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1, details: { avgMinutes: 0.4 } }).avgMinutes, '<1');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1, details: { avgMinutes: 42.4 } }).avgMinutes, '42');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1 }).h2h, null, 'no head to head without a game against them');
assert.equal(statView({ games: 3, wins: 1, losses: 1, draws: 1, headToHead: { games: 0, wins: 0, losses: 0, draws: 0 } }).h2h, null);
for (const [w, l, d] of [[1, 1, 1], [1, 0, 2], [7, 3, 0], [0, 0, 1], [2, 1, 4]]) { const v = statView({ games: w + l + d, wins: w, losses: l, draws: d }); assert.equal(v.bar.w + v.bar.d + v.bar.l, 100, `bar ${w}/${l}/${d}`); assert.ok(v.bar.l >= 0 && v.bar.d >= 0); }
console.log('online cards statView: ok');
