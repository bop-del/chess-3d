// Agent identity prepend of bin/lane agent (tools/lane-identity.mjs, CHE-104). Fast tier, no Herdr, a fake identity file.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentId, agentPrompt, briefMode } from '../tools/lane-identity.mjs';

const dir = mkdtempSync(join(tmpdir(), 'lane-identity-'));
try {
  const id = join(dir, 'builder.md'), none = join(dir, 'missing.md');
  const plain = join(dir, 'plain.md'), eng = join(dir, 'eng.md');
  writeFileSync(id, '# Who you are\nYou build chess-3d.\n');
  writeFileSync(plain, '# CHE-1 brief\nPrivate repo: no\n');
  writeFileSync(eng, '# CHE-2 brief\nMode: engineer\nPrivate repo: yes\n');
  const base = 'You are the "builder" agent of lane che-1-x.';

  // file present: the prompt starts with it, then the mode line, then the unchanged base prompt
  const p = agentPrompt(base, plain, id);
  assert.ok(p.startsWith('# Who you are\nYou build chess-3d.\n\nMode for this brief: builder.\n\n'), p);
  assert.ok(p.endsWith(base));
  // file missing: the prompt is unchanged (the public repo works alone)
  assert.equal(agentPrompt(base, plain, none), base);
  // an empty file counts as missing
  writeFileSync(join(dir, 'empty.md'), '\n');
  assert.equal(agentPrompt(base, plain, join(dir, 'empty.md')), base);
  // Mode: line read from the brief
  assert.match(agentPrompt(base, eng, id), /\nMode for this brief: engineer\.\n\nYou are the "builder"/);
  assert.equal(briefMode('Mode: Engineer'), 'engineer');
  assert.equal(briefMode('mode:builder'), 'builder');
  assert.equal(briefMode('no line here'), 'builder');
  assert.equal(briefMode('Mode: wizard'), 'builder');
  // land and merge agents start through the same function with their generated brief, so they get it too
  assert.ok(agentPrompt('You are the "land" agent of lane che-1-x.', plain, id).startsWith('# Who you are'));
  // bin/lane agent sends the prompt through agentPrompt with the brief
  assert.match(readFileSync(new URL('../bin/lane', import.meta.url), 'utf8'), /const text = agentPrompt\(prompt, brief\);[\s\S]*sendKickoff\(\{ id, text,[\s\S]*\['agent', 'prompt', id, t\]/);
  // CHE-318: agent ids are at most 32 characters, the role whole, the lane part cut on a hyphen and hashed when cut
  assert.equal(agentId('che-1-x', 'builder'), 'che-1-x-builder');
  assert.equal(agentId('abcdefghijklmnopqrst', 'builder'), 'abcdefghijklmnopqrst-builder');   // 20 character branch fits
  const real = agentId('che-308-black-symbols-180', 'builder');   // the real failure: 33 characters
  assert.ok(real.length <= 32 && real.endsWith('-builder') && /^che-308-black-[0-9a-f]{4}-builder$/.test(real), real);
  const a = agentId('che-308-black-symbols-180-left', 'builder'), b = agentId('che-308-black-symbols-180-right', 'builder');
  assert.notEqual(a, b);
  const l1 = 'che-111-aaaaaaaaaaaaaaaaaaaaaaaa-one', l2 = 'che-111-aaaaaaaaaaaaaaaaaaaaaaaa-two';   // equal first 30 characters
  assert.equal(l1.slice(0, 30), l2.slice(0, 30));
  assert.notEqual(agentId(l1, 'builder'), agentId(l2, 'builder'));
  for (const role of ['builder', 'land', 'release', 'a'.repeat(20)]) for (const br of [l1, 'che-308-black-symbols-180', 'x'.repeat(60)]) {
    const id = agentId(br, role); assert.ok(id.length <= 32 && id.endsWith(`-${role}`), id);
  }
  assert.equal(agentId('che-308-black-symbols-180', 'land'), 'che-308-black-symbols-180-land');   // fits: unchanged
  assert.match(agentId('che-308-black-symbols-180-more-words', 'release'), /-[0-9a-f]{4}-release$/);
  assert.equal(agentId(l1, 'land'), agentId(l1, 'land'));   // stable
  const lane = readFileSync(new URL('../bin/lane', import.meta.url), 'utf8');
  assert.match(lane, /name.length > MAX_ROLE\) die/);
  assert.match(lane, /withAgent.name.length > MAX_ROLE\) die/);
  assert.match(lane, /const id = agentId\(branch, name\)/);
  assert.match(lane, /node \$\{h\} \$\{branch\} \$\{name\} \$\{id\}/);

  // CHE-316: the builder sends its report once; the Stop hook file is delivered by the board loop, so no retry sentence
  const laneSrc = readFileSync(new URL('../bin/lane', import.meta.url), 'utf8');
  assert.ok(!/retry every 2 minutes/.test(laneSrc), 'agent prompt must not tell the builder to retry');
  assert.match(laneSrc, /Send the report once with herdr agent prompt; if it is refused or the lead is busy, stop: the Stop hook has the report file/);
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('lane identity tests ok');
