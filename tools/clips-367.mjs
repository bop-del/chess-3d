// CHE-367: stills and clips of the preview piece sets (?pieces=fantasy|animals) from the real game.
// Usage:
//   node tools/clips-367.mjs stills --set=fantasy [--theme=classic] [--views=lineup,side,top,board,phone,close-k] [--out=.tmp/stills367]
//   node tools/clips-367.mjs clips [--only=spin-fantasy-classic,...]      writes .tmp/clips367/ (turntables, board, capture mp4 with posters, phone stills) and its index.json
// stills: one PNG per view into <out>/<set>-<theme>-<view>.png. Views: lineup (white row in front, black row behind, 3/4 from the
//   white side), side (the same rows from the h file), top (from above), back (the lineup from the black side), board (start position,
//   the default camera, 1280x720), phone (start position, 390x844 portrait, touch), close-<type> (white and black of one type side by side, front)
//   and closeback-<type> (the same from behind).
// Stills run on a vite dev server of this lane (its own port), clips on a preview of a fresh build, manual mode, GPU through launchBrowser(); one render at a time
// (a lock in .tmp/clips367.lock queues parallel callers). Exit 0 done, 1 a render failed.
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, build, launchBrowser, sleep, startServer, watchPage, waitReady } from './_lib.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const HIDE = '#hud,#banner,#promo,#toast,#notice,#loader,.install-hint,.ih-overlay,#news,.update-banner{display:none!important}';
const FEN_LINEUP = '8/8/1kqbnrp1/8/8/1KQBNRP1/8/8 w - - 0 1';
const FEN_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const focusFen = (t) => {
  const W = t.toUpperCase(), B = t;
  if (t === 'k') return '8/8/8/8/3Kk3/8/8/8 w - - 0 1';
  return `7k/8/8/8/3${W}${B}3/8/8/K7 w - - 0 1`;
};

// ---- one render at a time across the lane (subagents call this tool in parallel)
const LOCK = join(ROOT, '.tmp', 'clips367.lock');
async function lock() {
  mkdirSync(join(ROOT, '.tmp'), { recursive: true });
  let said = false;
  for (;;) {
    try { mkdirSync(LOCK); writeFileSync(join(LOCK, 'pid'), String(process.pid)); return; } catch (e) {
      let pid = 0; try { pid = Number(readFileSync(join(LOCK, 'pid'), 'utf8')); } catch (e2) { /* being written */ }
      let alive = true; try { if (pid) process.kill(pid, 0); } catch (e3) { alive = false; }
      if (pid && !alive) { rmSync(LOCK, { recursive: true, force: true }); continue; }
      if (!said) { console.log('queued: another render of this lane holds the lock'); said = true; }
      await sleep(1000);
    }
  }
}
const unlock = () => { try { if (Number(readFileSync(join(LOCK, 'pid'), 'utf8')) === process.pid) rmSync(LOCK, { recursive: true, force: true }); } catch (e) { /* ignore */ } };

// ---- page side: frame the camera (gimbal space = world space, the gimbal stays at rest)
function frame({ pos, at, fov }) {
  const C = window.__chess, cam = C.stage.camera;
  C.step(0.6);
  if (pos) {
    C.controls.enabled = false;
    cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(...pos); cam.lookAt(...at);
  }
  C.draw(); C.draw();
}
const FILES = { k: 1, q: 2, b: 3, n: 4, r: 5, p: 6 };
const CAMS = {
  lineup: { pos: [0, 3.6, 8.2], at: [0, 0.75, 0], fov: 30 },
  back: { pos: [0, 3.6, -8.2], at: [0, 0.75, 0], fov: 30 },
  side: { pos: [8.6, 2.6, 0], at: [0, 0.75, 0], fov: 30 },
  top: { pos: [0, 10.5, 2.2], at: [0, 0.4, 0], fov: 30 },
};

async function openPage(page, base, q, size) {
  await page.setViewport(size.phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: size.w, height: size.h, deviceScaleFactor: 1 });
  await page.goto(`${base}?${q}`, { waitUntil: 'load', timeout: 120000 });
  const r = await waitReady(page, { timeout: 90000 });
  if (!r.ready) throw new Error(`page not ready: ${r.why}`);
  await page.addStyleTag({ content: HIDE });
}

