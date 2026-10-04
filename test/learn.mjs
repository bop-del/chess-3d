// Learn UI in the real page: runLearnChecks({ browser, baseUrl, log, shot }) -> [{ name, pass, detail }].
// Called from test/smoke.mjs. Desktop (1280x800) and a phone (390x844, 844x390, 844x290 with touch). Uses ?quality=low&manual=1&ai=0
// and window.__chess.train. Asserts order and attribution, never durations: time is stepped with __chess.step.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, settleUi } from '../tools/_lib.mjs';

// The Openings list groups the 15 side lines under their parent: parent first, same side, in data order, indented.
const sideCheck = (page, scope) => page.evaluate((sc) => {
  const lines = window.__chess.openings.explain.lines;
  const rows = [...document.querySelectorAll(`${sc} .xline.openings`)];
  const subs = rows.filter((r) => r.classList.contains('xsub'));
  const dataOrder = lines.map((l) => l.id).join();
  const order = rows.map((r) => r.dataset.id);
  const groups = [...document.querySelectorAll(`${sc} .xgroup`)];
  const grouped = groups.every((g) => {
    const first = g.querySelector('.xline'); const kids = [...g.querySelectorAll('.xline.xsub')];
    const pl = lines.find((l) => l.id === first.dataset.id);
    return !first.classList.contains('xsub') && kids.length > 0 && kids.every((k) => k.dataset.parent === first.dataset.id && lines.find((l) => l.id === k.dataset.id).side === pl.side);
  });
  const indent = subs.map((r) => parseFloat(getComputedStyle(r).marginLeft) - parseFloat(getComputedStyle(r.closest('.xgroup').querySelector('.xline')).marginLeft));
  const parentsTop = rows.filter((r) => !r.classList.contains('xsub')).length;
  return { n: rows.length, subs: subs.length, sorted: [...order].sort().join() === [...lines.map((l) => l.id)].sort().join(), grouped, minIndent: Math.min(...indent), parentsTop, dataOrder: dataOrder === order.join() };
}, scope);


const FLAGS = 'quality=low&manual=1&ai=0';
const TMP = join(ROOT, '.tmp', 'learn-ui');

