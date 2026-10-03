// Install reminder test: the Add to Home Screen sheet (src/install-hint.js) and the manifest, in headless Chrome as an iPhone Safari tab.
// Usage: node test/install.mjs [--port=<default: claimed from the lane name>] [--skip-build]
// Checks: the manifest and every icon it names load and have the stated size; the sheet shows once on a first visit and closes with
// Later, with a tap outside and with Escape; the visit counter keeps it away on the next visits and brings it back after a few,
// never more than three times in all; it never shows on a desktop browser, under automation (navigator.webdriver), with any URL flag
// (manual, diag, fen and so on) or when installed (navigator.standalone). Real page loads are slow in software GL: about 2 minutes.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, build, launchBrowser, reporter, sleep, startServer, watchPage, claimPort } from '../tools/_lib.mjs';
import { pngSize } from '../tools/contact-sheet.mjs';

const arg = (n, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = arg('port', '') ? Number(arg('port', '')) : (await claimPort()).port;
const DIST = '.tmp/install-dist';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const KEY = 'chess3d.install-hint';
const R = reporter();

let server = null, browser = null;
try {
  if (!process.argv.includes('--skip-build')) build(DIST);
  server = await startServer({ mode: 'preview', port: PORT, outDir: DIST });
  const base = server.base;

  // ---- manifest and icons are real files with the sizes they claim
  const mf = await (await fetch(base + 'manifest.webmanifest')).json();
  R.expect('manifest names the app and is standalone', mf.name === 'Chess 3D' && mf.display === 'standalone' && /portrait/.test(mf.orientation), `${mf.name}, ${mf.display}, ${mf.orientation}`);
  let iconsOk = true;
  for (const ic of [...mf.icons, { src: 'apple-touch-icon.png', sizes: '180x180' }, { src: 'og-image.png', sizes: '1200x630' }]) {
    const r = await fetch(base + ic.src);
    const sz = r.ok ? pngSize(Buffer.from(await r.arrayBuffer())) : null;
    const ok = !!sz && `${sz.w}x${sz.h}` === ic.sizes;
    if (!ok) iconsOk = false;
    R.expect(`${ic.src} loads at ${ic.sizes}`, ok, '', sz ? `is ${sz.w}x${sz.h}` : `HTTP ${r.status}`);
  }
  const html = readFileSync(join(ROOT, DIST, 'index.html'), 'utf8');
  R.expect('index.html links the manifest and the touch icon', /rel="manifest"/.test(html) && /rel="apple-touch-icon"/.test(html));
  R.expect('og and twitter tags use absolute URLs under the Pages address', /og:image" content="https:\/\/bop-del\.github\.io\/chess-3d\/og-image\.png"/.test(html) && /twitter:image" content="https:\/\/bop-del\.github\.io\/chess-3d\/og-image\.png"/.test(html) && /twitter:card" content="summary_large_image"/.test(html));

  browser = await launchBrowser({ w: 390, h: 844 });
  // one visit: a fresh page with the given storage seed, user agent, automation flag and standalone flag
  const visit = async ({ path = '', seed = null, ua = UA, mobile = true, webdriver = false, standalone = false, wait = 3000, act = null } = {}) => {
    const page = await browser.newPage();
    try {
      await page.setUserAgent(ua);
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
      await page.evaluateOnNewDocument((k, s, wd, sa) => {
        if (!sessionStorage.getItem('seeded')) {   // the browser profile is shared by every visit: start each one from a known state
          if (s !== null) localStorage.setItem(k, JSON.stringify(s)); else localStorage.removeItem(k);
          sessionStorage.setItem('seeded', '1');
        }
        Object.defineProperty(navigator, 'webdriver', { get: () => wd });
        if (sa) Object.defineProperty(navigator, 'standalone', { get: () => true });
      }, KEY, seed, webdriver, standalone);
      const watch = await watchPage(page);
      await page.goto(base + path, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 180000 });
      await page.waitForFunction(() => { const e = document.querySelector('.ih-scrim'); return !!e && e.classList.contains('in'); }, { timeout: wait, polling: 50 }).catch(() => {});   // up as soon as it shows, else the full wait (the sheet comes 2.2 s after ready, then fades in)
      const shown = await page.evaluate(() => { const e = document.querySelector('.ih-scrim'); return !!e && e.classList.contains('in'); });
      const shot = shown ? await page.screenshot({ type: 'png' }) : null;   // before any tap closes the sheet
      let after = null;
      if (act && shown) { await act(page); await sleep(600); after = await page.evaluate(() => !!document.querySelector('.ih-scrim')); }
      const store = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
      return { shown, after, store, errs: [...watch.errs, ...watch.foreign], shot };
    } finally { await page.close(); }
  };

  const first = await visit({ act: (p) => p.tap('.ih-later') });
  R.expect('first visit in a Safari tab shows the sheet', first.shown);
  R.expect('Later closes it at once', first.after === false);
  R.expect('the visit is remembered', first.store && first.store.visits === 1 && first.store.shows === 1, JSON.stringify(first.store));
  R.expect('no console error or foreign request', first.errs.length === 0, '', first.errs.slice(0, 2).join(' | '));
  if (first.shot) { const { writeFileSync, mkdirSync } = await import('node:fs'); mkdirSync(join(ROOT, '.tmp/install'), { recursive: true }); writeFileSync(join(ROOT, '.tmp/install/hint-portrait.png'), first.shot); }

  const outside = await visit({ act: (p) => p.touchscreen.tap(195, 120) });
  R.expect('a tap outside the sheet closes it', outside.shown && outside.after === false);
  const esc = await visit({ act: (p) => p.keyboard.press('Escape') });
  R.expect('Escape closes it', esc.shown && esc.after === false);

  const quiet = await visit({ seed: { visits: 1, shows: 1, last: 1 } });
  R.expect('the next visit stays quiet', !quiet.shown && quiet.store.visits === 2 && quiet.store.shows === 1, JSON.stringify(quiet.store));
  const again = await visit({ seed: { visits: 3, shows: 1, last: 1 } });
  R.expect('a few visits later it is shown again', again.shown && again.store.shows === 2, JSON.stringify(again.store));
  const third = await visit({ seed: { visits: 9, shows: 2, last: 4 } });
  R.expect('and one last time', third.shown && third.store.shows === 3, JSON.stringify(third.store));
  const never = await visit({ seed: { visits: 40, shows: 3, last: 30 } });
  R.expect('never a fourth time', !never.shown && never.store.shows === 3, JSON.stringify(never.store));

  // the negatives share nothing (each visit seeds its own state and none writes the key), so they run as tabs of this one browser, a few at a time
  const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const FLAGS = ['?manual=1', '?diag=1', '?fen=' + encodeURIComponent('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), '?moves=e2e4', '?select=e2', '?promo=a7a8', '?quality=low'];
  const negatives = [
    ['never on a desktop browser', { ua: DESKTOP_UA, mobile: false }],
    ['never under automation (navigator.webdriver)', { webdriver: true }],
    ...FLAGS.map((f) => [`never with ${f.slice(0, 16)}`, { path: f, wait: 3000 }]),
    ['never when launched from the Home Screen', { standalone: true }],
  ];
  const outcomes = new Array(negatives.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, negatives.length) }, async () => {
    for (let i; (i = next++) < negatives.length;) outcomes[i] = await visit(negatives[i][1]);
  }));
  negatives.forEach(([name], i) => R.expect(name, !outcomes[i].shown && outcomes[i].store === null, '', JSON.stringify(outcomes[i].store)));
} catch (e) {
  R.fail('install test ran', String(e && e.stack || e).slice(0, 400));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.stop();
}
const { nf } = R.summary();
console.log(nf ? `${nf} check(s) failed` : 'install checks passed');
process.exit(nf ? 1 : 0);