async function stills(browser, base) {
  const set = opt('set', 'fantasy'), theme = opt('theme', 'classic');
  const out = join(ROOT, opt('out', '.tmp/stills367'));
  const views = opt('views', 'lineup,side,top,board,phone').split(',');
  mkdirSync(out, { recursive: true });
  const common = `pieces=${set}&theme=${theme}&quality=high&manual=1&ai=0&hud=0&intro=0&sound=0`;
  const errs = [];
  for (const v of views) {
    // a fresh tab per view: a second load in the same tab can stall on the texture cache the old document still holds
    let page = await browser.newPage();
    let watch = await watchPage(page);
    const [kind, t] = v.split('-');
    let q, cam = null, size = { w: 1280, h: 720 };
    if (CAMS[kind]) { q = `${common}&fen=${encodeURIComponent(FEN_LINEUP)}`; cam = CAMS[kind]; }
    else if (kind === 'close' || kind === 'closeback') {
      q = `${common}&fen=${encodeURIComponent(focusFen(t))}`;
      const H = { p: 0.9, r: 1.0, n: 1.2, b: 1.35, q: 1.6, k: 1.85 }[t] || 1.4;
      const s = kind === 'close' ? 1 : -1;
      cam = { pos: [0.9 * s, H * 0.7 + 0.6, -0.5 + s * (3.0 + H * 1.5)], at: [0, H * 0.45, -0.5], fov: 30 };
    } else if (kind === 'board') q = `${common}&fen=${encodeURIComponent(FEN_START)}&view=white`;
    else if (kind === 'phone') { q = `${common.replace('quality=high', 'quality=low')}&touch=1`; size = { phone: true }; }
    else { console.error(`unknown view ${v}`); continue; }
    // a piece file saved by a parallel agent can make the dev server reload the page mid boot: one more try then
    for (let tryNo = 1; ; tryNo++) {
      try { await openPage(page, base, q, size); break; } catch (e) {
        if (tryNo >= 3) throw e;
        console.log(`retry ${v} in a fresh tab: ${e.message.slice(0, 80)}`);
        await page.close().catch(() => {});
        page = await browser.newPage(); watch = await watchPage(page);
      }
    }
    await page.evaluate(frame, cam || {});
    await sleep(100);
    const file = join(out, `${set}-${theme}-${v}.png`);
    writeFileSync(file, await page.screenshot({ type: 'png' }));
    console.log(`${file.slice(ROOT.length + 1)}`);
    errs.push(...watch.errs);
    await page.close();
  }
  if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
  return errs.length ? 1 : 0;
}

// ---- clips: frames from __chess.step()/.draw() screenshots, stitched to H.264 with ffmpeg
const CLIP_W = 480, CLIP_H = 360, FPS = 25, SECS = 4;
async function clipFrames(page, dir, n, perFrame) {
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) {
    await perFrame(i);
    writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), await page.screenshot({ type: 'png' }));
  }
}
function stitch(dir, mp4, poster, posterFrame) {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-crf', '20', '-movflags', '+faststart', '-vf', `scale=${CLIP_W}:-2`, mp4]);
  writeFileSync(poster, readFileSync(join(dir, `f${String(posterFrame).padStart(4, '0')}.png`)));
}

// page side: a pedestal turn. The six white pieces stand in a ring on the board, the camera circles them.
function spinPose({ i, n, mode }) {
  const C = window.__chess, cam = C.stage.camera;
  if (i === 0) C.controls.enabled = false;
  C.step(1 / 25);   // first: a step re-applies the controls' camera, the pose below wins for the draw
  const a = (i / n) * Math.PI * 0.9 - 0.45;
  if (mode === 'spin') { cam.fov = 30; cam.updateProjectionMatrix(); const R = 8.8; cam.position.set(Math.sin(a) * R, 3.2, 0 + Math.cos(a) * R); cam.lookAt(0, 0.8, 0); }
  else if (mode === 'board') { cam.fov = 34; cam.updateProjectionMatrix(); const R = 13; const b = a * 0.5; cam.position.set(Math.sin(b) * R, 7.5, Math.cos(b) * R); cam.lookAt(0, 0.2, 0); }
  C.draw();
}

