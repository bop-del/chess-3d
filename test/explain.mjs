// Explain mode in the real page: runExplainChecks({ page, baseUrl, log, shot }) -> [{ name, pass, detail }].
// Called from test/smoke.mjs. Needs a served build at baseUrl. Uses ?quality=low&manual=1&ai=0 and window.__chess.openings.
// Asserts order and attribution, never durations (ADR 0007): time is stepped with __chess.step.
// `shot(name)` is optional and saves a screenshot when the smoke run was started with --shots.

const FLAGS = 'quality=low&manual=1&ai=0';

export async function runExplainChecks({ page, baseUrl, log = () => {}, shot = null }) {
  const out = [];
  const ok = (name, pass, detail = '') => out.push({ name, pass: !!pass, detail: pass ? '' : detail });
  const errs = [];
  const onErr = (e) => errs.push(String(e.message).slice(0, 160));
  page.on('pageerror', onErr);
  const onConsole = (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); };
  page.on('console', onConsole);

  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${baseUrl}/?${FLAGS}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.openings', { timeout: 120000 });

  const step = (s) => page.evaluate((x) => { window.__chess.step(x); window.__chess.draw(); }, s);
  const st = () => page.evaluate(() => {
    const c = window.__chess, s = c.openings.explain.state();
    return { phase: s.phase, ply: s.ply, msg: s.message && s.message.type, due: s.due && s.due.san, own: s.due && s.due.own, placement: c.game.chess.fen().split(' ')[0], hint: c.openings.hint.visible };
  });
  const play = async (from, to) => {
    await page.evaluate((a, b) => { const g = window.__chess.game; g.clickSquare(g.nameSq(a)); g.clickSquare(g.nameSq(b)); }, from, to);
    await step(1.2);
  };
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  try {
    await step(1);
    await page.waitForFunction("document.body.classList.contains('ready') && document.getElementById('loader').classList.contains('done')");
    await new Promise((r) => setTimeout(r, 900));   // the loader fades on the real clock
    await shot?.('explain-list');
    ok('explain: line list has all twelve lines', (await page.evaluate(() => window.__chess.openings.explain.lines.length)) === 12);
    ok('explain: the Italian Game starts', await page.evaluate(() => window.__chess.openings.explain.start('italian-game')));
    await step(0.3);
    let s = await st();
    ok('explain: first own move e4 is due and the hint shows', s.due === 'e4' && s.own && s.hint, JSON.stringify(s));
    await shot?.('explain-start');
    await play('d2', 'd4');
    s = await st();
    ok('explain: a wrong move is refused, the board does not change', s.ply === 0 && s.msg === 'refused' && s.placement === START, JSON.stringify(s));
    await play('e2', 'e4');
    s = await st();
    ok('explain: own move e4 is accepted, the opponent reply is pending', s.ply === 1 && s.due === 'e5' && !s.own && !s.hint, JSON.stringify(s));
    await step(2.5);
    s = await st();
    ok('explain: the opponent plays e5 after the pause', s.ply === 2 && s.due === 'Nf3' && s.own && s.hint, JSON.stringify(s));
    await shot?.('explain-walking');
    await play('g1', 'f3');
    await step(2.5);
    s = await st();
    ok('explain: Nf3 then the opponent Nc6', s.ply === 4 && s.due === 'Bc4', JSON.stringify(s));
    await page.evaluate(() => window.__chess.openings.explain.back());
    await step(0.5);
    s = await st();
    const audit = await page.evaluate(() => window.__chess.game.audit());
    ok('explain: Back returns to the previous own move, board consistent', s.ply === 2 && s.due === 'Nf3' && audit.length === 0, JSON.stringify({ s, audit }));
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => window.__chess.openings.explain.next());
      await step(1.5);
    }
    s = await st();
    ok('explain: the Italian Game walks to its end', s.phase === 'finished' && s.ply === 9 && !s.hint, JSON.stringify(s));
    ok('explain: board consistent at the end', (await page.evaluate(() => window.__chess.game.audit())).length === 0);
    await shot?.('explain-finished');
    await page.evaluate(() => window.__chess.openings.explain.stop());
    await step(0.5);
    s = await st();
    ok('explain: leaving returns to the list on a fresh board', s.phase === 'list' && s.placement === START, JSON.stringify(s));
    await page.evaluate(() => window.__chess.openings.explain.start('scandinavian-defense'));
    await step(2.5);
    s = await st();
    ok('explain: the Scandinavian starts with the opponent e4', s.ply === 1 && s.due === 'd5' && s.own, JSON.stringify(s));
    await shot?.('explain-black');
  } finally {
    page.off('pageerror', onErr);
    page.off('console', onConsole);
  }
  ok('explain: no console or page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  log(`explain: ${out.filter((r) => r.pass).length}/${out.length} checks`);
  return out;
}
