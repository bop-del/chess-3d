// Showcase clips (CHE-374): records the showcase mode deterministically and writes mp4 clips, posters and phone stills for the
// review page. Usage: node tools/clips-374.mjs [--only=trailer-pixel,trailer-lit,shots,stills] [--fps=24] [--skip-build] [--max=62]
// The page is the real build in ?manual=1 on the GPU renderer through launchBrowser() (one headless Chrome, closed in finally):
// each frame is __chess.stepAsync(1 / fps) (battle scenes are promise driven), __chess.draw(), a screenshot; ffmpeg stitches
// them. Output: .tmp/clips374/ with index.json ({ file, poster, kind, variant, flags, desc }), frames are removed afterwards.
// Exit codes: 0 done, 1 a render failed.
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, build, launchBrowser, startServer, watchPage, waitReady } from './_lib.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const FPS = Number(opt('fps', 24)), MAX = Number(opt('max', 62));
const STYLES = ['flow'];   // the owner's pick (2026-10-09): the gliding camera is the only style
const TRAILERS = STYLES.flatMap((st) => [`trailer-${st}-pixel`, `trailer-${st}-lit`]);
const ONLY = opt('only', [...TRAILERS, 'shots', 'stills'].join(',')).split(',');
const OUT = join(ROOT, opt('out', '.tmp/clips374')), DIST = '.tmp/clips374-dist';
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const LIT = opt('lit', 'wood');
const SHOT_DE = {
  establish: 'Eröffnungsbild: hohe Kreisfahrt um das Brett unter der Titelkarte',
  wide: 'Weite Totale von einer Seite, die langsam seitlich driftet',
  dolly: 'Kamerafahrt parallel zur ziehenden Figur auf Figurenhöhe',
  crane: 'Kranfahrt: von tief neben dem Zielfeld hoch und zurück',
  over: 'Über die Schulter: hinter der Figur, Blick zum Ziel',
  top: 'Vogelperspektive, die sich langsam dreht',
  hero: 'Heldenbogen tief um das Zielfeld bei einem großen Moment',
  battle: 'Nahaufnahme beim Schlagen: die Kampfszene mit langsamem Heranfahren',
  mate: 'Matt: tief um den geschlagenen König, dann hoch über das Brett',
  end: 'Schlusskarte mit langsamer Kreisfahrt',
};

