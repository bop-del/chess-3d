// Test aid for the Online tab (CHE-301): ?online=<any url>&onlinepv=list|wait|chat|min.
// A fake api with fake players and messages, no server. index.js uses it instead of createApi when the flag is set.
export const previewOn = (search = typeof location !== 'undefined' ? location.search : '') => new URLSearchParams(search).has('onlinepv');
export const previewScene = (search = typeof location !== 'undefined' ? location.search : '') => {
  const v = new URLSearchParams(search).get('onlinepv');
  return ['list', 'wait', 'chat', 'min'].includes(v) ? v : 'list';
};

const MIN = 60000;
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
    stop() {}, retry() {}, details: () => ({ cause: '', lastOk: now, retryIn: 0 }),
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
