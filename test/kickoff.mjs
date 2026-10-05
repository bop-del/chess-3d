// Kickoff verify and resend of bin/lane agent (tools/kickoff.mjs, CHE-241). Fast tier, fake herdr and a fake clock.
import assert from 'node:assert/strict';
import { sendKickoff } from '../tools/kickoff.mjs';

// a fake agent that turns working after it received `after` prompts (never when after is 0), `lag` ms after the last prompt
const fake = ({ after, lag = 5000 }) => {
  const f = { t: 0, prompts: [], lastAt: -1 };
  f.io = { prompt: (x) => { f.prompts.push(x); f.lastAt = f.t; }, status: () => (after && f.prompts.length >= after && f.t - f.lastAt >= lag ? 'working' : 'idle'), sleep: (ms) => { f.t += ms; }, now: () => f.t };
  return f;
};

let f = fake({ after: 1 });
let r = sendKickoff({ id: 'a', text: 'go', io: f.io });
assert.deepEqual([r.ok, r.sent, f.prompts.length], [true, 1, 1]); assert.ok(f.t < 60000);   // working within 60 s: one prompt only

f = fake({ after: 2 });
r = sendKickoff({ id: 'a', text: 'go', io: f.io });
assert.deepEqual([r.ok, r.sent], [true, 2]); assert.ok(f.t >= 60000 && f.t < 120000);       // swallowed once: resent after 60 s

f = fake({ after: 4 });
r = sendKickoff({ id: 'a', text: 'go', io: f.io });
assert.deepEqual([r.ok, r.sent], [true, 4]);                                                  // the third resend is the last that counts

f = fake({ after: 0 });
r = sendKickoff({ id: 'lane-x-builder', text: 'go', io: f.io });
assert.equal(r.ok, false); assert.equal(f.prompts.length, 4); assert.equal(f.t, 240000);     // 1 + 3 resends, then stop
assert.match(r.line, /^RED: agent lane-x-builder never started working after 4 kickoff prompts/);

f = fake({ after: 1, lag: 70000 });                                                           // too slow for the window: resent, then the second one counts
r = sendKickoff({ id: 'a', text: 'go', io: f.io, resends: 1 });
assert.equal(r.sent, 2);
console.log('kickoff tests ok');
