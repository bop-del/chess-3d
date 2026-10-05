// CHE-219: one clip per Pixelwelt pawn capture variant (?pawngore=a|b|c) for the morning pick.
// Usage: node tools/clips219.mjs [--skip-build] [--only=a,b] [--fps=30] [--secs=3] [--out=.tmp/clips219]
//   Builds into .tmp/clips219-dist, serves it on a claimed port, and per variant loads the page with ?manual=1 (so the clock is
//   stepped by hand: the same frames every run), plays a pawn takes pawn capture with Blood on, takes a 480 px frame per step,
//   and stitches them with ffmpeg into <out>/<variant>.mp4 plus <variant>.jpg (the poster), and writes <out>/index.json
//   (file, variant, German one line description). Headless Chrome through launchBrowser() only, closed in finally.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT, launchBrowser, watchPage, startServer, build, claimPort, waitReady } from './_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const FPS = Number(opt('fps', 30)), SECS = Number(opt('secs', 3)), SIZE = 480;
const OUT = join(ROOT, opt('out', '.tmp/clips219')), DIST = '.tmp/clips219-dist';
const DESC = {
  a: 'Anlauf und Stoss: der Bauer weicht zurueck, rennt mit dem Speer in beiden Haenden los und stoesst zu.',
  b: 'Wurf: der Bauer holt aus und schleudert den Speer, der im Gegner stecken bleibt.',
  c: 'Doppelstoss mit Ausholen: der Bauer zieht den Speer weit zurueck und stoesst zweimal kurz hintereinander zu.',
};
const names = opt('only', 'a,b,c').split(',');
if (!existsSync(FFMPEG) || names.some((n) => !DESC[n]) || args.some((a) => !/^--(skip-build|only=[abc,]+|fps=\d+|secs=[\d.]+|out=\S+)$/.test(a))) {
  console.error('usage: node tools/clips219.mjs [--skip-build] [--only=a,b,c] [--fps=30] [--secs=3] [--out=.tmp/clips219] (needs /opt/homebrew/bin/ffmpeg)');
  process.exit(2);
}
if (!args.includes('--skip-build')) build(DIST);
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'clips219-'));
let server = null, browser = null;
const index = [];
try {
  server = await startServer({ mode: 'preview', port: (await claimPort()).port, outDir: DIST });
  browser = await launchBrowser({ w: SIZE, h: SIZE });
  for (const v of names) {
    const page = await browser.newPage();
    try {
      await watchPage(page, undefined, { scenes: true });
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('chess3d.battle', '{"mode":"on","gore":true}'); } catch (e) { /* ignore */ } });
      await page.setViewport({ width: SIZE, height: SIZE });
      await page.goto(`${server.base}?quality=low&manual=1&ai=0&sound=0&theme=pixel&pawngore=${v}&hud=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const r = await waitReady(page);
      if (!r.ready) throw new Error(r.why);
      await page.evaluate(() => { const c = window.__chess; c.battle.settings.set({ mode: 'on', gore: true }); c.game.loadFen('8/8/8/3p4/4P3/8/8/4K2k w - - 0 1'); c.step(2); c.draw(); c.game.move('e4', 'd5'); });
      await page.addStyleTag({ content: '.show-btn { display: none !important; }' });
      const dir = join(tmp, v); mkdirSync(dir);
      for (let i = 0; i < 90 && !(await page.evaluate(() => window.__chess.battle.active)); i++) await page.evaluate(async () => { await window.__chess.stepAsync(1 / 30, 30); });   // the clip starts with the scene
      const n = Math.round(SECS * FPS);
      for (let i = 0; i < n; i++) {
        await page.evaluate(async (hz) => { await window.__chess.stepAsync(1 / hz, hz); window.__chess.draw(); }, FPS);
        await page.screenshot({ path: join(dir, `f${String(i).padStart(4, '0')}.png`) });
      }
      const mp4 = join(OUT, `${v}.mp4`), jpg = join(OUT, `${v}.jpg`);
      const f = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-vf', `scale=${SIZE}:${SIZE}:flags=neighbor`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { encoding: 'utf8' });
      const p = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', join(dir, `f${String(Math.round(n * 0.5)).padStart(4, '0')}.png`), '-frames:v', '1', '-q:v', '3', jpg], { encoding: 'utf8' });
      if (f.status !== 0 || p.status !== 0) throw new Error(`ffmpeg failed: ${f.stderr || p.stderr}`);
      index.push({ file: `${v}.mp4`, poster: `${v}.jpg`, variant: v, description: DESC[v] });
      console.log(`variant ${v}: ${n} frames -> ${mp4}`);
    } finally { await page.close().catch(() => {}); }
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`wrote ${join(OUT, 'index.json')}`);
} finally {
  await browser?.close().catch(() => {});
  server?.stop();
  rmSync(tmp, { recursive: true, force: true });
}
