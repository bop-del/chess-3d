// A soft synthesized piano for the background music, Web Audio only, no samples.
//
//   const piano = createPiano(ac, destination, { lite })
//   piano.note(midi, at, hold, vel)    schedule one key: struck at `at` (audio clock seconds), the damper falls at at + hold
//   piano.out                          the dry + room bus (connect nothing else to it)
//   piano.dispose()
//
// One note is two slightly detuned strings (a band limited PeriodicWave per register) through a closing low pass, a short
// decaying two stage envelope, a damper release and a soft felt hammer thump of filtered noise. The room is a generated
// stereo impulse response. `lite` (phones) uses one string, no hammer and no pan: about half the nodes per note.
// Everything is scheduled when note() is called, nothing runs per frame.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hz = (m) => 440 * 2 ** ((m - 69) / 12);

const waveCache = new WeakMap();
// Partial weights per register: low notes are rich in the 2nd to 5th partial, high notes are nearly sine.
function waveFor(ac, midi) {
  const reg = midi < 40 ? 0 : midi < 55 ? 1 : midi < 70 ? 2 : midi < 84 ? 3 : 4;
  let cache = waveCache.get(ac);
  if (!cache) waveCache.set(ac, (cache = []));
  if (cache[reg]) return cache[reg];
  const N = [14, 12, 9, 6, 4][reg], tilt = [0.9, 1.1, 1.35, 1.7, 2.1][reg];
  const real = new Float32Array(N + 1), imag = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) {
    const bump = n === 2 ? 1.25 : n === 3 ? 1.1 : 1;   // a hint of the octave and the twelfth, like a real soundboard
    imag[n] = (bump / n ** tilt) * (n % 7 === 0 ? 0.4 : 1);   // the 7th partial is where the hammer strikes: damped
  }
  return (cache[reg] = ac.createPeriodicWave(real, imag, { disableNormalization: false }));
}

const roomCache = new WeakMap();
function makeRoom(ac, seconds = 2.3) {
  let byLen = roomCache.get(ac);
  if (!byLen) roomCache.set(ac, (byLen = {}));
  return byLen[seconds] || (byLen[seconds] = buildRoom(ac, seconds));
}
function buildRoom(ac, seconds) {
  const rate = ac.sampleRate, len = Math.floor(rate * seconds);
  const buf = ac.createBuffer(2, len, rate);
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    const pre = Math.floor(rate * (0.012 + c * 0.004));
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / rate;
      const k = 0.18 + 0.7 * Math.min(1, x / seconds);   // the tail gets darker as it fades
      lp += (rnd() - lp) * (1 - k);
      d[i] = lp * Math.exp(-x * 3.1) * (x < 0.02 ? x / 0.02 : 1);
    }
  }
  return buf;
}

const noiseCache = new WeakMap();
function noiseBuf(ac) {
  let b = noiseCache.get(ac);
  if (b) return b;
  b = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
  const d = b.getChannelData(0);
  let seed = 99;
  for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 4294967296 * 2 - 1; }
  noiseCache.set(ac, b);
  return b;
}

export const DEFAULT_KLANG = 0.3, DEFAULT_RAUM = 0.7;   // 0 to 1: dark to bright, dry to a big room
const klangHz = (k) => 1500 * 5 ** clamp(k, 0, 1);    // master low pass: 1.5 kHz (warm) to 7.5 kHz (bright)
const klangScale = (k) => 0.55 + 0.9 * clamp(k, 0, 1); // scales the per key low pass the same way

