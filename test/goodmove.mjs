// "Good move?" and the level select in the real page: runGoodMoveChecks({ page, baseUrl, log, shot }) -> [{ name, pass, detail }].
// Called from test/smoke.mjs (smoke tier). Needs a served build at baseUrl. Also runs on its own: node test/goodmove.mjs [--port=5364]
// Asserts order and state, never durations. Real timers drive the search; __chess.step drives the game clock (manual mode).

const FLAGS = 'quality=low&manual=1';

export async function runGoodMoveChecks({ page, baseUrl, log = () => {}, shot = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 160));
  const onConsole = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); };
  page.on('pageerror', onErr);
  page.on('console', onConsole);

  const load = async (query, viewport = { width: 1280, height: 800 }) => {
    await page.setViewport(viewport);
    await page.goto(`${baseUrl}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.goodMove', { timeout: 120000 });
    await page.waitForFunction("document.getElementById('loader').classList.contains('done')");
  };
  const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  const info = () => page.evaluate(() => {
    const c = window.__chess, b = document.getElementById('btn-good');
    return { state: c.goodMove.state(), disabled: b.disabled, think: b.classList.contains('think'), turn: c.game.getState().turn, why: { busy: c.game.getState().busy, thinking: c.game.getState().thinking, mode: c.game.mode, promo: !!c.game.pendingPromotion, can: c.goodMove.canAsk(), fen: c.game.getState().fen }, level: c.game.getState().level, over: !!c.game.getState().over };
  });
  const arrowVisible = () => page.evaluate(() => { let v = false; window.__chess.gimbal.traverse((o) => { if (o.name === 'move-hint' && o.visible) v = true; }); return v; });
  const waitState = async (s) => { try { await page.waitForFunction((x) => window.__chess.goodMove.state() === x, { timeout: 60000 }, s); } catch (e) { throw new Error('waiting for good move state ' + s + ' timed out; now ' + JSON.stringify(await info())); } };
  const userCanMove = async () => { for (let i = 0; i < 40; i++) { const s = await info(); if (s.turn === 'w' && !(await page.evaluate(() => window.__chess.game.getState().thinking || window.__chess.game.busy))) return true; await step(0.5); } return false; };
  const clickGood = async () => { await userCanMove(); return page.evaluate(() => document.getElementById('btn-good').click()); };
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

  try {
    // ------------------------------------------------ the level select and its memory
    await load(FLAGS);
    await page.evaluate(() => localStorage.removeItem('chess3d.level'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.goodMove');
    await page.waitForFunction("document.getElementById('loader').classList.contains('done')");
    const opts = await page.evaluate(() => [...document.querySelectorAll('#sel-ai-level option')].map((o) => o.value + ':' + o.textContent));
    ok('level: the select offers Novice, Easy, Normal, Hard with the Elo labels', opts.join('|') === 'novice:Novice ~700|easy:Easy ~900|normal:Normal ~1200|hard:Hard ~1450', opts.join('|'));
    let s = await info();
    ok('level: a new visitor gets Easy, the computer is on', s.level === 'easy' && await page.evaluate(() => document.getElementById('sel-ai-level').value) === 'easy', JSON.stringify(s));
    await page.select('#sel-ai-level', 'novice');
    ok('level: the choice is remembered in localStorage chess3d.level', (await page.evaluate(() => localStorage.getItem('chess3d.level'))) === 'novice' && (await info()).level === 'novice');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.goodMove');
    ok('level: the remembered level is back after a reload', (await info()).level === 'novice' && await page.evaluate(() => document.getElementById('sel-ai-level').value) === 'novice');
    await page.goto(`${baseUrl}/?${FLAGS}&ai=4`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.goodMove');
    ok('level: ?ai=4 beats the remembered level and is not stored', (await info()).level === 'hard' && (await page.evaluate(() => localStorage.getItem('chess3d.level'))) === 'novice');
    await page.goto(`${baseUrl}/?${FLAGS}&ai=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.goodMove');
    ok('level: ?ai=1 is Novice', (await info()).level === 'novice');
    await page.evaluate(() => localStorage.removeItem('chess3d.level'));

    // ------------------------------------------------ Good move?
    await load(FLAGS);
    s = await info();
    ok('good move: enabled on the player turn at the start, idle, no arrow', !s.disabled && s.state === 'idle' && !(await arrowVisible()), JSON.stringify(s));
    // asked from the page: the state is 'thinking' at once, the page stays alive, then the arrow shows
    const probe = await page.evaluate(() => { const p = window.__chess.goodMove.ask(); const st = window.__chess.goodMove.state(); const th = document.getElementById('btn-good').classList.contains('think'); window.__probe = p; return { st, th }; });
    ok('good move: the button goes to the thinking state at once', probe.st === 'thinking', JSON.stringify(probe));
    const mv = await page.evaluate(() => window.__probe.then((m) => m));
    s = await info();
    const legal = await page.evaluate((m) => window.__chess.game.chess.moves().some((x) => x.from === m.from && x.to === m.to), mv);
    ok('good move: a legal move comes back and the arrow shows', !!mv && legal && s.state === 'showing' && (await arrowVisible()) && !s.think, JSON.stringify({ mv, s }));
    await step(0.2);
    await shot?.('goodmove-arrow');
    // the player moves: the arrow clears (the computer then plays black)
    await page.evaluate(() => window.__chess.game.move('e2', 'e4'));
    await step(0.3);
    s = await info();
    ok('good move: playing a move clears the arrow', s.state === 'idle' && !(await arrowVisible()), JSON.stringify(s));
    ok('good move: disabled while the computer thinks or moves', s.turn === 'b' ? s.disabled : true, JSON.stringify(s));
    const refused = await page.evaluate(() => window.__chess.goodMove.ask());
    ok('good move: asking on the computer turn gives nothing', s.turn === 'w' || refused === null, JSON.stringify({ refused, s }));
    ok('good move: back to the player turn after the computer reply', await userCanMove());
    s = await info();
    ok('good move: enabled again on the player turn', !s.disabled, JSON.stringify(s));
    // a click on the real button works, undo clears
    await clickGood();
    await waitState('showing');
    ok('good move: the button click shows the arrow', await arrowVisible());
    await page.evaluate(() => document.getElementById('btn-undo').click());
    await step(0.3);
    s = await info();
    ok('good move: undo clears the arrow', s.state === 'idle' && !(await arrowVisible()), JSON.stringify(s));
    await clickGood();
    await waitState('showing');
    await page.evaluate(() => window.__chess.game.newGame());
    await step(0.3);
    s = await info();
    ok('good move: a new game clears the arrow', s.state === 'idle' && !(await arrowVisible()), JSON.stringify(s));
    // a move made while it thinks: the answer is dropped
    await userCanMove();
    await page.evaluate(() => { window.__probe = window.__chess.goodMove.ask(); window.__chess.game.move('d2', 'd4'); });
    const dropped = await page.evaluate(() => window.__probe);
    await step(0.3);
    ok('good move: a move during the search drops the answer', dropped === null && (await info()).state === 'idle' && !(await arrowVisible()));
    ok('good move: back to the player turn again', await userCanMove());
    // Explain owns the hint there
    await page.evaluate(() => window.__chess.openings.explain.start('italian-game'));
    await step(0.5);
    s = await info();
    ok('good move: disabled in Explain', s.disabled && (await page.evaluate(() => window.__chess.goodMove.canAsk())) === false, JSON.stringify(s));
    ok('good move: asking in Explain gives nothing', (await page.evaluate(() => window.__chess.goodMove.ask())) === null);
    await page.evaluate(() => window.__chess.openings.explain.stop());
    await step(0.5);

    // Drill owns the hint too
    await page.evaluate(() => window.__chess.game.setMode('drill'));
    await step(0.3);
    s = await info();
    ok('good move: disabled in Drill', s.disabled && (await page.evaluate(() => window.__chess.goodMove.ask())) === null, JSON.stringify(s));
    await page.evaluate(() => window.__chess.game.setMode('play'));
    await step(0.3);

    // game over: fool's mate with two players (ai=0)
    await load(FLAGS + '&ai=0');
    await page.evaluate(() => { const g = window.__chess.game; for (const [a, b] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) g.move(a, b); });
    await step(3);
    s = await info();
    ok('good move: disabled when the game is over', s.over && s.disabled, JSON.stringify(s));
    // two players: it is the player's turn on both sides, so it works
    await load(FLAGS + '&ai=0');
    s = await info();
    ok('good move: works in a two player game', !s.disabled);

    // ------------------------------------------------ the phone bulb
    await load(FLAGS + '&touch=1', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await step(0.5);
    const bulb = await page.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
      const g = document.querySelector('.pgood'), st = document.querySelector('.pstatus');
      return g ? { g: r(g), st: r(st), W: innerWidth, vis: getComputedStyle(g).display !== 'none', desk: getComputedStyle(document.getElementById('btn-good').closest('.row')).display, dis: g.disabled } : null;
    });
    ok('phone: the bulb is a 44 px target inside the screen, next to the status line, not over it', !!bulb && bulb.vis && bulb.g.w >= 44 && bulb.g.h >= 44 && bulb.g.r <= bulb.W && bulb.g.x >= bulb.st.r - 1 && !bulb.dis, JSON.stringify(bulb));
    await page.evaluate(() => document.querySelector('.pgood').click());
    await waitState('showing');
    ok('phone: tapping the bulb shows the arrow', await arrowVisible());
    await step(0.2);
    await shot?.('goodmove-phone');
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
  }
  ok('good move: no console or page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  log(`good move: ${out.filter((r) => r.pass).length}/${out.length} checks`);
  return out;
}

// stand alone: build, serve, run, print
if (process.argv[1] && process.argv[1].endsWith('goodmove.mjs')) {
  const { launchBrowser, startServer, build } = await import('../tools/_lib.mjs');
  const port = Number((process.argv.find((a) => a.startsWith('--port=')) || '--port=5364').slice(7));
  if (!process.argv.includes('--skip-build')) build('.tmp/novice/dist');
  const server = await startServer({ mode: 'preview', port, outDir: '.tmp/novice/dist' });
  let browser, bad = 0;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const res = await runGoodMoveChecks({ page, baseUrl: server.base.replace(/\/$/, ''), log: (m) => console.log(m) });
    for (const r of res) { console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  ' + r.detail}`); if (!r.pass) bad++; }
  } finally { await browser?.close().catch(() => {}); server.stop(); }
  process.exit(bad ? 1 : 0);
}
