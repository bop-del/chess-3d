// Synthesised sound for moves and battle scenes (WebAudio through src/audio.js, no audio files).
//
//   sfx.play(name, { at, volume, pitch })     at = seconds from now, so a scene can lay a whole soundtrack out when it starts
//   sfx.whoosh(opts) ... sfx.magic(opts)      the same, one method per voice
//   sfx.stop()                                skip: fades the scene bus out (the director calls it when a scene is skipped)
//   sfx.sceneActive                           the director sets it while a scene runs: the plain capture thud stays silent then
//   sfx.hook(game)                            move, capture and check sounds through game.onMove (landing time of the slide)
//
// Scene voices: whoosh swing clang slice splat crack shatter thud magic. They run through a small per voice bus (src/audio-kit.js: compressor, generated reverb), the reverb impulse is built on the first scene, not at load.
// Game voices: move capture check chime. The scenes lean on slice, splat, crack, shatter, clang. Every voice returns its length in seconds. Pitch scales every frequency in it.
import { audio, tone as T, noise as N } from '../audio.js';
import { bus, modal, snap, fm, PARTIALS as P } from '../audio-kit.js';

const VOICES = {
  // ---- the game ----
  move(e) {   // a marble foot set on wood
    T(e, { t: e.t, dur: 0.1, vol: 0.2, type: 'sine', f0: 230, f1: 120, sweep: 0.8 });
    N(e, { t: e.t, dur: 0.05, vol: 0.09, type: 'bandpass', f0: 1700, q: 1.2 });
    return 0.15;
  },
  capture(e) {   // a heavier knock and a bright click
    T(e, { t: e.t, dur: 0.22, vol: 0.34, type: 'sine', f0: 170, f1: 60, sweep: 0.7 });
    N(e, { t: e.t, dur: 0.09, vol: 0.18, type: 'bandpass', f0: 2300, q: 1 });
    T(e, { t: e.t + 0.01, dur: 0.12, vol: 0.06, type: 'triangle', f0: 1250, f1: 900 });
    return 0.3;
  },
  check(e) {   // two rising pings
    T(e, { t: e.t, dur: 0.22, vol: 0.14, type: 'sine', f0: 880 });
    T(e, { t: e.t + 0.1, dur: 0.34, vol: 0.14, type: 'sine', f0: 1175 });
    T(e, { t: e.t + 0.1, dur: 0.2, vol: 0.04, type: 'triangle', f0: 2350 });
    return 0.45;
  },

  chime(e) {   // the puzzle reward: three bright rising bell notes (a major triad), the last one rings
    [1568, 1976, 2349].forEach((f, i) => {
      const t0 = e.t + i * 0.085, ring = i === 2 ? 0.75 : 0.28;
      T(e, { t: t0, dur: ring, vol: 0.12, type: 'sine', f0: f });
      T(e, { t: t0, dur: ring * 0.55, vol: 0.035, type: 'triangle', f0: f * 2.01 });
      T(e, { t: t0, dur: ring * 0.3, vol: 0.012, type: 'sine', f0: f * 3.02 });
    });
    return 1.0;
  },

  // ---- the nine scene voices: the owner's picks from the sfx lab (CHE-261). Each draws through its own bus() (compressor, soft room), scene bus only ----
  whoosh(e) {   // a wide gust in a room
    const b = bus(e, { wet: 0.3, room: 0.3, dark: 0.7 });
    N(b, { t: e.t, dur: 0.5, vol: 0.34, type: 'bandpass', f0: 250, f1: 1300, q: 0.6, a: 0.22 });
    N(b, { t: e.t + 0.2, dur: 0.3, vol: 0.12, type: 'bandpass', f0: 1300, f1: 300, q: 0.6, a: 0.05, buf: 'brown' });
    return 0.48 + b.tail * 0.4;
  },

  swing(e) {
    const b = bus(e, { comp: 3 });
    N(b, { t: e.t, dur: 0.12, vol: 0.2, type: 'highpass', f0: 2000, f1: 7500, a: 0.05 });
    snap(b, { t: e.t + 0.1, vol: 0.09, hp: 5000, len: 0.02 });
    return 0.2;
  },

  clang(e) {   // five quick links rattling, then a short settle
    const b = bus(e, { wet: 0.12, room: 0.2 });
    for (let i = 0; i < 6; i++) {
      const t0 = e.t + i * (0.028 + e.r() * 0.02);
      modal(b, { t: t0, f: 1700 + e.r() * 900, parts: P.bar, dec: 0.2 + e.r() * 0.1, vol: 0.12 * (1 - i * 0.1) });
      N(b, { t: t0, dur: 0.02, vol: 0.12, type: 'highpass', f0: 4000 });
    }
    N(b, { t: e.t + 0.1, dur: 0.3, vol: 0.05, type: 'bandpass', f0: 3200, f1: 2200, q: 2, a: 0.04 });
    return 0.5 + b.tail;
  },

  slice(e) {   // a swish and a soft thunk at the end
    const b = bus(e, { comp: 3 });
    N(b, { dur: 0.1, vol: 0.22, type: 'bandpass', f0: 700, f1: 3800, q: 1.5, a: 0.05 });
    T(b, { t: e.t + 0.07, dur: 0.12, vol: 0.2, type: 'sine', f0: 170, f1: 70, sweep: 0.8 });
    N(b, { t: e.t + 0.07, dur: 0.06, vol: 0.12, type: 'lowpass', f0: 1400, f1: 300, buf: 'brown' });
    return 0.22;
  },

  splat(e) {   // a thick body and bubbles popping up
    const b = bus(e, { wet: 0.12, room: 0.2, comp: 3 });
    T(b, { dur: 0.25, vol: 0.26, type: 'sine', f0: 120, f1: 50, sweep: 0.8 });
    N(b, { dur: 0.16, vol: 0.14, type: 'lowpass', f0: 900, f1: 150, a: 0.004 });
    let t0 = e.t + 0.06;
    for (let i = 0; i < 6; i++) {
      const f = 160 + e.r() * 260;
      T(b, { t: t0, dur: 0.05 + e.r() * 0.04, vol: 0.1, type: 'sine', f0: f, f1: f * 2.2, sweep: 0.9, a: 0.004 });
      t0 += 0.03 + e.r() * 0.07;
    }
    return Math.min(0.6, t0 - e.t + 0.08) + b.tail * 0.5;
  },

  crack(e) {   // a long splitting tear, dark
    const b = bus(e, { wet: 0.2, room: 0.3, dark: 0.7, comp: 4 });
    N(b, { dur: 0.32, vol: 0.34, type: 'lowpass', f0: 5000, f1: 300, q: 0.7, a: 0.005 });
    snap(b, { vol: 0.2, hp: 2200 });
    T(b, { dur: 0.3, vol: 0.26, type: 'sine', f0: 90, f1: 45, sweep: 0.8 });
    return 0.38 + b.tail * 0.6;
  },

  shatter(e) {   // heavy chunks falling and dust
    const b = bus(e, { wet: 0.2, room: 0.35, dark: 0.7, comp: 4 });
    snap(b, { vol: 0.28, hp: 1800, body: 0.35, bodyF: 80 });
    for (let i = 0; i < 6; i++) { const t0 = e.t + 0.08 + Math.pow(e.r(), 1.3) * 0.6; modal(b, { t: t0, f: 180 + e.r() * 260, parts: P.stone, dec: 0.2, vol: 0.14 }); N(b, { t: t0, dur: 0.05, vol: 0.1, type: 'lowpass', f0: 1400, f1: 300 }); }
    N(b, { t: e.t + 0.2, dur: 0.6, vol: 0.1, type: 'lowpass', f0: 1200, f1: 150, buf: 'brown' });
    return 1.0 + b.tail * 0.3;
  },

  thud(e) {
    const b = bus(e, { wet: 0.18, room: 0.25, dark: 0.8, comp: 4 });
    T(b, { dur: 0.32, vol: 0.4, type: 'sine', f0: 72, f1: 32, sweep: 0.85, a: 0.004 });
    modal(b, { f: 130, parts: P.stone, dec: 0.17, vol: 0.12 });
    snap(b, { vol: 0.1, hp: 1200, len: 0.03 });
    N(b, { dur: 0.1, vol: 0.12, type: 'lowpass', f0: 700, f1: 120, buf: 'brown' });
    return 0.36 + b.tail * 0.4;
  },

  magic(e) {   // an FM shimmer that climbs
    const b = bus(e, { wet: 0.25, room: 0.4, dark: 0.4 });
    fm(b, { dur: 0.6, vol: 0.09, f: 700, ratio: 1.5, index: 2.2, a: 0.1 });
    T(b, { dur: 0.6, vol: 0.05, type: 'sine', f0: 900, f1: 2800, sweep: 0.9, a: 0.1, wobble: [7, 30] });
    for (let i = 0; i < 6; i++) fm(b, { t: e.t + 0.15 + i * 0.07, dur: 0.18, vol: 0.05, f: 2200 + i * 380, ratio: 2.01, index: 1.5 });
    return 0.75 + b.tail * 0.3;
  },
};