export function createPiano(ac, destination, { lite = false, room = true, maxVoices = lite ? 14 : 28, klang = DEFAULT_KLANG, raum = DEFAULT_RAUM } = {}) {
  let kl = klang;
  const out = ac.createGain();
  out.gain.value = 1;
  const dry = ac.createGain(); dry.gain.value = 1 - 0.25 * raum;
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = klangHz(klang); tone.Q.value = 0.4;
  const bus = ac.createGain(); bus.gain.value = 1;
  bus.connect(tone); tone.connect(dry); dry.connect(out); out.connect(destination);
  let conv = null, wet = null;
  if (room) {
    conv = ac.createConvolver(); conv.buffer = makeRoom(ac, lite ? 2.2 : 3.4);
    wet = ac.createGain(); wet.gain.value = 0.7 * raum;
    tone.connect(conv); conv.connect(wet); wet.connect(out);
  }
  const voices = [];   // { stopAt, release(at) }
  const noise = lite ? null : noiseBuf(ac);

  function note(midi, at, hold, vel = 64) {
    const f = hz(midi);
    if (!(f > 20 && f < ac.sampleRate / 2 - 500)) return;
    const v01 = clamp(vel / 127, 0.03, 1);
    const peak = 0.34 * v01 ** 1.35 * (1.15 - 0.55 * clamp((midi - 36) / 60, 0, 1));   // low keys carry more energy: tame them
    const hi = clamp((midi - 21) / 87, 0, 1);
    const tau2 = 0.45 + 5.2 * (1 - hi) ** 1.7;                  // the long decay, longer for low strings
    const natural = 0.35 + tau2 * 6.5;                            // time until it is inaudible
    const rel = 0.05 + 0.1 * (1 - hi);                          // damper time constant
    const tEnd = at + Math.max(0.05, hold);
    const stopAt = Math.min(tEnd + rel * 7, at + natural) + 0.05;

    // steal the oldest when the budget is full
    const now = at;
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].stopAt < now) voices.splice(i, 1);
    if (voices.length >= maxVoices) { const old = voices.shift(); old.release(now); }

    const amp = ac.createGain();     // two stage decay
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(peak, at + 0.004);
    amp.gain.setTargetAtTime(peak * 0.42, at + 0.004, 0.09 + 0.1 * (1 - hi));
    amp.gain.setTargetAtTime(0, at + 0.4, tau2);
    const damp = ac.createGain();    // damper release
    damp.gain.setValueAtTime(1, tEnd);
    damp.gain.setTargetAtTime(0, tEnd, rel);

    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3;
    const ks = klangScale(kl);
    const open = clamp(f * (2.2 + 9 * v01) * ks, 600, 9000);
    lp.frequency.setValueAtTime(open, at);
    lp.frequency.setTargetAtTime(clamp(f * 2.2 * ks, 450, 3200), at, 0.45);

    const nodes = [amp, damp, lp];
    const wave = waveFor(ac, midi);
    const strings = lite ? [0] : [-1, 1];
    const detune = 0.9 + 1.4 * hi;
    for (const s of strings) {
      const o = ac.createOscillator();
      o.setPeriodicWave(wave);
      o.frequency.value = f;
      o.detune.value = s * detune;
      o.connect(lp); o.start(at); o.stop(stopAt);
      nodes.push(o);
    }
    lp.connect(amp); amp.connect(damp);
    let tail = damp;
    if (!lite && ac.createStereoPanner) {
      const pan = ac.createStereoPanner(); pan.pan.value = clamp((midi - 60) / 48, -1, 1) * 0.45;
      damp.connect(pan); tail = pan; nodes.push(pan);
    }
    tail.connect(bus);

    if (noise) {   // felt hammer thump
      const n = ac.createBufferSource(); n.buffer = noise;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = clamp(f * 2.5, 300, 2400); bp.Q.value = 0.9;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.5 * v01 ** 2 * peak, at + 0.002); g.gain.setTargetAtTime(0, at + 0.002, 0.012);
      n.connect(bp); bp.connect(g); g.connect(tail === damp ? bus : tail);
      n.start(at, Math.random() * 0.3); n.stop(at + 0.09);
      nodes.push(n, bp, g);
    }

    const voice = { stopAt, release(when) { try { damp.gain.cancelScheduledValues(when); damp.gain.setTargetAtTime(0, when, 0.02); } catch (e) { /* gone */ } voice.stopAt = when + 0.15; } };
    voices.push(voice);
    const first = nodes.find((n) => n.start);
    if (first) first.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* gone */ } } };
  }

  return {
    out, note,
    /** 0 (warm) to 1 (bright): the master low pass now, and the per key low pass of notes struck from now on. */
    setKlang(k) { kl = k; tone.frequency.setTargetAtTime(klangHz(k), ac.currentTime, 0.08); },
    /** 0 (dry) to 1 (large room). */
    setRaum(r) { if (wet) { wet.gain.setTargetAtTime(0.7 * r, ac.currentTime, 0.08); dry.gain.setTargetAtTime(1 - 0.25 * r, ac.currentTime, 0.08); } },
    dispose() { try { out.disconnect(); } catch (e) { /* gone */ } },
  };
}
