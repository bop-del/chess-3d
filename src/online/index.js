// The Online tab (CHE-271): loaded by ui.js only with ?online=<server url>. Login by invite (the link's key or the code field), the
// connection line with its Details box, challenges, the one online game, the player list with presence and score, and one chat per
// opponent. The game itself runs through src/online/match.js on the normal 3D board; the transport is src/online/api.js.
// Test hook: window.__chessOnline { state, status, match, api, login(code), render(), openStats(name) }.
import { t, onLanguage, translateTree } from '../i18n.js';
import { LABEL as VERSION } from '../version.js';
import './strings.js';
import './online.css';
import { loginFor, writeLogin } from './store.js';
import { createApi, loginWithCode } from './api.js';
import { createMatch } from './match.js';
import { detailsText } from './details.js';
import { secondAction, gameLine, myTurnCount, scoreOf, chatStep, statView, spanOf, waitingMs, limitInfo, moveNo, runningGames } from './cards.js';
import { previewOn, previewScene, createPreviewApi, previewPushEnv } from './preview.js';
import { createPush } from './push.js';
import { startStats } from './stats.js';
import { createVersionCheck, fetchVersion } from './version.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEEN = 'chess3d.onlineSeen';
const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** wins : losses from your side, then the draws only when there are some; a dash when never played */
export const scoreText = (s) => (!s || !(s.w + s.l + s.d) ? '-' : `${s.w} : ${s.l}${s.d ? `  ½ ${s.d}` : ''}`);
const seenGet = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '{}'); } catch (e) { return {}; } };
const seenSet = (v) => { try { localStorage.setItem(SEEN, JSON.stringify(v)); } catch (e) { /* blocked: for this page only */ } };

