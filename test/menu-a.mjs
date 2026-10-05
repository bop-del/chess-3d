// Menu structure A (the default since CHE-226, ?menu=old is the old menu; CHE-223): node test/menu-a.mjs [--port=5371] [--skip-build] [--base=<server>]
// ai=0, quality=low, manual=1, intro=0. Phone portrait and landscape and desktop: the bar and the places, Back hidden until the first move,
// the abandon question (Play button, N key, the daily Start), the daily card always first in Play, the clock in Play, the views sheet,
// the Options sections, the badges in Learn only, the old open= values as aliases, and the old menu behind ?menu=old.
// Exit codes: 0 pass, 1 a check failed, 2 setup error.
import { reporter, launchBrowser, watchPage, startServer, build, settleUi } from '../tools/_lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const PORT = Number(opt('port', 5371));
const OUT = '.tmp/menu-a-dist';
const BASE = opt('base', '').replace(/\/$/, '');
const R = reporter();
let server = null, browser = null;
const finish = async () => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nmenu a: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail`);
  console.log(s.nf ? 'MENU A FAILED' : 'MENU A OK');
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

const PHONE = ['phone portrait', 390, 844, true], LAND = ['phone landscape', 844, 390, true], DESK = ['desktop', 1280, 720, false];
const MOVES = '&moves=e2e4,e7e5';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function load(page, [, w, h, phone], query = '', { menu = '' } = {}) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await page.goto(`${server.base}?quality=low&manual=1&ai=0&intro=0${phone ? '&touch=1' : ''}${menu ? `&menu=${menu}` : ''}${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout: 120000, polling: 100 });
  const err = await page.evaluate(() => window.__chessError || null);
  if (err) throw new Error('page failed to start: ' + err);
  await settleUi(page);
}
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = async (page, sel) => { await ev(page, (s) => document.querySelector(s).click(), sel); await settleUi(page); };
const shown = (page, sel) => ev(page, (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 2 && r.height > 2 && st.visibility !== 'hidden' && st.display !== 'none'; }, sel);
const moves = (page) => ev(page, () => window.__chess.game.getState().moves.length);
const openSheet = (page) => ev(page, () => [...document.querySelectorAll('.psheet.open')].map((s) => s.className.replace(/\b(psheet|open)\b/g, '').trim()).join(','));

