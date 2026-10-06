// Renders every battle voice (today and the 6 variants) offline in headless Chrome and prints a quality table (CHE-261).
// Limits: peak <= -1 dBFS after the game bus, no click at the start or the end, no DC offset, length within 1.5x of today's voice.
//   node tools/sfx-lab/check.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, launchBrowser } from '../_lib.mjs';

const OUT = join(ROOT, '.tmp', 'sfx-lab');
mkdirSync(OUT, { recursive: true });
const js = (await build({ entryPoints: [join(ROOT, 'tools/sfx-lab/check-entry.js')], bundle: true, format: 'iife', write: false, target: 'es2020' })).outputFiles[0].text;
const file = join(OUT, 'check.html');
writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>check</title><script>${js.replace(/<\/script/g, '<\\/script')}</script>`);

const LIM = { peak: -1, edge: -60, dc: 0.003, ratio: 1.5 };
const f = (x, d = 1) => (typeof x === 'number' ? x.toFixed(d) : String(x));
let browser, rows;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + file);
  await page.waitForFunction('window.__checkReady === true', { timeout: 30000 });
  rows = await page.evaluate(() => window.runCheck());
  if (errs.length) { console.log('page errors:', errs.join(' | ')); process.exitCode = 1; }
} finally {
  await browser?.close();
}

let bad = 0;
console.log('voice    id     peak   rms    dc      claimed  audible  vs today  start  end    result');
for (const r of rows) {
  const fails = [];
  if (r.peak > LIM.peak) fails.push('peak');
  if (r.start > LIM.edge) fails.push('start click');
  if (r.end > LIM.edge) fails.push('end click');
  if (Math.abs(r.dc) > LIM.dc) fails.push('dc');
  let ratio = '';
  if (r.base) {
    const rc = r.lenClaimed / r.base.claimed, ra = r.lenAudible / Math.max(0.05, r.base.audible);
    ratio = `${f(rc, 2)}x/${f(ra, 2)}x`;
    if (rc > LIM.ratio) fails.push('claimed length');
    if (ra > LIM.ratio) fails.push('audible length');
  }
  if (r.id !== 'heute' && fails.length) bad++;
  console.log(`${r.name.padEnd(8)} ${r.id.padEnd(6)} ${f(r.peak).padStart(5)}  ${f(r.rms).padStart(5)}  ${f(r.dc, 4).padStart(7)} ${f(r.lenClaimed, 2).padStart(7)}  ${f(r.lenAudible, 2).padStart(7)}  ${ratio.padEnd(9)} ${f(r.start, 0).padStart(5)}  ${f(r.end, 0).padStart(5)}  ${r.id === 'heute' ? '(today)' : fails.length ? 'FAIL ' + fails.join(', ') : 'ok'}`);
}
console.log(bad ? `\n${bad} variant(s) outside the limits` : '\nall 54 variants within the limits');
process.exit(bad || process.exitCode ? 1 : 0);