export function mountOnline({ server, host, hud, game, controls, toast = () => {}, setDot = () => {}, isVisible = () => true, closeSheets = () => {}, setBoard = () => {}, setTurn = () => {}, leaveMode = () => {}, refreshTurn = () => {}, onShown, phone = false, showTab = () => {} }) {
  const preview = previewOn(), scene = previewScene();   // test aid: ?onlinepv=list|wait|chat|min|stats|card runs the tab on fake players, no server
  let login = loginFor(server) || (preview ? { server, key: 'preview', name: 'Boris' } : null);
  let chatMin = false;
  let push = null;
  let api = null, match = null, state = null, status = 'connecting', receivedAt = 0, apiVerdict = 'unknown';   // apiVerdict (CHE-405): ok | server-old | client-old | unknown
  const vcheck = createVersionCheck({ server, onChange: (v) => { apiVerdict = v; if (v === 'client-old') window.__chess?.update?.show?.(); render(); } });   // the server too old hides the cards, the client too old asks for a reload (CHE-304 banner)
  // CHE-412: before a login there is no api, so the pill asks GET /version (no key) once on mount, then on tab open, online and
  // visibilitychange, at most every 30 s; Try again asks at once. After a login the api's status is the pill (one pill).
  let preStatus = 'connecting', preAt = 0, preBusy = false, preCause = 'noanswer', preOk = 0;
  const conn = () => (login ? status : preStatus);
  async function probe(force = false) {
    if (login || preview || preBusy) return;
    if (!force && preAt && Date.now() - preAt < 30000) return;
    preBusy = true; preAt = Date.now();
    if (preStatus !== 'connected') { preStatus = 'connecting'; render(); }
    const v = await fetchVersion(server);
    preBusy = false;
    if (login) return;
    preStatus = v ? 'connected' : 'unreachable';
    if (v) preOk = Date.now(); else preCause = navigator.onLine === false ? 'offline' : 'noanswer';
    render();
  }
  let chatWith = null, chatShown = false, bub = null, bubTimer = 0, bubDone = false, gbub = null, gTimer = 0, confirmResign = 0, detailsOpen = false, lockDetails = false, codeErr = '';
  const seen = seenGet();   // { game: finished game ids up to this one are acknowledged, games: more acknowledged ids, out: older single declined challenge id, outs: acknowledged declined challenge ids }
  const ackGame = (id) => id <= (seen.game || 0) || (seen.games || []).includes(id);
  const ackOut = (id) => seen.out === id || (seen.outs || []).includes(id);
  const ack = (k, id) => { seen[k] = [...(seen[k] || []).filter((x) => x !== id), id].slice(-40); seenSet(seen); };

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
    <p class="oupdate ocard" role="status" data-i18n="online.serverUpdating" hidden>The server is being updated. Your games are safe, please check back later.</p>
    <div class="omain" hidden>
      <div class="omehead"><p class="ome"></p><button class="obell" type="button" data-a="bell" hidden></button></div>
      <div class="opushcard ocard" hidden><p data-i18n="online.pushAsk">Shall I tell you when it is your turn?</p><div class="orow"><button class="obtn gold" type="button" data-a="push-yes" data-i18n="online.pushYes">Yes please</button><button class="obtn" type="button" data-a="push-no" data-i18n="online.pushNo">No thanks</button></div></div>
      <p class="opushnote oerr" hidden></p>
      <button class="ostat own" type="button" data-a="stats" hidden></button>
      <section class="opd" hidden></section>
      <div class="ochal"></div>
      <div class="ogame"></div>
      <section class="orun" hidden><h4 data-i18n="online.running">Running games</h4><ul class="orunl"></ul></section>
      <h4 data-i18n="online.players">Players</h4>
      <ul class="oplayers"></ul>
      <section class="ochat" hidden>
        <header><i class="grip"></i><b class="owith"></b><span class="omon" title=""><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><em data-i18n="online.monitoredShort">mitgelesen</em></span><button class="ochat-min" type="button" data-a="chat-min" data-i18n-aria="online.minimize" aria-label="Minimize">–</button><button class="ochat-x" type="button" data-a="chat-close" data-i18n-aria="online.close" aria-label="Close">×</button></header>
        <nav class="oswitch"></nav>
        <ol class="omsgs"></ol>
        <form class="osend" autocomplete="off"><input name="text" type="text" maxlength="200" enterkeyhint="send" data-i18n-aria="online.message" aria-label="Message"><button class="obtn gold" type="submit" data-i18n="online.send">Send</button></form>
        <p class="oerr" hidden></p>
      </section>
    </div>`;
  host.append(root);
  const $ = (s, r = root) => r.querySelector(s);
  // the chat: inside the tab on a desktop, on a phone its own half height sheet in the hud (a fixed element inside the transformed
  // Online sheet would be fixed to that sheet), lifted by the keyboard through visualViewport
  const ch = $('.ochat');
  const $c = (s) => ch.querySelector(s);
  ch.classList.add('ochf'); if (phone) ch.classList.add('ochs'); hud.append(ch);   // the chat floats over the board (CHE-301)
  // the collapsed chat: the former CHE-281 bubble, a pill bottom right with the name and the unread count
  const pill = document.createElement('button');
  pill.className = 'ochpill'; pill.type = 'button'; pill.hidden = true; pill.dataset.a = 'chat-open';
  hud.append(pill);
  // the player card (CHE-290): the own numbers at the top of the tab, the detail card of one player (a section in the panel on a desktop,
  // a sheet over the Online sheet on a phone, moved into the hud like the chat); the numbers come from GET /player/<name>, loaded on tap
  const det = $('.opd');
  if (phone) { det.classList.add('opds'); hud.append(det); }
  let statWith = null, statKey = '';
  const statCache = new Map();   // name -> { loading } | { s } | { err }
  const getStats = async (name) => {
    if (api?.stats) return api.stats(name);
    const r = await fetch(`${server.replace(/\/$/, '')}/player/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${login.key}` } });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  function loadStats(name, force = false) {
    const e = statCache.get(name);
    if (!force && e) return;   // a failed load is not retried until the next tap or the next finished game
    statCache.set(name, { loading: true });
    getStats(name).then((s) => statCache.set(name, { s }), () => statCache.set(name, { err: true })).then(() => renderStats());
  }
  const chatVisible = () => !!chatWith && (chatShown && !chatMin);

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
  bubsEl.append(gameBubEl);
  hud.append(bubEl, bubsEl);   // the chat bubble sits with the collapsed chat pill (bottom right), the game bubble stays on top

  // the board lock line: over the board while an online game has no connection
  const lock = document.createElement('div');
  lock.className = 'olock';
  lock.hidden = true;
  lock.innerHTML = `<p><i></i><span data-i18n="online.lockLine">No connection, your move will work again soon</span><button class="obtn small" type="button" data-a="lock-details" data-i18n="online.details">Details</button></p><div class="odet-host"></div>`;
  hud.append(lock);

  // ------------------------------------------------------------ the Details box (two places, one content)
  function detailsHtml() {
    const d = api ? api.details() : { cause: preCause, lastOk: preOk, retryIn: 0 };
    const cause = { offline: 'This device has no internet right now.', noanswer: 'The server does not answer.', server: 'The server has an error.', invite: 'The invite is no longer valid.' }[d.cause] || 'The server does not answer.';
    const secs = Math.ceil((d.retryIn || 0) / 1000);
    return `<div class="odet"><p class="ocause">${esc(t(`online.cause.${d.cause || 'noanswer'}`, cause))}</p>
      <p class="olast">${esc(d.lastOk ? t('online.lastOk', 'Last connected: {time}', { time: hhmm(d.lastOk) }) : t('online.neverOk', 'Not connected yet'))}</p>
      ${api ? `<p class="onext">${esc(secs ? t('online.retryIn', 'Next try in {s} s', { s: secs }) : t('online.retrying', 'Trying now...'))}</p>` : ''}
      <div class="orow"><button class="obtn" type="button" data-a="retry">${esc(t('online.retry', 'Try again'))}</button><button class="obtn" type="button" data-a="copy">${esc(t('online.copy', 'Copy details'))}</button></div>
      <pre class="otech">${esc(techText())}</pre></div>`;
  }
  const techText = () => { const d = api ? api.details() : { cause: preCause, lastOk: preOk }; return detailsText({ ...d, time: Date.now() }, [login?.key]); };
  function renderDetails() {
    const red = conn() === 'unreachable';
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
  const gamesOf = () => state?.games || [];
  const activeGames = () => gamesOf().filter((g) => g.status === 'active');
  const gameById = (id) => gamesOf().find((g) => g.id === id) || null;
  const gameWith = (name) => activeGames().find((g) => g.opponent === name) || null;
  const boardGame = () => (match?.attached && match.game ? gameById(match.game.id) : null);   // the game on the board, as the server last saw it
  const scoreWith = (name) => state?.players.find((p) => p.name === name)?.score;

  // ------------------------------------------------------------ Waiting time (CHE-403): coarse words from the server's lastMoveAt
  const spanText = (sp) => (sp.unit === 'min' ? t('online.t.min', '{n} min', { n: sp.n }) : sp.unit === 'h' ? t('online.t.h', '{n} h', { n: sp.n }) : sp.n === 1 ? t('online.t.day', '{n} day', { n: sp.n }) : t('online.t.days', '{n} days', { n: sp.n }));
  const sinceText = (g) => t('online.since', 'for {t}', { t: spanText(spanOf(waitingMs(g, nowServer()))) });
  /** the last day line: "5 h left, then Felix wins" (your move) or "..., then you can end it" (their move); '' before the last day */
  function limitText(g) {
    const li = limitInfo(g, nowServer());
    if (!li) return '';
    if (li.over) return li.mine ? t('online.limitThemNow', '{name} can end the game now', { name: g.opponent }) : t('online.limitYouNow', 'You can end the game now');
    const tt = spanText(li.left);
    return li.mine ? t('online.limitThem', '{t} left, then {name} wins', { t: tt, name: g.opponent }) : t('online.limitYou', '{t} left, then you can end it', { t: tt });
  }
  /** what the Context line needs while an online game is on the board (ui.js asks, CHE-403, CHE-407): the opponent, my colour, the waiting time text; null for every other game */
  function headerTurn(turn) {
    const g = boardGame();
    if (!g || g.status !== 'active' || !match?.attached) return null;
    return { opponent: g.opponent, color: g.color, since: g.turn === turn && !match.pending ? sinceText(g) : '' };
  }
  setTurn(headerTurn);
  let hdrKey = '';
  const syncHeader = () => { const o = headerTurn(game.getState().turn), k = o ? `${o.opponent}|${o.since}` : ''; if (k !== hdrKey) { hdrKey = k; refreshTurn(); } };

  function renderConn() {
    const c = $('.oconn');
    const cs = conn();
    c.dataset.s = cs;
    $('.otxt', c).textContent = t(`online.conn.${cs}`, { connected: 'Server connected', connecting: 'connecting...', unreachable: 'Server unreachable' }[cs]);
    $('[data-a=details]', c).hidden = cs !== 'unreachable';
    if (cs !== 'unreachable') detailsOpen = false;
    const showLock = !!match?.locked;
    if (!showLock) lockDetails = false;
    lock.hidden = !showLock;
    document.body.classList.toggle('online-locked', showLock);
    renderDetails();
  }

  const chatBtn = (name, n) => `<button class="obtn ochatbtn" type="button" data-a="chat" data-n="${esc(name)}" aria-label="${esc(t('online.chatWith', 'Chat with {name}', { name }) + (n ? ` (${n})` : ''))}">💬 ${esc(t('online.chat', 'Chat'))}${n ? ` <b class="ocnt">${n}</b>` : ''}</button>`;
  const PIECES = ['♞', '♜', '♝', '♛', '♚', '♟'];
  const hashN = (name) => Math.max(0, (state?.players || []).findIndex((p) => p.name === name));   // one piece and colour per player, in list order
  const avatarOf = (name) => `<b class="oglyph" data-c="${hashN(name) % 6}">${PIECES[hashN(name) % PIECES.length]}</b>`;
  const scoreLine = (s) => scoreOf(s) || t('online.noGameYet', 'no finished game yet');
  // one player card (CHE-335): dot, name, score; the state of the game or the challenge with this player; Chat and the second button
  function playerCard(p) {
    const n = p.unread || 0;
    const g = gameWith(p.name);
    const mineOut = state.challenges.out.find((c) => c.status === 'open' && c.to === p.name);
    const kind = secondAction(p, { game: !!g, out: state.challenges.out.filter((c) => c.status === 'open').map((c) => c.to), inc: state.challenges.in.map((c) => c.from) });
    const second = kind === 'game' ? `<button class="obtn gold" type="button" data-a="board" data-id="${g.id}">${esc(t('online.toGame', 'To the game'))}</button>`
      : kind === 'asked' ? `<button class="obtn" type="button" data-a="cancel-out" data-id="${mineOut.id}">${esc(t('online.withdraw', 'Withdraw'))}</button>`
      : kind === 'incoming' ? `<button class="obtn" type="button" disabled>${esc(t('online.challenge', 'Challenge'))}</button>`
      : `<button class="obtn gold" type="button" data-a="challenge" data-n="${esc(p.name)}">${esc(t('online.challenge', 'Challenge'))}</button>`;
    const chat = `<button class="obtn ochatbtn" type="button" data-a="chat" data-n="${esc(p.name)}" aria-label="${esc(t('online.chatWith', 'Chat with {name}', { name: p.name }) + (n ? ` (${n})` : ''))}">${esc(t('online.chat', 'Chat'))}${n ? ` <b class="ocnt">${n}</b>` : ''}</button>`;
    let line = '';
    if (kind === 'asked') line = `<div class="ostate asked" role="status"><span class="odots"><i></i><i></i><i></i></span><span>${esc(t('online.askedLine', 'Challenged, waiting...'))}</span></div>`;
    else if (g) {
      const mine = gameLine(g) === 'mine', onBoard = match?.attached && match.game?.id === g.id;
      const turn = onBoard && match.pending ? t('online.sending', 'Sending the move...') : mine ? t('online.yourTurnCard', 'Your move') : t('online.theirTurnCard', '{name} to move', { name: p.name });
      const canFinish = g.turn !== g.color && nowServer() >= g.staleAt;
      line = `<div class="ostate game${mine ? ' mine' : ''}"><span class="oturn">${esc(turn)}</span><span class="oside">${esc(sideName(g.color))}${onBoard ? ` · ${esc(t('online.onBoard', 'on the board'))}` : ''}</span><button class="obtn small" type="button" data-a="resign" data-id="${g.id}">${esc(t('online.resign', 'Resign'))}</button></div>
        ${confirmResign === g.id ? `<div class="oconfirm"><p>${esc(t('online.resignAsk', 'Really resign the game?'))}</p><div class="orow"><button class="obtn gold" type="button" data-a="resign-yes" data-id="${g.id}">${esc(t('online.yes', 'Yes'))}</button><button class="obtn" type="button" data-a="resign-no">${esc(t('online.cancel', 'Cancel'))}</button></div></div>` : ''}
        ${canFinish ? `<p class="ohint">${esc(t('online.finishHint', '{name} has not moved for 3 days. Ending counts as a win for you.', { name: p.name }))}</p><div class="orow"><button class="obtn gold" type="button" data-a="finish" data-id="${g.id}">${esc(t('online.finish', 'End the game'))}</button></div>` : ''}`;
    }
    if (!line && p.bot && state.me.admin && kind === 'challenge') line = `<div class="ostate"><button class="obtn small" type="button" data-a="bot-challenge">${esc(t('online.botChallenge', 'Bot challenges me'))}</button></div>`;   // CHE-343: admin only
    return `<li class="op opc${chatWith === p.name ? ' on' : ''}${n ? ' unread' : ''}${g ? ' ingame' : ''}"><span class="oav" data-a="stats" data-n="${esc(p.name)}" role="button" aria-label="${esc(t('online.st.open', 'Numbers of {name}', { name: p.name }))}">${avatarOf(p.name)}<i class="pres${p.online ? ' on' : ''}" title="${esc(p.online ? t('online.online', 'online') : t('online.offline', 'away'))}"></i></span><div class="obody" data-a="stats" data-n="${esc(p.name)}" role="button"><span class="oname">${esc(p.name)}${p.bot ? ` <small class="obot">${esc(t('online.botTag', 'Bot'))}</small>` : ''}</span><span class="oscore">${esc(scoreLine(p.score))}</span></div>${line ? `<div class="ostatew">${line}</div>` : ''}<div class="oacts2">${chat}${second}</div></li>`;
  }
  function renderRunning() {
    const list = runningGames(gamesOf(), nowServer()), box = $('.orun');
    box.hidden = !list.length;
    $('.orunl').innerHTML = list.map((g) => {
      const mine = gameLine(g) === 'mine', onBoard = match?.attached && match.game?.id === g.id;
      const turn = mine ? t('online.yourTurnCard', 'Your move') : t('online.theirTurnCard', '{name} to move', { name: g.opponent });
      const lim = limitText(g);
      return `<li class="orc${mine ? ' mine' : ''}${onBoard ? ' onboard' : ''}" data-id="${g.id}"><span class="oav">${avatarOf(g.opponent)}</span>
        <div class="orbody"><b class="oname">${esc(g.opponent)}</b><span class="orinfo">${esc(t('online.youPlay', 'You play {side}', { side: sideName(g.color) }))} · ${esc(t('online.moveNo', 'Move {n}', { n: moveNo(g) }))}</span></div>
        <button class="obtn gold" type="button" data-a="board" data-id="${g.id}">${esc(t('online.toGame', 'To the game'))}</button>
        <p class="orturn"><span class="orwho">${esc(turn)}</span> · <span class="orsince">${esc(sinceText(g))}</span></p>${lim ? `<p class="orlimit">${esc(lim)}</p>` : ''}</li>`;
    }).join('');
  }
  const nums = (v) => ['games', 'wins', 'losses', 'draws'].map((k) => `<span class="ostc ${k}"><b>${v[k]}</b><small>${esc(t(`online.st.${k}`, { games: 'Games', wins: 'Wins', losses: 'Losses', draws: 'Draws' }[k]))}</small></span>`).join('');
  const STREAK_EN = { win1: '1 win', winN: '{n} wins in a row', loss1: '1 loss', lossN: '{n} losses in a row', draw1: '1 draw', drawN: '{n} draws in a row' };
  const streakText = (v) => { const k = v.streak.type ? `${v.streak.type}${v.streak.n === 1 ? '1' : 'N'}` : ''; return k ? t(`online.st.s.${k}`, STREAK_EN[k], { n: v.streak.n }) : '-'; };
  function renderStats() {
    if (!state) return;
    const me = state.me.name, own = $('.ostat.own');
    const e = statCache.get(me), v = e?.s ? statView(e.s) : null;
    own.hidden = !e || e.err;
    own.dataset.n = me;
    own.setAttribute('aria-label', t('online.st.open', 'Numbers of {name}', { name: me }));
    own.innerHTML = !v ? `<span class="ostx">${esc(t('online.st.loading', 'Loading numbers...'))}</span>` : v.empty ? `<span class="ostx">${esc(t('online.st.none', 'no finished game yet'))}</span>`
      : `${nums(v)}<span class="ostc streak ${v.streak.type || ''}"><b>${esc(streakText(v))}</b><small>${esc(t('online.st.streak', 'Streak'))}</small></span>`;
    // the detail card of one player
    det.hidden = !statWith;
    if (!statWith) return;
    const d = statCache.get(statWith), dv = d?.s ? statView(d.s) : null, isOwn = statWith === me;
    let body;
    if (!d || d.loading) body = `<p class="ostx">${esc(t('online.st.loading', 'Loading numbers...'))}</p>`;
    else if (d.err) body = `<p class="ostx">${esc(t('online.st.failed', 'The numbers are not available right now.'))}</p>`;
    else if (dv.empty) body = `<p class="ostx">${esc(t('online.st.none', 'no finished game yet'))}</p>${isOwn ? '' : `<p class="oh2h">${esc(t('online.st.h2hNone', 'Never played each other'))}</p>`}`;
    else {
      const h = isOwn ? '' : dv.h2h ? `<p class="oh2h"><small>${esc(t('online.st.h2h', 'Head to head'))}</small><b>${esc(t('online.st.h2hLine', 'You {score} {name}', { score: dv.h2h.line, name: statWith }))}</b></p>` : `<p class="oh2h"><small>${esc(t('online.st.h2h', 'Head to head'))}</small><b>${esc(t('online.st.h2hNone', 'Never played each other'))}</b></p>`;
      const rows = [
        [t('online.st.nowStreak', 'Streak now'), streakText(dv)], [t('online.st.bestStreak', 'Best win streak'), t('online.st.bestN', '{n} wins', { n: dv.bestWins })],
        [t('online.st.avgLen', 'Average length'), t('online.st.lenN', '{n} moves', { n: dv.avgMoves })], dv.avgMinutes ? [t('online.st.avgTime', 'Average time'), t('online.st.timeN', '{n} min', { n: dv.avgMinutes })] : null,
      ].filter(Boolean);
      body = `<div class="ostats4">${nums(dv)}</div>
        <div class="obar" role="img" aria-label="${esc(`${dv.wins} / ${dv.draws} / ${dv.losses}`)}"><i class="w" style="width:${dv.bar.w}%"></i><i class="d" style="width:${dv.bar.d}%"></i><i class="l" style="width:${dv.bar.l}%"></i></div>
        ${h}<dl class="ost">${rows.map(([k, x]) => `<div><dt>${esc(k)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>
        ${dv.openings.length ? `<h5>${esc(t('online.st.openings', 'Favourite openings'))}</h5><ul class="oopen">${dv.openings.map((o) => `<li><span>${esc(o.name)}</span><b>${o.n}</b></li>`).join('')}</ul>` : ''}`;
    }
    det.innerHTML = `<header><span class="oav">${avatarOf(statWith)}</span><b class="opd-name">${esc(isOwn ? t('online.st.own', 'Your numbers') : statWith)}</b><button class="opd-x" type="button" data-a="stats-x" aria-label="${esc(t('online.close', 'Close'))}">×</button></header>${body}`;
  }
  function openStats(name) { statWith = name; loadStats(name, true); renderStats(); }
  // the own numbers and an open card are fetched again when a game ends (the finished game id changes the key)
  function watchStats() {
    const key = gamesOf().map((g) => `${g.id}:${g.status}`).join(',');
    if (key !== statKey) { const first = statKey === '' && !statCache.size; statKey = key; if (!first) statCache.clear(); }
    loadStats(state.me.name);
    if (statWith) loadStats(statWith);
  }
  function renderMain() {
    const logged = !!login && !!state;
    const needCode = !login || (status === 'unreachable' && api?.details().cause === 'invite');
    $('.ologin').hidden = !needCode;
    const err = $('.ologin .oerr'); err.hidden = !codeErr; err.textContent = codeErr;
    const updating = apiVerdict === 'server-old';
    $('.oupdate').hidden = !updating || !login;
    document.body.classList.toggle('online-updating', updating);   // the bubbles over the board go too (online.css)
    $('.omain').hidden = !logged || updating;
    if (!logged || updating) return;
    $('.ome').textContent = t('online.you', 'You are {name}', { name: state.me.name });
    watchStats(); renderStats();

    // challenges in and out
    const parts = [];
    for (const c of state.challenges.in) {
      parts.push(`<div class="ocard"><p>${esc(t('online.challengesYou', '{name} challenges you', { name: c.from }))}</p><div class="orow"><button class="obtn gold" type="button" data-a="accept" data-id="${c.id}">${esc(t('online.accept', 'Accept'))}</button><button class="obtn" type="button" data-a="decline" data-id="${c.id}">${esc(t('online.decline', 'No thanks'))}</button></div></div>`);
    }
    for (const c of state.challenges.out) {   // an open one is the status of its player card; a declined one is told once
      if (c.status === 'declined' && !ackOut(c.id)) parts.push(`<div class="ocard"><p>${esc(t('online.declined', '{name} declined', { name: c.to }))}</p><div class="orow"><button class="obtn" type="button" data-a="seen-out" data-id="${c.id}">${esc(t('online.ok', 'OK'))}</button></div></div>`);
    }
    $('.ochal').innerHTML = parts.join('');

    // finished games not yet acknowledged (the running ones are in their player cards)
    $('.ogame').innerHTML = gamesOf().filter((g) => g.status === 'over' && !ackGame(g.id)).slice(0, 3).map((g) => {
      const res = !g.winner ? t('online.drawn', 'Draw') : g.winner === g.color ? t('online.won', 'You won') : t('online.lost', 'You lost');
      return `<div class="ocard oresult"><p><b>${esc(res)}</b> · ${esc(g.opponent)}<br><span class="oscoreline">${esc(t('online.scoreNow', 'Against {name} now {score}', { name: g.opponent, score: scoreText(scoreWith(g.opponent)) }))}</span></p><div class="orow"><button class="obtn" type="button" data-a="seen-game" data-id="${g.id}">${esc(t('online.ok', 'OK'))}</button></div></div>`;
    }).join('');

    // the running games (CHE-403): one card per game, yours to move first, then by waiting time; hidden when none runs
    renderRunning();

    // the players
    $('.oplayers').innerHTML = state.players.length ? state.players.map((p) => playerCard(p)).join('') : `<li class="oempty">${esc(t('online.noPlayers', 'Nobody else is invited yet.'))}</li>`;

    // the chat with one opponent
    const open = !!chatWith && state.players.some((p) => p.name === chatWith) && chatShown;
    ch.hidden = !open || chatMin;
    document.body.classList.toggle('ochat-open', !ch.hidden);   // the chat bubble of another player then sits above the window
    pill.hidden = !(open && chatMin);
    if (!pill.hidden) {
      const n = state.unread?.[chatWith] || 0;
      pill.innerHTML = `<span class="oav">${avatarOf(chatWith)}</span><b>${esc(chatWith)}</b>${n ? `<span class="ocnt">${n}</span>` : ''}`;
      pill.setAttribute('aria-label', t('online.chatWith', 'Chat with {name}', { name: chatWith }) + (n ? ` (${n})` : ''));
    }
    if (!ch.hidden) {
      $c('.owith').textContent = t('online.chatWith', 'Chat with {name}', { name: chatWith });
      const sw = $c('.oswitch');
      sw.innerHTML = state.players.map((p) => `<button type="button" class="osw${p.name === chatWith ? ' on' : ''}" data-a="chat-to" data-n="${esc(p.name)}"><span class="oav">${avatarOf(p.name)}</span><span>${esc(p.name)}</span>${state.unread?.[p.name] ? '<i class="oud"></i>' : ''}</button>`).join('');
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
    if (!state || apiVerdict === 'server-old') { setDot(false, 0); return; }
    const n = unreadTotal() + myTurnCount(gamesOf());   // unread messages plus the games where it is your move
    setDot(n > 0 || state.challenges.in.length > 0, n);
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
    const bg = gbub ? gameById(gbub.id) : null;   // the bubble names the game it is about
    if (gbub && (!bg || bg.status !== 'active' || (gbub.kind !== 'open' && match?.attached && match.game?.id === bg.id))) gbub = null;
    gameBubEl.hidden = !gbub;
    if (gbub) $('.obub-main', gameBubEl).textContent = gbub.kind === 'moved' ? t('online.movedBubble', '♟ {name} moved: {turn} ›', { name: bg.opponent, turn: turnText(bg) }) : gbub.kind === 'accepted' ? t('online.acceptedBubble', '♟ {name} accepted · To the game ›', { name: bg.opponent }) : t('online.gameBubble', '♟ Game against {name}: {turn} ›', { name: bg.opponent, turn: turnText(bg) });
  }
  function showGameBub(b) {
    gbub = b; clearTimeout(gTimer);
    gTimer = setTimeout(() => { if (gbub === b) { gbub = null; renderGame(); } }, 8000);
    renderGame();
  }
  // Zur Partie while a puzzle, a drill or a lesson runs asks first (CHE-403): yes ends it through its own controller, then the game opens; no keeps it
  const askEl = document.createElement('div');
  askEl.className = 'oask ocard'; askEl.hidden = true; askEl.setAttribute('role', 'alertdialog');
  askEl.innerHTML = '<p></p><div class="orow"><button class="obtn gold" type="button" data-a="ask-yes"></button><button class="obtn" type="button" data-a="ask-no"></button></div>';
  hud.append(askEl);
  let askId = 0;
  const ASK = { puzzle: ['online.askPuzzle', 'Cancel the puzzle and go to the game?'], drill: ['online.askDrill', 'Cancel the drill and go to the game?'], explain: ['online.askExplain', 'Cancel the lesson and go to the game?'] };
  function attachNow(id) { if (game.mode !== 'play') leaveMode(); if (game.mode !== 'play') game.setMode('play'); match.attach(id); }
  const attachGame = (id) => {
    if (match.attached && match.game?.id === id) return;
    if (game.mode === 'play') { attachNow(id); return; }
    const [k, d] = ASK[game.mode] || ASK.explain;
    askId = id; closeSheets();
    $('p', askEl).textContent = t(k, d);
    $('[data-a=ask-yes]', askEl).textContent = t('online.yes', 'Yes'); $('[data-a=ask-no]', askEl).textContent = t('online.no', 'No');
    askEl.hidden = false;
  };
  askEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    askEl.hidden = true;
    if (b.dataset.a === 'ask-yes' && gameById(askId)?.status === 'active') { attachNow(askId); closeSheets(); render(); }
  });

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

  const cs = (action, name) => ({ with: chatWith, shown: chatShown, min: chatMin } = chatStep({ with: chatWith, shown: chatShown, min: chatMin }, action, name));
  function openChat(name) {
    if (phone) closeSheets();   // the sheet gives way, the chat floats over the board
    cs('open', name);
    render();
    if (!phone) $c('.osend input').focus({ preventScroll: true });
  }
  function closeChat() { cs('close'); render(); }
  // the keyboard: on a phone the sheet sits on top of it and keeps at most 55 % of the visible height
  function viewport(kb, vh) {
    const bot = kb > 0 ? `${Math.round(kb)}px` : 'calc(var(--sb, 0px) + var(--bar, 56px) + var(--gap, 8px))';
    hud.style.setProperty('--obot', bot);
    hud.style.setProperty('--ohmax', `${Math.round(vh * (kb > 0 ? 0.62 : 0.5))}px`);
  }
  const vv = window.visualViewport;
  const fitKeyboard = () => { if (vv) viewport(Math.max(0, window.innerHeight - vv.height - vv.offsetTop), vv.height); };
  if (phone) { viewport(0, window.innerHeight); vv?.addEventListener('resize', fitKeyboard); vv?.addEventListener('scroll', fitKeyboard); }
  // CHE-272: the permission card (after the first online action, once) and the bell (on, off, blocked, or "add to Home Screen first")
  const BELL = { on: ['online.bellOn', 'Notifications on'], off: ['online.bellOff', 'Notifications off'], denied: ['online.bellDenied', 'Notifications are blocked in the browser'], install: ['online.bellInstall', 'Add to Home Screen to get notifications'] };
  let pushNote = '';
  function renderPush() {
    const st = push ? push.state() : 'unsupported', bell = $('.obell');
    bell.hidden = !push || st === 'unsupported';
    if (!bell.hidden) {
      const [k, d] = BELL[st];
      bell.dataset.s = st; bell.setAttribute('aria-label', t(k, d)); bell.title = t(k, d); bell.setAttribute('aria-pressed', st === 'on' ? 'true' : 'false');
      bell.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 20a2 2 0 0 0 4 0"/>${st === 'on' ? '' : '<path d="M4 4l16 16"/>'}</svg>`;
    }
    $('.opushcard').hidden = !push || !push.wantCard();
    const n = $('.opushnote'); n.hidden = !pushNote; n.textContent = pushNote;
  }
  async function pushDo(p) { pushNote = ''; await p; pushNote = push.error === 'off-server' ? t('online.pushServerOff', 'The server is not sending notifications right now.') : push.error ? t('online.pushFailed', 'That did not work.') : ''; renderPush(); }
  function render() { renderConn(); renderMain(); renderDot(); renderBub(); renderGame(); renderPush(); syncHeader(); }

  // the result line on the game over card: "Against Felix now 4 : 2"
  function scoreOnBanner() {
    const g = match?.attached && match.game ? gameById(match.game.id) : null;
    if (!g || g.status !== 'over') return;
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
    if (a === 'retry') { if (api) api.retry(); else probe(true); renderDetails(); return; }
    if (a === 'copy') { copyDetails(b); return; }
    if (a === 'challenge') { if (await act('/challenge', { to: n })) push?.acted(); return; }
    if (a === 'bot-challenge') { await act('/bot/challenge', {}); return; }
    if (a === 'bell') { if (push?.state() === 'install') { pushNote = t('online.bellInstall', 'Add to Home Screen to get notifications'); renderPush(); } else if (push?.state() !== 'denied') pushDo(push.toggle()); else { pushNote = t('online.bellDenied', 'Notifications are blocked in the browser'); renderPush(); } return; }
    if (a === 'push-yes') { pushDo(push.answer(true)); return; }
    if (a === 'push-no') { push.answer(false); return; }
    if (a === 'accept') { if (await act('/challenge/answer', { id, accept: true })) push?.acted(); return; }   // the sheet closes when the new game lands on the board
    if (a === 'decline') { await act('/challenge/answer', { id, accept: false }); return; }
    if (a === 'seen-out') { ack('outs', id); render(); return; }
    if (a === 'seen-game') { ack('games', id); render(); return; }
    if (a === 'board') { attachGame(id); closeSheets(); render(); return; }
    if (a === 'resign') { confirmResign = id; render(); return; }
    if (a === 'resign-no') { confirmResign = 0; render(); return; }
    if (a === 'resign-yes') { confirmResign = 0; if (gameById(id)) await act('/resign', { game: id }); render(); return; }
    if (a === 'finish') { if (gameById(id)) await act('/finish-stale', { game: id }); return; }
    if (a === 'stats') { if (statWith === n) { statWith = null; renderStats(); } else openStats(n); return; }
    if (a === 'stats-x') { statWith = null; renderStats(); return; }
    if (a === 'chat') { openChat(n); return; }
    if (a === 'chat-to') { cs('to', n); render(); if (!phone) $c('.osend input').focus({ preventScroll: true }); return; }
    if (a === 'chat-min') { cs('min'); render(); return; }
    if (a === 'chat-open') { cs('expand'); render(); return; }
    if (a === 'cancel-out') { await act('/challenge/cancel', { id }, { quiet: true }); return; }   // a server without the route (404) fails quietly
    if (a === 'chat-close') closeChat();
  };
  root.addEventListener('click', onClick);
  det.addEventListener('click', onClick);
  ch.addEventListener('click', onClick);
  pill.addEventListener('click', onClick);
  const onBubClick = (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.closest('.obub').dataset.k === 'game') {
      const had = gbub;
      gbub = null; clearTimeout(gTimer);
      if (b.dataset.a === 'bub' && had) { attachGame(had.id); closeSheets(); }
      render();
      return;
    }
    const cur = bub;
    bub = null; bubDone = true; clearTimeout(bubTimer);
    if (b.dataset.a === 'bub' && cur) { if (cur.name) openChat(cur.name); else showTab(); }
    render();
  };
  bubsEl.addEventListener('click', onBubClick);
  bubEl.addEventListener('click', onBubClick);
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
    input.focus({ preventScroll: true });   // the tap on Send took the focus: back in the field, inside the gesture, so the keyboard stays up
    for (let i = 0; i < 3; i++) {
      try { await api.post('/chat', { to, text, cid }); er.hidden = true; er.dataset.kind = ''; return; }
      catch (err) { if (!err.net) break; await new Promise((r) => setTimeout(r, 1500)); }
    }
    input.value = text;   // not sent: the text stays for another try
    er.hidden = false; er.dataset.kind = 'send'; er.textContent = t('online.chatFailed', 'Message not sent.');
  });
  root.addEventListener('keydown', (e) => e.stopPropagation());
  ch.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && e.target.matches?.('.osend input')) e.target.blur(); });   // typing a code or a message never reaches the board's keys

  // ------------------------------------------------------------ start with a login
  let lastIn = new Set(); const knownGames = new Set();
  let withParam = new URLSearchParams(location.search).get('with') || '';   // a tapped notification: ?open=online&with=<name> opens that chat
  const memStorage = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); } }; };
  function start(l) {
    login = l; if (!preview) writeLogin(l);
    if (!preview) startStats({ server, key: l.key });   // CHE-291: our own stats, logged in players only
    api?.stop(); match?.stop();
    if (!push) {
      push = createPush({ server, getKey: () => login.key, onChange: renderPush, ...(preview ? { env: previewPushEnv(scene), storage: memStorage(), call: async (path) => (path === '/push/key' ? { key: 'BPreviewKeyPreviewKeyPreviewKey' } : { ok: true }) } : {}) });
      if (preview && scene === 'pushcard') push.acted();
      push.refresh();
    }
    const mkApi = preview ? (o) => createPreviewApi({ scene, ...o }) : createApi;
    api = mkApi({
      server, key: l.key, version: VERSION,
      onStatus: (s) => { status = s; if (s === 'connected') { match?.retrySend(); if (!preview) vcheck.run(); } render(); },
      onState: (s) => {
        const first = !state, prevGames = gamesOf();
        const asked = new Set((state?.challenges.out || []).filter((c) => c.status === 'open').map((c) => c.to));   // whom we had asked before this state
        state = s; receivedAt = Date.now();
        if (login.name !== s.me.name) { login = { ...login, name: s.me.name }; if (!preview) writeLogin(login); }
        // a new challenge to you, a new game
        const ins = new Set(s.challenges.in.map((c) => c.id));
        if (!first) for (const c of s.challenges.in) if (!lastIn.has(c.id)) toast(t('online.challengesYou', '{name} challenges you', { name: c.from }), 'info', 3200);
        lastIn = ins;
        try { match.update(s); } catch (e) { console.warn('online: the board could not follow the game', e); }   // a throw here must never leave the tab on the old state (the stream loop would swallow it and the cards would stay stale)
        watchMessages(first);
        const running = activeGames();
        if (first) {
          const open = boardGame() && boardGame().status === 'active' ? boardGame() : running.find((g) => g.turn === g.color) || running[0];
          if (open) showGameBub({ kind: 'open', id: open.id });
        } else {
          const moved = running.find((g) => { const p = prevGames.find((x) => x.id === g.id); return p && g.moves.length > p.moves.length && g.turn === g.color && !(match.attached && match.game?.id === g.id); });
          if (moved) showGameBub({ kind: 'moved', id: moved.id });
        }
        for (const g of running) {
          if (knownGames.has(g.id)) continue;
          knownGames.add(g.id);
          if (!first) {
            // CHE-403: they accepted our challenge (a note, and the board switched by itself unless a local game is in progress: then a bubble to tap) or we accepted theirs
            const theyAccepted = asked.has(g.opponent), onBoard = match.attached && match.game?.id === g.id;
            toast(theyAccepted ? t('online.acceptedNote', '{name} accepted', { name: g.opponent }) : t('online.started', 'Game against {name}. You play {side}.', { name: g.opponent, side: sideName(g.color) }), 'info', 3200);
            if (onBoard) closeSheets(); else showGameBub({ kind: theyAccepted ? 'accepted' : 'new', id: g.id });
          }
          push?.acted();
        }
        scoreOnBanner();
        if (first && withParam && s.players.some((p) => p.name === withParam)) { openChat(withParam); withParam = ''; }
        render();
      },
    });
    match = createMatch({ game, controls, api, onChange: () => render(), setBoard });
    if (!preview) vcheck.run();   // on login; every reconnect runs it again (onStatus)
    render();
  }
  if (login) start(login); else render();
  if (preview && (scene === 'chat' || scene === 'min')) { chatWith = 'Nina'; chatShown = true; chatMin = scene === 'min'; }
  if (preview && scene === 'card') openStats('Nina');
  if (preview && scene === 'updating') { apiVerdict = 'server-old'; render(); }

  // the countdown in an open Details box, the 3 day finish appearing on time
  setInterval(() => { if ((detailsOpen || lockDetails) && conn() === 'unreachable') renderDetails(); else if (lockDetails) renderDetails(); }, 1000);
  const tick = () => { if (activeGames().length) { renderMain(); renderGame(); syncHeader(); } };
  setInterval(tick, 60000);   // Waiting time and the last day line: each minute
  onLanguage(() => { translateTree(root); translateTree(lock); translateTree(ch); translateTree(bubEl); translateTree(gameBubEl); render(); });
  translateTree(root); translateTree(lock); translateTree(ch); translateTree(bubEl); translateTree(gameBubEl);
  onShown?.(() => { markRead(); renderMain(); probe(); });
  addEventListener('online', () => probe());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') probe(); });
  probe();

  const hook = {
    get state() { return state; }, get status() { return status; }, get conn() { return conn(); }, probe, get match() { return match; }, get api() { return api; }, get apiVerdict() { return apiVerdict; },
    get login() { return login ? { server: login.server, name: login.name } : null },
    get push() { return push; }, render, tick, openChat, openStats, viewport, get bubble() { return bub; }, get gameBubble() { return gbub; }, get boardGame() { return boardGame(); },
  };
  window.__chessOnline = hook;
  return hook;
}
