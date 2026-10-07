// Player stats (CHE-290): every number is derived from the finished games and their moves the server already stores, so nothing is
// recorded per move and old games count too. Only status 'over' counts (a resigned game is a loss for the one who resigned, a stale
// finish a win for the waiting player: both carry winner_id). Names only, never keys or codes. These are the players' stats with each
// other, not the product analytics of ADR 0010.

// The 20 most common ways a game starts, as SAN prefixes (the longest prefix inside the first 6 plies wins). A small own table instead of
// src/openings/catalogue-data.js: the server image holds only server/ and src/rules.js (server/Dockerfile), the catalogue is 450 KB.
const OPENINGS = [
  ['e4 e5 Nf3 Nc6 Bb5', 'C60', 'Ruy Lopez'], ['e4 e5 Nf3 Nc6 Bc4', 'C50', 'Italian Game'], ['e4 e5 Nf3 Nc6 d4', 'C44', 'Scotch Game'],
  ['e4 e5 Nf3 Nf6', 'C42', 'Petrov Defence'], ['e4 e5 f4', 'C30', "King's Gambit"], ['e4 e5 Nf3', 'C40', 'King\'s Knight Opening'], ['e4 e5', 'C20', 'Open Game'],
  ['e4 c5', 'B20', 'Sicilian Defence'], ['e4 e6', 'C00', 'French Defence'], ['e4 c6', 'B10', 'Caro-Kann Defence'], ['e4 d5', 'B01', 'Scandinavian Defence'],
  ['e4 d6', 'B07', 'Pirc Defence'], ['e4 Nf6', 'B02', "Alekhine's Defence"], ['e4 g6', 'B06', 'Modern Defence'],
  ['d4 d5 c4', 'D06', "Queen's Gambit"], ['d4 d5', 'D00', "Queen's Pawn Game"], ['d4 Nf6 c4 g6', 'E60', "King's Indian Defence"], ['d4 Nf6', 'A45', 'Indian Defence'],
  ['d4 f5', 'A80', 'Dutch Defence'], ['c4', 'A10', 'English Opening'], ['Nf3', 'A04', 'Zukertort Opening'], ['f4', 'A02', "Bird's Opening"],
  ['g3', 'A00', 'Hungarian Opening'], ['b3', 'A01', 'Nimzo-Larsen Attack'], ['e4', 'B00', "King's Pawn Game"], ['d4', 'A40', "Queen's Pawn Game"],
].map(([line, eco, name]) => ({ san: line.split(' '), eco, name }));

/** { eco, name } for the first plies of a game (SAN list), the longest named prefix, or null */
export function openingOf(sans) {
  const first = sans.slice(0, 6).map((s) => s.replace(/[+#]/g, ''));
  let best = null;
  for (const o of OPENINGS) if (o.san.length <= first.length && o.san.every((s, i) => s === first[i]) && (!best || o.san.length > best.san.length)) best = o;
  return best ? { eco: best.eco, name: best.name } : null;
}

const zero = () => ({ games: 0, wins: 0, losses: 0, draws: 0 });
const outcomeOf = (g, pid) => (!g.winner_id ? 'draw' : g.winner_id === pid ? 'win' : 'loss');
const tally = (t, o) => { t.games++; if (o === 'win') t.wins++; else if (o === 'loss') t.losses++; else t.draws++; };
const round1 = (x) => Math.round(x * 10) / 10;

/** The numbers of a player (id) from the finished games. `vs`: the id of the asking player, then headToHead is from that player's side. */
export function statsFor(db, playerId, { vs = null } = {}) {
  const games = db.prepare("SELECT * FROM games WHERE status = 'over' AND (white_id = ? OR black_id = ?) ORDER BY COALESCE(ended, last_move_at), id").all(playerId, playerId);
  const movesOf = db.prepare('SELECT san, at FROM moves WHERE game_id = ? ORDER BY ply');
  const nameOf = db.prepare('SELECT name FROM players WHERE id = ?');
  const total = zero(), by = new Map(), head = zero(), openings = new Map();
  const best = { wins: 0, losses: 0, draws: 0 };
  let run = { type: null, n: 0 };
  const lens = [], mins = [];
  let longest = 0, shortestWin = 0;
  for (const g of games) {
    const o = outcomeOf(g, playerId);
    tally(total, o);
    const other = g.white_id === playerId ? g.black_id : g.white_id;
    if (!by.has(other)) by.set(other, { name: nameOf.get(other)?.name || '?', ...zero() });
    tally(by.get(other), o);
    if (vs != null && other === vs) tally(head, outcomeOf(g, vs));   // the asker's side
    run = run.type === o ? { type: o, n: run.n + 1 } : { type: o, n: 1 };
    const key = o === 'win' ? 'wins' : o === 'loss' ? 'losses' : 'draws';
    best[key] = Math.max(best[key], run.n);
    const mv = movesOf.all(g.id);
    const full = Math.ceil(mv.length / 2);
    lens.push(full);
    longest = Math.max(longest, full);
    if (o === 'win' && full && (!shortestWin || full < shortestWin)) shortestWin = full;
    if (mv.length > 1) mins.push((mv[mv.length - 1].at - mv[0].at) / 60000);
    const op = openingOf(mv.map((m) => m.san));
    if (op) { const e = openings.get(op.name) || { eco: op.eco, name: op.name, n: 0 }; e.n++; openings.set(op.name, e); }
  }
  const avg = (a) => (a.length ? round1(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  return {
    ...total,
    streak: { current: run.type ? { type: run.type, n: run.n } : { type: null, n: 0 }, best },
    perOpponent: [...by.values()].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name)),
    details: {
      avgMoves: avg(lens), avgMinutes: avg(mins), longestGameMoves: longest, shortestWinMoves: shortestWin,
      openings: [...openings.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    },
    headToHead: vs != null && vs !== playerId ? head : null,
  };
}
