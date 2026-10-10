// Running games, Waiting time, names in the header, switch on accept (CHE-403, smoke group `online running`):
//   node test/online-running.mjs [--skip-build] [--shots]
// Part 1, the real server and real pages (Felix with a local game in progress, Mia, Ben with a fresh board): the accept does not
// replace a local game (a bubble "Mia hat angenommen" to tap, the card knows the game), a fresh board switches by itself with the
// note "<name> hat angenommen", the header names the players for an online game and keeps "Weiß am Zug" for a game against the computer.
// Part 2, the fake server (?onlinepv=running): the block "Laufende Partien" above the players, its order and texts, the last day line
// both ways, the minute refresh, phone sizes, and a throwing board never leaves the cards stale (regression of the stale card, CHE-403).
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { reporter, launchBrowser, startServer, build, settleUi, claimPort, sleep, ROOT } from '../tools/_lib.mjs';
import { runAdmin, inviteLink } from '../server/admin.mjs';

const args = process.argv.slice(2);
const SHOTS = join(ROOT, '.tmp/online-shots'), OUT = '.tmp/online-dist';
const R = reporter();
let SPORT = 0, SERVER = '', claim = null, sclaim = null;
const DB = join(ROOT, `.tmp/online/running-${process.pid}.db`);
let server = null, browser = null, online = null;

