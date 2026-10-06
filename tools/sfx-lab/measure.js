// Level, click and length measurement of a rendered voice (shared by the lab check and test/sfx-voices.mjs).
export const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180);

export function measure(r) {
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
  // active RMS: over the audible part only, so a short voice and a long one with a quiet tail compare fairly
  const s1 = Math.floor(t0 * sr), s2 = Math.min(n, Math.max(s1 + win, last));
  let aq = 0;
  for (const ch of data) for (let i = s1; i < s2; i++) aq += ch[i] * ch[i];
  const rmsActive = Math.sqrt(aq / (2 * (s2 - s1)));
  // start: the first 2 ms of the voice (the sample right at its start) and the very end of the render
  const s0 = Math.floor(t0 * sr);
  let startMax = 0, endMax = 0;
  for (const ch of data) {
    for (let i = Math.max(0, s0 - 4); i < s0 + Math.floor(sr * 0.0005); i++) startMax = Math.max(startMax, Math.abs(ch[i]));
    for (let i = n - Math.floor(sr * 0.005); i < n; i++) endMax = Math.max(endMax, Math.abs(ch[i]));
  }
  return { peak: db(peak), rms: db(rms), rmsActive: db(rmsActive), dc: dc, lenClaimed: r.len, lenAudible, start: db(startMax), end: db(endMax) };
}

