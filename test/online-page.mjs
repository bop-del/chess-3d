// Online play in the real page (CHE-271, smoke group `online`): node test/online-page.mjs [--base=<server>] [--skip-build] [--shots]
// Starts the online server (server/index.mjs) with a fresh database on the lane's server port (dev port + 200), invites Felix and
// Mia, and drives two players in TWO browser contexts of ONE launchBrowser() Chrome (also on two origins, 127.0.0.1 and localhost,
// so the two logins are apart twice over): Felix logs in by link, Mia by code, challenge, accept, three moves each side,
// one chat message each way, the connection lost mid game (grey, red after 10 s, the Details box, the locked board) and back
// (green, unlocked, the move goes through), resign, both see the result and the new score. Also: without ?online= there is no Online
// tab; with it and no invite the sentence and the code field show; the 7 button phone bar keeps 44 px targets. Music and sound off
// (?sound=0). The server is stopped in finally. --shots writes the Online tab at 390 px portrait, a landscape phone and 1440 px desktop,
// in the Classic and the Pixelwelt look, to .tmp/online-shots. Last (CHE-343): a second server
// with ONLINE_BOT=1: an admin makes the Bot challenge them, a player challenges it, it accepts, plays and chats.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { reporter, launchBrowser, startServer, build, settleUi, lanePorts, portAnswers, sleep, ROOT } from '../tools/_lib.mjs';
import { runAdmin, inviteLink } from '../server/admin.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const SHOTS = join(ROOT, '.tmp/online-shots'), OUT = '.tmp/online-dist';
const R = reporter();
const SPORT = lanePorts().dev + 200;
const SERVER = `http://127.0.0.1:${SPORT}`;
const DB = join(ROOT, `.tmp/online/smoke-${process.pid}.db`);
let server = null, browser = null, online = null;

