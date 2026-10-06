// Building blocks for better battle voices (sfx lab, CHE-261). Written so they can move into src/audio.js later:
// they only use the voice environment e = { ac, out, t, v, p, r } and the helpers tone and noise from src/audio.js.
//
//   bus(e, { wet, room, dark, comp, drive, hp })   a per voice bus: DC filter, soft clip, compressor, generated impulse reverb.
//                                                   Returns a new env to draw into; its .tail is the seconds the reverb rings on
//                                                   (add it to the length the voice returns).
//   impulse(ac, len, dark)                         the generated reverb impulse (decaying noise that darkens, no file)
//   modal(e, { t, f, parts, dec, vol, beat })      a bank of decaying sine partials: metal, stone, glass, wood, bells
//   PARTIALS                                       ratio tables for modal: [ratio, decay (share of dec), amp]
//   snap(e, { t, vol, hp, body, bodyF })           a layered transient: noise click, a tick and an optional body thump
//   fm(e, { t, dur, vol, f, ratio, index })        two operator FM tone with a decaying envelope (glassy, bell like)
//   shards(e, { t, span, n, lo, hi, vol, parts })  a scatter of small modal pings over a time span (glass, ice, coins)
import { tone, noise } from '../../src/audio.js';
export { tone, noise };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- generated reverb impulse ----

const irCache = new WeakMap();
export function impulse(ac, len = 0.4, dark = 0.5) {
  let m = irCache.get(ac);
  if (!m) irCache.set(ac, (m = new Map()));
  const key = len + '/' + dark;
  if (m.has(key)) return m.get(key);
  const sr = ac.sampleRate, n = Math.floor(sr * len), buf = ac.createBuffer(2, n, sr);
  let seed = 7919;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const env = Math.pow(10, -3.2 * t) * Math.min(1, i / (0.003 * sr)) * (t > 0.85 ? (1 - t) / 0.15 : 1);   // about -64 dB at the end, no click at either side
      lp += (rnd() * 2 - 1 - lp) * (1 - 0.93 * dark * Math.min(1, t * 2.5));   // the tail gets darker the longer it rings
      d[i] = lp * env;
    }
  }
  m.set(key, buf);
  return buf;
}

// ---- the bus ----

const curves = new Map();
function satCurve(k) {
  if (curves.has(k)) return curves.get(k);
  const c = new Float32Array(1024), norm = Math.tanh(k);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
  curves.set(k, c);
  return c;
}

/** o: { wet 0..1 reverb send, room seconds of tail, dark 0..1, comp ratio (0 = none), drive soft clip amount (0 = none), hp Hz of the DC filter } */
export function bus(e, o = {}) {
  const { ac, out } = e;
  const inp = ac.createGain();
  let node = inp;
  const chain = (n) => { node.connect(n); node = n; return n; };
  const hp = chain(ac.createBiquadFilter());
  hp.type = 'highpass'; hp.frequency.value = o.hp ?? 25; hp.Q.value = 0.7;
  if (o.drive) { const sh = chain(ac.createWaveShaper()); sh.curve = satCurve(o.drive); sh.oversample = '2x'; }
  if (o.comp) {
    const c = chain(ac.createDynamicsCompressor());
    c.threshold.value = -22; c.knee.value = 8; c.ratio.value = o.comp; c.attack.value = 0.002; c.release.value = 0.12;
  }
  node.connect(out);
  let tail = 0;
  if (o.wet) {
    const conv = ac.createConvolver(), wg = ac.createGain();
    tail = o.room ?? 0.35;
    conv.buffer = impulse(ac, tail, o.dark ?? 0.5);
    wg.gain.value = o.wet;
    node.connect(conv); conv.connect(wg); wg.connect(out);
  }
  return { ...e, out: inp, tail };
}

// ---- modal partials ----

