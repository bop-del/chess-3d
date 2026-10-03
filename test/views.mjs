// Views test (smoke tier): build, serve, drive the page in headless Chrome (software GL).
// Usage: node test/views.mjs [--port=5361] [--skip-build]
//   per view and size (1280x720, 390x844, 844x390, 844x290)
//     the view applies         views.current(), the right camera projection, no page errors
//     picking                  a real click on the e2 pawn selects e2, a click on a legal target square moves it
//     highlights               every legal target square of the selected pawn projects inside the screen
//   views list                 the preset views and both easy views everywhere; Play only on a phone in portrait
//   remembered                 the choice survives a reload (localStorage chess3d.view); a stored view that is not offered falls back
//   keys 1 to 5                leave an easy view for the matching preset (projection back to perspective)
//   piece scale                Easy 3D scales the 3D pieces about 1.15x, other views 1.0
// Exit codes: 0 pass (warnings allowed), 1 a check failed, 2 setup error.
import { ROOT, reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5361));
const OUT = '.tmp/views-dist';
const SIZES = [{ w: 1280, h: 720, touch: 0 }, { w: 390, h: 844, touch: 1 }, { w: 844, h: 390, touch: 1 }, { w: 844, h: 290, touch: 1 }];
const IDS = ['white', 'black', 'top', 'side', 'iso', 'tokens', 'above', 'easy-3d', 'play'];
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');   // a server that is already up (test/smoke-groups.mjs)
const R = reporter();
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nviews: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'VIEWS FAILED' : 'VIEWS OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

