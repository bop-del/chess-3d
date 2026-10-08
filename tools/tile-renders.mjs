// Renders the Option tile pictures of the Options tiles (CHE-265, CHE-287) from the real game into public/tiles/.
// Usage: node tools/tile-renders.mjs [--only=theme,set,sky,back] [--out=public/tiles] [--size=132] [--quality=62] [--port=5362]
// One small webp per theme, Pixelwelt set, sky and backdrop id (tile-<kind>-<id>.webp as <kind>-<id>.webp), 132 px square (3x of a 44 px tile, fine for 2x),
// about 4 KB each. The page is the real build, manual mode (?manual=1), music and sound off, GPU where there is one, through launchBrowser()
// (tools/_lib.mjs). The camera and which parts of the scene show are set here through window.__chess; test/tiles.mjs (fast tier) fails when a file is missing or orphaned.
// These files are the one exception to "no asset files" besides the app icons (public/tiles/ only, docs/adr/0011).
// Exit codes: 0 done, 1 a render failed, 2 usage or setup error.
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, build, launchBrowser, sleep, startServer, watchPage } from './_lib.mjs';
import { THEMES } from '../src/themes/registry.js';
import { SKIES, BACKDROPS } from '../src/themes/pixel/look.js';
import { SETS } from '../src/themes/pixel/sets.js';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt; };
const SIZE = Number(opt('size', 132));
const QUALITY = Number(opt('quality', 62));
const OUT = join(ROOT, opt('out', 'public/tiles'));
const ONLY = opt('only', 'theme,set,sky,back').split(',');
const DIST = '.tmp/tile-renders-dist';

// One entry per tile: the page query and the scene. view: corner (a board corner with a knight), sky (heaven only), back (the world below), world (sky above, backdrop below)
const specs = [];
for (const th of THEMES.filter((x) => !x.hidden)) specs.push({ kind: 'theme', id: th.id, q: `theme=${th.id}`, view: 'corner' });
for (const s of SETS) specs.push({ kind: 'set', id: s.id, q: `theme=pixel&sky=${s.sky}&backdrop=${s.backdrop}`, view: 'world', back: s.backdrop });
for (const id of Object.keys(SKIES)) specs.push({ kind: 'sky', id, q: `theme=pixel&sky=${id}&backdrop=none`, view: 'sky' });
for (const id of Object.keys(BACKDROPS)) specs.push({ kind: 'back', id, q: `theme=pixel&sky=evening&backdrop=${id}`, view: 'back', back: id });

// Runs inside the page: frame the scene for one tile, then draw.
function arrange({ view, back, sky }) {
  const C = window.__chess, { stage, gimbal, board } = C;
  const SKY_AIM = { evening: 15, sunrise: 5, night: 9 };   // where the camera looks: the sun, or the moon at night
  const pieces = gimbal.getObjectByName('pieces');
  C.step(0.2); for (let i = 0; i < 20; i++) stage.render(0.2);   // the light transition and the weather first: step() moves the camera back
  const cam = stage.camera;
  const look = (pos, at, fov) => { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(...pos); cam.lookAt(...at); };
  if (view === 'corner') {
    for (const g of pieces.children) { const near = g.position.x < -2 && g.position.z > 1.5; if (!near && !g.isMesh) g.visible = false; else if (g.isMesh) g.visible = false; }
    look([-0.6, 3.4, 6.9], [-2.9, 0, 2.7], 26);
  } else {
    board.group.visible = false;
    for (const g of pieces.children) g.visible = false;
    C.stage.setFloorVisibility?.(0);
    if (view === 'sky') look([0, 3, 12], [-5, SKY_AIM[sky] ?? 13, -34], 30);
    else if (view === 'back') look(back === 'castle' ? [-6, -5, -10] : [0, -9, 34], back === 'castle' ? [-6, -13, -44] : [0, -10, -30], back === 'castle' ? 36 : 62);
    else look(back === 'castle' ? [-6, 4, 16] : [0, 4, 18], back === 'castle' ? [-6, -8, -44] : [0, -6, -40], 56);
  }
  C.draw(); C.draw();
}

let server = null, browser = null, code = 0;
try {
  mkdirSync(OUT, { recursive: true });
  build(DIST);
  server = await startServer({ mode: 'preview', outDir: DIST });
  browser = await launchBrowser({ w: SIZE, h: SIZE });
  const page = await browser.newPage();
  const watch = await watchPage(page);
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
  for (const sp of specs.filter((x) => ONLY.includes(x.kind))) {
    const fen = encodeURIComponent('7k/8/8/8/8/8/1N6/7K w - - 0 1');
    await page.goto(`${server.base}?${sp.q}&quality=high&manual=1&ai=0&hud=0&intro=0&music=0&sound=0&fen=${fen}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 180000 });
    const err = await page.evaluate(() => window.__chessError);
    if (err) throw new Error(`${sp.kind} ${sp.id}: page reported ${err}`);
    await page.addStyleTag({ content: '#hud,#banner,#promo,#toast,#notice,#loader,.install-hint,.ih-overlay{display:none!important}' });
    await page.evaluate(arrange, { view: sp.view, back: sp.back, sky: sp.id });
    await sleep(150);
    const buf = await page.screenshot({ type: 'webp', quality: QUALITY });
    const file = join(OUT, `${sp.kind}-${sp.id}.webp`);
    writeFileSync(file, buf);
    console.log(`${sp.kind}-${sp.id}.webp  ${statSync(file).size} bytes`);
  }
  if (watch.errs.length) console.log('page errors:', watch.errs.slice(0, 3).join(' | '));
} catch (e) {
  console.error(e.message || e); code = 1;
} finally {
  await browser?.close().catch(() => {});
  await server?.stop?.();
}
process.exit(code);
