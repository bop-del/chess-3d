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