function startOnline() {
  return new Promise((ok, bad) => {
    const c = spawn(process.execPath, [join(ROOT, 'server/index.mjs')], { cwd: ROOT, env: { ...process.env, ONLINE_PORT: String(SPORT), ONLINE_HOST: '127.0.0.1', ONLINE_DB: DB }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const done = (fn, v) => { clearTimeout(timer); fn(v); };
    const timer = setTimeout(() => done(bad, new Error('online server did not start: ' + log.slice(-300))), 10000);
    c.stdout.on('data', (d) => { log += d; if (/online server on/.test(log)) done(ok, c); });
    c.stderr.on('data', (d) => { log += d; });
    c.on('exit', (code) => done(bad, new Error(`online server exited ${code}: ${log.slice(-300)}`)));
  });
}
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  claim?.release(); sclaim?.release();
  if (online) { const c = online; online = null; c.kill('SIGTERM'); for (let i = 0; i < 40 && c.exitCode === null; i++) await sleep(50); if (c.exitCode === null) c.kill('SIGKILL'); }
  for (const f of [DB, DB + '-wal', DB + '-shm']) rmSync(f, { force: true });
  const s = R.summary();
  console.log(`\nonline running: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'ONLINE RUNNING FAILED' : 'ONLINE RUNNING OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

let BASE = '';
try {
  sclaim = await claimPort({ kind: 'dev' }); SPORT = sclaim.port; SERVER = `http://127.0.0.1:${SPORT}`;
  process.env.ONLINE_PORT = String(SPORT);
  if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
  claim = await claimPort();
  server = await startServer({ mode: 'preview', outDir: OUT, port: claim.port });
  BASE = server.base.replace(/\/$/, '');
  mkdirSync(join(ROOT, '.tmp/online'), { recursive: true });
  rmSync(DB, { force: true });
  online = await startOnline();
  browser = await launchBrowser({ w: 1280, h: 800, args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
} catch (e) {
  R.fail('build, serve, start the online server and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

process.env.ONLINE_DB = DB;
const quiet = { out: () => {} };
const felix = runAdmin(['invite', 'Felix'], quiet), mia = runAdmin(['invite', 'Mia'], quiet), ben = runAdmin(['invite', 'Ben'], quiet);
const Q = 'quality=low&intro=0&sound=0';
const DESK = [1280, 800, false], PHONE = [390, 844, true], WIDE = [1440, 900, false];

async function open(ctx, url, [w, h, phone] = DESK) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.fail('page error', String(e).slice(0, 200)));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('chess3d.lang', 'de'); sessionStorage.setItem('seeded', '1'); } } catch (e) { /* blocked */ } });
  await page.goto(url + (phone && !url.includes('touch=1') ? '&touch=1' : ''), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await page.evaluate(() => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await settleUi(page);
  return page;
}
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const until = async (page, fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch (e) { return false; } };
const click = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const head = (page) => ev(page, () => document.querySelector('#turn-main')?.title);   // the full line (the text drops the waiting time when the panel is narrow)

try {
  // ============================================================ part 1: the real server
  const ctxA = await browser.createBrowserContext(), ctxB = await browser.createBrowserContext(), ctxC = await browser.createBrowserContext();
  const link = (inv, extra) => inviteLink({ game: `${BASE}/?${Q}${extra}`, server: SERVER, key: inv.key });
  const A = await open(ctxA, link(felix, '&ai=1')), B = await open(ctxB, link(mia, '&ai=0')), C = await open(ctxC, link(ben, '&ai=0'));
  for (const p of [A, B, C]) await until(p, () => window.__chessOnline?.status === 'connected' && window.__chessOnline.state?.players.length === 2);
  R.expect('no running game: the block is hidden', await ev(A, () => document.querySelector('.orun').hidden));

  // Felix has a local game in progress against the computer; Mia accepts his challenge
  await ev(A, () => { const g = window.__chess.game; g.clickSquare(g.nameSq('e2')); g.clickSquare(g.nameSq('e4')); });
  R.expect('Felix plays a local game (his move and the computer answer)', await until(A, () => window.__chess.game.getState().moves.length === 2));
  const localFen = await ev(A, () => window.__chess.game.getState().fen);
  R.expect('local game: the header says "Gegen Computer" (no online game)', /^Gegen Computer/.test(await head(A)), await head(A));
  await click(A, '[data-a=challenge][data-n="Mia"]');
  await until(B, () => !!document.querySelector('[data-a=accept]'));
  await click(B, '[data-a=accept]');
  R.expect('accept with a local game in progress: the board is not replaced', await until(A, () => window.__chessOnline.state.games.some((g) => g.status === 'active')) && !(await ev(A, () => window.__chessOnline.match.attached)) && (await ev(A, () => window.__chess.game.getState().fen)) === localFen);
  R.expect('a bubble says "Mia hat angenommen · Zur Partie ›"', await until(A, () => !document.querySelector('.obub[data-k=game]').hidden && document.querySelector('.obub[data-k=game] .obub-main').textContent === '♟ Mia hat angenommen · Zur Partie ›'), await ev(A, () => document.querySelector('.obub[data-k=game] .obub-main').textContent));
  R.expect('stale card regression: the postcard of Mia knows the game (Zur Partie), she is not in the address book and has no Herausfordern', await ev(A, () => { const c = [...document.querySelectorAll('.orc')].find((r) => r.querySelector('.oname')?.textContent === 'Mia'); return !!c && !!c.querySelector('[data-a=board]') && ![...document.querySelectorAll('.opc')].some((r) => r.querySelector('.oname')?.textContent === 'Mia') && !document.querySelector('[data-a=challenge][data-n="Mia"]'); }));
  R.expect('the block "Laufende Partien" lists the game with colour, move and waiting time', await ev(A, () => { const b = document.querySelector('.orun'); const c = b.querySelector('.orc'); return !b.hidden && /Laufende Partien/i.test(b.querySelector('h4').textContent) && b.querySelectorAll('.orc').length === 1 && /Mia/.test(c.textContent) && /Du spielst (Weiß|Schwarz)/.test(c.textContent) && /Zug 1/.test(c.textContent) && /seit 1 Min/.test(c.textContent) && !!c.querySelector('[data-a=board]'); }), await ev(A, () => document.querySelector('.orun').textContent));
  R.expect('Mia accepted herself: her fresh board has the game and no "hat angenommen" bubble', await until(B, () => window.__chessOnline.match.attached) && await ev(B, () => document.querySelector('.obub[data-k=game]').hidden));
  await click(A, '.obub[data-k=game] .obub-main');
  R.expect('tap on the bubble: the online game is on the board', await until(A, () => window.__chessOnline.match.attached && window.__chess.game.getState().moves.length === 0));
  const colA = await ev(A, () => window.__chessOnline.state.games[0].color);
  const hA = await head(A);
  R.expect('header of an online game names the players, not colours', colA === 'w' ? /^Online gegen Mia · Du bist dran \(Weiß\) · seit 1 Min$/.test(hA) : /^Online gegen Mia · Mia ist dran · seit 1 Min$/.test(hA), hA);
  const hB = await head(B);
  R.expect('the other side sees the mirror', colA === 'w' ? /^Online gegen Felix · Felix ist dran · seit 1 Min$/.test(hB) : /^Online gegen Felix · Du bist dran \(Weiß\) · seit 1 Min$/.test(hB), hB);
  const W = colA === 'w' ? A : B;
  await ev(W, () => { const g = window.__chess.game; g.clickSquare(g.nameSq('e2')); g.clickSquare(g.nameSq('e4')); });
  R.expect('after a move the header flips to the other player at once', await until(W, () => /ist dran/.test(document.querySelector('#turn-main').textContent) && !/Du bist dran/.test(document.querySelector('#turn-main').textContent)), await head(W));
  await ev(A, () => { window.__chess.game.newGame(); });
  R.expect('a new local game leaves the online game: the header is "Gegen Computer" again', await until(A, () => !window.__chessOnline.match.attached && /^Gegen Computer/.test(document.querySelector('#turn-main').textContent)), await head(A));

  // Ben has a fresh board: Mia accepts his challenge, the board switches by itself and a note says so
  await click(C, '[data-a=challenge][data-n="Mia"]');
  await until(B, () => !!document.querySelector('[data-a=accept]'));
  await click(B, '[data-a=accept]');
  R.expect('fresh board: the game is on it by itself', await until(C, () => window.__chessOnline.match.attached));
  R.expect('the challenger gets the note "Mia hat angenommen"', await ev(C, () => /Mia hat angenommen/.test(document.body.textContent)));
  R.expect('no bubble when the board switched itself', await ev(C, () => document.querySelector('.obub[data-k=game]').hidden));
  R.expect('Mia now has two running games, both in her block', await until(B, () => document.querySelectorAll('.orun .orc').length === 2));

  // ============================================================ part 2: the fake server (?onlinepv=running)
  const PVQ = `${Q}&ai=0&online=http%3A%2F%2Fpreview.invalid&onlinepv=`;
  const M = await open(ctxA, `${BASE}/?${PVQ}running&open=online`, WIDE);
  R.expect('running: four cards in the block, above the players', await until(M, () => document.querySelectorAll('.orun .orc').length === 4) && await ev(M, () => document.querySelector('.orun').compareDocumentPosition(document.querySelector('.oplayers')) & Node.DOCUMENT_POSITION_FOLLOWING && document.querySelector('.orun').getBoundingClientRect().bottom <= document.querySelector('.oplayers').getBoundingClientRect().top + 1));
  const cards = () => ev(M, () => [...document.querySelectorAll('.orun .orc')].map((c) => ({ name: c.querySelector('.oname').textContent, mine: c.classList.contains('mine'), turn: c.querySelector('.orturn').textContent.replace(/\s+/g, ' ').trim(), limit: c.querySelector('.orlimit')?.textContent || '' })));
  const got = await cards();
  R.expect('running: yours first (the longest waiting first), then theirs', got.map((c) => c.name).join() === 'Felix,Nina,Opa,Mia' && got.map((c) => c.mine).join() === 'true,true,false,false', JSON.stringify(got));
  R.expect('running: texts "Du bist dran · seit 2 Tage", "seit 2 Std", "Opa ist dran · seit 2 Tage", "Mia ist dran · seit 12 Min"', got[0].turn === 'Du bist dran · seit 2 Tage' && got[1].turn === 'Du bist dran · seit 2 Std' && got[2].turn === 'Opa ist dran · seit 2 Tage' && got[3].turn === 'Mia ist dran · seit 12 Min', JSON.stringify(got.map((c) => c.turn)));
  R.expect('running: the last day line both ways, none before', got[0].limit === 'noch 12 Std, dann gewinnt Felix' && got[2].limit === 'noch 5 Std, dann kannst du beenden' && !got[1].limit && !got[3].limit, JSON.stringify(got.map((c) => c.limit)));
  R.expect('running: side and move number', await ev(M, () => /Du spielst Weiß · Zug 2/.test(document.querySelector('.orun .orc[data-id="11"] .orinfo').textContent)));
  R.expect('running: every game is a postcard, none of the four players is in the address book', await ev(M, () => !document.querySelectorAll('.opc').length && document.querySelectorAll('.orc [data-a=board]').length === 4));
  await click(M, '.orun .orc[data-id="14"] [data-a=board]');
  R.expect('Zur Partie from the block: Opa on the board, the header says "Online gegen Opa · Opa ist dran · seit 2 Tage"', await until(M, () => window.__chessOnline.match.attached && window.__chessOnline.match.game.id === 14 && document.querySelector('#turn-main').title === 'Online gegen Opa · Opa ist dran · seit 2 Tage'), await head(M));
  await click(M, '.orun .orc[data-id="12"] [data-a=board]');
  R.expect('Zur Partie on Felix: the header says "Du bist dran (Weiß)"', await until(M, () => window.__chessOnline.match.game.id === 12 && document.querySelector('#turn-main').title === 'Online gegen Felix · Du bist dran (Weiß) · seit 2 Tage'), await head(M));
  // the minute refresh: an hour passes on the page clock, the tick recomputes the texts
  await ev(M, () => { const d = Date.now; window.__d0 = d; Date.now = () => d.call(Date) + 3600000; window.__chessOnline.tick(); });
  const later = await cards();
  R.expect('minute refresh: an hour later "seit 3 Std" and 4 h less on the limit', later.find((c) => c.name === 'Nina').turn === 'Du bist dran · seit 3 Std' && later.find((c) => c.name === 'Opa').limit === 'noch 4 Std, dann kannst du beenden', JSON.stringify(later.map((c) => [c.name, c.turn, c.limit])));
  await ev(M, () => { Date.now = window.__d0; });
  // a finished or a missing game is not listed; a new accepted game appears, even when the board code throws (stale card regression)
  await ev(M, () => { window.__chessOnline.match.update = () => { throw new Error('boom'); }; window.__chessOnline.api.sim((st) => { st.games.find((g) => g.id === 13).status = 'over'; st.games.find((g) => g.id === 13).winner = 'w'; }); });
  R.expect('a finished game leaves the block, even when the board code throws', await until(M, () => document.querySelectorAll('.orun .orc').length === 3 && !document.querySelector('.orun .orc[data-id="13"]')));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await M.screenshot({ path: join(SHOTS, 'desktop-running.png') }); }
  await M.close();

  // Zur Partie while a puzzle runs asks first; yes ends the puzzle through its controller, no keeps it (CHE-403 point 5)
  const PZ = await open(ctxA, `${BASE}/?${PVQ}running&open=online`, WIDE);
  await until(PZ, () => document.querySelectorAll('.orun .orc').length === 4);
  await ev(PZ, () => window.__chess.puzzles.start());
  const puzOn = await ev(PZ, () => window.__chess.game.mode);
  R.expect('a puzzle runs on the board (mode puzzle)', puzOn === 'puzzle', puzOn);
  await click(PZ, '.orun .orc[data-id="12"] [data-a=board]');
  R.expect('Zur Partie during a puzzle asks "Rätsel abbrechen und zur Partie?" and changes nothing yet', await until(PZ, () => !document.querySelector('.oask')?.hidden && /Rätsel abbrechen und zur Partie/.test(document.querySelector('.oask')?.textContent || '')) && await ev(PZ, () => window.__chess.game.mode === 'puzzle' && !window.__chessOnline.match.attached));
  await click(PZ, '.oask [data-a=ask-no]');
  R.expect('Nein keeps the puzzle', await ev(PZ, () => document.querySelector('.oask').hidden && window.__chess.game.mode === 'puzzle' && window.__chess.puzzles.state().phase !== 'idle' && !window.__chessOnline.match.attached));
  await click(PZ, '.orun .orc[data-id="12"] [data-a=board]');
  await click(PZ, '.oask [data-a=ask-yes]');
  R.expect('Ja ends the puzzle through its controller and the online game is on the board', await until(PZ, () => window.__chess.puzzles.state().phase === 'idle' && window.__chess.game.mode === 'play' && window.__chessOnline.match.attached && window.__chessOnline.match.game.id === 12 && window.__chess.game.getState().moves.length === 2), await ev(PZ, () => `${window.__chess.game.mode} ${window.__chess.puzzles.state().phase} ${window.__chessOnline.match.attached}`));
  await PZ.close();

  const MP = await open(ctxA, `${BASE}/?${PVQ}running&open=online`, PHONE);
  await settleUi(MP);
  R.expect('running phone 390: four cards, every button 44 px, nothing overflows', await until(MP, () => document.querySelectorAll('.orun .orc').length === 4) && await ev(MP, () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && [...document.querySelectorAll('.orun .obtn')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 43.5 && r.width >= 43.5 && r.right <= innerWidth; }) && [...document.querySelectorAll('.orun .orc')].every((c) => c.getBoundingClientRect().right <= innerWidth + 1)));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await MP.screenshot({ path: join(SHOTS, 'phone-running.png') }); }
  await click(MP, '.orun .orc[data-id="14"] [data-a=board]');
  R.expect('running phone: the pill names the player', await until(MP, () => window.__chessOnline.match.attached && /^Online gegen Opa · Opa ist dran/.test(document.querySelector('.pstatus .ps-main')?.textContent || '')), await ev(MP, () => document.querySelector('.pstatus')?.textContent));
  await MP.close();
  const MS = await open(ctxA, `${BASE}/?${PVQ}running&open=online`, [844, 390, true]);
  R.expect('running phone landscape: nothing overflows sideways', await until(MS, () => document.querySelectorAll('.orun .orc').length === 4) && await ev(MS, () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  await MS.close();
} catch (e) {
  R.fail('run', 'threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ').slice(0, 400));
}
await finish();
