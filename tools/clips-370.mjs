// CHE-370 preview clips and stills of the backdrop worlds: node tools/clips-370.mjs [--world=hall,space] [--theme=classic,wood]
//   [--stills] (no mp4: three stills per theme, play view, orbit and low, plus the phone still) [--dev] (vite dev server, no build: a
//   half written module of another world does not break it) [--base=http://127.0.0.1:5510/] (use a running server, start none) [--skip-build] [--frames=96] [--out=.tmp/clips370] [--quality=high]
// Per world: a slow camera orbit (about 4 s, 24 fps, 480 px wide mp4 H.264 plus a poster PNG) in each theme, and one phone still
// at 390 x 844 portrait. Deterministic: ?manual=1&quality=high on the GPU renderer through launchBrowser(), __chess.step() and
// .draw() per frame, screenshots stitched with ffmpeg. Writes <out>/index.json (file, poster, kind, variant, theme, flag, de).
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, build, startServer, launchBrowser, watchPage, claimPort } from './_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flag = (n) => args.includes(`--${n}`);
const WORLDS = opt('world', 'hall,space,zen,lava').split(',');
const THEMES = opt('theme', 'classic,wood').split(',');
const FRAMES = Number(opt('frames', '96')), FPS = 24;
const OUT = join(ROOT, opt('out', '.tmp/clips370')), DIST = '.tmp/clips370-dist';
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const DE = {
  hall: 'Fackelhalle: eine Burghalle aus Stein mit Bannern und flackerndem warmem Fackellicht.',
  space: 'Weltraum: das Brett auf einer Plattform im All, mit Planet, Sternen und Nebel.',
  zen: 'Zen-Garten: Kirschblüten, Wasser, Laternen und fallende Blütenblätter.',
  lava: 'Lava: das Brett auf Felsen über glühender Lava, Funken steigen auf.',
};
const THEME_DE = { classic: 'Klassisch', tournament: 'Turnier', wood: 'Holz', metal: 'Metall', glass: 'Glas' };
const DEG = Math.PI / 180;
const QUALITY = opt('quality', 'high');
const HIDE_UI = 'body *{visibility:hidden!important} canvas{visibility:visible!important}';

// inside the page: the camera pose, n steps of game time, then one drawn frame
async function frame(page, pose, dt) {
  await page.evaluate((p, d) => { const C = window.__chess; C.controls.setCamera(p); C.step(d, 1 / d); C.draw(d); }, pose, dt);
}
async function open(page, base, q) {
  await page.goto(`${base}?${q}&quality=${QUALITY}&manual=1&ai=0&intro=0&music=0&sound=0`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 180000 });
  const err = await page.evaluate(() => window.__chessError);
  if (err) throw new Error(`${q}: page reported ${err}`);
  await page.evaluate(async () => { await window.__chess.world?.ready; });
  await page.addStyleTag({ content: '#loader,#toast,#notice,.install-hint,.ih-overlay,#banner{display:none!important}' });
  // settle: the theme light transition and the world's first second
  await page.evaluate(() => { const C = window.__chess; C.step(1.5); for (let i = 0; i < 12; i++) C.stage.render(0.2); C.draw(); });
}

