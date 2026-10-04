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
      const text = document.querySelector('.xstrip .xtext');
      const card = document.querySelector('.xstrip');
      return {
        box: { l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) }, free,
        learnbar: document.body.classList.contains('learnbar'), plbar: vis(bar), normal: vis(norm),
        buttons: [...document.querySelectorAll('.plbar .tb')].map((b) => b.dataset.act),
        primary: [...document.querySelectorAll('.plbar .tb.primary')].map((b) => b.dataset.act),
        sizes: [...document.querySelectorAll('.plbar .tb')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
        textCut: text ? text.scrollHeight > text.clientHeight + 1 : null, cardInView: card ? card.getBoundingClientRect().bottom <= H : null,
        cardBtns: card ? card.querySelectorAll('button').length : null, cardBottom: card ? card.getBoundingClientRect().bottom : null,
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
      await settle(); await shot('explain-start');
      const a = await geometry();
      ok('explain: the bar shows Back, Show me, Hint, End', a.learnbar && a.plbar && !a.normal && a.buttons.join() === 'back,show,hint,end', JSON.stringify(a.buttons));
      ok('explain: Show me is the gold primary button', a.primary.join() === 'show', a.primary.join());
      ok('explain: the buttons are at least 44 px', a.sizes.every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(a.sizes));
      ok('explain: the card shows the whole intro and holds no buttons', a.textCut === false && a.cardBtns === 0, `cut ${a.textCut}, buttons ${a.cardBtns}`);
      ok('explain: the whole board and the hint squares are inside the free frame', inside(a), fmt(a));
      await page.evaluate(() => { const g = window.__chess.game; g.clickSquare(g.nameSq('e2')); g.clickSquare(g.nameSq('e4')); });
      await step(1.5); await settle(); await shot('explain-after');
      const b = await geometry();
      ok('explain: after the first move the card is shorter and the board still fits', b.cardBottom < a.cardBottom && inside(b), `${a.cardBottom} -> ${b.cardBottom}, ${fmt(b)}`);
      ok('explain: the board grows or stays when the card shrinks', b.box.b - b.box.t >= a.box.b - a.box.t - 4, `${a.box.b - a.box.t} -> ${b.box.b - b.box.t}`);
      const on = async () => page.evaluate(() => document.querySelector('.plbar .tb[data-act=hint]').classList.contains('on'));
      const h0 = await on();
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=hint]').click());
      ok('explain: Hint toggles', (await on()) !== h0);
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=show]').click());
      await step(1.5);
      ok('explain: Show me plays the move', await page.evaluate(() => window.__chess.openings.explain.state().ply >= 3), 'ply did not advance');
      await end();
      await checkEnded('explain');
    }

    if (part === 'drill') {
      await page.evaluate(() => window.__chess.train.drill.startPractise('italian-game'));
      await step(3); await settle(); await shot('drill');
      const a = await geometry();
      ok('drill: the bar shows Show me, Hint, End', a.learnbar && a.plbar && !a.normal && a.buttons.join() === 'show,hint,end', JSON.stringify(a.buttons));
      ok('drill: the card holds text only and shows all of it', a.textCut === false && a.cardBtns === 0, `cut ${a.textCut}, buttons ${a.cardBtns}`);
      ok('drill: the whole board is inside the free frame', inside(a), fmt(a));
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=hint]').click());
      await step(0.3); await settle();
      const h = await geometry();
      ok('drill: Hint shows the arrow and the board and arrow squares are inside the frame', await page.evaluate(() => window.__chess.openings.hint.visible) && inside(h), fmt(h));
      await page.evaluate(() => document.querySelector('.plbar .tb[data-act=show]').click());
      await step(1);
      ok('drill: Show me plays the asked move', await page.evaluate(() => window.__chess.game.getState().moves.length >= 1), 'no move');
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
