// Chess clock core (src/clock.js) against the real rules engine and a stand in for the 3D game. No browser.
// Increments, flag at zero, pause and resume, tenths formatting, off does nothing, the flag verdict on fixed positions (a loss with
// a pawn left, a draw against a bare king, a computer game where the player flags), and the game binding (first move starts it,
// a new game resets it, lessons suspend it, mate stops it).
import { Chess, START_FEN, nameSq } from '../src/rules.js';
import { PRESETS, PRESET_IDS, createClock, createGameClock, flagVerdict, formatTime, normalizePreset } from '../src/clock.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

// ---------------------------------------------------------------- presets and formatting
ok('presets: off, 3+2, 5+0, 10+0, 15+10', PRESET_IDS.join() === 'off,3+2,5+0,10+0,15+10' && PRESETS['15+10'].base === 900 && PRESETS['15+10'].inc === 10 && PRESETS['3+2'].base === 180);
ok('normalizePreset takes a query string plus (a space) and rejects the rest', normalizePreset('5 0') === '5+0' && normalizePreset('15+10') === '15+10' && normalizePreset('off') === 'off' && normalizePreset('7+0') === null && normalizePreset('__proto__') === null && normalizePreset(null) === null);
ok('format: m:ss', formatTime(180) === '3:00' && formatTime(754) === '12:34' && formatTime(59.99 + 1) === '1:00' && formatTime(10) === '0:10' && formatTime(10.4) === '0:10');
ok('format: under 10 s with tenths', formatTime(9.96) === '9.9' && formatTime(9) === '9.0' && formatTime(0.04) === '0.0' && formatTime(3.25) === '3.2');
ok('format: never negative or NaN', formatTime(-3) === '0.0' && formatTime(NaN) === '0.0' && formatTime(0) === '0.0');

// ---------------------------------------------------------------- the core
{
  const c = createClock({ preset: '3+2' });
  ok('3+2: 3:00 each, nothing runs before the first move', c.remaining('w') === 180 && c.remaining('b') === 180 && !c.state().running);
  c.tick(5);
  ok('a tick before the first move changes nothing', c.remaining('w') === 180);
  c.switchTo('b');   // White moved
  ok('White moved: +2 s increment for White, Black runs', c.remaining('w') === 182 && c.state().active === 'b' && c.state().running);
  c.tick(10);
  ok('Black loses the time it takes', near(c.remaining('b'), 170) && c.remaining('w') === 182);
  c.switchTo('w');
  ok('Black moved: +2 s for Black, White runs', near(c.remaining('b'), 172) && c.state().active === 'w');
  c.switchTo('w');
  ok('the same turn twice credits nothing twice', near(c.remaining('b'), 172));
  c.pause(); c.tick(30);
  ok('pause: no time passes', near(c.remaining('w'), 182) && !c.state().running);
  c.resume(); c.tick(2);
  ok('resume: the clock runs again', near(c.remaining('w'), 180));
  c.stop(); c.tick(50);
  ok('stop: nothing runs, times stay', near(c.remaining('w'), 180) && !c.state().running);
  c.reset();
  ok('reset: back to the preset, not started', c.remaining('w') === 180 && c.remaining('b') === 180 && !c.state().started);
}
{
  let flagged = null;
  const c = createClock({ preset: '5+0', onFlag: (x) => { flagged = x; } });
  c.switchTo('b'); c.tick(299.9);
  ok('before zero: no flag', flagged === null && near(c.remaining('b'), 0.1));
  c.tick(0.2);
  ok('zero: the running side flags once, time is 0', flagged === 'b' && c.remaining('b') === 0 && c.state().flagged === 'b' && !c.state().running);
  flagged = null; c.tick(5);
  ok('after the flag nothing fires again', flagged === null);
  c.switchTo('w');
  ok('a flagged clock cannot be switched on', c.state().flagged === 'b' && !c.state().running);
}
{
  const c = createClock({ preset: 'off' });
  c.switchTo('b'); c.start('w'); c.tick(100);
  ok('off does nothing', !c.state().enabled && !c.state().running && c.remaining('w') === 0 && c.state().flagged === null);
  c.choose('10+0');
  ok('choose applies at the next reset, not now', !c.state().enabled && c.state().next === '10+0');
  c.reset();
  ok('reset takes the chosen preset', c.state().enabled && c.remaining('b') === 600 && c.state().preset === '10+0');
  c.reset('15+10');
  ok('reset(preset) sets it at once', c.remaining('w') === 900 && c.state().inc === 10);
  c.reset('bogus');
  ok('reset with an unknown preset means off', !c.state().enabled);
}
{
  const c = createClock({ preset: '3+2' });
  c.setUntimed('b');   // the computer plays Black
  c.switchTo('b'); c.tick(20);
  ok('against the computer: its clock never runs, it gets no increment', c.remaining('b') === 180 && c.remaining('w') === 182);
  c.switchTo('w'); c.tick(7);
  ok('the player runs on', near(c.remaining('w'), 175) && c.remaining('b') === 180);
  c.suspend(true); c.tick(100);
  ok('suspended (a lesson): nothing runs', near(c.remaining('w'), 175));
}

