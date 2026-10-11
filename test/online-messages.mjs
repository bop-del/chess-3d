// Messages from "Chess 3D" in the real page (CHE-422, smoke group `online messages`): node test/online-messages.mjs [--skip-build] [--shots]
// The real server and real pages. Felix is logged in, Mia is not messaged. Part 1: no Chess 3D in the address book before its first
// message; Felix's Feedback (sent with his key) puts it on top with a badge and the "read" line, no online dot, no challenge button;
// its thread is read only (no input field, a hint instead), the quote stands grey above our line, an accepted and a shipped template
// render in German and, after the language switch, in English; opening the thread clears the badge. Part 2: the Feedback form shows
// "Melde dich an, dann können wir dir antworten." to a guest and not to a logged in player. Phone 390: nothing overflows, targets 44 px.
// --shots writes .tmp/online-shots/phone-messages-book.png and phone-messages-thread.png.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { reporter, launchBrowser, startServer, build, settleUi, claimPort, sleep, ROOT } from '../tools/_lib.mjs';
import { runAdmin, inviteLink } from '../server/admin.mjs';

const args = process.argv.slice(2);
const SHOTS = join(ROOT, '.tmp/online-shots'), OUT = '.tmp/online-dist';
const R = reporter();
const SECRET = 'smoke-admin-secret';
let SPORT = 0, SERVER = '', claim = null, sclaim = null;
const DB = join(ROOT, `.tmp/online/messages-${process.pid}.db`);
let server = null, browser = null, online = null;

