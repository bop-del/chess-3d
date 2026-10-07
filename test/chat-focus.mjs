// CHE-332: the Online chat window and the phone sheets never steer the board; the message field takes focus.
// Usage: node test/chat-focus.mjs [--port=<default: claimed from the lane name>] [--skip-build]
//   phone (iPhone 390x844, real touch through CDP Input.dispatchTouchEvent, fake api ?online=...&onlinepv=chat):
//     a tap on the message field focuses it and the touchstart / pointerdown on it are not default prevented
//     taps and drags on the chat sheet (field, send, switcher, message list, header) leave yaw, pitch and dist alone; a drag on the board orbits
//     the Online sheet and the Options sheet: a drag on each leaves the camera alone
//     Send posts to the fake api, clears the field, focus stays
//   desktop (mouse, 1280x800): opening the chat focuses the field; wheel, click and drag over the window leave the camera alone, a drag on the board
//     orbits; letters and arrows typed in the field move nothing; Enter sends, Escape blurs
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { ROOT, reporter, launchBrowser, watchPage, startServer, build, sleep, settleUi, claimPort } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = opt('port', '') ? Number(opt('port', '')) : (await claimPort()).port;
const OUT = '.tmp/chat-focus-dist';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const Q = '?quality=low&manual=1&ai=0&touch=1&online=http%3A%2F%2Fpreview.invalid&onlinepv=chat';
const R = reporter();
const t0 = Date.now();

let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nchat-focus: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(s.nf ? 'CHAT-FOCUS FAILED' : 'CHAT-FOCUS OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });
const guard = async (name, fn) => { try { await fn(); } catch (e) { R.fail(name, 'threw: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').slice(0, 300)); } };

try {
  if (!args.includes('--skip-build')) build(OUT);
  server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  browser = await launchBrowser({ w: 1280, h: 800 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

const cam = (page) => page.evaluate(() => { const c = window.__chess.controls.camera; return [c.yaw, c.pitch, c.dist].map((v) => Math.round(v * 1e4) / 1e4).join(','); });
const rectOf = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height } : null; }, sel);
/** a spot on the bare canvas (nothing of the HUD on top) */
const boardSpot = (page) => page.evaluate(() => {
  for (let fy = 0.2; fy <= 0.8; fy += 0.05) for (let fx = 0.1; fx <= 0.9; fx += 0.05) {
    const x = innerWidth * fx, y = innerHeight * fy, e = document.elementFromPoint(x, y);
    if (e && e.id === 'stage') return { x, y };
  }
  return null;
});