// Level match (CHE-261): the nine scene voices are trimmed so their RMS over the audible part sits within 3 dB of each other
// (test/sfx-voices.mjs measures it through the real bus). A gain on e.v, so it works before the voice's own compressor.
const TRIM = { whoosh: 3.2, swing: 1, clang: 1, slice: 0.7, splat: 0.72, crack: 0.66, shatter: 0.63, thud: 0.4, magic: 1.6 };
for (const [n, g] of Object.entries(TRIM)) { const raw = VOICES[n]; VOICES[n] = (e) => raw({ ...e, v: e.v * g }); }

const SCENE_VOICES = new Set(['whoosh', 'swing', 'clang', 'slice', 'splat', 'crack', 'shatter', 'thud', 'magic']);

export const sfx = {
  names: Object.keys(VOICES),
  voices: VOICES,
  _scene: false,
  get sceneActive() { return this._scene; },
  /** While a battle scene runs the background music stays ducked low. */
  set sceneActive(on) {
    this._scene = !!on;
    if (on) audio.duckMusic(0.2, 600); else audio.duckMusic(1);
  },
  /** Play a voice by name. Scene voices go to the scene bus (skippable), game voices to the fx bus. Returns its length or null. */
  play(name, opts = {}) {
    const v = VOICES[name];
    if (!v) return null;
    return audio.play(v, { ...opts, bus: SCENE_VOICES.has(name) ? 'scene' : 'fx', name });
  },
  stop() { audio.stopScene(); },
  /** Move, capture and check sounds. A move sounds when the slide lands. Safe to call once. */
  hook(game) {
    audio.init();
    game.onMove((rec) => {
      const m = rec.m;
      const dist = Math.hypot((m.to & 7) - (m.from & 7), (m.to >> 3) - (m.from >> 3));
      const land = (m.piece === 'n' ? 0.8 : 0.4 + 0.07 * dist) * 1000;
      setTimeout(() => {
        if (m.captured) { if (!this.sceneActive) this.play('capture'); } else this.play('move');
        if (/[+#]$/.test(rec.san || '')) setTimeout(() => this.play('check'), 140);
      }, land);
    });
  },
};
for (const n of Object.keys(VOICES)) sfx[n] = (opts) => sfx.play(n, opts);
export default sfx;
