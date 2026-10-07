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
import { startStats } from './stats.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEEN = 'chess3d.onlineSeen';
const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** wins : losses from your side, then the draws only when there are some; a dash when never played */
export const scoreText = (s) => (!s || !(s.w + s.l + s.d) ? '-' : `${s.w} : ${s.l}${s.d ? `  ½ ${s.d}` : ''}`);
const seenGet = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '{}'); } catch (e) { return {}; } };
const seenSet = (v) => { try { localStorage.setItem(SEEN, JSON.stringify(v)); } catch (e) { /* blocked: for this page only */ } };

export function mountOnline({ server, host, hud, game, controls, toast = () => {}, setDot = () => {}, isVisible = () => true, closeSheets = () => {}, setBoard = () => {}, onShown, phone = false, showTab = () => {} }) {
  let login = loginFor(server);
  let api = null, match = null, state = null, status = 'connecting', receivedAt = 0;
  let chatWith = null, chatShown = false, bub = null, bubTimer = 0, bubDone = false, gbub = null, gTimer = 0, confirmResign = false, detailsOpen = false, lockDetails = false, codeErr = '';
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
        <header><i class="grip"></i><b class="owith"></b><button class="ochat-x" type="button" data-a="chat-close" data-i18n-aria="online.close" aria-label="Close">×</button></header>
        <ol class="omsgs"></ol>
        <form class="osend" autocomplete="off"><input name="text" type="text" maxlength="200" enterkeyhint="send" data-i18n-aria="online.message" aria-label="Message"><button class="obtn gold" type="submit" data-i18n="online.send">Send</button></form>
        <small class="omon" data-i18n="online.monitored">Chat monitored</small>
        <p class="oerr" hidden></p>
      </section>
    </div>`;
  host.append(root);
  const $ = (s, r = root) => r.querySelector(s);
  // the chat: inside the tab on a desktop, on a phone its own half height sheet in the hud (a fixed element inside the transformed
  // Online sheet would be fixed to that sheet), lifted by the keyboard through visualViewport
  const ch = $('.ochat');
  const $c = (s) => ch.querySelector(s);
  if (phone) { ch.classList.add('ochs'); hud.append(ch); }
  const chatVisible = () => !!chatWith && (phone ? chatShown : isVisible());

  // the bubble over the board: a new message of a closed chat, or the summary after a load with unread messages
  // two slots, game on top (column-reverse) and chat below, each tappable and closable on its own
  const bubsEl = document.createElement('div');
  bubsEl.className = 'obubs';
  const mkBubEl = (k) => {
    const d = document.createElement('div');
    d.className = 'obub'; d.dataset.k = k; d.hidden = true;
    d.innerHTML = '<button class="obub-main" type="button" data-a="bub"></button><button class="obub-x" type="button" data-a="bub-x" data-i18n-aria="online.bubbleHide" aria-label="Hide">×</button>';
    return d;
  };
  const bubEl = mkBubEl('chat'), gameBubEl = mkBubEl('game');
  bubsEl.append(bubEl, gameBubEl);
  hud.append(bubsEl);
  // the game line over the board while the online game is attached
  const gline = document.createElement('div');
  gline.className = 'ogline';
  gline.hidden = true;
  hud.append(gline);

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

  const chatBtn = (name, n) => `<button class="obtn ochatbtn" type="button" data-a="chat" data-n="${esc(name)}" aria-label="${esc(t('online.chatWith', 'Chat with {name}', { name }) + (n ? ` (${n})` : ''))}">💬 ${esc(t('online.chat', 'Chat'))}${n ? ` <b class="ocnt">${n}</b>` : ''}</button>`;
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
        <div class="orow">${match?.attached ? '' : `<button class="obtn gold" type="button" data-a="board">${esc(t('online.toBoard', 'Show the game'))}</button>`}${chatBtn(active.opponent, state.unread?.[active.opponent] || 0)}<button class="obtn" type="button" data-a="resign">${esc(t('online.resign', 'Resign'))}</button></div>
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
      return `<li class="op${chatWith === p.name ? ' on' : ''}"><div class="ohead"><i class="pres${p.online ? ' on' : ''}" title="${esc(p.online ? t('online.online', 'online') : t('online.offline', 'away'))}"></i><span class="oname">${esc(p.name)}</span><span class="oscore">${esc(scoreText(p.score))}</span></div><div class="oacts">${chatBtn(p.name, p.unread)}${act}</div></li>`;
    }).join('') : `<li class="oempty">${esc(t('online.noPlayers', 'Nobody else is invited yet.'))}</li>`;

    // the chat with one opponent
    ch.hidden = !chatWith || !state.players.some((p) => p.name === chatWith) || (phone && !chatShown);
    if (!ch.hidden) {
      $c('.owith').textContent = t('online.chatWith', 'Chat with {name}', { name: chatWith });
      const list = state.chats[chatWith] || [];
      const ol = $c('.omsgs');
      const key = list.map((m) => m.id).join(',') + i18n();
      if (ol.dataset.key !== key) {
        ol.dataset.key = key;
        ol.innerHTML = list.length ? list.map((m) => `<li class="${m.mine ? 'mine' : ''}"><span>${esc(m.text)}</span><small>${esc(hhmm(m.at))}</small></li>`).join('') : `<li class="oempty">${esc(t('online.noMessages', 'No messages yet.'))}</li>`;
        ol.scrollTop = ol.scrollHeight;
      }
      const muted = state.me.muted;
      $c('.osend input').disabled = muted; $c('.osend button').disabled = muted;
      const e = $c('.oerr');
      if (muted) { e.hidden = false; e.textContent = t('online.muted', 'You cannot write at the moment.'); } else if (e.dataset.kind !== 'send') e.hidden = true;
      markRead();
    }
  }
  const i18n = () => (document.documentElement.lang || '');

  const unreadTotal = () => Object.values(state?.unread || {}).reduce((a, b) => a + b, 0);
  function renderDot() {
    if (!state) { setDot(false, 0); return; }
    const g = myGame(), n = unreadTotal();
    setDot(n > 0 || state.challenges.in.length > 0 || (!!g && g.turn === g.color), n);   // the number while something is unread, else the plain dot
  }

  // ------------------------------------------------------------ the bubble
  const joinNames = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} ${t('online.and', 'and')} ${a[a.length - 1]}`);
  function bubText() {
    if (!bub) return '';
    if (bub.kind === 'msg') return t('online.bubbleMsg', '💬 {name}: {text} ›', { name: bub.name, text: bub.text });
    const names = Object.keys(state?.unread || {}).filter((k) => state.unread[k] > 0);
    if (names.length === 1) {
      const n = state.unread[names[0]], last = [...(state.chats[names[0]] || [])].reverse().find((m) => !m.mine);
      return t('online.bubbleOne', '💬 {name}: {text}{more} ›', { name: names[0], text: last?.text || '', more: n > 1 ? ` (+${n - 1})` : '' });
    }
    return t('online.bubbleMany', '💬 {n} new messages from {names} ›', { n: unreadTotal(), names: joinNames(names) });
  }
  const turnText = (g) => (g.turn === g.color ? t('online.yourTurn', 'Your move') : t('online.theirTurn', '{name} to move', { name: g.opponent }));
  function renderGame() {
    const g = myGame();
    if (gbub && (!g || (gbub.kind === 'moved' && match?.attached))) gbub = null;
    gameBubEl.hidden = !gbub;
    if (gbub) $('.obub-main', gameBubEl).textContent = gbub.kind === 'moved' ? t('online.movedBubble', '♟ {name} moved: {turn} ›', { name: g.opponent, turn: turnText(g) }) : t('online.gameBubble', '♟ Game against {name}: {turn} ›', { name: g.opponent, turn: turnText(g) });
    gline.hidden = !(g && match?.attached) || !!match?.locked;   // the lock line takes the place when there is no connection
    if (!gline.hidden) gline.textContent = t('online.gameLine', 'Online against {name} · {turn}', { name: g.opponent, turn: turnText(g) });
  }
  function showGameBub(b) {
    gbub = b; clearTimeout(gTimer);
    gTimer = setTimeout(() => { if (gbub === b) { gbub = null; renderGame(); } }, 8000);
    renderGame();
  }
  const attachGame = () => { if (match.attached) return; if (game.mode !== 'play') game.setMode('play'); match.attach(); };
  function renderBub() {
    if (bub && bub.kind === 'sum' && !unreadTotal()) bub = null;
    if (bub && bub.name && chatWith === bub.name && chatVisible()) bub = null;
    bubEl.hidden = !bub;
    if (bub) $('.obub-main', bubEl).textContent = bubText();
  }
  function showBub(b, ms = 0) {
    bub = b; clearTimeout(bubTimer);
    if (ms) bubTimer = setTimeout(() => { if (bub === b) { bub = null; renderBub(); } }, ms);
    renderBub();
  }
  const lastMsg = {};   // newest message id seen per chat
  function watchMessages(first) {
    let fresh = null;
    for (const [name, list] of Object.entries(state.chats || {})) {
      const top = Math.max(0, ...list.map((m) => m.id));
      const newer = list.filter((m) => !m.mine && m.id > (lastMsg[name] || 0));
      if (!first && newer.length && !(chatWith === name && chatVisible())) fresh = { kind: 'msg', name, text: newer[newer.length - 1].text };
      lastMsg[name] = top;
    }
    if (fresh) showBub(fresh, 8000);
    else if (first && unreadTotal() && !bubDone) showBub({ kind: 'sum', name: Object.keys(state.unread).length === 1 ? Object.keys(state.unread)[0] : '' });
  }

  function openChat(name) {
    chatWith = name;
    if (phone) { closeSheets(); chatShown = true; } else showTab();
    render();
    if (!phone) $c('.osend input').focus({ preventScroll: true });
  }
  function closeChat() { chatWith = null; chatShown = false; render(); }
  // the keyboard: on a phone the sheet sits on top of it and keeps at most 55 % of the visible height
  function viewport(kb, vh) {
    const bot = kb > 0 ? `${Math.round(kb)}px` : 'calc(var(--sb, 0px) + var(--bar, 56px) + var(--gap, 8px))';
    hud.style.setProperty('--obot', bot);
    hud.style.setProperty('--ohmax', `${Math.round(vh * (kb > 0 ? 0.62 : 0.5))}px`);
  }
  const vv = window.visualViewport;
  const fitKeyboard = () => { if (vv) viewport(Math.max(0, window.innerHeight - vv.height - vv.offsetTop), vv.height); };
  if (phone) { viewport(0, window.innerHeight); vv?.addEventListener('resize', fitKeyboard); vv?.addEventListener('scroll', fitKeyboard); }
  function render() { renderConn(); renderMain(); renderDot(); renderBub(); renderGame(); }

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
    if (!chatVisible() || !state?.unread?.[chatWith] || readBusy === chatWith) return;
    readBusy = chatWith;
    api.post('/chat/read', { with: chatWith }).catch(() => {}).finally(() => { readBusy = ''; });
  }

  // ------------------------------------------------------------ actions
  async function act(path, body, { quiet = false } = {}) {
    try { return await api.post(path, body); }
    catch (e) { if (!quiet) toast(e.net ? t('online.codeNet', 'No connection to the server.') : (e.code || 'error'), 'info', 2400); return null; }
  }
  const onClick = async (e) => {
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
    if (a === 'chat') { openChat(n); return; }
    if (a === 'chat-close') closeChat();
  };
  root.addEventListener('click', onClick);
  ch.addEventListener('click', onClick);
  bubsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.closest('.obub').dataset.k === 'game') {
      const had = gbub;
      gbub = null; clearTimeout(gTimer);
      if (b.dataset.a === 'bub' && had) { attachGame(); closeSheets(); }
      render();
      return;
    }
    const cur = bub;
    bub = null; bubDone = true; clearTimeout(bubTimer);
    if (b.dataset.a === 'bub' && cur) { if (cur.name) openChat(cur.name); else showTab(); }
    render();
  });
  // a bar button opens its own sheet: the chat sheet gives way
  hud.addEventListener('click', (e) => { if (phone && chatShown && e.target.closest('.pbar .tb')) closeChat(); });
  // swipe down on the chat header closes it
  const hd = $c('header');
  let drag = null;
  hd.addEventListener('pointerdown', (e) => { if (!phone || e.target.closest('.ochat-x')) return; drag = { y: e.clientY, dy: 0 }; try { hd.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } ch.style.transition = 'none'; });
  hd.addEventListener('pointermove', (e) => { if (!drag) return; drag.dy = Math.max(0, e.clientY - drag.y); ch.style.transform = `translateY(${drag.dy}px)`; });
  const release = () => { if (!drag) return; const far = drag.dy > 60; drag = null; ch.style.transition = ''; ch.style.transform = ''; if (far) closeChat(); };
  hd.addEventListener('pointerup', release);
  hd.addEventListener('pointercancel', release);
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
  $c('.osend').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $c('.osend input'), text = input.value.trim(), to = chatWith;
    if (!text || !to) return;
    const er = $c('.oerr');
    const cid = `m${Date.now().toString(36)}-${++chatN}`;
    input.value = '';
    for (let i = 0; i < 3; i++) {
      try { await api.post('/chat', { to, text, cid }); er.hidden = true; er.dataset.kind = ''; return; }
      catch (err) { if (!err.net) break; await new Promise((r) => setTimeout(r, 1500)); }
    }
    input.value = text;   // not sent: the text stays for another try
    er.hidden = false; er.dataset.kind = 'send'; er.textContent = t('online.chatFailed', 'Message not sent.');
  });
  root.addEventListener('keydown', (e) => e.stopPropagation());
  ch.addEventListener('keydown', (e) => e.stopPropagation());   // typing a code or a message never reaches the board's keys

  // ------------------------------------------------------------ start with a login
  let lastIn = new Set(), lastGameId = 0;
  function start(l) {
    login = l; writeLogin(l);
    startStats({ server, key: l.key });   // CHE-291: our own stats, logged in players only
    api?.stop(); match?.stop();
    api = createApi({
      server, key: l.key, version: VERSION,
      onStatus: (s) => { status = s; if (s === 'connected') match?.retrySend(); render(); },
      onState: (s) => {
        const first = !state, prevG = state?.game || null;
        state = s; receivedAt = Date.now();
        if (login.name !== s.me.name) { login = { ...login, name: s.me.name }; writeLogin(login); }
        // a new challenge to you, a new game
        const ins = new Set(s.challenges.in.map((c) => c.id));
        if (!first) for (const c of s.challenges.in) if (!lastIn.has(c.id)) toast(t('online.challengesYou', '{name} challenges you', { name: c.from }), 'info', 3200);
        lastIn = ins;
        const g = s.game;
        match.update(s);
        watchMessages(first);
        const mine = myGame();
        if (mine && first) showGameBub({ kind: 'open' });
        else if (mine && prevG && prevG.id === mine.id && mine.moves.length > prevG.moves.length && mine.turn === mine.color && !match.attached) showGameBub({ kind: 'moved' });
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
  onLanguage(() => { translateTree(root); translateTree(lock); translateTree(ch); translateTree(bubEl); translateTree(gameBubEl); render(); });
  translateTree(root); translateTree(lock); translateTree(ch); translateTree(bubEl); translateTree(gameBubEl);
  onShown?.(() => { markRead(); renderMain(); });

  const hook = {
    get state() { return state; }, get status() { return status; }, get match() { return match; }, get api() { return api; },
    get login() { return login ? { server: login.server, name: login.name } : null },
    render, openChat, viewport, get bubble() { return bub; }, get gameBubble() { return gbub; },
  };
  window.__chessOnline = hook;
  return hook;
}