async function phone() {
  const page = await browser.newPage();
  try {
    const watch = await watchPage(page, ['127.0.0.1', 'localhost', 'preview.invalid']);
    await page.setUserAgent(IPHONE_UA);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.goto(server.base + Q + '&open=online', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    await settleUi(page);
    const cdp = await page.createCDPSession();
    const send = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
    const tap = async (x, y) => { await send('touchStart', { x, y }); await sleep(40); await send('touchEnd'); await sleep(80); };
    const drag = async (x, y, dx, dy) => {
      await send('touchStart', { x, y });
      for (let i = 1; i <= 8; i++) { await send('touchMove', { x: x + (dx * i) / 8, y: y + (dy * i) / 8 }); await sleep(16); }
      await send('touchEnd'); await sleep(80);
    };
    await page.evaluate(() => {   // record whether a touchstart / pointerdown on the field is default prevented
      window.__dp = [];
      for (const type of ['touchstart', 'pointerdown']) window.addEventListener(type, (e) => { setTimeout(() => window.__dp.push([type, e.target.closest?.('.osend input') ? 'input' : 'other', e.defaultPrevented]), 0); }, false);
    });
    // the Online sheet first: a drag on it must not move the board
    const sheet = await rectOf(page, '.psheet.ponline.open');
    if (sheet) {
      const before = await cam(page);
      await drag(sheet.x, sheet.t + sheet.h * 0.6, 90, 30);
      R.expect('phone: a drag on the Online sheet leaves the camera alone', (await cam(page)) === before, before, await cam(page));
    } else R.fail('phone: the Online sheet is open', 'no .psheet.ponline.open');
    await page.evaluate(() => document.querySelector('.pbar')?.scrollIntoView?.());
    // open the chat: the preview scene shows it at once
    const chatOk = await page.evaluate(() => !document.querySelector('.ochat').hidden);
    if (!chatOk) {   // the sheet may hold the chat button
      const b = await rectOf(page, '[data-a=chat][data-n="Nina"]'); if (b) { await tap(b.x, b.y); await settleUi(page); }
    }
    await step(page);
    R.expect('phone: the chat sheet is open', await page.evaluate(() => !document.querySelector('.ochat').hidden));
    const inp = await rectOf(page, '.ochat .osend input');
    R.expect('phone: the message field is the top element at its centre, not the canvas', await page.evaluate(() => { const r = document.querySelector('.ochat .osend input').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === document.querySelector('.ochat .osend input'); }));
    const before = await cam(page);
    await tap(inp.x, inp.y);
    R.expect('phone: a tap on the message field focuses it', await page.evaluate(() => document.activeElement === document.querySelector('.ochat .osend input')), 'focused', await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className));
    const dp = await page.evaluate(() => window.__dp);
    R.expect('phone: no touchstart or pointerdown on the field is default prevented', !dp.some((r) => r[1] === 'input' && r[2]), 'none', JSON.stringify(dp));
    R.expect('phone: the tap on the field leaves the camera alone', (await cam(page)) === before);
    // taps and drags over the sheet
    const spots = {};
    for (const [k, sel] of [['field', '.ochat .osend input'], ['send', '.ochat .osend button'], ['switcher', '.ochat .oswitch'], ['messages', '.ochat .omsgs'], ['header', '.ochat header']]) spots[k] = await rectOf(page, sel);
    for (const [k, r] of Object.entries(spots)) {
      if (!r) { R.warn(`phone: chat ${k} not measurable`); continue; }
      const b = await cam(page);
      await drag(r.x, r.y, 70, 40);
      if (k !== 'send') await tap(r.x, r.y);
      R.expect(`phone: a drag${k === 'send' ? '' : ' and a tap'} on the chat ${k} leaves the camera alone`, (await cam(page)) === b, b, await cam(page));
    }
    // send: tap Senden posts, the field clears, focus stays
    const inp2 = await rectOf(page, '.ochat .osend input');
    await tap(inp2.x, inp2.y);
    await page.keyboard.type('Hallo');
    const sb = await rectOf(page, '.ochat .osend button');
    await tap(sb.x, sb.y);
    await sleep(200);
    const sent = await page.evaluate(() => ({ val: document.querySelector('.ochat .osend input').value, focus: document.activeElement === document.querySelector('.ochat .osend input'), has: [...document.querySelectorAll('.omsgs li')].some((l) => /Hallo/.test(l.textContent)) }));
    R.expect('phone: Send posts the message to the fake api', sent.has, 'posted', JSON.stringify(sent));
    R.expect('phone: the field clears after Send', sent.val === '', 'empty', JSON.stringify(sent));
    R.expect('phone: focus stays in the field after Send', sent.focus, 'focused', JSON.stringify(sent));
    // the Options sheet
    await page.evaluate(() => document.querySelector('[data-a=chat-close]')?.click());
    await page.goto(server.base + Q + '&open=options', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    await settleUi(page);
    const os = await rectOf(page, '.psheet.open');
    if (os) {
      const b = await cam(page);
      await drag(os.x, os.t + os.h * 0.5, 90, 30);
      R.expect('phone: a drag on the Options sheet leaves the camera alone', (await cam(page)) === b, b, await cam(page));
    } else R.fail('phone: the Options sheet is open', 'no .psheet.open');
    // a drag on the board still orbits
    await page.goto(server.base + Q, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    await settleUi(page);
    const spot = await boardSpot(page);
    const b0 = await cam(page);
    if (spot) await drag(spot.x, spot.y, 80, 20);
    R.expect('phone: a drag on the board outside the sheet still orbits', !!spot && (await cam(page)) !== b0, 'changed', spot ? 'unchanged' : 'no free board spot ' + await page.evaluate(() => { const e = document.elementFromPoint(195, 200); return e.tagName + '.' + e.className; }));
    R.expect('phone: no page errors', watch.errs.length === 0, 'clean', watch.errs.slice(0, 2).join(' | '));
  } finally { await page.close().catch(() => {}); }
}
const step = (page) => page.evaluate(() => window.__chess.step(0.5));

async function desktop() {
  const page = await browser.newPage();
  try {
    const watch = await watchPage(page, ['127.0.0.1', 'localhost', 'preview.invalid']);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(server.base + Q.replace('&touch=1', '') + '&open=online', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    await settleUi(page);
    // the preview chat scene is open at once; close and reopen it through the button so the open path runs
    await page.evaluate(() => document.querySelector('[data-a=chat-close]')?.click());
    const b = await rectOf(page, '[data-a=chat][data-n="Nina"]');
    await page.mouse.click(b.x, b.y);
    await sleep(300);
    R.expect('desktop: opening the chat puts focus in the message field', await page.evaluate(() => document.activeElement === document.querySelector('.ochat .osend input')), 'focused', await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className));
    const win = await rectOf(page, '.ochat');
    const c0 = await cam(page);
    await page.mouse.move(win.x, win.y);
    await page.mouse.wheel({ deltaY: 400 });
    await sleep(100);
    R.expect('desktop: the wheel over the chat window leaves the camera alone', (await cam(page)) === c0, c0, await cam(page));
    await page.mouse.move(win.x, win.t + win.h * 0.4); await page.mouse.down();
    await page.mouse.move(win.x - 60, win.t + win.h * 0.4 + 30, { steps: 8 }); await page.mouse.up();
    await page.mouse.click(win.x, win.t + win.h * 0.4);
    R.expect('desktop: a click and a drag over the chat window leave the camera alone', (await cam(page)) === c0, c0, await cam(page));
    // typing: letters, arrows and the board keys in the field
    const sel0 = await page.evaluate(() => JSON.stringify(window.__chess.game.getState().selected));
    await page.focus('.ochat .osend input');
    await page.keyboard.type('qwasd rfv');
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await page.keyboard.press(k);
    await page.evaluate(() => window.__chess.step(0.6));
    R.expect('desktop: letters and arrows typed in the field leave the camera alone', (await cam(page)) === c0, c0, await cam(page));
    R.expect('desktop: typing leaves the selection alone', (await page.evaluate(() => JSON.stringify(window.__chess.game.getState().selected))) === sel0);
    R.expect('desktop: the typed text is in the field', (await page.evaluate(() => document.querySelector('.ochat .osend input').value)) === 'qwasd rfv');
    await page.keyboard.press('Enter');
    await sleep(200);
    R.expect('desktop: Enter sends', await page.evaluate(() => [...document.querySelectorAll('.omsgs li')].some((l) => /qwasd rfv/.test(l.textContent)) && document.querySelector('.ochat .osend input').value === ''));
    await page.keyboard.press('Escape');
    R.expect('desktop: Escape leaves the field', await page.evaluate(() => document.activeElement !== document.querySelector('.ochat .osend input')));
    R.expect('desktop: the chat stays open after Escape', await page.evaluate(() => !document.querySelector('.ochat').hidden));
    // a drag on the board outside the window still orbits
    const spot = await boardSpot(page);
    const c1 = await cam(page);
    if (spot) { await page.mouse.move(spot.x, spot.y); await page.mouse.down(); await page.mouse.move(spot.x + 80, spot.y + 20, { steps: 8 }); await page.mouse.up(); }
    R.expect('desktop: a drag on the board outside the window still orbits', !!spot && (await cam(page)) !== c1, 'changed', spot ? 'unchanged' : 'no free board spot');
    R.expect('desktop: no page errors', watch.errs.length === 0, 'clean', watch.errs.slice(0, 2).join(' | '));
  } finally { await page.close().catch(() => {}); }
}

await guard('phone run', phone);
await guard('desktop run', desktop);
await finish();
