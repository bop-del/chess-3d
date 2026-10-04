// Browser side of the offline render check (test/music-page.mjs serves it with the music modules): renders a whole piece with the
// real piano into an OfflineAudioContext, at the written tempo, and measures it. No game page, no gesture, no real time.
//   renderPiece(piece, { rate, lite }) -> { seconds, peak, clipped, silence, tail, step, lastStart, voices }
//     seconds   the length the score says (the notes' end plus the last chord dying away)
//     peak      largest sample of the mono mix, 0 to 1
//     clipped   samples at full scale
//     silence   longest stretch (s) below 1 % of the peak between the first note and the end of the score
//     tail      seconds from the end of the score to the last sound above 1 % of the peak (the room must not ring on for ever)
//     step      largest jump between two neighbouring samples, relative to the peak: a click shows as a step far above the music's own
//     lastStart start (s) of the last note
import { createPiano } from '../src/music/piano.js';
import { expand } from '../src/music/score.js';

export async function renderPiece(piece, { rate = 22050, lite = false } = {}) {
  const { events, seconds } = expand(piece);
  const total = Math.ceil(seconds + 8);
  const ac = new OfflineAudioContext(2, Math.ceil(rate * total), rate);
  const piano = createPiano(ac, ac.destination, { lite });
  for (const e of events) piano.note(e.m, e.t + 0.01, e.hold, e.vel);
  const buf = await ac.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const x = new Float32Array(n);
  let peak = 0, clipped = 0;
  for (let i = 0; i < n; i++) { x[i] = (L[i] + R[i]) / 2; const a = Math.abs(x[i]); if (a > peak) peak = a; if (Math.abs(L[i]) >= 0.999 || Math.abs(R[i]) >= 0.999) clipped++; }
  let step = 0;
  for (let i = 1; i < n; i++) { const d = Math.abs(x[i] - x[i - 1]); if (d > step) step = d; }
  const W = Math.floor(rate * 0.1), nw = Math.floor(n / W), thr = peak * 0.01;
  const loud = [];
  for (let w = 0; w < nw; w++) { let s = 0; for (let i = w * W; i < (w + 1) * W; i++) s += x[i] * x[i]; loud.push(Math.sqrt(s / W) > thr); }
  const first = Math.floor(events[0].t / 0.1), endW = Math.min(nw, Math.floor(seconds / 0.1));
  let run = 0, silence = 0;
  for (let w = first; w < endW; w++) { run = loud[w] ? 0 : run + 1; silence = Math.max(silence, run); }
  let lastLoud = 0; for (let w = 0; w < nw; w++) if (loud[w]) lastLoud = (w + 1) * 0.1;
  return { seconds, peak, clipped, silence: silence * 0.1, tail: lastLoud - seconds, step: peak ? step / peak : 0, lastStart: Math.max(...events.map((e) => e.t)), voices: events.length };
}
