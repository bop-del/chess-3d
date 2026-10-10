// Test aid for the Online tab (CHE-301, CHE-290, CHE-272): ?online=<any url>&onlinepv=list|wait|chat|min|stats|card|pushcard|bell|multi|running|updating (updating: the Server update line instead of the cards, CHE-405; running: four running games with waiting times, one on the last day each way; multi: two running games, an open challenge out, one in; stats: own numbers and a long
// name with no game; card: the detail card of Nina is open; pushcard and bell: the push permission card and the bell on a fake push).
// A fake api with fake players and messages, no server. index.js uses it instead of createApi when the flag is set.
export const previewOn = (search = typeof location !== 'undefined' ? location.search : '') => new URLSearchParams(search).has('onlinepv');
export const previewScene = (search = typeof location !== 'undefined' ? location.search : '') => {
  const v = new URLSearchParams(search).get('onlinepv');
  return ['list', 'wait', 'chat', 'min', 'stats', 'card', 'pushcard', 'bell', 'multi', 'running', 'updating', 'redesign', 'redesign3', 'result', 'login'].includes(v) ? v : 'list';
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
    games: [], game: null,
    chats: {
      Nina: [msg(false, 'Hallo Boris! Spielen wir?', 9), msg(true, 'Gleich, ich mache erst den Tisch fertig.', 7), msg(false, 'Okay, ich warte.', 3), msg(false, 'Ich nehme Weiß!', 2)],
      Felix: [msg(false, 'Schau mal, mein neuer Zug', 5)],
      Mia: [msg(true, 'Gute Partie gestern', 1440), msg(false, 'Danke, morgen wieder?', 1430)],
    },
    unread: { Nina: 2, Felix: 1 },
  };
  const mk = (gid, opp, moves, color) => ({
    id: gid, color, opponent: opp, white: color === 'w' ? 'Boris' : opp, black: color === 'w' ? opp : 'Boris', moves, sans: moves, turn: (moves.length % 2 ? 'b' : 'w'),
    status: 'active', result: null, reason: null, winner: null, lastMoveAt: now - 60 * MIN, staleAt: now + 71 * 60 * MIN, canFinish: false,
  });
  if (scene === 'multi') {   // CHE-335: Boris plays Nina (his move) and Mia (her move), asked Felix, and Opa asks him
    st.games = [mk(12, 'Mia', ['d2d4'], 'w'), mk(11, 'Nina', ['e2e4', 'e7e5'], 'w')];
    st.players.find((p) => p.name === 'Nina').withMe = true; st.players.find((p) => p.name === 'Mia').withMe = true;
    st.players.find((p) => p.name === 'Opa').playing = false;
    st.challenges = { in: [{ id: 9, from: 'Opa', at: now }], out: [{ id: 7, to: 'Felix', status: 'open', at: now }] };
    st.game = st.games[0];
  }
  if (scene === 'running') {   // CHE-403: Nina (your move, 2 h), Felix (your move, 60 h: 12 h left, then he wins), Mia (her move, 12 min), Opa (his move, 67 h: 5 h left, then you can end it)
    const ago = (m) => ({ lastMoveAt: now - m * MIN, staleAt: now - m * MIN + 72 * 60 * MIN });
    st.games = [
      { ...mk(14, 'Opa', ['e2e4', 'e7e5', 'g1f3'], 'w'), ...ago(66.5 * 60) }, { ...mk(13, 'Mia', ['d2d4'], 'w'), ...ago(12) },
      { ...mk(12, 'Felix', ['e2e4', 'c7c5'], 'w'), ...ago(59.5 * 60) }, { ...mk(11, 'Nina', ['e2e4', 'e7e5'], 'w'), ...ago(120) },
    ];
    for (const n of ['Nina', 'Felix', 'Mia', 'Opa']) st.players.find((p) => p.name === n).withMe = true;
    st.challenges = { in: [], out: [] };
    st.game = st.games[0];
  }
  if (scene === 'redesign' || scene === 'redesign3' || scene === 'result') {   // CHE-421: the same content a running game with Felix (your move), Nina without a game, Opa challenges you, unread chat from Nina and Felix
    st.games = [mk(21, 'Felix', ['e2e4', 'e7e5', 'g1f3', 'b8c6'], 'w')];
    st.games[0].lastMoveAt = now - 130 * MIN; st.games[0].staleAt = now + 70 * 60 * MIN;
    st.players.find((p) => p.name === 'Felix').withMe = true;
    st.players.find((p) => p.name === 'Felix').score = { w: 1, l: 0, d: 1 };
    st.players.find((p) => p.name === 'Opa').playing = false;
    st.challenges = { in: [{ id: 9, from: 'Opa', at: now }], out: [] };
    st.game = st.games[0];
  }
  if (scene === 'redesign3') {   // CHE-421: three running games: Felix (your move, 2 h), Mia (your move, 5 h), Nina (her move, 12 min); Opa still challenges
    const ago = (m) => ({ lastMoveAt: now - m * MIN, staleAt: now - m * MIN + 72 * 60 * MIN });
    st.games = [{ ...st.games[0], ...ago(130) }, { ...mk(22, 'Mia', ['d2d4', 'd7d5', 'c2c4'], 'w'), ...ago(300) }, { ...mk(23, 'Nina', ['e2e4'], 'w'), ...ago(12) }];
    for (const n of ['Mia', 'Nina']) st.players.find((p) => p.name === n).withMe = true;
  }
  if (scene === 'result') {   // CHE-421: Boris just won against Mia: the result card with the score
    st.games = [{ ...mk(24, 'Mia', ['e2e4', 'e7e5'], 'w'), status: 'over', winner: 'w', result: '1-0', reason: 'resign' }, ...st.games];
    st.players.find((p) => p.name === 'Mia').score = { w: 1, l: 3, d: 1 };
  }
  setTimeout(() => { onStatus('connected'); onState(JSON.parse(JSON.stringify(st))); }, 0);
  const push = () => onState(JSON.parse(JSON.stringify(st)));
  return {
    stop() {}, retry() {}, connected: true,
    sim(mutate) { mutate(st); st.now = Date.now(); push(); },   // test aid: the server changes something (a move in another game)
    stats: async (name) => ({ name, own: name === 'Boris', ...(FAKE_STATS[name] || ZERO) }), details: () => ({ cause: '', lastOk: now, retryIn: 0 }),
    async post(path, body) {
      if (path === '/chat') (st.chats[body.to] ||= []).push({ id: ++id, mine: true, text: body.text, at: Date.now() });
      else if (path === '/chat/read') { const p = st.players.find((x) => x.name === body.with); if (p) p.unread = 0; delete st.unread[body.with]; }
      else if (path === '/challenge') { if (!st.challenges.out.some((c) => c.to === body.to && c.status === 'open')) st.challenges.out.push({ id: ++id, to: body.to, status: 'open' }); }   // several at once, the same player only once
      else if (path === '/challenge/cancel') st.challenges.out = st.challenges.out.filter((c) => body.id != null && c.id !== body.id);
      else if (path === '/challenge/answer') {
        const c = st.challenges.in.find((x) => x.id === body.id);
        st.challenges.in = st.challenges.in.filter((x) => x.id !== body.id);
        if (c && body.accept) {
          const gm = mk(++id, c.from, [], 'w'); st.games = [gm, ...(st.games || [])]; st.game = gm;
          const p = st.players.find((x) => x.name === c.from); if (p) p.withMe = true;
        }
      }
      st.now = Date.now();
      push();
      return {};
    },
  };
}

/** CHE-272: a fake browser for push, so the card and the bell can be looked at with no server and no permission prompt */
export function previewPushEnv(scene) {
  let permission = scene === 'bell' ? 'granted' : 'default', sub = scene === 'bell' ? { endpoint: 'https://push.invalid/x', toJSON: () => ({ endpoint: 'https://push.invalid/x', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => { sub = null; return true; } } : null;
  const pm = { getSubscription: async () => sub, subscribe: async () => (sub = { endpoint: 'https://push.invalid/x', toJSON: () => ({ endpoint: 'https://push.invalid/x', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => { sub = null; return true; } }) };
  const reg = { pushManager: pm };
  return {
    sw: { register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg },
    hasPush: true, iosTab: false,
    Notification: { get permission() { return permission; }, requestPermission: async () => (permission = 'granted') },
  };
}
