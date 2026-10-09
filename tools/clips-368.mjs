// CHE-368 preview clips and stills of the ?pieces= sets (crystal, mech) for the owner's review page.
// Usage: node tools/clips-368.mjs [--only=crystal,mech] [--kinds=pedestal,board,capture,phone] [--stills] [--out=.tmp/clips368] [--tag=x]
//   --stills  one PNG per kind (pedestal and board at 960x600, phone at 390x844), no video: the quick look while building
// Without --stills: about 4 s per clip, 480 px wide, H.264 mp4 plus a poster PNG, and the 390x844 phone still, listed in
// <out>/index.json. Deterministic: ?manual=1, quality=high, frames stepped with __chess.step and stitched by ffmpeg.
// Real build, served from the lane's own preview port, one headless Chrome through launchBrowser() (tools/_lib.mjs).
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, build, claimPort, launchBrowser, startServer, watchPage } from './_lib.mjs';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const STILLS = argv.includes('--stills');
const OUT = join(ROOT, opt('out', '.tmp/clips368'));
const DIST = `.tmp/clips368-dist${opt('tag', '') ? '-' + opt('tag', '') : ''}`;   // --tag=x: a build of its own, so two agents never share one
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FPS = 24, SECS = 4;

export const VARIANTS = [
  { id: 'crystal', q: 'pieces=crystal', de: 'Kristall: Smaragd gegen Amethyst, grün gegen violett' },
  { id: 'mech', q: 'pieces=mech', de: 'Mechs: Roboter mit Panzerplatten und leuchtenden Augen, Bauer als Drohne, Turm als Geschützturm' },
];
const KINDS = opt('kinds', 'pedestal,board,capture,phone').split(',');
const ONLY = opt('only', '') ? opt('only', '').split(',') : VARIANTS.map((v) => v.id);
// the capture: white knight takes a black bishop in the middle, both sides in view
const CAP = { fen: 'r2qk2r/ppp2ppp/2n5/3b4/8/2N5/PPP2PPP/R2QK2R w KQkq - 0 1', from: 'c3', to: 'd5' };

// ---------------------------------------------------------------- in page scenes
// pedestal: the board and the game's pieces hidden, the six white pieces in a front arc and the six black ones behind it on a round stand
function setupPedestal() {
  const C = window.__chess, { THREE, stage, gimbal } = C, style = window.__pieceStyle;
  C.step(0.5);
  gimbal.visible = false;
  const ped = new THREE.Group();
  ped.name = 'pedestal368';
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 0.4, 64), new THREE.MeshStandardMaterial({ color: '#2a2f3a', roughness: 0.35, metalness: 0.4 }));
  stand.position.y = -0.2; stand.receiveShadow = true;
  ped.add(stand);
  const pieces = new THREE.Group();
  ped.add(pieces);
  const order = ['p', 'n', 'b', 'r', 'q', 'k'];
  order.forEach((type, i) => {
    for (const color of ['w', 'b']) {
      const wrap = new THREE.Group();
      const inner = style.make(type, color);
      inner.rotation.y = Math.PI + (type === 'n' ? (color === 'w' ? -0.9 : 0.9) : 0);   // a showcase: every face to the camera, the knights three quarter so the horse profile shows
      wrap.add(inner);
      // two rows by height, white in front, black behind and shifted half a step so every piece shows
      wrap.position.set((i - 2.5) * 0.92 + (color === 'w' ? 0 : 0.46), 0, color === 'w' ? 0.8 : -1.0);
      pieces.add(wrap);
    }
  });
  stage.scene.add(ped);
  window.__ped = { ped, pieces };
}
function pedestalFrame({ i, fps }) {
  const C = window.__chess, cam = C.stage.camera, { ped, pieces } = window.__ped;
  window.__pieceStyle.update(1 / fps, pieces);
  ped.rotation.y = -0.5 + i / fps * 0.28;
  cam.fov = 30; cam.updateProjectionMatrix();
  cam.position.set(0, 5.2, 10.2); cam.lookAt(0, 0.7, -0.1);
  C.draw();
}
function boardFrame({ i, fps, orbit }) {
  const C = window.__chess, DEG = Math.PI / 180;
  C.controls.setCamera({ yaw: (-20 + (orbit ? i / fps * 9 : 0)) * DEG, pitch: 30 * DEG, dist: 13 });
  C.step(1 / fps);
  C.draw();
}

async function waitGame(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 180000 });
  const err = await page.evaluate(() => window.__chessError);
  if (err) throw new Error(`page reported ${err}`);
  await page.addStyleTag({ content: '#hud,#banner,#promo,#toast,#notice,#loader,.install-hint,.ih-overlay,.pbar,.pstatus,.pgood,.viewbar,.update-banner{display:none!important}' });
  const style = await page.evaluate(() => window.__pieceStyle?.id || null);
  if (!style) throw new Error('no forced piece style on the page');
}

function encode(dir, mp4) {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-vf', 'scale=480:-2:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
}

