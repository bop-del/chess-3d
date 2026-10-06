// Runs in headless Chrome (tools/sfx-lab/check.mjs): renders every voice offline and measures it.
import { VOICE_NAMES, IDS, voiceFn, renderVoice } from './core.js';

const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180);

function measure(r) {
  const { data, sr, t0 } = r;
  const n = data[0].length;
  let peak = 0, sumsq = 0, sum = 0;
  for (const ch of data) for (let i = 0; i < n; i++) { const x = ch[i]; peak = Math.max(peak, Math.abs(x)); sumsq += x * x; sum += x; }
  const rms = Math.sqrt(sumsq / (2 * n)), dc = sum / (2 * n);
  // audible length: from the start to the last 20 ms window above -50 dBFS
  const win = Math.floor(sr * 0.02);
  let last = 0;
  for (let s = 0; s + win <= n; s += win) {
    let m = 0;
    for (const ch of data) for (let i = s; i < s + win; i++) m += ch[i] * ch[i];
    if (Math.sqrt(m / (2 * win)) > Math.pow(10, -50 / 20)) last = s + win;
  }
  const lenAudible = Math.max(0, last / sr - t0);
  // start: the first 2 ms of the voice (the sample right at its start) and the very end of the render
  const s0 = Math.floor(t0 * sr);
  let startMax = 0, endMax = 0;
  for (const ch of data) {
    for (let i = Math.max(0, s0 - 4); i < s0 + Math.floor(sr * 0.0005); i++) startMax = Math.max(startMax, Math.abs(ch[i]));
    for (let i = n - Math.floor(sr * 0.005); i < n; i++) endMax = Math.max(endMax, Math.abs(ch[i]));
  }
  return { peak: db(peak), rms: db(rms), dc: dc, lenClaimed: r.len, lenAudible, start: db(startMax), end: db(endMax) };
}

window.runCheck = async () => {
  const rows = [];
  for (const name of VOICE_NAMES) {
    let base = null;
    for (const id of IDS) {
      const m = measure(await renderVoice(voiceFn(name, id)));
      if (id === 'heute') base = m;
      rows.push({ name, id, ...m, base: id === 'heute' ? null : { claimed: base.lenClaimed, audible: base.lenAudible } });
    }
  }
  return rows;
};
window.__checkReady = true;
