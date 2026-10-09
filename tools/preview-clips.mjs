// CHE-391 shared preview clip pipeline (CHE-395 part 1): node tools/preview-clips.mjs <manifest.json> [--out=.tmp/clips<KEY>] [--skip-build]
//   [--base=http://127.0.0.1:5510/] (use a running server, start none) [--only=id,id] [--tries=3] [--crash=<id>[:n]] (test hook: that clip throws on its first n attempts, default 1)
// Run it after every critic round. The manifest is JSON: { key, quality?, fps?, out?, clips: [ clip ] } with
//   clip: { id, q (url query), scene? (default id; phone and far stills are made once per scene), kind? (default clip), variant? (default scene), theme?, de?,
//           seconds? (4), size? ([480, 320]), phone? (true: 390 x 844 portrait still), far? (true: far view still),
//           camera? ({ from, to } each { yaw, pitch, dist }, degrees; default a slow orbit), farView? ({ yaw, pitch, dist }) }
// Per clip: a FRESH tab (closed in finally), up to 3 tries (a crash, a page error or a missing frame retries; the run still completes), an mp4 (H.264,
// <width> px) plus a poster png. Per scene: a phone portrait still (<scene>-phone.png) and a far view still (<scene>-far.png). Deterministic: ?manual=1,
// __chess.step() and .draw() per frame on launchBrowser(); music and sound off. Writes <out>/index.json in the format of the night lane scripts
// (file, poster, kind, variant, theme, flag, de; plus scene, seconds, tries) merged by file, and <out>/failures.json for clips that failed all tries (exit 1).
// Starts its own preview server on a claimed port and stops it, the Chrome and its pid file in finally.
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, build, startServer, launchBrowser, watchPage, claimPort } from './_lib.mjs';

const DEG = Math.PI / 180;
const HIDE_UI = 'body *{visibility:hidden!important} canvas{visibility:visible!important}';
const HIDE_NOISE = '#loader,#toast,#notice,.install-hint,.ih-overlay,#banner{display:none!important}';
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FAR_VIEW = { yaw: 25, pitch: 24, dist: 34 };

/** Manifest with defaults filled in; throws a one line message on an invalid one. */
export function parseManifest(m) {
  if (!m || typeof m !== 'object' || !Array.isArray(m.clips) || !m.clips.length) throw new Error('manifest: clips must be a non empty array');
  if (!/^[\w-]+$/.test(String(m.key || ''))) throw new Error('manifest: key is required (letters, digits, dash), for example "370"');
  const ids = new Set();
  const clips = m.clips.map((c, i) => {
    if (!c || !/^[\w-]+$/.test(String(c.id || ''))) throw new Error(`manifest: clips[${i}].id is required (letters, digits, dash)`);
    if (ids.has(c.id)) throw new Error(`manifest: duplicate clip id ${c.id}`);
    ids.add(c.id);
    if (typeof c.q !== 'string') throw new Error(`manifest: clip ${c.id} needs q (the url query, for example "world=hall&theme=wood")`);
    const scene = c.scene || c.id, size = c.size || [480, 320];
    if (!(c.seconds === undefined || c.seconds > 0) || size.length !== 2) throw new Error(`manifest: clip ${c.id} has bad seconds or size`);
    return { kind: 'clip', variant: scene, theme: '', de: c.id, seconds: 4, phone: true, far: true, ...c, scene, size };
  });
  return { key: String(m.key), quality: m.quality || 'high', fps: m.fps || 24, out: m.out, clips };
}

/** Run fn up to `tries` times with a fresh attempt each time; resolves { ok, value | error, attempts }. Never throws. */
export async function withRetries(fn, { tries = 3, onFail = () => {} } = {}) {
  let error;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try { return { ok: true, value: await fn(attempt), attempts: attempt }; } catch (e) { error = e; onFail(e, attempt); }
  }
  return { ok: false, error, attempts: tries };
}

/** The index.json entry of a clip or still (the night lane format, keep it compatible). */
export const entryFor = (c, { file, poster, kind, de, seconds, attempts }) =>
  ({ file, poster, kind, variant: c.variant, theme: c.theme, flag: `?${c.q}`, de, scene: c.scene, ...(seconds ? { seconds } : {}), tries: attempts });

