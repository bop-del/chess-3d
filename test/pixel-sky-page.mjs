// Pixelwelt Sky and Backdrop in the real page (CHE-239): node test/pixel-sky-page.mjs [--port=5355] [--base=<server>]
//   flags       ?sky=night&backdrop=castle and ?set=sturmburg reach the world; the default is the set Inselmorgen (sunrise and islands)
//   rows        the Sets row (3), the Sky row (5) and the Backdrop row (None and 2) show with Pixelwelt only, on desktop and on a phone
//   click       a tile changes the world, the figure colour and the stage light at once, is remembered (localStorage), survives a reload;
//               a Set tile picks both axes
//   theme       the rows hide with another theme and come back, the sky layer is rebuilt without leaks (meshes stay the same count)
//   frame       the board squares stay readable at night (light over dark square contrast in the rendered frame) and the page is quiet
// Software or GPU GL, quality=low and ?manual=1. Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5355').slice(7));
const R = reporter();
const OUT = '.tmp/pixel-sky-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const open = async (query, vp = { width: 1280, height: 720 }, ua) => {
    const page = await browser.newPage();
    const w = await watchPage(page);
    if (ua) await page.setUserAgent(ua);
    await page.setViewport(vp);
    await page.goto(`${URL0}/?${query}&quality=low&manual=1&ai=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    return { page, w };
  };
  const state = (page) => page.evaluate(() => {
    const C = window.__chess, w = C.themes.world, s = w?.group.userData.sky;
    const rows = ['set', 'sky', 'back'].map((k) => { const r = document.querySelector(`[data-pixlook="${k}"]`); return r ? { hidden: r.hidden, n: r.querySelectorAll('.swatch').length, on: r.querySelector('.swatch.on')?.dataset.value } : null; });
    const fig = C.game.root.children.find((g) => g.userData.piece);
    let figColor = null; fig?.traverse((o) => { if (o.isMesh && o.material?.map && figColor === null) figColor = o.material.color.getHex(); });
    return { theme: C.themes.current(), sky: s?.state.sky, backdrop: s?.state.backdrop, rows, grass: w?.kit.mats.grassTop.color.getHex(), figColor, bg: '#' + C.stage.scene.background?.image?.getContext?.('2d')?.getImageData(128, 4, 1, 1).data.slice(0, 3).reduce((a, v) => a + v.toString(16).padStart(2, '0'), ''), meshes: (() => { let n = 0; s?.layer.traverse((o) => { if (o.isMesh) n++; }); return n; })() };
  });
  const click = (page, kind, value) => page.evaluate((k, v) => { document.querySelector(`[data-pixlook="${k}"] .swatch[data-value="${v}"]`).click(); const C = window.__chess; C.step(0.2); for (let i = 0; i < 20; i++) C.stage.render(0.2); C.draw(); }, kind, value);

  // flags
  let { page, w } = await open('theme=pixel&sky=night&backdrop=castle');
  let s = await state(page);
  R.expect('?sky=night&backdrop=castle reach the world', s.sky === 'night' && s.backdrop === 'castle' && s.meshes >= 3, JSON.stringify({ sky: s.sky, backdrop: s.backdrop, meshes: s.meshes }));
  R.expect('rows: Sets has 3 tiles (none on for a free pair), Sky 5, Backdrop 3, all shown with Pixelwelt', s.rows[0]?.n === 3 && s.rows[1]?.n === 5 && s.rows[2]?.n === 3 && s.rows.every((x) => !x.hidden) && !s.rows[0].on && s.rows[1].on === 'night' && s.rows[2].on === 'castle', JSON.stringify(s.rows));
  // night frame: the board squares stay readable (light over dark square)
  const contrast = await page.evaluate(() => {
    const C = window.__chess, T = C.THREE; C.controls.setCamera({ yaw: 0, pitch: 60 * Math.PI / 180, dist: 19 }); C.step(0.2, 3); C.draw();
    const cv = document.querySelector('canvas'), off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height;
    const x = off.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0);
    const lum = (sq) => { const f = sq % 8, r = (sq / 8) | 0, v = new T.Vector3(f - 3.5, 0, 3.5 - r).applyMatrix4(C.gimbal.matrixWorld).project(C.stage.camera); const px = Math.round((v.x + 1) / 2 * cv.width), py = Math.round((1 - v.y) / 2 * cv.height); let t = 0, n = 0; for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const d = x.getImageData(px + dx, py + dy, 1, 1).data; t += 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; n++; } return t / n; };
    return { light: lum(2 * 8 + 3), dark: lum(2 * 8 + 2) };   // d3 is a light square, c3 a dark one
  });
  R.expect('night: light squares clearly brighter than dark ones in the rendered frame', contrast.light > contrast.dark * 1.25, `light ${contrast.light.toFixed(0)}, dark ${contrast.dark.toFixed(0)}`);
  R.expect('no console error or warning (flags)', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
  await page.close();

  // a set
  ({ page, w } = await open('theme=pixel&set=sturmburg'));
  s = await state(page);
  R.expect('?set=sturmburg is storm and castle, the Sets tile is marked', s.sky === 'storm' && s.backdrop === 'castle' && s.rows[0].on === 'sturmburg', `${s.sky} ${s.backdrop} ${s.rows[0].on}`);
  await page.close();

  // clicks, memory, theme switch
  ({ page, w } = await open('theme=pixel'));
  s = await state(page);
  const base = { meshes: s.meshes, grass: s.grass, fig: s.figColor, bg: s.bg };
  R.expect('default: the set Inselmorgen (sunrise and islands), marked in all three rows', s.sky === 'sunrise' && s.backdrop === 'islands' && s.rows[0].on === 'inselmorgen' && s.rows[1].on === 'sunrise' && s.rows[2].on === 'islands', JSON.stringify({ sky: s.sky, backdrop: s.backdrop, rows: s.rows.map((x) => x.on) }));
  await click(page, 'sky', 'night'); await click(page, 'back', 'castle');
  s = await state(page);
  R.expect('a click on Night and Castle changes the world, the figures and the light', s.sky === 'night' && s.backdrop === 'castle' && s.grass !== base.grass && s.figColor !== base.fig && s.bg !== base.bg && s.meshes >= 3, JSON.stringify({ sky: s.sky, backdrop: s.backdrop, grass: s.grass?.toString(16), fig: s.figColor?.toString(16), bg: s.bg, meshes: s.meshes }));
  const stored = await page.evaluate(() => [localStorage.getItem('chess3d.pixsky'), localStorage.getItem('chess3d.pixbackdrop')]);
  R.expect('the pick is remembered per browser', stored[0] === 'night' && stored[1] === 'castle', stored.join(','));
  s = await state(page);
  R.expect('Night and Castle is a free pair: no Sets tile is marked', !s.rows[0].on, String(s.rows[0].on));
  await click(page, 'set', 'winterdorf');
  s = await state(page);
  R.expect('a Sets tile picks both axes (Winterdorf: snow and castle) and marks the other rows', s.sky === 'snow' && s.backdrop === 'castle' && s.rows[0].on === 'winterdorf' && s.rows[1].on === 'snow' && s.rows[2].on === 'castle', JSON.stringify({ sky: s.sky, backdrop: s.backdrop, rows: s.rows.map((x) => x.on) }));
  await click(page, 'sky', 'snow'); await click(page, 'back', 'none');
  await page.evaluate(() => { window.__chess.step(1); });
  s = await state(page);
  R.expect('snow and no backdrop: the layer is rebuilt without leftovers', s.sky === 'snow' && s.backdrop === 'none' && s.meshes === 1, `${s.meshes} meshes`);
  await page.evaluate(async () => { await window.__chess.themes.set('wood', { persist: false }); });
  s = await state(page);
  R.expect('another theme hides all three rows', s.rows.every((x) => x.hidden), JSON.stringify(s.rows));
  await page.evaluate(async () => { await window.__chess.themes.set('pixel', { persist: false }); });
  s = await state(page);
  R.expect('and back to Pixelwelt: the rows return and the pick is still the snow', !s.rows[1].hidden && s.sky === 'snow' && s.rows[1].on === 'snow', `${s.sky} ${s.rows[1].on}`);
  R.expect('no console error or warning (clicks)', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
  await page.close();

  // a reload keeps the pick (the same context, so the storage is shared)
  ({ page, w } = await open('theme=pixel'));
  await click(page, 'sky', 'night'); await click(page, 'back', 'none');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  s = await state(page);
  R.expect('a reload brings the picks back', s.sky === 'night' && s.backdrop === 'none', `${s.sky} ${s.backdrop}`);
  await page.close();

  // the Island row (CHE-357): five tiles, d is the default, a click rebuilds the world without a reload and without leaks, the pick is remembered
  {
    ({ page, w } = await open('theme=pixel'));
    const isl = (pg) => pg.evaluate(() => {
      const C = window.__chess, wd = C.themes.world, r = document.querySelector('[data-pixlook="island"]'), mem = C.stage.renderer.info.memory;
      return { n: r?.querySelectorAll('.swatch').length, on: r?.querySelector('.swatch.on')?.dataset.value, hidden: r?.hidden, group: wd?.group.uuid, boxes: wd?.group.getObjectByName('island')?.userData.boxes.length, geo: mem.geometries, tex: mem.textures, stored: localStorage.getItem('chess3d.pixisland'), reloads: window.__islandMark === 1 };
    });
    const pickIsland = (pg, v) => pg.evaluate(async (id) => { document.querySelector(`[data-pixlook="island"] .swatch[data-value="${id}"]`).click(); const C = window.__chess; await new Promise((r) => setTimeout(r, 400)); for (let i = 0; i < 3; i++) { C.step(0.2); C.stage.render(0.2); } C.draw(); }, v);
    await page.evaluate(() => { window.__islandMark = 1; });
    s = await isl(page);
    R.expect('Island row: 5 tiles, shown with Pixelwelt, d (floating islands) is marked by default', s.n === 5 && !s.hidden && s.on === 'd' && s.stored === null, JSON.stringify(s));
    const first = s;
    const boxes = {};
    for (const id of ['a', 'b', 'c', 'e', 'd']) { await pickIsland(page, id); s = await isl(page); boxes[id] = s.boxes; R.expect(`Island ${id}: the click rebuilds the world (new group, no reload), marks the tile and stores it`, s.on === id && s.stored === id && s.group !== first.group && s.reloads && s.boxes > 300, JSON.stringify(s)); }
    R.expect('the five islands differ from each other', new Set(Object.values(boxes)).size >= 4, JSON.stringify(boxes));
    R.expect('a full cycle ends where it began: no leaked geometries or textures (renderer.info)', s.geo === first.geo && s.tex === first.tex, `geometries ${first.geo} to ${s.geo}, textures ${first.tex} to ${s.tex}`);
    await pickIsland(page, 'b');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    s = await isl(page);
    R.expect('a reload keeps the island pick (b)', s.on === 'b', JSON.stringify(s));
    await page.close();
    ({ page, w } = await open('theme=pixel&island=e'));
    s = await isl(page);
    R.expect('?island=e beats the stored b for this visit and stores nothing new', s.on === 'e' && s.stored === 'b', JSON.stringify(s));
    R.expect('no console error or warning (island row)', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
    await page.close();
  }

  // the Team row (CHE-372): knights (the default), dragons, wizards and pirates, a click restyles every figure without a reload and
  // without leaks, the pick is remembered, ?pixteam= beats it for one visit
  {
    ({ page, w } = await open('theme=pixel'));
    const team = (pg) => pg.evaluate(() => {
      const C = window.__chess, r = document.querySelector('[data-pixlook="team"]'), mem = C.stage.renderer.info.memory;
      let tris = 0; C.gimbal.traverse((o) => { if (o.isMesh && o.parent?.parent?.name === 'rig') tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
      return { n: r?.querySelectorAll('.swatch').length, on: r?.querySelector('.swatch.on')?.dataset.value, hidden: r?.hidden, tris: Math.round(tris), geo: mem.geometries, tex: mem.textures, stored: localStorage.getItem('chess3d.pixteam'), reloads: window.__teamMark === 1 };
    });
    const pickTeam = (pg, v) => pg.evaluate(async (id) => { document.querySelector(`[data-pixlook="team"] .swatch[data-value="${id}"]`).click(); const C = window.__chess; await new Promise((r) => setTimeout(r, 400)); for (let i = 0; i < 3; i++) { C.step(0.2); C.stage.render(0.2); } C.draw(); }, v);
    await page.evaluate(() => { window.__teamMark = 1; });
    s = await team(page);
    R.expect('Team row: 4 tiles, shown with Pixelwelt, knights marked by default, nothing stored', s.n === 4 && !s.hidden && s.on === 'knights' && s.stored === null, JSON.stringify(s));
    const first = s;
    for (const id of ['dragons', 'wizards', 'pirates']) {
      await pickTeam(page, id);
      s = await team(page);
      R.expect(`Team ${id}: the click restyles the figures (other triangle count, no reload), marks the tile and stores it`, s.on === id && s.stored === id && s.reloads && s.tris > 0 && s.tris !== first.tris, JSON.stringify({ before: first.tris, after: s.tris, on: s.on, stored: s.stored }));
    }
    await pickTeam(page, 'knights');
    s = await team(page);
    R.expect('back to knights: the same figures as before, no leaked geometries or textures (renderer.info)', s.on === 'knights' && s.tris === first.tris && s.geo === first.geo && s.tex === first.tex, `triangles ${first.tris} to ${s.tris}, geometries ${first.geo} to ${s.geo}, textures ${first.tex} to ${s.tex}`);
    await pickTeam(page, 'dragons');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    s = await team(page);
    R.expect('a reload keeps the team pick (dragons)', s.on === 'dragons', JSON.stringify(s));
    await page.close();
    ({ page, w } = await open('theme=pixel&pixteam=knights'));
    s = await team(page);
    R.expect('?pixteam=knights beats the stored dragons for this visit and stores nothing new', s.on === 'knights' && s.stored === 'dragons', JSON.stringify(s));
    await page.evaluate(() => localStorage.removeItem('chess3d.pixteam'));
    R.expect('no console error or warning (team row)', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
    await page.close();
  }

  // a phone
  ({ page, w } = await open('theme=pixel&touch=1', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, UA));
  s = await state(page);
  R.expect('phone: all three rows are in the Options sheet with Pixelwelt', s.rows[0]?.n === 3 && s.rows[1]?.n === 5 && s.rows[2]?.n === 3 && s.rows.every((x) => !x.hidden), JSON.stringify(s.rows));
  R.expect('no console error or warning (phone)', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
  await page.close();

  // the option rows (CHE-265): German headings, no cut off label, 44 px tap targets, the selected mark, with the tile pictures at 1280 and 390 px
  const rowCheck = async (tag, query, vp, ua, lang) => {
    const pg = await browser.newPage();
    const ww = await watchPage(pg);
    if (ua) await pg.setUserAgent(ua);
    await pg.setViewport(vp);
    await pg.evaluateOnNewDocument((l) => { try { localStorage.setItem('chess3d.lang', l); localStorage.removeItem('chess3d.pixsky'); localStorage.removeItem('chess3d.pixbackdrop'); } catch (e) { /* storage blocked */ } }, lang);
    await pg.goto(`${URL0}/?theme=pixel&open=settings&${query}&quality=low&manual=1&ai=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pg.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await pg.evaluate(() => { const C = window.__chess; C.step(0.5); C.draw(); });
    const r = await pg.evaluate(async () => {
      const rows = [...document.querySelectorAll('.field.themes')].filter((x) => x.querySelector('.swatches') && !x.hidden);
      const heads = rows.map((x) => x.querySelector(':scope > span').textContent.trim());
      const tiles = rows.flatMap((x) => [...x.querySelectorAll('.swatch')]);
      const cut = tiles.filter((b) => { const l = b.querySelector('b'); return l.scrollWidth > l.clientWidth; }).map((b) => `${b.dataset.value || b.dataset.theme}: ${b.querySelector('b').textContent}`);
      const small = tiles.filter((b) => { const q = b.getBoundingClientRect(); return q.height < 44 || q.width < 44; }).map((b) => `${b.dataset.value || b.dataset.theme} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
      const on = rows.map((x) => x.querySelectorAll('.swatch.on').length);
      const dressed = tiles.map((b) => (/url\(/.test(b.querySelector('i').style.backgroundImage) ? 'a' : ''));
      const urls = [...new Set(tiles.map((b) => b.querySelector('i').style.backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1]).filter(Boolean))];
      const bad = []; for (const u of urls) { const res = await fetch(u); if (!res.ok) bad.push(u); }
      const sheet = tiles.length ? tiles[0].closest('.swatches').getBoundingClientRect() : null;
      return { heads, n: tiles.length, cut, small, on, dressed: [...new Set(dressed)].join(''), bad, urls: urls.length, scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    const want = lang === 'de' ? ['Thema', 'Welt', 'Himmel', 'Hintergrund', 'Insel', 'Team'] : ['Theme', 'World', 'Sky', 'Backdrop', 'Island', 'Team'];
    R.expect(`${tag}: headings ${want.join(', ')}`, JSON.stringify(r.heads) === JSON.stringify(want), JSON.stringify(r.heads));
    R.expect(`${tag}: ${r.n} tiles, no label cut off (scrollWidth <= clientWidth)`, r.n === 6 + 3 + 5 + 3 + 5 + 4 && !r.cut.length, `${r.n} tiles`, r.cut.join(' | ') || `${r.n} tiles`);
    R.expect(`${tag}: tap targets at least 44 px, one selected mark per row`, !r.small.length && r.on.every((n) => n === 1) && r.on.length === 6, 'ok', JSON.stringify({ small: r.small, on: r.on }));
    R.expect(`${tag}: the 17 tile pictures load`, r.dressed === 'a' && !r.bad.length && r.urls === 17, r.dressed, JSON.stringify({ dressed: r.dressed, bad: r.bad, urls: r.urls }));
    R.expect(`${tag}: no console error or warning`, !ww.errs.length && !ww.warns.length, 'none', [...ww.errs, ...ww.warns].slice(0, 3).join(' | '));
    await pg.close();
  };
  await rowCheck('rows de desktop', '', { width: 1280, height: 720 }, null, 'de');
  await rowCheck('rows de phone', 'touch=1', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, UA, 'de');
  await rowCheck('rows en desktop', '', { width: 1280, height: 720 }, null, 'en');
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
