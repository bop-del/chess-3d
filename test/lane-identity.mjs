// Agent identity prepend of bin/lane agent (tools/lane-identity.mjs, CHE-104). Fast tier, no Herdr, a fake identity file.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentPrompt, briefMode } from '../tools/lane-identity.mjs';

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
  assert.match(readFileSync(new URL('../bin/lane', import.meta.url), 'utf8'), /\['agent', 'prompt', id, agentPrompt\(prompt, brief\)\]/);
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('lane identity tests ok');
