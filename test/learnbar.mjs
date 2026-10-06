// Learning mode on a phone in portrait (390x844, touch): the thumb bar becomes the learning controls, the whole board stays inside
// the free frame between the text card and the bar, the card shows its whole text, End gives the normal bar and the Play view back.
// runLearnBarChecks({ browser, baseUrl, log, part, shotsDir }) -> [{ name, pass, detail }]; part is 'explain', 'drill' or 'puzzles'.
// Called from the learn, drill and puzzles groups of test/smoke.mjs. Needs a served build at baseUrl.
import { settleUi } from '../tools/_lib.mjs';

const FLAGS = 'quality=low&manual=1&ai=0&touch=1&view=play';

export async function runLearnBarChecks({ browser, baseUrl, log = () => {}, part, shotsDir = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  try {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await page.evaluateOnNewDocument(() => { for (const [k, v] of [['width', 390], ['height', 844]]) Object.defineProperty(screen, k, { get: () => v }); });   // device.phone reads screen
    await page.goto(`${baseUrl}/?${FLAGS}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 300000 });
    await settleUi(page);
    const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
    const settle = async () => { await settleUi(page); await step(2); await settleUi(page); await step(0.5); };   // the ResizeObserver feeds the frame on the real clock
    const shot = async (n) => { if (shotsDir) await page.screenshot({ path: `${shotsDir}/learnbar-${n}.png` }); };
    // the four board corners and the squares of every visible hint arrow, projected: must lie inside the free frame
    const geometry = () => page.evaluate(() => {
      const c = window.__chess, T = c.THREE, cam = c.stage.camera, W = innerWidth, H = innerHeight, f = c.controls.frame;
      const pr = (x, y, z) => { const v = new T.Vector3(x, y, z).applyMatrix4(c.gimbal.matrixWorld).project(cam); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };
      const pts = [[-4, 0, -4], [4, 0, -4], [-4, 0, 4], [4, 0, 4]].map((p) => pr(...p));
      for (const g of c.gimbal.children) if (g.name === 'move-hint' && g.visible && g.children.length >= 2) for (const m of g.children.slice(0, 2)) pts.push(pr(m.position.x, 0, m.position.z));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const free = { l: f.left, r: W - f.right, t: f.top, b: H - f.bottom };
      const bar = document.querySelector('.plbar'), norm = document.querySelector('.pbar:not(.plbar)');
      const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
      const text = document.querySelector('.xcard:not([hidden])') || document.querySelector('.xstrip .xtext');
      const card = document.querySelector('.xcard:not([hidden])') || document.querySelector('.xstrip');
      const top = document.querySelector('.xtop:not([hidden])');
      return {
        box: { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) }, free,
        learnbar: document.body.classList.contains('learnbar'), plbar: vis(bar), normal: vis(norm),
        buttons: [...document.querySelectorAll('.plbar .tb')].map((b) => b.dataset.act),
        primary: [...document.querySelectorAll('.plbar .tb.primary')].map((b) => b.dataset.act),
        sizes: [...document.querySelectorAll('.plbar .tb')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
        textCut: text ? text.scrollHeight > text.clientHeight + 1 : null, cardInView: card ? card.getBoundingClientRect().bottom <= H : null,
        cardBtns: card ? card.querySelectorAll('button:not(.xadopt):not(.xwhybtn)').length : null, whyBtns: card ? card.querySelectorAll('.xwhybtn').length : null, cardBottom: card ? card.getBoundingClientRect().bottom : null,
        cardTop: card ? card.getBoundingClientRect().top : null, topText: top ? top.textContent : null, topCut: top ? top.scrollHeight > top.clientHeight + 1 : null, topBottom: top ? top.getBoundingClientRect().bottom : null,
        view: c.views.current(),
      };
    });
    const inside = (g) => g.box.l >= g.free.l - 1 && g.box.r <= g.free.r + 1 && g.box.t >= g.free.t - 1 && g.box.b <= g.free.b + 1;
    const fmt = (g) => JSON.stringify({ box: g.box, free: g.free });
    ok(`${part}: the phone starts in the Play view with the normal bar`, (await geometry()).view === 'play' && !(await geometry()).learnbar);
    const end = async () => { await page.evaluate(() => document.querySelector('.plbar .tb[data-act=end]').click()); await settle(); };
    const checkEnded = async (label) => {
      const g = await geometry();
      ok(`${label}: End gives the normal bar back`, !g.learnbar && !g.plbar && g.normal, JSON.stringify({ learnbar: g.learnbar, plbar: g.plbar, normal: g.normal }));
      ok(`${label}: End keeps the Play view`, g.view === 'play', g.view);
    };

    if (part === 'explain') {
      await page.evaluate(() => window.__chess.openings.explain.start('italian-game'));
      await settle(); await shot('explain-goal');
      const g = await geometry();
      ok('explain: a line opens on the goal screen: the bar shows Go and End, the top bar the goal', g.learnbar && g.plbar && !g.normal && g.buttons.join() === 'go,end' && /^(Goal|Ziel)/.test(g.topText || ''), JSON.stringify([g.buttons, g.topText]));
      ok('explain: the goal screen board is inside the free frame', inside(g), fmt(g));
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=go]').click());
      await settle(); await shot('explain-start');
      const a = await geometry();
      ok('explain: the bar shows Next, Hint, Again, End', a.learnbar && a.plbar && !a.normal && a.buttons.join() === 'next,hint,again,end', JSON.stringify(a.buttons));
      ok('explain: the top bar says what to do now', /e4/.test(a.topText || ''), a.topText);
      ok('explain: the buttons are at least 44 px', a.sizes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(a.sizes));
      ok('explain: Next is off until a card waits', await page.evaluate(() => document.querySelector('.plbar .tb[data-act=next]').disabled), 'Next enabled with no card');
      ok('explain: the whole board and the hint squares are inside the free frame', inside(a), fmt(a));
      ok('explain: the top bar is above the board, the card below it', a.topBottom <= a.box.t + 2 && a.topCut === false, JSON.stringify([a.topBottom, a.box.t, a.topCut]));
      await page.evaluate(() => { const g = window.__chess.game; g.clickSquare(g.nameSq('e2')); g.clickSquare(g.nameSq('e4')); });
      await step(1.5); await settle(); await shot('explain-after');
      const b = await geometry();
      // CHE-269: the one button the card holds is the Warum? toggle (owner decision), every other button lives in the bar
      ok('explain: after the move the card shows its text, whole, and Next is the gold button', b.textCut === false && b.cardBtns === 0 && b.whyBtns === 1 && b.primary.join() === 'next', JSON.stringify([b.textCut, b.cardBtns, b.whyBtns, b.primary]));
      ok('explain: with the card up the board is still inside the free frame', inside(b), fmt(b));
      ok('explain: the board does not jump when the card appears', Math.abs((b.box.b - b.box.t) - (a.box.b - a.box.t)) < 2 && Math.abs(b.box.t - a.box.t) < 2, `${JSON.stringify(a.box)} -> ${JSON.stringify(b.box)}`);
      await step(4);
      ok('explain: the opponent waits for Weiter', await page.evaluate(() => window.__chess.openings.explain.state().ply === 1), 'the opponent moved');
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=next]').click());
      await step(2.5); await settle(); await shot('explain-opponent');
      ok('explain: Weiter lets the opponent reply, its card waits', await page.evaluate(() => { const s = window.__chess.openings.explain.state(); return s.ply === 2 && s.canContinue; }), 'no reply');
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=next]').click());
      const on = async () => page.evaluate(() => document.querySelector('.plbar .tb[data-act=hint]').classList.contains('on'));
      const h0 = await on();
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=hint]').click());
      ok('explain: Hint toggles', (await on()) !== h0);
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=again]').click());
      await settle();
      ok('explain: Again starts the line over', await page.evaluate(() => { const s = window.__chess.openings.explain.state(); return s.phase === 'walking' && s.ply === 0 && !s.canContinue; }), 'not restarted');
      // the longest texts fit the card and the top bar, in both languages
      const fit = await page.evaluate(async () => {
        const c = window.__chess;
        const out = { card: [], top: [] };
        const view = c.openings.view;
        const lines = c.openings.explain.lines;
        for (const lang of ['de', 'en']) {
          const texts = [];
          for (const l of lines) { for (const m of l.moves) texts.push(m[lang]); if (l.ending) texts.push(l.ending[lang]); }
          texts.sort((x, y) => y.length - x.length);
          const box = document.createElement('div'); box.className = 'xcardbox';
          box.append(Object.assign(document.createElement('b'), { className: 'xcardhead', textContent: 'Nxd4' }), Object.assign(document.createElement('p'), { className: 'xcardtext', textContent: texts[0] }));
          view.cardEl.replaceChildren(box);
          out.card.push([lang, texts[0].length, view.cardEl.scrollHeight - view.cardEl.clientHeight]);
        }
        return out;
      });
      ok('explain: the longest move text fits the card without scrolling', fit.card.every(([, , over]) => over <= 1), JSON.stringify(fit.card));
      // other phone sizes: portrait 375x667, landscape and short landscape. The board is inside the free frame and does not run under the top bar or the card
      for (const [w, h] of [[375, 667], [667, 375], [844, 390], [844, 290], [740, 260]]) {
        const pp = await browser.newPage();
        try {
          await pp.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
          await pp.evaluateOnNewDocument((W, H) => { for (const [k, v] of [['width', W], ['height', H]]) Object.defineProperty(screen, k, { get: () => v }); }, w, h);
          await pp.goto(`${baseUrl}/?${FLAGS}&line=ruy-lopez`, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await pp.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 300000 });
          await settleUi(pp);
          const fitAt = async (label) => {
            await settleUi(pp); await pp.evaluate(() => { window.__chess.step(2); window.__chess.draw(); }); await settleUi(pp); await pp.evaluate(() => { window.__chess.step(0.5); window.__chess.draw(); });
            const g = await pp.evaluate(() => {
              const c = window.__chess, T = c.THREE, cam = c.stage.camera, W = innerWidth, H = innerHeight, f = c.controls.frame;
              const pr = (x, y, z) => { const v = new T.Vector3(x, y, z).applyMatrix4(c.gimbal.matrixWorld).project(cam); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };
              const pts = [[-4, 0, -4], [4, 0, -4], [-4, 0, 4], [4, 0, 4]].map((q) => pr(...q));
              const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
              const box = { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) };
              const rect = (e) => { if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
              const card = document.querySelector('.xcard'), top = document.querySelector('.xtop');
              const over = (a, b) => !!a && a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
              return { box, free: { l: f.left, r: W - f.right, t: f.top, b: H - f.bottom }, cardOver: over(rect(card), box), topOver: over(rect(top), box),
                cardCut: card ? card.scrollHeight - card.clientHeight : 0, topCut: top ? top.scrollHeight - top.clientHeight : 0, view: c.views.current() };
            });
            const inFrame = g.box.l >= g.free.l - 1 && g.box.r <= g.free.r + 1 && g.box.t >= g.free.t - 1 && g.box.b <= g.free.b + 1;
            ok(`explain ${w}x${h} ${label}: the board is inside the free frame and clear of the top bar and the card`, inFrame && !g.cardOver && !g.topOver, JSON.stringify(g));
            return g;
          };
          await fitAt('goal');
          // the longest goal sentence (German, 73 characters with its label) fits the top bar in two lines
          const topCut = await pp.evaluate(() => { const top = document.querySelector('.xtop'); top.textContent = 'Ziel: Der c-Bauer ist getauscht, Springer auf f6, bereit zum Gegenangriff'; return top.scrollHeight - top.clientHeight; });
          ok(`explain ${w}x${h}: the longest goal fits the top bar`, topCut <= 1, `over by ${topCut}px`);
          await pp.evaluate(() => { window.__chess.openings.explain.go(); const g = window.__chess.game; g.clickSquare(g.nameSq('e2')); g.clickSquare(g.nameSq('e4')); });
          await pp.evaluate(() => { window.__chess.step(1.5); });
          const g2 = await fitAt('card');
          // the longest move text of the line fits the card (a short landscape phone may scroll it: warn only there)
          const cut = await pp.evaluate(() => {
            const c = window.__chess, view = c.openings.view, line = c.openings.explain.lines.find((l) => l.id === 'ruy-lopez');
            const texts = [...line.moves.map((m) => m.de), line.ending && line.ending.de].filter(Boolean).sort((a, b) => b.length - a.length);
            const box = document.createElement('div'); box.className = 'xcardbox';
            box.append(Object.assign(document.createElement('b'), { className: 'xcardhead', textContent: 'Nxd4' }), Object.assign(document.createElement('p'), { className: 'xcardtext', textContent: texts[0] }));
            view.cardEl.replaceChildren(box);
            return view.cardEl.scrollHeight - view.cardEl.clientHeight;
          });
          ok(`explain ${w}x${h}: the longest German text of the line fits the card${h < 340 ? ' (short landscape: scrolling is allowed)' : ''}`, h < 340 || cut <= 1, `over by ${cut}px`);
          const sizes = await pp.evaluate(() => [...document.querySelectorAll('.plbar .tb')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
          ok(`explain ${w}x${h}: the learning bar buttons are at least 44 px`, sizes.length === 4 && sizes.every(([bw, bh]) => bw >= 44 && bh >= 44), JSON.stringify(sizes));
          void g2;
        } finally { await pp.close().catch(() => {}); }
      }
      await end();
      await checkEnded('explain');
    }

    if (part === 'drill') {
      await page.evaluate(() => window.__chess.train.drill.startPractise('italian-game'));
      await step(3); await settle(); await shot('drill');
      const a = await geometry();
      ok('drill: the bar shows Next, Hint, Again, End', a.learnbar && a.plbar && !a.normal && a.buttons.join() === 'next,hint,again,end', JSON.stringify(a.buttons));
      ok('drill: the top bar says only what to do, without the answer', !!a.topText && !/e4|Nf3|Bc4/.test(a.topText), a.topText);
      ok('drill: the whole board is inside the free frame', inside(a), fmt(a));
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=hint]').click());
      await step(0.3); await settle();
      const h = await geometry();
      ok('drill: Hint shows the arrow and the board and arrow squares are inside the frame', await page.evaluate(() => window.__chess.openings.hint.visible) && inside(h), fmt(h));
      await page.evaluate(() => { const c = window.__chess; const s = c.train.drill.state(); const m = c.game.chess.moveFromSan(s.line.moves[s.ply].san); c.game.clickSquare(m.from); c.game.clickSquare(m.to); });
      await step(1.2); await settle(); await shot('drill-card');
      const c2 = await geometry();
      ok('drill: the own move leaves a card that waits for Weiter, whole', await page.evaluate(() => window.__chess.train.drill.state().canContinue) && c2.textCut === false, JSON.stringify([c2.textCut]));
      await step(4);
      ok('drill: nothing moves while the card waits', await page.evaluate(() => window.__chess.train.drill.state().canContinue), 'the drill went on');
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=next]').click());
      await step(3);
      ok('drill: Weiter goes on', await page.evaluate(() => !window.__chess.train.drill.state().canContinue), 'still waiting');
      await end();
      await checkEnded('drill');
    }

    if (part === 'puzzles') {
      await page.evaluate(() => window.__chess.puzzles.start());
      await step(2); await settle(); await shot('puzzle');
      const a = await geometry();
      ok('puzzles: the bar shows Help, Path, End', a.learnbar && a.plbar && !a.normal && a.buttons.join() === 'help,path,end', JSON.stringify(a.buttons));
      ok('puzzles: the card holds text only and shows all of it', a.textCut === false && a.cardBtns === 0, `cut ${a.textCut}, buttons ${a.cardBtns}`);
      ok('puzzles: the whole board is inside the free frame, camera straight', inside(a) && await page.evaluate(() => Math.abs(window.__chess.controls.camera.yaw) < 1e-3 || Math.abs(Math.abs(window.__chess.controls.camera.yaw) - Math.PI) < 1e-3), fmt(a));
      const side = await page.evaluate(() => ({ own: window.__chess.puzzles.state().own, facesBlack: Math.cos(window.__chess.controls.camera.yaw) < 0 }));
      ok('puzzles: the solver\'s side is at the bottom', (side.own === 'b') === side.facesBlack, JSON.stringify(side));
      for (let i = 0; i < 8; i++) {
        const s = await page.evaluate(() => { const s = window.__chess.puzzles.state(); return { phase: s.phase, ply: s.ply, moves: s.puzzle && s.puzzle.moves }; });
        if (s.phase !== 'playing') break;
        if (s.ply % 2 === 1) { const u = s.moves[s.ply]; await page.evaluate((x, y) => { const g = window.__chess.game; g.clickSquare(g.nameSq(x)); g.clickSquare(g.nameSq(y)); }, u.slice(0, 2), u.slice(2, 4)); await step(0.8); }
        await step(1.2);
      }
      await settle(); await shot('puzzle-solved');
      const b = await geometry();
      ok('puzzles: solved shows Help, Next (gold), Path, End', b.buttons.join() === 'help,next,path,end' && b.primary.join() === 'next', JSON.stringify([b.buttons, b.primary]));
      ok('puzzles: solved, the board is still inside the free frame', inside(b), fmt(b));
      ok('puzzles: the status line is one short phrase while learning', await page.evaluate(() => { const l = document.querySelector('.pstatus .ps-last'), s = document.querySelector('.pstatus .ps-sub'); return getComputedStyle(l).display === 'none' && getComputedStyle(s).display === 'none'; }), 'sub or last still shown');
      await end();
      await checkEnded('puzzles');
    }
    ok(`${part}: no console error or page error`, errs.length === 0, errs.slice(0, 2).join(' | '));
  } finally { await page.close().catch(() => {}); }
  return out;
}
