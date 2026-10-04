// Capture trays in the real page: node test/trays-page.mjs [--port=5247] [--base=<server>] [--shots=<dir>]
// A 79 move game with 15 black and 10 white pieces captured (generated from the rules engine, seed 13): the full tray lies inside
// the slab with no overlap (game.audit covers position, scale and the layout contract), ordered by value; the Captured pieces
// switch (Scene card, stored per device, ?trays=0|1 beats it), trays off hides slabs and pieces but keeps the HUD row, the camera
// fit ignores the tray space, switching mid game and back puts every captured piece in the trays, undo keeps working, an animated
// capture with trays off fades the victim out. ai=0, manual=1, quality=low: time by __chess.step()/draw().
// Screenshots (full tray desktop and phone landscape, trays off, two themes) and a contact sheet go to --shots (default .tmp/trays).
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
  const info = () => page.evaluate(() => {
    const c = window.__chess, s = c.game.getState();
    const slabs = []; c.game.root.traverse((o) => { if (o.name === 'tray-slab') slabs.push(o.visible); });
    return { audit: c.game.audit(), cap: { w: s.captured.w.length, b: s.captured.b.length }, trays: s.trays, slabs, ctrl: c.controls.trays, dist: c.stage.camera.position.length(),
      hudRow: { w: document.querySelectorAll('#cap-w i').length, b: document.querySelectorAll('#cap-b i').length }, box: !!document.querySelector('[data-trays]'), checked: document.querySelector('[data-trays]')?.checked, stored: localStorage.getItem('chess3d.trays'), over: window.__chess.game.root.children.filter((o) => o.visible && o.userData.piece).length };
  });
  const shot = async (name) => { await settleUi(page); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
  const theme = async (id) => { await page.evaluate((t) => window.__chess.themes.set(t), id); await settle(1); };

  // ---- trays on, full tray
  await load(`&moves=${GAME}`);
  await page.evaluate(() => localStorage.clear());
  let r = await info();
  R.expect('full tray: 15 black and 10 white captured, audit clean (inside the margin, no overlap, scale)', r.cap.b === 15 && r.cap.w === 10 && r.audit.length === 0 && r.trays && r.slabs.length === 2 && r.slabs.every(Boolean), `${JSON.stringify(r.cap)}`, `${JSON.stringify(r)}`);
  R.expect('the switch is in the Scene card, on by default', r.box && r.checked === true, 'on', JSON.stringify(r));
  await shot('desktop-classic-full-tray');
  await theme('wood'); await shot('desktop-wood-full-tray'); await theme('classic');
  const distOn = r.dist;

  // ---- the switch in the UI, stored, off
  await page.evaluate(() => document.querySelector('[data-trays]').click());
  await settle();
  r = await info();
  R.expect('switch off: slabs hidden, every captured piece hidden, HUD row kept (15 and 10), audit clean', !r.trays && !r.ctrl && r.slabs.every((v) => !v) && r.hudRow.b === 15 && r.hudRow.w === 10 && r.audit.length === 0 && r.stored === '0', `HUD ${JSON.stringify(r.hudRow)}`, JSON.stringify(r));
  await shot('desktop-classic-trays-off');
  await theme('wood'); await shot('desktop-wood-trays-off'); await theme('classic');
  await page.evaluate(() => document.querySelector('[data-trays]').click());
  await settle();
  r = await info();
  R.expect('switch on again: every piece captured so far is back in the trays', r.trays && r.cap.b === 15 && r.audit.length === 0 && r.slabs.every(Boolean) && r.stored === '1', 'back', JSON.stringify(r));

  // ---- URL flag beats the stored value; stored value is used without it
  await page.evaluate(() => localStorage.setItem('chess3d.trays', '0'));
  await load('&trays=1&moves=e2e4,d7d5,e4d5');
  r = await info();
  R.expect('?trays=1 beats a stored off, and does not overwrite it', r.trays && r.checked === true && r.stored === '0', 'on, stored 0', JSON.stringify(r));
  await load('&moves=e2e4,d7d5,e4d5');
  r = await info();
  R.expect('stored off is used without the flag; the captured pawn is hidden, the HUD row has it', !r.trays && r.checked === false && r.cap.b === 1 && r.hudRow.b === 1 && r.audit.length === 0, 'off', JSON.stringify(r));
  await page.evaluate(() => localStorage.setItem('chess3d.trays', '1'));
  await load('&trays=0&moves=e2e4,d7d5,e4d5');
  r = await info();
  R.expect('?trays=0 beats a stored on', !r.trays && r.slabs.every((v) => !v) && r.stored === '1', 'off, stored 1', JSON.stringify(r));

  // ---- animated capture and undo with trays off, then on
  await load('&trays=0&moves=e2e4,d7d5');
  const fade = await page.evaluate(() => {
    const c = window.__chess; c.game.move('e4', 'd5');
    const seen = { mid: false };
    for (let i = 0; i < 40; i++) {
      c.step(0.05);
      c.game.root.traverse((o) => { if (o.isMesh && o.material.transparent && o.material.opacity < 0.95 && o.material.opacity > 0.02) seen.mid = true; });
    }
    c.draw();
    return { ...seen, busy: c.game.busy, audit: c.game.audit() };
  });
  r = await info();
  R.expect('trays off: an animated capture fades the victim out, nothing is left half transparent', fade.mid && !fade.busy && r.audit.length === 0 && r.cap.b === 1, 'faded', JSON.stringify({ fade, r }));
  const opaque = await page.evaluate(() => { let bad = 0; window.__chess.game.root.traverse((o) => { if (o.isMesh && o.material.transparent && o.material.opacity < 1 && o.visible) bad++; }); return bad; });
  R.expect('no visible piece keeps a faded material', opaque === 0, 'none', `${opaque}`);
  await page.evaluate(() => window.__chess.game.undo());
  await settle();
  r = await info();
  R.expect('undo of the faded capture brings the pawn back on d5', r.cap.b === 0 && r.audit.length === 0, 'restored', JSON.stringify(r));
  await page.evaluate(() => { window.__chess.game.move('e4', 'd5'); window.__chess.game.setTrays(true); });
  await settle();
  r = await info();
  R.expect('capture while off, switch on: the pawn flies into the tray', r.trays && r.cap.b === 1 && r.audit.length === 0, 'in the tray', JSON.stringify(r));
  await page.evaluate(() => { window.__chess.game.setTrays(false); window.__chess.game.undo(); window.__chess.game.setTrays(true); });
  await settle();
  r = await info();
  R.expect('off, undo, on again: tray empty, board right', r.trays && r.cap.b === 0 && r.audit.length === 0, 'ok', JSON.stringify(r));

  // ---- camera fit: phone landscape and desktop
  for (const size of ['landscape', 'squarish', 'desktop']) {
    await load(`&moves=${GAME}`, size);
    await page.evaluate(() => localStorage.setItem('chess3d.trays', '1'));
    await load(`&trays=1&moves=${GAME}`, size);
    const on = await info();
    if (size === 'landscape') { await shot('landscape-classic-full-tray'); await theme('glass'); await shot('landscape-glass-full-tray'); await theme('classic'); }
    await load(`&trays=0&moves=${GAME}`, size);
    const off = await info();
    if (size === 'landscape') await shot('landscape-classic-trays-off');
    R.expect(`${size}: the camera fit ignores the tray space with trays off (camera not farther; closer where the width limits)`, off.dist <= on.dist + 0.02 && (size !== 'squarish' || off.dist < on.dist - 0.2), `${on.dist.toFixed(2)} on, ${off.dist.toFixed(2)} off`);
    R.expect(`${size}: audit clean in both states`, on.audit.length === 0 && off.audit.length === 0, 'clean', JSON.stringify([on.audit, off.audit]));
  }
  await load(`&trays=1&moves=${GAME}`, 'portrait');
  await shot('portrait-classic-full-tray');
  r = await info();
  R.expect('portrait: full tray audit clean (trays may sit off screen)', r.audit.length === 0, 'clean', JSON.stringify(r.audit));

  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  await contactSheets(browser, SHOTS, { cols: 3, width: 640 });
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