const ff = (args) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args]);
const index = [];
let server = null, browser = null, code = 0;
try {
  mkdirSync(OUT, { recursive: true });
  if (!argv.includes('--skip-build')) build(DIST);
  server = await startServer({ mode: 'preview', outDir: DIST });
  browser = await launchBrowser({ w: 720, h: 405 });
  const page = await browser.newPage();
  await watchPage(page, undefined, { scenes: true });   // the battle scenes play (the app default On)

  // load the page with the showcase, then record frames until the end card has stood for `tail` seconds (or `max` seconds)
  async function record({ query, w, h, dir, max = MAX, tail = 4, phone = false }) {
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
    await page.goto(`${server.base}?manual=1&quality=high&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const r = await waitReady(page);
    if (!r.ready) throw new Error(`page not ready: ${r.error || r.why}`);
    await page.evaluate(async () => { await window.__chess.battle.ready(); });
    // the loader fades out on the wall clock (CSS): the film starts once it is gone; the tap hint is for players, not for the film
    await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('done'), { timeout: 30000 });
    await new Promise((res) => setTimeout(res, 900));
    await page.evaluate(() => window.__chess.showcase?.overlay.hint(null));
    const log = [];
    let endAt = null;
    for (let f = 0; f < max * FPS; f++) {
      const s = await page.evaluate(async (dt) => { const C = window.__chess; await C.stepAsync(dt, 1 / dt); C.draw(dt); return C.showcase?.state || { phase: 'none' }; }, 1 / FPS);
      await page.screenshot({ path: join(dir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
      log.push(s);
      if (s.phase === 'end' && endAt === null) endAt = f;
      if (endAt !== null && f - endAt >= tail * FPS) break;
      if (s.phase === 'stopped' || s.phase === 'none') break;
    }
    writeFileSync(join(dir, '..', `${dir.split('/').pop()}.timeline.json`), JSON.stringify(log.map((x, f) => ({ f, s: +(f / FPS).toFixed(2), phase: x.phase, ply: x.ply, shot: x.shot, ts: +(x.timeScale ?? 1).toFixed(2) }))));
    return log;
  }
  const encode = (dir, start, count, file, width) => ff(['-framerate', String(FPS), '-start_number', String(start), '-i', join(dir, '%05d.jpg'), '-frames:v', String(count),
    '-vf', `scale=${width}:-2:flags=lanczos`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', join(OUT, file)]);
  const poster = (dir, frame, file, width) => ff(['-i', join(dir, `${String(frame).padStart(5, '0')}.jpg`), '-vf', `scale=${width}:-2:flags=lanczos`, join(OUT, file)]);
  // first frame index of each shot type in a log, and how long it ran
  const shotRuns = (log) => {
    const runs = [];
    log.forEach((s, f) => { if (!runs.length || runs.at(-1).shot !== s.shot) runs.push({ shot: s.shot, start: f, n: 1 }); else runs.at(-1).n++; });
    return runs.filter((r) => r.shot);
  };

  const trailers = STYLES.flatMap((st) => [[`trailer-${st}-pixel`, 'pixel', 'Pixelwelt', st], [`trailer-${st}-lit`, LIT, `beleuchtetes Thema ${LIT}`, st]]);
  const STYLE_DE = { flow: 'eine durchgehende Kamerafahrt (gleitende Übergänge)' };
  const logs = {};
  for (const [id, theme, label, style] of trailers) {
    if (!ONLY.includes(id)) continue;
    const t0 = Date.now(), flags = `?showcase=trailer&showgame=immortal&theme=${theme}`;
    const dir = join(OUT, `frames-${id}`);
    const log = logs[id] = await record({ query: flags.slice(1), w: 720, h: 405, dir });
    encode(dir, 0, log.length, `${id}.mp4`, 720);
    const posterAt = log.findIndex((s) => s.shot === 'hero');
    poster(dir, posterAt > 0 ? posterAt + Math.round(FPS * 1.2) : Math.round(FPS * 2.5), `${id}.png`, 720);
    index.push({ file: `${id}.mp4`, poster: `${id}.png`, kind: 'trailer', variant: style, theme, flags, seconds: +(log.length / FPS).toFixed(1), desc: `Trailer: die Unsterbliche Partie 1851, Kamera ${STYLE_DE[style]}, ${label}, Titel, Kamerafahrten, Kampfszenen, Zeitlupe und Matt` });
    // a contact sheet for the critic: one frame every 1.5 s, 5 per row
    ff(['-framerate', String(FPS), '-i', join(dir, '%05d.jpg'), '-vf', `select='not(mod(n\\,${Math.round(FPS * 1.5)}))',scale=360:-1,tile=5x${Math.ceil(log.length / (FPS * 1.5) / 5)}`, '-frames:v', '1', join(OUT, `sheet-${id}.png`)]);
    console.log(`PASS  ${id}  ${(log.length / FPS).toFixed(1)} s of film, ${shotRuns(log).length} shots, rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (!argv.includes('--keep-frames') && !ONLY.includes('shots')) rmSync(dir, { recursive: true, force: true });
  }

  // 4 s per shot type, 480 px: from the full showcase of Réti vs Tartakower (short, every shot of the rotation) in Pixelwelt
  if (ONLY.includes('shots')) {
    const flags = '?showcase=1&showgame=reti&theme=pixel';   // flow style (the only one)
    const dir = join(OUT, 'frames-shots');
    const log = await record({ query: flags.slice(1), w: 720, h: 405, dir, max: 150 });
    const seen = new Set();
    for (const r of shotRuns(log)) {
      if (seen.has(r.shot) || r.n < FPS * 1.2) continue;
      seen.add(r.shot);
      const n = Math.min(r.n, FPS * 4), file = `shot-${r.shot}.mp4`;
      encode(dir, r.start, n, file, 480);
      poster(dir, r.start + Math.floor(n / 2), `shot-${r.shot}.png`, 480);
      index.push({ file, poster: `shot-${r.shot}.png`, kind: 'shot', variant: r.shot, flags, seconds: +(n / FPS).toFixed(1), desc: SHOT_DE[r.shot] || r.shot });
    }
    console.log(`PASS  shot clips  ${[...seen].join(', ')}`);
    if (!argv.includes('--keep-frames')) rmSync(dir, { recursive: true, force: true });
  }
  for (const id of TRAILERS) if (!argv.includes('--keep-frames')) rmSync(join(OUT, `frames-${id}`), { recursive: true, force: true });

  // one phone still per variant, 390x844 portrait, at the first hero moment (lower third and letterbox on screen)
  if (ONLY.includes('stills')) {
    for (const [id, theme, style] of STYLES.flatMap((st) => [[`${st}-pixel`, 'pixel', st], [`${st}-lit`, LIT, st]])) {
      const flags = `?showcase=trailer&showgame=immortal&theme=${theme}&touch=1`;
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await page.goto(`${server.base}${flags}&manual=1&quality=high`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const r = await waitReady(page);
      if (!r.ready) throw new Error(`page not ready: ${r.error || r.why}`);
      await page.evaluate(async () => { await window.__chess.battle.ready(); });
      await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('done'), { timeout: 30000 });
      await new Promise((res) => setTimeout(res, 900));
      await page.evaluate(() => window.__chess.showcase?.overlay.hint(null));
      // 18.Bd6 (ply 34), the slow motion move, once it has landed: the lower third with its caption is on screen
      for (let f = 0; f < MAX * 12; f++) {
        const s = await page.evaluate(async () => { const C = window.__chess; await C.stepAsync(1 / 12, 12); return C.showcase.state; });
        if (s.ply === 34 && s.phase === 'hold') break;
      }
      await page.evaluate(() => window.__chess.draw());
      const file = `still-phone-${id}.png`;
      await page.screenshot({ path: join(OUT, file) });
      index.push({ file, poster: file, kind: 'still', variant: style, theme, flags, desc: `Handy hochkant 390x844, Kamera ${style}: 18.Ld6 in Zeitlupe mit Bauchbinde, ${theme === 'pixel' ? 'Pixelwelt' : `Thema ${LIT}`}` });
      console.log(`PASS  phone still ${id}`);
    }
  }
  let old = []; try { old = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')); } catch (e) { /* first run */ }
  const merged = [...old.filter((o) => !index.some((n) => n.file === o.file) && existsSync(join(OUT, o.file))), ...index];
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(merged, null, 2) + '\n');
  console.log(`PASS  ${merged.length} entries in .tmp/clips374/index.json`);
} catch (e) {
  console.log(`FAIL  ${e.stack || e}`);
  code = 1;
} finally {
  await browser?.close().catch(() => {});
  server?.stop();
}
process.exit(code);
