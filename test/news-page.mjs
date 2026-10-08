// The version line and the News window (CHE-235, smoke tier): node test/news-page.mjs [--port=5373] [--skip-build] [--base=<server>] [--shots]
// quality=low, ai=0, intro=0. The version line (Options on a phone and on the desktop, 44 px, the loader line), the News window (newest first,
// German and English, release link in a new tab, closes) and the auto open rules: first visit remembers only, a minor update opens,
// an older remembered version and a patch stay closed, ?manual=1 never opens or stores, ?news=1 opens on purpose.
// --shots writes the Options and the News window at four sizes to .tmp/news-shots with one contact sheet each.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { reporter, launchBrowser, startServer, build, settleUi } from '../tools/_lib.mjs';
import { contactSheets } from '../tools/contact-sheet.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5373));
const OUT = '.tmp/news-dist', SHOTS = '.tmp/news-shots';
const BASE = opt('base', '').replace(/\/$/, '');
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const [MAJ, MIN] = VERSION.split('.').map(Number);
const R = reporter();
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nnews: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'NEWS FAILED' : 'NEWS OK');
  process.exit(s.nf ? 1 : 0);
};
process.on('uncaughtException', (e) => { R.fail('uncaught exception', String(e && e.stack || e).slice(0, 300)); finish(); });

try {
  if (BASE) server = { base: BASE + '/', stop() {} };
  else {
    if (!args.includes('--skip-build')) { build(OUT); R.pass('vite build'); }
    server = await startServer({ mode: 'preview', port: PORT, outDir: OUT });
  }
  browser = await launchBrowser({ w: 1280, h: 720 });
} catch (e) {
  R.fail('build, serve and launch', String(e.stderr || e.stdout || e.message).split('\n').slice(-4).join(' | ').slice(0, 400));
  await finish();
}

const PHONE = ['phone portrait', 390, 844, true], SMALL = ['phone small', 375, 667, true], LAND = ['phone landscape', 844, 390, true], DESK = ['desktop', 1440, 900, false];
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const shown = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 2 && r.height > 2 && st.visibility !== 'hidden' && st.display !== 'none'; }, sel);
const stored = (page) => ev(page, () => { try { return localStorage.getItem('chess3d.newsSeen'); } catch (e) { return 'blocked'; } });
const newsOpen = (page) => ev(page, () => !!window.__chess.news?.isOpen());

