// CHE-369 preview clips and stills of the lit capture variants: node tools/clips-369.mjs [--variant=wild]
//   [--theme=wood,glass] [--type=p,n,b,r,q,k] [--no-finale] [--no-phone] [--sheet] (a contact sheet of 8 frames per scene instead
//   of an mp4, for quick looks) [--dev] (vite dev server, no build) [--skip-build] [--out=.tmp/clips369] [--quality=high]
// Per variant and theme: one capture by every attacker type (the scene itself, about 4 s, 24 fps, 480 px wide mp4 H.264 plus a
// poster PNG at the shatter), the checkmate finale per theme, and one phone still per variant at 390 x 844 portrait. Deterministic:
// ?manual=1&quality=high on the GPU renderer through launchBrowser(), __chess.step() and .draw() per frame, screenshots stitched
// with ffmpeg. Writes <out>/index.json (file, poster, kind, variant, theme, flag, de).
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, build, startServer, launchBrowser, watchPage, claimPort } from './_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flag = (n) => args.includes(`--${n}`);
const VARIANTS = opt('variant', 'wild').split(',');
const THEMES = opt('theme', 'wood,glass').split(',');
const TYPES = opt('type', 'p,n,b,r,q,k').split(',');
const FPS = 24, MAX_FRAMES = 6.5 * FPS;
const OUT = join(ROOT, opt('out', '.tmp/clips369')), DIST = '.tmp/clips369-dist';
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const QUALITY = opt('quality', 'high');
const HIDE_UI = 'body *{visibility:hidden!important} canvas{visibility:visible!important}';
// white attacker from its square onto d5, a black victim there (the victim differs per attacker so every material size shows)
const FEN = {
  p: ['4k3/8/8/3V4/4P3/8/8/4K3 w - - 0 1', 'e4', 'd5', 'n'],
  n: ['4k3/8/8/3V4/8/2N5/8/4K3 w - - 0 1', 'c3', 'd5', 'b'],
  b: ['4k3/8/8/3V4/8/5B2/8/4K3 w - - 0 1', 'f3', 'd5', 'q'],
  r: ['4k3/8/8/3V4/8/8/8/3RK3 w - - 0 1', 'd1', 'd5', 'r'],
  q: ['4k3/8/8/3V4/8/3Q4/8/4K3 w - - 0 1', 'd3', 'd5', 'n'],
  k: ['k7/8/8/3V4/4K3/8/8/8 w - - 0 1', 'e4', 'd5', 'p'],
};
const MATE = ['6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1', 'a8'];
const NAME_DE = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
const DO_DE = {
  wild: { p: 'kämpft mit der Lanze', n: 'kämpft mit dem Schwert', b: 'kämpft mit dem Stab', r: 'kämpft mit dem Streitkolben', q: 'kämpft mit dem Schwert und Magie', k: 'kämpft mit dem großen Schwert' },
};
const THEME_DE = { classic: 'Klassisch', tournament: 'Turnier', wood: 'Holz', metal: 'Metall', glass: 'Glas' };
const VAR_DE = { wild: 'Wild' };

async function open(page, base, q) {
  await page.goto(`${base}?${q}&quality=${QUALITY}&manual=1&ai=0&intro=0&music=0&sound=0`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 180000 });
  const err = await page.evaluate(() => window.__chessError);
  if (err) throw new Error(`${q}: page reported ${err}`);
  await page.addStyleTag({ content: '#loader,#toast,#notice,.install-hint,.ih-overlay{display:none!important}' });
  await page.evaluate(async () => {
    const C = window.__chess;
    try { localStorage.setItem('chess3d.battle', '{"mode":"on"}'); } catch (e) { /* ignore */ }
    C.battle.settings.set({ mode: 'on' });
    await C.battle.ready();
    C.step(1.5); for (let i = 0; i < 12; i++) C.stage.render(0.2); C.draw();
  });
}
// set the position up and make the move; the scene starts on the next steps
async function start(page, fen, from, to) {
  await page.evaluate(async (fen, from, to) => {
    const C = window.__chess;
    C.game.loadFen(fen);
    await C.stepAsync(0.6);
    C.draw();
    C.game.move(from, to);
  }, fen, from, to);
}
// one frame: step game time, draw; returns the page state
const tick = (page) => page.evaluate(async (dt) => {
  const C = window.__chess;
  await C.stepAsync(dt);
  C.draw();
  const ctx = C.battle.lastCtx;
  return { busy: C.game.busy, active: C.battle.active, finale: !!C.battle.finale?.active, hidden: ctx ? !ctx.victimObj.group.visible : false };
}, 1 / FPS);

