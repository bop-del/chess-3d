// Offline cache and the new version banner in the real page (CHE-304): node test/offline-page.mjs [--shots=<dir>] [--skip-build]
// A tiny static server (own, so the test can cut it and swap the build under it) serves a copy of the build. The page opens with ?sw=1
// (the cache is on in a release build only; every other build and every test without ?sw=1 never registers the worker, so no stale cache
// can reach them; ?sw=0 forces it off). Checks: the worker installs and holds the game; with the server STOPPED the page loads from the
// cache and a move against the computer is answered; a new build (other sw.js, other index.html) shows the banner after check(), without
// a reload; a tap reloads into the new build and the old cache is gone; a third build seen without a tap loads at the next open; ?sw=0
// runs no update code. No watchPage here: request interception would hide the worker. Screenshots of the banner go to --shots.
// Exit codes: 0 pass, 1 a check failed.
import { createServer } from 'node:http';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { ROOT, build, launchBrowser, reporter, sleep, claimPort } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const SHOTS = opt('shots', '.tmp/offline');
const R = reporter();
const OUT = resolve(ROOT, '.tmp/offline-dist'), SITE = resolve(ROOT, '.tmp/offline-site');
if (!args.includes('--skip-build')) build('.tmp/offline-dist');
rmSync(SITE, { recursive: true, force: true });
cpSync(OUT, SITE, { recursive: true });
mkdirSync(SHOTS, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const PORT = (await claimPort()).port;
let srv = null;
const up = () => new Promise((ok, no) => {
  srv = createServer((rq, rs) => {
    let p = decodeURIComponent(new URL(rq.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = join(SITE, p);
    if (!f.startsWith(SITE) || !existsSync(f) || statSync(f).isDirectory()) { rs.writeHead(404); return rs.end('no'); }
    rs.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); rs.end(readFileSync(f));
  });
  srv.on('error', no); srv.listen(PORT, '127.0.0.1', ok);
});
const down = () => new Promise((ok) => { if (!srv) return ok(); const s = srv; srv = null; s.closeAllConnections?.(); s.close(() => ok()); });
// a new build: a new sw.js (build id) and a marker in index.html, which is what a real release changes
const release = (id) => {
  const sw = join(SITE, 'sw.js'); writeFileSync(sw, readFileSync(sw, 'utf8').replace(/const BUILD = '[^']*';/, `const BUILD = '${id}';`));
  const ix = join(SITE, 'index.html'); writeFileSync(ix, readFileSync(ix, 'utf8').replace(/<meta name="offline-test" content="[^"]*">/, '').replace('<head>', `<head><meta name="offline-test" content="${id}">`));
};
const BASE = `http://127.0.0.1:${PORT}`;
const URLQ = `${BASE}/?sw=1&quality=low&manual=1&intro=0&menu=old`;

const browser = await launchBrowser({ w: 1280, h: 720 });
const errs = [];
try {
  await up();
  const open = async (url = URLQ, size) => {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errs.push('PAGEERR ' + String(e.message).slice(0, 200)));
    await page.setViewport(size || { width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    return page;
  };
  const sw = (page) => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !(reg.active && reg.active.state === 'activated' && navigator.serviceWorker.controller); i++) await new Promise((r) => setTimeout(r, 100));
    const keys = await caches.keys();
    const counts = {}; for (const k of keys) counts[k] = (await (await caches.open(k)).keys()).length;
    return { controlled: !!navigator.serviceWorker.controller, counts, build: document.querySelector('meta[name="offline-test"]')?.content || '' };
  });
  const banner = (page) => page.evaluate(() => { const e = document.getElementById('update-banner'); return e ? { text: e.textContent, h: e.getBoundingClientRect().height } : null; });
  const waitBanner = (page) => page.waitForFunction(() => !!document.getElementById('update-banner'), { timeout: 20000 }).then(() => true, () => false);

  // ---- first visit installs the cache
  let page = await open();
  let s = await sw(page);
  const old = Object.keys(s.counts)[0] || '';
  R.expect('first visit: worker active, page controlled, game cached', s.controlled && Object.keys(s.counts).length === 1 && s.counts[old] > 20, `${old} ${s.counts[old]} files`, JSON.stringify(s));
  R.expect('no banner on a first visit', !(await banner(page)));
  await page.close();

  // ---- offline: the server is gone, the page still loads and a move against the computer is answered
  await down();
  page = await open();
  s = await sw(page);
  R.expect('server stopped: page loads from the cache, controlled by the worker', s.controlled);
  const played = await page.evaluate(() => { const c = window.__chess; c.game.move('e2', 'e4'); c.step(3); c.step(3); return c.game.getState().moves.length; });
  R.expect('offline: a move against the computer is answered', played >= 2, `${played} moves`);
  R.expect('offline: Learn module present', await page.evaluate(() => typeof window.__chess.train === 'object'));
  await page.close();
  await up();

  // ---- a new release: banner after check(), no reload on its own
  page = await open();
  await page.evaluate(() => { window.__same = 1; });
  release('b2');
  await page.evaluate(() => window.__chess.update.check());
  R.expect('new build: the banner shows', await waitBanner(page));
  const bn = await banner(page);
  R.expect('banner says "New version, reload"', bn && bn.text === 'New version, reload', bn && bn.text);
  await sleep(500);
  R.expect('the page did not reload on its own', (await page.evaluate(() => window.__same)) === 1);
  await page.evaluate(() => window.__chess.draw());
  await page.screenshot({ path: `${SHOTS}/banner-desktop.png` });
  // a phone page opened while the new worker waits shows the banner at once (setViewport(isMobile) would reload the first page)
  const ph = await open(URLQ, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  R.expect('a second page opened while the new build waits shows the banner', await waitBanner(ph));
  await ph.evaluate(() => { for (let i = 0; i < 4; i++) window.__chess.step(2); window.__chess.draw(); });
  await sleep(400);
  await ph.screenshot({ path: `${SHOTS}/banner-phone.png` });
  const box = await ph.evaluate(() => { const r = document.querySelector('#update-banner .btn').getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height, vw: innerWidth }; });
  R.expect('phone portrait: banner button inside the screen, tap target 44 px', box.l >= 0 && box.r <= box.vw && box.h >= 44, JSON.stringify(box));
  await ph.close();
  // ---- tap: reload into the new build, the old cache is gone
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }), page.click('#update-banner .btn')]);
  await page.waitForFunction('window.__chessReady === true', { timeout: 120000 });
  s = await sw(page);
  R.expect('after the tap the page is the new build', s.build === 'b2', s.build);
  R.expect('the new cache exists, the old one is gone', Object.keys(s.counts).join() === 'chess3d-b2' && !s.counts[old], JSON.stringify(s.counts));
  R.expect('no banner after the reload', !(await banner(page)));
  await page.evaluate(() => localStorage.setItem('chess3d.lang', 'de'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__chessReady === true', { timeout: 120000 });
  const de = await page.evaluate(() => { window.__chess.update.show(); return document.querySelector('#update-banner .btn').textContent; });
  R.expect('German text: "Neue Version, neu laden"', de === 'Neue Version, neu laden', de);
  await page.evaluate(() => localStorage.setItem('chess3d.lang', 'en'));

  // ---- a release without a tap: the next open has it
  release('b3');
  await page.evaluate(() => window.__chess.update.check());
  await page.close();
  page = await open();
  s = await sw(page);
  R.expect('next open without a tap loads the new build', s.build === 'b3', s.build);
  await page.close();

  // ---- ?sw=0: no update code
  page = await open(`${BASE}/?sw=0&quality=low&manual=1&intro=0&menu=old`);
  R.expect('?sw=0: no update hook', !(await page.evaluate(() => !!window.__chess.update)));
  await page.close();
  R.expect('no page error', !errs.length, 'none', errs.slice(0, 4).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  await down();
}
