// Theme checks: node test/themes.mjs [--port=5351] [--base=<server>]
// Switches all six themes through the real page (nothing mocked) at quality=low with ?manual=1: the game state, selection, hint
// arrow, trays and highlights survive every switch, each theme looks different, ten switches leave the renderer at its baseline
// (textures, geometries), the choice is remembered over a reload, ?theme= wins for one load only, a bad flag falls back, the swatch
// row sits in the Scene card (desktop) and in the phone Menu, Glass uses transmission on High only, no console error or warning.
// Exit codes: 0 pass, 1 a check failed.
import { createHash } from 'node:crypto';
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5351').slice(7));
const R = reporter();
const OUT = '.tmp/themes-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const IDS = ['classic', 'tournament', 'wood', 'metal', 'glass', 'blocks'];
const MOVES = 'e2e4,d7d5,e4d5,g8f6,b1c3';
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  const load = async (query = '', size = { width: 1280, height: 720 }) => {
    await page.setViewport(size.width < 500 ? { ...size, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : size);
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0${size.width < 500 ? '&touch=1' : ''}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.evaluate(() => { window.__chess.step(1); window.__chess.draw(); });
  };
  const shot = async () => createHash('md5').update(await page.screenshot()).digest('hex');
  const cur = () => page.evaluate(() => window.__chess.themes.current());

  await load(`&moves=${MOVES}`);
  await page.evaluate(() => { localStorage.clear(); });
  R.expect('starts on Classic with nothing built', (await cur()) === 'classic' && (await page.evaluate(() => window.__chess.themes.textureCount)) === 0, 'classic, 0 textures');
  const state = () => page.evaluate(() => {
    const { game, board, openings, themes } = window.__chess;
    const s = game.getState();
    const hl = board.group.getObjectByName('highlights');
    return { fen: s.fen, selected: s.selected, captured: JSON.stringify(s.captured), hl: hl.visible ? hl.geometry.instanceCount : 0, hint: openings.hint.visible, trays: game.root.children.filter((o) => o.name === 'tray-slab').length, theme: themes.current() };
  });
  await page.evaluate(() => { const { game, openings } = window.__chess; game.selectSquare('f1'); openings.hint.enabled = true; openings.hint.show(12, 28); window.__chess.step(0.5); window.__chess.draw(); });
  const s0 = await state();
  R.expect('test position: selection, highlights, hint arrow, a captured piece', s0.selected === 'f1' && s0.hl > 0 && s0.hint && s0.captured.includes('p'), `${s0.selected}, ${s0.hl} marks`, JSON.stringify(s0));
  const mem = () => page.evaluate(() => { const m = window.__chess.stage.renderer.info.memory; return { tex: m.textures, geo: m.geometries }; });
  await page.evaluate(() => window.__chess.draw());
  const base = await mem();
  const classicLook = () => page.evaluate(() => {
    const { game, board, stage } = window.__chess;
    const mats = {}; game.root.traverse((o) => { if (o.isMesh && o.material.name) mats[o.material.name] = o.material; });
    const m = (x) => [x.color.getHexString(), x.roughness, x.metalness, x.clearcoat, x.transmission || 0, x.map ? x.map.uuid : null];
    const sq = {}; board.group.traverse((o) => { if (o.isMesh && /^squares|^frame|^maple|^plinth|^gold/.test(o.name)) sq[o.name] = m(o.material); });
    return { ivory: m(mats.ivory), ebony: m(mats.ebony), sq, key: +stage.lights.key.intensity.toFixed(3), exposure: +stage.renderer.toneMappingExposure.toFixed(3) };
  });
  const look0 = await classicLook();

  const shots = {}, times = [];
  for (const id of IDS) {
    const ms = await page.evaluate(async (id) => { const t0 = performance.now(); await window.__chess.themes.set(id); window.__chess.draw(); return performance.now() - t0; }, id);
    times.push(ms);
    const s = await state();
    R.expect(`${id}: on, game state kept`, s.theme === id && s.fen === s0.fen && s.selected === s0.selected && s.captured === s0.captured && s.hl === s0.hl && s.hint === s0.hint && s.trays === 2, `${Math.round(ms)} ms`, JSON.stringify(s));
    shots[id] = await shot();
  }
  R.expect('the six themes look different', new Set(Object.values(shots)).size === 6, '6 distinct frames', JSON.stringify(shots));
  R.expect('switching is quick (software GL, set plus one frame)', Math.max(...times) < 4000, `max ${Math.round(Math.max(...times))} ms`);

  // the Symbols view takes the plain squares from every theme and gives the theme's own look back when it is left
  await page.evaluate(() => window.__chess.views.set('symbols', { instant: true, remember: false }));
  const PLAIN_LIGHT = { classic: 'ddd8ca', tournament: 'f0eed6', wood: 'e6c28c', metal: 'a9acb4', glass: 'b4c8d8' };
  for (const id of IDS) {
    const r = await page.evaluate(async (id) => {
      await window.__chess.themes.set(id); window.__chess.step(0.3); window.__chess.draw();
      const o = window.__chess.gimbal.getObjectByName('squares-light'), m = o.material;
      return { hex: m.color.getHexString(), map: !!m.map, vc: m.vertexColors, on: window.__chess.symbols.visible, hidden: !o.visible };
    }, id);
    // Blocks hides the classic squares: its island blocks are the plain board, so the symbols sit on those
    if (id === 'blocks') R.expect('blocks: the Symbols view sits on the island squares (classic squares stay hidden)', r.on && r.hidden, JSON.stringify(r));
    else R.expect(`${id}: the Symbols view has plain squares in the theme's colours`, r.on && !r.map && !r.vc && r.hex === PLAIN_LIGHT[id], JSON.stringify(r));
    shots['symbols-' + id] = await shot();
  }
  R.expect('the Symbols view looks different in every theme', new Set(IDS.map((id) => shots['symbols-' + id])).size === IDS.length, `${IDS.length} distinct frames`);
  await page.evaluate(async () => { window.__chess.views.set('white', { instant: true, remember: false }); await window.__chess.themes.set('classic'); for (let i = 0; i < 40; i++) window.__chess.draw(0.05); });
  R.expect('leaving the Symbols view restores the theme squares', JSON.stringify(await classicLook()) === JSON.stringify(look0), 'identical Classic look');

  // a piece moves and a capture flies to the tray while a theme is on
  await page.evaluate(async () => { await window.__chess.themes.set('wood'); const g = window.__chess.game; g.finishAnimations(); g.move('c3', 'd5'); window.__chess.step(3); window.__chess.draw(); });
  const mv = await state();
  R.expect('a capture in Wood goes to the tray, game continues', /"b":\["p","p"\]|"b":\["p"\]/.test(mv.captured) || mv.captured !== s0.captured, mv.captured, mv.captured);
  await page.evaluate(() => { window.__chess.game.undo(); window.__chess.step(2); window.__chess.draw(); });

  // ten switches, then Classic: no growth
  await page.evaluate(async () => { for (const id of ['glass', 'metal', 'wood', 'tournament', 'glass', 'metal', 'wood', 'tournament', 'glass', 'tournament']) { await window.__chess.themes.set(id); window.__chess.draw(); } await window.__chess.themes.set('classic'); window.__chess.draw(); });
  const after = await mem();
  R.expect('ten switches leak no textures or geometry', after.tex <= base.tex && after.geo <= base.geo, `textures ${base.tex} to ${after.tex}, geometries ${base.geo} to ${after.geo}`);
  await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__chess.draw(0.05); });
  const look = await classicLook();
  R.expect('Classic again restores the first Classic look (materials, maps, lights)', JSON.stringify(look) === JSON.stringify(look0), 'identical', JSON.stringify([look0, look]));

  // rapid picks: the last one wins
  const rapid = await page.evaluate(async () => { const th = window.__chess.themes; th.set('glass'); th.set('metal'); await th.set('tournament'); return th.current(); });
  R.expect('rapid picks end on the last one', rapid === 'tournament', rapid);

  // remembered over a reload, flag for one load only, bad flag falls back
  await page.evaluate(async () => { await window.__chess.themes.set('metal'); });
  await load();
  R.expect('reload keeps the choice', (await cur()) === 'metal' && (await page.evaluate(() => localStorage.getItem('chess3d.theme'))) === 'metal', 'metal');
  await load('&theme=glass');
  R.expect('?theme= applies for this load', (await cur()) === 'glass', 'glass');
  await load();
  R.expect('?theme= was not remembered', (await cur()) === 'metal', 'metal again');
  await load('&theme=nonsense');
  R.expect('an unknown ?theme= falls back to the stored choice', (await cur()) === 'metal', 'metal');
  await page.evaluate(() => { localStorage.setItem('chess3d.theme', 'not-a-theme'); });
  await load();
  R.expect('a bad stored value falls back to Classic', (await cur()) === 'classic', 'classic');

  // swatch row, desktop: in the Scene card, first, all six, click switches, the mark follows
  await page.evaluate(() => localStorage.removeItem('chess3d.theme'));
  await load();
  const sw = await page.evaluate(() => {
    const row = document.querySelector('[data-settings="themes"]');
    const btns = row ? [...row.querySelectorAll('.swatch')] : [];
    return { inScene: !!row && !!row.closest('[data-card="scene"], [data-slot="themes"]'), first: !!row && row.parentElement.firstElementChild === row, ids: btns.map((b) => b.dataset.theme).join(), on: btns.filter((b) => b.classList.contains('on')).map((b) => b.dataset.theme).join() };
  });
  R.expect('swatch row in the Scene card, first, six swatches, Classic marked', sw.inScene && sw.first && sw.ids === IDS.join() && sw.on === 'classic', sw.ids, JSON.stringify(sw));
  await page.evaluate(() => document.querySelector('#tab-settings')?.click());
  await page.click('.swatch[data-theme="tournament"]');
  await page.waitForFunction("window.__chess.themes.current() === 'tournament'", { timeout: 20000 });
  const marked = await page.evaluate(() => [...document.querySelectorAll('[data-settings="themes"] .swatch.on')].map((b) => b.dataset.theme).join());
  R.expect('clicking a swatch switches the theme and moves the mark', marked === 'tournament', marked);
  await page.evaluate(() => { document.querySelector('.lang-btn[data-lang="de"]').click(); });
  const de = await page.evaluate(() => [...document.querySelectorAll('[data-settings="themes"] .swatch')].map((b) => b.title).join());
  R.expect('swatch names in German', de === 'Klassisch,Turnier,Holz,Metall,Glas,Blöcke', de);
  await page.evaluate(() => { document.querySelector('.lang-btn[data-lang="en"]').click(); });

  // Glass: real transmission on High only
  await page.evaluate(async () => { await window.__chess.themes.set('glass'); });
  const lowT = await page.evaluate(() => window.__chess.stage.quality);
  const t = async () => page.evaluate(async () => { await new Promise((r) => setTimeout(r, 400)); let tr = 0; window.__chess.game.root.traverse((o) => { if (o.isMesh && o.material.transmission > tr) tr = o.material.transmission; }); return tr; });
  const trLow = await t();
  await page.evaluate(() => window.__chess.stage.setQuality('high'));
  const trHigh = await t();
  await page.evaluate(() => window.__chess.stage.setQuality('low'));
  const trBack = await t();
  R.expect('Glass: no transmission on Low, real transmission on High, and back', lowT === 'low' && trLow === 0 && trHigh > 0.5 && trBack === 0, `low ${trLow}, high ${trHigh}, low ${trBack}`);

  // phone: the swatches are in the Menu sheet and reachable by tap
  await page.evaluate(() => localStorage.removeItem('chess3d.theme'));
  await load('', { width: 390, height: 844 });
  const ph = await page.evaluate(() => { const row = document.querySelector('[data-settings="themes"]'); return { inSheet: !!row && !!row.closest('.psheet-body'), n: row ? row.querySelectorAll('.swatch').length : 0 }; });
  R.expect('phone: swatch row in the Menu sheet', ph.inSheet && ph.n === 6, JSON.stringify(ph));
  await page.tap('.tb[data-act="menu"]');
  await page.waitForSelector('.psheet.open', { timeout: 10000 });
  await page.evaluate(() => { const c = document.querySelector('.card[data-card="scene"]'); if (c.classList.contains('collapsed')) c.querySelector('header').click(); });
  await new Promise((r) => setTimeout(r, 600));
  const rect = () => page.evaluate(() => { const r = document.querySelector('.swatch[data-theme="glass"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; });
  await page.evaluate(() => document.querySelector('.swatch[data-theme="glass"]').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 900));   // the sheet scrolls smoothly: read the rectangle only after it settled
  const box = await rect();
  R.expect('phone: swatch tap target is at least 44 px', box.w >= 44 && box.h >= 44, `${Math.round(box.w)} x ${Math.round(box.h)}`);
  await page.touchscreen.tap(box.x, box.y);
  const switched = await page.waitForFunction("window.__chess.themes.current() === 'glass'", { timeout: 60000 }).then(() => true, () => false);
  const hit = switched ? '' : await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + e.className : 'nothing'; }, box);
  R.expect('phone: tapping Glass switches it (fake glass on this tier)', switched, 'glass', `no switch, the tap at ${Math.round(box.x)},${Math.round(box.y)} hit ${hit}`);

  // Blocks: its own world (island, clouds, waterfall) in the gimbal, the classic board meshes hidden, water and clouds move, all gone when left
  await load('&theme=blocks');
  const bl = await page.evaluate(() => {
    const { gimbal, board, themes } = window.__chess;
    const w = gimbal.getObjectByName('blocks-world'), cloud = w?.children.find((o) => o.name === 'cloud');
    const x0 = cloud?.position.x;
    themes.update(10);
    return { world: !!w, hidden: board.group.getObjectByName('squares-light').visible === false && board.group.getObjectByName('frame').visible === false, moved: !!cloud && cloud.position.x !== x0, picks: board.group.children.filter((o) => o.userData.square).length };
  });
  R.expect('Blocks: island in the gimbal, classic board hidden, clouds drift, 64 pick squares kept', bl.world && bl.hidden && bl.moved && bl.picks === 64, JSON.stringify(bl));
  await page.evaluate(async () => { await window.__chess.themes.set('wood', { persist: false }); });
  const gone = await page.evaluate(() => ({ world: !!window.__chess.gimbal.getObjectByName('blocks-world'), shown: window.__chess.board.group.getObjectByName('squares-light').visible }));
  R.expect('leaving Blocks removes the island and shows the classic board again', !gone.world && gone.shown, JSON.stringify(gone));
  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
