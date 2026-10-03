// Procedural WebAudio for the whole game, no audio files. Voices are small functions that schedule oscillators and filtered
// noise at an absolute time; src/battle/sfx.js holds the voices, this file holds the context and the plumbing.
//
//   audio.unlock()            call from a user gesture; window listeners do it on the first tap or key and stay armed until the
//                             context really runs (iOS accepts touchend, pointerup, click and keydown, not pointerdown)
//   audio.muted / setMuted()  mute switch, stored per device (localStorage, guarded)
//   audio.play(voice, opts)   voice(env) schedules nodes and returns its length in seconds. opts: { at, volume, pitch, bus, name }
//   audio.duckMusic(level, hold)  dips the background music bus for `hold` seconds (every audio.play does it; src/music/player.js)
//   audio.onMute(fn)          called when the mute switch changes
//   audio.stopScene(fade)     fades the scene bus out (skip by tap or key), then it is open again for the next sound
//   audio.mountMute(ui)       a mute switch in the settings (ui.mountSettings)
//
// Graph: voice -> bus ('fx', 'scene' or 'music') -> compressor -> limiter -> master (0 when muted) -> destination.
// Phones: navigator.audioSession.type = 'playback' before the context exists, so the ringer switch does not silence the game;
// the context is suspended while the page is hidden and resumed when it is visible again.
import { t } from './i18n.js';
import { device } from './device.js';

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'];
const MAX_VOICES = device.touch ? 24 : 40;
const STORE = 'chess3d.muted';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = (v, d) => (Number.isFinite(v) ? v : d);

// ---- building blocks (every node is disconnected when its source ends) ----

const noiseCache = new WeakMap();
export function getNoise(ac) {
  let n = noiseCache.get(ac);
  if (n) return n;
  const len = Math.floor(ac.sampleRate * 2);
  const white = ac.createBuffer(1, len, ac.sampleRate), brown = ac.createBuffer(1, len, ac.sampleRate);
  const w = white.getChannelData(0), b = brown.getChannelData(0);
  let last = 0, seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < len; i++) { const x = rnd() * 2 - 1; w[i] = x; last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5; }
  n = { white, brown };
  noiseCache.set(ac, n);
  return n;
}

/** Oscillator with a pitch sweep and an envelope. o: { t, dur, vol, type, f0, f1, sweep, a, lp, lpEnd, q, hp, detune, wobble } */
export function tone(e, o) {
  const { ac, out } = e;
  const t0 = fin(o.t, e.t), dur = Math.max(0.02, fin(o.dur, 0.2)), vol = Math.max(0.0002, fin(o.vol, 0.2) * e.v);
  const a = Math.min(fin(o.a, 0.003), dur * 0.9);
  const f0 = Math.max(1, fin(o.f0, 440) * e.p), f1 = Math.max(1, fin(o.f1, o.f0 ?? 440) * e.p);
  const osc = ac.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur * (o.sweep ?? 1));
  if (o.detune) osc.detune.value = o.detune;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.max(a, 0.001));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const chain = [osc, g];
  let node = osc;
  const filt = (type, f, q, fEnd) => {
    const b = ac.createBiquadFilter(); b.type = type; b.Q.value = q;
    b.frequency.setValueAtTime(clamp(f, 20, ac.sampleRate / 2 - 100), t0);
    if (fEnd) b.frequency.exponentialRampToValueAtTime(clamp(fEnd, 20, ac.sampleRate / 2 - 100), t0 + dur);
    node.connect(b); node = b; chain.push(b);
  };
  if (o.hp) filt('highpass', o.hp, 0.7);
  if (o.lp) filt('lowpass', o.lp, o.q ?? 0.7, o.lpEnd);
  if (o.wobble) {   // vibrato: a slow LFO on the pitch, in cents
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = o.wobble[0]; lg.gain.value = o.wobble[1];
    lfo.connect(lg); lg.connect(osc.detune); lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    chain.push(lfo, lg);
  }
  node.connect(g); g.connect(out);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
  osc.onended = () => { for (const n of chain) { try { n.disconnect(); } catch (err) { /* gone */ } } };
  return t0 + dur;
}

