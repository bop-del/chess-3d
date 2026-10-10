// CHE-421: stills of the Online tab (German UI) per mock scene (?onlinepv=<scene>): phone portrait 390x844 and the desktop panel.
// Usage: node tools/online-shots.mjs [--scenes=redesign,redesign3,result,login,card] [--out=.tmp/online-shots] [--skip-build] [--port=<claimed>] [--chat]
//   --chat opens the chat of Nina after the load (the floating window / phone chat sheet).
// One headless Chrome through launchBrowser(), closed in finally. Files: <out>/<scene>-phone.png, <out>/<look>-desktop.png, <out>/<look>-desktop-panel.png.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { reporter, launchBrowser, watchPage, startServer, build, settleUi, claimPort } from './_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const SCENES = opt('scenes', 'redesign').split(',');
const OUT = opt('out', '.tmp/online-shots');
const SUFFIX = args.includes('--chat') ? '-chat' : '';
const PORT = opt('port', '') ? Number(opt('port', '')) : (await claimPort()).port;
const DIST = '.tmp/online-shots-dist';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const Q = (scene) => `?quality=low&manual=1&ai=0&online=http%3A%2F%2Fpreview.invalid&onlinepv=${scene}&open=online`;
const R = reporter();
mkdirSync(OUT, { recursive: true });

let server = null, browser = null;
try {
  if (!args.includes('--skip-build')) build(DIST);
  server = await startServer({ mode: 'preview', port: PORT, outDir: DIST });
  browser = await launchBrowser({ w: 1280, h: 800 });
  for (const look of SCENES) {
    for (const kind of ['phone', 'desktop', ...(args.includes('--tall') ? ['tall'] : [])]) {
      const page = await browser.newPage();
      try {
        await watchPage(page, ['127.0.0.1', 'localhost', 'preview.invalid']);
        await page.evaluateOnNewDocument(() => { try { localStorage.setItem('chess3d.lang', 'de'); } catch (e) { /* ignore */ } });   // the German UI
        if (kind === 'phone' || kind === 'tall') { await page.setUserAgent(UA); await page.setViewport({ width: 390, height: kind === 'tall' ? 2200 : 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); }
        else await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
        await page.goto(server.base + Q(look) + (kind === 'desktop' ? '' : '&touch=1'), { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
        await settleUi(page);
        if (args.includes('--chat')) { await page.evaluate(() => window.__chessOnline?.openChat('Nina')); await settleUi(page); }
        await page.addStyleTag({ content: '.obubs, .obub { display: none !important; }' });   // the game bubble of the first load is a transient, not part of the tab
        await new Promise((r) => setTimeout(r, 400));
        await page.screenshot({ path: join(OUT, `${look}-${kind}${SUFFIX}.png`) });
        if (kind === 'desktop') {
          const box = await page.evaluate(() => { const r = document.querySelector('#tp-online')?.getBoundingClientRect(); return r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; });
          if (box) await page.screenshot({ path: join(OUT, `${look}-desktop-panel${SUFFIX}.png`), clip: { x: Math.max(0, box.x - 8), y: 0, width: Math.min(1280 - Math.max(0, box.x - 8), box.w + 16), height: 800 } });
        }
        R.pass(`${look} ${kind}`);
      } finally { await page.close(); }
    }
  }
} catch (e) {
  R.fail('shots', String(e.stack || e.message).split('\n').slice(0, 4).join(' | ').slice(0, 400));
} finally {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
}
const s = R.summary();
console.log(`online-look-shots: ${s.np} ok, ${s.nf} failed, files in ${OUT}`);
process.exit(s.nf ? 1 : 0);
