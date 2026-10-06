// The Online tab (CHE-271): loaded by ui.js only with ?online=<server url>. Login by invite (the link's key or the code field), the
// connection line with its Details box, challenges, the one online game, the player list with presence and score, and one chat per
// opponent. The game itself runs through src/online/match.js on the normal 3D board; the transport is src/online/api.js.
// Test hook: window.__chessOnline { state, status, match, api, login(code), render() }.
import { t, onLanguage, translateTree } from '../i18n.js';
import { LABEL as VERSION } from '../version.js';
import './strings.js';
import './online.css';
import { loginFor, writeLogin } from './store.js';
import { createApi, loginWithCode } from './api.js';
import { createMatch } from './match.js';
import { detailsText } from './details.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEEN = 'chess3d.onlineSeen';
const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** wins : losses from your side, then the draws only when there are some; a dash when never played */
export const scoreText = (s) => (!s || !(s.w + s.l + s.d) ? '-' : `${s.w} : ${s.l}${s.d ? `  ½ ${s.d}` : ''}`);
const seenGet = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '{}'); } catch (e) { return {}; } };
const seenSet = (v) => { try { localStorage.setItem(SEEN, JSON.stringify(v)); } catch (e) { /* blocked: for this page only */ } };

export function mountOnline({ server, host, hud, game, controls, toast = () => {}, setDot = () => {}, isVisible = () => true, closeSheets = () => {}, setBoard = () => {}, onShown }) {
  let login = loginFor(server);
  let api = null, match = null, state = null, status = 'connecting', receivedAt = 0;
  let chatWith = null, confirmResign = false, detailsOpen = false, lockDetails = false, codeErr = '';
  const seen = seenGet();   // { game: last finished game id acknowledged, out: last declined challenge id acknowledged }

  const root = document.createElement('div');
  root.className = 'onl';
  root.innerHTML = `
    <div class="oconn" data-s="connecting" role="status"><i></i><span class="otxt"></span><button class="obtn small" type="button" data-a="details" hidden data-i18n="online.details">Details</button></div>
    <div class="odet-host"></div>
    <div class="ologin" hidden>
      <p class="oneed" data-i18n="online.needInvite">Online play needs an invite. Please ask for an invite link.</p>
      <form class="ocode" autocomplete="off"><label><span data-i18n="online.codeLabel">Enter code</span><input name="code" type="text" inputmode="text" autocapitalize="characters" spellcheck="false" maxlength="24" placeholder="NAME-XXXX"></label><button class="obtn gold" type="submit" data-i18n="online.codeGo">Log in</button></form>
      <p class="oerr" hidden></p>
    </div>
    <div class="omain" hidden>
      <p class="ome"></p>
      <div class="ochal"></div>
      <div class="ogame"></div>
      <h4 data-i18n="online.players">Players</h4>
      <ul class="oplayers"></ul>
      <section class="ochat" hidden>
        <header><b class="owith"></b><button class="obtn small" type="button" data-a="chat-close" data-i18n="online.close">Close</button></header>
        <ol class="omsgs"></ol>
        <form class="osend" autocomplete="off"><input name="text" type="text" maxlength="200" enterkeyhint="send" data-i18n-aria="online.message" aria-label="Message"><button class="obtn gold" type="submit" data-i18n="online.send">Send</button></form>
        <small class="omon" data-i18n="online.monitored">Chat monitored</small>
        <p class="oerr" hidden></p>
      </section>
    </div>`;
  host.append(root);
  const $ = (s, r = root) => r.querySelector(s);

  // the board lock line: over the board while an online game has no connection
  const lock = document.createElement('div');
  lock.className = 'olock';
  lock.hidden = true;
  lock.innerHTML = `<p><i></i><span data-i18n="online.lockLine">No connection, your move will work again soon</span><button class="obtn small" type="button" data-a="lock-details" data-i18n="online.details">Details</button></p><div class="odet-host"></div>`;
  hud.append(lock);

  // ------------------------------------------------------------ the Details box (two places, one content)
  function detailsHtml() {
    const d = api ? api.details() : {};
    const cause = { offline: 'This device has no internet right now.', noanswer: 'The server does not answer.', server: 'The server has an error.', invite: 'The invite is no longer valid.' }[d.cause] || 'The server does not answer.';
    const secs = Math.ceil((d.retryIn || 0) / 1000);
    return `<div class="odet"><p class="ocause">${esc(t(`online.cause.${d.cause || 'noanswer'}`, cause))}</p>
      <p class="olast">${esc(d.lastOk ? t('online.lastOk', 'Last connected: {time}', { time: hhmm(d.lastOk) }) : t('online.neverOk', 'Not connected yet'))}</p>
      <p class="onext">${esc(secs ? t('online.retryIn', 'Next try in {s} s', { s: secs }) : t('online.retrying', 'Trying now...'))}</p>
      <div class="orow"><button class="obtn" type="button" data-a="retry">${esc(t('online.retry', 'Try again'))}</button><button class="obtn" type="button" data-a="copy">${esc(t('online.copy', 'Copy details'))}</button></div>
      <pre class="otech">${esc(techText())}</pre></div>`;
  }
  const techText = () => { const d = api ? api.details() : {}; return detailsText({ ...d, time: Date.now() }, [login?.key]); };
  function renderDetails() {
    const red = status === 'unreachable';
    const a = $('.odet-host'), b = $('.odet-host', lock);
    a.innerHTML = red && detailsOpen ? detailsHtml() : '';
    b.innerHTML = lockDetails && !lock.hidden ? detailsHtml() : '';
  }
  async function copyDetails(btn) {
    const text = techText();
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* nothing more to try */ }
      ta.remove();
    }
    btn.textContent = t('online.copied', 'Copied');
  }

  // ------------------------------------------------------------ rendering
  const sideName = (c) => (c === 'w' ? t('side.white', 'White') : t('side.black', 'Black'));
  const nowServer = () => (state ? state.now + (Date.now() - receivedAt) : Date.now());
  const myGame = () => (state?.game && state.game.status === 'active' ? state.game : null);
  const scoreWith = (name) => state?.players.find((p) => p.name === name)?.score;

  function renderConn() {
    const c = $('.oconn');
    c.hidden = !login;
    c.dataset.s = status;
    $('.otxt', c).textContent = t(`online.conn.${status}`, { connected: 'Server connected', connecting: 'connecting...', unreachable: 'Server unreachable' }[status]);
    $('[data-a=details]', c).hidden = status !== 'unreachable';
    if (status !== 'unreachable') detailsOpen = false;
    const showLock = !!match?.locked;
    if (!showLock) lockDetails = false;
    lock.hidden = !showLock;
    document.body.classList.toggle('online-locked', showLock);
    renderDetails();
  }

  function renderMain() {
    const logged = !!login && !!state;
    const needCode = !login || (status === 'unreachable' && api?.details().cause === 'invite');
    $('.ologin').hidden = !needCode;
    const err = $('.ologin .oerr'); err.hidden = !codeErr; err.textContent = codeErr;
    $('.omain').hidden = !logged;
    if (!logged) return;
    const g = state.game, active = myGame();
    $('.ome').textContent = t('online.you', 'You are {name}', { name: state.me.name });

    // challenges in and out
    const parts = [];
    for (const c of state.challenges.in) {
      parts.push(`<div class="ocard"><p>${esc(t('online.challengesYou', '{name} challenges you', { name: c.from }))}</p><div class="orow"><button class="obtn gold" type="button" data-a="accept" data-id="${c.id}">${esc(t('online.accept', 'Accept'))}</button><button class="obtn" type="button" data-a="decline" data-id="${c.id}">${esc(t('online.decline', 'No thanks'))}</button></div></div>`);
    }
    for (const c of state.challenges.out) {
      if (c.status === 'open') parts.push(`<div class="ocard"><p>${esc(t('online.waiting', 'Waiting for {name}...', { name: c.to }))}</p></div>`);
      else if (c.status === 'declined' && seen.out !== c.id) parts.push(`<div class="ocard"><p>${esc(t('online.declined', '{name} declined', { name: c.to }))}</p><div class="orow"><button class="obtn" type="button" data-a="seen-out" data-id="${c.id}">${esc(t('online.ok', 'OK'))}</button></div></div>`);
    }
    $('.ochal').innerHTML = parts.join('');

    // the game: running, or the last one finished and not yet acknowledged
    let gh = '';
    if (active) {
      const mine = active.turn === active.color;
      const turnTxt = match?.pending ? t('online.sending', 'Sending the move...') : mine ? t('online.yourTurn', 'Your move') : t('online.theirTurn', '{name} to move', { name: active.opponent });
      const canFinish = active.turn !== active.color && nowServer() >= active.staleAt;
      gh = `<div class="ocard ogamecard${mine ? ' mine' : ''}"><p><b>${esc(t('online.gameWith', 'Game against {name}', { name: active.opponent }))}</b><br>${esc(t('online.youPlay', 'You play {side}', { side: sideName(active.color) }))} · ${esc(turnTxt)}</p>
        <div class="orow">${match?.attached ? '' : `<button class="obtn gold" type="button" data-a="board">${esc(t('online.toBoard', 'Show the game'))}</button>`}<button class="obtn" type="button" data-a="resign">${esc(t('online.resign', 'Resign'))}</button></div>
        ${confirmResign ? `<div class="oconfirm"><p>${esc(t('online.resignAsk', 'Really resign the game?'))}</p><div class="orow"><button class="obtn gold" type="button" data-a="resign-yes">${esc(t('online.yes', 'Yes'))}</button><button class="obtn" type="button" data-a="resign-no">${esc(t('online.cancel', 'Cancel'))}</button></div></div>` : ''}
        ${canFinish ? `<p class="ohint">${esc(t('online.finishHint', '{name} has not moved for 3 days. Ending counts as a win for you.', { name: active.opponent }))}</p><div class="orow"><button class="obtn gold" type="button" data-a="finish">${esc(t('online.finish', 'End the game'))}</button></div>` : ''}</div>`;
    } else if (g && g.status === 'over' && seen.game !== g.id) {
      const res = !g.winner ? t('online.drawn', 'Draw') : g.winner === g.color ? t('online.won', 'You won') : t('online.lost', 'You lost');
      gh = `<div class="ocard oresult"><p><b>${esc(res)}</b><br><span class="oscoreline">${esc(t('online.scoreNow', 'Against {name} now {score}', { name: g.opponent, score: scoreText(scoreWith(g.opponent)) }))}</span></p><div class="orow"><button class="obtn" type="button" data-a="seen-game" data-id="${g.id}">${esc(t('online.ok', 'OK'))}</button></div></div>`;
    }
    $('.ogame').innerHTML = gh;

    // the players
    const outTo = state.challenges.out.find((c) => c.status === 'open')?.to;
    $('.oplayers').innerHTML = state.players.length ? state.players.map((p) => {
      let act = '';
      if (p.playing) act = `<span class="oplay">${esc(t('online.playing', 'playing'))}</span>`;
      else if (!active && !p.withMe && outTo !== p.name) act = `<button class="obtn" type="button" data-a="challenge" data-n="${esc(p.name)}">${esc(t('online.challenge', 'Challenge'))}</button>`;
      return `<li class="op${chatWith === p.name ? ' on' : ''}"><button class="oname" type="button" data-a="chat" data-n="${esc(p.name)}" title="${esc(t('online.chatWith', 'Chat with {name}', { name: p.name }))}"><i class="pres${p.online ? ' on' : ''}" title="${esc(p.online ? t('online.online', 'online') : t('online.offline', 'away'))}"></i><span>${esc(p.name)}</span>${p.unread ? '<b class="udot"></b>' : ''}</button><span class="oscore">${esc(scoreText(p.score))}</span>${act}</li>`;
    }).join('') : `<li class="oempty">${esc(t('online.noPlayers', 'Nobody else is invited yet.'))}</li>`;

    // the chat with one opponent
    const ch = $('.ochat');
    ch.hidden = !chatWith || !state.players.some((p) => p.name === chatWith);
    if (!ch.hidden) {
      $('.owith', ch).textContent = t('online.chatWith', 'Chat with {name}', { name: chatWith });
      const list = state.chats[chatWith] || [];
      const ol = $('.omsgs', ch);
      const key = list.map((m) => m.id).join(',') + i18n();
      if (ol.dataset.key !== key) {
        ol.dataset.key = key;
        ol.innerHTML = list.length ? list.map((m) => `<li class="${m.mine ? 'mine' : ''}"><span>${esc(m.text)}</span><small>${esc(hhmm(m.at))}</small></li>`).join('') : `<li class="oempty">${esc(t('online.noMessages', 'No messages yet.'))}</li>`;
        ol.scrollTop = ol.scrollHeight;
      }
      const muted = state.me.muted;
      $('.osend input', ch).disabled = muted; $('.osend button', ch).disabled = muted;
      const e = $('.oerr', ch);
      if (muted) { e.hidden = false; e.textContent = t('online.muted', 'You cannot write at the moment.'); } else if (e.dataset.kind !== 'send') e.hidden = true;
      markRead();
    }
  }
  const i18n = () => (document.documentElement.lang || '');

  function renderDot() {
    if (!state) { setDot(false); return; }
    const g = myGame();
    const unread = Object.values(state.unread || {}).reduce((a, b) => a + b, 0);
    setDot(state.challenges.in.length > 0 || (!!g && g.turn === g.color) || unread > 0);
  }
  function render() { renderConn(); renderMain(); renderDot(); }

  // the result line on the game over card: "Against Felix now 4 : 2"
  function scoreOnBanner() {
    const g = state?.game;
    if (!g || g.status !== 'over' || !match?.attached) return;
    const card = document.querySelector('#banner .banner-card');
    if (!card) return;
    let p = card.querySelector('.oscore-line');
    if (!p) { p = document.createElement('p'); p.className = 'oscore-line'; card.querySelector('.row')?.before(p); }
    p.textContent = t('online.scoreNow', 'Against {name} now {score}', { name: g.opponent, score: scoreText(scoreWith(g.opponent)) });
  }
  game.on('gameover', () => setTimeout(scoreOnBanner, 0));

  let readBusy = '';
  function markRead() {
    if (!chatWith || !state?.unread?.[chatWith] || !isVisible() || readBusy === chatWith) return;
    readBusy = chatWith;
    api.post('/chat/read', { with: chatWith }).catch(() => {}).finally(() => { readBusy = ''; });
  }

  // ------------------------------------------------------------ actions
  async function act(path, body, { quiet = false } = {}) {
    try { return await api.post(path, body); }
    catch (e) { if (!quiet) toast(e.net ? t('online.codeNet', 'No connection to the server.') : (e.code || 'error'), 'info', 2400); return null; }
  }
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, id = Number(b.dataset.id), n = b.dataset.n;
    if (a === 'details') { detailsOpen = !detailsOpen; renderDetails(); return; }
    if (a === 'retry') { api?.retry(); renderDetails(); return; }
    if (a === 'copy') { copyDetails(b); return; }
    if (a === 'challenge') { await act('/challenge', { to: n }); return; }
    if (a === 'accept') { if (await act('/challenge/answer', { id, accept: true })) closeSheets(); return; }
    if (a === 'decline') { await act('/challenge/answer', { id, accept: false }); return; }
    if (a === 'seen-out') { seen.out = id; seenSet(seen); render(); return; }
    if (a === 'seen-game') { seen.game = id; seenSet(seen); render(); return; }
    if (a === 'board') { match.attach(); closeSheets(); render(); return; }
    if (a === 'resign') { confirmResign = true; render(); return; }
    if (a === 'resign-no') { confirmResign = false; render(); return; }
    if (a === 'resign-yes') { confirmResign = false; const g = myGame(); if (g) await act('/resign', { game: g.id }); render(); return; }
    if (a === 'finish') { const g = myGame(); if (g) await act('/finish-stale', { game: g.id }); return; }
    if (a === 'chat') { chatWith = chatWith === n ? null : n; render(); if (chatWith) $('.osend input').focus({ preventScroll: true }); return; }
    if (a === 'chat-close') { chatWith = null; render(); }
  });
  lock.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'lock-details') { lockDetails = !lockDetails; renderDetails(); }
    else if (b.dataset.a === 'retry') { api?.retry(); renderDetails(); }
    else if (b.dataset.a === 'copy') copyDetails(b);
  });
  // the code field
  $('.ocode').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('.ocode input'), code = input.value.trim();
    if (!code) return;
    codeErr = '';
    try {
      const r = await loginWithCode(server, code);
      input.value = '';
      start({ server, key: r.key, name: r.name });
    } catch (err) {
      codeErr = err.net ? t('online.codeNet', 'No connection to the server.') : err.code === 'slow-down' ? t('online.codeSlow', 'Too many tries. Please wait a few minutes.') : t('online.codeWrong', 'This code does not work.');
    }
    render();
  });
  // a chat message: free text, at most 200 characters, sent with a client id (a retry is stored once)
  let chatN = 0;
  $('.osend').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('.osend input'), text = input.value.trim(), to = chatWith;
    if (!text || !to) return;
    const er = $('.ochat .oerr');
    const cid = `m${Date.now().toString(36)}-${++chatN}`;
    input.value = '';
    for (let i = 0; i < 3; i++) {
      try { await api.post('/chat', { to, text, cid }); er.hidden = true; er.dataset.kind = ''; return; }
      catch (err) { if (!err.net) break; await new Promise((r) => setTimeout(r, 1500)); }
    }
    input.value = text;   // not sent: the text stays for another try
    er.hidden = false; er.dataset.kind = 'send'; er.textContent = t('online.chatFailed', 'Message not sent.');
  });
  root.addEventListener('keydown', (e) => e.stopPropagation());   // typing a code or a message never reaches the board's keys

  // ------------------------------------------------------------ start with a login
  let lastIn = new Set(), lastGameId = 0;
  function start(l) {
    login = l; writeLogin(l);
    api?.stop(); match?.stop();
    api = createApi({
      server, key: l.key, version: VERSION,
      onStatus: (s) => { status = s; if (s === 'connected') match?.retrySend(); render(); },
      onState: (s) => {
        const first = !state;
        state = s; receivedAt = Date.now();
        if (login.name !== s.me.name) { login = { ...login, name: s.me.name }; writeLogin(login); }
        // a new challenge to you, a new game
        const ins = new Set(s.challenges.in.map((c) => c.id));
        if (!first) for (const c of s.challenges.in) if (!lastIn.has(c.id)) toast(t('online.challengesYou', '{name} challenges you', { name: c.from }), 'info', 3200);
        lastIn = ins;
        const g = s.game;
        match.update(s);
        if (g && g.status === 'active' && g.id !== lastGameId) {
          if (lastGameId || !first) { toast(t('online.started', 'Game against {name}. You play {side}.', { name: g.opponent, side: sideName(g.color) }), 'info', 3200); closeSheets(); }
          lastGameId = g.id;
        }
        scoreOnBanner();
        render();
      },
    });
    match = createMatch({ game, controls, api, onChange: () => render(), setBoard });
    render();
  }
  if (login) start(login); else render();

  // the countdown in an open Details box, the 3 day finish appearing on time
  setInterval(() => { if ((detailsOpen || lockDetails) && status === 'unreachable') renderDetails(); else if (lockDetails) renderDetails(); }, 1000);
  setInterval(() => { if (myGame()) renderMain(); }, 30000);
  onLanguage(() => { translateTree(root); translateTree(lock); render(); });
  translateTree(root); translateTree(lock);
  onShown?.(() => { markRead(); renderMain(); });

  const hook = {
    get state() { return state; }, get status() { return status; }, get match() { return match; }, get api() { return api; },
    get login() { return login ? { server: login.server, name: login.name } : null },
    render,
  };
  window.__chessOnline = hook;
  return hook;
}
