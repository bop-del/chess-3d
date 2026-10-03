// Pixelwelt figures in the real page: node test/pixel-chars-page.mjs [--port=5352] [--base=<server>]
// The theme puts blocky figures on the board (rigs, a piece style), they idle (the head turns, the chest breathes), walk with
// swinging legs while they move and stand still again, a knight gallops, a capture bursts the victim into cubes (battle On) and
// ends with a clean board, every piece and tray piece changes with the theme in place, leaving the theme gives the lathe pieces back,
// no console error or warning. Software or GPU GL, quality=low and ?manual=1 so the clock is simulated.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5353').slice(7));
const R = reporter();
const OUT = '.tmp/pixel-chars-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page, undefined, { scenes: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('chess3d.battle', '{"mode":"short","style":"gore"}'); } catch (e) { /* ignore */ } });
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL0}/?quality=low&manual=1&ai=0&theme=pixel`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  const ev = (fn, arg) => page.evaluate(fn, arg);

  const info = await ev(() => {
    const { game, themes } = window.__chess;
    const rigs = []; game.root.children.forEach((g) => { if (g.userData.piece) rigs.push(g.children[0]?.children[0]?.name); });
    return { theme: themes.current(), n: rigs.length, rigs: rigs.every((n) => n === 'rig'), styles: game.root.children.filter((g) => g.userData.piece).every((g) => g.userData.style === 'pixel') };
  });
  R.expect('Pixelwelt: 32 figures on the board, each with a rig', info.theme === 'pixel' && info.n === 32 && info.rigs && info.styles, `${info.n} rigs`, JSON.stringify(info));

  // idle: the head turns and the chest breathes over time
  const head = () => ev(() => { const g = window.__chess.game.root.children.find((o) => o.name === 'wk'); const rig = g.children[0].children[0]; return { yaw: rig.getObjectByName('head').rotation.y, sy: rig.scale.y }; });
  const h0 = await head(); await ev(() => window.__chess.step(1.7)); const h1 = await head();
  R.expect('idle: the king looks around and breathes', Math.abs(h1.yaw - h0.yaw) > 0.01 && Math.abs(h1.sy - h0.sy) > 0.002, `yaw ${h0.yaw.toFixed(2)} to ${h1.yaw.toFixed(2)}`);

  // a pawn walks: legs swing in opposition while it moves, quiet again afterwards
  const legs = () => ev(() => { const g = window.__chess.game.root.children.find((o) => o.name === 'wp' && Math.abs(o.position.x - 0.5) < 0.6 && o.position.z < 2.9); const rig = g.children[0].children[0]; return { n: rig.getObjectByName('legN').rotation.x, p: rig.getObjectByName('legP').rotation.x }; });
  await ev(() => { window.__chess.game.move('e2', 'e4'); window.__chess.step(0.2); });
  const mid = await legs();
  R.expect('walk: the pawn swings its legs against each other', Math.abs(mid.n) > 0.04 && mid.n * mid.p < 0, `${mid.n.toFixed(2)} and ${mid.p.toFixed(2)}`);
  await ev(() => window.__chess.step(1.5));
  const still = await ev(() => { const g = window.__chess.game.root.children.find((o) => o.name === 'wp' && Math.abs(o.position.z - 0.5) < 0.1); const rig = g.children[0].children[0]; return Math.abs(rig.getObjectByName('legN').rotation.x) + Math.abs(rig.getObjectByName('legP').rotation.x); });
  R.expect('walk: the legs are still when it arrives', still < 0.02, still.toFixed(3));

  // a knight gallops
  await ev(() => { window.__chess.game.move('g8', 'f6'); window.__chess.step(0.3); });
  const gal = await ev(() => { const g = window.__chess.game.root.children.find((o) => o.name === 'bn' && o.position.x > 1.4 && o.position.x < 2.6 && o.position.z < -1.6); const rig = g.children[0].children[0]; return ['lgNF', 'lgPF', 'lgNB', 'lgPB'].map((n) => rig.getObjectByName(n).rotation.x); });
  R.expect('gallop: the four legs of the mount swing out of step', gal.filter((x) => Math.abs(x) > 0.15).length >= 3, gal.map((x) => x.toFixed(2)).join(' '));
  await ev(() => window.__chess.step(2));

  // a capture: cubes, then a clean board and the victim in the tray
  await ev(() => { window.__chess.game.loadFen('8/8/8/3p4/4P3/8/8/4K2k w - - 0 1'); window.__chess.step(2); window.__chess.game.move('e4', 'd5'); });
  let burst = 0;
  for (let i = 0; i < 40 && !burst; i++) { await ev(async () => { await window.__chess.stepAsync(0.15); }); burst = await ev(() => window.__chess.game.root.children.filter((o) => o.isMesh && o.geometry?.type === 'BoxGeometry' && o.scale.x < 0.3).length); }
  R.expect('capture: the victim bursts into cubes', burst > 20, `${burst} cubes`);
  await ev(async () => { await window.__chess.stepAsync(5); });
  const after = await ev(() => ({ audit: window.__chess.game.audit(), busy: window.__chess.game.busy, left: window.__chess.game.root.children.filter((o) => o.isMesh && o.geometry?.type === 'BoxGeometry' && o.scale.x < 0.3).length, tray: window.__chess.game.getState().captured.b.length }));
  R.expect('capture: afterwards the board is clean, no cube is left, the victim is in the tray', !after.audit.length && !after.busy && after.left === 0 && after.tray === 1, JSON.stringify(after));

  // the theme in and out in place
  await ev(async () => { await window.__chess.themes.set('wood', { persist: false }); window.__chess.draw(); });
  const out = await ev(() => { const { game } = window.__chess; const ps = game.root.children.filter((g) => g.userData.piece); return { n: ps.length, rigs: ps.filter((g) => g.children[0].children[0]?.name === 'rig').length, trays: ps.filter((g) => g.position.x > 4.5 || g.position.x < -4.5).length, h: ps.every((g) => g.userData.height > 0.5), audit: game.audit() }; });
  R.expect('leaving Pixelwelt gives every piece, in the trays too, its lathe look back', out.rigs === 0 && out.n === 4 && out.h && !out.audit.length, JSON.stringify(out));
  await ev(async () => { await window.__chess.themes.set('pixel', { persist: false }); window.__chess.step(0.5); window.__chess.draw(); });
  const back = await ev(() => window.__chess.game.root.children.filter((g) => g.userData.piece && g.children[0].children[0]?.name === 'rig').length);
  R.expect('and back to Pixelwelt: the characters return', back === 4, `${back} rigs`);
  // variant a loads too: 32 rigs and the same 12 figure kinds
  await page.goto(`${URL0}/?quality=low&manual=1&ai=0&theme=pixel&variant=a`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  const va = await ev(() => { const { game, themes } = window.__chess; return { theme: themes.current(), n: game.root.children.filter((g) => g.userData.piece && g.children[0]?.children[0]?.name === 'rig').length, style: game.root.children.filter((g) => g.userData.piece).every((g) => g.userData.style === 'pixel') }; });
  R.expect('?variant=a: the other figure set loads, 32 rigs', va.theme === 'pixel' && va.n === 32 && va.style, JSON.stringify(va));
  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
