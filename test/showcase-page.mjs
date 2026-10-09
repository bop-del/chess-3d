// Showcase mode in the real page (CHE-374): node test/showcase-page.mjs [--port=5251] [--base=<server>] [--skip-build] [--shots=<dir>]
// Without the flag nothing changes (no showcase, the computer on, the HUD shown). ?showcase=1 plays each game to its end card
// (stepped clock, ?manual=1, battle scenes on): every ply played, the board audit clean, the computer silent, several shot kinds,
// slow motion on the slow plies, the HUD hidden; a tap ends it: overlay gone, controls camera calls back, HUD back, the game restored,
// no geometries or textures left over. ?showcase=trailer starts in fast montage. The menu entry (desktop Play tab, phone Game
// section) starts the picked game; after a tap the game that was on the board comes back with its computer settings. Every theme starts it without errors. Phone
// portrait: the lower third and the title fit the screen.
// Exit codes: 0 pass, 1 a check failed.
import { mkdirSync } from 'node:fs';
import { GAMES } from '../src/showcase/games.js';
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5251)), BASE = opt('base', '').replace(/\/$/, ''), SHOTS = opt('shots', '.tmp/showcase');
const R = reporter();
const OUT = '.tmp/showcase-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
mkdirSync(SHOTS, { recursive: true });
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page, undefined, { scenes: true });
  const load = async (query, phone = false) => {
    await page.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 720 });
    await page.goto(`${URL0}/?quality=low&manual=1${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 120000 });
    await page.evaluate(async () => { await window.__chess.battle.ready(); });
  };
  const mem = () => page.evaluate(() => { const m = window.__chess.stage.renderer.info.memory; return { g: m.geometries, t: m.textures }; });
  // step until the showcase reaches `phase` (or `secs` of game time), 15 Hz with an event loop turn per slice
  const runTo = (phase, secs) => page.evaluate(async (phase, secs) => {
    const C = window.__chess, seen = { slow: 0, comp: 0, maxPly: -1 };
    for (let i = 0; i < secs * 15; i++) {
      await C.stepAsync(1 / 15, 15);
      const s = C.showcase.state;
      if (s.timeScale < 0.5) seen.slow++;
      seen.maxPly = Math.max(seen.maxPly, s.ply);
      if (s.phase === phase) break;
    }
    // after a mate the toppled king is the one misplaced piece the audit may report
    return { ...C.showcase.state, seen, plies: C.game.getState().moves.length, audit: (() => { const a = C.game.audit(), i = C.game.getState().over ? a.findIndex((m) => /^misplaced/.test(m)) : -1; if (i >= 0) a.splice(i, 1); return a; })(), hud: getComputedStyle(document.getElementById('hud')).visibility };
  }, phase, secs);

  // ---- the default is unchanged
  await load('');
  const def = await page.evaluate(() => ({ sc: window.__chess.showcase, ai: window.__chess.game.getState().vsComputer ?? null, hud: getComputedStyle(document.getElementById('hud')).visibility, ov: !!document.getElementById('showcase-overlay') }));
  R.expect('no flag: no showcase, no overlay, HUD shown', def.sc === undefined && !def.ov && def.hud === 'visible', JSON.stringify(def));
  const base = await mem();

  // ---- each game plays to its end card
  const ids = Object.keys(GAMES);
  for (const id of ids) {
    await load(`&showcase=1&showgame=${id}`);
    const total = await page.evaluate(() => window.__chess.showcase.game.sans.length);
    const s = await runTo('end', 400);
    R.expect(`${id}: plays every ply to the end card`, s.phase === 'end' && s.plies === total, `${s.plies} plies, phase ${s.phase}`);
    R.expect(`${id}: board audit clean after the mate`, s.audit.length === 0, s.audit.slice(0, 3).join('; '));
    R.expect(`${id}: HUD hidden while it runs`, s.hud === 'hidden', s.hud);
    const kinds = new Set(s.shots);
    R.expect(`${id}: at least 6 shot kinds`, kinds.size >= 6, [...kinds].join(', '));
    R.expect(`${id}: slow motion happened`, s.seen.slow > 5, `${s.seen.slow} slow slices`);
    if (id === ids[0]) await page.evaluate(() => window.__chess.draw()), await page.screenshot({ path: `${SHOTS}/end-${id}.png` });
    // a tap ends it
    await page.mouse.click(640, 360);
    const after = await page.evaluate(() => {
      const C = window.__chess;
      C.step(0.5); C.draw();
      return { sc: !!C.showcase, ov: !!document.getElementById('showcase-overlay'), hud: getComputedStyle(document.getElementById('hud')).visibility,
        pieces: C.game.pieceCount, plies: C.game.getState().moves.length, camOwn: !Object.getOwnPropertyDescriptor(C.controls, 'camera').get.toString().includes('pose'),
        ai: C.game.getState().vsComputer ?? null };
    });
    R.expect(`${id}: a tap ends it: overlay gone, HUD back, a new game, camera handed back`, !after.sc && !after.ov && after.hud === 'visible' && after.pieces === 32 && after.plies === 0 && after.camOwn, JSON.stringify(after));
  }
  const left = await mem();
  R.expect('no geometries or textures left over after the showcases', left.g <= base.g + 2 && left.t <= base.t + 1, `geometries ${base.g} -> ${left.g}, textures ${base.t} -> ${left.t}`);

  // ---- the trailer cut starts in fast montage
  await load('&showcase=trailer&showgame=immortal');
  const tr = await runTo('none', 6.5);
  R.expect('trailer: starts in the fast montage', tr.trailer && tr.montage && tr.timeScale > 2, `time scale ${tr.timeScale.toFixed(2)}`);

  // ---- the menu entry (desktop): under the daily card in the Play tab; Trailer starts it, a tap ends it, the game comes back
  await load('&ai=0');
  await page.waitForFunction('!!window.__chess.showcaseEntry', { timeout: 20000 });
  await page.evaluate(() => { const C = window.__chess; C.game.playMoves(['e2e4', 'e7e5', 'g1f3']); C.game.setVsComputer(true, { color: 'b', level: 'normal' }); });
  const entry = await page.evaluate(() => { const e = document.querySelector('.showcase-entry'); const r = e?.getBoundingClientRect(); return { inPlay: !!e?.closest('#tp-play'), afterDaily: e?.previousElementSibling?.classList.contains('dailycard') ?? null, shown: !!e && !e.hidden && r.height > 0, games: e ? e.querySelectorAll('option').length : 0 }; });
  R.expect('menu entry: in the Play tab under the daily card, three games', entry.inPlay && entry.shown && entry.games === 3, JSON.stringify(entry));
  await page.select('.showcase-entry .sce-pick', 'kinghunt');
  await page.click('.showcase-entry .sce-go[data-mode="trailer"]');
  await page.waitForFunction('!!window.__chess.showcase', { timeout: 20000 });
  const fromMenu = await runTo('none', 4);
  R.expect('menu entry: Trailer starts the picked game as a trailer', fromMenu.running && fromMenu.trailer && (await page.evaluate(() => window.__chess.showcase.game.id)) === 'kinghunt', `trailer ${fromMenu.trailer}`);
  await page.mouse.click(640, 360);
  const back = await page.evaluate(() => { const C = window.__chess; C.step(0.3); const st = C.game.getState(); return { sc: !!C.showcase, moves: st.moves.join(' '), ai: st.vsComputer, level: st.level, color: st.computerColor, audit: C.game.audit().length }; });
  R.expect('a tap ends it and the game on the board comes back (moves, computer, level)', !back.sc && back.moves === 'e4 e5 Nf3' && back.ai === true && back.level === 'normal' && back.color === 'b' && back.audit === 0, JSON.stringify(back));

  // ---- every theme starts it
  for (const theme of ['classic', 'tournament', 'wood', 'metal', 'glass', 'blocks', 'pixel']) {
    const n0 = w.errs.length;
    await load(`&showcase=1&showgame=reti&theme=${theme}`);
    const s = await runTo('none', 14);
    await page.evaluate(() => window.__chess.draw());
    if (theme === 'pixel' || theme === 'wood') await page.screenshot({ path: `${SHOTS}/run-${theme}.png` });
    R.expect(`theme ${theme}: runs without errors`, s.ply >= 2 && w.errs.length === n0, `ply ${s.ply}${w.errs.length > n0 ? ' ' + w.errs.slice(n0).join(' | ') : ''}`);
  }

  // ---- the menu entry (phone): in the Game section of the menu, 44 px targets, a tap on Full game closes the menu and starts it
  await load('&ai=0', true);
  await page.waitForFunction('!!window.__chess.showcaseEntry', { timeout: 20000 });
  // the start picture fades and the sheet slides in on the wall clock (CSS): wait for both before tapping
  await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('done'), { timeout: 30000 });
  await new Promise((res) => setTimeout(res, 900));
  const opened = await page.evaluate(() => window.__chess.ui.openPanel('daily'));
  await new Promise((res) => setTimeout(res, 700));
  await page.evaluate(() => window.__chess.step(0.2));
  const pe = await page.evaluate(() => { const e = document.querySelector('.showcase-entry'); const bs = [...e.querySelectorAll('button, select')].map((b) => b.getBoundingClientRect()); return { shown: !e.hidden && e.getBoundingClientRect().height > 0, inGame: !!e.closest('.card[data-card="game"]'), min: Math.min(...bs.map((b) => b.height)), inside: bs.every((b) => b.left >= 0 && b.right <= innerWidth) }; });
  await page.screenshot({ path: `${SHOTS}/phone-entry.png` });
  R.expect('phone: the entry is in the Game section, targets at least 44 px, inside the screen', opened !== false && pe.shown && pe.inGame && pe.min >= 43.5 && pe.inside, JSON.stringify(pe));
  await page.tap('.showcase-entry .sce-go[data-mode="1"]');
  await page.waitForFunction('!!window.__chess.showcase', { timeout: 20000 });
  const ps = await runTo('none', 3);
  const sheetOpen = await page.evaluate(() => [...document.querySelectorAll('.psheet')].some((x) => x.classList.contains('open') && getComputedStyle(x).visibility !== 'hidden'));
  R.expect('phone: Full game starts the full showcase and closes the menu', ps.running && !ps.trailer && !sheetOpen, `running ${ps.running}, sheet open ${sheetOpen}`);
  await page.touchscreen.tap(195, 420);
  R.expect('phone: a tap ends it', await page.evaluate(() => { window.__chess.step(0.3); return !window.__chess.showcase && getComputedStyle(document.getElementById('hud')).visibility === 'visible'; }));

  // ---- phone portrait: the overlay fits
  await load('&showcase=1&showgame=immortal&theme=pixel', true);
  await runTo('none', 2.5);
  await page.evaluate(() => window.__chess.draw());
  const title = await page.evaluate(() => { const r = [...document.querySelectorAll('#showcase-overlay *')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect()); return r.every((b) => b.left >= -1 && b.right <= innerWidth + 1); });
  await page.screenshot({ path: `${SHOTS}/phone-title.png` });
  await runTo('hold', 12);
  await page.evaluate(() => window.__chess.draw());
  const lower = await page.evaluate(() => { const r = [...document.querySelectorAll('#showcase-overlay *')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect()); return { ok: r.every((b) => b.left >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1), n: r.length }; });
  await page.screenshot({ path: `${SHOTS}/phone-lower.png` });
  R.expect('phone portrait: title card and lower third inside the screen', title && lower.ok && lower.n > 0, JSON.stringify(lower));
  R.expect('no page errors', w.errs.length === 0, w.errs.slice(0, 3).join(' | '));
} catch (e) {
  R.fail('showcase page run', String(e.stack || e).slice(0, 400));
} finally {
  await browser.close();
  server.stop();
}
const { nf, np } = R.summary();
console.log(nf ? `\n${nf} check(s) failed` : `\nshowcase page passed (${np} checks)`);
process.exit(nf ? 1 : 0);
