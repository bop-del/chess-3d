// Test aid for the Online tab (CHE-301, CHE-290): ?online=<any url>&onlinepv=list|wait|chat|min|stats|card (stats: own numbers and a long name
// with no game; card: the detail card of Nina is open).
// A fake api with fake players and messages, no server. index.js uses it instead of createApi when the flag is set.
export const previewOn = (search = typeof location !== 'undefined' ? location.search : '') => new URLSearchParams(search).has('onlinepv');
export const previewScene = (search = typeof location !== 'undefined' ? location.search : '') => {
  const v = new URLSearchParams(search).get('onlinepv');
  return ['list', 'wait', 'chat', 'min', 'stats', 'card'].includes(v) ? v : 'list';
};

const MIN = 60000;
const ZERO = { games: 0, wins: 0, losses: 0, draws: 0, streak: { current: { type: null, n: 0 }, best: { wins: 0, losses: 0, draws: 0 } }, perOpponent: [], details: { avgMoves: 0, avgMinutes: 0, longestGameMoves: 0, shortestWinMoves: 0, openings: [] }, headToHead: null };
// fake numbers in the shape of GET /player/<name> (server/playerstats.mjs)
const FAKE_STATS = {
  Boris: { games: 14, wins: 8, losses: 4, draws: 2, streak: { current: { type: 'win', n: 3 }, best: { wins: 5, losses: 2, draws: 1 } }, perOpponent: [{ name: 'Nina', games: 7, wins: 5, losses: 2, draws: 0 }], details: { avgMoves: 31, avgMinutes: 18.4, longestGameMoves: 62, shortestWinMoves: 11, openings: [{ eco: 'C50', name: 'Italian Game', n: 5 }, { eco: 'B20', name: 'Sicilian Defence', n: 3 }, { eco: 'A40', name: "Queen's Pawn Game", n: 2 }, { eco: 'C20', name: 'Open Game', n: 1 }] }, headToHead: null },
  Nina: { games: 9, wins: 3, losses: 5, draws: 1, streak: { current: { type: 'loss', n: 2 }, best: { wins: 2, losses: 3, draws: 1 } }, perOpponent: [], details: { avgMoves: 27, avgMinutes: 12.6, longestGameMoves: 48, shortestWinMoves: 14, openings: [{ eco: 'C50', name: 'Italian Game', n: 4 }, { eco: 'B01', name: 'Scandinavian Defence', n: 2 }] }, headToHead: { games: 5, wins: 3, losses: 2, draws: 0 } },
  Felix: { games: 2, wins: 1, losses: 0, draws: 1, streak: { current: { type: 'draw', n: 1 }, best: { wins: 1, losses: 0, draws: 1 } }, perOpponent: [], details: { avgMoves: 9, avgMinutes: 0.6, longestGameMoves: 12, shortestWinMoves: 6, openings: [{ eco: 'C20', name: 'Open Game', n: 2 }] }, headToHead: { games: 0, wins: 0, losses: 0, draws: 0 } },
  Mia: { games: 4, wins: 1, losses: 3, draws: 0, streak: { current: { type: 'win', n: 1 }, best: { wins: 1, losses: 3, draws: 0 } }, perOpponent: [], details: { avgMoves: 22, avgMinutes: 8, longestGameMoves: 30, shortestWinMoves: 18, openings: [] }, headToHead: { games: 4, wins: 3, losses: 1, draws: 0 } },
};
export function createPreviewApi({ scene, onState, onStatus }) {
  const now = Date.now();
  let id = 100;
  const msg = (mine, text, ago) => ({ id: ++id, mine, text, at: now - ago * MIN });
  const st = {
    now,
    me: { name: 'Boris', muted: false },
    players: [
      { name: 'Nina', online: true, playing: false, withMe: false, score: { w: 2, l: 1, d: 0 }, unread: 2 },
      { name: 'Felix', online: true, playing: false, withMe: false, score: null, unread: 1 },
      { name: 'Mia', online: false, playing: false, withMe: false, score: { w: 0, l: 3, d: 1 }, unread: 0 },
      { name: 'Opa', online: true, playing: true, withMe: false, score: null, unread: 0 },
      ...(scene === 'stats' || scene === 'card' ? [{ name: 'Maximiliane-Charlotte', online: false, playing: false, withMe: false, score: null, unread: 0 }] : []),
    ],
    challenges: { in: [], out: scene === 'wait' ? [{ id: 7, to: 'Nina', status: 'open' }] : [] },
    game: null,
    chats: {
      Nina: [msg(false, 'Hallo Boris! Spielen wir?', 9), msg(true, 'Gleich, ich mache erst den Tisch fertig.', 7), msg(false, 'Okay, ich warte.', 3), msg(false, 'Ich nehme Weiß!', 2)],
      Felix: [msg(false, 'Schau mal, mein neuer Zug', 5)],
      Mia: [msg(true, 'Gute Partie gestern', 1440), msg(false, 'Danke, morgen wieder?', 1430)],
    },
    unread: { Nina: 2, Felix: 1 },
  };
  setTimeout(() => { onStatus('connected'); onState(JSON.parse(JSON.stringify(st))); }, 0);
  const push = () => onState(JSON.parse(JSON.stringify(st)));
  return {
    stop() {}, retry() {},
    stats: async (name) => ({ name, own: name === 'Boris', ...(FAKE_STATS[name] || ZERO) }), details: () => ({ cause: '', lastOk: now, retryIn: 0 }),
    async post(path, body) {
      if (path === '/chat') (st.chats[body.to] ||= []).push({ id: ++id, mine: true, text: body.text, at: Date.now() });
      else if (path === '/chat/read') { const p = st.players.find((x) => x.name === body.with); if (p) p.unread = 0; delete st.unread[body.with]; }
      else if (path === '/challenge') st.challenges.out = [{ id: ++id, to: body.to, status: 'open' }];
      else if (path === '/challenge/cancel') st.challenges.out = [];
      st.now = Date.now();
      push();
      return {};
    },
  };
}
