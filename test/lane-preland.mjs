// bin/lane preland (tools/lane-preland.mjs, CHE-311): argument handling, and the merge / tier / stamp logic against a temp git repo
// with fake test commands. Fast tier, no Herdr, no Chrome.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, lstatSync } from 'node:fs';
import { parsePrelandArgs as P, prelandRun, readStamp, stampOk, linkServerModules } from '../tools/lane-preland.mjs';

const bad = (a) => assert.throws(() => P(a), /usage/);
assert.deepEqual(P([]), { branch: null, all: false, noCache: false });
assert.deepEqual(P(['che-1-x']), { branch: 'che-1-x', all: false, noCache: false });
assert.deepEqual(P(['--all', 'che-1-x', '--no-cache']), { branch: 'che-1-x', all: true, noCache: true });
bad(['a', 'b']); bad(['--fast-only']); bad(['-m', 'x']);

const tmp = mkdtempSync(join(tmpdir(), 'preland-'));
try {
  const sh = (cmd, args, { cwd, shell = false } = {}) => { const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell }); return { status: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}` }; };
  const g = (dir, ...a) => { const r = sh('git', a, { cwd: dir }); assert.equal(r.status, 0, r.out); return r.out.trim(); };
  const repo = join(tmp, 'main'), lane = join(tmp, 'lane');
  g(tmp, 'init', '-q', '-b', 'main', repo);
  for (const [k, v] of [['user.email', 't@t'], ['user.name', 't']]) g(repo, 'config', k, v);
  writeFileSync(join(repo, 'a.txt'), '1\n'); writeFileSync(join(repo, '.gitignore'), '.tmp\n'); g(repo, 'add', '-A'); g(repo, 'commit', '-qm', 'one');
  g(repo, 'worktree', 'add', '-q', '-b', 'che-1-x', lane);
  writeFileSync(join(lane, 'b.txt'), 'lane\n'); g(lane, 'add', '-A'); g(lane, 'commit', '-qm', 'lane work');
  let calls = [];
  const io = (fast, smoke) => ({ sh: (c, a, o) => { if (o && o.shell) calls.push(c); return sh(c, a, o); }, fast, smoke, now: () => 42 });
  const run = (fast, smoke, extra = {}) => { calls = []; return prelandRun({ dir: lane, branch: 'che-1-x', io: io(fast, smoke), ...extra }); };

  // main has not moved: nothing to merge, green, stamp written and valid for HEAD
  let r = run('true', 'true');
  assert.equal(r.ok, true); assert.match(r.line, /^preland green: main already in/); assert.match(r.line, /merge preview: no conflicts expected$/); assert.deepEqual(readStamp(lane).preview, { game: [] });
  assert.equal(stampOk(readStamp(lane), g(lane, 'rev-parse', 'HEAD')), true);
  // --all and --no-cache reach the smoke command
  run('true', 'echo smoke', { all: true, noCache: true }); assert.deepEqual(calls, ['true', 'echo smoke --all --no-cache']);

  // main moved: merged, tiers run on the merged tree, the stamp follows the new HEAD
  writeFileSync(join(repo, 'c.txt'), 'main\n'); g(repo, 'add', '-A'); g(repo, 'commit', '-qm', 'main moves');
  const before = g(lane, 'rev-parse', 'HEAD');
  r = run('test -f c.txt', 'test -f c.txt');
  assert.equal(r.ok, true); assert.match(r.line, /main merged/); assert.notEqual(g(lane, 'rev-parse', 'HEAD'), before);
  assert.equal(stampOk(readStamp(lane), before), false, 'the old head no longer matches'); assert.equal(stampOk(readStamp(lane), g(lane, 'rev-parse', 'HEAD')), true);

  // red fast tier: no smoke run, stamp not ok, detail kept
  r = run('echo boom; exit 1', 'echo never'); assert.equal(r.kind, 'red'); assert.equal(r.line, 'red: fast tier'); assert.match(r.detail, /boom/); assert.deepEqual(calls, ['echo boom; exit 1']);
  assert.equal(stampOk(readStamp(lane), g(lane, 'rev-parse', 'HEAD')), false);
  r = run('true', 'echo music failed; exit 1'); assert.equal(r.line, 'red: smoke groups'); assert.match(r.detail, /music failed/);

  // dirty lane: refused before anything runs
  writeFileSync(join(lane, 'd.txt'), 'x'); r = run('true', 'true'); assert.equal(r.kind, 'dirty'); assert.deepEqual(calls, []); rmSync(join(lane, 'd.txt'));

  // the private worktree: a private conflict stops before any tier, a clean private merge counts as moved and the private tests run only when asked
    calls = []; r = prelandRun({ dir: lane, branch: 'che-1-x', io: { ...io('echo F', 'echo S'), privateMerge: () => ({ ok: false, files: ['lib/a.mjs', 'bin/b'] }) } });
  assert.equal(r.kind, 'conflict'); assert.equal(r.line, 'conflict: private: lib/a.mjs, bin/b'); assert.deepEqual(calls, []);
  r = prelandRun({ dir: lane, branch: 'che-1-x', io: { ...io('true', 'true'), privateMerge: () => ({ ok: true, moved: true }) } }); assert.match(r.line, /main merged/);

  // conflict: merge aborted, lane unchanged, files named
  writeFileSync(join(repo, 'b.txt'), 'main side\n'); g(repo, 'add', '-A'); g(repo, 'commit', '-qm', 'main b');
  const head = g(lane, 'rev-parse', 'HEAD');
  r = run('true', 'true'); assert.equal(r.kind, 'conflict'); assert.equal(r.line, 'conflict: b.txt'); assert.equal(r.detail, 'merge preview: conflicts expected in b.txt'); assert.equal(g(lane, 'rev-parse', 'HEAD'), head); assert.equal(g(lane, 'status', '--porcelain'), '');
  assert.equal(stampOk(null, 'x'), false); assert.equal(existsSync(join(lane, '.tmp')), true);
  // CHE-341: server/node_modules link
  const L = join(tmp, 'l2'), M = join(tmp, 'm2');
  mkdirSync(join(L, 'server'), { recursive: true }); mkdirSync(join(M, 'server'), { recursive: true });
  assert.equal(linkServerModules(L, M), 'no-server');
  writeFileSync(join(L, 'server', 'package.json'), '{}');
  assert.equal(linkServerModules(L, M), 'missing-main');
  mkdirSync(join(M, 'server', 'node_modules'));
  assert.equal(linkServerModules(L, M), 'linked'); assert.equal(lstatSync(join(L, 'server', 'node_modules')).isSymbolicLink(), true);
  assert.equal(linkServerModules(L, M), 'present');
} finally { rmSync(tmp, { recursive: true, force: true }); }
console.log('lane preland tests ok');
