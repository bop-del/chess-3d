// Renders the app icons and the link preview image from the game itself (headless Chrome, software GL).
// Usage: node tools/render-assets.mjs variants [--out=.tmp/install/variants] [--port=5361]
//        node tools/render-assets.mjs final --icon=<variant> [--port=5361]
//   variants  renders every icon variant at 512 px into --out and a contact sheet, to choose from. Writes nothing to public/.
//   final     renders the chosen variant as the icon set and the preview into public/ (see FINAL below). Regenerate on demand,
//             the PNGs are committed. They are the only asset files in the repo.
// Files written by `final`:
//   public/icon-512.png, public/icon-192.png, public/apple-touch-icon.png (180), public/icon-maskable-512.png (artwork inside
//   the 80 percent safe circle, background to the edge), public/og-image.png (1200 x 630)
// The page is built into .tmp/assets-dist and served with vite preview. The scene is the real board and knight, only the camera,
// the lights and which pieces are visible are set from here through window.__chess (manual mode, one drawn frame per image).
// Exit codes: 0 done, 1 a render failed, 2 usage or setup error.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, build, launchBrowser, sleep, startServer, watchPage } from './_lib.mjs';
import { contactSheets } from './contact-sheet.mjs';

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const PORT = Number(opt('port', 5361));
const OUT = join(ROOT, opt('out', '.tmp/install/variants'));
const DIST = '.tmp/assets-dist';

// A scene is: FEN, camera, light preset, backdrop and extras. `all` shows every piece of the FEN, otherwise only the knight on d4.
// orbit() turns yaw (0 = seen from white's side), pitch (above the board) and distance into a camera position, in gimbal space
// (the board is centred, y up, white at +z).
const orbit = (yaw, pitch, dist, at = [0, 0, 0.2]) => {
  const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
  return [at[0] + dist * Math.cos(p) * Math.sin(y), at[1] + dist * Math.sin(p), at[2] + dist * Math.cos(p) * Math.cos(y)];
};
const AT = [0, 0, 0.2];
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MID = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';   // Italian game, both knights out
const VARIANTS = {
  // the full start position from a steep three quarter angle on the dark studio backdrop
  start: () => ({ all: true, fen: START, light: 'Studio', board: true, floor: true, cam: { pos: orbit(18, 52, 20.6), at: AT, fov: 30 } }),
  // the whole board seen from almost straight above, tilted slightly, low dramatic light for long shadows
  topdown: () => ({ all: true, fen: START, light: 'Sunset', board: true, floor: true, cam: { pos: orbit(10, 74, 20.6), at: AT, fov: 30 } }),
  // the board floating, angled, a soft gold rim light on deep blue
  float: () => ({
    all: true, fen: START, light: 'Studio', board: true, floor: false, rim: '#f0c868', tilt: [0.06, 0.1],
    cam: { pos: orbit(32, 36, 22.4, [0, 0, 1.0]), at: [0, 0, 1.0], fov: 30 },
    bg: { top: '#16337a', bottom: '#071433', glow: '#2f58b8' },
  }),
  // a mid game position, knights out, three quarter angle
  midgame: () => ({ all: true, fen: MID, light: 'Studio', board: true, floor: true, cam: { pos: orbit(-28, 46, 20.6), at: AT, fov: 30 } }),
};

// Runs inside the page: arranges the scene for one image, then draws.
function arrange(spec) {
  const { stage, gimbal, board, controls, THREE } = window.__chess;
  stage.setLightingPreset(spec.light);
  window.__chess.step(2.2);                       // finish the light transition
  const pieces = gimbal.getObjectByName('pieces');
  const keep = board.squareCenter(3, 3);          // d4
  const bgTex = stage.scene.background;
  for (const g of pieces.children) {
    const here = Math.abs(g.position.x - keep.x) < 0.1 && Math.abs(g.position.z - keep.z) < 0.1 && g.visible;
    if (spec.all) continue;
    if (!here) g.visible = false;
    else {
      g.traverse((o) => {
        if (!o.isMesh || !o.material || o.material.visible === false) return;
        if (spec.gold) {
          const gold = new THREE.MeshPhysicalMaterial({ color: '#e0b24a', metalness: 1, roughness: 0.28, clearcoat: 0.5, envMapIntensity: 1.4 });
          o.material = gold;
        } else if (spec.flat) o.material = new THREE.MeshBasicMaterial({ color: spec.flat });
      });
    }
  }
  for (const o of pieces.children) if (o.isMesh) o.visible = false;   // the capture tray slabs and their trim are bare meshes, not part of the picture
  if (!spec.board) board.group.visible = false;
  stage.setFloorVisibility(spec.floor ? 1 : 0);
  if (spec.bg) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, spec.bg.top); g.addColorStop(1, spec.bg.bottom);
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const r = x.createRadialGradient(c.width / 2, c.height * 0.55, 0, c.width / 2, c.height * 0.55, c.width * 0.62);
    r.addColorStop(0, spec.bg.glow + 'cc'); r.addColorStop(1, spec.bg.glow + '00');
    x.fillStyle = r; x.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    stage.scene.background = tex;   // the stage owns the default backdrop texture and repaints it, so use our own
  }
  if (spec.tilt) { gimbal.rotation.x = spec.tilt[0]; gimbal.rotation.z = spec.tilt[1]; }
  if (spec.rim) {
    const rim = new THREE.DirectionalLight(spec.rim, 1.9);
    rim.position.set(-9, 4, -6);
    stage.scene.add(rim);
  }
  const cam = stage.camera;
  cam.fov = spec.cam.fov; cam.updateProjectionMatrix();
  cam.position.set(...spec.cam.pos);
  cam.lookAt(...spec.cam.at);
  window.__chess.draw();
  window.__chess.draw();
}