/** Filtered noise burst. o: { t, dur, vol, type, f0, f1, q, buf: 'white' | 'brown', a } */
export function noise(e, o) {
  const { ac, out } = e;
  const t0 = fin(o.t, e.t), dur = Math.max(0.02, fin(o.dur, 0.2)), vol = Math.max(0.0002, fin(o.vol, 0.2) * e.v);
  const a = Math.min(fin(o.a, 0.002), dur * 0.9);
  const src = ac.createBufferSource();
  const nb = getNoise(ac);
  src.buffer = o.buf === 'brown' ? nb.brown : nb.white;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = o.type || 'lowpass'; f.Q.value = o.q ?? 0.8;
  const lim = ac.sampleRate / 2 - 100;
  const f0 = clamp(fin(o.f0, 1000), 20, lim), f1 = clamp(fin(o.f1, f0), 20, lim);
  f.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.max(a, 0.001));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t0, e.r() * 1.5); src.stop(t0 + dur + 0.05);
  src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (err) { /* gone */ } };
  return t0 + dur;
}

// ---- the audio singleton ----

function readMuted() { try { return localStorage.getItem(STORE) === '1'; } catch (e) { return false; } }
function saveMuted(m) { try { localStorage.setItem(STORE, m ? '1' : '0'); } catch (e) { /* private window */ } }

