// The daily puzzle in the real page: runDailyChecks({ page, baseUrl, log, shot }) -> [{ name, pass, detail }].
// Called from test/smoke.mjs (group puzzles). Uses ?quality=low&manual=1&ai=0&intro=0, German texts, ?daily=YYYY-MM-DD for the date.
// Desktop 1440x900 and a phone 390x844: ?open=daily shows the card without starting the puzzle; Start loads the puzzle; solving it by the
// stored moves marks the day done and the card says "Heute gelöst"; the path stats do not change.
// Run alone with its own server: node test/daily-page.mjs [--port=5366] [--shots]
import { pathToFileURL } from 'node:url';

const FLAGS = 'quality=low&manual=1&ai=0&intro=0';

export async function runDailyChecks({ page, baseUrl, log = () => {}, shot = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 160));
  page.on('pageerror', onErr);
  const onConsole = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); };
  page.on('console', onConsole);

  const sizes = { desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false }, phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } };
  const load = async (query, size = 'desktop') => {
    await page.setViewport(sizes[size]);
    await page.goto(`${baseUrl}/?${FLAGS}${size === 'phone' ? '&touch=1' : ''}&${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.daily', { timeout: 120000 });
    await new Promise((r) => setTimeout(r, 900));   // the loader fades and the sheet slides on the real clock
  };
  const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  const card = () => page.evaluate(() => {
    const c = document.querySelector('.dailycard');
    if (!c) return null;
    const r = c.getBoundingClientRect(), cs = getComputedStyle(c);
    const sheet = c.closest('.psheet');
    return { text: c.innerText.replace(/\s+/g, ' ').trim(), hidden: c.hidden || cs.display === 'none', state: c.dataset.state, mark: c.dataset.mark || null,
      left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: window.innerWidth, h: window.innerHeight,
      start: !!c.querySelector('.dcstart'), dot: c.querySelector('.pzdot')?.className || null, sheetOpen: sheet ? sheet.classList.contains('open') : null,
      theme: c.querySelector('.dctheme')?.textContent, tabPlay: !document.querySelector('#tp-play')?.hidden };
  });
  const st = () => page.evaluate(() => {
    const c = window.__chess, s = c.puzzles.state();
    return { phase: s.phase, ply: s.ply, daily: s.daily, id: s.puzzle && s.puzzle.id, mode: c.game.mode, moves: s.puzzle && s.puzzle.moves, misses: s.misses };
  });
  const tap = async (from, to, promo) => {
    await page.evaluate((a, b, p) => {
      const g = window.__chess.game; window.__promo = null;
      g.clickSquare(g.nameSq(a)); g.clickSquare(g.nameSq(b));
      if (window.__promo && p) window.__promo.choose(p);
    }, from, to, promo || null);
    await step(0.8);
  };
  const solve = async () => {
    for (let guard = 0; guard < 8; guard++) {
      const s = await st();
      if (s.phase !== 'playing') return s;
      if (s.ply % 2 === 1) { const u = s.moves[s.ply]; await tap(u.slice(0, 2), u.slice(2, 4), u[4]); }
      await step(1.2);
    }
    return st();
  };
  const path = () => page.evaluate(() => JSON.stringify({ stats: window.__chess.puzzleProgress.stats(), data: window.__chess.puzzleProgress.exportData(), stored: localStorage.getItem('chess3d.puzzles') }));
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('chess3d.daily') || 'null'));

  try {
    // German texts, a fresh store
    await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('dailyTestInit')) { localStorage.clear(); sessionStorage.setItem('dailyTestInit', '1'); } localStorage.setItem('chess3d.lang', 'de'); } catch (e) { /* ignore */ } });

    // ---- desktop: ?open=daily shows the card at the top of the Play tab, nothing is started
    await load('open=daily&daily=2026-10-03');
    await step(1);
    let c = await card(), s = await st();
    const want = await page.evaluate(() => window.__chess.daily.puzzle());
    ok('daily: ?open=daily shows the card on the Play tab at 1440x900', c && !c.hidden && c.tabPlay && c.left >= 0 && c.right <= c.w && c.top >= 0 && c.bottom <= c.h, JSON.stringify(c));
    ok('daily: title, theme line, streak line and a Start button', c && /Tagesrätsel/.test(c.text) && /Starte deine Serie/.test(c.text) && c.start && /Start$/.test(c.text) && !!c.theme && /Matt|Gabel|ungedeckte/.test(c.theme), c && c.text);
    ok('daily: the card is the first thing in the Play tab', await page.evaluate(() => document.querySelector('#tp-play').firstElementChild.classList.contains('dailycard')));
    ok('daily: opening the card does not start the puzzle', s.phase === 'idle' && s.mode === 'play', JSON.stringify(s));
    await shot?.('daily-desktop-open');

    // ---- Start: the daily puzzle is on the board, the path is not touched
    const pathBefore = await path();
    await page.evaluate(() => document.querySelector('.dcstart').click());
    await step(1.5);
    s = await st();
    ok('daily: Start opens the daily puzzle in puzzle mode with the opponent move played', s.phase === 'playing' && s.mode === 'puzzle' && s.daily === true && s.ply === 1 && s.id === want.id, JSON.stringify(s) + ' want ' + want.id);
    ok('daily: the card is hidden while the puzzle runs', (await card()).hidden);
    ok('daily: the path stats do not change on Start', (await path()) === pathBefore);
    // a miss, then stop: nothing is marked on the path, the day stays open
    const wrong = await page.evaluate(() => {
      const g = window.__chess.game, u = window.__chess.puzzles.state().puzzle.moves[1];
      const sq = (n) => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97), name = (q) => 'abcdefgh'[q & 7] + ((q >> 3) + 1);
      const m = g.chess.moves().find((x) => x.from !== sq(u.slice(0, 2)) || x.to !== sq(u.slice(2, 4)));
      return m ? [name(m.from), name(m.to)] : null;
    });
    if (wrong) await tap(wrong[0], wrong[1]);
    await page.evaluate(() => window.__chess.puzzles.stop());
    await step(0.5);
    ok('daily: stopping after a miss marks no station and leaves the day open', (await path()) === pathBefore && (await page.evaluate(() => window.__chess.daily.done())) === null);
    ok('daily: the card is back after stopping, Start again', await page.evaluate(() => !document.querySelector('.dailycard').hidden && !!document.querySelector('.dcstart')));

    // ---- solve it clean
    await page.evaluate(() => document.querySelector('.dcstart').click());
    await step(1.5);
    s = await solve();
    await step(2);
    ok('daily: the stored moves solve it', s.phase === 'solved', JSON.stringify(s));
    ok('daily: the solve writes the daily store (gold, best 1)', await stored().then((r) => r && r.v === 1 && r.days['2026-10-03'] === 'g' && r.best === 1), JSON.stringify(await stored()));
    ok('daily: the path stats do not change after a daily solve', (await path()) === pathBefore);
    await page.evaluate(() => window.__chess.puzzles.stop());
    await step(0.5);
    c = await card();
    ok('daily: the card shows "Heute gelöst" with a gold mark and the streak, no Start', c && !c.hidden && c.state === 'done' && c.mark === 'g' && /Heute gelöst/.test(c.text) && /1 Tag in Folge/.test(c.text) && !c.start && /gold/.test(c.dot || ''), c && c.text);
    await page.evaluate(() => window.__chess.ui.openPanel('daily'));
    await step(0.5);
    await new Promise((r) => setTimeout(r, 500));
    await shot?.('daily-desktop-done');

    // ---- the next day: yesterday's run is alive, solved with Help makes silver and 2 in a row
    await load('open=daily&daily=2026-10-04');
    c = await card();
    const want2 = await page.evaluate(() => window.__chess.daily.puzzle().id);
    ok('daily: another date gives another puzzle', want2 !== want.id, want2);
    ok('daily: next day open again, keeps yesterday\'s run', c && c.state === 'open' && /1 Tag in Folge/.test(c.text) && c.start, c && c.text);
    await page.evaluate(() => document.querySelector('.dcstart').click());
    await step(1.5);
    await page.evaluate(() => window.__chess.puzzles.help());
    s = await solve();
    await step(2);
    await page.evaluate(() => window.__chess.puzzles.stop());
    await step(0.5);
    c = await card();
    ok('daily: solved with Help counts: silver mark, 2 Tage in Folge', s.phase === 'solved' && c && c.mark === 's' && /2 Tage in Folge/.test(c.text) && /silver/.test(c.dot || ''), JSON.stringify(c));
    // a gap resets
    await load('open=daily&daily=2026-10-07');
    c = await card();
    ok('daily: a missed day resets the streak', c && /Starte deine Serie/.test(c.text), c && c.text);

    // ---- the card shows only on a fresh board
    await page.evaluate(() => { const g = window.__chess.game; g.clickSquare(g.nameSq('e2')); g.clickSquare(g.nameSq('e4')); });
    await step(1);
    ok('daily: hidden once a move is played', (await card()).hidden);
    await page.evaluate(() => window.__chess.game.newGame({ instant: true }));
    await step(0.5);
    ok('daily: back after a new game', !(await card()).hidden);
    await page.evaluate(() => window.__chess.train.learn.open('puzzles'));
    await page.evaluate(() => document.querySelector('.pzstart')?.click());
    await step(1);
    ok('daily: hidden while a path puzzle runs, and a path puzzle is not a daily one', (await card()).hidden && (await st()).daily === false);
    await page.evaluate(() => window.__chess.puzzles.stop());

    // ---- phone: ?open=daily opens the Menu sheet on the Game section
    await load('open=daily&daily=2026-10-03', 'phone');
    await step(1);
    await new Promise((r) => setTimeout(r, 500));
    c = await card(); s = await st();
    ok('daily: on a phone ?open=daily opens the Menu sheet with the card inside the screen', c && !c.hidden && c.sheetOpen === true && c.left >= 0 && c.right <= c.w && c.top >= 0 && c.bottom <= c.h, JSON.stringify(c));
    ok('daily: phone card shows "Heute gelöst" for the solved day', c && /Heute gelöst/.test(c.text) && /Tagesrätsel/.test(c.text), c && c.text);
    ok('daily: on the phone the card is the first block of the Game section and does not start the puzzle', s.phase === 'idle' && await page.evaluate(() => document.querySelector('.card[data-card="game"] .body').firstElementChild.classList.contains('dailycard')));
    await shot?.('daily-phone-open');
    await load('open=daily&daily=2026-10-09', 'phone');
    await new Promise((r) => setTimeout(r, 500));
    c = await card();
    ok('daily: phone card of an open day has the Start button at 44 px or more', c && c.start && await page.evaluate(() => document.querySelector('.dcstart').getBoundingClientRect().height >= 44));
    await shot?.('daily-phone-start');
    await page.evaluate(() => document.querySelector('.dcstart').click());
    await step(1.5);
    s = await st();
    ok('daily: Start on the phone closes the sheet and loads the puzzle', s.phase === 'playing' && s.daily === true && await page.evaluate(() => !document.querySelector('.psheet.open')), JSON.stringify(s));
    await shot?.('daily-phone-playing');
    // Export and Import (the Menu) carry the daily streak and the badges; an old file without them still imports
    await load('daily=2026-03-04');
    await page.evaluate(() => { const o = URL.createObjectURL.bind(URL); window.__blob = null; URL.createObjectURL = (b) => { window.__blob = b; return o(b); }; });
    const keep = () => page.evaluate(() => JSON.stringify({ d: window.__chess.daily.exportData(), b: window.__chess.badges.store.exportData() }));
    await page.evaluate(() => { window.__chess.badges.earn('puzzles-10'); window.__chess.daily.finish(true); });
    const before = await keep();
    await page.evaluate(() => document.querySelector('.xdata .xrow button').click());
    await new Promise((r) => setTimeout(r, 300));
    const text = await page.evaluate(() => window.__blob.text());
    const obj = JSON.parse(text);
    ok('export: the file has daily and badges next to the openings and puzzles', obj.daily?.days?.['2026-03-04'] === 'g' && obj.badges?.earned?.['puzzles-10'] && 'puzzles' in obj, Object.keys(obj).join(','));
    await page.evaluate(() => { window.__chess.badges.store.reset(); window.__chess.daily.reset(); });
    const { tmpdir } = await import('node:os'); const { writeFileSync } = await import('node:fs'); const { join } = await import('node:path');
    const f1 = join(tmpdir(), `chess3d-export-${process.pid}.json`), f2 = join(tmpdir(), `chess3d-old-${process.pid}.json`);
    writeFileSync(f1, text);
    await (await page.$('.xdata input[type=file]')).uploadFile(f1);
    await new Promise((r) => setTimeout(r, 600));
    ok('import: the daily streak and the badges come back', (await keep()) === before, await keep());
    const old = { ...obj }; delete old.daily; delete old.badges;
    writeFileSync(f2, JSON.stringify(old));
    await (await page.$('.xdata input[type=file]')).uploadFile(f2);
    await new Promise((r) => setTimeout(r, 600));
    ok('import: an old file without daily and badges still imports and leaves them alone', (await page.evaluate(() => document.querySelector('.xdatamsg').textContent)) === 'Importiert.' && (await keep()) === before);
    try { (await import('node:fs')).rmSync(f1); (await import('node:fs')).rmSync(f2); } catch (e) { /* ignore */ }
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
    await page.setViewport({ width: 1280, height: 800 }).catch(() => {});
  }
  ok('daily: no console or page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  log(`daily: ${out.filter((r) => r.pass).length}/${out.length} checks`);
  return out;
}

// standalone: build into .tmp/daily/dist, serve it on its own port, run the checks in one headless Chrome
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ROOT, launchBrowser, startServer, build } = await import('../tools/_lib.mjs');
  const { join } = await import('node:path');
  const port = Number((process.argv.find((a) => a.startsWith('--port=')) || '--port=5366').slice(7));
  const shots = process.argv.includes('--shots');
  const { mkdirSync } = await import('node:fs');
  const dir = join(ROOT, '.tmp/daily/shots'); if (shots) mkdirSync(dir, { recursive: true });
  let server, browser;
  try {
    if (!process.argv.includes('--skip-build')) build('.tmp/daily/dist');
    server = await startServer({ mode: 'preview', port, outDir: '.tmp/daily/dist' });
    browser = await launchBrowser();
    const page = await browser.newPage();
    const res = await runDailyChecks({ page, baseUrl: server.base.replace(/\/$/, ''), log: console.log, shot: shots ? (n) => page.screenshot({ path: join(dir, `${n}.png`) }) : null });
    for (const r of res) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  ' + r.detail}`);
    process.exitCode = res.every((r) => r.pass) ? 0 : 1;
  } finally {
    await browser?.close().catch(() => {});
    server?.stop();
  }
}
