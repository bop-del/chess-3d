// The chess clock in the real page: node test/clock-page.mjs [--port=5247] [--base=<server>] [--shots=<dir>] [--skip-build]
// ?ai=0&manual=1&clock=3+2: the faces show 3:00 each, nothing runs before White has moved, a move adds the increment and switches the
// running face, step(200) flags the side to move and the game over banner names the time (English and German), a flag against a bare
// king is a draw, with the promotion chooser open the clock runs on and the flag closes it, undo leaves the clocks alone, a lesson mode
// hides and resets it. ?clock=off and a missing flag show no faces; an unknown value is ignored; the chooser (#sel-clock) remembers
// its choice (chess3d.clock), the flag beats it, a change in a running game waits for the next game and says so. Against the computer
// only the player's clock shows and runs. ?open=clock opens the chooser. Phone 390x844: the faces sit in the status line without
// overflow and the thumb bar has the same rectangle with the clock on and off.
// Screenshots (desktop running, low time, against the computer, phone portrait and landscape) and a contact sheet go to --shots.
// Exit codes: 0 pass, 1 a check failed.
import { mkdirSync } from 'node:fs';
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
import { contactSheets } from '../tools/contact-sheet.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5247)), BASE = opt('base', '').replace(/\/$/, ''), SHOTS = opt('shots', '.tmp/clock');
const R = reporter();
const OUT = '.tmp/clock-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
mkdirSync(SHOTS, { recursive: true });
const SIZES = { desktop: { width: 1280, height: 720 }, rail: { width: 800, height: 600 }, landscape: { width: 844, height: 390 }, portrait: { width: 390, height: 844 } };
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  // a fresh page per load: a phone page reads its screen when it is created, and init scripts must not pile up
  let page = null;
  const watchers = [];
  const load = async (query = '', size = 'desktop', { ai = false, lang = 'en', keep = false } = {}) => {
    const s = SIZES[size], phone = size !== 'desktop';
    if (page) await page.close();
    page = await browser.newPage();
    watchers.push(await watchPage(page));
    await page.setViewport(phone ? { ...s, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : s);
    await page.evaluateOnNewDocument((l, k, ph, sw, sh) => {
      try { if (!k) localStorage.removeItem('chess3d.clock'); localStorage.setItem('chess3d.lang', l); } catch (e) { /* ignore */ }
      if (ph) for (const [key, v] of [['width', sw], ['height', sh]]) Object.defineProperty(screen, key, { get: () => v });
    }, lang, keep, phone, s.width, s.height);
    await page.goto(`${URL0}/?quality=low&manual=1&intro=0${ai ? '' : '&ai=0'}${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  };
  const step = (secs) => page.evaluate((n) => { window.__chess.step(n); window.__chess.draw(); }, secs);
  const mv = (from, to, secs = 1.5) => page.evaluate((a, b, n) => { const c = window.__chess; c.game.move(a, b); c.step(n); }, from, to, secs);
  const info = () => page.evaluate(() => {
    const c = window.__chess, s = c.clock.state(), g = c.game.getState();
    const bar = document.getElementById('pclock') || document.querySelector('.pstatus .pclock');
    const face = (k) => { const f = bar?.querySelector(`.cface[data-c="${k}"]`); return f ? { text: f.querySelector('.ct').textContent, cls: f.className, hidden: f.hidden || getComputedStyle(f).display === 'none', label: f.getAttribute('aria-label'), current: f.getAttribute('aria-current') } : null; };
    const banner = document.getElementById('banner');
    return {
      s, over: g.over, turn: g.turn, moves: g.moves.length, canUndo: g.canUndo,
      barShown: !!bar && !bar.hidden && getComputedStyle(bar).display !== 'none', bottom: bar?.dataset.bottom, w: face('w'), b: face('b'), body: document.body.classList.contains('clock-on'),
      banner: banner && !banner.hidden ? banner.textContent : null, promo: !document.getElementById('promo').hidden,
      sel: document.querySelector('#sel-clock .chip.on')?.dataset.value, hint: !document.querySelector('.clock-hint')?.hidden, stored: localStorage.getItem('chess3d.clock'),
      status: document.getElementById('turn-main')?.textContent,
      fen: g.fen.split(' ')[0], hintBtn: !!document.querySelector('.clock-hint:not([hidden]) .clock-now'),
    };
  });
  const shot = async (name) => { await page.evaluate(() => window.__chess.draw()); await new Promise((r) => setTimeout(r, 300)); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
  const near = (a, b) => Math.abs(a - b) < 0.2;

  // ---- ?clock=3+2: the plus of a query string arrives as a space and still works
  await load('&clock=3+2');
  let r = await info();
  R.expect('?clock=3+2: preset 3+2, faces shown, 3:00 each, nothing running before the first move', r.s.preset === '3+2' && r.barShown && r.body && r.w.text === '3:00' && r.b.text === '3:00' && !r.s.running && !r.w.cls.includes('run') && !r.b.cls.includes('run'), 'shown', JSON.stringify(r));
  R.expect('the chooser shows 3+2 and nothing was stored (the flag is for this load)', r.sel === '3+2' && r.stored === null, '3+2', JSON.stringify({ sel: r.sel, stored: r.stored }));
  await step(30);
  r = await info();
  R.expect('thirty seconds before the first move cost nothing (the first move is free)', r.s.w === 180 && r.w.text === '3:00', '3:00', JSON.stringify(r.w));
  await mv('e2', 'e4', 0.05);
  r = await info();
  R.expect('White moved: +2 s (3:02), Black runs and its face is marked running', near(r.s.w, 182) && r.s.active === 'b' && r.b.cls.includes('run') && !r.w.cls.includes('run') && r.b.current === 'true', 'b runs', JSON.stringify(r));
  await step(10);
  r = await info();
  R.expect('ten seconds on Black clock: 2:50 on its face, White still 3:02', near(r.s.b, 170) && (r.b.text === '2:49' || r.b.text === '2:50'), '2:50', JSON.stringify({ b: r.b, w: r.w, s: r.s }));
  await mv('e7', 'e5', 0.05);
  r = await info();
  R.expect('Black moved: +2 s, White runs, the increment landed', near(r.s.b, 172) && r.s.active === 'w' && r.w.cls.includes('run'), 'w runs', JSON.stringify(r.s));
  await shot('desktop-running');
  await page.evaluate(() => window.__chess.game.undo());
  await step(1);
  r = await info();
  R.expect('undo does not change the clocks (White 3:02 and running, Black 3:12 minus nothing)', near(r.s.b, 172) && r.s.running, 'unchanged', JSON.stringify(r.s));
  await mv('e7', 'e5', 0.05);
  await step(160);
  r = await info();
  R.expect('under 30 s: the face is red and bold (class low), the other is not', r.w.cls.includes('low') && !r.b.cls.includes('low') && r.w.text.includes(':') , 'low', JSON.stringify(r.w));
  await shot('desktop-low-time');
  const weight = await page.evaluate(() => { const f = (k) => getComputedStyle(document.querySelector(`#pclock .cface[data-c="${k}"] .ct`)).fontWeight; return { low: +f('w'), normal: +f('b') }; });
  R.expect('low time is not only a colour: the numbers are bolder', weight.low >= 700 && weight.low > weight.normal, 'bold', JSON.stringify(weight));
  await step(200);
  r = await info();
  R.expect('step(200): White flags, the game ends 0-1 with reason time', r.over?.reason === 'time' && r.over.result === '0-1' && r.over.winner === 'b' && r.s.flagged === 'w' && r.w.text === '0.0' && !r.s.running, 'flagged', JSON.stringify({ over: r.over, s: r.s }));
  R.expect('the banner names the time out and the winner (English)', !!r.banner && /Time out/.test(r.banner) && /Black wins/.test(r.banner), 'Time out, Black wins', `${r.banner}`);
  R.expect('the status line says so, and Undo is off after a loss on time', /Time out/.test(r.status) && r.canUndo === false, 'Time out', `${r.status} canUndo ${r.canUndo}`);
  await shot('desktop-flagged');
  await page.evaluate(() => { window.__chess.game.undo(); });
  r = await info();
  R.expect('Undo after a loss on time does nothing', r.over?.reason === 'time', 'still over', JSON.stringify(r.over));
  await page.evaluate(() => { document.getElementById('bn-new')?.click(); });
  await step(1);
  r = await info();
  R.expect('new game: clocks back to 3:00 each, not started, banner gone', r.s.w === 180 && r.s.b === 180 && !r.s.started && !r.banner && !r.over, 'reset', JSON.stringify(r));

  // ---- German banner
  await load('&clock=3+2', 'desktop', { lang: 'de' });
  await mv('e2', 'e4', 0.05);
  await step(200);
  r = await info();
  R.expect('the banner says Zeit abgelaufen (German) and names the winner', !!r.banner && /Zeit abgelaufen/.test(r.banner) && /Weiß gewinnt/.test(r.banner) && /Zeit abgelaufen/.test(r.status), 'Zeit abgelaufen', `${r.banner} | ${r.status}`);

  // ---- a flag against a bare king is a draw
  await load('&clock=3+2&fen=4k3/4p3/8/8/8/8/8/4K3%20w%20-%20-%200%201');
  await mv('e1', 'd1', 0.05);
  await step(200);
  r = await info();
  R.expect('Black flags against a bare king: a draw on time', r.over?.reason === 'time' && r.over.result === '1/2-1/2' && r.over.winner === null, 'draw', JSON.stringify(r.over));
  R.expect('the draw banner says so, in English', !!r.banner && /Draw/.test(r.banner) && /only a king/.test(r.banner), 'Draw, only a king', `${r.banner}`);
  await load('&clock=3+2&fen=4k3/4p3/8/8/8/8/8/4K3%20w%20-%20-%200%201', 'desktop', { lang: 'de' });
  await mv('e1', 'd1', 0.05); await step(200);
  r = await info();
  R.expect('and in German: Zeit abgelaufen, Remis, der Gegner hat nur den König', !!r.banner && /Zeit abgelaufen, Remis, der Gegner hat nur den König/.test(r.banner), 'text', `${r.banner}`);
  // a pawn left on the other side: a loss
  await load('&clock=3+2&fen=4k3/8/8/8/8/8/4P3/4K3%20w%20-%20-%200%201');
  await mv('e1', 'd1', 0.05); await step(200);
  r = await info();
  R.expect('Black flags, White has a pawn: 1-0 on time', r.over?.reason === 'time' && r.over.result === '1-0', '1-0', JSON.stringify(r.over));

  // ---- the promotion chooser keeps the clock running, the flag closes it
  await load('&clock=3+2&fen=8/P3k2p/8/8/8/8/8/4K3%20w%20-%20-%200%201');
  await mv('e1', 'e2', 2); await mv('e7', 'e6', 2);   // White to move again, the clock is White's
  await page.evaluate(() => { const g = window.__chess.game; g.clickSquare(g.nameSq('a7')); g.clickSquare(g.nameSq('a8')); });
  r = await info();
  const before = r.s.w;
  await step(5);
  const r2 = await info();
  R.expect('promotion chooser open: the clock keeps running', r.promo && near(before - r2.s.w, 5), '5 s less', JSON.stringify({ promo: r.promo, before, after: r2.s.w }));
  await step(200);
  r = await info();
  R.expect('the flag with the chooser open ends the game and closes the chooser', r.over?.reason === 'time' && r.over.winner === 'b' && !r.promo, 'closed', JSON.stringify({ over: r.over, promo: r.promo }));

  // ---- off: no faces, no clock
  for (const q of ['&clock=off', '', '&clock=7+0', '&clock=__proto__']) {
    await load(q);
    r = await info();
    await mv('e2', 'e4', 0.05); await step(300);
    const r3 = await info();
    R.expect(`${q || '(no flag)'}: no faces, the clock off, nothing flags after 300 s`, !r.barShown && !r.body && r.s.preset === 'off' && !r3.s.running && !r3.over && r.sel === 'off', 'off', JSON.stringify({ r: r.barShown, s: r3.s, over: r3.over }));
  }

  // ---- the chooser: remembered, the flag beats it, a change waits for the next game
  await load('&clock=off');
  await page.evaluate(() => document.querySelector('#sel-clock .chip[data-value="5+0"]').click());
  r = await info();
  R.expect('the chooser with no game running applies at once and is stored', r.s.preset === '5+0' && r.barShown && r.w.text === '5:00' && r.stored === '5+0' && !r.hint, '5+0', JSON.stringify(r));
  await load('', 'desktop', { keep: true });
  r = await info();
  R.expect('a new page starts with the remembered 5+0', r.s.preset === '5+0' && r.sel === '5+0' && r.barShown, '5+0', JSON.stringify({ s: r.s, sel: r.sel }));
  await load('&clock=15+10', 'desktop', { keep: true });
  r = await info();
  R.expect('?clock=15+10 beats the remembered value and does not overwrite it', r.s.preset === '15+10' && r.w.text === '15:00' && r.stored === '5+0', '15+10, stored 5+0', JSON.stringify({ p: r.s.preset, stored: r.stored }));
  await mv('e2', 'e4', 0.05);
  await page.evaluate(() => document.querySelector('#sel-clock .chip[data-value="10+0"]').click());
  r = await info();
  R.expect('a change in a running game waits for the next game and says so', r.s.preset === '15+10' && r.s.next === '10+0' && r.hint && r.stored === '10+0', 'hint', JSON.stringify({ s: r.s, hint: r.hint }));
  await page.evaluate(() => { window.__chess.game.newGame(); });
  r = await info();
  R.expect('the next game uses 10+0 and the hint is gone', r.s.preset === '10+0' && r.w.text === '10:00' && !r.hint, '10:00', JSON.stringify({ s: r.s, hint: r.hint }));

  // ---- lessons never run it
  await load('&clock=3+2');
  await mv('e2', 'e4', 0.05);
  await page.evaluate(() => window.__chess.game.setMode('puzzle'));
  await step(500);
  r = await info();
  R.expect('puzzle mode: no faces, the clock reset and suspended, nothing flags', !r.barShown && r.s.suspended && !r.s.started && !r.over, 'hidden', JSON.stringify({ bar: r.barShown, s: r.s, over: r.over }));
  await page.evaluate(() => window.__chess.game.setMode('play'));
  r = await info();
  R.expect('back in play: the clock is fresh again', r.barShown && r.w.text === '3:00' && !r.s.started, 'fresh', JSON.stringify(r.s));

  // ---- against the computer: only the player's clock
  await load('&clock=3+2', 'desktop', { ai: true });
  r = await info();
  R.expect('computer game: the computer face is hidden, the player face (White) shown below', r.b.hidden && !r.w.hidden && r.bottom === 'w', 'one face', JSON.stringify({ b: r.b, w: r.w, bottom: r.bottom }));
  await page.evaluate(() => window.__chess.game.move('e2', 'e4'));
  await step(12);
  r = await info();
  R.expect('the computer has replied, the player runs, the computer was never timed', r.moves === 2 && r.s.active === 'w' && r.s.b === 180 && r.s.w < 182, 'computer untimed', JSON.stringify({ moves: r.moves, s: r.s }));
  await shot('desktop-vs-computer');
  await step(300);
  r = await info();
  R.expect('the player flags against the computer and loses on time', r.over?.reason === 'time' && r.over.winner === 'b' && r.s.b === 180, '0-1', JSON.stringify({ over: r.over, s: r.s }));

  // ---- ?open=clock
  await load('&open=clock&clock=5+0');
  const od = await page.evaluate(() => { const e = document.querySelector('#tp-settings #sel-clock'); const r = e?.getBoundingClientRect(); return { tab: document.querySelector('.tab.on')?.dataset.tab, vis: !!r && r.width > 20 && r.height > 20 && r.top >= 0 && r.bottom <= innerHeight }; });
  R.expect('desktop ?open=clock: the Settings tab is open and the chooser is in view', od.tab === 'settings' && od.vis, 'in view', JSON.stringify(od));
  await shot('desktop-open-clock');

  // ---- S36: a clock chosen in a running game, then New game, starts a fresh game with full time and the clock in view
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const inView = (id) => page.evaluate((sel) => {
    const e = [...document.querySelectorAll(sel)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, w: Math.round(r.width), h: Math.round(r.height), text: e.textContent };
  }, id);
  const freshFull = (r, base) => r.fen === START && r.moves === 0 && r.s.w === base && r.s.b === base && !r.s.started && !r.over && !r.banner;
  for (const how of ['button', 'key N', 'hint button']) {
    await load('&clock=off', 'desktop', { ai: true });
    await page.evaluate(() => { window.__chess.game.move('e2', 'e4'); window.__chess.step(8); });
    await page.evaluate(() => document.querySelector('#sel-clock .chip[data-value="5+0"]').click());
    r = await info();
    R.expect(`desktop (${how}): a clock chosen in a running game waits, the hint shows`, r.moves >= 1 && r.s.preset === 'off' && r.s.next === '5+0' && r.hint, 'pending', JSON.stringify({ s: r.s, hint: r.hint }));
    if (how === 'button') await page.evaluate(() => document.getElementById('btn-new').click());
    else if (how === 'key N') await page.keyboard.press('n');
    else await page.evaluate(() => document.querySelector('.clock-hint .clock-now').click());
    await step(1);
    r = await info();
    R.expect(`desktop (${how}): New game starts from the start position, 5:00 on both clocks, nothing running`, freshFull(r, 300) && r.s.preset === '5+0' && r.barShown && !r.hint, 'fresh', JSON.stringify({ fen: r.fen, moves: r.moves, s: r.s, bar: r.barShown }));
    const f = await inView('#pclock .cface:not([hidden]) .ct');
    R.expect(`desktop (${how}): the clock face is visible in the window and reads 5:00`, !!f && f.in && f.text === '5:00', '5:00', JSON.stringify(f));
    if (how === 'button') await shot('desktop-s36-new-game');
  }
  // a finished game: the choice also waits for the next game (the old board is not a fresh game)
  await load('&clock=off&fen=7k/5Q2/6K1/8/8/8/8/8%20w%20-%20-%200%201');
  await mv('f7', 'g7', 2);
  r = await info();
  await page.evaluate(() => document.querySelector('#sel-clock .chip[data-value="5+0"]').click());
  const ro = await info();
  R.expect('a finished game: the chosen clock waits for the next game and says so', !!r.over && ro.s.preset === 'off' && ro.s.next === '5+0' && ro.hint && ro.hintBtn, 'pending', JSON.stringify({ over: r.over, s: ro.s, hint: ro.hint }));
  await page.evaluate(() => document.getElementById('btn-new').click());
  await step(1);
  r = await info();
  R.expect('and New game then starts fresh with 5:00', freshFull(r, 300) && r.s.preset === '5+0', 'fresh', JSON.stringify({ fen: r.fen, s: r.s }));

  // the deep link shows the clock at once, on every size (the folded rail of a window under 900 px included)
  for (const size of ['desktop', 'rail', 'portrait', 'landscape']) {
    await load('&clock=5%2B0', size, { ai: true });
    r = await info();
    const sel = size === 'desktop' ? '#pclock .cface:not([hidden])' : size === 'rail' ? '.rail-clock .cface:not([hidden])' : '.pstatus .cface:not([hidden])';
    const f = await inView(sel);
    R.expect(`?clock=5%2B0 on ${size}: the clock is in the window at once, 5:00, nothing running`, r.s.preset === '5+0' && !!f && f.in && f.h >= 20 && /5:00/.test(f.text) && !r.s.running, '5:00', JSON.stringify({ f, s: r.s }));
    await shot(`s36-deeplink-${size}`);
  }
  // the panel folded by hand hides its header: the floating faces take over, and unfolding hands them back
  await load('&clock=5%2B0', 'desktop', { ai: true });
  await page.evaluate(() => document.getElementById('btn-rail').click());
  await new Promise((r2) => setTimeout(r2, 500));
  let fl = await inView('.rail-clock .cface:not([hidden])');
  const hd = await inView('#pclock .cface:not([hidden])');
  R.expect('panel folded to the rail: the floating clock shows, the header copy does not', !!fl && fl.in && !hd, 'floating', JSON.stringify({ fl, hd }));
  await shot('s36-rail-folded');
  await page.evaluate(() => document.getElementById('btn-rail-open').click());
  await new Promise((r2) => setTimeout(r2, 500));
  fl = await inView('.rail-clock .cface:not([hidden])');
  R.expect('panel open again: the floating clock is gone', !fl, 'hidden', JSON.stringify(fl));

  // phone: Menu sheet, clock chosen in a running game, New in the thumb bar, Yes: a fresh game with the clock in the status line
  for (const size of ['portrait', 'landscape']) {
    await load('&clock=off', size, { ai: true });
    await page.evaluate(() => { window.__chess.game.move('e2', 'e4'); window.__chess.step(8); });
    await page.evaluate(() => window.__chess.ui.openPanel?.('clock'));
    await new Promise((r2) => setTimeout(r2, 700));
    await page.evaluate(() => document.querySelector('.psheet.open #sel-clock .chip[data-value="5+0"]').click());
    r = await info();
    R.expect(`phone ${size}: a clock chosen in a running game waits and says so`, r.s.preset === 'off' && r.s.next === '5+0' && r.hint && r.hintBtn, 'pending', JSON.stringify({ s: r.s, hint: r.hint }));
    await page.evaluate(() => document.querySelector('.tb[data-act=new]').click());
    const ask = await page.evaluate(() => { const c = document.querySelector('.pconfirm'); const q = c.getBoundingClientRect(); return { shown: !c.hidden, in: q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight }; });
    R.expect(`phone ${size}: New in the thumb bar asks, the question is on screen`, ask.shown && ask.in, 'confirm', JSON.stringify(ask));
    await shot(`s36-phone-${size}-confirm`);
    await page.evaluate(() => document.querySelector('.pconfirm [data-a=yes]').click());
    await step(1);
    r = await info();
    const f = await inView('.pstatus .cface:not([hidden]) .ct');
    R.expect(`phone ${size}: Yes starts a fresh game from the start position, 5:00, the face in the status line`, freshFull(r, 300) && r.barShown && !!f && f.in && f.text === '5:00', 'fresh', JSON.stringify({ fen: r.fen, s: r.s, f }));
    await shot(`s36-phone-${size}-new-game`);
    // the same through the hint button of the sheet
    await page.evaluate(() => { window.__chess.game.move('e2', 'e4'); window.__chess.step(8); });
    await page.evaluate(() => window.__chess.ui.openPanel?.('clock'));
    await new Promise((r2) => setTimeout(r2, 700));
    await page.evaluate(() => document.querySelector('.psheet.open #sel-clock .chip[data-value="3+2"]').click());
    const hb = await page.evaluate(() => { const b = document.querySelector('.psheet.open .clock-now'); const q = b?.getBoundingClientRect(); return { h: q ? Math.round(q.height) : 0, shown: !!q && q.width > 0 }; });
    R.expect(`phone ${size}: the "start now" button is a 44 px tap target`, hb.shown && hb.h >= 44, '44', JSON.stringify(hb));
    await page.evaluate(() => document.querySelector('.psheet.open .clock-now').click());
    await new Promise((r2) => setTimeout(r2, 500));
    r = await info();
    const open = await page.evaluate(() => !!document.querySelector('.psheet.open'));
    R.expect(`phone ${size}: the button starts the game with 3:00 and closes the sheet`, freshFull(r, 180) && r.s.preset === '3+2' && !open, 'fresh', JSON.stringify({ fen: r.fen, s: r.s, open }));
  }

  // ---- phone
  for (const size of ['portrait', 'landscape']) {
    await load('', size);
    const off = await page.evaluate(() => { const q = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); }; return { bar: q('.pbar'), status: q('.pstatus'), frame: q('.pframe') }; });
    await load('&clock=3+2', size);
    await mv('e2', 'e4', 0.05);
    const ph = await page.evaluate(() => {
      const q = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); };
      const st = document.querySelector('.pstatus'), sr = st.getBoundingClientRect();
      const faces = [...st.querySelectorAll('.cface')].filter((f) => getComputedStyle(f).display !== 'none').map((f) => { const r = f.getBoundingClientRect(); return { in: r.left >= sr.left && r.right <= sr.right + 0.5 && r.top >= sr.top && r.bottom <= sr.bottom, w: Math.round(r.width), h: Math.round(r.height), text: f.querySelector('.ct').textContent, cls: f.className }; });
      return { bar: q('.pbar'), status: q('.pstatus'), frame: q('.pframe'), faces, overflow: st.scrollWidth - st.clientWidth, last: getComputedStyle(st.querySelector('.ps-last')).display, main: st.querySelector('.ps-main').textContent, sub: st.querySelector('.ps-sub').textContent, subW: Math.round(st.querySelector('.ps-sub').getBoundingClientRect().width) };
    });
    R.expect(`phone ${size}: two faces in the status line, inside it, no overflow`, ph.faces.length === 2 && ph.faces.every((f) => f.in) && ph.overflow <= 0, 'two faces', JSON.stringify(ph));
    R.expect(`phone ${size}: the thumb bar has the same rectangle with the clock on and off`, ph.bar === off.bar && ph.status === off.status, off.bar, `${off.bar} vs ${ph.bar}; status ${off.status} vs ${ph.status}`);
    R.expect(`phone ${size}: the running face is marked`, ph.faces.some((f) => f.cls.includes('run')), 'run', JSON.stringify(ph.faces));
    await shot(`phone-${size}-running`);
    await step(170);
    await shot(`phone-${size}-low`);
  }
  await load('&clock=3+2', 'portrait', { ai: true });
  await page.evaluate(() => window.__chess.game.move('e2', 'e4'));
  await step(8);
  const pc = await page.evaluate(() => ({ faces: [...document.querySelectorAll('.pstatus .cface')].filter((f) => getComputedStyle(f).display !== 'none').length, sub: document.querySelector('.ps-sub').textContent }));
  R.expect('phone against the computer: one face (the player)', pc.faces === 1, '1', JSON.stringify(pc));
  await shot('phone-portrait-vs-computer');
  await load('&open=clock', 'portrait');
  await new Promise((r) => setTimeout(r, 700));
  const po = await page.evaluate(() => { const e = document.querySelector('.psheet.open #sel-clock'); const r = e?.getBoundingClientRect(); const chips = [...(e?.querySelectorAll('.chip') || [])].map((c) => { const q = c.getBoundingClientRect(); return [Math.round(q.width), Math.round(q.height), q.right <= innerWidth]; }); return { open: !!e, vis: !!r && r.top >= 0 && r.bottom <= innerHeight, chips }; });
  R.expect('phone ?open=clock: the Menu sheet shows the chooser, five chips of at least 44 px height inside the screen', po.open && po.vis && po.chips.length === 5 && po.chips.every(([cw, ch, inside]) => ch >= 44 && cw >= 44 && inside), 'in view', JSON.stringify(po));
  await shot('phone-portrait-open-clock');

  const errs = watchers.flatMap((x) => x.errs), warns = watchers.flatMap((x) => x.warns);
  R.expect('no console error or warning', !errs.length && !warns.length, 'none', [...errs, ...warns].slice(0, 5).join(' | '));
  await contactSheets(browser, SHOTS, { cols: 3, width: 640 });
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