export const audio = {
  ac: null,
  unlocked: false,
  muted: readMuted(),
  audioSessionType: 'n/a',
  active: 0,
  _gesture: false,
  _armed: false,
  _hooked: false,
  _lastResume: 0,
  _listeners: [],
  _muteListeners: [],
  _duck: { level: 1, until: 0 },

  /** Arm the unlock listeners (idempotent). Safe to call at boot, no context is created before a gesture. */
  init() {
    if (this._hooked) return this;
    this._hooked = true;
    this._onGesture = () => { this.unlock(); if (this.ac && this.ac.state === 'running') this._disarm(); };
    this._arm();
    document.addEventListener('visibilitychange', () => this._onVisibility());
    return this;
  },
  _arm() { if (this._armed) return; this._armed = true; for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, this._onGesture, true); },
  _disarm() { if (!this._armed) return; this._armed = false; for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, this._onGesture, true); },
  _onVisibility() {
    const ac = this.ac;
    if (!ac) return;
    if (document.hidden) { if (device.touch && ac.state === 'running') ac.suspend().catch(() => {}); return; }
    this._retryResume();
  },
  _retryResume() { const ac = this.ac; if (!ac || ac.state === 'running') return; this._arm(); ac.resume().catch(() => {}); },

  /** Use a given context instead of creating one (tests render voices into an OfflineAudioContext). */
  attach(ac) { this.ac = ac; this._build(ac); this._gesture = true; this.unlocked = true; return this; },

  _ensure() {
    if (this.ac) return true;
    if (!this._gesture) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    // iOS 17 and later: 'playback' keeps the game audible with the ringer switch on silent. Must be set before the context exists.
    try {
      const as = navigator.audioSession;
      if (as && (device.touch || device.ios)) { as.type = 'playback'; this.audioSessionType = as.type; } else if (as) this.audioSessionType = as.type;
    } catch (e) { /* unsupported */ }
    let ac;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }
    this.ac = ac;
    this._build(ac);
    ac.addEventListener?.('statechange', () => {
      if (ac.state === 'running') { this._markUnlocked(); this._disarm(); } else { this._arm(); if (!document.hidden) this._retryResume(); }
    });
    return true;
  },

  _build(ac) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    const master = ac.createGain();
    master.gain.value = this.muted ? 0 : 0.8;
    comp.connect(lim); lim.connect(master); master.connect(ac.destination);
    const bus = () => { const g = ac.createGain(); g.gain.value = 1; g.connect(comp); return g; };
    this.master = master;
    this.bus = { fx: bus(), scene: bus(), music: bus() };
  },

  /** Call from a user gesture. Resolves to audio.unlocked. */
  unlock() {
    this._gesture = true;
    if (!this._ensure()) return Promise.resolve(false);
    if (this.ac.state === 'running') { this._markUnlocked(); return Promise.resolve(true); }
    try {   // older iOS only starts output once something played inside the gesture: one silent sample does it
      const s = this.ac.createBufferSource();
      s.buffer = this.ac.createBuffer(1, 1, this.ac.sampleRate); s.connect(this.ac.destination); s.start(0);
    } catch (e) { /* ignore */ }
    return this.ac.resume().then(() => { if (this.ac.state === 'running') this._markUnlocked(); return this.unlocked; }).catch(() => false);
  },
  _markUnlocked() { if (this.unlocked) return; this.unlocked = true; this._listeners.forEach((fn) => fn()); },
  onUnlock(fn) { this._listeners.push(fn); if (this.unlocked) fn(); },

  setMuted(m) {
    this.muted = !!m;
    saveMuted(this.muted);
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ac.currentTime, 0.02);
    this._switches?.forEach((fn) => fn());
    this._muteListeners.forEach((fn) => fn(this.muted));
  },
  onMute(fn) { this._muteListeners.push(fn); },

  /** Dip the music bus to `level` (0 to 1) for `hold` seconds, then let it back up slowly. A deeper dip that is still running wins. */
  duckMusic(level = 0.45, hold = 0.6) {
    if (!this.ac || !this.bus) return;
    const g = this.bus.music.gain, now = this.ac.currentTime, d = this._duck;
    if (level >= 1) { d.level = 1; d.until = 0; g.cancelScheduledValues(now); g.setTargetAtTime(1, now, 0.5); return; }   // release
    if (now < d.until && level > d.level) { d.until = Math.max(d.until, now + hold); level = d.level; } else { d.level = level; d.until = now + hold; }
    g.cancelScheduledValues(now);
    g.setTargetAtTime(level, now, 0.04);
    g.setTargetAtTime(1, d.until, 0.7);
  },

  /** Schedule a voice. Returns its length in seconds, or null when nothing was played (locked, muted, too many voices). */
  play(voice, { at = 0, volume = 1, pitch = 1, bus = 'fx', name = '' } = {}) {
    if (this.muted || !this._ensure()) return null;
    const ac = this.ac;
    if (ac.state !== 'running') {   // suspended, or interrupted on iOS (calls, Siri)
      const n = performance.now();
      if (n - this._lastResume > 1000) { this._lastResume = n; ac.resume().catch(() => {}); }
      return null;
    }
    if (this.active >= MAX_VOICES) return null;
    this.duckMusic(bus === 'scene' ? 0.25 : 0.5, bus === 'scene' ? 1.2 : 0.55);
    const out = ac.createGain();
    out.connect(this.bus[bus] || this.bus.fx);
    const env = { ac, out, t: ac.currentTime + 0.005 + Math.max(0, at), v: volume, p: pitch, r: Math.random, name };
    const dur = voice(env);
    this.active++;
    setTimeout(() => { this.active--; try { out.disconnect(); } catch (e) { /* gone */ } }, (Math.max(0, at) + dur + 0.3) * 1000);
    return dur;
  },

  /** Skip: fade the scene bus out, then open it again so the next scene is audible. */
  stopScene(fade = 0.06) {
    if (!this.ac || !this.bus) return;
    const g = this.bus.scene.gain, now = this.ac.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    g.setValueAtTime(0, now + fade + 0.05);
    g.linearRampToValueAtTime(1, now + fade + 0.1);
  },

  /** A mute switch for the settings (desktop Scene card, phone Menu sheet). */
  mountMute(ui) {
    const row = document.createElement('label');
    row.className = 'switch';
    row.innerHTML = '<input type="checkbox" data-audio-mute><span class="track"><i></i></span><em></em>';
    const em = row.querySelector('em');
    em.textContent = t('audio.mute', 'Mute sound');
    em.dataset.i18n = 'audio.mute';
    const box = row.querySelector('input');
    const sync = () => { box.checked = this.muted; };
    sync();
    box.addEventListener('change', () => this.setMuted(box.checked));
    (this._switches ||= []).push(sync);
    ui.mountSettings('audio', row);
    return row;
  },
};
