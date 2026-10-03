// Adaptive quality governor core (src/adapt.js), fed with frame arrays and a fake clock. No browser.
// Steps down (hard window, two slow windows, the 30 fps cap look), at most two steps, never up, locks when stable or at Low, skipped
// frames (hidden tab, builds, gaps, warm up) do not count, the constants, and no allocation per frame.
import { createAdapter, DEFAULTS } from '../src/adapt.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

// a fake clock that the harness moves one frame at a time; the adapter is armed and its warm up is let pass
function rig({ start = 'high', opts } = {}) {
  let t = 0;
  const steps = [];
  const a = createAdapter({ start, onStep: (l) => steps.push(l), now: () => t, opts });
  a.arm();
  t += DEFAULTS.warmMs + 1;
  const frames = (ms, count, skip = false) => { for (let i = 0; i < count; i++) { a.feed(ms, skip); t += ms; } };
  return { a, steps, frames, advance: (ms) => { t += ms; }, clock: () => t };
}
const W = DEFAULTS.window;

ok('constants', DEFAULTS.window === 90 && DEFAULTS.slowMs === 24 && DEFAULTS.hardMs === 40 && DEFAULTS.fastMs === 20 && DEFAULTS.minWindows === 3 && DEFAULTS.maxSteps === 2 && DEFAULTS.warmMs === 2000 && DEFAULTS.capLo === 28);

{ const r = rig(); r.frames(16, W * 5);
  ok('healthy 16 ms frames: no step, locked after the 3rd window', r.steps.length === 0 && r.a.state().locked && r.a.state().why === 'stable' && r.a.state().windows === 3, JSON.stringify(r.a.state())); }
{ const r = rig(); r.frames(16, W * 2);
  ok('two fast windows are not enough to lock', !r.a.state().locked && r.a.state().windows === 2); }
{ const r = rig(); r.frames(22, W * 6);
  ok('22 ms (between 20 and 24): neither locks nor steps, keeps measuring', r.steps.length === 0 && !r.a.state().locked && r.a.state().windows === 6); }

{ const r = rig(); r.frames(30, W);
  ok('one slow window (30 ms) alone does not step', r.steps.length === 0 && r.a.state().slowRun === 1); }
{ const r = rig(); r.frames(30, W); r.frames(16, W); r.frames(30, W);
  ok('slow, fast, slow: not consecutive, no step', r.steps.length === 0); }
{ const r = rig(); r.frames(30, W * 2);
  ok('two consecutive slow windows (30 ms) step high to medium', r.steps.join() === 'medium' && !r.a.state().locked, r.steps.join()); }
{ const r = rig(); r.frames(45, W);
  ok('a single window over 40 ms steps at once', r.steps.join() === 'medium', r.steps.join()); }
{ const r = rig(); r.frames(33.3, W * 2);
  ok('30 fps cap (Low Power Mode look, 33 ms) in 2 windows steps down', r.steps.join() === 'medium'); }
{ const r = rig(); r.frames(40, W * 2);
  ok('a median of exactly 40 ms is a slow window, not a hard one: needs two', r.steps.length === 1 && r.a.state().windows === 2); }
{ const r = rig(); const a = r.a; for (let i = 0; i < W; i++) a.feed(i % 10 === 0 ? 200 : 16);
  ok('a few spikes do not matter, the median decides', r.steps.length === 0 && Math.abs(a.state().lastMedian - 16) < 1e-6); }

{ const r2 = rig(); r2.frames(45, W); r2.advance(DEFAULTS.warmMs + 1); r2.frames(45, W);
  ok('two steps: high, medium, low in order, then locked', r2.steps.join() === 'medium,low' && r2.a.state().locked && r2.a.state().why === 'max steps' && r2.a.state().level === 'low', r2.steps.join() + JSON.stringify(r2.a.state()));
  r2.frames(45, W * 5);
  ok('after the lock nothing more happens (never up, no third step)', r2.steps.length === 2); }
{ const r = rig({ start: 'medium' }); r.frames(45, W); r.advance(DEFAULTS.warmMs + 1); r.frames(45, W * 3);
  ok('start on medium: one step to low and locked there (the last level)', r.steps.join() === 'low' && r.a.state().locked && r.a.state().why === 'last level'); }
{ const r = rig({ start: 'low' }); r.frames(60, W * 3);
  ok('start on low: locked from the start, never steps', r.steps.length === 0 && r.a.state().locked); }
{ const r = rig({ start: 'medium' }); r.frames(16, W * 3); r.frames(60, W * 3);
  ok('locked as stable: later slow frames never step', r.steps.length === 0 && r.a.state().locked); }
{ const r = rig(); r.frames(45, W); r.frames(10, W * 6);
  ok('never up: fast frames after a step keep the level (medium), lock stable', r.steps.join() === 'medium' && r.a.state().level === 'medium' && r.a.state().locked); }
{ const r = rig(); r.frames(45, W);
  ok('after a step the window restarts: frames in the warm up are not counted', r.a.state().frames === 0 && r.a.state().holding); }

