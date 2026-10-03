// Adaptive quality governor: steps the quality tier down when frames are slow, never up, and locks. Pure core: no DOM, no
// renderer. main.js calls feed(frameMs) once per rendered frame and acts on onStep(level); see docs/ARCHITECTURE.md.
//
// A window is DEFAULTS.window frames. Its median frame time decides:
//   over hardMs               one window is enough to step down
//   over slowMs               a step down after this happens in 2 consecutive windows
//   under fastMs, from the    the device is fine: lock (stop measuring)
//   3rd window on
// A median between capLo and hardMs in 2 windows is what Low Power Mode and thermal caps look like (iOS caps the frame rate near
// 30 fps, so every window measures about 33 ms). iOS Safari has no API for either, so they are detected by this effect only, and
// that case is just the slowMs rule. At most maxSteps steps per session; the last level locks at once.
// Frames do not count while the adapter is held (the first warmMs after arm(), after a step, after a gap such as a hidden tab,
// or while hold() is active) and when the caller passes skip (tab hidden, a theme or texture build running).

export const DEFAULTS = {
  window: 90,        // frames per judged window
  warmMs: 2000,      // settle time after arm(), after a step and after a gap
  slowMs: 24,        // median above this (under about 41 fps) in 2 consecutive windows steps down
  hardMs: 40,        // median above this in a single window steps down
  fastMs: 20,        // median under this, from minWindows on, locks
  minWindows: 3,     // windows judged in total before a fast one may lock
  slowWindows: 2,    // consecutive slow windows that make a step
  maxSteps: 2,       // steps down per session
  gapMs: 1000,       // one frame longer than this is a gap (hidden tab, suspended page): not measured, and warmMs of settling follows
  capLo: 28,         // documentation of the frame rate cap band: capLo to hardMs (about 33 ms, 30 fps) is also over slowMs
};

/** createAdapter({ levels, start, onStep, now, opts }) -> { arm, feed, hold, lock, setLevel, state } */
export function createAdapter({ levels = ['high', 'medium', 'low'], start, onStep = () => {}, now = () => performance.now(), opts = {} } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const buf = new Float32Array(o.window), scratch = new Float32Array(o.window);   // allocated once: no allocation per frame
  let level = Math.max(0, levels.indexOf(start)), n = 0, windows = 0, slowRun = 0, steps = 0;
  let armed = false, locked = level >= levels.length - 1, holdUntil = 0, why = locked ? 'last level' : '';
  let lastMedian = 0;

  const median = () => {
    scratch.set(buf);
    scratch.sort();   // numeric for typed arrays, in place
    return (scratch[(o.window >> 1) - 1] + scratch[o.window >> 1]) / 2;
  };
  const lock = (reason = 'locked') => { if (!locked) { locked = true; why = reason; } };
  const reset = () => { n = 0; slowRun = 0; };
  const stepDown = (reason) => {
    level++; steps++; reset();
    holdUntil = now() + o.warmMs;
    if (steps >= o.maxSteps || level >= levels.length - 1) lock(steps >= o.maxSteps ? 'max steps' : 'last level');
    onStep(levels[level], reason);
  };
  const judge = (m) => {
    lastMedian = m; windows++; n = 0;
    if (m > o.hardMs) return stepDown(`median ${m.toFixed(1)} ms`);
    if (m > o.slowMs) { if (++slowRun >= o.slowWindows) stepDown(`median ${m.toFixed(1)} ms in ${slowRun} windows`); return; }
    slowRun = 0;
    if (m < o.fastMs && windows >= o.minWindows) lock('stable');
  };

  return {
    /** The start sequence is over: the warm up starts now. Frames before arm() are ignored. */
    arm() { if (!armed) { armed = true; holdUntil = now() + o.warmMs; } },
    /** One rendered frame, in ms. skip: the tab is hidden or a build runs (the frame is not measured). */
    feed(frameMs, skip = false) {
      if (locked || !armed) return;
      if (skip || !(frameMs > 0)) return;
      if (frameMs > o.gapMs) { n = 0; holdUntil = now() + o.warmMs; return; }   // a gap: the window in progress is not trustworthy
      if (now() < holdUntil) return;
      buf[n++] = frameMs;
      if (n === o.window) judge(median());
    },
    /** Do not measure for ms (a theme or texture build, a quality change by someone else). */
    hold(ms = o.warmMs) { holdUntil = Math.max(holdUntil, now() + ms); n = 0; },
    /** Stop measuring for good (the user chose a quality). */
    lock,
    /** The tier was changed from outside: follow it (and the window in progress is void). */
    setLevel(q) { const i = levels.indexOf(q); if (i >= 0) { level = i; reset(); if (i >= levels.length - 1) lock('last level'); } },
    state: () => ({ level: levels[level], locked, why, steps, windows, frames: n, slowRun, lastMedian, armed, holding: now() < holdUntil }),
  };
}