function startOnline() {
  return new Promise((ok, bad) => {
    const c = spawn(process.execPath, [join(ROOT, 'server/index.mjs')], { cwd: ROOT, env: { ...process.env, ONLINE_PORT: String(SPORT), ONLINE_HOST: '127.0.0.1', ONLINE_DB: DB, ONLINE_ADMIN_SECRET: SECRET }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  console.log(`\nonline messages: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'ONLINE MESSAGES FAILED' : 'ONLINE MESSAGES OK');
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
const felix = runAdmin(['invite', 'Felix'], quiet), mia = runAdmin(['invite', 'Mia'], quiet);
const Q = 'quality=low&intro=0&sound=0&ai=0';
const DESK = [1280, 800, false], PHONE = [390, 844, true];
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const until = async (page, fn, arg, ms = 15000) => { try { await page.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch (e) { return false; } };
const click = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
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
const post = async (path, body, key) => { const r = await fetch(SERVER + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };

try {
  const ctx = await browser.createBrowserContext();
  const link = (inv, extra = '') => inviteLink({ game: `${BASE}/?${Q}${extra}`, server: SERVER, key: inv.key });
  const A = await open(ctx, link(felix, '&open=online'), DESK);
  await until(A, () => window.__chessOnline?.status === 'connected' && window.__chessOnline.state?.players.length === 1);
  R.expect('before the first message there is no Chess 3D in the address book', await ev(A, () => ![...document.querySelectorAll('.opc')].some((r) => /Chess 3D/.test(r.textContent)) && /Mia/.test(document.querySelector('.eab').textContent)));

  // Felix sends Feedback with his key (the way the form does), a long text to see the 80 character quote
  const text = 'Ich wünsche mir einen Modus, in dem man gegen die Zeit spielt und die Figuren sich verwandeln können.';
  const f = await post('/feedback', { kind: 'wish', text, device: 'dev-smoke-felix' }, felix.key);
  R.expect('Feedback with a key: 201', f.status === 201, JSON.stringify(f));
  R.expect('Chess 3D appears on top of the address book with a badge of 1', await until(A, () => { const r = document.querySelector('.eab .opc'); return !!r && /Chess 3D/.test(r.textContent) && r.querySelector('.ocnt')?.textContent === '1'; }), await ev(A, () => document.querySelector('.eab')?.textContent));
  R.expect('its row: own symbol, no online dot, no challenge button, no score', await ev(A, () => { const r = document.querySelector('.eab .opc'); return r.classList.contains('osysrow') && !!r.querySelector('.osysav') && !r.querySelector('.pres') && !r.querySelector('[data-a=challenge]') && !/online|nicht da|Spiel/.test(r.textContent); }));
  R.expect('the people strip does not list Chess 3D', await ev(A, () => ![...document.querySelectorAll('.ehead')].some((b) => /Chess 3D/.test(b.textContent))));
  R.expect('Mia stays below it', await ev(A, () => [...document.querySelectorAll('.eab .opc .oname')].map((n) => n.textContent).join() === 'Chess 3D,Mia'));
  await click(A, '.osysrow [data-a=chat]');
  R.expect('the thread opens with the read line, in German', await until(A, () => !document.querySelector('.ochat').hidden && /Danke! Wir haben deine Nachricht bekommen und lesen sie\./.test(document.querySelector('.omsgs').textContent)), await ev(A, () => document.querySelector('.omsgs')?.textContent));
  R.expect('the quote stands grey above it: "Du: " + the first 80 characters', await ev(A, (t) => { const q = document.querySelector('.omsgs .oquote'); return !!q && q.textContent === `Du: ${[...t].slice(0, 80).join('')}` && getComputedStyle(q).opacity !== '0'; }, text), await ev(A, () => document.querySelector('.omsgs .oquote')?.textContent));
  R.expect('read only: no input field, a line points to the Feedback button', await ev(A, () => document.querySelector('.osend').hidden && !document.querySelector('.osyshint').hidden && /Rückmeldung/.test(document.querySelector('.osyshint').textContent)), await ev(A, () => document.querySelector('.osyshint').textContent));
  R.expect('opening it clears the badge', await until(A, () => !(window.__chessOnline.state.unread['Chess 3D'] > 0)));

  // admin sends: accepted (by feedbackId), shipped (version), a free text
  const send = async (b) => { const r = await fetch(SERVER + '/admin/message', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` }, body: JSON.stringify(b) }); return r.status; };
  R.expect('admin: accepted and shipped by feedbackId, 200', (await send({ feedbackId: f.json.id, tpl: 'accepted' })) === 200 && (await send({ feedbackId: f.json.id, tpl: 'shipped', params: { v: '1.14.0' } })) === 200);
  R.expect('both lines show, the version in the text', await until(A, () => /Gute Idee! Das bauen wir ein\./.test(document.querySelector('.omsgs').textContent) && /Version 1\.14\.0\)\. Viel Spaß!/.test(document.querySelector('.omsgs').textContent)), await ev(A, () => document.querySelector('.omsgs')?.textContent));
  R.expect('three messages with a quote each', await ev(A, () => document.querySelectorAll('.omsgs li.osys').length === 3 && document.querySelectorAll('.omsgs .oquote').length === 3));
  R.expect('a message while the thread is open is read at once (no badge)', await until(A, () => !(window.__chessOnline.state.unread['Chess 3D'] > 0) && !document.querySelector('.opc .ocnt')));
  await click(A, '[data-a=chat-close]');
  R.expect('a challenge to Chess 3D does not exist: the server says 404', (await post('/challenge', { to: 'Chess 3D' }, felix.key)).status === 404);
  // English
  const E = await open(ctx, link(felix, '&open=online&lang=en'), DESK, 'en');
  await until(E, () => window.__chessOnline?.status === 'connected' && !!document.querySelector('.osysrow'));
  await click(E, '.osysrow [data-a=chat]');
  R.expect('in English the template lines are English, the quote says "You:"', await until(E, () => /Great idea! We will build it in\./.test(document.querySelector('.omsgs').textContent) && /Your idea is in the game now \(version 1\.14\.0\)/.test(document.querySelector('.omsgs').textContent) && /^You: /.test(document.querySelector('.omsgs .oquote').textContent)), await ev(E, () => document.querySelector('.omsgs')?.textContent));
  R.expect('English hint points to the Feedback button', await ev(E, () => /Feedback button/.test(document.querySelector('.osyshint').textContent)), await ev(E, () => document.querySelector('.osyshint').textContent));
  await E.close();

  // Part 2: the Feedback form
  const ctxG = await browser.createBrowserContext();   // a guest has its own storage: Felix's login is in the first context
  const G = await open(ctxG, `${BASE}/?${Q}&online=${encodeURIComponent(SERVER)}`, DESK);   // a guest: the server is known, there is no login
  R.expect('guest: the Feedback form says "Melde dich an, dann können wir dir antworten."', await openForm(G) && await ev(G, () => { const h = document.getElementById('fb-guest'); return !!h && !h.hidden && h.textContent === 'Melde dich an, dann können wir dir antworten.'; }), await ev(G, () => document.getElementById('fb-guest')?.outerHTML));
  await G.close();
  const L = await open(ctx, link(felix), DESK);
  R.expect('logged in: the hint is hidden', await openForm(L) && await ev(L, () => document.getElementById('fb-guest').hidden));
  await L.close();

  // phone 390: address book and thread, no overflow, 44 px targets, shots
  const P = await open(ctx, link(felix, '&open=online'), PHONE);
  await until(P, () => window.__chessOnline?.status === 'connected' && !!document.querySelector('.osysrow'));
  await settleUi(P);
  R.expect('phone 390: Chess 3D is pinned in the address book, nothing overflows, the chat button is 44 px', await ev(P, () => { const b = document.querySelector('.osysrow .ochatic').getBoundingClientRect(); return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && b.width >= 43.5 && b.height >= 43.5 && document.querySelector('.eab .opc .oname').textContent === 'Chess 3D'; }));
  if (args.includes('--shots')) { mkdirSync(SHOTS, { recursive: true }); await P.screenshot({ path: join(SHOTS, 'phone-messages-book.png') }); }
  await click(P, '.osysrow [data-a=chat]');
  await until(P, () => !document.querySelector('.ochat').hidden && document.querySelectorAll('.omsgs li.osys').length === 3);
  await settleUi(P);
  R.expect('phone 390: the read only thread fits, no input visible', await ev(P, () => { const c = document.querySelector('.ochat').getBoundingClientRect(); return c.right <= innerWidth + 1 && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && getComputedStyle(document.querySelector('.osend')).display === 'none'; }));
  if (args.includes('--shots')) await P.screenshot({ path: join(SHOTS, 'phone-messages-thread.png') });
  await P.close();
} catch (e) {
  R.fail('run', 'threw: ' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ').slice(0, 400));
}
await finish();

/** open the Feedback form the way a player does: the button of the desktop rail */
async function openForm(page) {
  await page.evaluate(() => { document.querySelector('#btn-feedback')?.click(); });
  try { await page.waitForFunction(() => { const o = document.querySelector('#feedback'); return !!o && !o.hidden; }, { timeout: 15000, polling: 100 }); return true; } catch (e) { return false; }
}