async function renderShot(page, base, spec, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  const fen = spec.fen || (spec.all ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1');
  await page.goto(`${base}?quality=high&manual=1&ai=0&hud=0&fen=${encodeURIComponent(fen)}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 180000 });
  const err = await page.evaluate(() => window.__chessError);
  if (err) throw new Error('page reported: ' + err);
  // nothing of the HUD may show: the capture is the canvas only
  await page.addStyleTag({ content: '#hud,#banner,#promo,#toast,#notice,#loader,.install-hint,.ih-overlay{display:none!important}' });
  await page.evaluate(arrange, spec);
  await sleep(300);
  return page.screenshot({ type: 'png', omitBackground: false });
}

// Scales a PNG buffer to size x size in the browser with smoothing (no image library in the repo).
async function scalePng(page, buf, size) {
  const b64 = Buffer.from(buf).toString('base64');
  const out = await page.evaluate(async (src, s) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    let cur = document.createElement('canvas'); cur.width = img.width; cur.height = img.height;
    cur.getContext('2d').drawImage(img, 0, 0);
    while (cur.width / 2 >= s) {   // halve until close, for a clean downscale
      const n = document.createElement('canvas'); n.width = cur.width / 2; n.height = cur.height / 2;
      const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
    }
    const f = document.createElement('canvas'); f.width = s; f.height = s;
    const x = f.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, s, s);
    return f.toDataURL('image/png').split(',')[1];
  }, b64, size);
  return Buffer.from(out, 'base64');
}

if (!['variants', 'final'].includes(mode)) { console.error('usage: node tools/render-assets.mjs variants|final [--icon=<variant>] [--out=<dir>] [--port=5361]'); process.exit(2); }
const iconName = opt('icon', '');
if (mode === 'final' && !VARIANTS[iconName]) { console.error(`final needs --icon=${Object.keys(VARIANTS).join('|')}`); process.exit(2); }

let server = null, browser = null, code = 0;
try {
  build(DIST);
  server = await startServer({ mode: 'preview', port: PORT, outDir: DIST });
  browser = await launchBrowser({ w: 512, h: 512 });
  const page = await browser.newPage();
  const watch = await watchPage(page);
  const base = server.base;

  if (mode === 'variants') {
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    for (const [name, make] of Object.entries(VARIANTS)) {
      const png = await renderShot(page, base, make(), 512, 512);
      writeFileSync(join(OUT, `${name}.png`), png);
      console.log(`rendered ${name}`);
    }
    await contactSheets(browser, OUT, { cols: 2, width: 512, compare: false });
    console.log(`variants and contact sheet in ${OUT}`);
  } else {
    const pub = join(ROOT, 'public');
    mkdirSync(pub, { recursive: true });
    const make = VARIANTS[iconName];
    const big = await renderShot(page, base, make(), 512, 512);
    writeFileSync(join(pub, 'icon-512.png'), big);
    writeFileSync(join(pub, 'icon-192.png'), await scalePng(page, big, 192));
    writeFileSync(join(pub, 'apple-touch-icon.png'), await scalePng(page, big, 180));
    // maskable: the same artwork pulled back so it sits inside the 80 percent safe circle
    const m = make(); const d = m.cam.pos.map((v, i) => m.cam.at[i] + (v - m.cam.at[i]) * 1.42); m.cam.pos = d;
    writeFileSync(join(pub, 'icon-maskable-512.png'), await renderShot(page, base, m, 512, 512));
    // preview: a good preset, studio light, the whole board with the knight line up
    const og = await renderShot(page, base, {
      light: 'Studio', board: true, floor: true, all: true,
      cam: { pos: [3.7, 8.2, 12.1], at: [0, 0.1, 0.2], fov: 34 },
    }, 1200, 630);
    writeFileSync(join(pub, 'og-image.png'), og);
    console.log('wrote icon-512, icon-192, apple-touch-icon, icon-maskable-512 and og-image into public/');
  }
  if (watch.errs.length || watch.foreign.length) { console.error('page problems:', [...watch.errs, ...watch.foreign].slice(0, 3)); code = 1; }
} catch (e) {
  console.error(e && e.stack || e); code = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.stop();
}
process.exit(code);
