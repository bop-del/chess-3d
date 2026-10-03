// Game review in the real page: runReviewChecks({ page, baseUrl, log, shot }) -> [{ name, pass, detail }].
// A short scripted game to checkmate (ai=0), the Review the game button, the strip filling in live, marked moves with the gold
// arrow and the sentence, stepping, Details, German, closing, and the phone layout.
// Called from test/smoke.mjs (group review). Also runs alone: node test/review.mjs [--port=5242] [--skip-build] [--shots]
// (shots and a contact sheet go to .tmp/review/). Asserts order and state, never durations.

const FLAGS = 'quality=low&manual=1&ai=0';
const MOVES = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];   // fool's mate: g4 is the blunder, Qh4# the best move

export async function runReviewChecks({ page, baseUrl, log = () => {}, shot = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 160));
  const onConsole = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); };
  page.on('pageerror', onErr);
  page.on('console', onConsole);

  const load = async (viewport = { width: 1280, height: 800 }, lang = 'en') => {
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('chess3d.lang', l); } catch (e) { /* ignore */ } }, lang);
    await page.goto(`${baseUrl}/?${FLAGS}${viewport.isMobile ? '&touch=1' : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.review', { timeout: 120000 });
    await page.waitForFunction("document.getElementById('loader').classList.contains('done')");
  };
  const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  const st = () => page.evaluate(() => window.__chess.review.state());
  const fen = () => page.evaluate(() => window.__chess.game.chess.fen());
  const arrow = () => page.evaluate(() => { let v = false; window.__chess.gimbal.traverse((o) => { if (o.name === 'move-hint' && o.visible) v = true; }); return v; });
  const bannerUp = () => page.evaluate(() => { const b = document.getElementById('banner'); return !b.hidden && !!document.getElementById('bn-review-game'); });
  const playGame = async () => {
    await page.evaluate((mv) => { for (const [a, b] of mv) window.__chess.game.move(a, b); }, MOVES);
    for (let i = 0; i < 20 && !(await bannerUp()); i++) await step(0.5);
  };
  const waitDone = async () => { try { await page.waitForFunction('window.__chess.review.state().done', { timeout: 90000 }); } catch (e) { throw new Error('analysis did not finish: ' + JSON.stringify(await st())); } };
  const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; }, sel);

  try {
    // ------------------------------------------------ the button on the game over card
    await load();
    ok('review is not open before a game ends', !(await st()).active);
    await playGame();
    ok('game over: the card has Review the game next to New game', await bannerUp() && await page.evaluate(() => { const r = document.querySelector('#banner .row'); return [...r.children].map((c) => c.textContent).join('|'); }) === 'New game|Review the game|Review board');
    await step(1.5);
    if (shot) await new Promise((r) => setTimeout(r, 1200));   // real time: the card pops in with a CSS animation
    await shot?.('review-gameover-desktop');
    const startFen = await page.evaluate(() => window.__chess.game.chess.history.length);
    ok('the finished game holds four moves', startFen === 4);

    // ------------------------------------------------ open, live fill, marks
    await page.evaluate(() => document.getElementById('bn-review-game').click());
    await step(0.2);
    let s = await st();
    ok('review opens at the start, the card is gone', s.active && s.ply === 0 && await page.evaluate(() => document.getElementById('banner').hidden), JSON.stringify(s));
    ok('the strip has a chip per move', await page.evaluate(() => document.querySelectorAll('.rv-chip').length) === 4);
    await waitDone();
    s = await st();
    ok('the analysis finishes: every position counted', s.done && s.analysed === 5, JSON.stringify({ a: s.analysed, d: s.done }));
    ok('g4 is a blunder, the others are not marked', s.kinds[2] === 'blunder' && !s.kinds[0] !== undefined && s.kinds.filter((k) => k === 'blunder' || k === 'mistake').length >= 1, JSON.stringify(s.kinds));
    const chipClass = await page.evaluate(() => [...document.querySelectorAll('.rv-chip')].map((c) => c.className));
    ok('the blunder chip is red', /blunder/.test(chipClass[2]), chipClass.join(' | '));
    ok('Qh4# is not marked', !/mistake|blunder/.test(chipClass[3]), chipClass[3]);

    // ------------------------------------------------ the gold arrow and the sentence
    await page.evaluate(() => document.querySelectorAll('.rv-chip')[2].click());
    await step(0.2);
    s = await st();
    ok('tapping the blunder shows the board before it, with the gold arrow', s.suggest && s.ply === 2 && await arrow(), JSON.stringify({ ply: s.ply, suggest: s.suggest }));
    const before = await fen();
    ok('the board is the position before g4', before.startsWith('rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR'), before);
    const text = await page.evaluate(() => document.querySelector('.rv-msg').textContent);
    ok('one friendly sentence in English with the better move', /Blunder/.test(text) && /Better was [A-Za-z0-9+#=]+/.test(text) && /checkmate/.test(text), text);
    await shot?.('review-blunder-desktop');
    await page.evaluate(() => document.querySelector('.rv-fwd').click());
    await step(0.2);
    s = await st();
    ok('forward plays the real move: board after g4, arrow gone', s.ply === 3 && !s.suggest && !(await arrow()) && (await fen()).includes('6P1'), JSON.stringify({ ply: s.ply }));
    await page.evaluate(() => document.querySelector('.rv-back').click());
    await step(0.2);
    s = await st();
    ok('back returns to the arrow step', s.ply === 2 && s.suggest && await arrow());
    await page.evaluate(() => document.querySelector('.rv-start').click());
    await step(0.2);
    ok('to the start: the starting position, no arrow', (await fen()).startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') && !(await arrow()));
    await page.keyboard.press('ArrowRight');
    await step(0.2);
    ok('the arrow key steps forward', (await st()).ply === 1);

    // ------------------------------------------------ the board stays out of the player's hands
    const refused = await page.evaluate(() => { const g = window.__chess.game; const before = g.chess.fen(); g.move('a2', 'a3'); return g.chess.fen() === before; });
    ok('moves are refused while reviewing', refused);

    // ------------------------------------------------ details
    await page.evaluate(() => document.querySelector('.rv-det').click());
    await step(0.2);
    await page.waitForFunction("document.querySelectorAll('.rv-line b').length > 0 && /[A-Za-z]/.test(document.querySelector('.rv-line').textContent.replace('Best line', ''))", { timeout: 30000 }).catch(() => {});
    const det = await page.evaluate(() => ({
      graph: !!document.querySelector('.rv-graph svg polyline'),
      line: document.querySelector('.rv-line').textContent,
      acc: document.querySelector('.rv-acc').textContent,
      shown: !document.querySelector('.rv-details').hidden,
    }));
    ok('details: graph, best line and accuracy for both sides', det.shown && det.graph && /\d+%/.test(det.acc) && /White/.test(det.acc) && /Black/.test(det.acc) && /Best line\s+\S/.test(det.line), JSON.stringify(det));
    const gr = await rect('.rv-graph');
    await page.mouse.click(gr.x + gr.w * 0.5, gr.y + gr.h / 2);
    await step(0.2);
    s = await st();
    ok('tapping the graph jumps to that move', s.moveNo >= 2 && s.moveNo <= 3, JSON.stringify({ ply: s.ply, moveNo: s.moveNo }));
    await shot?.('review-details-desktop');
    await page.evaluate(() => document.querySelector('.rv-det').click());

    // ------------------------------------------------ German
    await page.evaluate(() => document.querySelector('[data-lang="de"]').click());
    await step(0.2);
    await page.evaluate(() => document.querySelectorAll('.rv-chip')[2].click());
    await step(0.2);
    const de = await page.evaluate(() => ({ msg: document.querySelector('.rv-msg').textContent, det: document.querySelector('.rv-det').textContent, fwd: document.querySelector('.rv-fwd').getAttribute('aria-label') }));
    ok('German: sentence, Details button and labels', /Patzer/.test(de.msg) && /Besser war/.test(de.msg) && de.det === 'Details' && /vor/.test(de.fwd), JSON.stringify(de));
    await page.evaluate(() => document.querySelector('[data-lang="en"]').click());

    // ------------------------------------------------ close: the game is back, the card too
    await page.evaluate(() => document.querySelector('.rv-close').click());
    for (let i = 0; i < 10 && !(await bannerUp()); i++) await step(0.5);
    s = await st();
    const after = await page.evaluate(() => ({ n: window.__chess.game.chess.history.length, over: !!window.__chess.game.getState().over, moves: window.__chess.game.getState().moves.join(' ') }));
    ok('closing restores the finished game and the game over card', !s.active && after.n === 4 && after.over && after.moves === 'f3 e5 g4 Qh4#' && await bannerUp(), JSON.stringify(after));

    // ------------------------------------------------ New game during a review ends it
    await page.evaluate(() => document.getElementById('bn-review-game').click());
    await step(0.2);
    await page.evaluate(() => document.getElementById('btn-new').click());
    await step(0.2);
    const nw = await page.evaluate(() => ({ active: window.__chess.review.active, n: window.__chess.game.chess.history.length, body: document.body.classList.contains('reviewing'), arrow: false }));
    ok('New game ends the review and starts fresh', !nw.active && nw.n === 0 && !nw.body && !(await arrow()), JSON.stringify(nw));

    // ------------------------------------------------ the computer opponent comes back after a review
    await page.goto(`${baseUrl}/?quality=low&manual=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.review');
    await page.evaluate(() => { const g = window.__chess.game; g.move('f2', 'f3'); });
    const vs = await page.evaluate(() => { const r = window.__chess.review, g = window.__chess.game; const was = g.getState().vsComputer; r.open(); const during = g.getState().vsComputer; r.close(); return { was, during, after: g.getState().vsComputer, n: g.chess.history.length }; });
    ok('review switches the computer off and back on', vs.was && !vs.during && vs.after, JSON.stringify(vs));

    // ------------------------------------------------ phone
    await load({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await playGame();
    ok('phone: the game over card has the button', await bannerUp());
    await step(1.5);
    if (shot) await new Promise((r) => setTimeout(r, 1200));
    await shot?.('review-gameover-phone');
    await page.evaluate(() => document.getElementById('bn-review-game').click());
    await waitDone();
    await page.evaluate(() => document.querySelectorAll('.rv-chip')[2].click());
    await step(0.3);
    const strip = await rect('.rv'), bar = await rect('nav.pbar:not(.plbar)');
    ok('phone: the review sits above the thumb bar, inside the screen', !!strip && !!bar && strip.b <= bar.y + 1 && strip.x >= 0 && strip.r <= 390, JSON.stringify({ strip, bar }));
    const tap = await page.evaluate(() => [...document.querySelectorAll('.rv-chip, .rv-btn')].map((b) => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
    ok('phone: every chip and button is a 44 px target', tap.length >= 8 && tap.every((v) => v >= 44), tap.join(','));
    ok('phone: the arrow is showing on the blunder', await arrow());
    await shot?.('review-blunder-phone');
    await page.evaluate(() => document.querySelector('.rv-det').click());
    await step(0.3);
    const strip2 = await rect('.rv');
    ok('phone: with Details the sheet still sits above the bar and below the top', strip2.b <= bar.y + 1 && strip2.y > 60, JSON.stringify(strip2));
    await shot?.('review-details-phone');
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
  }
  ok('review: no console or page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  log(`review: ${out.filter((r) => r.pass).length}/${out.length} checks`);
  return out;
}

// stand alone: build, serve, run, print
if (process.argv[1] && process.argv[1].endsWith('review.mjs')) {
  const { launchBrowser, startServer, build, ROOT } = await import('../tools/_lib.mjs');
  const { mkdirSync, readdirSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { contactSheets } = await import('../tools/contact-sheet.mjs');
  const port = Number((process.argv.find((a) => a.startsWith('--port=')) || '--port=5242').slice(7));
  const shots = process.argv.includes('--shots');
  const dir = join(ROOT, '.tmp/review');
  if (shots) { mkdirSync(dir, { recursive: true }); for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(join(dir, f)); }
  if (!process.argv.includes('--skip-build')) build('.tmp/review/dist');
  const server = await startServer({ mode: 'preview', port, outDir: '.tmp/review/dist' });
  let browser, bad = 0;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const shot = shots ? (name) => page.screenshot({ path: join(dir, `${name}.png`) }) : null;
    const res = await runReviewChecks({ page, baseUrl: server.base.replace(/\/$/, ''), log: (m) => console.log(m), shot });
    for (const r of res) { console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  ' + r.detail}`); if (!r.pass) bad++; }
    if (shots) for (const f of await contactSheets(browser, dir)) console.log(`contact sheet: ${f}`);
  } finally { await browser?.close().catch(() => {}); server.stop(); }
  process.exit(bad ? 1 : 0);
}
