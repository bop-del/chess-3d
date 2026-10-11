// Flake ledger (tools/flakes.mjs, CHE-431): failing check names, ledger lines, the 14 day window, the preland red detail. Fast tier, temp files only.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkName, failingChecks, flakeCounts, readFlakes, recordFlake } from '../tools/flakes.mjs';
import { redDetail } from '../tools/lane-preland.mjs';

const out = ['PASS  a', 'FAIL  puzzles  retry card missing', '      FAIL  puzzles  retry card missing', 'FAIL  group x ended with exit 1 and no FAIL row', 'FAIL  clock  tick', 'WARN  w'].join('\n');
assert.deepEqual(failingChecks(out), ['FAIL puzzles retry card missing', 'FAIL clock tick']);
assert.equal(checkName(out, 'Target closed'), 'puzzles retry card missing');
assert.equal(checkName('Error: Target closed', 'Target closed'), 'Target closed');
assert.equal(checkName('', ''), 'unknown');
assert.match(redDetail(out), /^failing checks: FAIL puzzles retry card missing \| FAIL clock tick\n/);
assert.equal(redDetail('boom\nbang'), 'boom | bang');

const dir = mkdtempSync(join(tmpdir(), 'flakes-')), file = join(dir, '.tmp', 'flakes.jsonl');
try {
  assert.deepEqual(readFlakes(file), []);
  const now = new Date('2026-10-10T12:00:00Z'), at = (d) => new Date(now.getTime() - d * 864e5);
  recordFlake({ group: 'views', check: 'orbit ready', reason: 'Target closed' }, { file, now: at(1) });
  recordFlake({ group: 'views', check: 'orbit ready', reason: 'Target closed' }, { file, now: at(3) });
  recordFlake({ group: 'views', check: 'orbit ready', reason: 'Target closed' }, { file, now: at(20) });
  recordFlake({ group: 'open', check: 'menu', reason: 'frame got detached' }, { file, now: at(2) });
  writeFileSync(file, readFileSync(file, 'utf8') + 'not json\n');
  const all = readFlakes(file); assert.equal(all.length, 4);
  const c = flakeCounts(all, { now });
  assert.deepEqual(c.map((r) => [r.group, r.check, r.count]), [['views', 'orbit ready', 2], ['open', 'menu', 1]]);   // the 20 day old one is outside the window
  assert.equal(c[0].last, at(1).toISOString());
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log('flake ledger tests ok');