export const PARTIALS = {
  bar:   [[1, 1, 1], [2.76, 0.55, 0.6], [5.4, 0.3, 0.4], [8.93, 0.17, 0.25]],                                // a struck steel bar
  bell:  [[0.5, 1, 0.5], [1, 0.9, 1], [1.19, 0.7, 0.5], [1.5, 0.55, 0.35], [2, 0.5, 0.45], [2.51, 0.3, 0.25], [4.1, 0.15, 0.15]],
  plate: [[1, 1, 1], [1.59, 0.7, 0.7], [2.14, 0.5, 0.55], [2.65, 0.4, 0.4], [3.16, 0.3, 0.3]],              // a thick plate: dense, dull
  stone: [[1, 1, 1], [1.58, 0.6, 0.55], [2.31, 0.4, 0.4], [3.07, 0.25, 0.25]],
  wood:  [[1, 1, 1], [2.4, 0.55, 0.5], [4.2, 0.3, 0.3]],
  glass: [[1, 1, 1], [2.32, 0.7, 0.6], [4.25, 0.5, 0.45], [6.63, 0.3, 0.3], [9.38, 0.2, 0.2]],
  tine:  [[1, 1, 1], [2.01, 0.4, 0.3], [3.02, 0.2, 0.12]],                                                   // a plucked or bell like note
};

/** o: { t, f base Hz, parts (PARTIALS.x), dec seconds of the longest partial, vol, beat (e.g. 0.004: a detuned twin per partial, beating), a attack } */
export function modal(e, o) {
  const t0 = o.t ?? e.t, vol = o.vol ?? 0.2, dec = o.dec ?? 0.5, nyq = e.ac.sampleRate / 2 - 500;
  for (const [r, d, amp] of o.parts) {
    const f = o.f * r;
    if (f * e.p > nyq) continue;
    tone(e, { t: t0, dur: Math.max(0.03, dec * d), vol: vol * amp, type: 'sine', f0: f, a: o.a ?? 0.0015 });
    if (o.beat) tone(e, { t: t0, dur: Math.max(0.03, dec * d), vol: vol * amp * 0.6, type: 'sine', f0: f * (1 + o.beat * (1 + r * 0.3)), a: o.a ?? 0.0015 });
  }
  return t0 + dec;
}

// ---- transient and scatter ----

/** A layered attack: a bright noise click, a short tick and (body > 0) a low thump. o: { t, vol, hp, len, body, bodyF } */
export function snap(e, o = {}) {
  const t0 = o.t ?? e.t, vol = o.vol ?? 0.2;
  noise(e, { t: t0, dur: o.len ?? 0.03, vol, type: 'highpass', f0: o.hp ?? 2500 });
  tone(e, { t: t0, dur: 0.02, vol: vol * 0.45, type: 'triangle', f0: (o.hp ?? 2500) * 1.3, f1: (o.hp ?? 2500) * 0.5 });
  if (o.body) tone(e, { t: t0, dur: 0.14, vol: o.body, type: 'sine', f0: (o.bodyF ?? 180) * 1.7, f1: o.bodyF ?? 180, sweep: 0.6 });
  return t0 + 0.14;
}

/** Two operator FM tone. o: { t, dur, vol, f, ratio modulator/carrier, index modulation depth (times f), a } */
export function fm(e, o) {
  const { ac, out } = e, t0 = o.t ?? e.t, dur = Math.max(0.03, o.dur ?? 0.3), vol = Math.max(0.0002, (o.vol ?? 0.1) * e.v), f = (o.f ?? 800) * e.p;
  const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
  car.frequency.value = f; mod.frequency.value = f * (o.ratio ?? 1.4);
  mg.gain.setValueAtTime(f * (o.index ?? 3), t0);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + clamp(o.a ?? 0.004, 0.001, dur * 0.9));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out);
  car.start(t0); mod.start(t0); car.stop(t0 + dur + 0.05); mod.stop(t0 + dur + 0.05);
  car.onended = () => { for (const n of [car, mod, mg, g]) { try { n.disconnect(); } catch (err) { /* gone */ } } };
  return t0 + dur;
}

/** n small modal pings spread over `span` seconds, thinning out (power) like falling shards. o: { t, span, n, lo, hi Hz, vol, parts, dec, power } */
export function shards(e, o) {
  const t0 = o.t ?? e.t, n = o.n ?? 12;
  for (let i = 0; i < n; i++) {
    const at = t0 + Math.pow(e.r(), o.power ?? 1.6) * (o.span ?? 0.6);
    const f = (o.lo ?? 1500) * Math.pow((o.hi ?? 6000) / (o.lo ?? 1500), e.r());
    modal(e, { t: at, f, parts: o.parts ?? PARTIALS.glass, dec: (o.dec ?? 0.14) * (0.6 + e.r() * 0.8), vol: (o.vol ?? 0.06) * (0.5 + e.r() * 0.5) });
  }
  return t0 + (o.span ?? 0.6) + (o.dec ?? 0.14);
}
