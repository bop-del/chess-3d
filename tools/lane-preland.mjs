// bin/lane preland (CHE-311): the builder's last step before it reports. Merge main into the lane, run the fast tier and the
// lane's affected smoke groups on the merged tree, write .tmp/preland.json. Land (private bin/land-lane) merges the same main and
// runs the same tiers, so a green preland on the same tree makes its smoke groups print CACHED (result cache keyed by build and scripts).
// Why this exists: CHE-300 and CHE-291 passed in their lanes on the tree from before main moved; land merged main and ran the groups on
// the merged tree, where the music group went red (a favicon 404 check in test/music-page.mjs, then "killed quiet child" under load).
// Pure parts (parsePrelandArgs, stampOk) and prelandRun with injected io, so the fast tier drives it with a temp git repo.
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const STAMP = join('.tmp', 'preland.json');

// args after `preland`: [<branch>] [--all] [--no-cache]. Throws Error('usage').
export function parsePrelandArgs(args) {
  const out = { branch: null, all: false, noCache: false };
  for (const a of args) {
    if (a === '--all') out.all = true;
    else if (a === '--no-cache') out.noCache = true;
    else if (a.startsWith('-') || out.branch) throw new Error('usage');
    else out.branch = a;
  }
  return out;
}

const tail = (s, n = 6) => String(s).trim().split('\n').slice(-n).join(' | ');

// the stamp is valid for the tree it was written for: green, smoke ran, and HEAD is the stamped commit
export function stampOk(stamp, head) {
  return !!stamp && stamp.ok === true && stamp.smoke === true && !!head && stamp.head === head;
}
export function readStamp(dir) { try { return JSON.parse(readFileSync(join(dir, STAMP), 'utf8')); } catch (e) { return null; } }

// io: { sh(cmd, args, {cwd, shell}) -> {status, out}, fast, smoke, privateMerge?() -> {ok, moved, files?, out?}, privateDir? (the private worktree path, for its tests), privateTests?, now() }
// -> { ok, kind: 'green'|'red'|'conflict'|'dirty', line, detail? }. Never throws for a failed step.
export function prelandRun({ dir, branch, io, all = false, noCache = false }) {
  const sh = (cmd, args, o = {}) => io.sh(cmd, args, { cwd: dir, ...o });
  const git = (...a) => sh('git', a);
  const done = (ok, kind, line, detail) => ({ ok, kind, line, detail });
  if (git('status', '--porcelain').out.trim()) return done(false, 'dirty', 'dirty: commit the lane first (git add -A && git commit -m WIP), then run preland again');
  let moved = false;
  if (git('merge-base', '--is-ancestor', 'main', 'HEAD').status !== 0) {
    const m = git('merge', 'main', '-m', `Merge main into ${branch}`);
    if (m.status !== 0) {
      const files = git('diff', '--name-only', '--diff-filter=U').out.split('\n').filter(Boolean);
      git('merge', '--abort');
      return done(false, 'conflict', `conflict: ${files.length ? files.join(', ') : tail(m.out, 2)}`);
    }
    moved = true;
  }
  if (io.privateMerge) {   // the lane's private worktree: its WIP committed (never the live files), private main merged in (bin/private-lane wip, merge-main)
    const pm = io.privateMerge();
    if (!pm.ok) return done(false, 'conflict', `conflict: private: ${pm.files && pm.files.length ? pm.files.join(', ') : tail(pm.out || '', 2)}`);
    moved = moved || !!pm.moved;
  }
  const head = git('rev-parse', 'HEAD').out.trim();
  const stamp = (extra) => { try { mkdirSync(join(dir, '.tmp'), { recursive: true }); writeFileSync(join(dir, STAMP), JSON.stringify({ branch, head, t: io.now(), ...extra })); } catch (e) { /* the gate then asks for a rerun */ } };
  const f = sh(io.fast, [], { shell: true });
  if (f.status) { stamp({ ok: false, smoke: false, red: 'fast tier' }); return done(false, 'red', 'red: fast tier', tail(f.out)); }
  const smoke = `${io.smoke}${all ? ' --all' : ''}${noCache ? ' --no-cache' : ''}`;
  const s = sh(smoke, [], { shell: true });
  if (s.status) { stamp({ ok: false, smoke: false, red: 'smoke groups' }); return done(false, 'red', 'red: smoke groups', tail(s.out)); }
  if (io.privateDir && io.privateTests) {
    const changed = io.sh('git', ['diff', '--name-only', 'main...HEAD'], { cwd: io.privateDir }).out.split('\n').filter(Boolean);
    if (changed.some((p) => /^(bin|lib)\//.test(p) || /^test-.*\.mjs$/.test(p))) {
      const t = io.sh(io.privateTests, [], { cwd: io.privateDir, shell: true });
      if (t.status) { stamp({ ok: false, smoke: false, red: 'private tests' }); return done(false, 'red', 'red: private tests', tail(t.out)); }
    }
  }
  stamp({ ok: true, smoke: true });
  return done(true, 'green', `preland green: main ${moved ? 'merged' : 'already in'}, fast tier and affected smoke groups pass on ${head.slice(0, 7)}`);
}

/** CHE-341: a lane gets server/node_modules (jose) linked from the main checkout, like node_modules. Returns 'linked', 'present', 'no-server' (the lane has no server/package.json) or 'missing-main' (hint for the caller). */
export function linkServerModules(laneDir, mainDir) {
  if (!existsSync(join(laneDir, 'server', 'package.json'))) return 'no-server';
  const nm = join(laneDir, 'server', 'node_modules');
  try { lstatSync(nm); return 'present'; } catch (e) { /* not there */ }
  const src = join(mainDir, 'server', 'node_modules');
  if (!existsSync(src)) return 'missing-main';
  symlinkSync(src, nm);
  return 'linked';
}
export const SERVER_MODULES_HINT = 'server/node_modules is missing in the main checkout: run npm ci in server/ of the main checkout (test/auth-spike.mjs needs jose)';
