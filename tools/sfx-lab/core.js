// Shared by the page and the check: today's voices from the real src code, the lab voice table, offline rendering.
import { audio } from '../../src/audio.js';
import { sfx } from '../../src/battle/sfx.js';
import { VARIANTS } from './variants.js';

export const VOICE_NAMES = Object.keys(VARIANTS);
export const IDS = ['heute', 'a', 'b', 'c', 'd', 'e', 'f'];

/** The voice function for a voice name and a variant id ('heute' is the real one from src/battle/sfx.js). */
export function voiceFn(name, id) { return id === 'heute' ? sfx.voices[name] : VARIANTS[name].variants[id].fn; }

/** A seeded random so a render is the same every time. */
export function seeded(seed = 1) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

/** Render a voice through the real game bus chain (bus -> compressor -> limiter -> master) into an OfflineAudioContext. Returns { data, sr, len, t0 }. */
export async function renderVoice(fn, { sr = 44100, tail = 0.4, pad = 0.05 } = {}) {
  const probe = new OfflineAudioContext(2, sr, sr);
  const dry = { ac: probe, out: probe.createGain(), t: 0, v: 1, p: 1, r: seeded(7), name: 'probe' };
  const len = fn(dry);   // length the voice claims
  const ac = new OfflineAudioContext(2, Math.ceil((pad + len + tail) * sr), sr);
  audio.muted = false;
  audio.attach(ac);
  const out = ac.createGain();
  out.connect(audio.bus.scene);
  fn({ ac, out, t: pad, v: 1, p: 1, r: seeded(7), name: 'render' });
  const buf = await ac.startRendering();
  return { data: [buf.getChannelData(0), buf.getChannelData(1)], sr, len, t0: pad };
}
