// Preview piece sets in the real page (CHE-367, ?pieces=fantasy|animals): node test/piece-sets-page.mjs [--port=5249] [--base=<server>]
// Per set: the page boots with the set's pieces (and without the flag with the Staunton set), every piece type is picked by a click on
// its figure and gets the select mark, an animated capture plays its battle scene and settles, two new games and the capture allocate no
// geometry, and the start sequence (intro=1, driven by __intro.tick) ends with the set's king on e1. ai=0, manual=1, quality=low.
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5249)), BASE = opt('base', '').replace(/\/$/, '');
const R = reporter();
const OUT = '.tmp/piece-sets-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const SETS = ['fantasy', 'animals'];
const clean = (w) => !w.errs.length;
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const open = async (query, scenes = false) => {
    const page = await browser.newPage();
    const watch = await watchPage(page, undefined, { scenes });
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    return { page, watch };
  };
  const ready = (page) => page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  // the inner mesh names of every piece on the board: '<set>-<piece>-<slot>' for a preview set
  const names = (page) => page.evaluate(() => {
    const out = new Set();
    window.__chess.game.root.traverse((o) => { if (o.isMesh && o.parent?.parent?.userData?.piece) out.add(o.name.split('-').slice(0, 2).join('-')); });
    return [...out].sort();
  });

  {
    const { page, watch } = await open('&intro=0');
    await ready(page);
    const n = await names(page);
    R.expect('no flag: the Staunton set (no preview meshes)', n.length && !n.some((x) => /^(fantasy|animals)-/.test(x)), n.join(' '), n.join(' '));
    R.expect('no flag: no console error', clean(watch), '', watch.errs.join(' | '));
    await page.close();
  }

  // the Options row (CHE-367): a pick stores, reloads and applies; the flag beats the stored pick; Classic goes back; Pixelwelt hides the row
  {
    const { page, watch } = await open('&intro=0');
    await ready(page);
    const rowOn = await page.evaluate(() => { const r = document.querySelector('[data-pieceset="row"]'); return !!r && !r.hidden && [...r.querySelectorAll('button')].map((b) => b.dataset.value).join(); });
    R.expect('options: the Pieces row lists classic, fantasy, animals, crystal, mech', rowOn === 'classic,fantasy,animals,crystal,mech', rowOn, String(rowOn));
    for (const set of SETS) {
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }), page.evaluate((v) => document.querySelector(`[data-pieceset="row"] [data-value="${v}"]`).click(), set)]);
      await ready(page);
      const n = await names(page), stored = await page.evaluate(() => localStorage.getItem('chess3d.pieces'));
      const marked = await page.evaluate(() => document.querySelector('[data-pieceset="row"] .on')?.dataset.value);
      R.expect(`options: picking ${set} reloads with that set, stored and marked`, stored === set && marked === set && n.length && n.every((x) => x.startsWith(set + '-')), `${stored} ${marked} ${n.join(' ')}`, `${stored} ${marked} ${n.join(' ')}`);
    }
    // stored animals, flag fantasy: the flag wins for this visit and does not overwrite the stored pick
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0&intro=0&pieces=fantasy`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    const nf = await names(page), keep = await page.evaluate(() => localStorage.getItem('chess3d.pieces'));
    R.expect('options: ?pieces= beats the stored pick and leaves it alone', nf.every((x) => x.startsWith('fantasy-')) && keep === 'animals', `${nf.join(' ')} stored ${keep}`, `${nf.join(' ')} stored ${keep}`);
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }), page.evaluate(() => document.querySelector('[data-pieceset="row"] [data-value="classic"]').click())]);
    await ready(page);
    const nc = await names(page);
    R.expect('options: picking Classic returns to the Staunton set', nc.length && !nc.some((x) => /^(fantasy|animals)-/.test(x)), nc.join(' '), nc.join(' '));
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0&intro=0&theme=pixel`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    const hid = await page.evaluate(() => document.querySelector('[data-pieceset="row"]').hidden);
    R.expect('options: the Pieces row is hidden with Pixelwelt', hid === true, String(hid), String(hid));
    R.expect('options: no console error', clean(watch), '', watch.errs.join(' | '));
    await page.close();
  }

  for (const set of SETS) {
    const { page, watch } = await open(`&intro=0&pieces=${set}`, true);
    await ready(page);
    await page.evaluate(() => { window.__chess.step(1); window.__chess.draw(); });
    const n = await names(page);
    const want = ['bishop', 'king', 'knight', 'pawn', 'queen', 'rook'].map((p) => `${set}-${p}`);
    R.expect(`${set}: all six figures of the set are on the board`, want.every((x) => n.includes(x)) && n.every((x) => x.startsWith(set + '-')), n.join(' '), n.join(' '));

    // picking (no pawns in front of the back rank): click the middle of each white figure (its bounding box centre, projected), expect its square selected
    const picks = await page.evaluate(() => {
      const C = window.__chess, { THREE, game, stage } = C, out = [];
      const canvas = stage.renderer.domElement, r = canvas.getBoundingClientRect();
      game.loadFen('4k3/8/8/8/8/7P/8/RNBQKBNR w KQ - 0 1');   // no pawn in front of the back rank
      C.step(0.5); C.draw();
      for (const sq of ['a1', 'b1', 'c1', 'd1', 'e1', 'h3']) {
        game.clickSquare(-1);
        let obj = null;
        game.root.children.forEach((g) => { const p = g.userData.piece; if (p && p.color === 'w' && Math.abs(g.position.x - (sq.charCodeAt(0) - 97 - 3.5)) < 0.1 && Math.abs(g.position.z - (3.5 - (Number(sq[1]) - 1))) < 0.1) obj = g; });
        if (!obj) { out.push({ sq, err: 'no piece' }); continue; }
        const box = new THREE.Box3().setFromObject(obj.children[0]);
        const c = box.getCenter(new THREE.Vector3()); c.y = box.min.y + (box.max.y - box.min.y) * 0.55;
        const v = c.project(stage.camera);
        const cx = r.left + (v.x + 1) / 2 * r.width, cy = r.top + (1 - v.y) / 2 * r.height;
        const hit = C.pick(cx, cy);
        game.clickSquare(hit);
        out.push({ sq, type: obj.userData.piece.type, hit, selected: game.getState().selected });
      }
      game.clickSquare(-1);
      return out;
    });
    const badPick = picks.filter((p) => p.selected !== p.sq);
    R.expect(`${set}: a click on each figure picks it and shows the select mark`, !badPick.length, picks.map((p) => `${p.type}@${p.selected}`).join(' '), JSON.stringify(picks));

    // capture with its battle scene, then memory: two new games and the capture allocate no geometry
    const cap = await page.evaluate(async () => {
      const { game, battle, stage } = window.__chess;
      battle.settings.set({ mode: 'short' });
      game.loadFen('4k3/8/8/3b4/8/2N5/8/4K3 w - - 0 1');
      await battle.ready(); await window.__chess.stepAsync(0.5); window.__chess.draw();
      const g0 = stage.renderer.info.memory.geometries;
      game.move('c3', 'd5');
      let t = 0, saw = false;
      while (game.busy && t < 12) { await window.__chess.stepAsync(0.05); t += 0.05; if (battle.active) saw = true; }
      await window.__chess.stepAsync(0.6); window.__chess.draw();
      const captured = game.getState().captured.b, audit = game.audit();
      for (let i = 0; i < 2; i++) { game.loadFen('4k3/8/8/3b4/8/2N5/8/4K3 w - - 0 1'); await window.__chess.stepAsync(0.3); window.__chess.draw(); }
      return { t: +t.toFixed(2), saw, busy: game.busy, audit, captured, g0, g1: stage.renderer.info.memory.geometries };
    });
    R.expect(`${set}: a capture plays its scene and settles`, cap.saw && !cap.busy && !cap.audit.length && cap.captured.join() === 'b', `${cap.t}s`, JSON.stringify(cap));
    R.expect(`${set}: capture and two new games allocate no geometry`, cap.g1 <= cap.g0, `${cap.g0} -> ${cap.g1}`, `${cap.g0} -> ${cap.g1}`);
    R.expect(`${set}: no console error`, clean(watch), '', watch.errs.join(' | '));
    await page.close();

    // the start sequence with the set's king as the hero
    const a = await open(`&intro=1&pieces=${set}`);
    await a.page.waitForFunction('!!window.__intro', { timeout: 120000 });
    let ticks = 0, hero = null;
    for (; ticks < 900; ticks++) {
      await a.page.evaluate(() => window.__intro.tick(1 / 30));
      if (await a.page.evaluate('window.__chessReady === true')) break;
    }
    // the hero is pieceSet.make('k', 'w'); when the sequence ends the game's own king on e1 takes over: it must be the set's king
    hero = await a.page.evaluate(() => { let h = null; window.__chess.game.root.traverse((o) => { if (!h && o.isMesh && /-king-body$/.test(o.name) && o.parent.parent.userData.piece?.color === 'w') h = o.name; }); return h; });
    R.expect(`${set}: the start sequence ends, the set's king stands on e1`, ticks < 900 && hero === `${set}-king-body`, `${ticks} ticks, hero ${hero}`, `${ticks} ticks, hero ${hero}`);
    R.expect(`${set}: start sequence without console error`, clean(a.watch), '', a.watch.errs.join(' | '));
    await a.page.close();
  }
} finally {
  await browser.close().catch(() => {});
  server.stop();
  process.exitCode = R.summary().nf ? 1 : 0;
}
