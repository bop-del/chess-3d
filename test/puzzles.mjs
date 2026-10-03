// Puzzles in the real page: runPuzzleChecks({ page, baseUrl, log, shot }) -> [{ name, pass, detail }].
// Called from test/smoke.mjs. Needs a served build at baseUrl. Uses ?quality=low&manual=1&ai=0 and window.__chess.puzzles.
// Asserts order and attribution, never durations: time is stepped with __chess.step.
// Run alone with its own server: node test/puzzles.mjs [--port=5365]
// `shot(name)` is optional and saves a screenshot when the smoke run was started with --shots.
import { pathToFileURL } from 'node:url';

const FLAGS = 'quality=low&manual=1&ai=0';

export async function runPuzzleChecks({ page, baseUrl, log = () => {}, shot = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 160));
  page.on('pageerror', onErr);
  const onConsole = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); };
  page.on('console', onConsole);

  const load = async (extra = '') => {
    await page.goto(`${baseUrl}/?${FLAGS}${extra}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.puzzles', { timeout: 120000 });
    await page.evaluate(() => { window.__chess.game.on('promotion', (e) => { window.__promo = e; }); });
    await new Promise((r) => setTimeout(r, 900));   // the loader fades on the real clock
  };
  const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  const st = () => page.evaluate(() => {
    const c = window.__chess, s = c.puzzles.state();
    return { phase: s.phase, ply: s.ply, total: s.total, msg: s.message && s.message.type, clean: s.clean, misses: s.misses, helped: s.helped,
      id: s.puzzle && s.puzzle.id, band: s.band, theme: s.theme, fen: c.game.chess.fen(), mode: c.game.mode, hint: c.openings.hint.visible,
      moves: s.puzzle && s.puzzle.moves, canHelp: s.canHelp, stats: c.puzzleProgress.stats() };
  });
  const tap = async (from, to, promo) => {
    await page.evaluate((a, b, p) => {
      const g = window.__chess.game; window.__promo = null;
      g.clickSquare(g.nameSq(a)); g.clickSquare(g.nameSq(b));
      if (window.__promo && p) window.__promo.choose(p);
    }, from, to, promo || null);
    await step(0.8);
  };
  // play the rest of the open puzzle by taps; returns when it is solved
  const solve = async () => {
    for (let guard = 0; guard < 8; guard++) {
      const s = await st();
      if (s.phase !== 'playing') return s;
      if (s.ply % 2 === 1) { const u = s.moves[s.ply]; await tap(u.slice(0, 2), u.slice(2, 4), u[4]); }
      await step(1.2);   // the opponent's pause and reply
    }
    return st();
  };
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await load();
    await step(1);
    ok('puzzles: the hook, the data and the panel are there', await page.evaluate(() => !!window.__chess.puzzles && window.__chess.puzzleProgress.stats().size.starter >= 50 && !!document.querySelector('[data-card="puzzles"]')));
    ok('puzzles: nothing runs before Start', (await st()).phase === 'idle');

    // ---- the Learn tab: a Puzzles tab with one big Start button opens a puzzle
    await page.evaluate(() => window.__chess.train.learn.show('puzzles'));
    const tab = await page.evaluate(() => { const b = document.querySelector('.pzstart'); return { text: b && b.textContent, tab: document.querySelector('.xtab[aria-selected="true"]')?.textContent, band: document.querySelector('.pzbandline')?.textContent }; });
    ok('puzzles: the Puzzles tab shows the level and a Start button', tab.text === 'Start' && /Puzzles/.test(tab.tab) && /Starter/.test(tab.band), JSON.stringify(tab));
    ok('puzzles: first visit draws ten stations, the first one glowing', await page.evaluate(() => document.querySelectorAll('.pztab .st').length === 10 && document.querySelector('.pztab .st').dataset.state === 'next' && document.querySelectorAll('.pztab .st.todo').length === 9));
    ok('puzzles: on the desktop all four tabs show whole, inside the card', await page.evaluate(() => { const tabs = [...document.querySelectorAll('.xtab')], box = document.querySelector('.xtabs').getBoundingClientRect(); return tabs.length === 4 && tabs.every((b) => { const r = b.getBoundingClientRect(); return b.scrollWidth <= b.clientWidth + 1 && r.left >= box.left - 1 && r.right <= box.right + 1; }); }));
    ok('puzzles: the path climbs, station 1 at the bottom and 10 at the top, with a straight road', await page.evaluate(() => { const c = [...document.querySelectorAll('.pztab .st circle.base')].map((e) => +e.getAttribute('cy')); const d = document.querySelector('.pztab .pzroad').getAttribute('d'); return c.length === 10 && c[0] > c[9] && c.every((y, i) => i === 0 || y <= c[i - 1]) && !/C/.test(d) && (d.match(/Q/g) || []).length <= 4; }));
    await shot?.('puzzles-tab');
    // ---- open one: the opponent's last move is on the board, the theme line shows
    await page.evaluate(() => document.querySelector('.pzstart').click());
    await step(1.5);
    let s = await st();
    const first = s;
    ok('puzzles: a puzzle opens in puzzle mode with the opponent move played', s.phase === 'playing' && s.mode === 'puzzle' && s.ply === 1 && s.band === 'starter', JSON.stringify(s));
    const panelText = await page.evaluate(() => document.querySelector('[data-card="puzzles"]')?.innerText || '');
    ok('puzzles: the panel shows the theme line and the band', /Mate|loose|fork/i.test(panelText) && /Starter/.test(panelText), panelText.slice(0, 120));
    ok('puzzles: the board and the engine agree', (await page.evaluate(() => window.__chess.game.audit())).length === 0);
    await shot?.('puzzles-open');

    // ---- a wrong move: refused, calm message, no automatic hint, free retry
    const wrong = await page.evaluate(() => {
      const c = window.__chess, g = c.game, s = c.puzzles.state(), right = s.puzzle.moves[1];
      const m = g.chess.moves().find((x) => !/#$/.test(g.chess.san(x)) && g.sqName(x.from) + g.sqName(x.to) !== right.slice(0, 4));
      return m && [g.sqName(m.from), g.sqName(m.to)];
    });
    await tap(wrong[0], wrong[1]);
    s = await st();
    ok('puzzles: a wrong move is refused, the board stays', s.ply === 1 && s.fen === first.fen && s.msg === 'wrong' && s.misses === 1 && !s.hint, JSON.stringify({ ply: s.ply, msg: s.msg, hint: s.hint }));
    ok('puzzles: the calm message shows', /Try again/.test(await page.evaluate(() => document.querySelector('.pzsay')?.textContent || '')));
    await shot?.('puzzles-wrong');

    // ---- Help: the gold arrow on the due move, then the puzzle counts as not yet
    ok('puzzles: Help is offered', (await st()).canHelp);
    await page.evaluate(() => document.querySelector('.pzhelp').click());
    await step(0.3);
    s = await st();
    ok('puzzles: Help shows the arrow', s.hint && s.helped && s.msg === 'help', JSON.stringify(s));
    await shot?.('puzzles-help');
    s = await solve();
    ok('puzzles: the puzzle is solved after a miss and Help', s.phase === 'solved' && s.clean === false, JSON.stringify(s));
    ok('puzzles: the arrow is gone and its station is silver', !s.hint && s.stats.queued === 1 && s.stats.solved.starter === 0, JSON.stringify(s.stats));
    ok('puzzles: Next is on offer', await page.evaluate(() => !!document.querySelector('.pznext')));
    await shot?.('puzzles-solved');

    // ---- Next: the path goes on in its fixed order; silver stays silver, clean solves are gold
    const ids = [first.id];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => document.querySelector('.pznext').click());
      await step(1.5);
      s = await st();
      ids.push(s.id);
      s = await solve();
      if (!(s.phase === 'solved' && s.clean === true)) ok(`puzzles: clean solve ${i + 1}`, false, JSON.stringify(s));
    }
    const path = s.stats.stations.map((x) => x.id);
    ok('puzzles: Next serves the stations of the path in order, none twice', ids.join() === path.slice(0, 4).join() && new Set(ids).size === 4, `${ids.join()} vs ${path.slice(0, 4).join()}`);
    ok('puzzles: the stations are silver, gold, gold, gold and the fifth is next', s.stats.stations.slice(0, 5).map((x) => x.state).join() === 'silver,gold,gold,gold,next', s.stats.stations.map((x) => x.state).join());
    ok('puzzles: the level does not change by itself', s.stats.band === 'starter' && s.stats.chapter === 0);
    const store = await page.evaluate(() => JSON.parse(localStorage.getItem('chess3d.puzzles') || 'null'));
    ok('puzzles: progress is saved under chess3d.puzzles, version 2', store && store.v === 2 && Object.values(store.marks).filter((m) => m === 'g').length === 3 && Object.values(store.marks).filter((m) => m === 's').length === 1, JSON.stringify(store));

    // ---- skipping counts as silver and the path moves on
    await page.evaluate(() => window.__chess.puzzles.next());   // from the solved card: station 5 opens
    await step(0.5);
    await page.evaluate(() => window.__chess.puzzles.next());   // skipped
    await step(0.5);
    s = await st();
    ok('puzzles: skipping a puzzle makes its station silver and goes on', s.stats.stations[4].state === 'silver' && s.id === s.stats.stations[5].id, JSON.stringify(s.stats.stations.slice(3, 7).map((x) => x.state)));

    // ---- the tab: a station replays and can turn gold
    await page.evaluate(() => window.__chess.puzzles.stop());
    await step(0.5);
    await page.evaluate(() => window.__chess.train.learn.show('puzzles'));
    const tab2 = await page.evaluate(() => ({ st: [...document.querySelectorAll('.pztab .st')].map((e) => e.dataset.state).join(), badges: document.querySelectorAll('.pztab .pzbadge').length, label: document.querySelector('.pzstart')?.textContent, head: document.querySelector('.pzbandline')?.textContent }));
    ok('puzzles: the tab draws ten stations and ten chapter badges, the button says Continue', tab2.st.startsWith('silver,gold,gold,gold,silver,next') && tab2.st.split(',').length === 10 && tab2.badges === 10 && tab2.label === 'Continue' && /Chapter 1 \/ 10/.test(tab2.head), JSON.stringify(tab2));
    await shot?.('puzzles-tab-mid');
    await page.evaluate((id) => document.querySelector(`.pztab .st[data-id="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), first.id);
    await step(1.5);
    s = await st();
    ok('puzzles: tapping a silver station replays it', s.phase === 'playing' && s.id === first.id, JSON.stringify({ id: s.id, first: first.id }));
    s = await solve();
    ok('puzzles: replayed clean it turns gold', s.clean === true && s.stats.stations[0].state === 'gold' && s.stats.queued === 1, JSON.stringify(s.stats.stations.slice(0, 6).map((x) => x.state)));
    await page.evaluate(() => window.__chess.puzzles.stop());
    await step(0.5);
    await page.evaluate(() => document.querySelectorAll('.pztab .pzbadge')[3].click());
    ok('puzzles: a chapter badge shows that chapter', await page.evaluate(() => /Chapter 4 \/ 10/.test(document.querySelector('.pzbandline').textContent) && document.querySelectorAll('.pztab .st.todo').length === 10));
    await page.evaluate(() => window.__chess.train.learn.openPath());
    ok('puzzles: openPath goes back to where the path is', await page.evaluate(() => /Chapter 1 \/ 10/.test(document.querySelector('.pzbandline').textContent)));

    // ---- a finished chapter: the tab shows the wave, the line and Next chapter; then the path is in chapter 2
    await page.evaluate(() => { const c = window.__chess; for (const x of c.puzzleProgress.stats().stations) c.puzzleProgress.finish(x.id, { clean: x.index % 3 !== 0 }); });
    await page.evaluate(() => window.__chess.train.learn.show('puzzles'));
    const done = await page.evaluate(() => ({ wave: !!document.querySelector('.pztab.pzwave'), line: document.querySelector('.pzdone')?.textContent, label: document.querySelector('.pzstart')?.textContent, lit: document.querySelectorAll('.pztab .st.gold, .pztab .st.silver').length }));
    ok('puzzles: a finished chapter shows the wave, the line and Next chapter', done.wave && /Chapter 1 done/.test(done.line) && done.label === 'Next chapter' && done.lit === 10, JSON.stringify(done));
    await shot?.('puzzles-tab-finished');
    await page.evaluate(() => document.querySelector('.pzstart').click());
    await step(1.5);
    s = await st();
    ok('puzzles: Next chapter starts the first station of chapter 2', s.phase === 'playing' && s.stats.chapter === 1 && s.id === s.stats.stations.find((x) => x.state === 'next')?.id && !s.stats.finished, JSON.stringify({ id: s.id, ch: s.stats.chapter }));

    // ---- leaving gives the ordinary game back; progress survives a reload
    await page.evaluate(() => window.__chess.puzzles.stop());
    await step(0.5);
    s = await st();
    ok('puzzles: leaving returns to the ordinary game on a fresh board', s.phase === 'idle' && s.mode === 'play' && s.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'), JSON.stringify(s));
    const before = s.stats;
    await load();
    s = await st();
    ok('puzzles: progress survives a reload', s.stats.solved.starter === before.solved.starter && s.stats.queued === before.queued && s.stats.chapter === before.chapter, JSON.stringify({ before, after: s.stats }));

    // ---- phone: the strip under the status line, big enough to tap
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await load('&touch=1');
    await page.evaluate(() => { window.__chess.train.learn.show('puzzles'); window.__chess.ui.learnSheet.open(); });
    await new Promise((r) => setTimeout(r, 1000));   // the sheet slides in on the real clock
    await step(0.3);
    const sheetTab = await page.evaluate(() => { const b = document.querySelector('.psheet.plearn .pzstart'); const r = b && b.getBoundingClientRect(); const tabs = document.querySelector('.psheet.plearn .xtabs'); return { h: r && r.height, inView: r && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, rect: r && [r.left, r.top, r.right, r.bottom, innerWidth, innerHeight], tabsFit: tabs && tabs.scrollWidth <= tabs.clientWidth + 1 }; });
    ok('puzzles: phone Learn sheet shows a 44 px Start inside the screen, four tabs fit', sheetTab.h >= 44 && sheetTab.inView && sheetTab.tabsFit, JSON.stringify(sheetTab));
    await shot?.('puzzles-phone-tab');
    await page.evaluate(() => document.querySelector('.psheet.plearn .pzstart').click());
    await step(1.5);
    const phone = await page.evaluate(() => {
      const strip = document.querySelector('.pzstrip'), r = strip && strip.getBoundingClientRect(), h = document.querySelector('.plbar .tb[data-act=help]');   // layout C: Help is in the learning bar
      const hr = h && h.getBoundingClientRect();
      return { shown: !!strip && !strip.hidden && r.height > 0, inside: r && r.left >= 0 && r.right <= innerWidth && r.bottom < innerHeight * 0.5, helpH: hr && hr.height, helpW: hr && hr.width, hscroll: document.documentElement.scrollWidth > innerWidth };
    });
    ok('puzzles: phone strip shows inside the top half, no sideways scroll', phone.shown && phone.inside && !phone.hscroll, JSON.stringify(phone));
    ok('puzzles: phone Help is a 44 px target', phone.helpH >= 44 && phone.helpW >= 44, JSON.stringify(phone));
    await shot?.('puzzles-phone-portrait');
    // ---- solved on the phone: the reward card and the learning bar must not both offer Next
    s = await solve();
    await step(3);
    const nexts = await page.evaluate(() => [...document.querySelectorAll('.pzr-next, .pznext, .plbar .tb[data-act="next"]')].filter((b) => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; }).map((b) => b.className.split(' ')[0] + (b.dataset.act ? ':' + b.dataset.act : '')));
    ok('puzzles: phone, solved: exactly one Next is visible, the learning bar one', s.phase === 'solved' && nexts.length === 1 && nexts[0] === 'tb:next', JSON.stringify({ phase: s.phase, nexts }));
    await shot?.('puzzles-phone-solved');
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 500));   // touch resizes settle on the real clock
    await step(0.5);
    await shot?.('puzzles-phone-landscape');
    await page.setViewport({ width: 844, height: 290, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 500));   // touch resizes settle on the real clock
    await step(0.5);
    await shot?.('puzzles-phone-short');
    ok('puzzles: the strip stays inside the short landscape screen', await page.evaluate(() => { const r = document.querySelector('.pzstrip')?.getBoundingClientRect(); return !!r && r.bottom <= innerHeight && r.right <= innerWidth; }));
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
  }
  ok('puzzles: no console or page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  log(`puzzles: ${out.filter((r) => r.pass).length}/${out.length} checks`);
  return out;
}

// standalone: build into .tmp/ui/dist, serve it on its own port, run the checks in one headless Chrome
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ROOT, launchBrowser, startServer, build } = await import('../tools/_lib.mjs');
  const { join } = await import('node:path');
  const port = Number((process.argv.find((a) => a.startsWith('--port=')) || '--port=5365').slice(7));
  const shots = process.argv.includes('--shots');
  const { mkdirSync } = await import('node:fs');
  const dir = join(ROOT, '.tmp/ui/shots'); if (shots) mkdirSync(dir, { recursive: true });
  let server, browser;
  try {
    if (!process.argv.includes('--skip-build')) build('.tmp/ui/dist');
    server = await startServer({ mode: 'preview', port, outDir: '.tmp/ui/dist' });
    browser = await launchBrowser();
    const page = await browser.newPage();
    const res = await runPuzzleChecks({ page, baseUrl: server.base.replace(/\/$/, ''), log: console.log, shot: shots ? (n) => page.screenshot({ path: join(dir, `${n}.png`) }) : null });
    for (const r of res) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  ' + r.detail}`);
    process.exitCode = res.every((r) => r.pass) ? 0 : 1;
  } finally {
    await browser?.close().catch(() => {});
    server?.stop();
  }
}
