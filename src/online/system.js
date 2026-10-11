// Messages from "Chess 3D" (CHE-422): the reserved sender that answers Feedback. The server stores a template key plus params
// (and a grey quote of the player's own Feedback), the client renders them here in the player's language. The thread is read only.
// Pure parts (isSystem, sysText, quoteText, sysItem) are used by index.js and view.js and are covered by test/player-messages.mjs.
import { addDE } from '../i18n.js';

export const SYSTEM_NAME = 'Chess 3D';
export const isSystem = (p) => !!p && (p === SYSTEM_NAME || p.system === true || p.name === SYSTEM_NAME);

addDE({
  'online.sys.read': 'Danke! Wir haben deine Nachricht bekommen und lesen sie.',
  'online.sys.accepted': 'Gute Idee! Das bauen wir ein.',
  'online.sys.shipped': 'Dein Vorschlag ist jetzt im Spiel (Version {v}). Viel Spaß!',
  'online.sys.fixed': 'Der Fehler, den du gemeldet hast, ist behoben (Version {v}). Danke fürs Melden!',
  'online.sys.you': 'Du',
  'online.sys.hint': 'Hier kannst du nicht antworten. Schreib uns über den Rückmeldung-Knopf.',
  'online.sys.sub': 'Nachrichten von uns',
});

const EN = {
  read: 'Thanks! We got your message and we are reading it.',
  accepted: 'Great idea! We will build it in.',
  shipped: 'Your idea is in the game now (version {v}). Have fun!',
  fixed: 'The bug you reported is fixed (version {v}). Thanks for telling us!',
};

/** the line of one message in the player's language: a template through t(), free text as it is */
export const sysText = (m, t) => (m.tpl && EN[m.tpl] ? t(`online.sys.${m.tpl}`, EN[m.tpl], m.params || {}) : m.text);

/** the grey line above our answer: "You: <first 80 characters of the Feedback>", or '' */
export const quoteText = (m, t) => (m.quote ? `${t('online.sys.you', 'You')}: ${m.quote}` : '');

/** one list item of the read only thread */
export const sysItem = (m, { t, esc, time }) => `<li class="osys">${m.quote ? `<small class="oquote">${esc(quoteText(m, t))}</small>` : ''}<span>${esc(sysText(m, t))}</span><small>${esc(time(m.at))}</small></li>`;

/** the notice that stands where the input field would be */
export const sysHint = (t) => t('online.sys.hint', 'You cannot reply here. Use the Feedback button to write to us.');

/** the symbol of the sender in the address book and the chat header (a flat speech bubble, no piece) */
export const SYSTEM_AVATAR = '<b class="oglyph osysav" data-c="sys" aria-hidden="true">★</b>';
