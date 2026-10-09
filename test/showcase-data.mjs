// Showcase games: every move legal, SAN exact, last move mate, captions complete, move names in both languages.
// Run: node test/showcase-data.mjs    Exit 0 when every check holds, 1 otherwise.
import { Chess } from '../src/rules.js';
import { GAMES, DEFAULT_GAME, gameById } from '../src/showcase/games.js';
import { moveName, moveNumber, sanFor, titleLine } from '../src/showcase/names.js';

let bad = 0;
const check = (cond, m) => { if (cond) console.log('PASS ' + m); else { bad++; console.log('FAIL ' + m); } };
const noDash = (s) => !s.includes(String.fromCharCode(0x2014)) && !s.includes('-' + '-');

for (const g of Object.values(GAMES)) {
  const c = new Chess();
  let legal = true, exact = true, at = '';
  g.sans.forEach((s, i) => {
    if (!legal) return;
    const m = c.playSan(s);
    if (!m) { legal = false; at = `${moveNumber(i)} ${s}`; return; }
    if (m.san !== s) { exact = false; at = `${moveNumber(i)} ${s} engine says ${m.san}`; }
  });
  check(legal, `${g.id}: all ${g.sans.length} moves legal${legal ? '' : ' (stops at ' + at + ')'}`);
  if (!legal) continue;
  check(exact, `${g.id}: SAN marks match the engine${exact ? '' : ' (' + at + ')'}`);
  const st = c.status();
  check(st.over && st.reason === 'checkmate' && st.result === g.result, `${g.id}: ends in checkmate, result ${g.result}`);
  check(g.sans[g.sans.length - 1].endsWith('#'), `${g.id}: last move marked #`);
  const n = g.sans.length, last = n - 1;
  const inside = (i) => Number.isInteger(i) && i >= 0 && i < n;
  const noteKeys = Object.keys(g.notes).map(Number);
  check(noteKeys.length >= 5 && noteKeys.length <= 8 && noteKeys.every(inside), `${g.id}: 5 to 8 notes, all inside the game`);
  check(g.slow.length > 0 && g.slow.every(inside) && g.slow.includes(last), `${g.id}: slow plies inside, includes the mate`);
  check(g.key.length > 0 && g.key.every(inside) && g.key.includes(last), `${g.id}: key plies inside, includes the mate`);
  const caps = Object.values(g.notes);
  check(caps.every((x) => x.en && x.de && x.en.length <= 60 && x.de.length <= 60), `${g.id}: captions have en and de, <= 60 chars`);
  check(g.title.en && g.title.de && g.place.en && g.place.de, `${g.id}: title and place in both languages`);
  check(noDash(JSON.stringify(g)), `${g.id}: no em dash or double hyphen`);
  const names = g.sans.map((s) => [moveName(s, 'en'), moveName(s, 'de')]);
  check(names.every(([e, d]) => e && d && e !== d), `${g.id}: moveName non empty and different en/de on every ply`);
  check(names.every(([e, d]) => noDash(e + d) && !/[a-h][1-8][a-h]/.test(e)), `${g.id}: move names clean`);
}

const eq = (got, want, m) => check(got === want, `${m}: ${got}`);
eq(moveName('Bxf7+', 'en'), 'Bishop takes on f7, check', 'en capture with check');
eq(moveName('Bxf7+', 'de'), 'Läufer schlägt auf f7, Schach', 'de capture with check');
eq(moveName('O-O', 'en'), 'Castles kingside', 'en short castle');
eq(moveName('O-O', 'de'), 'Kurze Rochade', 'de short castle');
eq(moveName('O-O-O', 'en'), 'Castles queenside', 'en long castle');
eq(moveName('O-O-O', 'de'), 'Lange Rochade', 'de long castle');
eq(moveName('Be7#', 'en'), 'Bishop to e7, checkmate', 'en mate');
eq(moveName('Be7#', 'de'), 'Läufer nach e7, Schachmatt', 'de mate');
eq(moveName('Nf3', 'en'), 'Knight to f3', 'en knight');
eq(moveName('Nf3', 'de'), 'Springer nach f3', 'de knight');
eq(moveName('exf4', 'en'), 'Pawn takes on f4', 'en pawn capture');
eq(moveName('exf4', 'de'), 'Bauer schlägt auf f4', 'de pawn capture');
eq(moveName('e8=Q', 'en'), 'Pawn to e8, becomes a queen', 'en promotion');
eq(moveName('e8=Q', 'de'), 'Bauer nach e8, wird zur Dame', 'de promotion');
eq(moveNumber(0) + ' ' + moveNumber(1) + ' ' + moveNumber(2), '1. 1... 2.', 'moveNumber');
eq(sanFor('Qf6+', 'de'), 'Df6+', 'sanFor de');
eq(sanFor('Qf6+', 'en'), 'Qf6+', 'sanFor en');
eq(titleLine(GAMES.immortal, 'en'), 'Adolf Anderssen vs Lionel Kieseritzky, London 1851', 'titleLine en');
eq(titleLine(GAMES.immortal, 'de'), 'Adolf Anderssen gegen Lionel Kieseritzky, London 1851', 'titleLine de');
check(gameById('nope') === GAMES[DEFAULT_GAME] && DEFAULT_GAME === 'immortal', 'gameById falls back to immortal');

process.exit(bad ? 1 : 0);