let server = null, browser = null, port = null, code = 0;
const index = existsSync(join(OUT, 'index.json')) ? JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')) : [];
const put = (e) => { const i = index.findIndex((x) => x.file === e.file); if (i >= 0) index[i] = e; else index.push(e); };
try {
  mkdirSync(OUT, { recursive: true });
  if (!flag('skip-build') && !flag('dev') && !opt('base', '')) build(DIST);
  if (opt('base', '')) server = { base: opt('base', '').replace(/\/?$/, '/') };   // a server that already runs (the lane's shared dev server)
  else {
    port = await claimPort({ kind: flag('dev') ? 'dev' : 'preview' });
    server = await startServer({ mode: flag('dev') ? 'dev' : 'preview', port: port.port, outDir: DIST });
  }
  browser = await launchBrowser({ w: 480, h: 320 });
  const page = await browser.newPage();
  const watch = await watchPage(page);
  for (const id of WORLDS) {
    for (const theme of THEMES) {
      const q = `world=${id}&theme=${theme}`;
      await page.setViewport({ width: 480, height: 320, deviceScaleFactor: 2 });
      await open(page, server.base, q);
      await page.addStyleTag({ content: HIDE_UI });
      const name = `${id}-${theme}`, tmp = join(OUT, `.frames-${name}`);
      if (flag('stills')) {
        const views = { play: { yaw: 0, pitch: 46 * DEG, dist: 19 }, orbit: { yaw: 25 * DEG, pitch: 28 * DEG, dist: 22 }, low: { yaw: 90 * DEG, pitch: 10 * DEG, dist: 20 } };
        for (const [v, pose] of Object.entries(views)) {
          await frame(page, pose, 1 / FPS);
          writeFileSync(join(OUT, `${name}-${v}.png`), await page.screenshot({ type: 'png' }));
          if (v === 'play') {
            const info = await page.evaluate(() => { const C = window.__chess, r = C.stage.renderer; r.info.autoReset = false; r.info.reset(); C.stage.renderer.render(C.stage.scene, C.stage.camera); const o = { calls: r.info.render.calls, tris: r.info.render.triangles, points: r.info.render.points }; let wc = 0; C.world?.group?.traverse((x) => { if (x.isMesh || x.isPoints || x.isSprite) wc++; }); r.info.autoReset = true; return { ...o, worldObjects: wc, geometries: r.info.memory.geometries, textures: r.info.memory.textures }; });
            console.log(`${name}: scene draw calls ${info.calls}, triangles ${info.tris}, points ${info.points}, world objects ${info.worldObjects}, geometries ${info.geometries}, textures ${info.textures}`);
          }
        }
        console.log(`${name}: play, orbit, low`);
        continue;
      }
      rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
      const n = FRAMES;
      const t0 = Date.now();
      for (let i = 0; i < n; i++) {
        const k = n > 1 ? i / (n - 1) : 0.5;
        const pose = { yaw: (5 + 50 * k) * DEG, pitch: (30 - 4 * Math.sin(k * Math.PI)) * DEG, dist: 22 - 2 * Math.sin(k * Math.PI) };
        await frame(page, pose, 1 / FPS);
        const buf = await page.screenshot({ type: 'png' });
        writeFileSync(join(tmp, `f${String(i).padStart(4, '0')}.png`), buf);
        if (i === Math.floor(n / 2)) writeFileSync(join(OUT, `${name}.png`), buf);
      }
      const entry = { file: `${name}.mp4`, poster: `${name}.png`, kind: 'clip', variant: id, theme, flag: `?${q}`, de: `${DE[id]} Thema ${THEME_DE[theme] || theme}, langsame Kamerafahrt.` };
      {
        execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(tmp, 'f%04d.png'), '-vf', 'scale=480:-2:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', join(OUT, entry.file)]);
        put(entry);
      }
      rmSync(tmp, { recursive: true, force: true });
      console.log(`${name}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    // phone still: 390 x 844 portrait, the phone layout (touch=1 measures the viewport), HUD on as a player sees it
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    const q = `world=${id}&theme=${THEMES[0]}`;
    await open(page, server.base, `${q}&touch=1`);
    await page.evaluate(() => { const C = window.__chess; C.step(0.5); C.draw(); C.draw(); });
    const file = `${id}-phone.png`;
    writeFileSync(join(OUT, file), await page.screenshot({ type: 'png' }));
    put({ file, poster: file, kind: 'still', variant: id, theme: THEMES[0], flag: `?${q}`, de: `${DE[id]} Handy hochkant (390 x 844), Spielansicht.` });
    console.log(`${file}`);
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  if (watch.errs.length) { console.log('page errors:', watch.errs.slice(0, 5).join(' | ')); code = 1; }
  if (watch.warns.length) console.log('page warnings:', watch.warns.slice(0, 5).join(' | '));
} catch (e) {
  console.error(e.stack || e.message || e); code = 1;
} finally {
  await browser?.close().catch(() => {});
  await server?.stop?.();
  port?.release();
}
process.exit(code);
