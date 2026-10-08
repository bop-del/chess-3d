// Captured pieces beside the board in the real page (CHE-358, no trays): node test/trays-page.mjs [--port=5247] [--base=<server>] [--shots=<dir>]
// A 79 move game with 15 black and 10 white pieces captured (generated from the rules engine, seed 13): the full set stands in its
// area at each side of the board (game.audit covers position, scale and the layout contract), ordered by value, on the ground of the
// theme (the floor in Classic and the other studio themes, the grass at y = 0 in Pixelwelt, with closed ground under every piece).
// No slab, no switch, `?trays=` is ignored. Portrait: the pieces stand in two rows at the near end of the board (the end follows
// the view), in front of it, never over it. An animated capture, undo and a theme change keep the audit clean. ai=0, manual=1, quality=low.
// Screenshots (full set, desktop and phone portrait and landscape, two themes) and a contact sheet go to --shots (default .tmp/trays).
// Exit codes: 0 pass, 1 a check failed.
import { mkdirSync } from 'node:fs';
import { reporter, launchBrowser, watchPage, startServer, build, settleUi } from '../tools/_lib.mjs';
import { contactSheets } from '../tools/contact-sheet.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5247)), BASE = opt('base', '').replace(/\/$/, ''), SHOTS = opt('shots', '.tmp/trays');
const R = reporter();
const OUT = '.tmp/trays-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
mkdirSync(SHOTS, { recursive: true });
const GAME = 'a2a3,h7h6,g1h3,c7c5,h3f4,a7a6,d2d3,g7g5,b2b3,h8h7,g2g3,f7f6,e1d2,e7e5,f4e6,d7e6,d2e1,d8d3,c2d3,f6f5,c1g5,h6g5,d1c2,b8d7,c2c5,a8a7,c5c8,e8f7,c8b7,f8a3,a1a3,f5f4,a3a6,a7a6,b7d7,f7g6,d7h7,g6h7,g3f4,g5f4,e2e3,f4e3,f2e3,h7g6,h2h3,a6a5,d3d4,g6f6,d4e5,f6e5,e1f2,a5a3,b1a3,g8f6,f2g3,f6d7,f1d3,e5d5,h1b1,e6e5,g3f3,d5c6,h3h4,c6c5,b1a1,d7f8,a1g1,c5b4,f3g2,b4b3,a3b5,b3b2,b5c3,f8d7,g1f1,d7f6,f1f6,e5e4,c3e4';
const SIZES = { desktop: { width: 1280, height: 720 }, landscape: { width: 844, height: 390 }, squarish: { width: 600, height: 420 }, portrait: { width: 390, height: 844 } };
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  const load = async (query = '', size = 'desktop') => {
    const s = SIZES[size], phone = size !== 'desktop';
    await page.setViewport(phone ? { ...s, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : s);
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await settle();
  };
  const settle = (secs = 3) => page.evaluate((n) => { const c = window.__chess; c.game.finishAnimations(); for (let i = 0; i < 20; i++) c.step(n / 20); c.draw(); }, secs);
  // the state of the captured pieces: the audit, the ground height they stand on, the screen box of each one against the board
  const info = () => page.evaluate(() => {
    const c = window.__chess, { THREE } = c, s = c.game.getState(), cam = c.stage.camera;
    const slabs = []; c.game.root.traverse((o) => { if (o.name === 'tray-slab') slabs.push(o); });
    const caps = [];
    c.game.root.children.forEach((o) => { if (o.userData.piece && o.visible && Math.abs(o.position.x) + Math.abs(o.position.z) > 0 && (Math.abs(o.position.x) > 4.2 || Math.abs(o.position.z) > 4.2)) caps.push(o); });
    // closed ground: a ray straight down from just above each captured piece hits a mesh at the piece's height (within 0.1) or the floor
    const rc = new THREE.Raycaster(), world = c.themes.world, under = [];
    for (const o of caps) {
      const wp = o.getWorldPosition(new THREE.Vector3());
      rc.set(new THREE.Vector3(wp.x, wp.y + 0.3, wp.z), new THREE.Vector3(0, -1, 0));
      const hit = world ? rc.intersectObject(world.group, true)[0] : null;
      under.push({ y: o.position.y, hitY: hit ? hit.point.y : null });
    }
    // the screen rectangle of the 8 x 8 board against the one of each captured piece (bounding boxes projected)
    cam.updateMatrixWorld(true);
    const rect = (box) => { let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) { const p = new THREE.Vector3(x, y, z).applyMatrix4(c.gimbal.matrixWorld).project(cam); const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight; l = Math.min(l, sx); r = Math.max(r, sx); t = Math.min(t, sy); b = Math.max(b, sy); } return { l, t, r, b }; };
    const bd = rect(new THREE.Box3(new THREE.Vector3(-4, -0.05, -4), new THREE.Vector3(4, 0.05, 4)));
    const onScreen = caps.filter((o) => { const q = rect(new THREE.Box3().setFromObject(o).applyMatrix4(c.gimbal.matrixWorld.clone().invert())); return q.l >= 0 && q.r <= innerWidth && q.t >= 0 && q.b <= innerHeight; }).length;
    const overBoard = caps.filter((o) => { const q = rect(new THREE.Box3().setFromObject(o).applyMatrix4(c.gimbal.matrixWorld.clone().invert())); const mx = (q.l + q.r) / 2, my = (q.t + q.b) / 2; return mx > bd.l && mx < bd.r && my > bd.t && my < bd.b; }).length;
    return { audit: c.game.audit(), cap: { w: s.captured.w.length, b: s.captured.b.length }, slabs: slabs.length, ground: c.game.ground, ys: [...new Set(caps.map((o) => +o.position.y.toFixed(2)))], n: caps.length, under, onScreen, overBoard,
      box: !!document.querySelector('[data-trays]'), dist: cam.position.length(), hudRow: { w: document.querySelectorAll('#cap-w i').length, b: document.querySelectorAll('#cap-b i').length } };
  });
  const shot = async (name) => { await settleUi(page); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
  const theme = async (id) => { await page.evaluate((t) => window.__chess.themes.set(t), id); await settle(1); };

  // ---- classic, full set, desktop
  await load(`&moves=${GAME}`);
  let r = await info();
  R.expect('full set: 15 black and 10 white captured, audit clean (inside the area, no overlap, scale), all 25 stand beside the board', r.cap.b === 15 && r.cap.w === 25 - 15 && r.audit.length === 0 && r.n === 25, `${JSON.stringify(r.cap)} ${r.n} pieces`, JSON.stringify(r));
  R.expect('no slab, no tray switch in the UI', r.slabs === 0 && !r.box, 'none', JSON.stringify({ slabs: r.slabs, box: r.box }));
  R.expect('classic: the pieces stand on the floor (y -1.2), none floats', r.ground === -1.2 && r.ys.length === 1 && r.ys[0] === -1.2, `y ${r.ys}`, JSON.stringify(r.ys));
  await shot('desktop-classic-full-set');
  await theme('wood'); r = await info();
  R.expect('wood: the same ground, audit clean', r.ys.length === 1 && r.ys[0] === -1.2 && r.audit.length === 0, `y ${r.ys}`, JSON.stringify(r));
  await shot('desktop-wood-full-set');
  await theme('pixel'); r = await info();
  R.expect('pixel: the pieces step up onto the grass (y 0), closed ground under every one', r.ground === 0 && r.ys.length === 1 && r.ys[0] === 0 && r.under.length === 25 && r.under.every((u) => u.hitY !== null && Math.abs(u.hitY - u.y) < 0.1) && r.audit.length === 0, `y ${r.ys}, ground under ${r.under.filter((u) => u.hitY !== null).length} of ${r.under.length}`, JSON.stringify(r.under.filter((u) => u.hitY === null || Math.abs(u.hitY - u.y) >= 0.1).slice(0, 3)));
  await shot('desktop-pixel-full-set');
  await theme('classic'); r = await info();
  R.expect('back to classic: the pieces return to the floor', r.ys.length === 1 && r.ys[0] === -1.2 && r.audit.length === 0, `y ${r.ys}`, JSON.stringify(r));

  // ---- the old flag and the old stored setting do nothing
  await page.evaluate(() => localStorage.setItem('chess3d.trays', '0'));
  await load('&trays=0&moves=e2e4,d7d5,e4d5');
  r = await info();
  R.expect('?trays=0 and a stored off are ignored: the captured pawn stands beside the board, the HUD row has it', r.cap.b === 1 && r.n === 1 && r.hudRow.b === 1 && r.audit.length === 0, '1 pawn', JSON.stringify(r));
  await page.evaluate(() => localStorage.clear());

  // ---- animated capture, undo, capture again, in two themes
  for (const th of ['classic', 'pixel']) {
    await load(`&theme=${th}&moves=e2e4,d7d5`);
    await page.evaluate(() => window.__chess.game.move('e4', 'd5'));
    await settle();
    r = await info();
    R.expect(`${th}: an animated capture ends with the pawn standing beside the board, audit clean`, r.cap.b === 1 && r.n === 1 && r.audit.length === 0 && r.ys[0] === r.ground, `y ${r.ys}`, JSON.stringify(r));
    await page.evaluate(() => window.__chess.game.undo());
    await settle();
    r = await info();
    R.expect(`${th}: undo brings the pawn back on d5, nothing stands beside the board`, r.cap.b === 0 && r.n === 0 && r.audit.length === 0, 'restored', JSON.stringify(r));
  }

  // ---- landscape and a squarish window: the side areas fit the view
  for (const size of ['landscape', 'squarish']) {
    await load(`&moves=${GAME}`, size);
    r = await info();
    R.expect(`${size}: all 25 pieces on screen, none over the board, audit clean`, r.onScreen === 25 && r.overBoard === 0 && r.audit.length === 0, `${r.onScreen} on screen, ${r.overBoard} over the board`, JSON.stringify(r));
    if (size === 'landscape') { await shot('landscape-classic-full-set'); await theme('pixel'); await shot('landscape-pixel-full-set'); }
  }

  // ---- portrait: two rows at the near end of the board, black ones right, white ones left, the end follows the view
  const zs = () => page.evaluate(() => { const g = window.__chess.game, out = { pos: 0, neg: 0, right: 0, left: 0 }; g.root.children.forEach((o) => { if (!o.userData.piece || (Math.abs(o.position.z) < 4.2 && Math.abs(o.position.x) < 4.2)) return; out[o.position.z > 0 ? 'pos' : 'neg']++; out[o.position.x > 0 ? 'right' : 'left']++; }); return out; });
  for (const th of ['classic', 'pixel']) {
    await load(`&theme=${th}&moves=${GAME}`, 'portrait');
    r = await info();
    const z = await zs();
    R.expect(`portrait ${th}: all 25 stand in two rows at the near end (black 15 right, white 10 left), on screen, none over the board, audit clean`, r.n === 25 && z.pos === 25 && z.right === 15 && z.left === 10 && r.onScreen === 25 && r.overBoard === 0 && r.audit.length === 0, `${r.onScreen} on screen, ${r.overBoard} over the board`, JSON.stringify({ r, z }));
    await shot(`portrait-${th}-full-set`);
    if (th === 'pixel') {
      R.expect('portrait pixel: closed ground under every piece', r.under.length === 25 && r.under.every((u) => u.hitY !== null && Math.abs(u.hitY - u.y) < 0.1), `${r.under.filter((u) => u.hitY !== null).length} of 25`, JSON.stringify(r.under.filter((u) => u.hitY === null || Math.abs(u.hitY - u.y) >= 0.1).slice(0, 3)));
      await page.evaluate(() => window.__chess.controls.flip());
      await settle(4);
      const b = await info(), zb = await zs();
      R.expect('portrait pixel, Black view: the rows moved to the other end (the near end again), on ground, audit clean', zb.neg === 25 && b.onScreen === 25 && b.overBoard === 0 && b.audit.length === 0 && b.under.every((u) => u.hitY !== null && Math.abs(u.hitY - u.y) < 0.1), JSON.stringify(zb), JSON.stringify({ b, zb }));
      await shot('portrait-pixel-black-view');
    }
  }
  // rotating the phone moves the pieces between the rows and the sides
  await page.setViewport({ ...SIZES.landscape, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await new Promise((ok) => setTimeout(ok, 500));   // the resize event of a touch device is handled at once, the render targets 160 ms later
  await settle();
  r = await info();
  R.expect('portrait to landscape: the pieces move to the sides again, audit clean', r.n === 25 && r.onScreen === 25 && r.audit.length === 0, 'at the sides', JSON.stringify(r));

  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  await contactSheets(browser, SHOTS, { cols: 3, width: 640 });
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