/** Merge entries into an index array by file name. */
export function mergeIndex(index, entries) {
  for (const e of entries) { const i = index.findIndex((x) => x.file === e.file); if (i >= 0) index[i] = e; else index.push(e); }
  return index;
}

const lerp = (a, b, k) => a + (b - a) * k;
export const orbitPose = (c, k) => {
  const f = c.camera?.from || { yaw: 5, pitch: 30, dist: 22 }, t = c.camera?.to || { yaw: 55, pitch: 30, dist: 22 };
  const bump = Math.sin(k * Math.PI);   // a small rise and pull back in the middle, like the lane scripts
  return { yaw: lerp(f.yaw, t.yaw, k) * DEG, pitch: (lerp(f.pitch, t.pitch, k) - 4 * bump) * DEG, dist: lerp(f.dist, t.dist, k) - 2 * bump };
};

async function frame(page, pose, dt) {
  await page.evaluate((p, d) => { const C = window.__chess; C.controls.setCamera(p); C.step(d, 1 / d); C.draw(d); }, pose, dt);
}
async function open(page, base, q, quality) {
  await page.goto(`${base}?${q}&quality=${quality}&manual=1&ai=0&intro=0&music=0&sound=0`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 180000 });
  const err = await page.evaluate(() => window.__chessError);
  if (err) throw new Error(`${q}: page reported ${err}`);
  await page.evaluate(async () => { await window.__chess.world?.ready; });
  await page.addStyleTag({ content: HIDE_NOISE });
  await page.evaluate(() => { const C = window.__chess; C.step(1.5); for (let i = 0; i < 12; i++) C.stage.render(0.2); C.draw(); });   // settle: theme light, world first second
}

/** A fresh tab for one job; the tab is closed in finally and its page errors (not warnings) fail the attempt. */
async function inTab(browser, size, dsf, job) {
  const page = await browser.newPage();
  try {
    const watch = await watchPage(page);
    await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: dsf });
    const value = await job(page);
    if (watch.errs.length) throw new Error(`page errors: ${watch.errs.slice(0, 3).join(' | ')}`);
    return value;
  } finally { await page.close().catch(() => {}); }
}

