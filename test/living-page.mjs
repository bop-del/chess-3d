// Living pieces in the real page (CHE-238): node test/living-page.mjs [--port=5249] [--base=<server>] [--skip-build]
// The scheduler in a stepped clock (?manual=1, living.setAuto(true) arms it, the test never waits for real time): nothing before 15 s,
// one piece at 15 s, the next one 10 s later, then every 10 s, never two at once, never the selected piece, only a move or a piece pick starts the wait again (a camera drag or a menu tap does not);
// paused with Symbols on, in a theme without rigs and while a move runs; never with the switch off (also after a reload: the stored
// value), never by itself under ?manual=1. ?sig=<piece> plays a move at once, ?birds=<a|b|c> a bird flight. The switch is in the Options of the
// desktop HUD and of the phone menu (both menus), on by default, ?living=0|1 beats the stored value without writing it.
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5249)), BASE = opt('base', '').replace(/\/$/, '');
const R = reporter();
const OUT = '.tmp/living-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  const load = async (query = '', { phone = false, clear = true } = {}) => {
    await page.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 720 });
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0&intro=0${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.living', { timeout: 120000 });
    if (clear) await page.evaluate(() => { localStorage.removeItem('chess3d.living'); window.__chess.living.setOn(true, { store: false }); });
    await page.evaluate(() => { window.__chess.game.finishAnimations(); window.__chess.step(1); });
  };
  const step = (secs) => page.evaluate((s) => { for (let i = 0; i < Math.ceil(s * 5); i++) window.__chess.step(0.2, 5); window.__chess.draw(); }, secs);
  const fired = () => page.evaluate(() => window.__chess.living.log.length);
  const state = () => page.evaluate(() => window.__chess.living.state());

  // ---- the scheduler
  await load('&theme=pixel');
  await page.evaluate(() => { window.__chess.living.setAuto(true); window.__chess.living.reset(); });
  await step(14.5);
  R.expect('nothing happens before 15 s without a move', (await fired()) === 0, '0 shows at 14.5 s');
  await step(1);
  let n = await fired();
  R.expect('one piece plays its move after 15 s', n === 1, `${n} show`);
  const first = await page.evaluate(() => window.__chess.living.log[0]);
  R.expect('the show names a real piece of the position and the picked move', !!first && 'prnbqk'.includes(first.type), JSON.stringify(first));
  await step(9);
  R.expect('the next one waits 10 s', (await fired()) === 1, 'still 1 at +9 s');
  await step(1.5);
  R.expect('the next one follows after 10 s', (await fired()) === 2, `${await fired()} shows at +10.5 s`);
  await step(9);
  R.expect('the third waits 10 s', (await fired()) === 2, 'still 2 at +9 s');
  await step(1.5);
  R.expect('the third follows after 10 s', (await fired()) === 3, `${await fired()} shows at +10.5 s`);
  // never two at once: over ten minutes every gap between two shows is 10 s or a little more while a long show runs, none shorter
  await page.evaluate(() => { window.__chess.living.log.length = 0; });
  await step(600);
  const times = (await page.evaluate(() => window.__chess.living.log)).map((e) => e.at);
  const gaps = times.slice(1).map((t, i) => +(t - times[i]).toFixed(2));
  R.expect('ten minutes: a show about every 10 s, gaps never under 10 s', times.length >= 40 && times.length <= 61 && gaps.every((g) => g >= 9.99 && g <= 15), `${times.length} shows, gaps ${Math.min(...gaps)} to ${Math.max(...gaps)} s`);

  // ---- never the selected piece
  await page.evaluate(() => { window.__chess.living.log.length = 0; window.__chess.game.selectSquare('e2'); });
  let hitSelected = 0;
  for (let i = 0; i < 40; i++) { await page.evaluate(() => window.__chess.living.fire()); await step(3.5); }
  const log = await page.evaluate(() => window.__chess.living.log);
  hitSelected = log.filter((e) => e.square === 'e2').length;
  R.expect('the selected piece never plays', log.length >= 30 && hitSelected === 0, `${log.length} shows, ${hitSelected} on e2`);
  const kinds = new Set(log.map((e) => e.type + e.color));
  R.expect('both colours and several piece types take part', kinds.size >= 6 && log.some((e) => e.color === 'w') && log.some((e) => e.color === 'b'), `${kinds.size} different pieces`);
  await page.evaluate(() => window.__chess.game.selectSquare('e2'));   // deselect

  // ---- a move resets the wait
  await page.evaluate(() => { window.__chess.living.log.length = 0; window.__chess.living.reset(); });
  await step(10);
  await page.evaluate(() => { window.__chess.game.move('e2', 'e4'); });
  await step(1.5);
  await page.evaluate(() => window.__chess.game.finishAnimations());
  await step(13);
  R.expect('a move starts the 15 s wait again', (await fired()) === 0, `${await fired()} shows 13 s after the move`);
  await step(3);
  R.expect('and the wait runs out 15 s after it', (await fired()) === 1);
  // a camera drag and a tap on empty space do not reset
  await page.evaluate(() => { window.__chess.game.finishAnimations(); window.__chess.living.log.length = 0; window.__chess.living.reset(); });
  await step(10);
  await page.mouse.move(40, 40); await page.mouse.down(); await page.mouse.move(120, 90, { steps: 4 }); await page.mouse.up();
  await page.mouse.click(40, 40); await page.keyboard.press('Shift');
  await step(6);
  R.expect('a camera drag, a tap and a key do not reset the wait', (await fired()) === 1, `${await fired()} shows`);
  // a piece pick does
  await page.evaluate(() => { window.__chess.living.log.length = 0; window.__chess.living.reset(); });
  await step(10);
  await page.evaluate(() => { const g = window.__chess.game; g.clickSquare(g.nameSq('d7')); });
  await step(13);
  R.expect('a piece pick starts the wait again', (await fired()) === 0, `${await fired()} shows 13 s after the pick`);
  await step(3);
  R.expect('and the wait runs out 15 s after it', (await fired()) === 1);
  await page.evaluate(() => { const g = window.__chess.game; g.clickSquare(g.nameSq('d7')); });   // deselect

  // ---- pauses
  await page.evaluate(() => { window.__chess.living.log.length = 0; window.__chess.living.reset(); window.__chess.views.setSymbols(true, { remember: false }); });
  await step(90);
  R.expect('paused with Symbols on', (await fired()) === 0 && (await state()).paused, `${await fired()} shows in 90 s`);
  await page.evaluate(() => window.__chess.views.setSymbols(false, { remember: false }));
  await page.evaluate(() => { window.__chess.themes.set('classic'); });
  await step(90);
  R.expect('nothing in a theme without rigs (Classic)', (await fired()) === 0, `${await fired()} shows in 90 s`);
  await page.evaluate(() => window.__chess.themes.set('pixel'));
  await step(40);
  R.expect('Pixelwelt takes part', (await fired()) >= 1);

  // ---- the switch
  await page.evaluate(() => { window.__chess.living.log.length = 0; });
  const box = await page.evaluate(() => { const b = document.querySelector('[data-living]'); return b ? { checked: b.checked, text: b.closest('label')?.textContent.trim() } : null; });
  R.expect('the switch "Living pieces" is in the HUD, on by default', !!box && box.checked === true && /Living pieces/.test(box.text), JSON.stringify(box));
  await page.evaluate(() => document.querySelector('[data-living]').click());
  const stored = await page.evaluate(() => localStorage.getItem('chess3d.living'));
  await step(120);
  R.expect('switched off: nothing for 120 s, stored as 0', (await fired()) === 0 && stored === '0', `${await fired()} shows, stored ${stored}`);
  await load('&theme=pixel', { clear: false });
  const re = await page.evaluate(() => ({ checked: document.querySelector('[data-living]').checked, on: window.__chess.living.state().on }));
  R.expect('the stored value comes back after a reload (off)', re.checked === false && re.on === false, JSON.stringify(re));
  await load('&theme=pixel&living=1', { clear: false });
  const fl = await page.evaluate(() => ({ on: window.__chess.living.state().on, auto: window.__chess.living.state().auto, stored: localStorage.getItem('chess3d.living') }));
  R.expect('?living=1 beats the stored value for this load, arms the shows in a test and does not write', fl.on && fl.auto && fl.stored === '0', JSON.stringify(fl));
  await step(16);
  R.expect('?living=1 plays by itself after 15 s', (await fired()) === 1);
  await load('&theme=pixel&living=0', { clear: false });
  R.expect('?living=0 turns it off for this load', (await state()).on === false);
  await load('&theme=pixel');
  R.expect('never by itself under ?manual=1 (and under automation)', (await state()).auto === false);
  await step(90);
  R.expect('...so nothing plays in 90 s', (await fired()) === 0);

  // ---- flags that play at once
  await load('&theme=pixel&sig=knight');
  await new Promise((r) => setTimeout(r, 700));
  await step(0.5);
  const sig = await page.evaluate(() => window.__chess.living.log[0]);
  R.expect('?sig=knight plays that move on a knight at once', sig && sig.type === 'n', JSON.stringify(sig));
  await load('&theme=pixel&sig=pawn.e7');
  await new Promise((r) => setTimeout(r, 700));
  const sig2 = await page.evaluate(() => window.__chess.living.log[0]);
  R.expect('?sig=pawn.e7 plays on the named square', sig2 && sig2.square === 'e7', JSON.stringify(sig2));
  for (const v of ['a', 'b', 'c']) {
    await load(`&theme=pixel&birds=${v}`);
    const on = await page.evaluate(() => !!window.__chess.themes.world?.birds?.active);
    await step(16);
    const off = await page.evaluate(() => !!window.__chess.themes.world?.birds?.active);
    R.expect(`?birds=${v} flies at once and the flight ends`, on && !off, `active ${on} then ${off}`);
  }
  await load('&theme=blocks');
  R.expect('no birds in other themes', await page.evaluate(() => !window.__chess.themes.world?.birds));

  // ---- the phone menu
  await load('&theme=pixel', { phone: true });
  const ph = await page.evaluate(() => { const b = document.querySelector('[data-living]'); return b ? { checked: b.checked, inSheet: !!b.closest('.psheet, .osheet, [data-sheet], .sheet') || !!b.closest('#hud') } : null; });
  R.expect('phone, Menu A: the switch is in the Options', !!ph && ph.checked && ph.inSheet, JSON.stringify(ph));
  await load('&theme=pixel&menu=old', { phone: true });
  const ph2 = await page.evaluate(() => { const b = document.querySelector('[data-living]'); return b ? { checked: b.checked } : null; });
  R.expect('phone, old menu: the switch is there too', !!ph2 && ph2.checked, JSON.stringify(ph2));

  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
