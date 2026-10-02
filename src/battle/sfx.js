// Synthesised sound for moves and battle scenes (WebAudio through src/audio.js, no audio files).
//
//   sfx.play(name, { at, volume, pitch })     at = seconds from now, so a scene can lay a whole soundtrack out when it starts
//   sfx.whoosh(opts) ... sfx.magic(opts)      the same, one method per voice
//   sfx.stop()                                skip: fades the scene bus out (the director calls it when a scene is skipped)
//   sfx.sceneActive                           the director sets it while a scene runs: the plain capture thud stays silent then
//   sfx.hook(game)                            move, capture and check sounds through game.onMove (landing time of the slide)
//
// Scene voices: whoosh swing clang slice splat crack shatter thud magic.
// Game voices: move capture check. The scenes lean on slice, splat, crack, shatter, clang. Every voice returns its length in seconds. Pitch scales every frequency in it.
import { audio, tone as T, noise as N } from '../audio.js';

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

  // ---- swings and cuts ----
  whoosh(e) {   // air moved by a swing
    N(e, { t: e.t, dur: 0.38, vol: 0.35, type: 'bandpass', f0: 380, f1: 2600, q: 0.9, a: 0.12 });
    N(e, { t: e.t + 0.18, dur: 0.2, vol: 0.1, type: 'bandpass', f0: 2600, f1: 500, q: 0.9, a: 0.04 });
    return 0.4;
  },
  swing(e) {   // a quick short swish, for a stab or a flick
    N(e, { t: e.t, dur: 0.16, vol: 0.18, type: 'highpass', f0: 1400, f1: 5200, q: 0.7, a: 0.05 });
    return 0.2;
  },
  clang(e) {   // steel on steel: inharmonic partials and a spark of noise
    const base = 620 + e.r() * 90;
    [1, 2.76, 5.4, 8.93].forEach((r, i) => T(e, { t: e.t, dur: 0.9 - i * 0.16, vol: 0.12 / (1 + i * 0.7), type: 'sine', f0: base * r }));
    T(e, { t: e.t, dur: 0.06, vol: 0.08, type: 'square', f0: 3200, f1: 1800 });
    N(e, { t: e.t, dur: 0.05, vol: 0.2, type: 'highpass', f0: 3000 });
    return 0.95;
  },
  slice(e) {   // a blade through something: a fast hiss, a ring and a wet drag
    N(e, { t: e.t, dur: 0.14, vol: 0.24, type: 'highpass', f0: 2500, f1: 7000, a: 0.01 });
    T(e, { t: e.t, dur: 0.25, vol: 0.06, type: 'sine', f0: 3400, f1: 1700, sweep: 0.9 });
    N(e, { t: e.t + 0.05, dur: 0.22, vol: 0.12, type: 'bandpass', f0: 1100, f1: 300, q: 1.2 });
    return 0.35;
  },
  splat(e) {   // wet burst: low body, a spray and a few late drops
    T(e, { t: e.t, dur: 0.3, vol: 0.34, type: 'sine', f0: 140, f1: 45, sweep: 0.8 });
    N(e, { t: e.t, dur: 0.28, vol: 0.28, type: 'lowpass', f0: 1500, f1: 160, q: 0.6 });
    N(e, { t: e.t, dur: 0.12, vol: 0.12, type: 'bandpass', f0: 3200, q: 0.8 });
    for (let i = 0; i < 4; i++) T(e, { t: e.t + 0.12 + e.r() * 0.35, dur: 0.07, vol: 0.09, type: 'sine', f0: 260 + e.r() * 160, f1: 90 });
    return 0.6;
  },
  crack(e) {   // marble or ebony splitting: sharp noise, a stony ring, a low knock
    N(e, { t: e.t, dur: 0.05, vol: 0.3, type: 'highpass', f0: 2200 });
    N(e, { t: e.t + 0.03, dur: 0.12, vol: 0.18, type: 'bandpass', f0: 1500, f1: 700, q: 2 });
    T(e, { t: e.t, dur: 0.35, vol: 0.1, type: 'triangle', f0: 540, f1: 430 });
    T(e, { t: e.t, dur: 0.2, vol: 0.28, type: 'sine', f0: 110, f1: 55, sweep: 0.8 });
    return 0.4;
  },
  shatter(e) {   // a pile of shards: a crack, a rain of tiny tinkles, a dull settle
    VOICES.crack({ ...e, v: e.v * 0.9 });
    for (let i = 0; i < 16; i++) {
      const t0 = e.t + 0.04 + Math.pow(e.r(), 1.6) * 0.7;
      T(e, { t: t0, dur: 0.1 + e.r() * 0.12, vol: 0.05 + e.r() * 0.05, type: 'sine', f0: 1800 + e.r() * 4200, f1: 1500 + e.r() * 1500 });
      if (i % 3 === 0) N(e, { t: t0, dur: 0.04, vol: 0.06, type: 'highpass', f0: 4000 });
    }
    N(e, { t: e.t + 0.3, dur: 0.4, vol: 0.1, type: 'lowpass', f0: 900, f1: 200, buf: 'brown' });
    return 1.0;
  },
  thud(e) {   // something heavy lands
    T(e, { t: e.t, dur: 0.3, vol: 0.4, type: 'sine', f0: 100, f1: 38, sweep: 0.8 });
    N(e, { t: e.t, dur: 0.12, vol: 0.14, type: 'lowpass', f0: 700, f1: 120, buf: 'brown' });
    return 0.45;
  },

  // ---- magic ----
  magic(e) {   // a rising glitter of notes over a soft shimmer
    [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => {
      T(e, { t: e.t + i * 0.07, dur: 0.3, vol: 0.09, type: 'sine', f0: f });
      T(e, { t: e.t + i * 0.07, dur: 0.18, vol: 0.025, type: 'triangle', f0: f * 2 });
    });
    N(e, { t: e.t, dur: 0.6, vol: 0.05, type: 'highpass', f0: 5000, a: 0.2 });
    return 0.8;
  },
};

const SCENE_VOICES = new Set(['whoosh', 'swing', 'clang', 'slice', 'splat', 'crack', 'shatter', 'thud', 'magic']);

export const sfx = {
  names: Object.keys(VOICES),
  voices: VOICES,
  sceneActive: false,
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
