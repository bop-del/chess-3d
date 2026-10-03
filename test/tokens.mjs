// Tokens view checks (smoke tier): node test/tokens.mjs [--port=5362] [--skip-build] [--base=<server>]
// Drives the real page at quality=low with ?manual=1 (no time passes except through __chess.step): every piece is a disc and its 3D body is
// hidden, a click on a disc picks its square, a capture flies to the tray and the tray piece is a disc too, undo brings it back,
// a promotion makes a disc for the new piece (and undo for the pawn), a theme switch keeps every disc, the hint arrow is drawn
// on top of the discs, the discs stay when the view is left (bodies come back) and no console error or foreign request.
// Exit codes: 0 pass (warnings allowed), 1 a check failed, 2 setup error.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5362));
const OUT = '.tmp/tokens-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');   // a server that is already up (test/smoke-groups.mjs)
const R = reporter();
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\ntokens: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'TOKENS FAILED' : 'TOKENS OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

try {
  if (BASE) server = { base: BASE + '/', stop() {} };
  else {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  browser = await launchBrowser({ w: 1280, h: 720 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

// every piece group (board and trays) has a visible disc and no visible 3D body
const state = (page) => page.evaluate(() => {
  const root = window.__chess.game.root;
  const groups = root.children.filter((o) => o.userData?.piece);
  let bad = 0, discs = 0, bodies = 0;
  for (const g of groups) {
    const t = g.userData.token;
    if (t && t.visible && t.parent === g) discs++; else bad++;
    for (const ch of g.children) if (!ch.userData.hit && ch.name !== 'token' && ch.visible) bodies++;
  }
  return { n: groups.length, discs, bad, bodies, types: groups.map((g) => g.userData.piece.type + g.userData.piece.color).sort().join(' ') };
});
const step = (page, s = 3) => page.evaluate((s) => { window.__chess.step(s); window.__chess.draw(); }, s);
async function open(page, query = '') {
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(`${server.base}?quality=low&manual=1&ai=0&view=tokens${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await page.evaluate(() => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await step(page, 2);
}
const xy = (page, x, y, z) => page.evaluate((x, y, z) => {
  const { THREE, stage } = window.__chess;
  const v = new THREE.Vector3(x, y, z).project(stage.camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
}, x, y, z);

try {
  const page = await browser.newPage();
  const watch = await watchPage(page, ['127.0.0.1', 'localhost']);

  // start position: 32 discs, no body shows
  await open(page);
  let s = await state(page);
  R.expect('start: 32 discs, no 3D body shows', s.n === 32 && s.discs === 32 && s.bad === 0 && s.bodies === 0, `${s.discs} discs`, JSON.stringify(s));
  R.expect('the view is Tokens, orthographic, orbit locked', await page.evaluate(() => window.__chess.views.current() === 'tokens' && window.__chess.stage.projection === 'ortho'), 'tokens, ortho');

  // picking through a disc: a click on the e2 disc selects e2, a click on e4 moves it
  const e2 = await xy(page, 0.5, 0.17, 2.5), e4 = await xy(page, 0.5, 0, 0.5);
  await page.mouse.click(e2.x, e2.y);
  await step(page, 0.5);
  const sel = await page.evaluate(() => window.__chess.game.getState().selected);
  R.expect('click on a disc selects its square', sel === 'e2', 'e2', `selected ${sel}`);
  await page.mouse.click(e4.x, e4.y);
  await step(page, 1.5);
  R.expect('click on a target moves the disc', await page.evaluate(() => window.__chess.game.getState().moves.length) === 1, 'e4 played');

  // capture to the tray, then undo
  await page.evaluate(() => { const g = window.__chess.game; g.move('d7', 'd5'); });
  await step(page, 2);
  await page.evaluate(() => { window.__chess.game.move('e4', 'd5'); });
  await step(page, 3);
  s = await state(page);
  const cap = await page.evaluate(() => window.__chess.game.getState().captured);
  R.expect('capture: the captured piece lands in its tray as a disc', s.n === 32 && s.discs === 32 && s.bodies === 0 && JSON.stringify(cap).includes('p'), `${s.discs} discs, captured ${JSON.stringify(cap)}`, JSON.stringify({ s, cap }));
  await page.evaluate(() => window.__chess.game.undo());
  await step(page, 3);
  s = await state(page);
  const cap2 = await page.evaluate(() => JSON.stringify(window.__chess.game.getState().captured));
  R.expect('undo: the piece is back on the board as a disc', s.n === 32 && s.discs === 32 && s.bodies === 0 && !cap2.includes('"p"'), `${s.discs} discs`, JSON.stringify({ s, cap2 }));

  // hint arrow on top: shown over a capture, drawn after (above) the discs
  await page.evaluate(() => { const { game, openings } = window.__chess; game.selectSquare('d5'); openings.hint.enabled = true; openings.hint.show(0 * 8 + 3, 4 * 8 + 3); });
  await step(page, 0.5);
  const hint = await page.evaluate(() => {
    const { openings, gimbal } = window.__chess;
    const g = gimbal.getObjectByName('move-hint');
    const orders = []; let depth = true;
    g.traverse((o) => { if (o.isMesh) { orders.push(o.renderOrder); if (o.material.depthTest === false) depth = false; } });
    let disc = 0; gimbal.traverse((o) => { if (o.name === 'token') o.traverse((m) => { if (m.isMesh) disc = Math.max(disc, m.renderOrder); }); });
    return { visible: openings.hint.visible, orders, disc, depth };
  });
  R.expect('hint arrow is shown and drawn over the discs (above them, no depth test)', hint.visible && hint.orders.length >= 3 && hint.orders.every((o) => o > hint.disc) && !hint.depth, JSON.stringify(hint));
  await page.screenshot({ path: '.tmp/tokens-hint.png' });
  await page.evaluate(() => window.__chess.openings.hint.hide?.());

  // theme switch keeps every disc and the white disc takes the theme material
  const mapOf = () => page.evaluate(() => {
    const g = window.__chess.game.root.children.find((o) => o.userData?.piece?.color === 'w');
    const m = g.userData.token.children[1].material;     // the white disc face: the theme's white piece material
    return m.map ? m.map.uuid : 'none';
  });
  const before = await mapOf();
  await page.evaluate(async () => { await window.__chess.themes.set('wood'); window.__chess.step(1); window.__chess.draw(); });
  s = await state(page);
  const after = await mapOf();
  R.expect('theme switch: every disc stays, white discs take the theme material', s.n === 32 && s.discs === 32 && s.bodies === 0 && before !== after, `${s.discs} discs, map ${before} to ${after}`, JSON.stringify({ s, before, after }));
  await page.evaluate(async () => { await window.__chess.themes.set('classic'); window.__chess.step(1); window.__chess.draw(); });

  // promotion: a disc for the new queen, undo brings the pawn disc back
  await open(page, '&fen=4k3/P7/8/8/8/8/8/4K3%20w%20-%20-%200%201');
  s = await state(page);
  R.expect('promotion position: 3 discs', s.n === 3 && s.discs === 3, s.types);
  await page.evaluate(() => window.__chess.game.move('a7', 'a8', 'q'));
  await step(page, 3);
  s = await state(page);
  R.expect('promotion: the new queen is a disc, no pawn left', s.discs === s.n && s.bodies === 0 && s.types.includes('qw') && !s.types.includes('pw'), s.types, JSON.stringify(s));
  await page.evaluate(() => window.__chess.game.undo());
  await step(page, 3);
  s = await state(page);
  R.expect('undo of the promotion: the pawn is a disc again', s.discs === s.n && s.bodies === 0 && s.types.includes('pw') && !s.types.includes('qw'), s.types, JSON.stringify(s));

  // leaving the view brings the bodies back; going back makes the discs again
  await page.evaluate(() => window.__chess.views.set('white', { remember: false }));
  await step(page, 2);
  s = await state(page);
  R.expect('another view: the discs are off and the bodies show', s.discs === 0 && s.bodies > 0, `${s.bodies} body parts`, JSON.stringify(s));
  const depths = await page.evaluate(() => { const d = []; window.__chess.gimbal.traverse((n) => { if (n.name === 'move-hint') n.traverse((o) => { if (o.isMesh) d.push(o.material.depthTest); }); }); return d; });
  R.expect('another view: the hint arrow is depth tested again', depths.length > 0 && depths.every(Boolean), `depth test on (${depths.length} meshes)`, JSON.stringify(depths));
  await page.evaluate(() => window.__chess.views.set('tokens', { remember: false }));
  await step(page, 2);
  s = await state(page);
  R.expect('back to Tokens: discs again', s.discs === s.n && s.bodies === 0, `${s.discs} discs`, JSON.stringify(s));

  R.expect('no console error, page error or foreign request', !watch.errs.length && !watch.foreign.length, '', [...watch.errs, ...watch.foreign].join(' | '));
} catch (e) {
  R.fail('tokens run', 'threw: ' + String(e.stack || e).slice(0, 400));
}
await finish();
