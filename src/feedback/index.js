// The feedback dialog (CHE-404): a speech bubble in the header opens it; kind (bug or wish), text, an optional name, a checkbox
// for a picture of the board, a one line note of what goes along; send, then a thank you toast. No reply channel. Works without
// an online login (the key is sent only when there is one). Pure parts: src/feedback/core.js. Server: server/feedback.mjs.
//   mountFeedback({ ui, stage, game, themes, views, server, login, version, toast, fetch? }) -> { open, close, isOpen }
import './feedback.css';
import { addDE, t, onLanguage, translateTree } from '../i18n.js';
import { buildContext, collectErrors, deviceId, fitPicture, sendFeedback, TEXT_MAX } from './core.js';

addDE({
  'fb.open': 'Rückmeldung senden', 'fb.title': 'Rückmeldung', 'fb.kind': 'Art', 'fb.bug': 'Fehler', 'fb.wish': 'Wunsch',
  'fb.text': 'Was ist passiert, oder was wünschst du dir?', 'fb.name': 'Dein Name (freiwillig)', 'fb.picture': 'Bild vom Brett mitschicken',
  'fb.note': 'Mitgeschickt werden: dein Text, das Bild, die Version, Gerät und Bildschirmgröße, Thema und Ansicht, Stellung und Züge, die letzten Fehlermeldungen. Nie der Chat.',
  'fb.send': 'Senden', 'fb.sending': 'Sende...', 'fb.cancel': 'Abbrechen', 'fb.close': 'Schließen', 'fb.thanks': 'Danke! Deine Rückmeldung ist angekommen.',
  'fb.slow': 'Du hast schon einige geschickt. Versuch es später noch einmal.', 'fb.offline': 'Das Senden hat nicht geklappt. Prüfe die Verbindung.', 'fb.rejected': 'Der Server hat die Nachricht nicht angenommen. Bitte später nochmal.', 'fb.empty': 'Schreib bitte kurz etwas dazu.',
});

/** the board as a small JPEG (base64 without the prefix), or null. Renders one frame first: the canvas is not kept between frames. */
export function boardPicture(stage, maxW = 640) {
  try {
    stage.render(0);
    const src = stage.renderer.domElement;
    const w = Math.min(maxW, src.width), h = Math.round(src.height * (w / src.width));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return fitPicture((q) => c.toDataURL('image/jpeg', q).split(',')[1] || '');
  } catch (e) { return null; }
}