let server = null, browser = null, claim = null, code = 0;
const index = [];
try {
  mkdirSync(OUT, { recursive: true });
  build(DIST);
  claim = await claimPort();
  server = await startServer({ mode: 'preview', outDir: DIST, port: claim.port });
  browser = await launchBrowser({ w: 960, h: 600 });
  const page = await browser.newPage();
  const watch = await watchPage(page);
  const base = (v, extra = '') => `${server.base}?${v.q}&quality=high&manual=1&ai=0&hud=0&intro=0&music=0&sound=0${extra}`;
  for (const v of VARIANTS.filter((x) => ONLY.includes(x.id))) {
    for (const kind of KINDS) {
      const t0 = Date.now();
      const phone = kind === 'phone';
      // the clips are 480 px wide: recorded at 960x600 and scaled down, so thin panel lines and facets stay crisp
      await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2 } : { width: 960, height: 600, deviceScaleFactor: 1 });
      const extra = kind === 'capture' ? `&fen=${encodeURIComponent(CAP.fen)}` : phone ? '&touch=1&view=play' : '';
      const url = base(v, extra);
      // the phone still shows what a phone gets: Medium (no transmission), not the High of the clips
      await waitGame(page, phone ? url.replace('quality=high', 'quality=medium') : url);
      const name = `${v.id}-${kind}`;
      const shot = async (file) => writeFileSync(file, await page.screenshot({ type: 'png' }));
      if (phone) {
        await page.evaluate(async () => { await window.__chess.stepAsync(1); window.__chess.draw(); });
        await shot(join(OUT, `${name}.png`));
        index.push({ file: `${name}.png`, poster: `${name}.png`, kind, variant: v.id, flag: `?${v.q}&touch=1`, de: `${v.de}. Handy hochkant.` });
        console.log(`${name}.png  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        continue;
      }
      if (kind === 'pedestal') await page.evaluate(setupPedestal);
      else await page.evaluate(async () => { await window.__chess.stepAsync(0.8); });
      const frame = async (i) => {
        if (kind === 'pedestal') await page.evaluate(pedestalFrame, { i, fps: FPS });
        else if (kind === 'board') await page.evaluate(boardFrame, { i, fps: FPS, orbit: true });
        else await page.evaluate(async ({ fps }) => { await window.__chess.stepAsync(1 / fps); window.__chess.draw(); }, { fps: FPS });
      };
      if (kind === 'capture') {
        await page.evaluate(({ from, to }) => {
          const C = window.__chess, DEG = Math.PI / 180;
          C.battle.settings.set({ mode: 'on' });
          C.controls.setCamera({ yaw: -25 * DEG, pitch: 34 * DEG, dist: 12 });
          C.game.move(from, to);
        }, CAP);
      }
      if (STILLS) {
        const at = kind === 'capture' ? Math.round(FPS * 2.2) : Math.round(FPS * 1.5);
        for (let i = 0; i < at; i++) {
          if (kind === 'pedestal' && i < at - 1) await page.evaluate(({ fps }) => window.__pieceStyle.update(1 / fps, window.__ped.pieces), { fps: FPS });
          else await frame(i);
        }
        await shot(join(OUT, `${name}.png`));
        console.log(`${name}.png  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        continue;
      }
      const dir = join(ROOT, '.tmp', 'clips368-frames', name);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const n = kind === 'capture' ? FPS * 5 : FPS * SECS;
      for (let i = 0; i < n; i++) { await frame(i); await shot(join(dir, `f${String(i).padStart(4, '0')}.png`)); }
      encode(dir, join(OUT, `${name}.mp4`));
      const poster = Math.floor(n * (kind === 'capture' ? 0.45 : 0.5));
      writeFileSync(join(OUT, `${name}.png`), readFileSync(join(dir, `f${String(poster).padStart(4, '0')}.png`)));
      const de = { pedestal: 'alle Figuren drehen sich auf einem Sockel', board: 'Startaufstellung auf dem Brett', capture: 'ein Schlag: Springer nimmt Läufer' }[kind];
      index.push({ file: `${name}.mp4`, poster: `${name}.png`, kind, variant: v.id, flag: `?${v.q}${kind === 'capture' ? `&ai=0&fen=${encodeURIComponent(CAP.fen)}` : ''}`, de: `${v.de}: ${de}.` });
      console.log(`${name}.mp4  ${n} frames  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
  }
  if (watch.errs.length) { console.log('page errors:', watch.errs.slice(0, 5).join(' | ')); code = 1; }
  if (!STILLS) {
    const file = join(OUT, 'index.json');
    let old = [];
    try { old = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
    const keep = old.filter((e) => !index.some((x) => x.file === e.file));
    writeFileSync(file, JSON.stringify([...keep, ...index], null, 2) + '\n');
  }
} catch (e) {
  console.error(e.stack || e.message || e); code = 1;
} finally {
  await browser?.close().catch(() => {});
  await server?.stop?.();
  claim?.release();
}
process.exit(code);
