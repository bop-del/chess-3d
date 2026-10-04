// The start sequence (src/intro.js): node test/intro.mjs [--port=5368] [--base=url] [--skip-build]
// Real boots in headless Chrome (software GL), no ?manual=1 unless a check says so:
//   desktop        the king shows first, the HUD stays hidden while it plays, the sequence reaches the game with no console error
//                  and plays out within half a second of loading being done (plus the slowest frame: software GL frames take a second)
//   deterministic  ?manual=1&intro=1 with a test driven clock: it ends exactly as the game is made without it (pieces, board, lights, camera)
//   reduced motion the finished board shows at once, no sequence
//   fallback       a sequence that cannot start (its glint texture cannot be drawn) falls back to the CSS board and the game boots
//   phone          390x844 touch: ends in the Play view
//   easy view      a stored Symbols view is the view the finished sequence shows
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5368').slice(7));
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
const R = reporter();
const OUT = '.tmp/intro-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const url = (q) => `${BASE || `http://127.0.0.1:${PORT}`}/?${q}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// device.phone reads screen, not the viewport
const PHONE = () => { for (const [k, v] of [['width', 390], ['height', 844]]) Object.defineProperty(screen, k, { get: () => v }); };

// what the finished game looks like: every piece upright at full size, the board built, the lights at their preset, nothing left over
const finished = () => {
  const c = window.__chess, bad = [];
  for (const g of c.game.root.children) {
    if (Math.abs(g.scale.x - 1) > 1e-6 || Math.abs(g.scale.y - 1) > 1e-6 || !g.visible) bad.push('piece or tray not at full size');
    if (g.userData.piece && Math.abs(g.position.y) > 1e-6) bad.push('piece not on its square');
  }
  for (const n of ['frame', 'maple-inlay', 'plinth', 'felt', 'gold-inlay', 'squares-light', 'squares-dark']) {
    const m = c.board.group.getObjectByName(n);
    if (!m || Math.abs(m.scale.x - 1) > 1e-6 || Math.abs(m.scale.y - 1) > 1e-6) bad.push(`board part ${n} not at full size`);
  }
  if (c.gimbal.getObjectByName('intro')) bad.push('intro group still in the scene');
  const cam = c.stage.camera;
  return {
    bad: [...new Set(bad)], key: +c.stage.lights.key.intensity.toFixed(3), env: +c.stage.scene.environmentIntensity.toFixed(3),
    cam: [cam.position.x, cam.position.y, cam.position.z].map((x) => +x.toFixed(2)), view: c.views.current(), ortho: !!cam.isOrthographicCamera,
    lights: c.stage.scene.children.filter((o) => o.isDirectionalLight).length,
    loaderDone: document.getElementById('loader').classList.contains('done'), introClass: document.body.classList.contains('intro'),
    fallback: document.getElementById('loader').classList.contains('fallback'), hasIntro: !!window.__intro,
  };
};
// watches the page from the first frame: did the sequence run, was the HUD hidden meanwhile, how did the shown progress move
const watcher = () => {
  window.__seen = { intro: false, hudHidden: true, shown: [], live: false, title: false };
  const poll = () => {
    const s = window.__seen;
    if (document.body?.classList.contains('intro')) { s.intro = true; const h = document.getElementById('hud'); if (h && getComputedStyle(h).opacity !== '0') s.hudHidden = false; }
    const l = document.getElementById('loader');
    if (l?.classList.contains('live')) s.live = true;
    if (l && document.querySelector('#loader .loader-title')) s.title = true;
    const st = window.__intro?.state;
    if (st && (!s.shown.length || s.shown[s.shown.length - 1] !== st.shown)) s.shown.push(st.shown);
    if (!window.__chessReady) requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
};
const clean = (w) => !w.errs.length && !w.foreign.length;
const dirty = (w) => [...w.errs, ...w.foreign].join(' | ');

async function open(browser, { w = 1280, h = 720, touch = false, prep = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: touch });
  const watch = await watchPage(page);
  if (touch) await page.evaluateOnNewDocument(PHONE);
  if (prep) await prep(page);
  return { page, watch };
}
const ready = (page) => page.waitForFunction('window.__chessReady === true', { timeout: 300000, polling: 200 });