async function phoneChecks(page, size) {
  const tag = size[0];
  await load(page, size);
  const bar = await ev(page, () => [...document.querySelectorAll('.pbar:not(.plbar) .tb')].map((b) => b.dataset.act).join(','));
  R.expect(`${tag}: the bar is Play, Learn, Back, Symbols, View, Options`, bar === 'new,learn,undo,symbols,views,options', bar, bar);
  R.expect(`${tag}: Back is hidden before the first move, its place stays`, await ev(page, () => { const b = document.querySelector('.tb[data-act=undo]'); return getComputedStyle(b).visibility === 'hidden' && b.getBoundingClientRect().width > 40; }));
  await click(page, '.tb[data-act=new]');
  R.expect(`${tag}: Play opens the Play sheet`, (await openSheet(page)) === 'pplay', await openSheet(page));
  R.expect(`${tag}: the daily card is the first line of Play`, await ev(page, () => document.querySelector('.pplay .card[data-card="game"] .body').firstElementChild.classList.contains('dailycard')) && await shown(page, '.pplay .dailycard'));
  R.expect(`${tag}: Play shows Start and the clock, no second Back or Keys`, await shown(page, '.pplay #btn-new') && await shown(page, '.pplay #sel-clock') && !(await shown(page, '.pplay #btn-undo')) && !(await shown(page, '.pplay #btn-help')));
  if (size === LAND) {
    R.expect(`${tag}: Start shows without scrolling (finding 3)`, await ev(page, () => document.querySelector('.pplay #btn-new').getBoundingClientRect().bottom <= innerHeight - 1));
    return;
  }
  await click(page, '.tb[data-act=new]');
  R.expect(`${tag}: the Play button closes its sheet again`, (await openSheet(page)) === '');

  // a running game: Back shows, the daily card stays, Start asks
  await load(page, size, MOVES);
  R.expect(`${tag}: Back shows from the first move`, await ev(page, () => getComputedStyle(document.querySelector('.tb[data-act=undo]')).visibility === 'visible'));
  await click(page, '.tb[data-act=new]');
  R.expect(`${tag}: the daily card stays in Play during a game`, await shown(page, '.pplay .dailycard'));
  await click(page, '.pplay #btn-new');
  const asked = await ev(page, () => { const c = document.querySelector('.pconfirm'); return !c.hidden && /abandon|abbrechen/i.test(c.textContent); });
  R.expect(`${tag}: Start during a game asks "really abandon"`, asked && (await moves(page)) === 2);
  await click(page, '.pconfirm [data-a=no]');
  R.expect(`${tag}: Cancel keeps the game`, (await moves(page)) === 2 && !(await shown(page, '.pconfirm')));
  await click(page, '.pplay #btn-new'); await click(page, '.pconfirm [data-a=yes]');
  R.expect(`${tag}: Yes starts a new game and closes the sheet`, (await moves(page)) === 0 && (await openSheet(page)) === '');
  // the daily Start during a game asks the same
  await load(page, size, MOVES);
  await click(page, '.tb[data-act=new]'); await click(page, '.pplay .dcstart');
  R.expect(`${tag}: the daily Start during a game asks first`, await shown(page, '.pconfirm') && !(await ev(page, () => document.body.classList.contains('puzzling'))));
  await click(page, '.pconfirm [data-a=yes]');
  R.expect(`${tag}: Yes starts the daily puzzle`, await ev(page, () => document.body.classList.contains('puzzling')));

  // the View sheet
  await load(page, size);
  await click(page, '.tb[data-act=views]');
  const v = await ev(page, () => ({ open: !!document.querySelector('.psheet.pview.open'), chips: document.querySelectorAll('.pview [data-view]').length, want: window.__chess.views.list().length, lock: !!document.querySelector('.pview #chk-lock'), flip: !!document.querySelector('.pview #btn-flip') }));
  R.expect(`${tag}: View opens a sheet with every view, Flip and Lock`, v.open && v.chips === v.want && v.want >= 7 && v.lock && v.flip, `${v.chips} views`, JSON.stringify(v));
  await click(page, '.pview [data-view="top"]');
  R.expect(`${tag}: a view chip picks that view`, (await ev(page, () => window.__chess.views.current())) === 'top');

  // Options
  await click(page, '.tb[data-act=options]');
  const o = await ev(page, () => ({ open: !!document.querySelector('.psheet.poptions.open'), lang: !!document.querySelector('.poptions .lang [data-lang="de"]'), themes: !!document.querySelector('.poptions [data-settings="themes"]'), music: !!document.querySelector('.poptions [data-settings="music"]'),
    tilt: !!document.querySelector('.poptions details#advanced #sliders'), help: !!document.querySelector('.poptions .keys'), clock: !!document.querySelector('.poptions #sel-clock'), badges: !!document.querySelector('.poptions [data-card="badges"]') }));
  R.expect(`${tag}: Options holds look, sound, language, tilt under Advanced and help`, o.open && o.lang && o.themes && o.music && o.tilt && o.help, '', JSON.stringify(o));
  R.expect(`${tag}: the clock and the badges are not in Options`, !o.clock && !o.badges);
  await click(page, '.poptions .lang [data-lang="de"]');
  const de = await ev(page, () => ({ opt: document.querySelector('.tb[data-act=options] span').textContent, back: document.querySelector('.tb[data-act=undo] span').textContent, play: document.querySelector('.tb[data-act=new] span').textContent }));
  R.expect(`${tag}: German bar: Zurück, Spielen, Optionen`, de.opt === 'Optionen' && de.back === 'Zurück' && de.play === 'Spielen', JSON.stringify(de), JSON.stringify(de));
  await click(page, '.poptions .lang [data-lang="en"]');   // the language is remembered: back to English for the rest
  // Learn
  await click(page, '.tb[data-act=learn]');
  R.expect(`${tag}: the badges live in Learn`, await ev(page, () => !!document.querySelector('.plearn [data-card="badges"]')));

  // the old open= values
  const ALIAS = [['daily', 'pplay'], ['moves', 'pplay'], ['clock', 'pplay'], ['game', 'pplay'], ['settings', 'poptions'], ['scene', 'poptions'], ['menu', 'poptions'], ['options', 'poptions'], ['music', 'poptions'], ['view', 'pview'], ['badges', 'plearn'], ['learn', 'plearn'], ['puzzles', 'plearn']];
  for (const [id, want] of ALIAS) {
    await load(page, size, `&open=${id}`);
    R.expect(`${tag}: open=${id} opens ${want}`, (await openSheet(page)) === want, '', await openSheet(page));
  }
  await load(page, size, '&open=nope');
  R.expect(`${tag}: an unknown open= opens nothing`, (await openSheet(page)) === '');
  await load(page, size, '&open=badges');
  R.expect(`${tag}: open=badges unfolds the badge card`, await shown(page, '.plearn .badges:not(.bdstrip) .bdgrid'));
}