try {
  if (BASE) server = { base: BASE + '/', stop() {} };
  else {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  browser = await launchBrowser({ w: 844, h: 390 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

async function open(page, size, query = '') {
  await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1, isMobile: !!size.touch, hasTouch: !!size.touch });
  await page.goto(`${server.base}?quality=low&manual=1&ai=0&touch=${size.touch}${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  await page.evaluate(() => { window.__chess.step(2); window.__chess.draw(); });
}
const xy = (page, x, y, z) => page.evaluate((x, y, z) => {
  const { THREE, stage } = window.__chess;
  const v = new THREE.Vector3(x, y, z).project(stage.camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
}, x, y, z);

try {
  const page = await browser.newPage();
  const watch = await watchPage(page, ['127.0.0.1', 'localhost']);
  for (const size of SIZES) {
    const tag = `${size.w}x${size.h}`;
    const phonePortrait = !!size.touch && size.h > size.w && Math.min(size.w, size.h) <= 500;
    for (const id of IDS) {
      const want = phonePortrait || id !== 'play';
      await open(page, size, `&view=${id}&fen=4k3/8/8/8/8/8/4P3/K7%20w%20-%20-%200%201`);   // a lone pawn: no piece stands in front of it
      const info = await page.evaluate(() => !window.__chess?.views ? { cur: 'none', list: [], proj: null, err: window.__chessError || 'no __chess.views' } : ({ cur: window.__chess.views.current(), list: window.__chess.views.list().map((v) => v.id), proj: window.__chess.stage.projection, err: window.__chessError || null }));
      if (id === IDS[0]) R.expect(`views list ${tag}`, info.list.includes('play') === phonePortrait && ['tokens', 'above', 'easy-3d', 'iso'].every((v) => info.list.includes(v)), info.list.join(','), info.list.join(','));
      if (!want) { R.expect(`${id} not offered ${tag}`, info.cur !== 'play', `falls back to ${info.cur}`); continue; }
      const easy = id === 'easy-3d' || id === 'tokens';
      R.expect(`${id} applies ${tag}`, info.cur === id && info.proj === (easy ? 'ortho' : 'perspective') && !info.err, `${info.cur} ${info.proj}`, JSON.stringify(info));
      // picking: click the e2 pawn, then a legal target square
      const e2 = await xy(page, 0.5, 0.4, 2.5), tgt = await xy(page, 0.5, 0, 0.5);
      await page.mouse.click(e2.x, e2.y);
      await page.evaluate(() => window.__chess.step(0.5));
      const sel = await page.evaluate(() => window.__chess.game.getState().selected);
      R.expect(`${id} select e2 ${tag}`, sel === 'e2', 'selected e2', `selected ${sel}`);
      const targets = await page.evaluate(() => {
        const { THREE, stage } = window.__chess; const out = [];
        for (const sq of ['e3', 'e4']) {
          const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1;
          const v = new THREE.Vector3(f - 3.5, 0, 3.5 - r).project(stage.camera);
          out.push(Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1);
        }
        return out;
      });
      R.expect(`${id} legal targets on screen ${tag}`, targets.every(Boolean), 'e3 and e4 visible', JSON.stringify(targets));
      await page.mouse.click(tgt.x, tgt.y);
      await page.evaluate(() => window.__chess.step(1.5));
      const mv = await page.evaluate(() => window.__chess.game.getState().moves.length);
      if (id === 'side' && mv !== 1) R.warn(`${id} move by click ${tag}`, 'the pawn hides e4 at a 7 degree pitch, as in the existing Side preset');
      else R.expect(`${id} move by click ${tag}`, mv === 1, 'e4 played', `${mv} moves`);
      if (id === 'easy-3d' || id === 'white' || id === 'above') {
        const sc = await page.evaluate(() => { const r = window.__chess.stage.scene.getObjectByName('pieces'); for (const g of r.children) { const m = g.children.find((c) => !c.userData.hit); if (m) return m.scale.x; } return -1; });
        R.expect(`${id} piece scale ${tag}`, Math.abs(sc - (id === 'easy-3d' ? 1.15 : 1)) < 0.01, `scale ${sc.toFixed(2)}`);
      }
    }
  }
  // Tokens and From above lock the orbit; Easy 3D stays free
  for (const [id, locked] of [['tokens', true], ['above', true], ['easy-3d', false]]) {
    await open(page, SIZES[0], `&view=${id}`);
    const c0 = await page.evaluate(() => window.__chess.controls.camera);
    await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(380, 360, { steps: 6 }); await page.mouse.up();
    await page.evaluate(() => window.__chess.step(1));
    const c1 = await page.evaluate(() => window.__chess.controls.camera);
    const same = Math.abs(c1.yaw - c0.yaw) < 1e-6 && Math.abs(c1.pitch - c0.pitch) < 1e-6;
    R.expect(`${id} orbit ${locked ? 'locked' : 'free'}`, same === locked, `yaw and pitch ${same ? 'unchanged' : 'changed'} by a drag`);
  }
  // From above: perspective at 65 degrees, the board edge to edge in width on a phone in portrait, the frame inside the screen
  await open(page, SIZES[1], '&view=above');
  const ab = await page.evaluate(() => { const c = window.__chess; return { pitch: Math.round(c.controls.camera.pitch * 180 / Math.PI), proj: c.stage.projection, battle: c.views.isEasy() }; });
  R.expect('above: perspective, 65 degrees, an easy view', ab.pitch === 65 && ab.proj === 'perspective' && ab.battle, JSON.stringify(ab));
  // a stored id from before Tokens: easy-flat becomes tokens
  await page.evaluate(() => localStorage.setItem('chess3d.view', 'easy-flat'));
  await open(page, SIZES[0]);
  R.expect('stored easy-flat migrates to tokens', await page.evaluate(() => window.__chess.views.current()) === 'tokens');
  await page.evaluate(() => localStorage.removeItem('chess3d.view'));
  // phone cycle: the thumb bar Views button walks Play, Tokens, From above, Easy 3D, then the presets
  await open(page, SIZES[1]);
  const seen = [await page.evaluate(() => window.__chess.views.current())];
  for (let i = 0; i < 4; i++) { await page.tap('.tb[data-act=views]'); await page.evaluate(() => window.__chess.step(1)); seen.push(await page.evaluate(() => window.__chess.views.current())); }
  R.expect('phone cycle order', seen.join() === 'play,tokens,above,easy-3d,white', seen.join());
  // remembered choice, fallback, keys
  const size = SIZES[1];
  await open(page, size);
  await page.evaluate(() => window.__chess.views.set('easy-3d'));
  await open(page, size);
  R.expect('choice survives a reload', await page.evaluate(() => window.__chess.views.current()) === 'easy-3d');
  await page.evaluate(() => localStorage.setItem('chess3d.view', 'play'));
  await open(page, SIZES[2]);
  R.expect('stored play falls back in landscape', await page.evaluate(() => window.__chess.views.current()) === 'white');
  await page.evaluate(() => localStorage.removeItem('chess3d.view'));
  await open(page, SIZES[1]);
  R.expect('play is the default on a phone in portrait', await page.evaluate(() => window.__chess.views.current()) === 'play');
  await open(page, SIZES[0], '&view=tokens');
  await page.keyboard.press('3');
  await page.evaluate(() => window.__chess.step(2));
  const k = await page.evaluate(() => ({ cur: window.__chess.views.current(), proj: window.__chess.stage.projection }));
  R.expect('key 3 leaves the easy view', k.cur === 'top' && k.proj === 'perspective', JSON.stringify(k));
  R.expect('no page errors', !watch.errs.length, '', watch.errs.slice(0, 3).join(' | '));
  R.expect('no foreign requests', !watch.foreign.length, '', watch.foreign.slice(0, 3).join(' | '));
} catch (e) {
  R.fail('views run', String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').slice(0, 400));
}
await finish();