// seed: the remembered version before the page script runs (null: a clean first visit); lang: 'en' or 'de'
async function load(page, [, w, h, phone], { seed = null, query = '', manual = false, lang = 'en', host = null } = {}) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.evaluateOnNewDocument((s, l, hst) => { try { localStorage.clear(); localStorage.setItem('chess3d.lang', l); if (s) localStorage.setItem('chess3d.newsSeen', s); } catch (e) { /* blocked */ } if (hst) window.__newsHost = hst; else delete window.__newsHost; }, seed, lang, host);
  await page.goto(`${server.base}?quality=low&ai=0&intro=0${manual ? '&manual=1' : ''}${phone ? '&touch=1' : ''}${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await ev(page, () => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await settleUi(page);
}
// open Options and bring the version line into view
async function showOptions(page, [, , , phone]) {
  if (phone) await ev(page, () => document.querySelector('.tb[data-act=options]').click());
  else await ev(page, () => document.querySelector('#tab-settings')?.click());
  await settleUi(page);
  await ev(page, () => document.querySelector('#version-line')?.scrollIntoView({ block: 'end' }));
  await settleUi(page);
}

try {
  if (args.includes('--shots')) { rmSync(SHOTS, { recursive: true, force: true }); mkdirSync(SHOTS, { recursive: true }); }
  const page = await browser.newPage();
  page.on('pageerror', (e) => R.fail('page error', String(e).slice(0, 200)));

  for (const size of [PHONE, DESK]) {
    const tag = size[0];
    // first visit: only remember
    await load(page, size, { manual: false });
    R.expect(`${tag}: a first visit does not open the News`, !(await newsOpen(page)));
    R.expect(`${tag}: a first visit remembers the version`, (await stored(page)) === VERSION, VERSION, await stored(page));
    // the version line
    await showOptions(page, size);
    const label = await ev(page, () => document.querySelector('#version-line')?.textContent);
    R.expect(`${tag}: the version line names the version`, new RegExp(`^v${VERSION.replace(/\./g, '\\.')}( · [0-9a-f]{7,})?$`).test(label || ''), label, label);
    R.expect(`${tag}: a build that is not a release adds the commit`, / · [0-9a-f]{7,}$/.test(label || ''), label, label);
    R.expect(`${tag}: the version line sits in Options and shows`, await shown(page, '#version-line'));
    const h = await ev(page, () => document.querySelector('#version-line').getBoundingClientRect().height);
    R.expect(`${tag}: the version line is a 44 px target`, h >= 43.5, '>= 44', h);
    R.expect(`${tag}: the version line is the last thing in Options`, await ev(page, () => { const l = document.querySelector('#version-line'); return !l.nextElementSibling || getComputedStyle(l.nextElementSibling).display === 'none'; }));
    // tap: News opens
    await ev(page, () => document.querySelector('#version-line').click());
    await settleUi(page);
    R.expect(`${tag}: tapping the version line opens the News`, await newsOpen(page));
    const view = await ev(page, () => ({
      versions: [...document.querySelectorAll('#news .newsver')].map((s) => s.dataset.version),
      points: [...document.querySelectorAll('#news .newsver')].map((s) => s.querySelectorAll('li').length),
      link: (() => { const a = document.querySelector('#news .newsver a'); return { href: a.href, target: a.target, text: a.textContent, rel: a.rel }; })(),
      linkH: document.querySelector('#news .newslink').getBoundingClientRect().height,
      title: document.querySelector('#news-title').textContent,
      fits: (() => { const r = document.querySelector('#news .newscard').getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; })(),
    }));
    R.expect(`${tag}: newest version first, older below (${view.versions.join(' ')})`, view.versions[0] === VERSION && view.versions.includes('1.5.0') && view.versions.includes('1.4.0') && view.versions.join() === [...view.versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).join(), VERSION, view.versions.join());
    R.expect(`${tag}: every version has 3 to 5 points`, view.points.every((n) => n >= 3 && n <= 5), '3 to 5', view.points.join());
    R.expect(`${tag}: the link opens the GitHub release of that version in a new tab`, view.link.href === `https://github.com/bop-del/chess-3d/releases/tag/v${VERSION}` && view.link.target === '_blank' && /noopener/.test(view.link.rel), view.link.href, JSON.stringify(view.link));
    R.expect(`${tag}: the link says Full details in English, 44 px high`, view.link.text === 'Full details' && view.linkH >= 43.5, 'Full details', `${view.link.text} ${view.linkH}`);
    R.expect(`${tag}: the window fits the screen`, view.fits);
    if (args.includes('--shots')) await page.screenshot({ path: `${SHOTS}/news-${tag.replace(/ /g, '-')}.png` });
    await ev(page, () => document.querySelector('#news-close').click());
    R.expect(`${tag}: the close button closes the News`, !(await newsOpen(page)));
    await ev(page, () => document.querySelector('#version-line').click());
    await page.keyboard.press('Escape');
    R.expect(`${tag}: Escape closes the News`, !(await newsOpen(page)));
  }

  // German text
  await load(page, DESK, { seed: VERSION, lang: 'de' });
  await showOptions(page, DESK);
  await ev(page, () => document.querySelector('#version-line').click());
  const de = await ev(page, () => ({ title: document.querySelector('#news-title').textContent, link: document.querySelector('#news .newslink').textContent, first: document.querySelector('#news .newsver li').textContent }));
  R.expect('German: title Neuigkeiten and link Alle Details, German points', de.title === 'Neuigkeiten' && de.link === 'Alle Details' && /[äöüß]|Pixelwelt|Eröffnungen|Spielen/.test(de.first), 'Neuigkeiten / Alle Details', JSON.stringify(de));

  // auto open rules
  const older = `${MAJ}.${MIN - 1 < 0 ? 0 : MIN - 1}.0`;
  await load(page, DESK, { seed: MIN > 0 ? older : `${MAJ - 1}.0.0` });
  R.expect('minor update: the News open by themselves', await newsOpen(page));
  R.expect('minor update: the new version is remembered', (await stored(page)) === VERSION, VERSION, await stored(page));
  await load(page, DESK, { seed: VERSION });
  R.expect('same version again: closed', !(await newsOpen(page)));
  await load(page, DESK, { seed: `${MAJ}.${MIN}.99` });
  R.expect('patch or older remembered version: closed, version remembered', !(await newsOpen(page)) && (await stored(page)) === VERSION, 'closed', `${await newsOpen(page)} ${await stored(page)}`);
  await load(page, DESK, { seed: MIN > 0 ? older : `${MAJ - 1}.0.0`, manual: true });
  R.expect('?manual=1: never opens, the stored version stays', !(await newsOpen(page)) && (await stored(page)) === (MIN > 0 ? older : `${MAJ - 1}.0.0`), 'closed', `${await newsOpen(page)} ${await stored(page)}`);
  await load(page, DESK, { seed: VERSION, query: '&news=1', manual: true });
  R.expect('?news=1: opens on purpose, also with ?manual=1', await newsOpen(page));
  await load(page, PHONE, { seed: VERSION, query: '&news=1' });
  R.expect('?news=1 on a phone: opens', await newsOpen(page));

  // CHE-333: the News entry, the dot, the one row, the first visit to the new address
  const olderSeed = MIN > 0 ? older : `${MAJ - 1}.0.0`;
  const topOf = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, h: r.height, w: r.width }; }, sel);
  const entryState = (page) => ev(page, () => { const e = document.querySelector('#news-entry'); const cs = e && getComputedStyle(e.querySelector('.ne-dot')); return e ? { cls: e.className, dot: cs.display !== 'none', unread: e.classList.contains('unread'), tabDot: !!document.querySelector('#tab-settings.odot, .tb[data-act=options].odot'), text: e.textContent } : null; });
  const EV = [['phone portrait', 390, 844, true], DESK];
  for (const size of EV) {
    const tag = size[0];
    {
      await load(page, size, { seed: olderSeed, manual: true, query: '&variant=c' });   // the old look flag changes nothing
      await showOptions(page, size);
      const st = await entryState(page);
      R.expect(`${tag}: the entry is there with the dot and the Options button has one`, !!st && st.cls === 'newsentry unread' && st.dot && st.unread && st.tabDot, 'dot', JSON.stringify(st));
      const inView = await ev(page, () => { const e = document.querySelector('#news-entry'); e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return r.width > 2 && r.top >= 0 && r.bottom <= innerHeight; });
      R.expect(`${tag}: the entry is on screen`, inView && await shown(page, '#news-entry'));
      const box = await topOf(page, '#news-entry');
      R.expect(`${tag}: the entry is a ${size[3] ? 44 : 32} px target`, !!box && box.h >= (size[3] ? 43.5 : 31.5), '>= min', JSON.stringify(box));
      if (args.includes('--shots')) { await ev(page, () => { document.querySelector('#news-entry').scrollIntoView({ block: 'center' }); for (const e of document.querySelectorAll('.psheet-body, .pbody, #tp-settings')) e.scrollTop = 0; }); await settleUi(page); await page.screenshot({ path: `${SHOTS}/entry-${tag.replace(/ /g, '-')}.png` }); }
      {
        await ev(page, () => document.querySelector('#news-entry').click());
        await settleUi(page);
        R.expect(`${tag}: tapping the entry opens the News`, await newsOpen(page));
        R.expect(`${tag}: opening writes the version`, (await stored(page)) === VERSION, VERSION, await stored(page));
        const after = await entryState(page);
        R.expect(`${tag}: the dot is gone after opening`, !after.dot && !after.unread && !after.tabDot, 'no dot', JSON.stringify(after));
        await ev(page, () => document.querySelector('#news-close').click());
      }
    }
    // no dot for someone who is up to date
    await load(page, size, { seed: VERSION, manual: true });
    await showOptions(page, size);
    const cur = await entryState(page);
    R.expect(`${tag}: up to date, no dot`, !!cur && !cur.dot && !cur.tabDot, 'no dot', JSON.stringify(cur));
  }
  // Options without a dot must not shift for returning users: the entry is a row of its own, the rest only moves down by it (the sheet scrolls)
  // first visit to the new address: opens once, then not
  {
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 1280, height: 720 });
    await p2.evaluateOnNewDocument(() => { window.__newsHost = 'chess3d.borisdiebold.com'; try { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); sessionStorage.setItem('seeded', '1'); } } catch (e) { /* blocked */ } });
    p2.on('pageerror', (e) => R.fail('page error', String(e).slice(0, 200)));
    const go = async () => { await p2.goto(`${server.base}?quality=low&ai=0&intro=0`, { waitUntil: 'load', timeout: 60000 }); await p2.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 }); await settleUi(p2); };
    await go();
    R.expect('new address, true first visit: the News open by themselves', await newsOpen(p2));
    R.expect('new address: the marker is set', (await ev(p2, () => localStorage.getItem('chess3d.newsFirst'))) === '1');
    await go();
    R.expect('new address, second load: closed', !(await newsOpen(p2)));
    await p2.close();
    const p3 = await browser.newPage();
    await p3.setViewport({ width: 1280, height: 720 });
    await p3.evaluateOnNewDocument((v) => { window.__newsHost = 'chess3d.borisdiebold.com'; try { localStorage.clear(); localStorage.setItem('chess3d.newsSeen', v); } catch (e) { /* blocked */ } }, VERSION);
    await p3.goto(`${server.base}?quality=low&ai=0&intro=0`, { waitUntil: 'load', timeout: 60000 });
    await p3.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
    await settleUi(p3);
    R.expect('new address, current version already remembered: closed', !(await newsOpen(p3)));
    await p3.close();
    await load(page, DESK, {});
    R.expect('other address (localhost), true first visit: closed as before', !(await newsOpen(page)));
  }

  // blocked storage must not break the page
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await page.goto(`${server.base}?quality=low&ai=0&intro=0&manual=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  R.expect('storage blocked: the game still starts', !(await ev(page, () => window.__chessError || null)));

  // the loader line is in the page before the game script ends (a loader that shows the version)
  const html = await (await fetch(`${server.base}`)).text();
  R.expect('the loading screen has the version line', /id="loader-version"/.test(html));
  await page.close();

  if (args.includes('--shots')) {
    for (const size of [PHONE, SMALL, LAND, DESK]) {
      const p2 = await browser.newPage();
      await load(p2, size, { seed: VERSION, manual: true });
      await showOptions(p2, size);
      await p2.screenshot({ path: `${SHOTS}/options-${size[0].replace(/ /g, '-')}.png` });
      await ev(p2, () => document.querySelector('#version-line').click());
      await settleUi(p2);
      await p2.screenshot({ path: `${SHOTS}/news-${size[0].replace(/ /g, '-')}.png` });
      await p2.close();
    }
    const sheets = await contactSheets(browser, SHOTS, {});
    console.log('contact sheets:', JSON.stringify(sheets));
  }
} catch (e) {
  R.fail('news run', String(e && e.stack || e).slice(0, 400));
}
await finish();
