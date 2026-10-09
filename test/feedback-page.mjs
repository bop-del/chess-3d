// The feedback bubble and dialog in the real page (CHE-404, smoke group `feedback`): node test/feedback-page.mjs [--skip-build] [--shots]
// Starts the online server in this process (fresh in memory database, admin secret) on the lane's dev port + 210, opens the game
// with ?online=<server> and NO login: the bubble is in the header (desktop panel and rail, phone beside the bulb, 44 px on a phone,
// clear of the status line and the bulb in portrait, landscape and short landscape), the dialog sends a bug with a board picture
// (a JPEG) and the context, a wish without the picture, shows a thank you toast, keeps the text and says so when the server is away,
// Escape closes it and game keys do not fire while typing. --shots writes the dialog at four sizes to .tmp/feedback-shots.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { reporter, launchBrowser, startServer, build, settleUi, lanePorts, ROOT } from '../tools/_lib.mjs';
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { contactSheets } from '../tools/contact-sheet.mjs';

const args = process.argv.slice(2);
const OUT = '.tmp/feedback-dist', SHOTS = join(ROOT, '.tmp/feedback-shots');
const SECRET = 'feedback-smoke-secret';
const R = reporter();
let server = null, browser = null, app = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  try { await app?.close(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nfeedback: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'FEEDBACK FAILED' : 'FEEDBACK OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

let SERVER = '';
try {
  app = createOnlineServer({ db: openDb(':memory:'), adminSecret: SECRET });
  const sport = await app.listen(lanePorts().dev + 210, '127.0.0.1');
  SERVER = `http://127.0.0.1:${sport}`;
  if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
  server = await startServer({ mode: 'preview', outDir: OUT });
  browser = await launchBrowser({ w: 1280, h: 720 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

const PHONE = ['phone portrait', 390, 844, true], SMALL = ['phone small', 320, 568, true], LAND = ['phone landscape', 844, 390, true], SHORT = ['phone short landscape', 667, 320, true], DESK = ['desktop', 1440, 900, false];
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const rect = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom, vis: getComputedStyle(e).display !== 'none' && r.width > 2 }; }, sel);
const overlap = (a, b) => a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
const items = async () => (await (await fetch(`${SERVER}/feedback`, { headers: { Authorization: `Bearer ${SECRET}` } })).json()).items;

async function load(page, [, w, h, phone], { lang = 'en', query = '' } = {}) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.evaluateOnNewDocument((l) => { try { localStorage.clear(); localStorage.setItem('chess3d.lang', l); localStorage.setItem('chess3d.newsSeen', '99.0.0'); } catch (e) { /* blocked */ } }, lang);
  await page.goto(`${server.base}?quality=low&ai=0&intro=0&online=${encodeURIComponent(SERVER)}${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await ev(page, () => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await settleUi(page);
}
const btnSel = (phone) => (phone ? '#btn-feedback-phone' : '#btn-feedback');

try {
  if (args.includes('--shots')) { rmSync(SHOTS, { recursive: true, force: true }); mkdirSync(SHOTS, { recursive: true }); }
  const page = await browser.newPage();
  page.on('pageerror', (e) => R.fail('page error', String(e).slice(0, 200)));

  for (const size of [PHONE, SMALL, LAND, SHORT, DESK]) {
    const [tag, , , phone] = size;
    await load(page, size);
    const b = await rect(page, btnSel(phone));
    R.expect(`${tag}: the bubble is in the header and visible`, b && b.vis && b.x >= 0 && b.r <= size[1] + 0.5 && b.y >= 0 && b.b <= size[2] + 0.5, 'visible', JSON.stringify(b));
    if (phone) {
      R.expect(`${tag}: the bubble is a 44 px target`, b.w >= 43.5 && b.h >= 43.5, '>= 44', `${b.w}x${b.h}`);
      const good = await rect(page, '.pgood'), st = await rect(page, '.pstatus');
      R.expect(`${tag}: it does not cover the bulb or the status line`, !overlap(b, good) && !overlap(b, st), 'clear', JSON.stringify({ b, good, st }));
      R.expect(`${tag}: the status line keeps room to read`, st.w >= 120, '>= 120', st.w);
    } else {
      R.expect(`${tag}: the bubble is at least 34 px`, b.w >= 33.5 && b.h >= 33.5, '>= 34', `${b.w}x${b.h}`);
      await ev(page, () => document.querySelector('#btn-rail').click());
      await settleUi(page);
      const rr = await rect(page, '#btn-feedback-rail');
      R.expect(`${tag}: folded to the rail the bubble stays`, rr && rr.vis, 'visible', JSON.stringify(rr));
      await ev(page, () => document.querySelector('#btn-rail-open').click());
      await settleUi(page);
    }
    // open
    await ev(page, (s) => document.querySelector(s).click(), btnSel(phone));
    await settleUi(page);
    const dlg = await ev(page, () => { const o = document.querySelector('#feedback'); if (!o || o.hidden) return null; const r = document.querySelector('#feedback .fbcard').getBoundingClientRect(); return { fits: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, focus: document.activeElement?.id, send: document.querySelector('#fb-send').getBoundingClientRect().height, kind: document.querySelector('.fbkind').getBoundingClientRect().height, title: document.querySelector('#fb-title').textContent }; });
    R.expect(`${tag}: a tap opens the dialog, it fits the screen, the text field has the focus`, dlg && dlg.fits && dlg.focus === 'fb-text', 'open', JSON.stringify(dlg));
    R.expect(`${tag}: send and kind buttons are 44 px`, dlg && dlg.send >= 43.5 && dlg.kind >= 43.5, '>= 44', JSON.stringify(dlg));
    if (args.includes('--shots')) await page.screenshot({ path: `${SHOTS}/feedback-${tag.replace(/ /g, '-')}.png` });
    await page.keyboard.press('Escape');
    R.expect(`${tag}: Escape closes the dialog`, await ev(page, () => document.querySelector('#feedback').hidden));
  }

  // ------------------------------------------------------------ sending, on the phone size
  await load(page, PHONE);
  const before = (await items()).length;
  await ev(page, () => document.querySelector('#btn-feedback-phone').click());
  await settleUi(page);
  await ev(page, () => document.querySelector('#fb-send').click());
  R.expect('an empty text is not sent and says so', (await ev(page, () => document.querySelector('#fb-msg').textContent)).length > 0 && (await items()).length === before);
  await page.type('#fb-text', 'n u h the knight is wrong');
  R.expect('game keys (N, U, H) do not fire while typing', await ev(page, () => !document.body.classList.contains('hidden') && document.querySelector('#hud') && !document.querySelector('#hud').classList.contains('hidden')) && (await ev(page, () => document.querySelector('#fb-text').value)) === 'n u h the knight is wrong');
  await page.type('#fb-name', 'Mia');
  await ev(page, () => document.querySelector('#fb-send').click());
  await page.waitForFunction(() => document.querySelector('#feedback').hidden, { timeout: 15000 });
  const toast = await ev(page, () => document.getElementById('toast').textContent + '|' + document.getElementById('toast').className);
  R.expect('after sending: the dialog closes and the thank you toast shows', /Thank you/.test(toast) && /show/.test(toast), 'Thank you', toast);
  const got = await items();
  const one = got[got.length - 1];
  R.expect('the server holds one more item: a bug with the text and the name', got.length === before + 1 && one.kind === 'bug' && one.text === 'n u h the knight is wrong' && one.name === 'Mia', 'bug', JSON.stringify({ n: got.length, kind: one?.kind, name: one?.name }));
  R.expect('it carries a board picture that is a JPEG under 150 KB', !!one.picture && one.picture.startsWith('/9j/') && one.picture.length <= 150 * 1024, 'jpeg', one.picture ? `${one.picture.length} chars, ${one.picture.slice(0, 8)}` : 'none');
  const c = one.context || {};
  R.expect('the context has version, device, screen, theme, view, position, moves, errors', c.version && c.device && c.screen?.w === 390 && c.theme && c.view && /^[rnbqkp1-8/]+ [wb] /i.test(c.fen) && Array.isArray(c.moves) && Array.isArray(c.errors), 'full', JSON.stringify(c).slice(0, 300));
  R.expect('no chat, key or login in what was sent', !/chat|"key"|token|Bearer/i.test(JSON.stringify(one)));
  R.expect('no login needed: the item is not marked as a player', one.player === false);

  // a wish without the picture; the dialog has been emptied
  await ev(page, () => document.querySelector('#btn-feedback-phone').click());
  await settleUi(page);
  R.expect('the dialog starts empty again after a send', (await ev(page, () => document.querySelector('#fb-text').value)) === '');
  await ev(page, () => { document.querySelector('.fbkind[data-kind=wish]').click(); document.querySelector('#fb-pic').click(); });
  await page.type('#fb-text', 'more music please');
  await ev(page, () => document.querySelector('#fb-send').click());
  await page.waitForFunction(() => document.querySelector('#feedback').hidden, { timeout: 15000 });
  const wish = (await items()).pop();
  R.expect('a wish with the picture off carries no picture', wish.kind === 'wish' && wish.picture === null && wish.text === 'more music please', 'wish', JSON.stringify({ k: wish.kind, p: wish.picture && wish.picture.length }));

  // limits and errors keep the text
  for (let i = 0; i < 6; i++) await fetch(`${SERVER}/feedback`, { method: 'POST', body: JSON.stringify({ kind: 'wish', text: 'x', device: await ev(page, () => localStorage.getItem('chess3d.feedbackDevice')) }) });
  await ev(page, () => document.querySelector('#btn-feedback-phone').click());
  await settleUi(page);
  await page.type('#fb-text', 'one too many');
  await ev(page, () => document.querySelector('#fb-send').click());
  await page.waitForFunction(() => document.querySelector('#fb-msg').textContent.length > 0, { timeout: 15000 });
  const slow = await ev(page, () => ({ open: !document.querySelector('#feedback').hidden, msg: document.querySelector('#fb-msg').textContent, text: document.querySelector('#fb-text').value, send: !document.querySelector('#fb-send').disabled }));
  R.expect('over the limit: the dialog stays open with the text and a calm message', slow.open && slow.text === 'one too many' && /later/.test(slow.msg) && slow.send, 'kept', JSON.stringify(slow));
  await app.close(); app = null;
  await ev(page, () => document.querySelector('#fb-send').click());
  await page.waitForFunction(() => document.querySelector('#fb-msg').textContent.includes('connection'), { timeout: 15000 });
  R.expect('server away: the message says so and the text is kept', (await ev(page, () => document.querySelector('#fb-text').value)) === 'one too many');

  // German
  await load(page, DESK, { lang: 'de' });
  await ev(page, () => document.querySelector('#btn-feedback').click());
  await settleUi(page);
  const de = await ev(page, () => ({ title: document.querySelector('#fb-title').textContent, send: document.querySelector('#fb-send').textContent, bug: document.querySelector('.fbkind').textContent }));
  R.expect('German: title, send and kind', de.title === 'Rückmeldung' && de.send === 'Senden' && de.bug === 'Fehler', 'Rückmeldung', JSON.stringify(de));

  if (args.includes('--shots')) { await contactSheets(browser, SHOTS, {}).catch(() => {}); }
} catch (e) {
  R.fail('test run', String(e && e.stack || e).slice(0, 400));
}
await finish();