async function main(argv) {
  const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  const manifestPath = argv.find((a) => !a.startsWith('--'));
  if (!manifestPath) { console.error('usage: node tools/preview-clips.mjs <manifest.json> [--out=.tmp/clips<KEY>] [--skip-build] [--base=<url>] [--only=id,id] [--tries=3] [--crash=<id>[:n]]'); return 2; }
  const man = parseManifest(JSON.parse(readFileSync(resolve(manifestPath), 'utf8')));
  const only = opt('only', '') ? opt('only', '').split(',') : null;
  const clips = man.clips.filter((c) => !only || only.includes(c.id));
  if (!clips.length) { console.error(`--only matches no clip id (${man.clips.map((c) => c.id).join(', ')})`); return 2; }
  const OUT = resolve(ROOT, opt('out', man.out || `.tmp/clips${man.key}`)), DIST = join(ROOT, `.tmp/preview-clips-dist`);
  const TRIES = Number(opt('tries', '3'));
  const [crashId, crashN = '1'] = opt('crash', '').split(':');
  const pidFile = join(OUT, '.preview-clips.pid');
  const failures = [];
  let server = null, browser = null, port = null, code = 0;
  const cleanup = async () => {
    await browser?.close().catch(() => {}); browser = null;
    await server?.stop?.(); server = null;
    port?.release(); port = null;
    rmSync(pidFile, { force: true });
  };
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { cleanup().finally(() => process.exit(130)); });
  const indexFile = join(OUT, 'index.json');
  const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : [];
  try {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(pidFile, String(process.pid));
    if (opt('base', '')) server = { base: opt('base', '').replace(/\/?$/, '/') };   // a server that already runs: none started, none stopped
    else {
      if (!argv.includes('--skip-build')) build(DIST);
      port = await claimPort({ kind: 'preview' });
      server = await startServer({ mode: 'preview', port: port.port, outDir: DIST });
    }
    browser = await launchBrowser({ w: 480, h: 320 });
    const sceneDone = new Set();
    for (const c of clips) {
      const t0 = Date.now(), n = Math.round(c.seconds * man.fps);
      const clip = await withRetries(async (attempt) => {
        if (c.id === crashId && attempt <= Number(crashN)) throw new Error(`forced crash (--crash=${crashId}:${crashN}) on attempt ${attempt}`);
        return inTab(browser, c.size, 2, async (page) => {
          await open(page, server.base, c.q, man.quality);
          await page.addStyleTag({ content: HIDE_UI });
          const tmp = join(OUT, `.frames-${c.id}`);
          rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
          try {
            for (let i = 0; i < n; i++) {
              await frame(page, orbitPose(c, n > 1 ? i / (n - 1) : 0.5), 1 / man.fps);
              const buf = await page.screenshot({ type: 'png' });
              writeFileSync(join(tmp, `f${String(i).padStart(4, '0')}.png`), buf);
              if (i === Math.floor(n / 2)) writeFileSync(join(OUT, `${c.id}.png`), buf);
            }
            execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(man.fps), '-i', join(tmp, 'f%04d.png'), '-vf', `scale=${c.size[0]}:-2:flags=lanczos`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', join(OUT, `${c.id}.mp4`)]);
          } finally { rmSync(tmp, { recursive: true, force: true }); }
          return true;
        });
      }, { tries: TRIES, onFail: (e, a) => console.log(`${c.id}: attempt ${a}/${TRIES} failed: ${String(e.message || e).split('\n')[0]}`) });
      if (clip.ok) {
        mergeIndex(index, [entryFor(c, { file: `${c.id}.mp4`, poster: `${c.id}.png`, kind: c.kind, de: c.de, seconds: c.seconds, attempts: clip.attempts })]);
        console.log(`${c.id}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s, attempt ${clip.attempts}`);
      } else failures.push({ id: c.id, error: String(clip.error?.message || clip.error), tries: clip.attempts });

      if (sceneDone.has(c.scene)) continue;
      sceneDone.add(c.scene);
      const stills = [];
      if (c.far) stills.push({ name: 'far', kind: 'far', size: c.size, q: c.q, de: `${c.de.replace(/ Thema .*$/, '')} Ferne Ansicht, das ganze Bild.`, pose: { ...FAR_VIEW, ...c.farView } });
      if (c.phone) stills.push({ name: 'phone', kind: 'phone', size: [390, 844], q: `${c.q}&touch=1`, de: `${c.de.replace(/ Thema .*$/, '')} Handy hochkant (390 x 844), Spielansicht.`, pose: null });
      for (const s of stills) {
        const file = `${c.scene}-${s.name}.png`;
        const r = await withRetries(() => inTab(browser, s.size, 2, async (page) => {
          await open(page, server.base, s.q, man.quality);
          if (s.pose) { await page.addStyleTag({ content: HIDE_UI }); await frame(page, { yaw: s.pose.yaw * DEG, pitch: s.pose.pitch * DEG, dist: s.pose.dist }, 1 / man.fps); }
          else await page.evaluate(() => { const C = window.__chess; C.step(0.5); C.draw(); C.draw(); });
          writeFileSync(join(OUT, file), await page.screenshot({ type: 'png' }));
          return true;
        }), { tries: TRIES, onFail: (e, a) => console.log(`${file}: attempt ${a}/${TRIES} failed: ${String(e.message || e).split('\n')[0]}`) });
        if (r.ok) { mergeIndex(index, [entryFor(c, { file, poster: file, kind: s.kind, de: s.de, attempts: r.attempts })]); console.log(file); }
        else failures.push({ id: file, error: String(r.error?.message || r.error), tries: r.attempts });
      }
    }
    writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
    if (failures.length) { writeFileSync(join(OUT, 'failures.json'), JSON.stringify(failures, null, 2) + '\n'); console.log(`FAILED after ${TRIES} tries: ${failures.map((f) => f.id).join(', ')} (see ${join(OUT, 'failures.json')})`); code = 1; }
    else rmSync(join(OUT, 'failures.json'), { force: true });
    console.log(`index: ${indexFile} (${index.length} entries)`);
  } catch (e) {
    console.error(e.stack || e.message || e); code = 1;
  } finally { await cleanup(); }
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