function startOnline(extra = {}) {
  return new Promise((ok, bad) => {
    const c = spawn(process.execPath, [join(ROOT, 'server/index.mjs')], { cwd: ROOT, env: { ...process.env, ONLINE_PORT: String(SPORT), ONLINE_HOST: '127.0.0.1', ONLINE_DB: DB, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const done = (fn, v) => { clearTimeout(timer); fn(v); };
    const timer = setTimeout(() => done(bad, new Error('online server did not start: ' + log.slice(-300))), 10000);
    c.stdout.on('data', (d) => { log += d; if (/online server on/.test(log)) done(ok, c); });
    c.stderr.on('data', (d) => { log += d; });
    c.on('exit', (code) => done(bad, new Error(`online server exited ${code}: ${log.slice(-300)}`)));
  });
}
const stopOnline = async () => { if (!online) return; const c = online; online = null; c.kill('SIGTERM'); for (let i = 0; i < 40 && c.exitCode === null; i++) await sleep(50); if (c.exitCode === null) c.kill('SIGKILL'); };

const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  try { await stopOnline(); } catch (e) { /* ignore */ }
  for (const f of [DB, DB + '-wal', DB + '-shm']) rmSync(f, { force: true });
  const s = R.summary();
  console.log(`\nonline: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'ONLINE FAILED' : 'ONLINE OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

let BASE = opt('base', '').replace(/\/$/, '');
try {
  if (await portAnswers(SPORT)) throw new Error(`the online server port ${SPORT} is in use (another run?)`);
  if (!BASE) {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', outDir: OUT });
    BASE = server.base.replace(/\/$/, '');
  }
  mkdirSync(join(ROOT, '.tmp/online'), { recursive: true });
  rmSync(DB, { force: true });
  online = await startOnline();
  // its own Chrome (own args: the shared one hands out a single context): two real browser contexts, and no tab of one player
  // stays in the background without animation frames
  browser = await launchBrowser({ w: 1280, h: 720, args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  if (typeof browser.createBrowserContext !== 'function') throw new Error('launchBrowser gave no createBrowserContext: two players need two contexts');
} catch (e) {
  R.fail('build, serve, start the online server and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

const BASE_B = BASE.replace('127.0.0.1', 'localhost');   // Mia's origin: her own storage even where the contexts are shared
process.env.ONLINE_DB = DB; process.env.ONLINE_PORT = String(SPORT);
const quiet = { out: () => {} };
const felix = runAdmin(['invite', 'Felix'], quiet), mia = runAdmin(['invite', 'Mia'], quiet);
const Q = `quality=low&intro=0&ai=0&sound=0`;
const flag = `online=${encodeURIComponent(SERVER)}`;
const DESK = [1280, 800, false], PHONE = [390, 844, true], LAND = [844, 390, true], WIDE = [1440, 900, false];

async function open(ctx, url, [w, h, phone] = DESK, lang = 'de') {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.fail('page error', String(e).slice(0, 200)));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.evaluateOnNewDocument(() => { window.__line = () => { const m = document.querySelector('#turn-main'); return ((m && m.clientWidth ? m : document.querySelector('.pstatus .ps-main')) || {}).textContent || ''; }; });   // the Context line: the header on a computer, the pill on a phone (CHE-407)
  await page.evaluateOnNewDocument((l) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('chess3d.lang', l); sessionStorage.setItem('seeded', '1'); } } catch (e) { /* blocked */ } }, lang);
  await page.goto(url + (phone && !url.includes('touch=1') ? '&touch=1' : ''), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await page.evaluate(() => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await settleUi(page);
  return page;
}
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const until = async (page, fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch (e) { return false; } };
const shown = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 2 && r.height > 2 && st.visibility !== 'hidden' && st.display !== 'none' && !e.closest('[hidden]'); }, sel);
const click = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const status = (page) => ev(page, () => window.__chessOnline?.status);
const moveOn = (page, uci) => ev(page, (u) => { const g = window.__chess.game; g.clickSquare(g.nameSq(u.slice(0, 2))); g.clickSquare(g.nameSq(u.slice(2, 4))); return g.getState().moves.length; }, uci);
const boardMoves = (page) => ev(page, () => window.__chess.game.getState().moves.length);
const serverMoves = (page) => ev(page, () => window.__chessOnline?.state?.game?.moves.length ?? -1);

let ctxA = null, ctxB = null, ctxC = null;
try {
  // ------------------------------------------------------------ without the flag: nothing changes
  const ctx0 = await browser.createBrowserContext();
  let p0 = await open(ctx0, `${BASE}/?${Q}`);
  R.expect('without ?online= there is no Online tab', !(await ev(p0, () => !!document.querySelector('#tab-online, #tp-online, .olock'))));
  await p0.close();
  p0 = await open(ctx0, `${BASE}/?${Q}`, PHONE);
  R.expect('without ?online= the phone bar keeps its 6 buttons', (await ev(p0, () => document.querySelectorAll('nav.pbar:not(.plbar) .tb').length)) === 6);
  await p0.close();

  // ------------------------------------------------------------ with the flag and no invite: the sentence and the code field
  ctxA = await browser.createBrowserContext();
  ctxB = await browser.createBrowserContext();
  const B = await open(ctxB, `${BASE_B}/?${Q}&${flag}&open=online`);
  R.expect('with the flag: the Online tab sits between Learn and Options', (await ev(B, () => [...document.querySelectorAll('.tabs .tab')].map((x) => x.dataset.tab).join())) === 'play,learn,online,settings');
  R.expect('the deep link open=online shows the tab', await until(B, () => document.querySelector('#tab-online')?.classList.contains('on') && !document.querySelector('#tp-online').hidden));
  R.expect('no invite: the sentence and the code field show', await until(B, () => !!document.querySelector('.ologin:not([hidden]) .oneed')) && (await ev(B, () => document.querySelector('.ologin .oneed').textContent)).startsWith('Online spielen geht nur mit Einladung') && await shown(B, '.ocode input'));
  R.expect('no invite: no request button', (await ev(B, () => document.querySelectorAll('.ologin button').length)) === 1);
  // CHE-412: the pill shows before a login too: green with a reachable server, red (with Details) with an unreachable one
  R.expect('no invite, server up: one pill, green "Server verbunden"', await until(B, () => document.querySelector('.oconn')?.dataset.s === 'connected') && await shown(B, '.oconn') && (await ev(B, () => document.querySelectorAll('.onl .oconn').length)) === 1 && (await ev(B, () => document.querySelector('.oconn .otxt').textContent)) === 'Server verbunden');
  const DEAD = `http://127.0.0.1:${SPORT + 1}`;
  if (await portAnswers(SPORT + 1)) R.fail('the dead port answers', String(SPORT + 1));
  else {
    const D = await open(await browser.createBrowserContext(), `${BASE_B}/?${Q}&online=${encodeURIComponent(DEAD)}&open=online`);
    R.expect('no invite, server down: red "Server nicht erreichbar" with Details', await until(D, () => document.querySelector('.oconn')?.dataset.s === 'unreachable') && (await ev(D, () => document.querySelector('.oconn .otxt').textContent)) === 'Server nicht erreichbar' && await shown(D, '.oconn [data-a=details]') && await shown(D, '.ocode input'));
    await click(D, '.oconn [data-a=details]');
    R.expect('no invite, server down: Details open with Try again', await until(D, () => !!document.querySelector('.odet [data-a=retry]')) && !(await ev(D, () => !!document.querySelector('.odet .onext'))));
    if (args.includes('--shots')) { mkdirSync(join(ROOT, '.tmp/conn/shots'), { recursive: true }); await D.screenshot({ path: join(ROOT, '.tmp/conn/shots/login-red-desktop.png') }); }
    await D.close();
    for (const [name, vp] of [['390x844', PHONE], ['320x568', [320, 568, true]]]) {
      for (const [col, url] of [['green', SERVER], ['red', DEAD]]) {
        const P = await open(await browser.createBrowserContext(), `${BASE_B}/?${Q}&online=${encodeURIComponent(url)}&open=online`, vp);
        await until(P, (c) => document.querySelector('.oconn')?.dataset.s === c, col === 'green' ? 'connected' : 'unreachable');
        const fit = await ev(P, () => { const q = (x) => document.querySelector(x)?.getBoundingClientRect(); const a = q('.oconn'), b = q('.oneed'), c = q('.ocode'); return { apart: !!a && a.width > 2 && a.bottom <= b.top + 1 && b.bottom <= c.top + 1, inside: a.left >= 0 && a.right <= innerWidth && c.right <= innerWidth, noScroll: document.documentElement.scrollWidth <= innerWidth }; });
        R.expect(`phone ${name} ${col}: pill, sentence and code field stack without overlap or overflow`, fit.apart && fit.inside && fit.noScroll, JSON.stringify(fit));
        if (args.includes('--shots')) await P.screenshot({ path: join(ROOT, `.tmp/conn/shots/login-${col}-phone-${name}.png`) });
        await P.close();
      }
    }
  }
  if (args.includes('--shots')) { mkdirSync(join(ROOT, '.tmp/conn/shots'), { recursive: true }); await B.screenshot({ path: join(ROOT, '.tmp/conn/shots/login-green-desktop.png') }); }

  // ------------------------------------------------------------ Felix by link, Mia by code
  const link = inviteLink({ game: `${BASE}/?${Q}`, server: SERVER, key: felix.key });
  const A = await open(ctxA, link);
  R.expect('link login: the fragment is stripped from the address bar at once', !(await ev(A, () => location.href)).includes(felix.key) && !(await ev(A, () => location.hash)));
  R.expect('link login: stored and connected (green)', await until(A, () => window.__chessOnline?.status === 'connected') && (await ev(A, () => JSON.parse(localStorage.getItem('chess3d.online')).server)) === SERVER);
  R.expect('the connection line says Server verbunden', (await ev(A, () => document.querySelector('.oconn .otxt').textContent)) === 'Server verbunden');
  await ev(B, (c) => { const i = document.querySelector('.ocode input'); i.value = c.toLowerCase(); document.querySelector('.ocode').requestSubmit(); }, 'MIA-ZZZZ');
  R.expect('a wrong code says so', await until(B, () => /passt nicht/.test(document.querySelector('.ologin .oerr')?.textContent || '')));
  await ev(B, (c) => { const i = document.querySelector('.ocode input'); i.value = c; document.querySelector('.ocode').requestSubmit(); }, mia.code);
  R.expect('code login: connected as Mia', await until(B, () => window.__chessOnline?.status === 'connected' && window.__chessOnline.state?.me.name === 'Mia'));
  R.expect('presence: Felix sees Mia online (green dot)', await until(A, () => !!document.querySelector('.op .pres.on')));
  R.expect('score: noch keine Partie beendet before the first game', (await ev(A, () => document.querySelector('.op .oscore')?.textContent)) === 'noch keine Partie beendet');

  // ------------------------------------------------------------ challenge, accept
  await click(A, '[data-a=challenge][data-n="Mia"]');
  R.expect('the challenge reaches Mia with a dot on her tab', await until(B, () => !!document.querySelector('[data-a=accept]') && document.querySelector('#tab-online').classList.contains('odot')));
  R.expect('Felix waits: the status sits in the card of Mia', await until(A, () => /Herausgefordert, wartet/.test(document.querySelector('.ostate.asked')?.textContent || '') && !document.querySelector('.ochal .owait')));
  await click(B, '[data-a=accept]');
  const both = async (fn, arg, ms) => (await until(A, fn, arg, ms)) && (await until(B, fn, arg, ms));
  R.expect('accept: both boards show the online game', await both(() => window.__chessOnline?.match?.attached && window.__chessOnline.state.game?.status === 'active'));
  const colA = await ev(A, () => window.__chessOnline.state.game.color);
  const W = colA === 'w' ? A : B, Bl = colA === 'w' ? B : A;
  R.expect('colours: one white, one black', (await ev(Bl, () => window.__chessOnline.state.game.color)) === 'b', `Felix plays ${colA}`);
  R.expect('in a game: no challenge button, Back and Good move? off', !(await ev(A, () => !!document.querySelector('[data-a=challenge]'))) && (await ev(A, () => document.querySelector('#btn-good').disabled)));

  // ------------------------------------------------------------ three moves each side
  const seq = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'];
  R.expect('the side not to move cannot move', (await moveOn(Bl, 'e7e5')) === 0);
  let movesOk = true;
  for (let i = 0; i < seq.length; i++) {
    const p = i % 2 ? Bl : W, o = i % 2 ? W : Bl;
    await until(p, (n) => !window.__chess.game.busy && window.__chess.game.getState().moves.length === n, i, 8000);
    await moveOn(p, seq[i]);
    const ok = await until(o, (n) => window.__chess.game.getState().moves.length === n && !window.__chess.game.busy, i + 1, 10000) && await until(p, (n) => window.__chessOnline.state.game.moves.length === n, i + 1, 5000);
    if (!ok) { movesOk = false; R.fail(`move ${seq[i]} reaches the other board`, `board ${await boardMoves(o)}, server ${await serverMoves(p)}`); break; }
  }
  if (movesOk) R.pass('three moves each side: every move shows on the other board and on the server');
  R.expect('both boards agree with the rules engine', (await ev(A, () => window.__chess.game.getState().fen)) === (await ev(B, () => window.__chess.game.getState().fen)));

  // ------------------------------------------------------------ chat, one message each way
  await click(A, '[data-a=chat][data-n="Mia"]');
  await ev(A, () => { const i = document.querySelector('.osend input'); i.value = 'Hallo Mia, viel Glück!'; document.querySelector('.osend').requestSubmit(); });
  R.expect('the chat head says mitgelesen with the eye icon', (await ev(A, () => document.querySelector('.omon').textContent.trim())) === 'mitgelesen' && await ev(A, () => !!document.querySelector('.omon svg')) && await shown(A, '.omon'));
  R.expect('Mia gets the message: the count 1 on the Chat button and on the Online tab', await until(B, () => document.querySelector('.op .ochatbtn .ocnt')?.textContent === '1' && document.querySelector('#tab-online')?.dataset.n === String(1 + window.__chessOnline.state.games.filter((g) => g.status === 'active' && g.turn === g.color).length)));   // CHE-335: the bell counts unread messages plus games where it is your move
  R.expect('the chat of Felix is closed on her side: a bubble over the board, "💬 Felix: text ›"', await until(B, () => !document.querySelector('.obub').hidden && document.querySelector('.obub-main').textContent === '💬 Felix: Hallo Mia, viel Glück! ›'), await ev(B, () => document.querySelector('.obub-main').textContent));
  R.expect('the game card has a Chat button with the count too', (await ev(B, () => document.querySelector('.opc.ingame .ochatbtn .ocnt')?.textContent)) === '1');
  R.expect('Felix, whose chat is open and visible, got no bubble for his own message', await ev(A, () => document.querySelector('.obub').hidden));
  await click(B, '.obub-main');
  R.expect('a tap on the bubble opens that chat and hides the bubble', await until(B, () => document.querySelector('.obub').hidden && !document.querySelector('.ochat').hidden && /Chat mit Felix/.test(document.querySelector('.owith').textContent) && document.activeElement === document.querySelector('.osend input')));
  R.expect('Mia reads it', await until(B, () => /Hallo Mia/.test(document.querySelector('.omsgs')?.textContent || '')));
  R.expect('opening the chat clears the count', await until(B, () => !document.querySelector('.op .ocnt') && (document.querySelector('#tab-online').dataset.n || '0') === String(window.__chessOnline.state.games.filter((g) => g.status === 'active' && g.turn === g.color).length) && !Object.keys(window.__chessOnline.state.unread).length));
  await ev(B, () => { const i = document.querySelector('.osend input'); i.value = 'Danke, dir auch'; document.querySelector('.osend').requestSubmit(); });
  R.expect('Felix gets the answer in the open chat, without a bubble', await until(A, () => /Danke, dir auch/.test(document.querySelector('.omsgs')?.textContent || '')) && await ev(A, () => document.querySelector('.obub').hidden));
  R.expect('the input keeps at most 200 characters', (await ev(A, () => document.querySelector('.osend input').maxLength)) === 200);

  // ------------------------------------------------------------ the connection lost mid game and back
  await stopOnline();
  const t0 = Date.now();
  R.expect('server stopped: grey "verbinde..." first', await until(W, () => window.__chessOnline.status === 'connecting', null, 8000) && (await ev(W, () => document.querySelector('.oconn .otxt').textContent)) === 'verbinde...');
  R.expect('the board is locked with the line over it', await until(W, () => !document.querySelector('.olock').hidden) && /Keine Verbindung, Zug geht gleich wieder/.test(await ev(W, () => document.querySelector('.olock').textContent)));
  R.expect('the locked board refuses a move', (await moveOn(W, 'e1g1')) === 6);
  R.expect('still grey before 10 s', (await status(W)) === 'connecting' && Date.now() - t0 < 9500, `${Date.now() - t0} ms`);
  const red = await until(W, () => window.__chessOnline.status === 'unreachable', null, 16000);
  const redMs = Date.now() - t0;
  R.expect('red "Server nicht erreichbar" after 10 s', red && redMs >= 9500 && (await ev(W, () => document.querySelector('.oconn .otxt').textContent)) === 'Server nicht erreichbar', `${redMs} ms`);
  await click(W, '.oconn [data-a=details]');
  await click(W, '[data-a=lock-details]');
  const det = await ev(W, () => ({ tab: document.querySelector('.onl .odet')?.textContent || '', lock: document.querySelector('.olock .odet')?.textContent || '', tech: document.querySelector('.olock .otech')?.textContent || '' }));
  R.expect('the Details box: cause, last connected, countdown, the two buttons, the technical block', /Der Server antwortet nicht/.test(det.tab) && /Zuletzt verbunden: \d\d:\d\d/.test(det.tab) && /(Nächster Versuch in \d+ s|Versuche gerade)/.test(det.tab) && /Nochmal versuchen/.test(det.lock) && /Details kopieren/.test(det.lock) && /request: GET \/events/.test(det.tech) && /server host: 127\.0\.0\.1/.test(det.tech) && /app version: v/.test(det.tech), JSON.stringify(det).slice(0, 300));
  R.expect('the details hold no key, no code and no chat text', ![felix.key, mia.key, felix.code, mia.code, 'Hallo Mia', 'Danke'].some((s) => (det.tab + det.lock).includes(s)));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await W.screenshot({ path: join(SHOTS, 'desktop-unreachable.png') }); }
  online = await startOnline();
  await click(W, '.olock [data-a=retry]');
  R.expect('server back: green again and the board unlocked', await until(W, () => window.__chessOnline.status === 'connected' && document.querySelector('.olock').hidden, null, 15000) && await until(Bl, () => window.__chessOnline.status === 'connected', null, 15000));
  await moveOn(W, 'e1g1');
  R.expect('the move after the reconnect goes through, once', await until(Bl, () => window.__chess.game.getState().moves.length === 7 && window.__chessOnline.state.game.moves.length === 7, null, 10000));

  // ------------------------------------------------------------ resign, the result and the new score on both sides
  await click(Bl, '[data-a=resign]');
  R.expect('resign asks first', await until(Bl, () => /Partie wirklich aufgeben/.test(document.querySelector('.oconfirm')?.textContent || '')));
  await click(Bl, '[data-a=resign-yes]');
  const wName = W === A ? 'Mia' : 'Felix', lName = W === A ? 'Felix' : 'Mia';
  R.expect('both see the end of the game', await both(() => window.__chessOnline.state.game.status === 'over' && window.__chessOnline.state.game.reason === 'resign'));
  R.expect('the winner sees the game over card with the new score', await until(W, (n) => /Gegen .+ jetzt 1 : 0/.test(document.querySelector('#banner .oscore-line')?.textContent || '') && !document.querySelector('#banner').hidden, wName, 12000), await ev(W, () => document.querySelector('#banner')?.textContent));
  R.expect('the loser sees it too: 0 : 1', await until(Bl, () => /jetzt 0 : 1/.test(document.querySelector('#banner .oscore-line')?.textContent || '') && !document.querySelector('#banner').hidden, null, 12000));
  R.expect('the Online tab shows the result and the score in the list', await until(W, () => /Du hast gewonnen/.test(document.querySelector('.oresult')?.textContent || '') && document.querySelector('.op .oscore')?.textContent === '1 : 0') && await until(Bl, () => /Du hast verloren/.test(document.querySelector('.oresult')?.textContent || '') && document.querySelector('.op .oscore')?.textContent === '0 : 1'));
  R.expect('after the game both can challenge again', await both(() => !!document.querySelector('[data-a=challenge]')), `${lName} lost`);

  // ------------------------------------------------------------ the bubble, the count and the summary (CHE-281)
  const typeTo = (page, text) => ev(page, (x) => { const i = document.querySelector('.osend input'); i.value = x; document.querySelector('.osend').requestSubmit(); }, text);
  await click(B, '[data-a=chat-close]');
  await click(A, '[data-a=chat][data-n="Mia"]');
  await typeTo(A, 'eins');
  await until(B, () => document.querySelector('#tab-online')?.dataset.n === '1');
  await typeTo(A, 'zwei');
  R.expect('two messages in a row: the bubble shows the newest, the count says 2', await until(B, () => document.querySelector('.obub-main').textContent === '💬 Felix: zwei ›' && document.querySelector('#tab-online').dataset.n === '2'));
  await click(B, '.obub-x');
  R.expect('x hides the bubble, the count stays', await ev(B, () => document.querySelector('.obub').hidden && document.querySelector('#tab-online').dataset.n === '2' && document.querySelector('.op .ocnt')?.textContent === '2'));
  R.expect('a message counts as read only when its chat was visible: still unread on the server', (await ev(B, () => window.__chessOnline.state.unread.Felix)) === 2);
  // a new message: the bubble goes away by itself after 8 s
  await typeTo(A, 'drei');
  const t8 = Date.now();
  R.expect('the bubble comes back with the next message', await until(B, () => !document.querySelector('.obub').hidden && /drei/.test(document.querySelector('.obub-main').textContent)));
  R.expect('and goes after 8 s', await until(B, () => document.querySelector('.obub').hidden, null, 12000) && Date.now() - t8 >= 7500 && Date.now() - t8 < 11000, `${Date.now() - t8} ms`);
  // reload with unread from one sender: the summary
  const B2 = await open(ctxB, `${BASE_B}/?${Q}&${flag}`);
  R.expect('reload with unread from one sender: "Felix: drei (+2)", count 3', await until(B2, () => document.querySelector('.obub-main').textContent === '💬 Felix: drei (+2) ›' && document.querySelector('#tab-online').dataset.n === '3'), await ev(B2, () => document.querySelector('.obub-main').textContent));
  await sleep(8800);
  R.expect('the summary stays past 8 s', await shown(B2, '.obub'));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await B2.screenshot({ path: join(SHOTS, 'desktop-summary.png') }); }
  await click(B2, '.obub-x');
  R.expect('x on the summary hides it, the count stays', await ev(B2, () => document.querySelector('.obub').hidden && document.querySelector('#tab-online').dataset.n === '3'));
  await B2.close();
  const B3 = await open(ctxB, `${BASE_B}/?${Q}&${flag}`);
  R.expect('the summary returns on the next load while anything is unread', await until(B3, () => !document.querySelector('.obub').hidden && /Felix/.test(document.querySelector('.obub-main').textContent)));
  await click(B3, '.obub-main');
  R.expect('tap on the summary of one sender opens that chat, everything read', await until(B3, () => !document.querySelector('.ochat').hidden && /Chat mit Felix/.test(document.querySelector('.owith').textContent) && !document.querySelector('#tab-online').dataset.n && !Object.keys(window.__chessOnline.state.unread).length));
  // two senders: Lea writes too
  const lea = runAdmin(['invite', 'Lea'], quiet);
  ctxC = await browser.createBrowserContext();
  const C = await open(ctxC, inviteLink({ game: `${BASE}/?${Q}`, server: SERVER, key: lea.key }));
  await until(C, () => window.__chessOnline?.status === 'connected' && !!window.__chessOnline.state?.players.length);
  await click(C, '[data-a=chat][data-n="Mia"]');
  await typeTo(C, 'Hi von Lea');
  await click(B3, '[data-a=chat-close]');
  await typeTo(A, 'vier');
  await until(B3, () => document.querySelector('#tab-online')?.dataset.n === '2');
  await B3.close();
  const B4 = await open(ctxB, `${BASE_B}/?${Q}&${flag}`);
  R.expect('reload with unread from two senders: "2 neue Nachrichten von Felix und Lea"', await until(B4, () => document.querySelector('.obub-main').textContent === '💬 2 neue Nachrichten von Felix und Lea ›'), await ev(B4, () => document.querySelector('.obub-main').textContent));
  await click(B4, '.obub-main');
  R.expect('tap on that summary opens the Online tab with the player list, no chat', await until(B4, () => document.querySelector('#tab-online').classList.contains('on') && document.querySelector('.ochat').hidden && document.querySelectorAll('.op .ochatbtn').length === 2 && document.querySelector('.obub').hidden));
  R.expect('every player row has a Chat button, the name is no button', (await ev(B4, () => [...document.querySelectorAll('.op')].every((r) => r.querySelector('.ochatbtn') && !r.querySelector('.oname').closest('button')))));
  for (const n of ['Felix', 'Lea']) { await click(B4, `[data-a=chat][data-n="${n}"]`); await until(B4, (x) => !window.__chessOnline.state.unread[x], n); }
  await B4.close(); await C.close();

  // ------------------------------------------------------------ phone: the 7 button bar, the sheet, 44 px targets; screenshots
  const P = await open(ctxA, `${BASE}/?${Q}&${flag}`, PHONE);
  const bar = await ev(P, () => [...document.querySelectorAll('nav.pbar:not(.plbar) .tb')].map((b) => { const r = b.getBoundingClientRect(); return { a: b.dataset.act, w: r.width, h: r.height }; }));
  R.expect('phone: 7 buttons, Play, Learn, Online first', bar.length === 7 && bar.slice(0, 3).map((b) => b.a).join() === 'new,learn,online', bar.map((b) => b.a).join());
  R.expect('phone: every bar button at least 44 px', bar.every((b) => b.w >= 44 && b.h >= 44), bar.map((b) => `${b.a} ${Math.round(b.w)}x${Math.round(b.h)}`).join(', '));
  await click(P, '.tb[data-act=online]');
  await settleUi(P);
  R.expect('phone: the Online sheet opens with the player list', await until(P, () => document.querySelector('.psheet.ponline')?.classList.contains('open') && !!document.querySelector('.ponline .op')));
  const small = await ev(P, () => [...document.querySelectorAll('.ponline button, .ponline input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.closest('[hidden]') && (r.width < 43.5 || r.height < 43.5); }).map((e) => `${e.className} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  R.expect('phone: tap targets in the Online sheet at least 44 px', !small.length, small.join(', '));
  await P.close();

  // phone: the bubble, the count on the bar button, the Chat button, the half height sheet with the board above it, the keyboard
  const PH = {};
  for (const [tag, size] of [['portrait', PHONE], ['narrow', [360, 740, true]], ['landscape', LAND]]) {
    const M = await open(ctxB, `${BASE_B}/?${Q}&${flag}`, size);
    await until(M, () => window.__chessOnline?.status === 'connected');
    // Felix writes: the bubble over the board, the count on the bar button (Mia has read everything above)
    await click(A, '[data-a=chat][data-n="Mia"]');
    await typeTo(A, `Phone ${tag}`);
    R.expect(`phone ${tag}: a bubble over the board and the count on the Online button`, await until(M, () => !document.querySelector('.obub').hidden && /Phone/.test(document.querySelector('.obub-main').textContent) && document.querySelector('.tb[data-act=online]').dataset.n === '1'));
    const bb = await ev(M, () => { const r = document.querySelector('.obub').getBoundingClientRect(), x = document.querySelector('.obub-x').getBoundingClientRect(), m = document.querySelector('.obub-main').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, w: innerWidth, xw: x.width, xh: x.height, mh: m.height }; });
    R.expect(`phone ${tag}: the bubble is inside the screen, its targets 44 px`, bb.l >= 0 && bb.r <= bb.w && bb.xw >= 43.5 && bb.xh >= 43.5 && bb.mh >= 43.5, JSON.stringify(bb));
    if (args.includes('--shots') && tag !== 'narrow') { mkdirSync(SHOTS, { recursive: true }); await M.screenshot({ path: join(SHOTS, `phone-${tag}-bubble.png`) }); }
    await click(M, '.obub-main');
    R.expect(`phone ${tag}: tap opens the chat as a half sheet, the board stays visible above it`, await until(M, () => { const c = document.querySelector('.ochat'); return !c.hidden && c.classList.contains('ochs') && c.parentElement.id === 'hud' && !document.querySelector('.psheet.open'); }));
    const geo = await ev(M, () => { const r = document.querySelector('.ochat').getBoundingClientRect(); return { top: r.top, h: r.height, vh: innerHeight, bottom: r.bottom, xh: document.querySelector('.ochat-x').getBoundingClientRect().height, sh: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    R.expect(`phone ${tag}: the sheet takes at most 60 % of the height`, geo.h <= geo.vh * 0.6 + 1 && geo.top >= geo.vh * 0.38 && geo.xh >= 43.5 && geo.sh <= geo.cw, JSON.stringify(geo));
    R.expect(`phone ${tag}: opening it counts as reading`, await until(M, () => !document.querySelector('.tb[data-act=online]').dataset.n && !Object.keys(window.__chessOnline.state.unread).length));
    await sleep(450);
    await ev(M, () => window.__chessOnline.viewport(280, innerHeight - 280));   // the keyboard, simulated
    const kb = await ev(M, () => { const r = document.querySelector('.ochat').getBoundingClientRect(); return { bottom: r.bottom, vh: innerHeight, h: r.height }; });
    R.expect(`phone ${tag}: with the keyboard the sheet sits on top of it`, Math.abs(kb.bottom - (kb.vh - 280)) < 2 && kb.h <= (kb.vh - 280) * 0.65, JSON.stringify(kb));
    if (args.includes('--shots') && tag !== 'narrow') { await M.screenshot({ path: join(SHOTS, `phone-${tag}-sheet-keyboard.png`) }); }
    await ev(M, () => window.__chessOnline.viewport(0, innerHeight));
    if (args.includes('--shots') && tag !== 'narrow') await M.screenshot({ path: join(SHOTS, `phone-${tag}-sheet.png`) });
    await click(M, '.ochat-x');
    R.expect(`phone ${tag}: x closes the sheet`, await until(M, () => document.querySelector('.ochat').hidden));
    // the player rows: no horizontal scroll, the Chat buttons 44 px
    await click(M, '.tb[data-act=online]');
    await until(M, () => document.querySelector('.psheet.ponline')?.classList.contains('open'));
    const rows = await ev(M, () => { const sh = document.querySelector('.psheet-body') && document.querySelector('.ponline .psheet-body'); return { rows: [...document.querySelectorAll('.ponline .op')].map((r) => { const b = r.querySelector('.ochatbtn').getBoundingClientRect(), rr = r.getBoundingClientRect(), n = r.querySelector('.oname').getBoundingClientRect(), sc = r.querySelector('.oscore').getBoundingClientRect(), b2 = r.querySelectorAll('.oacts2 .obtn')[1].getBoundingClientRect(); return { bh: b.height, bw: b.width, out: rr.right > innerWidth + 0.5, sameLine: n.bottom <= sc.top + 1 && Math.abs(b.width - b2.width) < 1 && Math.abs(b.top - b2.top) < 1 && b2.height >= 43.5, left: Math.round(b.left) }; }), over: sh ? sh.scrollWidth > sh.clientWidth : false }; });
    R.expect(`phone ${tag}: player cards: Chat and the second button equal and side by side on every card, 44 px, name above score, no horizontal scroll`, rows.rows.length >= 2 && rows.rows.every((r) => r.bh >= 43.5 && r.bw >= 43.5 && !r.out && r.sameLine && r.left === rows.rows[0].left) && !rows.over, JSON.stringify(rows));
    if (args.includes('--shots')) await M.screenshot({ path: join(SHOTS, `phone-${tag}-rows.png`) });
    await click(A, '[data-a=chat-close]');
    await M.close();
  }

  // ------------------------------------------------------------ the running game (CHE-282): bubble on open, the game line, "has moved", two bubbles
  await click(A, '[data-a=challenge][data-n="Mia"]');
  await until(B, () => !!document.querySelector('[data-a=accept]'));
  await click(B, '[data-a=accept]');
  R.expect('a second game: both boards attached', await both((x) => window.__chessOnline.state.game?.status === 'active' && window.__chessOnline.match.attached && window.__chessOnline.state.game.moves.length === 0));
  const colA2 = await ev(A, () => window.__chessOnline.state.game.color);
  const X = colA2 === 'w' ? A : B, Y = colA2 === 'w' ? B : A;
  const nX = X === A ? 'Felix' : 'Mia', nY = X === A ? 'Mia' : 'Felix';
  const gtxt = (page) => ev(page, () => document.querySelector('.obub[data-k=game] .obub-main').textContent);
  // the opponent moves while Y plays a computer game on the board: a bubble, nothing interrupted, the dot stays
  await ev(Y, () => { window.__chess.game.newGame(); });
  R.expect('Y leaves the online game on the board (a local game)', await until(Y, () => !window.__chessOnline.match.attached));
  await moveOn(X, 'e2e4');
  R.expect('the opponent moved: bubble "<name> hat gezogen: Du bist am Zug ›"', await until(Y, (n) => !document.querySelector('.obub[data-k=game]').hidden && document.querySelector('.obub[data-k=game] .obub-main').textContent === `♟ ${n} hat gezogen: Du bist am Zug ›`, nX), await gtxt(Y));
  R.expect('nothing is interrupted: the local board is untouched, the tab shows 1 game to move', (await boardMoves(Y)) === 0 && await ev(Y, () => document.querySelector('#tab-online').dataset.n === '1'));
  await click(Y, '.obub[data-k=game] .obub-main');
  R.expect('tap on the bubble attaches the game (the move is on the board)', await until(Y, () => window.__chessOnline.match.attached && window.__chess.game.getState().moves.length === 1 && document.querySelector('.obub[data-k=game]').hidden));
  R.expect('the Context line names the opponent while attached', await until(Y, (n) => window.__line().startsWith(`Online gegen ${n} · `), nX), await ev(Y, () => window.__line()));
  // a lesson: the game is not attached, a tap sets the board to play and attaches
  await ev(X, () => window.__chess.game.setMode('explain'));
  R.expect('X is in a lesson: the game left the board', await until(X, () => !window.__chessOnline.match.attached && window.__chess.game.mode === 'explain'));
  R.expect('the Context line is not "Online" off the board', await ev(X, () => !window.__line().startsWith('Online gegen')), await ev(X, () => window.__line()));
  await moveOn(Y, 'e7e5');
  R.expect('in a lesson the opponent moved: bubble', await until(X, (n) => document.querySelector('.obub[data-k=game] .obub-main')?.textContent === `♟ ${n} hat gezogen: Du bist am Zug ›`, nY));
  await click(X, '.obub[data-k=game] .obub-main');
  R.expect('tap in a lesson asks first (CHE-403), the lesson stays', await until(X, () => !document.querySelector('.oask').hidden && /Lektion abbrechen und zur Partie/.test(document.querySelector('.oask').textContent)) && await ev(X, () => !window.__chessOnline.match.attached));
  await click(X, '.oask [data-a=ask-yes]');
  R.expect('tap in a lesson attaches the game (play mode again, both moves)', await until(X, () => window.__chessOnline.match.attached && window.__chess.game.mode === 'play' && window.__chess.game.getState().moves.length === 2));
  // on open: the game attaches by itself and a bubble says whose move; with a chat message the two stack, game on top
  await click(X, `[data-a=chat][data-n="${nY}"]`);
  await typeTo(X, 'Stapel');
  await until(Y, () => !!window.__chessOnline.state.unread && Object.keys(window.__chessOnline.state.unread).length === 1);
  const urlOf = (page) => (page === A ? `${BASE}/?${Q}&${flag}` : `${BASE_B}/?${Q}&${flag}`);
  await Y.close();
  const Y2 = await open(Y === A ? ctxA : ctxB, urlOf(Y));
  R.expect('on open: the game is on the board by itself', await until(Y2, () => window.__chessOnline.match?.attached && window.__chess.game.getState().moves.length === 2));
  R.expect('on open: bubble "Partie gegen <name>: <name> ist am Zug"', await until(Y2, (n) => document.querySelector('.obub[data-k=game] .obub-main')?.textContent === `♟ Partie gegen ${n}: ${n} ist am Zug ›`, nX), await gtxt(Y2));
  R.expect('two bubbles stacked: game on top, chat summary below', await until(Y2, () => !document.querySelector('.obub[data-k=chat]').hidden) && await ev(Y2, () => { const g = document.querySelector('.obub[data-k=game]').getBoundingClientRect(), c = document.querySelector('.obub[data-k=chat]').getBoundingClientRect(); return g.top < c.top && g.bottom <= c.top + 1; }));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await Y2.screenshot({ path: join(SHOTS, 'desktop-two-bubbles.png') }); }
  await click(Y2, '.obub[data-k=game] .obub-x');
  R.expect('x on the game bubble leaves the chat bubble', await ev(Y2, () => document.querySelector('.obub[data-k=game]').hidden && !document.querySelector('.obub[data-k=chat]').hidden));
  await Y2.close();
  const Y3 = await open(Y === A ? ctxA : ctxB, urlOf(Y) , PHONE);
  await until(Y3, () => !document.querySelector('.obub[data-k=game]').hidden && !document.querySelector('.obub[data-k=chat]').hidden);
  R.expect('phone 390: the pill, game bubble and chat bubble fit, nothing overlaps, targets 44 px', await ev(Y3, () => { const r = (s) => document.querySelector(s).getBoundingClientRect(), l = r('.pstatus'), g = r('.obub[data-k=game]'), c = r('.obub[data-k=chat]'); return l.bottom <= g.top + 1 && g.bottom <= c.top + 1 && g.left >= 0 && g.right <= innerWidth && l.right <= innerWidth && g.height >= 43.5 && c.height >= 43.5; }));
  if (args.includes('--shots')) await Y3.screenshot({ path: join(SHOTS, 'phone-two-bubbles.png') });
  await click(Y3, '.obub[data-k=chat] .obub-main');
  R.expect('tap on the chat bubble opens the chat, the game bubble stays', await until(Y3, () => !document.querySelector('.ochat').hidden && !document.querySelector('.obub[data-k=game]').hidden));
  await Y3.close();

  // ------------------------------------------------------------ CHE-301 looks on the fake fixture (?onlinepv): waiting line, floating chat, collapsed chat, phone
  const PVQ = `${Q}&online=http%3A%2F%2Fpreview.invalid&onlinepv=`;
  const D1 = await open(ctxA, `${BASE}/?${PVQ}wait&open=online`, WIDE);
  R.expect('waiting is a line in the card of Nina (Herausgefordert, wartet...) with Zurückziehen, no banner on top', await until(D1, () => /Herausgefordert, wartet/.test(document.querySelector('.opc:has([data-n="Nina"]) .ostate.asked')?.textContent || '') && [...document.querySelectorAll('.opc [data-a=cancel-out]')].length === 1 && document.querySelector('.opc [data-a=cancel-out]')?.textContent === 'Zurückziehen' && !document.querySelector('.owait') && !document.querySelector('.ochal .odots')));
  await click(D1, '[data-a=cancel-out]');
  R.expect('Zurückziehen takes the status away and gives the gold button back', await until(D1, () => !document.querySelector('.ostate.asked') && /Herausfordern/.test([...document.querySelectorAll('.opc')].find((r) => r.textContent.includes('Nina'))?.querySelector('.oacts2 .obtn.gold')?.textContent || '')));
  R.expect('every card: score or noch keine Partie beendet, Chat and Herausfordern in two equal columns', await ev(D1, () => [...document.querySelectorAll('.op')].every((r) => { const a = r.querySelectorAll('.oacts2 .obtn'), sc = r.querySelector('.oscore').textContent; return a.length === 2 && Math.abs(a[0].getBoundingClientRect().width - a[1].getBoundingClientRect().width) < 1 && (/^\d+ : \d+/.test(sc) || sc === 'noch keine Partie beendet'); })));
  await click(D1, '[data-a=chat][data-n="Nina"]');
  R.expect('desktop: the chat floats at the bottom right over the board with the switcher and the eye', await until(D1, () => { const c = document.querySelector('.ochat').getBoundingClientRect(); return !document.querySelector('.ochat').hidden && c.bottom > innerHeight - 40 && c.right < innerWidth - 300 && document.querySelectorAll('.oswitch .osw').length === 4 && !!document.querySelector('.omon svg'); }));
  R.expect('the switcher shows an unread dot for Felix', await ev(D1, () => !!document.querySelector('.osw[data-n="Felix"] .oud')));
  await click(D1, '[data-a=chat-min]');
  R.expect('minimise turns the window into the pill with the name', await until(D1, () => document.querySelector('.ochat').hidden && !document.querySelector('.ochpill').hidden && /Nina/.test(document.querySelector('.ochpill').textContent)));
  await click(D1, '.ochpill');
  R.expect('the pill expands the chat again', await until(D1, () => !document.querySelector('.ochat').hidden && document.querySelector('.ochpill').hidden));
  await D1.close();
  const D2 = await open(ctxA, `${BASE}/?${PVQ}min&open=online`, PHONE);
  await settleUi(D2);
  R.expect('phone: the pill hides while the Online sheet is open, so it never covers a card button', await until(D2, () => document.querySelector('.psheet.ponline')?.classList.contains('open') && getComputedStyle(document.querySelector('.ochpill')).display === 'none'));
  await click(D2, '[data-a=chat][data-n="Mia"]');
  await settleUi(D2);
  R.expect('phone: opening a chat closes the Online sheet, the chat is a half sheet', await until(D2, () => !document.querySelector('.psheet.ponline')?.classList.contains('open') && !document.querySelector('.ochat').hidden && /Mia/.test(document.querySelector('.osw.on')?.textContent || '')));
  await click(D2, '[data-a=chat-min]');
  R.expect('phone: the pill sits above the bar, inside the screen', await until(D2, () => { const r = document.querySelector('.ochpill').getBoundingClientRect(), b = document.querySelector('nav.pbar').getBoundingClientRect(); return r.width > 0 && r.bottom <= b.top + 1 && r.right <= innerWidth && r.left >= 0; }));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await D2.screenshot({ path: join(SHOTS, 'phone-pill.png') }); }
  await D2.close();

  // ------------------------------------------------------------ CHE-335 several games and challenges on the fake fixture (?onlinepv=multi)
  const M = await open(ctxA, `${BASE}/?${PVQ}multi&open=online`, WIDE);
  R.expect('multi: Nina has "Du bist dran" highlighted and Zur Partie', await until(M, () => { const c = [...document.querySelectorAll('.opc')].find((r) => r.querySelector('.oname')?.textContent === 'Nina'); return /Du bist dran/.test(c?.querySelector('.ostate.game.mine .oturn')?.textContent || '') && c.querySelector('.oacts2 .obtn.gold')?.textContent === 'Zur Partie'; }));
  R.expect('multi: Mia says "Mia ist dran" (not highlighted) and Zur Partie', await ev(M, () => { const c = [...document.querySelectorAll('.opc')].find((r) => r.querySelector('.oname')?.textContent === 'Mia'); return c.querySelector('.ostate.game .oturn')?.textContent === 'Mia ist dran' && !c.querySelector('.ostate.mine') && c.querySelector('.oacts2 .obtn.gold')?.textContent === 'Zur Partie'; }));
  R.expect('multi: Felix is challenged: status in the card and Zurückziehen, no banner', await ev(M, () => { const c = [...document.querySelectorAll('.opc')].find((r) => r.querySelector('.oname')?.textContent === 'Felix'); return /Herausgefordert, wartet/.test(c.querySelector('.ostate.asked')?.textContent || '') && c.querySelector('[data-a=cancel-out]')?.textContent === 'Zurückziehen' && !document.querySelector('.owait'); }));
  R.expect('multi: Opa challenges Boris: the card with Annehmen sits above the list', await ev(M, () => /Opa fordert dich heraus/.test(document.querySelector('.ochal .ocard')?.textContent || '') && !!document.querySelector('.ochal [data-a=accept]')));
  R.expect('multi: two running games and nothing attached: the board waits for Zur Partie', await ev(M, () => !window.__chessOnline.match.attached && !window.__line().startsWith('Online gegen')));
  R.expect('multi: the dot counts the unread messages (3) plus the games where it is your move (1)', await until(M, () => document.querySelector('#tab-online').dataset.n === '4'));
  await click(M, '.opc [data-a=board][data-id="11"]');
  R.expect('multi: Zur Partie on Nina puts that game on the board, the top row names her', await until(M, () => window.__chessOnline.match.attached && window.__chessOnline.match.game.id === 11 && window.__chess.game.getState().moves.length === 2 && /^Online gegen Nina/.test(window.__line())));
  await click(M, '.opc [data-a=board][data-id="12"]');
  R.expect('multi: Zur Partie on Mia switches, the top row names Mia, her one move is on the board', await until(M, () => window.__chessOnline.match.game.id === 12 && window.__chess.game.getState().moves.length === 1 && /^Online gegen Mia/.test(window.__line())));
  await ev(M, () => window.__chessOnline.api.sim((st) => { const g = st.games.find((x) => x.id === 11); g.moves.push('g1f3', 'b8c6'); g.sans.push('Nf3', 'Nc6'); }));
  R.expect('multi: a move in the other game never moves the board, it only shows in the bubble', await until(M, () => /Nina/.test(document.querySelector('.obub[data-k=game] .obub-main')?.textContent || '') && !document.querySelector('.obub[data-k=game]').hidden) && await ev(M, () => window.__chessOnline.match.game.id === 12 && window.__chess.game.getState().moves.length === 1 && /^Online gegen Mia/.test(window.__line())));
  await click(M, '.opc [data-a=cancel-out]');
  R.expect('multi: Zurückziehen on Felix removes the status', await until(M, () => !document.querySelector('.ostate.asked') && /Herausfordern/.test([...document.querySelectorAll('.opc')].find((r) => r.querySelector('.oname')?.textContent === 'Felix').querySelector('.oacts2 .obtn.gold')?.textContent || '')));
  await click(M, '.ochal [data-a=accept]');
  R.expect('multi: accepting Opa gives a third game and the board stays on Mia', await until(M, () => window.__chessOnline.state.games.filter((g) => g.status === 'active').length === 3 && window.__chessOnline.match.game.id === 12 && /^Online gegen Mia/.test(window.__line()) && [...document.querySelectorAll('.opc')].find((r) => r.querySelector('.oname')?.textContent === 'Opa').querySelector('.oacts2 .obtn.gold')?.textContent === 'Zur Partie'));
  R.expect('multi: the dot is unread (3) plus games where it is your move (Nina, Opa)', await until(M, () => document.querySelector('#tab-online').dataset.n === '5'));
  await click(M, '.opc [data-a=resign][data-id="12"]');
  R.expect('multi: Aufgeben asks in the card of that game only', await until(M, () => document.querySelectorAll('.oconfirm').length === 1 && [...document.querySelectorAll('.opc')].find((r) => r.querySelector('.oname')?.textContent === 'Mia').querySelector('.oconfirm') !== null));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await M.screenshot({ path: join(SHOTS, 'desktop-multi.png') }); }
  await M.close();
  // CHE-420: an attached online match has no chess clock, whatever ?clock= says; leaving the game gives the local clock back
  const MC = await open(ctxA, `${BASE}/?${PVQ}multi&open=online&manual=1&clock=3%2B2`, WIDE);
  R.expect('no clock online: before attaching the local 3+2 clock is on', await ev(MC, () => window.__chess.clock.state().enabled && !window.__chess.clock.state().suspended));
  await click(MC, '.opc [data-a=board][data-id="11"]');
  R.expect('no clock online: attached, the clock is suspended and the faces are hidden', await until(MC, () => window.__chessOnline.match.attached && window.__chess.clock.state().suspended) && await ev(MC, () => { return ![...document.querySelectorAll('.cface')].some((f) => f.offsetWidth > 0); }));
  await ev(MC, () => { window.__chess.step(10); });
  R.expect('no clock online: step(10) does not tick', await ev(MC, () => { const c = window.__chess.clock; return c.remaining('w') === 180 && c.remaining('b') === 180 && !c.state().running; }));
  await ev(MC, () => window.__chess.game.newGame());
  R.expect('no clock online: a new local game gives the local clock back', await until(MC, () => !window.__chessOnline.match.attached && !window.__chess.clock.state().suspended && window.__chess.clock.state().enabled));
  await MC.close();
  const MP = await open(ctxA, `${BASE}/?${PVQ}multi&open=online`, PHONE);
  await settleUi(MP);
  R.expect('multi phone 390: every button in the cards is at least 44 px, nothing overflows', await until(MP, () => document.querySelectorAll('.opc .ostate').length === 3) && await ev(MP, () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && [...document.querySelectorAll('.opc .obtn:not([disabled]), .ochal .obtn')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 43.5 && r.right <= innerWidth + 1; })));
  if (args.includes('--shots')) await MP.screenshot({ path: join(SHOTS, 'phone-multi.png') });
  await MP.close();

  // ------------------------------------------------------------ CHE-272 push card and bell on the fake PushManager (no permission prompt, no server)
  const P1 = await open(ctxA, `${BASE}/?${PVQ}pushcard&open=online`, PHONE);
  await settleUi(P1);
  R.expect('push: the card "Soll ich dir Bescheid sagen" shows, the bell is off', await until(P1, () => !document.querySelector('.opushcard').hidden && /Bescheid sagen/.test(document.querySelector('.opushcard').textContent) && document.querySelector('.obell')?.dataset.s === 'off'));
  R.expect('push: card buttons and bell are at least 44 px', await ev(P1, () => [...document.querySelectorAll('.opushcard .obtn'), document.querySelector('.obell')].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await P1.screenshot({ path: join(SHOTS, 'phone-pushcard.png') }); }
  await click(P1, '[data-a=push-yes]');
  R.expect('push: Ja subscribes through the fake PushManager, the card goes, the bell is on', await until(P1, () => document.querySelector('.opushcard').hidden && document.querySelector('.obell')?.dataset.s === 'on' && window.__chessOnline.push.state() === 'on'));
  await click(P1, '[data-a=bell]');
  R.expect('push: the bell switches pushes off', await until(P1, () => document.querySelector('.obell')?.dataset.s === 'off' && window.__chessOnline.push.state() === 'off'));
  await P1.close();
  const P2 = await open(ctxA, `${BASE}/?${PVQ}bell&open=online`, WIDE);
  R.expect('push: the bell scene starts on, no card', await until(P2, () => document.querySelector('.obell')?.dataset.s === 'on' && document.querySelector('.opushcard').hidden));
  await P2.close();
  // ------------------------------------------------------------ CHE-290 player card on the fake fixture (?onlinepv=stats|card)
  const overflowFree = (page) => ev(page, () => { const w = document.documentElement.clientWidth; return document.documentElement.scrollWidth <= w + 1 && [...document.querySelectorAll('.ostat, .opd')].filter((e) => e.getClientRects().length).every((e) => { const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= w + 0.5 && e.scrollWidth <= e.clientWidth + 1; }); });
  for (const [tag, size] of [['phone 360', [360, 740, true]], ['phone 390', PHONE], ['desktop', DESK]]) {
    const S = await open(ctxA, `${BASE}/?${PVQ}stats&open=online`, size);
    R.expect(`${tag}: your numbers at the top (games, wins, losses, draws, streak), above the players`, await until(S, () => { const o = document.querySelector('.ostat.own'); return o && !o.hidden && o.querySelectorAll('.ostc').length === 5 && o.querySelector('.ostc.games b').textContent === '14' && o.querySelector('.ostc.wins b').textContent === '8' && /3 Siege in Folge/.test(o.querySelector('.ostc.streak').textContent) && o.getBoundingClientRect().bottom <= document.querySelector('.oplayers').getBoundingClientRect().top; }));
    R.expect(`${tag}: your numbers fit, no overflow`, await overflowFree(S));
    await click(S, '.opc [data-a=stats][data-n="Nina"].oav');
    await new Promise((r) => setTimeout(r, 500));   // the sheet slides in
    R.expect(`${tag}: tapping the avatar opens Nina's card with the numbers, the bar, the head to head and the openings`, await until(S, () => { const d = document.querySelector('.opd'); return d && !d.hidden && /Nina/.test(d.querySelector('.opd-name').textContent) && d.querySelectorAll('.ostats4 .ostc').length === 4 && !!d.querySelector('.obar') && /Du 3 : 2 Nina/.test(d.querySelector('.oh2h b').textContent) && /Italian Game/.test(d.textContent) && /2 Niederlagen in Folge/.test(d.textContent) && /27 Züge/.test(d.textContent) && /13 Min\./.test(d.textContent); }));
    R.expect(`${tag}: the card fits, no layout overflow, close button at least 44 px`, await overflowFree(S) && await ev(S, () => { const x = document.querySelector('.opd-x').getBoundingClientRect(), d = document.querySelector('.opd').getBoundingClientRect(); return x.width >= 43.5 && x.height >= 43.5 && d.bottom <= innerHeight + 1 && d.top >= 0; }));
    if (size === PHONE) R.expect('phone: the card is a sheet over the sheet and sits above the bar', await ev(S, () => { const d = document.querySelector('.opd').getBoundingClientRect(), b = document.querySelector('nav.pbar').getBoundingClientRect(); return getComputedStyle(document.querySelector('.opd')).position === 'fixed' && d.bottom <= b.top + 1; }));
    if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await S.screenshot({ path: join(SHOTS, `stats-card-${tag.replace(' ', '-')}.png`) }); }
    await click(S, '.opd-x');
    R.expect(`${tag}: the close button closes the card`, await until(S, () => document.querySelector('.opd').hidden));
    await click(S, '.opc [data-a=stats][data-n="Felix"].obody');
    R.expect(`${tag}: tapping the name opens Felix's card (draw streak, no game against you yet)`, await until(S, () => /Felix/.test(document.querySelector('.opd-name').textContent) && /Noch nie gegeneinander gespielt/.test(document.querySelector('.oh2h').textContent) && /1 Remis/.test(document.querySelector('.opd').textContent) && /<1 Min|< ?1|<1/.test(document.querySelector('.opd').textContent)));
    await click(S, '.ostat.own');
    R.expect(`${tag}: your own card has no head to head`, await until(S, () => /Deine Zahlen/.test(document.querySelector('.opd-name').textContent) && !document.querySelector('.oh2h')));
    await click(S, '.opc [data-a=stats][data-n="Maximiliane-Charlotte"].obody');
    R.expect(`${tag}: a long name and zero games: "noch keine Partie beendet", fits`, await until(S, () => /noch keine Partie beendet/.test(document.querySelector('.opd').textContent) && /Maximiliane-Charlotte/.test(document.querySelector('.opd-name').textContent)) && await overflowFree(S));
    if (args.includes('--shots') && size === PHONE) await S.screenshot({ path: join(SHOTS, 'stats-card-phone-long-name-zero.png') });
    await S.close();
  }
  const SC = await open(ctxA, `${BASE}/?${PVQ}card&open=online`, PHONE);
  R.expect('onlinepv=card opens the detail card of Nina at once', await until(SC, () => !document.querySelector('.opd').hidden && /Nina/.test(document.querySelector('.opd-name').textContent) && !!document.querySelector('.obar')));
  R.expect('phone: the card hides with the Online sheet, so it never covers the board or bubbles', await (async () => { await ev(SC, () => document.querySelector('.psheet.ponline')?.classList.remove('open')); return until(SC, () => getComputedStyle(document.querySelector('.opd')).display === 'none'); })());
  await SC.close();
  const SD = await open(ctxA, `${BASE}/?${PVQ}card&open=online`, WIDE);
  R.expect('desktop: the card is a section in the panel (not fixed)', await until(SD, () => { const d = document.querySelector('.opd'); return !d.hidden && getComputedStyle(d).position !== 'fixed' && !!d.closest('#online-host'); }));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await SD.screenshot({ path: join(SHOTS, 'stats-card-desktop-wide.png') }); }
  await SD.close();
  // the real route: Mia and Felix have no finished game here yet, so the real card shows "noch keine Partie beendet"; the route is the contract
  const SR = await open(ctxA, `${BASE}/?${Q}&${flag}&open=online`, DESK);
  await until(SR, () => window.__chessOnline?.status === 'connected');
  R.expect('real server: your own numbers load, the card of another player opens', await (async () => { await until(SR, () => !document.querySelector('.ostat.own')?.hidden); await ev(SR, () => window.__chessOnline.openStats(window.__chessOnline.state.players[0].name)); return until(SR, () => !document.querySelector('.opd').hidden && !!document.querySelector('.opd .ostx, .opd .ostats4')); })());
  await SR.close();

  if (args.includes('--shots')) {
    mkdirSync(SHOTS, { recursive: true });
    for (const theme of ['classic', 'pixel']) {
      for (const [tag, size] of [['phone-portrait', PHONE], ['phone-landscape', LAND], ['desktop', WIDE]]) {
        const S = await open(ctxB, `${BASE_B}/?${Q}&${flag}&open=online&theme=${theme}`, size);
        await until(S, () => window.__chessOnline?.status === 'connected');
        await ev(S, () => document.querySelector('[data-a=chat][data-n="Felix"]')?.click());
        await settleUi(S);
        await S.screenshot({ path: join(SHOTS, `${tag}-${theme}.png`) });
        await S.close();
      }
    }
    R.pass('screenshots', SHOTS);
  }

  // ------------------------------------------------------------ CHE-343 the bot: a second server with ONLINE_BOT=1 and its own database
  await stopOnline();
  for (const f of [DB, DB + '-wal', DB + '-shm']) rmSync(f, { force: true });
  online = await startOnline({ ONLINE_BOT: '1' });
  process.env.ONLINE_DB = DB;
  const fb = runAdmin(['invite', 'Felix'], quiet), mb = runAdmin(['invite', 'Mia'], quiet);
  runAdmin(['admin', 'Felix'], quiet);
  const botLink = (key) => inviteLink({ game: `${BASE}/?${Q}`, server: SERVER, key });
  const ctxF = await browser.createBrowserContext(), ctxM = await browser.createBrowserContext();
  const F = await open(ctxF, botLink(fb.key));
  R.expect('bot: connected, and the Bot card is listed, marked Bot, online', await until(F, () => window.__chessOnline?.status === 'connected' && !!document.querySelector('.op .obot')) && (await ev(F, () => document.querySelector('.op .obot').textContent.trim())) === 'Bot' && await ev(F, () => !!document.querySelector('.op .oname .obot') && !!document.querySelector('.op .pres.on')));
  R.expect('bot admin: Felix (admin) has the button "Bot fordert mich heraus"', await shown(F, '[data-a=bot-challenge]'));
  await click(F, '[data-a=bot-challenge]');
  R.expect('bot admin: the bot challenge arrives (Annehmen) and a push-less open challenge is listed', await until(F, () => !!document.querySelector('.ochal [data-a=accept]') && /Bot fordert dich heraus/.test(document.querySelector('.ochal')?.textContent || '')));
  await click(F, '[data-a=accept]');
  R.expect('bot admin: accepted, the game against Bot is on the board', await until(F, () => window.__chessOnline?.match?.attached && window.__chessOnline.state.game?.status === 'active' && window.__chessOnline.state.game.opponent === 'Bot'));
  const fc = await ev(F, () => window.__chessOnline.state.game.color);
  const tBot = Date.now();
  if (fc === 'w') await moveOn(F, 'e2e4');
  R.expect('bot play: the bot answers with a move within 2 to 6 s', await until(F, () => window.__chessOnline.state.game.moves.length === (window.__chessOnline.state.game.color === 'w' ? 2 : 1), null, 12000), `${Date.now() - tBot} ms`);
  const dt = Date.now() - tBot;
  R.expect('bot play: the move did not come at once (2 s delay at least, 1.5 s with slack)', dt >= 1500, `${dt} ms`);
  R.expect('bot play: board and server agree', await until(F, () => window.__chess.game.getState().moves.length === window.__chessOnline.state.game.moves.length && !window.__chess.game.busy, null, 5000));
  if (fc === 'b') { await moveOn(F, 'e7e5'); }
  else await moveOn(F, 'g1f3');
  R.expect('bot play: after the second human move the bot moves again', await until(F, () => window.__chessOnline.state.game.moves.length === (window.__chessOnline.state.game.color === 'w' ? 4 : 3), null, 12000));
  await click(F, '[data-a=chat][data-n="Bot"]');
  await ev(F, () => { const i = document.querySelector('.osend input'); i.value = 'Hallo Bot'; document.querySelector('.osend').requestSubmit(); });
  R.expect('bot chat: a canned German line comes back', await until(F, () => [...document.querySelectorAll('.omsgs li:not(.mine) span')].some((x) => x.textContent.length > 3), null, 9000));
  await ev(F, () => document.querySelector('[data-a=resign]')?.click());
  await ev(F, () => document.querySelector('[data-a=resign-yes]')?.click());
  const PM = await open(ctxM, botLink(mb.key));
  R.expect('bot: a normal player has the Bot card but no admin button', await until(PM, () => !!document.querySelector('.op .obot')) && !(await ev(PM, () => !!document.querySelector('[data-a=bot-challenge]'))));
  await click(PM, '[data-a=challenge][data-n="Bot"]');
  R.expect('bot challenge by a player: accepted at once, no human involved', await until(PM, () => window.__chessOnline?.state?.games?.some((g) => g.opponent === 'Bot' && g.status === 'active'), null, 8000));
  await F.close(); await PM.close();

  // ------------------------------------------------------------ CHE-405 a server from before the games list: no /version (404 = API 0), /state without games
  // The Online tab says Server update instead of the (empty) cards; when the server is replaced (here: /version answers) the next reconnect shows the cards again.
  const OLD_PORT = SPORT + 1, OLD = `http://127.0.0.1:${OLD_PORT}`;
  if (await portAnswers(OLD_PORT)) throw new Error(`the stub server port ${OLD_PORT} is in use`);
  let upgraded = false; const streams = new Set();
  const oldState = () => ({ now: Date.now(), me: { name: 'Felix', muted: false, admin: false }, players: [{ name: 'Nina', online: true, playing: false, withMe: false, unread: 0, score: null }], challenges: { in: [], out: [] }, chats: {}, unread: {}, game: null, ...(upgraded ? { games: [] } : {}) });
  const stub = createServer((req, res) => {
    const h = { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Cache-Control': 'no-store' };
    const path = new URL(req.url, 'http://x').pathname;
    if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
    if (path === '/version' && upgraded) { res.writeHead(200, { ...h, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ api: 1, minClient: 1, commit: 'stub' })); }
    if (path === '/events') { res.writeHead(200, { ...h, 'Content-Type': 'text/event-stream' }); res.write(`event: state\ndata: ${JSON.stringify(oldState())}\n\n`); streams.add(res); res.on('close', () => streams.delete(res)); return; }
    res.writeHead(404, h); res.end();
  });
  await new Promise((ok) => stub.listen(OLD_PORT, '127.0.0.1', ok));
  try {
    const ctxO = await browser.createBrowserContext();
    const O = await open(ctxO, inviteLink({ game: `${BASE}/?${Q}&touch=1`, server: OLD, key: 'OldServerStubKey0123456789abcdef' }), PHONE);
    const oldOk = await until(O, () => window.__chessOnline?.status === 'connected' && window.__chessOnline.apiVerdict === 'server-old');
    R.expect('old server: connected, /version missing reads as API 0', oldOk, oldOk ? '' : JSON.stringify(await ev(O, () => ({ s: window.__chessOnline?.status, v: window.__chessOnline?.apiVerdict, login: window.__chessOnline?.login, href: location.href.slice(0, 120) }))));
    R.expect('old server: the Online tab says Der Server wird gerade aktualisiert, no cards, no player list', await ev(O, () => { const u = document.querySelector('.oupdate'); return !u.hidden && u.textContent.trim() === 'Der Server wird gerade aktualisiert. Deine Partien sind sicher, bitte später nochmal schauen.' && document.querySelector('.omain').hidden; }));
    if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await settleUi(O); await O.screenshot({ path: join(SHOTS, 'phone-server-update.png') }); }
    upgraded = true;
    for (const r of streams) r.end();   // the server restarts: the stream drops, the client reconnects and reads /version again
    R.expect('server replaced: after the reconnect the line goes and the cards come back', await until(O, () => window.__chessOnline.apiVerdict === 'ok' && document.querySelector('.oupdate').hidden && !document.querySelector('.omain').hidden, undefined, 30000));
    await O.close();
  } finally { for (const r of streams) r.end(); stub.close(); }
} catch (e) {
  R.fail('online run', String(e && e.stack || e).slice(0, 400));
}
await finish();