export async function runLearnChecks({ browser, baseUrl, log = () => {}, shotsDir = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : String(detail).slice(0, 300) });
  mkdirSync(TMP, { recursive: true });
  const snap = (pg, name) => (shotsDir ? pg.screenshot({ path: join(shotsDir, `${name}.png`) }).catch((e) => log(`      screenshot ${name} skipped: ${String(e.message).slice(0, 60)}`)) : null);   // a slow software GL frame must not fail a check

  async function open(page, flags = '') {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
    await page.goto(`${baseUrl}/?${FLAGS}${flags}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(() => { localStorage.removeItem('chess3d.train'); localStorage.setItem('chess3d.lang', 'en'); });
    await page.goto(`${baseUrl}/?${FLAGS}${flags}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.train', { timeout: 120000 });
    await page.waitForFunction("document.getElementById('loader').classList.contains('done')");
    await settleUi(page);
    return errs;
  }
  const step = (page, s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  const text = (page, sel) => page.evaluate((q) => document.querySelector(q)?.textContent?.trim() ?? null, sel);
  const count = (page, sel) => page.evaluate((q) => document.querySelectorAll(q).length, sel);
  const visibleBox = (page, sel) => page.evaluate((q) => {
    const e = document.querySelector(q);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
  }, sel);
  const tapTab = (page, id) => page.evaluate((i) => document.querySelector(`.xtab[data-tab="${i}"]`).click(), id);

  // ------------------------------------------------------------ desktop
  const page = await browser.newPage();
  let errs = [];
  try {
    await page.setViewport({ width: 1280, height: 800 });
    errs = await open(page);
    await step(page, 1);
    ok('learn: Openings lists 27 rows, none marked yet', (await count(page, '.xline.openings')) === 27 && (await count(page, '.xmark')) === 0);
    const sc = await sideCheck(page, '.xlist');
    ok('learn: 15 side lines sit indented under their 12 parents, parent first, same order as the data', sc.n === 27 && sc.subs === 15 && sc.parentsTop === 12 && sc.grouped && sc.dataOrder && sc.minIndent >= 10, JSON.stringify(sc));
    ok('learn: Practise is greyed before the first adopt', await page.evaluate(() => document.querySelector('.xtab[data-tab="practise"]').disabled));
    await tapTab(page, 'mine');
    ok('learn: Mine is empty with one plain sentence', (await count(page, '.xempty')) === 1 && (await count(page, '.xline.mine')) === 0);
    await snap(page, 'learn-mine-empty');
    await tapTab(page, 'openings');
    await snap(page, 'learn-openings');

    // count the sweep calls
    await page.evaluate(() => { const s = window.__chess.train.sweep; window.__sweepCalls = []; const p = s.play.bind(s); s.play = (a) => { window.__sweepCalls.push(a); return p(a); }; });
    await page.evaluate(() => document.querySelector('.xline.openings[data-id="italian-game"]').click());
    await step(page, 0.3);
    ok('learn: tapping a row walks the line in Explain', await page.evaluate(() => window.__chess.openings.explain.state().phase === 'walking'));
    ok('learn: no adopt control while the line runs', (await count(page, '.xadopt')) === 0);
    for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__chess.openings.explain.next()); await step(page, 1.5); }
    ok('learn: the end of the line offers "Add to my openings"', (await text(page, '.xadopt')) === 'Add to my openings', await text(page, '.xadopt'));
    await snap(page, 'learn-adopt-offer');
    await page.evaluate(() => document.querySelector('.xadopt').click());
    await step(page, 1.5);
    const sw = await page.evaluate(() => ({ calls: window.__sweepCalls.length, side: window.__sweepCalls[0]?.side, n: window.__sweepCalls[0]?.squares?.length, ad: window.__chess.train.store.isAdopted('italian-game') }));
    ok('learn: adopt stores the line and plays the sweep once over the own pieces', sw.ad && sw.calls === 1 && sw.side === 'w' && sw.n === 16, JSON.stringify(sw));
    ok('learn: the control then reads "In my openings" and is inert', (await text(page, '.xadopt')) === 'In my openings' && (await page.evaluate(() => document.querySelector('.xadopt').disabled)));
    await page.evaluate(() => document.querySelector('.xadopt').click());
    ok('learn: a second tap does nothing', (await page.evaluate(() => window.__sweepCalls.length)) === 1);
    await snap(page, 'learn-adopted');
    await page.evaluate(() => window.__chess.openings.explain.restart());
    await step(page, 0.3);
    ok('learn: the control is hidden on Again', (await count(page, '.xadopt')) === 0);
    await page.evaluate(() => window.__chess.openings.explain.stop());
    await step(page, 0.3);
    ok('learn: the adopted line carries a gold mark in Openings, no counts', (await count(page, '.xline.openings[data-id="italian-game"] .xmark')) === 1 && (await count(page, '.xmark')) === 1);
    await tapTab(page, 'mine');
    ok('learn: Mine shows the line with an empty bar and no number', (await count(page, '.xline.mine')) === 1 && (await page.evaluate(() => document.querySelector('.xbar i').style.width)) === '0%' && !/\d/.test(await text(page, '.xline.mine')), await text(page, '.xline.mine'));
    ok('learn: Practise is live now', await page.evaluate(() => !document.querySelector('.xtab[data-tab="practise"]').disabled));
    await snap(page, 'learn-mine');

    // a card level raises the bar
    await page.evaluate(() => { const st = window.__chess.train.store; const k = st.cardsOf('italian-game')[0].key; st.answer(k, true); });
    ok('learn: the bar rises with the best level', (await page.evaluate(() => parseFloat(document.querySelector('.xbar i').style.width))) > 0);

    // Practise: nothing due (every card pushed out), so the adopted lines are offered
    await page.evaluate(() => { const st = window.__chess.train.store; const j = JSON.parse(st.exportJSON()); for (const c of Object.values(j.cards)) c.due = Date.now() + 1e10; st.importJSON(JSON.stringify(j)); });
    await tapTab(page, 'practise');
    const prLines = await count(page, '.xline.practise');
    ok('learn: Practise offers the adopted lines, no due wording', prLines === 1 && !/due|nothing/i.test(await text(page, '.xtabs + *')), String(prLines));
    await page.evaluate(() => document.querySelector('.xline.practise').click());
    await step(page, 0.5);
    const dr = await page.evaluate(() => { const s = window.__chess.train.drill.state(); return { phase: s.phase, mode: s.mode }; });
    ok('learn: a Practise row starts a practise run', dr.phase === 'running' && dr.mode === 'practise', JSON.stringify(dr));
    const lvl = await page.evaluate(() => window.__chess.train.store.cardsOf('italian-game').map((c) => c.level).join());
    await snap(page, 'learn-practise-running');
    await page.evaluate(() => window.__chess.train.drill.stop());
    await step(page, 0.3);
    ok('learn: stopping the run restores the tabs', (await count(page, '.xtab')) === 4 && lvl.length > 0);

    // the Symbols view: a line walks in Explain with the symbols on, the hint arrow is drawn over them (render order above the symbols)
    await tapTab(page, 'openings');
    await page.evaluate(() => { window.__chess.views.set('symbols', { remember: false, instant: true }); document.querySelector('.xline.openings[data-id="italian-game"]').click(); });
    await step(page, 1.5);
    const sy = await page.evaluate(() => {
      const c = window.__chess, arrows = [];
      c.gimbal.children.forEach((o) => { if (o.name === 'move-hint' && o.visible) o.traverse((m) => { if (m.isMesh) arrows.push(m.renderOrder); }); });
      const sym = c.game.root.children.filter((g) => g.userData.piece && g.userData.sym?.visible).length;
      return { on: c.symbols.visible, sym, walking: c.openings.explain.state().phase, arrows: Math.min(...arrows, 99), sym_order: c.game.root.children.find((g) => g.userData.sym)?.userData.sym.children[0].renderOrder };
    });
    ok('learn: Explain walks a line in the Symbols view, symbols on', sy.on && sy.sym === 32 && sy.walking === 'walking', JSON.stringify(sy));
    ok('learn: the hint arrow is drawn above the symbols', sy.arrows > sy.sym_order, JSON.stringify(sy));
    await snap(page, 'learn-symbols-explain');
    await page.evaluate(() => { window.__chess.openings.explain.stop(); window.__chess.views.set('white', { remember: false, instant: true }); });
    await step(page, 0.3);

    // due cards: one button
    await page.evaluate(() => { const st = window.__chess.train.store; const s = JSON.parse(st.exportJSON()); for (const c of Object.values(s.cards)) c.due = 0; st.importJSON(JSON.stringify(s)); });
    await tapTab(page, 'practise');
    ok('learn: with due cards Practise is one start button', (await count(page, '.xstart')) === 1 && (await count(page, '.xline.practise')) === 0);
    await page.evaluate(() => document.querySelector('.xstart').click());
    await step(page, 0.5);
    ok('learn: the start button begins a scheduled session', await page.evaluate(() => window.__chess.train.drill.state().mode === 'due' && window.__chess.train.drill.state().phase === 'running'));
    await page.evaluate(() => window.__chess.train.drill.stop());
    await step(page, 0.3);

    // Edit, Done, remove
    await tapTab(page, 'mine');
    await page.evaluate(() => document.querySelector('.xeditbtn').click());
    ok('learn: Edit shows a Remove button per row', (await count(page, '.xdel')) === 1);
    await snap(page, 'learn-mine-edit');
    const before = await page.evaluate(() => window.__chess.train.store.cardsOf('italian-game').length);
    await page.evaluate(() => document.querySelector('.xdel').click());
    const gone = await page.evaluate(() => ({ ad: window.__chess.train.store.adopted().length, cards: window.__chess.train.store.cardsOf('italian-game').length, ever: window.__chess.train.store.everAdopted() }));
    ok('learn: Remove drops the line at once and never deletes a card', gone.ad === 0 && gone.cards === before && gone.ever, JSON.stringify(gone));
    ok('learn: Mine is empty again, Practise never greys again', (await count(page, '.xempty')) === 1 && (await page.evaluate(() => !document.querySelector('.xtab[data-tab="practise"]').disabled)));

    // Export and Import
    await page.evaluate(() => window.__chess.train.store.adopt('italian-game'));
    const good = await page.evaluate(() => window.__chess.train.store.exportJSON());
    writeFileSync(join(TMP, 'good.json'), good);
    writeFileSync(join(TMP, 'bad.json'), '{ nonsense');
    writeFileSync(join(TMP, 'wrong.json'), JSON.stringify({ version: 1, adopted: ['no-such-line'], cards: {} }));
    const input = await page.$('.xdata input[type=file]');
    await input.uploadFile(join(TMP, 'bad.json'));
    await new Promise((r) => setTimeout(r, 300));
    const m1 = await text(page, '.xdatamsg');
    ok('learn: importing a broken file says what went wrong', /Import failed/.test(m1 || '') && (m1 || '').length > 20, m1);
    await input.uploadFile(join(TMP, 'wrong.json'));
    await new Promise((r) => setTimeout(r, 300));
    const m2 = await text(page, '.xdatamsg');
    ok('learn: importing a file with an unknown opening is refused with a reason', /Import failed/.test(m2 || ''), m2);
    ok('learn: a refused import changes nothing', await page.evaluate(() => window.__chess.train.store.isAdopted('italian-game')));
    await input.uploadFile(join(TMP, 'good.json'));
    await new Promise((r) => setTimeout(r, 300));
    ok('learn: a valid file imports', (await text(page, '.xdatamsg')) === 'Imported.', await text(page, '.xdatamsg'));

    // German
    await page.evaluate(() => document.querySelector('[data-lang="de"]').click());
    await step(page, 0.2);
    ok('learn: German tabs and button texts', (await text(page, '.xtab[data-tab="mine"]')) === 'Meine' && (await text(page, '.xdatahead'))?.toLowerCase() === 'deine eröffnungen und rätsel', await text(page, '.xtab[data-tab="mine"]'));
    await page.evaluate(() => document.querySelector('[data-lang="en"]').click());
  } catch (e) {
    ok('learn: desktop run completed', false, e && e.stack || e);
  } finally {
    await page.close().catch(() => {});
  }
  ok('learn: desktop no console or page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // ------------------------------------------------------------ phone
  for (const [w, h] of [[390, 844], [844, 390], [844, 290]]) {
    const pp = await browser.newPage();
    let perr = [];
    try {
      await pp.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: w > h });
      await pp.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
      perr = await open(pp, '&touch=1');
      const tag = `${w}x${h}`;
      const bar = await pp.evaluate(() => [...document.querySelectorAll('.pbar .tb')].map((b) => { const r = b.getBoundingClientRect(); return { act: b.dataset.act, x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }));
      ok(`learn ${tag}: six thumb bar buttons, Learn is the fifth, all 44 px and inside the screen`,
        bar.length === 6 && bar[4].act === 'learn' && bar.every((b) => b.w >= 43.5 && b.h >= 43.5 && b.r <= w + 0.5 && b.b <= h + 0.5 && b.x >= -0.5 && b.y >= -0.5), JSON.stringify(bar.map((b) => [b.act, Math.round(b.w), Math.round(b.h), Math.round(b.b)])));
      const overlap = bar.some((a, i) => bar.some((b, j) => j > i && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5));
      ok(`learn ${tag}: thumb bar buttons do not overlap`, !overlap);
      await pp.evaluate(() => document.querySelector('.tb[data-act="learn"]').click());
      await pp.waitForFunction(() => document.querySelector('.plearn').getBoundingClientRect().top < innerHeight, { timeout: 10000 }).catch(() => {});
      await settleUi(pp);
      ok(`learn ${tag}: the Learn button opens the sheet with four tabs`, (await pp.evaluate(() => document.querySelector('.plearn').classList.contains('open'))) && (await count(pp, '.plearn .xtab')) === 4);
      const sb = await visibleBox(pp, '.plearn');
      ok(`learn ${tag}: the sheet fits the screen`, sb && sb.y >= -0.5 && sb.y + sb.h <= h + 0.5 && sb.x >= -0.5 && sb.x + sb.w <= w + 0.5, JSON.stringify(sb));
      const tabsOk = await pp.evaluate(() => [...document.querySelectorAll('.plearn .xtab, .plearn .xline')].every((e) => e.getBoundingClientRect().height >= 43.5));
      ok(`learn ${tag}: tabs and rows are 44 px tall`, tabsOk);
      const ps = await sideCheck(pp, '.plearn');
      ok(`learn ${tag}: side lines indented under their parent, nothing cut at the right edge`, ps.subs === 15 && ps.grouped && ps.dataOrder && ps.minIndent >= 8, JSON.stringify(ps));
      ok(`learn ${tag}: every row stays inside the sheet width`, await pp.evaluate(() => { const sb = document.querySelector('.plearn .psheet-body') || document.querySelector('.plearn'); const R = sb.getBoundingClientRect(); return [...document.querySelectorAll('.plearn .xline')].every((e) => e.getBoundingClientRect().right <= R.right + 0.5 && e.scrollWidth <= e.clientWidth + 1); }));
      await snap(pp, `learn-phone-${tag}`);
      if (w === 390) {
        await pp.evaluate(() => document.querySelector('.plearn .xline.openings[data-id="italian-game"]').click());
        await step(pp, 0.4);
        ok(`learn ${tag}: a row closes the sheet and walks the line`, !(await pp.evaluate(() => document.querySelector('.plearn').classList.contains('open'))) && (await pp.evaluate(() => window.__chess.openings.explain.state().phase === 'walking')));
        for (let i = 0; i < 12; i++) { await pp.evaluate(() => window.__chess.openings.explain.next()); await step(pp, 1.5); }
        ok(`learn ${tag}: the adopt control sits in the strip at the line end`, (await text(pp, '.xstrip .xadopt')) === 'Add to my openings');
        const ab = await visibleBox(pp, '.xstrip .xadopt');
        ok(`learn ${tag}: the adopt control is 44 px and on screen`, ab && ab.h >= 43.5 && ab.y + ab.h <= h, JSON.stringify(ab));
        await snap(pp, `learn-phone-adopt-${tag}`);
        await pp.evaluate(() => document.querySelector('.xstrip .xadopt').click());
        await step(pp, 1.5);
        ok(`learn ${tag}: adopting works on the phone`, await pp.evaluate(() => window.__chess.train.store.isAdopted('italian-game')));
        await pp.evaluate(() => window.__chess.openings.explain.stop());
        await pp.evaluate(() => document.querySelector('.tb[data-act="learn"]').click());
        await pp.waitForFunction(() => document.querySelector('.plearn').getBoundingClientRect().top < innerHeight, { timeout: 10000 }).catch(() => {});
        await tapTab(pp, 'mine');
        await snap(pp, `learn-phone-mine-${tag}`);
        ok(`learn ${tag}: Mine shows the line`, (await count(pp, '.plearn .xline.mine')) === 1);
        await pp.evaluate(() => document.querySelector('.tb[data-act="menu"]').click());
        await settleUi(pp);
        ok(`learn ${tag}: opening Menu closes the Learn sheet`, !(await pp.evaluate(() => document.querySelector('.plearn').classList.contains('open'))));
      }
    } catch (e) {
      ok(`learn ${w}x${h}: phone run completed`, false, e && e.stack || e);
    } finally {
      await pp.close().catch(() => {});
    }
    ok(`learn ${w}x${h}: no console or page errors`, perr.length === 0, perr.slice(0, 2).join(' | '));
  }
  log(`learn: ${out.filter((r) => r.pass).length}/${out.length} checks`);
  return out;
}
