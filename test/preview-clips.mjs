// CHE-391 / CHE-388: preview clip pipeline helpers and the critic verdict validator. Fast tier, no browser.
import assert from 'node:assert/strict';
import { parseManifest, withRetries, mergeIndex, entryFor, orbitPose } from '../tools/preview-clips.mjs';
import { validateVerdict, latestRound } from '../tools/critic-verdict.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// manifest defaults and errors
const m = parseManifest({ key: '370', clips: [{ id: 'hall-classic', scene: 'hall', q: 'world=hall', theme: 'classic', de: 'x' }, { id: 'space', q: 'world=space' }] });
assert.equal(m.clips[0].seconds, 4); assert.deepEqual(m.clips[0].size, [480, 320]); assert.equal(m.clips[0].phone, true);
assert.equal(m.clips[1].scene, 'space'); assert.equal(m.clips[1].variant, 'space');
assert.throws(() => parseManifest({ key: '1', clips: [] }), /non empty/);
assert.throws(() => parseManifest({ clips: [{ id: 'a', q: '' }] }), /key is required/);
assert.throws(() => parseManifest({ key: '1', clips: [{ id: 'a', q: '' }, { id: 'a', q: '' }] }), /duplicate/);
assert.throws(() => parseManifest({ key: '1', clips: [{ id: 'a' }] }), /needs q/);

// retries: a crash on the first attempts retries, the run completes; all tries failing resolves (never throws)
let calls = 0;
const r1 = await withRetries(async (a) => { calls++; if (a < 3) throw new Error('boom'); return 'ok'; }, { tries: 3 });
assert.deepEqual([r1.ok, r1.value, r1.attempts, calls], [true, 'ok', 3, 3]);
const seen = [];
const r2 = await withRetries(async () => { throw new Error('always'); }, { tries: 3, onFail: (e, a) => seen.push(a) });
assert.deepEqual([r2.ok, r2.attempts, seen], [false, 3, [1, 2, 3]]);

// index format of the night lane scripts, merged by file
const e1 = entryFor(m.clips[0], { file: 'hall-classic.mp4', poster: 'hall-classic.png', kind: 'clip', de: 'x', seconds: 4, attempts: 2 });
for (const k of ['file', 'poster', 'kind', 'variant', 'theme', 'flag', 'de']) assert.ok(k in e1, `index entry has ${k}`);
assert.equal(e1.flag, '?world=hall'); assert.equal(e1.tries, 2);
const idx = mergeIndex([], [e1]); mergeIndex(idx, [{ ...e1, tries: 1 }]);
assert.equal(idx.length, 1); assert.equal(idx[0].tries, 1);
const p0 = orbitPose(m.clips[0], 0), p1 = orbitPose(m.clips[0], 1);
assert.ok(p1.yaw > p0.yaw && Math.abs(p0.dist - 22) < 1e-9);

// critic verdict files
const ok = { lane: 'che-370-world-menu', key: 'CHE-370', round: 1, critic: 'opus', date: '2026-10-09T08:00:00Z', variants: [
  { id: 'hall', label: 'Fackelhalle', score: 9, rank: 1, fixed: ['Hund'], deferred: [], pros: ['nah an grossartig'], cons: [], pref: true, why: 'stark' },
  { id: 'lava', score: 7, rank: 2, fixed: [], deferred: ['Handy hochkant'], pros: [], cons: ['keine Lavafaelle'], pref: false }] };
assert.deepEqual(validateVerdict(ok), []);
assert.deepEqual(validateVerdict(ok, { clipVariants: ['hall', 'lava'] }), []);
assert.match(validateVerdict(ok, { clipVariants: ['hall', 'zen'] }).join('|'), /no verdict for clip variant zen/);
const bad = (mut, re) => { const v = structuredClone(ok); mut(v); assert.match(validateVerdict(v).join('|'), re); };
bad((v) => { v.variants[0].score = 11; }, /score: integer 1 to 10/);
bad((v) => { v.variants[1].rank = 1; }, /used twice/);
bad((v) => { v.variants[1].score = 9; v.variants[1].rank = 2; v.variants[0].score = 7; }, /higher score/);
bad((v) => { delete v.variants[0].pref; }, /pref/);
bad((v) => { v.variants[0].pros = [3]; }, /pros/);
bad((v) => { v.key = '370'; }, /key/);
bad((v) => { v.variants = []; }, /variants/);
assert.deepEqual(validateVerdict(null), ['not an object']);
const dir = mkdtempSync(join(tmpdir(), 'critic-'));
try {
  assert.equal(latestRound(dir), null);
  for (const n of [1, 2, 10]) writeFileSync(join(dir, `round-${n}.json`), '{}');
  writeFileSync(join(dir, 'round-x.json'), '{}');
  assert.equal(latestRound(dir), join(dir, 'round-10.json'));
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('preview clips and critic verdict tests ok');