async function deskChecks(page, size) {
  const tag = size[0];
  await load(page, size);
  R.expect(`${tag}: the header has no Play button any more`, await ev(page, () => !document.querySelector('.phead #btn-new') && !!document.querySelector('#tp-play #btn-new') && !document.querySelector('.phead #btn-undo')));
  R.expect(`${tag}: Back is hidden before the first move`, await ev(page, () => document.querySelector('#tp-play #btn-undo').hidden));
  R.expect(`${tag}: the daily card is the first thing in Play`, await ev(page, () => document.querySelector('#tp-play').firstElementChild.classList.contains('dailycard')) && await shown(page, '#tp-play .dailycard'));
  R.expect(`${tag}: the clock sits in Play, not in Options`, await shown(page, '#tp-play #sel-clock') && await ev(page, () => !document.querySelector('#tp-settings #sel-clock')));
  const tabs = await ev(page, () => [...document.querySelectorAll('.tab span')].map((s) => s.textContent).join(','));
  R.expect(`${tag}: the tabs are Play, Learn, Options`, tabs === 'Play,Learn,Options', tabs, tabs);
  await click(page, '.tab[data-tab=learn]');
  R.expect(`${tag}: the idle Learn badges are folded, one tap opens them`, !(await shown(page, '.lcard[data-card=badges] .bdgrid')) && await (async () => { await click(page, '.lcard[data-card=badges] > header'); return shown(page, '.lcard[data-card=badges] .bdgrid'); })());
  await load(page, size, MOVES);
  R.expect(`${tag}: Back shows from the first move and the daily card stays`, await shown(page, '#tp-play #btn-undo') && await shown(page, '#tp-play .dailycard'));
  await click(page, '#btn-new');
  R.expect(`${tag}: Play during a game asks "really abandon"`, await shown(page, '#abandon') && (await moves(page)) === 2);
  await click(page, '#abandon [data-a=no]');
  R.expect(`${tag}: Cancel keeps the game`, !(await shown(page, '#abandon')) && (await moves(page)) === 2);
  await page.keyboard.press('n'); await settleUi(page);
  R.expect(`${tag}: the N key asks too`, await shown(page, '#abandon') && (await moves(page)) === 2);
  await click(page, '#abandon [data-a=yes]');
  R.expect(`${tag}: Yes starts a new game`, (await moves(page)) === 0 && !(await shown(page, '#abandon')));
  await load(page, size, MOVES);
  await click(page, '#tp-play .dcstart');
  R.expect(`${tag}: the daily Start during a game asks first`, await shown(page, '#abandon') && !(await ev(page, () => document.body.classList.contains('puzzling'))));
  for (const [id, sel] of [['daily', '#tp-play .dailycard'], ['clock', '#tp-play #sel-clock'], ['moves', '#tp-play #moves'], ['game', '#tp-play #btn-new'], ['settings', '#tp-settings #presets'], ['view', '#tp-settings #presets'], ['options', '#tp-settings #presets'], ['music', '#tp-settings .music-settings'], ['badges', '.badges:not(.bdstrip) .bdgrid']]) {
    await load(page, size, `&open=${id}`);
    await sleep(500);
    R.expect(`${tag}: open=${id} shows its place`, await shown(page, sel), '', sel);
  }
}

try {
  const page = await browser.newPage();
  const watch = await watchPage(page, ['127.0.0.1', 'localhost']);
  await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('chess3d.daily'); localStorage.removeItem('chess3d.puzzles'); localStorage.removeItem('chess3d.badges'); } catch (e) { /* ignore */ } });
  await phoneChecks(page, PHONE);
  await phoneChecks(page, LAND);
  await deskChecks(page, DESK);
  // the old menu behind ?menu=old
  await load(page, PHONE, '', { menu: 'old' });
  R.expect('menu=old phone: the bar still ends in Menu and Back is in place', await ev(page, () => [...document.querySelectorAll('.pbar:not(.plbar) .tb')].map((b) => b.dataset.act).join(',') === 'undo,new,symbols,views,learn,menu' && !document.body.classList.contains('menu-a')));
  await load(page, DESK, '', { menu: 'old' });
  R.expect('menu=old desktop: Play and Back stay in the header', await ev(page, () => !!document.querySelector('.phead #btn-new') && !!document.querySelector('.phead #btn-undo')));
  R.expect('no console errors', !watch.errs.length, '', watch.errs.slice(0, 2).join(' | '));
  R.expect('no foreign requests', !watch.foreign.length, '', watch.foreign.slice(0, 2).join(' | '));
  await page.close();
} catch (e) {
  R.fail('menu a run', String(e && e.stack || e).split('\n').slice(0, 4).join(' | ').slice(0, 500));
}
await finish();
