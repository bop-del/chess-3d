// The game's sound voices rendered offline in headless Chrome through the real bus chain (CHE-261).
// Limits: the 9 scene voices are level matched (RMS over the audible part within 3 dB of their median), every voice peaks at or below -1 dBFS,
// no click at the start or the end, no DC offset. Output: PASS / FAIL lines and a level table.
//   node test/sfx-voices.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, launchBrowser } from '../tools/_lib.mjs';

const SCENE = ['whoosh', 'swing', 'clang', 'slice', 'splat', 'crack', 'shatter', 'thud', 'magic'];
const LIM = { peak: -1, edge: -60, dc: 0.003, rms: 3 };
const OUT = join(ROOT, '.tmp', 'sfx-voices');
mkdirSync(OUT, { recursive: true });
const js = (await build({ entryPoints: [join(ROOT, 'tools/sfx-lab/voices-entry.js')], bundle: true, format: 'iife', write: false, target: 'es2020' })).outputFiles[0].text;
const file = join(OUT, 'voices.html');
writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>voices</title><script>${js.replace(/<\/script/g, '<\\/script')}</script>`);

let browser, rows;
const errs = [];
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + file);
  await page.waitForFunction('window.__voicesReady === true', { timeout: 30000 });
  rows = await page.evaluate(() => window.runVoices());
} finally {
  await browser?.close();
}

const f = (x, d = 1) => x.toFixed(d);
const med = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const median = med(rows.filter((r) => SCENE.includes(r.name)).map((r) => r.rmsActive));
let bad = 0;
const fail = (name, what) => { bad++; console.log(`FAIL  ${name}: ${what}`); };
console.log(`voice     peak  active rms  vs median   dc       start  end`);
for (const r of rows) {
  const scene = SCENE.includes(r.name), d = r.rmsActive - median;
  console.log(`${r.name.padEnd(9)} ${f(r.peak).padStart(5)} ${f(r.rmsActive).padStart(6)} ${scene ? f(d).padStart(8) : '       -'}   ${f(r.dc, 4).padStart(7)} ${f(r.start, 0).padStart(6)} ${f(r.end, 0).padStart(5)}`);
  if (r.peak > LIM.peak) fail(r.name, `peak ${f(r.peak)} dBFS above ${LIM.peak}`);
  if (r.start > LIM.edge) fail(r.name, `click at the start (${f(r.start, 0)} dB)`);
  if (r.end > LIM.edge) fail(r.name, `click at the end (${f(r.end, 0)} dB)`);
  if (Math.abs(r.dc) > LIM.dc) fail(r.name, `DC offset ${f(r.dc, 4)}`);
  if (scene && Math.abs(d) > LIM.rms) fail(r.name, `RMS ${f(d)} dB from the median of the nine (limit ${LIM.rms})`);
}
if (errs.length) fail('page', errs.join(' | '));
console.log(`median RMS of the nine: ${f(median)} dBFS`);
if (!bad) console.log(`PASS  ${rows.length} voices within the limits`);
process.exit(bad ? 1 : 0);
