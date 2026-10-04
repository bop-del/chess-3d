// bin/lane open and close flag parsing (tools/lane-args.mjs, CHE-194). Fast tier, no Herdr.
import assert from 'node:assert/strict';
import { parseLaneFlags as P } from '../tools/lane-args.mjs';

const open = { key: true, priv: true, agent: true }, close = { m: true, noLinear: true };
const bad = (args, spec) => assert.throws(() => P(args, spec), /usage/);

assert.deepEqual(P(['che-1-x'], open), { pos: ['che-1-x'], key: [] });
assert.deepEqual(P(['che-1-x', '--key', 'CHE-1', '--key', 'CHE-2', '--private'], open), { pos: ['che-1-x'], key: ['CHE-1', 'CHE-2'], priv: true });
assert.deepEqual(P(['che-1-x', '--private', '--agent', 'builder', '/b/brief.md'], open), { pos: ['che-1-x'], key: [], priv: true, agent: { name: 'builder', brief: '/b/brief.md' } });
assert.deepEqual(P(['--agent', 'builder', 'b.md', '--model', 'opus', 'che-1-x'], open), { pos: ['che-1-x'], key: [], agent: { name: 'builder', brief: 'b.md' }, model: 'opus' });
bad(['che-1-x', '--agent', 'builder'], open);                   // brief missing
bad(['che-1-x', '--model', 'opus'], open);                      // --model without --agent
bad(['che-1-x', '--agent', 'builder', 'b.md', '--model'], open); // model value missing
bad(['che-1-x', '--agent', 'a', 'b.md'], close);                // not a close flag
assert.deepEqual(P(['che-1-x', '-m', 'msg', '--no-linear'], close), { pos: ['che-1-x'], key: [], m: 'msg', noLinear: true });
console.log('lane args tests ok');