// record frames until the scene (or finale) is over plus a short tail; returns the frame files and the index of the shatter
async function record(page, tmp, { finale = false, sheet = false } = {}) {
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  let i = 0, shatter = -1, tail = 0, seen = false, first = -1;
  while (i < MAX_FRAMES) {
    const st = await tick(page);
    const on = finale ? st.finale : st.active;
    if (on) { seen = true; if (first < 0) first = i; }
    if (shatter < 0 && st.hidden && st.active) shatter = i;
    writeFileSync(join(tmp, `f${String(i).padStart(4, '0')}.png`), await page.screenshot({ type: 'png' }));
    i++;
    if (seen && !on && ++tail > 6) break;
    if (!seen && i > 24 * 3) break;   // nothing played
  }
  // the clip: from a few frames before the scene starts to a few after it ends, renumbered from 0
  const from = Math.max(0, first - 3);
  if (from > 0) for (let k = from; k < i; k++) renameSync(join(tmp, `f${String(k).padStart(4, '0')}.png`), join(tmp, `f${String(k - from).padStart(4, '0')}.png`));
  return { n: i - from, shatter: shatter < 0 ? -1 : shatter - from, seen };
}
function encode(tmp, out) {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%04d.png'), '-vf', 'scale=480:-2:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out]);
}
// 8 frames spread over the clip in a 4 x 2 grid (for a quick look at a whole scene)
function contact(tmp, n, out) {
  const pick = Array.from({ length: 8 }, (_, k) => Math.min(n - 1, Math.round((k / 7) * (n - 1))));
  const inputs = pick.flatMap((p) => ['-i', join(tmp, `f${String(p).padStart(4, '0')}.png`)]);
  const filter = pick.map((_, k) => `[${k}:v]scale=480:-2[s${k}]`).join(';') + ';' + pick.map((_, k) => `[s${k}]`).join('') + 'xstack=inputs=8:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0[o]';
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[o]', out]);
}