// skipped frames
{ const r = rig(); r.frames(60, W * 3, true);
  ok('skip=true frames (hidden tab, theme build) are not measured', r.steps.length === 0 && r.a.state().windows === 0 && r.a.state().frames === 0); }
{ const r = rig(); r.frames(16, 60); r.frames(80, 300, true); r.frames(16, 30);
  ok('skipped slow frames inside a window do not touch it: 16 ms median, no step', r.steps.length === 0 && r.a.state().windows === 1 && Math.abs(r.a.state().lastMedian - 16) < 1e-6, JSON.stringify(r.a.state())); }
{ const r = rig(); r.frames(16, 50); r.a.feed(5000); r.frames(16, 10);
  ok('a gap (a hidden tab comes back with one 5 s frame) voids the window and holds', r.a.state().frames === 0 && r.a.state().holding && r.steps.length === 0); }
{ const r = rig(); r.frames(16, 40); r.a.hold(); r.frames(50, 30);   // 1.5 s of slow frames inside the hold
  ok('hold(): the window in progress is void and frames during the hold are not measured', r.a.state().windows === 0 && r.a.state().frames === 0 && r.a.state().holding && r.steps.length === 0);
  r.advance(DEFAULTS.warmMs); r.frames(16, 5);
  ok('after the hold it measures again', r.a.state().frames === 5); }
{ let t = 0; const steps = []; const a = createAdapter({ start: 'high', onStep: (l) => steps.push(l), now: () => t });
  for (let i = 0; i < W * 4; i++) { a.feed(60); t += 60; }
  ok('before arm() (the start sequence) nothing is measured', steps.length === 0 && a.state().windows === 0);
  a.arm(); for (let i = 0; i < 30; i++) { a.feed(60); t += 60; }   // 1.8 s
  ok('the first 2 s after arm() are warm up', a.state().windows === 0 && a.state().frames === 0 && a.state().holding);
  for (let i = 0; i < 10; i++) { a.feed(60); t += 60; }
  ok('then it measures', a.state().frames > 0); }

// the user's choice, bad input, other settings
{ const r = rig(); r.frames(45, 40); r.a.lock('user'); r.frames(45, W * 3);
  ok('lock(): a manual quality choice stops everything at once', r.steps.length === 0 && r.a.state().locked && r.a.state().why === 'user'); }
{ const r = rig(); r.a.feed(NaN); r.a.feed(-3); r.a.feed(0); r.a.feed(undefined);
  ok('NaN, zero, negative and missing frame times are ignored', r.a.state().frames === 0); }
{ const r = rig(); r.a.setLevel('low');
  ok('setLevel(low) from outside locks the adapter', r.a.state().locked && r.a.state().level === 'low'); }
{ const r = rig({ opts: { window: 10, maxSteps: 1 } }); r.frames(45, 10);
  ok('opts override the constants (window 10, one step)', r.steps.join() === 'medium' && r.a.state().locked); }
{ const steps = []; let t = 0;
  const a = createAdapter({ levels: ['high', 'medium', 'low'], start: 'ultra', onStep: (l) => steps.push(l), now: () => t });
  ok('an unknown start level is treated as the first', a.state().level === 'high'); }

// no allocation per frame: heap does not grow over a million frames (typed buffers are reused)
{ const r = rig(); const a = r.a;
  if (global.gc) global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 1e6; i++) a.feed(22, false);   // 22 ms never locks and never steps: the loop runs the whole time
  const grown = process.memoryUsage().heapUsed - before;
  ok('no allocation per frame (1e6 frames, heap growth under 2 MB)', grown < 2 * 1024 * 1024, `${(grown / 1024).toFixed(0)} KB`);
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 1e6; i++) a.feed(22, false);
  const perFrame = Number(process.hrtime.bigint() - t0) / 1e6 / 1e6;
  ok('cost per frame under 0.05 ms in node', perFrame < 0.05, `${perFrame.toFixed(5)} ms`); }

console.log(failed ? `\n${failed} adapt check(s) FAILED` : '\nadapt: all checks passed');
process.exit(failed ? 1 : 0);