const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  // ---------------------------------------------------------------- desktop, real clock
  {
    const { page, watch } = await open(browser, { prep: (p) => p.evaluateOnNewDocument(watcher) });
    await page.goto(url('quality=low&ai=0'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    const r = await page.evaluate(() => ({ seen: window.__seen, boot: window.__chessBoot }));
    const f = await page.evaluate(finished);
    const sh = r.seen.shown, mono = sh.every((x, i) => !i || x >= sh[i - 1]);
    R.expect('desktop: the title shows first, the sequence draws behind it', r.seen.title && r.seen.live, 'title and live', JSON.stringify(r.seen));
    R.expect('desktop: the HUD stays hidden while the sequence plays', r.seen.intro && r.seen.hudHidden, 'hidden while body.intro', JSON.stringify({ intro: r.seen.intro, hud: r.seen.hudHidden }));
    R.expect('desktop: the shown progress only rises and reaches the end', mono && sh.length >= 2 && Math.max(...sh) >= 0.9, `${sh.length} samples`, sh.map((x) => x.toFixed(2)).join(','));
    const tail = r.boot.ready - r.boot.loaded, allowed = 500 + 2 * (r.boot.frameMs || 0) + 150;
    R.expect('desktop: plays out within half a second of loading being done', tail <= allowed, `${Math.round(tail)} ms (slowest frame ${Math.round(r.boot.frameMs || 0)} ms)`, `${Math.round(tail)} ms > ${Math.round(allowed)} ms`);
    R.expect('desktop: ends as the finished game', !f.bad.length && f.view === 'white' && f.loaderDone && !f.introClass && f.lights === 3, `view ${f.view}, 3 lights`, JSON.stringify(f));
    R.expect('desktop: no console error or foreign request', clean(watch), '', dirty(watch));
    await page.close();
  }

  // ---------------------------------------------------------------- deterministic clock: ends exactly as the game without it
  {
    const a = await open(browser);
    await a.page.goto(url('manual=1&intro=1&quality=low&ai=0'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await a.page.waitForFunction('!!window.__intro', { timeout: 120000 });
    let ticks = 0, early = null;
    for (; ticks < 900; ticks++) {
      await a.page.evaluate(() => window.__intro.tick(1 / 30));
      if (ticks === 3) early = await a.page.evaluate(() => window.__intro.state);
      if (await a.page.evaluate('window.__chessReady === true')) break;
    }
    R.expect('deterministic: the sequence ends by itself', ticks < 900, `${ticks} ticks`);
    R.expect('deterministic: it started at the beginning', early && early.shown < 0.2, JSON.stringify(early));
    await a.page.evaluate(() => { window.__chess.step(1); window.__chess.draw(); });
    const fa = await a.page.evaluate(finished);
    R.expect('deterministic: every piece, board part and light is back as the game made it', !fa.bad.length && fa.lights === 3, JSON.stringify(fa.bad), JSON.stringify(fa));
    R.expect('deterministic: no console error', clean(a.watch), '', dirty(a.watch));
    await a.page.close();
    const b = await open(browser);
    await b.page.goto(url('manual=1&intro=0&quality=low&ai=0'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(b.page);
    await b.page.evaluate(() => { window.__chess.step(1); window.__chess.draw(); });
    const fb = await b.page.evaluate(finished);
    const near = fa.cam.every((x, i) => Math.abs(x - fb.cam[i]) < 0.05);
    R.expect('deterministic: the lights and the camera equal a load without the sequence', fa.key === fb.key && fa.env === fb.env && near, `key ${fa.key}, env ${fa.env}, camera ${fa.cam}`, `with ${JSON.stringify([fa.key, fa.env, fa.cam])} without ${JSON.stringify([fb.key, fb.env, fb.cam])}`);
    await b.page.close();
  }

  // ---------------------------------------------------------------- reduced motion
  {
    const { page, watch } = await open(browser, { prep: async (p) => { await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await p.evaluateOnNewDocument(watcher); } });
    await page.goto(url('quality=low&ai=0'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    const f = await page.evaluate(finished), seen = await page.evaluate(() => window.__seen);
    R.expect('reduced motion: no sequence, the finished board shows at once', !f.hasIntro && !seen.live && !f.bad.length && f.loaderDone, 'no sequence', JSON.stringify({ f, seen }));
    R.expect('reduced motion: no console error', clean(watch), '', dirty(watch));
    await page.close();
  }

  // ---------------------------------------------------------------- the sequence cannot start: the CSS board takes over
  {
    const warned = [];
    const { page, watch } = await open(browser, { prep: (p) => { p.on('console', (m) => { if (/^warn/.test(m.type())) warned.push(m.text()); }); return p.evaluateOnNewDocument(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...a) { if (this.width === 64 && this.height === 64) throw new Error('test: glint texture cannot be drawn'); return get.apply(this, a); };
    }); } });
    await page.goto(url('quality=low&ai=0'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    const f = await page.evaluate(finished), board = await page.evaluate(() => !!document.querySelector('#loader-board .lb-board'));
    R.expect('fallback: the CSS board is mounted and the game boots', f.fallback && board && !f.hasIntro && !f.bad.length && !f.introClass, 'CSS board, game on', JSON.stringify({ f, board }));
    R.expect('fallback: the failure is a warning, not an error', clean(watch) && warned.some((x) => /start sequence failed/.test(x)), 'warned', dirty(watch) + ' | warns: ' + warned.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------- phone, portrait: ends in the Play view
  {
    const { page, watch } = await open(browser, { w: 390, h: 844, touch: true, prep: (p) => p.evaluateOnNewDocument(() => { try { localStorage.removeItem('chess3d.view'); } catch (e) { /* ignore */ } }) });   // the desktop boots above stored the White view
    await page.goto(url('quality=low&ai=0&touch=1'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    const f = await page.evaluate(finished);
    R.expect('phone: the sequence ends in the Play view on the finished game', f.view === 'play' && !f.bad.length && f.loaderDone && !f.introClass, 'Play view', JSON.stringify(f));
    R.expect('phone: no console error', clean(watch), '', dirty(watch));
    await page.close();
  }

  // ---------------------------------------------------------------- a stored Easy view
  {
    const { page, watch } = await open(browser, { prep: (p) => p.evaluateOnNewDocument(() => { try { localStorage.setItem('chess3d.view', 'symbols'); } catch (e) { /* ignore */ } }) });
    await page.goto(url('quality=low&ai=0'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await ready(page);
    const f = await page.evaluate(finished);
    R.expect('easy view: the stored Easy view takes over when the sequence ends', f.view === 'symbols' && f.loaderDone && !f.introClass, 'symbols', JSON.stringify(f));
    R.expect('easy view: no console error', clean(watch), '', dirty(watch));
    await page.close();
  }
} catch (e) { R.fail('intro run', 'threw: ' + String(e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.stop(); }
const { nf } = R.summary();
console.log(nf ? 'INTRO FAILED' : 'INTRO OK');
process.exit(nf ? 1 : 0);
