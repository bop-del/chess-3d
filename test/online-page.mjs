// Online play in the real page (CHE-271, smoke group `online`): node test/online-page.mjs [--base=<server>] [--skip-build] [--shots]
// Starts the online server (server/index.mjs) with a fresh database on the lane's server port (dev port + 200), invites Felix and
// Mia, and drives two players in TWO browser contexts of ONE launchBrowser() Chrome (also on two origins, 127.0.0.1 and localhost,
// so the two logins are apart twice over): Felix logs in by link, Mia by code, challenge, accept, three moves each side,
// one chat message each way, the connection lost mid game (grey, red after 10 s, the Details box, the locked board) and back
// (green, unlocked, the move goes through), resign, both see the result and the new score. Also: without ?online= there is no Online
// tab; with it and no invite the sentence and the code field show; the 7 button phone bar keeps 44 px targets. Music and sound off
// (?sound=0). The server is stopped in finally. --shots writes the Online tab at 390 px portrait, a landscape phone and 1440 px desktop,
// in the Classic and the Pixelwelt look, to .tmp/online-shots.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { spawn } from 'node:child_process';
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

let ctxA = null, ctxB = null;
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
  R.expect('no invite: no request button, no connection line', !(await shown(B, '.oconn')) && (await ev(B, () => document.querySelectorAll('.ologin button').length)) === 1);

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
  R.expect('score: a dash before the first game', (await ev(A, () => document.querySelector('.op .oscore')?.textContent)) === '-');

  // ------------------------------------------------------------ challenge, accept
  await click(A, '[data-a=challenge][data-n="Mia"]');
  R.expect('the challenge reaches Mia with a dot on her tab', await until(B, () => !!document.querySelector('[data-a=accept]') && document.querySelector('#tab-online').classList.contains('odot')));
  R.expect('Felix waits', await until(A, () => /Warte auf Mia/.test(document.querySelector('.ochal')?.textContent || '')));
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
  R.expect('the chat says it is monitored', (await ev(A, () => document.querySelector('.omon').textContent)) === 'Chat wird mitgelesen' && await shown(A, '.omon'));
  R.expect('Mia gets the message: unread dot at the name', await until(B, () => !!document.querySelector('.op .udot')));
  await click(B, '[data-a=chat][data-n="Felix"]');
  R.expect('Mia reads it', await until(B, () => /Hallo Mia/.test(document.querySelector('.omsgs')?.textContent || '')));
  R.expect('opening the chat clears the unread dot', await until(B, () => !document.querySelector('.op .udot') && !Object.keys(window.__chessOnline.state.unread).length));
  await ev(B, () => { const i = document.querySelector('.osend input'); i.value = 'Danke, dir auch'; document.querySelector('.osend').requestSubmit(); });
  R.expect('Felix gets the answer in the open chat', await until(A, () => /Danke, dir auch/.test(document.querySelector('.omsgs')?.textContent || '')));
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
} catch (e) {
  R.fail('online run', String(e && e.stack || e).slice(0, 400));
}
await finish();