export function mountFeedback({ ui, stage, game, themes, views, server = '', login = null, version = '', toast, fetch: doFetch } = {}) {
  collectErrors();
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const ov = el('div', 'fbov');
  ov.id = 'feedback';
  ov.hidden = true;
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'fb-title');
  ov.innerHTML = `<div class="fbcard"><header><h2 id="fb-title" data-i18n="fb.title">Feedback</h2><button class="fbx" id="fb-close" type="button" aria-label="Close" data-i18n-aria="fb.close">&times;</button></header>
    <form class="fbform" id="fb-form" novalidate>
      <div class="fbkinds" role="radiogroup" aria-label="Kind" data-i18n-aria="fb.kind"><button class="fbkind" type="button" role="radio" data-kind="bug" aria-checked="true" data-i18n="fb.bug">Bug</button><button class="fbkind" type="button" role="radio" data-kind="wish" aria-checked="false" data-i18n="fb.wish">Wish</button></div>
      <label><span data-i18n="fb.text">What happened, or what would you like?</span><textarea id="fb-text" maxlength="${TEXT_MAX}" rows="4"></textarea></label>
      <span class="fbcount" id="fb-count" aria-hidden="true">0 / ${TEXT_MAX}</span>
      <label id="fb-namebox"><span data-i18n="fb.name">Your name (optional)</span><input type="text" id="fb-name" maxlength="40" autocomplete="off"></label>
      <label class="fbpic"><input type="checkbox" id="fb-pic" checked><span data-i18n="fb.picture">Send a picture of the board</span></label>
      <p class="fbnote" data-i18n="fb.note">Sent along: your text, the picture, the game version, device and screen size, theme and view, the position and moves, the last error messages. Never the chat.</p>
      <p class="fbmsg" id="fb-msg" role="status"></p>
      <div class="fbactions"><button type="button" id="fb-cancel" data-i18n="fb.cancel">Cancel</button><button type="submit" class="fbsend" id="fb-send" data-i18n="fb.send">Send</button></div>
    </form></div>`;
  document.getElementById('hud').append(ov);
  translateTree(ov);
  const $ = (s) => ov.querySelector(s);
  const text = $('#fb-text'), name = $('#fb-name'), pic = $('#fb-pic'), msg = $('#fb-msg'), send = $('#fb-send'), count = $('#fb-count'), closeBtn = $('#fb-close');
  let kind = 'bug', from = null, busy = false;
  if (login?.name) { name.value = login.name; $('#fb-namebox').hidden = true; }   // a logged in player is named by the server
  const setKind = (k) => { kind = k; for (const b of ov.querySelectorAll('.fbkind')) b.setAttribute('aria-checked', String(b.dataset.kind === k)); };
  for (const b of ov.querySelectorAll('.fbkind')) b.addEventListener('click', () => setKind(b.dataset.kind));
  text.addEventListener('input', () => { count.textContent = `${text.value.length} / ${TEXT_MAX}`; msg.textContent = ''; });
  onLanguage(() => translateTree(ov));

  function open() {
    if (!ov.hidden) return;
    from = document.activeElement;
    msg.textContent = '';
    ov.hidden = false;
    text.focus();
  }
  function close() {
    if (ov.hidden || busy) return;
    ov.hidden = true;
    try { from?.focus?.(); } catch (e) { /* element gone */ }
  }
  function context() {
    const st = game.getState();
    const history = game.chess?.history || [];
    const sq = (i) => String.fromCharCode(97 + (i & 7)) + String((i >> 3) + 1);
    return buildContext({
      version, fen: st.fen, theme: themes?.current?.() || '', view: views?.current?.() || '',
      moves: history.map((h) => sq(h.m.from) + sq(h.m.to) + (h.m.promo || '')),
    });
  }
  ov.querySelector('#fb-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!text.value.trim()) { msg.textContent = t('fb.empty', 'Please write a few words.'); text.focus(); return; }
    busy = true; send.disabled = true; send.textContent = t('fb.sending', 'Sending...');
    const picture = pic.checked ? boardPicture(stage) : null;   // taken before the dialog could change the frame
    const out = await sendFeedback({ server, kind, text: text.value, name: name.value, picture, context: context(), device: deviceId(), key: login?.key || '', fetch: doFetch });
    busy = false; send.disabled = false; send.textContent = t('fb.send', 'Send');
    if (out.ok) {
      text.value = ''; count.textContent = `0 / ${TEXT_MAX}`; msg.textContent = '';
      close();
      toast?.(t('fb.thanks', 'Thank you! Your feedback was sent.'), 'info', 3200);
    } else msg.textContent = out.error === 'slow-down' ? t('fb.slow', 'You already sent a few. Please try again later.')
      : out.error === 'rejected' ? t('fb.rejected', 'The server did not accept the message. Please try again later.') : t('fb.offline', 'Sending failed. Check your connection.');
  });
  $('#fb-cancel').addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.addEventListener('keydown', (e) => {
    e.stopPropagation();   // game keys (N, U, H...) must not fire while typing
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...ov.querySelectorAll('button, input, textarea')].filter((x) => !x.disabled && x.offsetParent !== null);
      const i = f.indexOf(document.activeElement);
      if (f.length) { e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    }
  });
  ui.bindFeedback?.(open);
  return { open, close, isOpen: () => !ov.hidden };
}