let server = null, browser = null, port = null, code = 0;
const index = existsSync(join(OUT, 'index.json')) ? JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')) : [];
const put = (e) => { const i = index.findIndex((x) => x.file === e.file); if (i >= 0) index[i] = e; else index.push(e); };
try {
  mkdirSync(OUT, { recursive: true });
  if (!flag('skip-build') && !flag('dev')) build(DIST);
  port = await claimPort({ kind: flag('dev') ? 'dev' : 'preview' });
  server = await startServer({ mode: flag('dev') ? 'dev' : 'preview', port: port.port, outDir: DIST });
  browser = await launchBrowser({ w: 480, h: 320 });
  const page = await browser.newPage();
  const watch = await watchPage(page, undefined, { scenes: true });
  const sheet = flag('sheet');
  for (const variant of VARIANTS) {
    for (const theme of THEMES) {
      const q = `capture=${variant}&theme=${theme}`;
      await page.setViewport({ width: 480, height: 320, deviceScaleFactor: 2 });
      await open(page, server.base, q);
      await page.addStyleTag({ content: HIDE_UI });
      for (const type of TYPES) {
        const [fen, from, to, vic] = FEN[type];
        const name = `${variant}-${theme}-${type}`, tmp = join(OUT, `.frames-${name}`);
        const t0 = Date.now();
        await start(page, fen.replace('V', vic), from, to);
        const r = await record(page, tmp, { sheet });
        const posterAt = Math.min(r.n - 1, r.shatter >= 0 ? r.shatter + 4 : Math.floor(r.n / 2));
        execFileSync('cp', [join(tmp, `f${String(posterAt).padStart(4, '0')}.png`), join(OUT, `${name}.png`)]);
        if (sheet) contact(tmp, r.n, join(OUT, `${name}-sheet.png`));
        else {
          encode(tmp, join(OUT, `${name}.mp4`));
          put({ file: `${name}.mp4`, poster: `${name}.png`, kind: 'clip', variant, theme, flag: `?${q}`, de: `${VAR_DE[variant]}, ${THEME_DE[theme]}: der ${NAME_DE[type]} ${DO_DE[variant][type]}, dann zerspringt die Figur in Splitter.` });
        }
        rmSync(tmp, { recursive: true, force: true });
        console.log(`${name}: ${r.n} frames, shatter at frame ${r.shatter}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      }
      // the checkmate finale (the same in both variants: recorded once per theme, under the first variant)
      if (!flag('no-finale') && variant === VARIANTS[0]) {
        const name = `finale-${theme}`, tmp = join(OUT, `.frames-${name}`);
        await page.evaluate(() => window.__chess.game.newGame({ instant: true }));
        await start(page, MATE[0], MATE[1], MATE[2]);
        const r = await record(page, tmp, { finale: true, sheet });
        execFileSync('cp', [join(tmp, `f${String(Math.min(r.n - 1, Math.round(1.95 * FPS))).padStart(4, '0')}.png`), join(OUT, `${name}.png`)]);
        if (sheet) contact(tmp, r.n, join(OUT, `${name}-sheet.png`));
        else {
          encode(tmp, join(OUT, `${name}.mp4`));
          put({ file: `${name}.mp4`, poster: `${name}.png`, kind: 'clip', variant: 'finale', theme, flag: `?${q}`, de: `Schachmatt-Finale, ${THEME_DE[theme]}: der König kippt um, bekommt leuchtende Risse, Splitter fliegen. In Ruhig und Wild gleich.` });
        }
        rmSync(tmp, { recursive: true, force: true });
        console.log(`${name}: ${r.n} frames${r.seen ? '' : ' (NO FINALE SEEN)'}`);
        if (!r.seen) code = 1;
      }
    }
    // phone still: 390 x 844 portrait as a player sees it, a frame just after the shatter of a knight capture
    if (!flag('no-phone')) {
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      const q = `capture=${variant}&theme=${THEMES[0]}`;
      await open(page, server.base, `${q}&touch=1`);
      const [fen, from, to, vic] = FEN.n;
      await start(page, fen.replace('V', vic), from, to);
      let st, i = 0, after = -1;
      while (i++ < MAX_FRAMES) { st = await tick(page); if (st.hidden && after < 0) after = 0; if (after >= 0 && ++after > 5) break; }
      const file = `${variant}-phone.png`;
      writeFileSync(join(OUT, file), await page.screenshot({ type: 'png' }));
      put({ file, poster: file, kind: 'still', variant, theme: THEMES[0], flag: `?${q}`, de: `${VAR_DE[variant]}, Handy hochkant (390 x 844): der Moment, in dem die Figur zerspringt.` });
      console.log(file);
      while (i++ < MAX_FRAMES * 2) { st = await tick(page); if (!st.busy && !st.active) break; }
    }
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  if (watch.errs.length) { console.log('page errors:', watch.errs.slice(0, 5).join(' | ')); code = 1; }
  if (watch.warns.length) console.log('page warnings:', [...new Set(watch.warns)].slice(0, 5).join(' | '));
} catch (e) {
  console.error(e.stack || e.message || e); code = 1;
} finally {
  await browser?.close().catch(() => {});
  await server?.stop?.();
  port?.release();
}
process.exit(code);
