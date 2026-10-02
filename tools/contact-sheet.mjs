// Contact sheets: all screenshots of a run on one labelled grid image per screen size, so a visual audit means
// opening one or two images instead of twenty.
// Usage: node tools/contact-sheet.mjs <dir> [--cols=3] [--width=640] [--no-compare]
//   Reads every PNG in <dir> (except earlier contact sheets), groups them by pixel size and writes
//   <dir>/contact-<w>x<h>.png per group. Prints the paths it wrote.
// Also exports contactSheets(browser, dir, opts) so a tool that already has a browser open (test/smoke.mjs --shots)
// does not start a second one.
// Change flags: the previous run's PNGs are kept in the sibling folder <dir>.prev. Each tile gets a coloured border and
// a tag: "changed" (orange), "same" (green) or "new" (blue, no previous file). A pointer for the eye, never a gate, and
// only ever a comparison on this machine. After the sheets are written, <dir>.prev is replaced by the current PNGs.
// Exit codes: 0 sheets written (or no screenshots found), 2 usage error.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHEET = /^contact-.*\.png$/;

/** Width and height from a PNG header (IHDR follows the 8 byte signature and the chunk length and type). */
export function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// A pixel counts as different when some channel moves by more than PIXEL_TOL (of 255); a shot counts as changed when
// more than CHANGED_FRACTION of its pixels differ, or its size differs. Chosen from measured noise between identical
// software GL runs (see tools/README.md).
export const PIXEL_TOL = 3, CHANGED_FRACTION = 0.0005;

const label = (file) => basename(file, '.png').replace(/[-_]+/g, ' ').trim();
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Per file name in dir: 'changed', 'same' or 'new' against the PNGs in prevDir. Decodes in the browser's canvas. */
export async function compareShots(browser, dir, prevDir, files, { tol = PIXEL_TOL, fraction = CHANGED_FRACTION } = {}) {
  const verdicts = new Map(), pairs = [];
  for (const f of files) {
    const prev = join(prevDir, f);
    if (!existsSync(prev)) { verdicts.set(f, { state: 'new' }); continue; }
    const a = readFileSync(join(dir, f)), b = readFileSync(prev);
    if (a.equals(b)) verdicts.set(f, { state: 'same', diff: 0 });
    else pairs.push({ f, a: a.toString('base64'), b: b.toString('base64') });
  }
  if (!pairs.length) return verdicts;
  const page = await browser.newPage();
  try {
    const res = await page.evaluate(async (pairs, tol) => {
      const load = (b64) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `data:image/png;base64,${b64}`; });
      const pix = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const out = {};
      for (const p of pairs) {
        try {
          const [ia, ib] = [await load(p.a), await load(p.b)];
          if (ia.width !== ib.width || ia.height !== ib.height) { out[p.f] = 1; continue; }
          const da = pix(ia), db = pix(ib); let n = 0;
          for (let i = 0; i < da.length; i += 4) {
            if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol || Math.abs(da[i + 2] - db[i + 2]) > tol) n++;
          }
          out[p.f] = n / (da.length / 4);
        } catch (e) { out[p.f] = 1; }
      }
      return out;
    }, pairs, tol);
    for (const p of pairs) verdicts.set(p.f, { state: res[p.f] > fraction ? 'changed' : 'same', diff: res[p.f] });
  } finally { await page.close().catch(() => {}); }
  return verdicts;
}

const summary = (items) => {
  if (!items.some((i) => i.state)) return '';
  const n = (s) => items.filter((i) => i.state === s).length;
  return ` (${n('changed')} changed, ${n('same')} same, ${n('new')} new)`;
};

/** Group the PNGs in dir by size and render one sheet per group with the given browser. Returns the written paths. */
export async function contactSheets(browser, dir, { cols = 3, width = 640, compare = true } = {}) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.png') && !SHEET.test(f)).sort();
  const prevDir = `${resolve(dir)}.prev`;
  const verdicts = compare ? await compareShots(browser, dir, prevDir, files) : new Map();
  const groups = new Map();
  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    const size = pngSize(buf);
    if (!size) continue;
    const key = `${size.w}x${size.h}`;
    if (!groups.has(key)) groups.set(key, { ...size, items: [] });
    groups.get(key).items.push({ name: label(f), state: verdicts.get(f)?.state, src: `data:image/png;base64,${buf.toString('base64')}` });
  }
  const written = [];
  for (const [key, g] of groups) {
    const c = Math.min(cols, g.items.length);
    const tw = Math.min(width, g.w), th = Math.round((tw * g.h) / g.w);
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; background: #15171c; color: #e8e6e1; font: 600 14px system-ui, sans-serif; }
      h1 { margin: 0; padding: 12px 14px 4px; font-size: 15px; font-weight: 650; }
      .grid { display: grid; grid-template-columns: repeat(${c}, ${tw}px); gap: 10px; padding: 10px 14px 14px; }
      figure { margin: 0; } img { display: block; width: ${tw}px; height: ${th}px; border-radius: 6px; box-sizing: border-box; border: 4px solid transparent; }
      figure.changed img { border-color: #f0933a; } figure.same img { border-color: #3f8f5a; } figure.new img { border-color: #4a8fe0; }
      figcaption { padding: 5px 2px 0; } .tag { font-size: 12px; font-weight: 700; margin-left: 6px; }
      .changed .tag { color: #f0933a; } .same .tag { color: #3f8f5a; } .new .tag { color: #4a8fe0; }
    </style><h1>${esc(basename(resolve(dir)))}: ${g.items.length} shots at ${key}${summary(g.items)}</h1><div class="grid">${
      g.items.map((it) => `<figure class="${it.state || ''}"><img src="${it.src}"><figcaption>${esc(it.name)}${it.state ? `<span class="tag">${it.state}</span>` : ''}</figcaption></figure>`).join('')}</div>`;
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: c * tw + (c - 1) * 10 + 28, height: 200, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'load' });
      const out = join(dir, `contact-${key}.png`);
      await page.screenshot({ path: out, fullPage: true });
      written.push(out);
    } finally { await page.close().catch(() => {}); }
  }
  if (compare) {
    const names = (s) => files.filter((f) => verdicts.get(f)?.state === s);
    console.log(`      changed since last run: ${names('changed').length ? names('changed').join(', ') : 'none'} (${names('same').length} same, ${names('new').length} new)`);
    rmSync(prevDir, { recursive: true, force: true });
    mkdirSync(prevDir, { recursive: true });
    for (const f of files) copyFileSync(join(dir, f), join(prevDir, f));
  }
  return written;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? Number(a.split('=')[1]) : d; };
  if (!dir || args.some((a) => a.startsWith('--') && !/^--((cols|width)=\d+|no-compare)$/.test(a))) {
    console.error('usage: node tools/contact-sheet.mjs <dir> [--cols=3] [--width=640] [--no-compare]'); process.exit(2);
  }
  const { launchBrowser } = await import('./_lib.mjs');
  const browser = await launchBrowser({ w: 1280, h: 720 });
  try {
    const out = await contactSheets(browser, dir, { cols: opt('cols', 3), width: opt('width', 640), compare: !args.includes('--no-compare') });
    console.log(out.length ? out.join('\n') : `no screenshots in ${dir}`);
  } finally { await browser.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