async function clips(browser, base) {
  const out = join(ROOT, '.tmp/clips367');
  mkdirSync(out, { recursive: true });
  const only = opt('only', '');
  const errs = [];
  const index = existsSync(join(out, 'index.json')) ? JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')) : [];
  const put = (e) => { const i = index.findIndex((x) => x.file === e.file); if (i >= 0) index[i] = e; else index.push(e); };
  const DE = { fantasy: 'Fantasy', animals: 'Tiere' };
  const THEME_DE = { classic: 'Klassisch', tournament: 'Turnier', wood: 'Holz', metal: 'Metall', glass: 'Glas' };
  const jobs = [];
  for (const set of ['fantasy', 'animals']) {
    for (const theme of set === 'fantasy' ? ['classic', 'metal'] : ['classic', 'wood']) jobs.push({ id: `spin-${set}-${theme}`, set, theme, kind: 'spin', de: `${DE[set]}: alle Figuren drehen sich langsam, Thema ${THEME_DE[theme]}` });
    jobs.push({ id: `board-${set}`, set, theme: 'classic', kind: 'board', de: `${DE[set]}: die Figuren auf dem Brett in der Startstellung` });
    jobs.push({ id: `capture-${set}`, set, theme: 'classic', kind: 'capture', de: `${DE[set]}: ein Schlag mit Kampfszene (Springer schlägt Läufer)` });
    jobs.push({ id: `phone-${set}`, set, theme: 'classic', kind: 'phone', de: `${DE[set]}: Startstellung auf dem Handy (390 x 844, hochkant)` });
  }
  for (const j of jobs) {
    if (only && !only.split(',').includes(j.id)) continue;
    const common = `pieces=${j.set}&theme=${j.theme}&quality=high&manual=1&hud=0&intro=0&sound=0`;
    const dir = join(ROOT, '.tmp', 'frames367', j.id);
    let q;
    if (j.kind === 'spin') q = `${common}&ai=0&fen=${encodeURIComponent(FEN_LINEUP)}`;
    else if (j.kind === 'board') q = `${common}&ai=0`;
    else q = `${common}&ai=0&fen=${encodeURIComponent('4k3/8/8/3b4/8/4N3/8/4K3 w - - 0 1')}`;
    if (j.kind === 'phone') q = `${common.replace('quality=high', 'quality=low')}&ai=0&touch=1`;
    // a fresh tab per clip: a second load in the same tab can stall on the texture cache the old document still holds
    const page = await browser.newPage();
    const watch = await watchPage(page, undefined, { scenes: true });
    await openPage(page, base, q, j.kind === 'phone' ? { phone: true } : { w: CLIP_W * 2, h: CLIP_H * 2 });
    const n = FPS * SECS;
    if (j.kind === 'phone') {
      await page.evaluate(frame, {});
      writeFileSync(join(out, `${j.id}.png`), await page.screenshot({ type: 'png' }));
      put({ file: `${j.id}.png`, poster: `${j.id}.png`, kind: 'phone still', variant: j.set, flag: `?pieces=${j.set}&touch=1`, de: j.de });
      console.log(`${j.id}.png`);
      errs.push(...watch.errs); await page.close();
      continue;
    } else if (j.kind === 'capture') {
      await page.evaluate(() => { const C = window.__chess; C.step(0.6); C.draw(); });
      await page.evaluate(async () => { const { battle, game } = window.__chess; battle.settings.set({ mode: 'on' }); await battle.ready(); game.move('e3', 'd5'); });
      await clipFrames(page, dir, FPS * 6, async () => { await page.evaluate(async () => { await window.__chess.stepAsync(1 / 25); window.__chess.draw(); }); });
      stitch(dir, join(out, `${j.id}.mp4`), join(out, `${j.id}.png`), FPS * 3);
    } else {
      await clipFrames(page, dir, n, (i) => page.evaluate(spinPose, { i, n, mode: j.kind }));
      stitch(dir, join(out, `${j.id}.mp4`), join(out, `${j.id}.png`), Math.round(n / 2));
    }
    put({ file: `${j.id}.mp4`, poster: `${j.id}.png`, kind: j.kind === 'spin' ? 'turntable' : j.kind, variant: j.set, flag: `?pieces=${j.set}&theme=${j.theme}`, de: j.de });
    console.log(`${j.id}.mp4  ${statSync(join(out, `${j.id}.mp4`)).size} bytes`);
    errs.push(...watch.errs); await page.close();
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  if (errs.length) console.log('page errors:', errs.slice(0, 5).join(' | '));
  return errs.length ? 1 : 0;
}

if (cmd !== 'stills' && cmd !== 'clips') { console.error('usage: node tools/clips-367.mjs stills|clips [options], see the head of the file'); process.exit(2); }
let server = null, browser = null, code = 0;
await lock();
try {
  // stills: the dev server (the piece agents' latest files); clips: a fixed build, so a file saved meanwhile cannot reload the page mid clip
  if (cmd === 'clips') { build('.tmp/clips367-dist'); server = await startServer({ mode: 'preview', outDir: '.tmp/clips367-dist' }); }
  else server = await startServer({ mode: 'dev' });
  browser = await launchBrowser({ w: 1280, h: 720 });
  code = cmd === 'stills' ? await stills(browser, server.base) : await clips(browser, server.base);
} catch (e) {
  console.error(e.stack || e.message || e); code = 1;
} finally {
  await browser?.close().catch(() => {});
  await server?.stop?.();
  unlock();
}
process.exit(code);