// ---------------------------------------------------------------- the flag verdict on fixed positions
const at = (fen) => { const ch = new Chess(); ch.load(fen); return ch; };
{
  const v = flagVerdict(at('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'), 'b');
  ok('Black flags, White has a pawn: White wins on time', v.result === '1-0' && v.winner === 'w' && v.reason === 'time');
  const v2 = flagVerdict(at('4k3/4p3/8/8/8/8/8/4K3 w - - 0 1'), 'w');
  ok('White flags, Black has a pawn: Black wins on time', v2.result === '0-1' && v2.winner === 'b' && v2.reason === 'time');
  const v3 = flagVerdict(at('4k3/8/8/8/8/8/8/4K2R w - - 0 1'), 'b');
  ok('Black flags, White has king and rook: White wins', v3.winner === 'w');
  const v4 = flagVerdict(at('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'b');
  ok('Black flags, White has only the king: a draw', v4.result === '1/2-1/2' && v4.winner === null && v4.reason === 'time');
  const v5 = flagVerdict(at('4k3/4p3/8/8/8/8/8/4K3 w - - 0 1'), 'b');
  ok('Black flags, White has a bare king (Black has the pawn): a draw', v5.result === '1/2-1/2');
  const v6 = flagVerdict(at('4k3/8/8/8/8/8/8/3NK3 w - - 0 1'), 'b');
  ok('a lone knight is not a bare king: White wins on time', v6.winner === 'w');
}

// ---------------------------------------------------------------- the binding, with a stand in for the game
function fakeGame() {
  const chess = new Chess();
  const ev = {};
  let mode = 'play', over = null, vs = false, computerColor = 'b';
  const g = {
    chess, ended: null,
    get mode() { return mode; },
    on(e, fn) { (ev[e] = ev[e] || []).push(fn); },
    emit(e, d) { (ev[e] || []).forEach((fn) => fn(d)); },
    getState() { return { over, vsComputer: vs, computerColor, turn: chess.turn }; },
    setMode(m) { mode = m; g.emit('change'); },
    setVs(on, color = 'b') { vs = on; computerColor = color; g.emit('change'); },
    newGame() { chess.load(START_FEN); over = null; g.ended = null; g.emit('change'); g.emit('newgame'); },
    loadFen(f) { chess.load(f); over = null; g.emit('change'); },
    end(v) { if (over || mode !== 'play') return false; over = { over: true, ...v }; g.ended = v; g.emit('change'); return true; },
    move(from, to, promo) {
      const m = chess.play({ from: nameSq(from), to: nameSq(to), promo: promo || null });
      if (!m) return null;
      const st = chess.status();
      over = st.over ? st : null;
      g.emit('change');
      g.emit('move', { m, san: m.san });
      return m;
    },
  };
  return g;
}
{
  const g = fakeGame();
  const c = createGameClock({ game: g, preset: '3+2' });
  ok('bound: nothing runs before White has moved', !c.state().running && c.remaining('w') === 180);
  c.tick(30);
  ok('bound: the first move is free (a tick before it costs nothing)', c.remaining('w') === 180);
  g.move('e2', 'e4');
  ok('bound: White moved: +2 s, Black runs', c.remaining('w') === 182 && c.state().active === 'b' && c.state().running);
  c.tick(4); g.move('e7', 'e5');
  ok('bound: Black moved: 3:00 - 4 + 2, White runs', near(c.remaining('b'), 178) && c.state().active === 'w');
  c.tick(1);
  g.newGame();
  ok('bound: a new game resets the clocks', c.remaining('w') === 180 && c.remaining('b') === 180 && !c.state().started);
  c.choose('5+0'); g.move('d2', 'd4');
  ok('bound: a chosen preset waits for the next game', c.state().preset === '3+2');
  g.newGame();
  ok('bound: the next game uses it', c.state().preset === '5+0' && c.remaining('w') === 300);
}
{
  const g = fakeGame();
  const c = createGameClock({ game: g, preset: '5+0' });
  g.move('f2', 'f3'); g.move('e7', 'e5'); g.move('g2', 'g4'); g.move('d8', 'h4');   // fool's mate
  ok('bound: mate stops the clocks', g.getState().over?.reason === 'checkmate' && !c.state().running);
  c.tick(10);
  ok('bound: times stay after the game', c.remaining('w') === 300 + 0 && c.remaining('b') === 300);
}
{
  const g = fakeGame();
  const c = createGameClock({ game: g, preset: '3+2' });
  g.move('e2', 'e4');
  g.setMode('puzzle');
  ok('bound: a lesson resets and suspends the clock', c.state().suspended && !c.state().started);
  c.tick(500);
  ok('bound: a puzzle never runs it', c.remaining('w') === 180 && g.ended === null);
  g.setMode('play');
  ok('bound: back in play it is fresh', !c.state().suspended && c.remaining('w') === 180 && !c.state().started);
}
{
  // flag with a pawn left: the loss reaches the game
  const g = fakeGame(); g.loadFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
  const c = createGameClock({ game: g, preset: '3+2' });
  g.move('e1', 'd1');
  c.tick(181);
  ok('flag: Black runs out, White has a pawn: the game ends 1-0 on time', g.ended?.result === '1-0' && g.ended.reason === 'time' && g.ended.winner === 'w');
}
{
  // flag against a bare king: a draw
  const g = fakeGame(); g.loadFen('4k3/4p3/8/8/8/8/8/4K3 w - - 0 1');
  const c = createGameClock({ game: g, preset: '3+2' });
  g.move('e1', 'd1');
  c.tick(181);
  ok('flag: Black runs out against a bare king: draw on time', g.ended?.result === '1/2-1/2' && g.ended.reason === 'time' && g.ended.winner === null);
}
{
  // computer game: only the player's clock runs, the player flags
  const g = fakeGame(); g.setVs(true, 'b');
  const c = createGameClock({ game: g, preset: '3+2' });
  g.move('e2', 'e4');
  c.tick(500);
  ok('computer game: the computer is never timed', c.remaining('b') === 180 && g.ended === null);
  g.move('e7', 'e5');
  ok('computer game: the player runs again, the computer got no increment', c.state().active === 'w' && c.remaining('b') === 180 && c.remaining('w') === 182);
  c.tick(183);
  ok('computer game: the player flags and loses on time', g.ended?.result === '0-1' && g.ended.reason === 'time' && g.ended.winner === 'b');
}

console.log(failed ? `\n${failed} clock check(s) FAILED` : '\nclock: all checks passed');
process.exit(failed ? 1 : 0);
