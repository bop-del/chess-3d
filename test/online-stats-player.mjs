// Player stats (CHE-290, fast tier, no browser): statsFor on scripted games in a temporary SQLite (wins, losses, draws, a resign, a
// running game that must not count, a streak across a draw, head to head both directions, openings, durations) and GET /player/<name>
// (key needed, unknown and revoked names 404, own card without head to head, no key or code in the answer).
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { statsFor, openingOf } from '../server/playerstats.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

const MIN = 60000;
let clock = Date.UTC(2026, 9, 7, 12), gid = 0;
const app = createOnlineServer({ db: openDb(':memory:'), now: () => clock });
const db = app.db;
const port = await app.listen(0, '127.0.0.1');
const BASE = `http://127.0.0.1:${port}`;
try {
  const inv = Object.fromEntries(['Boris', 'Felix', 'Nina', 'Mia'].map((n) => [n, app.admin.invite(n)]));
  const id = Object.fromEntries(Object.keys(inv).map((n) => [n, app.admin.byName(n).id]));
  // a scripted game: white, black, winner name or null, status, the SAN moves, minutes between the first and the last move
  function game(w, b, winner, sans, minutes, { status = 'over', reason = 'checkmate' } = {}) {
    const t0 = clock; clock += 60 * MIN;
    const r = db.prepare('INSERT INTO games (white_id, black_id, status, result, reason, winner_id, created, last_move_at, ended) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id[w], id[b], status, status === 'over' ? (winner ? (winner === w ? '1-0' : '0-1') : '1/2-1/2') : null, status === 'over' ? reason : null, winner ? id[winner] : null, t0, t0, status === 'over' ? clock : null);
    gid = Number(r.lastInsertRowid);
    sans.forEach((san, ply) => db.prepare('INSERT INTO moves (game_id, ply, uci, san, at) VALUES (?, ?, ?, ?, ?)').run(gid, ply, 'a1a1', san, t0 + (ply * minutes * MIN) / Math.max(1, sans.length - 1)));
  }
  const ruy = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4'], sicilian = ['e4', 'c5', 'Nf3', 'd6'];
  game('Boris', 'Felix', 'Boris', ruy, 10);                                  // 1 win,  7 plies = 4 moves
  game('Felix', 'Boris', 'Boris', sicilian, 4);                              // 2 win,  4 plies = 2 moves (black)
  game('Boris', 'Felix', null, ['d4', 'd5', 'c4', 'e6'], 6, { reason: 'stalemate' });   // 3 draw breaks the streak
  game('Boris', 'Felix', 'Boris', ruy, 10);                                  // 4 win
  game('Felix', 'Nina', 'Felix', ['g3'], 1);                                 // not Boris
  game('Nina', 'Boris', 'Nina', ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], 8);  // 5 loss, 4 moves
  game('Boris', 'Mia', 'Mia', ['e4', 'e5', 'f4'], 3, { reason: 'resign' });  // 6 resigned by Boris: a loss, 2 moves
  game('Boris', 'Mia', null, ['e4', 'e5'], 0, { status: 'active', reason: null });      // running: must not count
  game('Boris', 'Felix', null, ['e4'], 0, { status: 'active', reason: null });          // running: must not count

  const b = statsFor(db, id.Boris);
  eq('Boris totals', [b.games, b.wins, b.losses, b.draws], [6, 3, 2, 1]);
  eq('a running game does not count', b.games, 6);
  eq('current streak is the last result', b.streak.current, { type: 'loss', n: 2 });
  eq('best streaks: a draw breaks a win run', b.streak.best, { wins: 2, losses: 2, draws: 1 });
  eq('per opponent, most games first', b.perOpponent.map((o) => [o.name, o.games, o.wins, o.losses, o.draws]), [['Felix', 4, 3, 0, 1], ['Mia', 1, 0, 1, 0], ['Nina', 1, 0, 1, 0]]);
  eq('longest and shortest win in moves', [b.details.longestGameMoves, b.details.shortestWinMoves], [4, 2]);
  eq('average moves', b.details.avgMoves, 3);
  ok('average minutes from the move timestamps', b.details.avgMinutes === 6.8, String(b.details.avgMinutes));
  eq('openings counted', b.details.openings.map((o) => [o.name, o.n]), [['Ruy Lopez', 2], ["King's Gambit", 1], ['Open Game', 1], ['Queen\'s Gambit', 1], ['Sicilian Defence', 1]].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])));
  eq('no head to head without an asker', b.headToHead, null);
  const felixAsks = statsFor(db, id.Boris, { vs: id.Felix }).headToHead, borisAsks = statsFor(db, id.Felix, { vs: id.Boris }).headToHead;
  eq('head to head from the asker (Felix asks about Boris)', felixAsks, { games: 4, wins: 0, losses: 3, draws: 1 });
  eq('head to head from the asker (Boris asks about Felix)', borisAsks, { games: 4, wins: 3, losses: 0, draws: 1 });
  eq('own card: no head to head', statsFor(db, id.Boris, { vs: id.Boris }).headToHead, null);
  const f = statsFor(db, id.Felix);
  eq('Felix totals (a win by the asker side stays a win)', [f.games, f.wins, f.losses, f.draws], [5, 1, 3, 1]);
  const none = statsFor(db, id.Mia, { vs: id.Nina });
  eq('Mia: one win from the resign', [none.games, none.wins], [1, 1]);
  eq('a player with no game', statsFor(db, app.admin.invite('Opa') && app.admin.byName('Opa').id).streak, { current: { type: null, n: 0 }, best: { wins: 0, losses: 0, draws: 0 } });
  eq('openingOf: longest prefix', openingOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']), { eco: 'C50', name: 'Italian Game' });
  eq('openingOf: check marks ignored', openingOf(['e4', 'e5', 'Qh5+']).name, 'Open Game');
  eq('openingOf: unknown start', openingOf(['a3', 'e5']), null);

  // the route
  const get = async (path, key) => { const r = await fetch(BASE + path, { headers: key ? { Authorization: `Bearer ${key}` } : {} }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ } return { status: r.status, text, json }; };
  eq('no key: 401', (await get('/player/Felix')).status, 401);
  eq('unknown key: 401', (await get('/player/Felix', 'nope')).status, 401);
  const r1 = await get('/player/Felix', inv.Boris.key);
  eq('GET /player/Felix', [r1.status, r1.json.name, r1.json.own, r1.json.games], [200, 'Felix', false, 5]);
  eq('route head to head is from the asker', r1.json.headToHead, { games: 4, wins: 3, losses: 0, draws: 1 });
  eq('name is case insensitive', (await get('/player/felix', inv.Boris.key)).json.name, 'Felix');
  const own = await get('/player/Boris', inv.Boris.key);
  eq('own card answers without head to head', [own.status, own.json.own, own.json.headToHead, own.json.games], [200, true, null, 6]);
  eq('unknown name: 404', (await get('/player/Nobody', inv.Boris.key)).status, 404);
  eq('bad escape: 404', (await get('/player/%E0%A4', inv.Boris.key)).status, 404);
  eq('empty name: 404', (await get('/player/', inv.Boris.key)).status, 404);
  ok('no key or code in an answer', ![inv.Boris.key, inv.Boris.code, inv.Felix.key, inv.Felix.code].some((s) => r1.text.includes(s) || own.text.includes(s)));
  app.admin.revoke('Nina');
  eq('a revoked player: 404', (await get('/player/Nina', inv.Boris.key)).status, 404);
  app.admin.delete('Mia');
  eq('a deleted player: 404', (await get('/player/Mia', inv.Boris.key)).status, 404);
  eq('their games are gone from the others', statsFor(db, id.Boris).games, 5);
} finally { await app.close(); }
console.log(failed ? `\n${failed} FAILED` : '\nplayer stats: ok');
process.exit(failed ? 1 : 0);
