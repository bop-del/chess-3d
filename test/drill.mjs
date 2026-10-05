// Drill in the real page: runDrillChecks({ page, baseUrl, log, shot }) -> [{ name, pass, detail }].
// Called from test/smoke.mjs. Needs a served build at baseUrl and window.__chess.train = { store, drill, sweep, ... }
// (src/main.js). Uses ?quality=low&manual=1&ai=0. Asserts order and attribution, never durations: time is stepped with
// __chess.step. A scheduled session with one miss and its retry, a Practise run that changes no level, the end sweep.
// `shot(name)` is optional and saves a screenshot when the smoke run was started with --shots.
import { settleUi } from '../tools/_lib.mjs';

const FLAGS = 'quality=low&manual=1&ai=0';

export async function runDrillChecks({ page, baseUrl, log = () => {}, shot = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 160));
  page.on('pageerror', onErr);
  const onConsole = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); };
  page.on('console', onConsole);

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${baseUrl}/?${FLAGS}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => { try { localStorage.removeItem('chess3d.train'); } catch (e) { /* blocked */ } });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.train', { timeout: 120000 });

  const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  const st = () => page.evaluate(() => {
    const c = window.__chess, s = c.train.drill.state();
    return { phase: s.phase, mode: s.mode, ply: s.ply, line: s.line && s.line.id, msg: s.message && s.message.type, awaiting: s.awaiting, hint: c.openings.hint.visible, placement: c.game.chess.fen().split(' ')[0], gmode: c.game.mode };
  });
  // the move the open quiz asks for, as square names
  const due = () => page.evaluate(() => {
    const c = window.__chess, s = c.train.drill.state();
    const m = c.game.chess.moveFromSan(s.line.moves[s.ply].san);
    return { from: c.game.sqName(m.from), to: c.game.sqName(m.to) };
  });
  // a legal move that is not the due one (and not a sibling): the first legal move that differs
  const wrong = () => page.evaluate(() => {
    const c = window.__chess, s = c.train.drill.state();
    const right = c.game.chess.moveFromSan(s.line.moves[s.ply].san);
    const m = c.game.chess.moves().find((x) => x.to !== right.to && x.piece === 'p');
    return { from: c.game.sqName(m.from), to: c.game.sqName(m.to) };
  });
  const click = async (mv) => {
    await page.evaluate((m) => { const g = window.__chess.game; g.clickSquare(g.nameSq(m.from)); g.clickSquare(g.nameSq(m.to)); }, mv);
    await step(1.2);
  };
  // step time until the quiz is open or the drill has ended (bounded)
  const toQuiz = async () => {
    for (let i = 0; i < 60; i++) {
      const s = await st();
      if (s.awaiting || s.phase !== 'running') return s;
      await page.evaluate(() => window.__chess.train.drill.weiter());   // the own move's text card waits for Weiter
      await step(1.5);
    }
    return st();
  };
  const levels = () => page.evaluate(() => {
    const { store } = window.__chess.train;
    const out = {};
    for (const id of store.adopted()) for (const c of store.cardsOf(id)) out[c.key] = [c.level, c.best];
    return out;
  });
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

  try {
    await step(1);
    await page.waitForFunction("document.body.classList.contains('ready') && document.getElementById('loader').classList.contains('done')");
    await settleUi(page);
    // count the sweeps through the object the drill holds
    await page.evaluate(() => {
      const t = window.__chess.train;
      t.sweepCalls = 0;
      const play = t.sweep.play.bind(t.sweep);
      t.sweep.play = (a) => { t.sweepCalls++; return play(a); };
      t.store.adopt('italian-game');
      t.store.adopt('ruy-lopez');   // shares e4 e5 Nf3 Nc6 with the Italian Game: a card two lines pass through
    });
    ok('drill: nothing runs before it starts', (await st()).phase === 'idle');
    ok('drill: a session starts over the due cards', await page.evaluate(() => window.__chess.train.drill.startDue()));
    await step(0.3);
    let s = await toQuiz();
    ok('drill: the first quiz is open, no hint, drill mode', s.awaiting && !s.hint && s.gmode === 'drill', JSON.stringify(s));
    await shot?.('drill-quiz');
    const before = await levels();

    // a miss: the board does not change, the hint shows, nothing is recorded until the retry
    const placementBefore = s.placement;
    await click(await wrong());
    s = await st();
    ok('drill: a wrong move is refused, the hint shows the right one', s.msg === 'miss' && s.hint && s.awaiting && s.placement === placementBefore, JSON.stringify(s));
    ok('drill: the miss records nothing yet', JSON.stringify(await levels()) === JSON.stringify(before));
    await shot?.('drill-miss');
    const asked = await page.evaluate(() => {
      const t = window.__chess.train, d = t.drill.state();
      const own = t.store.cardsOf(d.line.id);
      return { line: d.line.id, ply: d.ply, first: own[0] ? { key: own[0].key, level: own[0].level, best: own[0].best, due: own[0].due } : null };
    });
    await click(await due());
    s = await st();
    ok('drill: the retry is accepted and the hint goes', !s.awaiting && !s.hint, JSON.stringify(s));
    const afterMiss = await levels();
    const card = await page.evaluate((a) => { const c = window.__chess.train.store.cardsOf(a.line)[0]; return { level: c.level, best: c.best, due: c.due }; }, asked);
    ok('drill: the missed card stays at level 1 (best 1, never lower), due later', asked.ply === 0 && card.level === 1 && card.best === 1 && card.due > asked.first.due, JSON.stringify({ asked, card }));

    // the rest of the session, every own move right
    let guardN = 0;
    while (guardN++ < 40) {
      s = await toQuiz();
      if (s.phase !== 'running') break;
      await click(await due());
    }
    await step(1);
    s = await st();
    ok('drill: the session reaches its end', s.phase === 'finished', JSON.stringify(s));
    ok('drill: the end sweep was called once', (await page.evaluate(() => window.__chess.train.sweepCalls)) === 1);
    const after = await levels();
    const vals = Object.values(after);
    ok('drill: answered cards rose, no best level fell', Object.keys(after).every((k) => after[k][1] >= (before[k] ? before[k][1] : 0)) && vals.some((v) => v[0] >= 2), JSON.stringify(after));
    ok('drill: board consistent at the end', (await page.evaluate(() => window.__chess.game.audit())).length === 0);
    await shot?.('drill-finished');
    await page.evaluate(() => window.__chess.train.drill.stop());
    await step(0.5);
    s = await st();
    ok('drill: stop returns the ordinary game on a fresh board', s.phase === 'idle' && s.gmode === 'play' && s.placement === START, JSON.stringify(s));
    ok('drill: nothing due after a session, startDue changes nothing', !(await page.evaluate(() => window.__chess.train.drill.startDue())) && (await st()).phase === 'idle');

    // Practise: a whole line, a miss in it, no level changes, no sweep
    const snap = JSON.stringify(await levels());
    ok('drill: practise starts an adopted line', await page.evaluate(() => window.__chess.train.drill.startPractise('italian-game')));
    await step(0.3);
    s = await toQuiz();
    ok('drill: practise asks the first own move', s.mode === 'practise' && s.awaiting && s.ply === 0, JSON.stringify(s));
    await click(await wrong());
    s = await st();
    ok('drill: practise refuses a wrong move too', s.msg === 'miss' && s.hint, JSON.stringify(s));
    guardN = 0;
    while (guardN++ < 40) {
      s = await toQuiz();
      if (s.phase !== 'running') break;
      await click(await due());
    }
    await step(1);
    s = await st();
    ok('drill: practise walks the line to its end', s.phase === 'finished' && s.mode === 'practise', JSON.stringify(s));
    ok('drill: practise changed no level', JSON.stringify(await levels()) === snap);
    ok('drill: practise plays no sweep', (await page.evaluate(() => window.__chess.train.sweepCalls)) === 1);
    ok('drill: board consistent after practise', (await page.evaluate(() => window.__chess.game.audit())).length === 0);
    await page.evaluate(() => window.__chess.train.drill.stop());
    await step(0.3);
    ok('drill: no console or page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
  }
  return out;
}
