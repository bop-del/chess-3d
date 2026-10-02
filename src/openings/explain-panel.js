// Explain panel: the line list, and the line in progress (title, sentence, Back, Show me, hint switch, finish).
// Desktop: one card in the right column. Phone: the card in the Menu sheet holds the list; while a line is walked the
// sentence and buttons sit in a strip under the status line, because the sentence is about the position and the Menu
// sheet would hide it. Every string goes through t(); line texts come in { en, de } pairs and are picked by language.
import * as I18N from '../i18n.js';
import { device } from '../device.js';
import { createExplain, playable } from './explain.js';
import { createHint } from './arrow.js';
import './explain.css';

const { t, onLanguage, i18n } = I18N;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const pick = (pair) => (pair ? pair[i18n.language] || pair.en || '' : '');
// German piece letters are the i18n layer's job; until it exports a converter the English letters show.
const show = (san) => (typeof I18N.san === 'function' ? I18N.san(san, i18n.language) : san);

export function mountExplain({ game, controls, ui, gimbal, pause = 900 }) {
  const hint = createHint({ gimbal });
  const explain = createExplain({
    game, hint, pause,
    onSide(side) {
      // face the board from the line's side; leave the view alone when it already does
      const facesBlack = Math.cos(controls.camera.yaw) < 0;
      if ((side === 'b') !== facesBlack) controls.flip();
    },
  });

  const root = el('div', 'xp');
  const card = ui.mountPanel('openings', root, { title: t('explain.title', 'Openings'), phone: device.phone });
  if (device.phone) card.parentElement?.prepend(card);   // first in the Menu sheet: it is the way into the trainer
  const strip = device.phone ? el('section', 'xstrip') : null;
  if (strip) {
    strip.hidden = true;
    strip.setAttribute('aria-live', 'polite');
    document.getElementById('hud').append(strip);
  }

  function button(label, cls, fn) {
    const b = el('button', `btn ${cls || ''}`.trim(), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  const closeSheet = () => document.querySelector('.pscrim.open')?.click();

  // ------------------------------------------------------------ pieces
  function sentence(s) {
    const m = s.message;
    if (!m) return '';
    if (m.type === 'intro') return pick(s.line.intro);
    if (m.type === 'refused') return `${t('explain.notThisMove', 'Not this move. The line plays')} ${show(m.san)}.`;
    const text = pick(s.line.moves[m.ply]);
    return m.end && s.line.ending ? `${text} ${pick(s.line.ending)}` : text;
  }
  function status(s) {
    if (s.phase === 'finished') return t('explain.done', 'Line complete.');
    return s.due.own ? t('explain.yourMove', 'Your move.') : t('explain.opponentMoves', 'The opponent replies.');
  }
  const sideLabel = (l) => t(l.side === 'w' ? 'explain.forWhite' : 'explain.forBlack', l.side === 'w' ? 'You play White' : 'You play Black');

  function controlsRow(s) {
    const row = el('div', 'xrow');
    const back = button(t('explain.back', 'Back'), '', () => explain.back());
    back.disabled = !s.canBack;
    row.append(back);
    if (s.phase === 'finished') {
      row.append(button(t('explain.again', 'Again'), 'primary', () => explain.restart()));
    } else {
      row.append(button(t('explain.showMe', 'Show me'), 'primary', () => explain.next()));
    }
    const hintBtn = button(t(s.hint ? 'explain.hintOff' : 'explain.hintOn', s.hint ? 'Hide the hint' : 'Show the hint'), 'xhint', () => explain.setHint(!s.hint));
    row.append(hintBtn);
    return row;
  }

  function walking(s, { compact }) {
    const box = el('div', 'xwalk');
    const head = el('div', 'xhead');
    const title = el('div', 'xtitle');
    title.append(el('b', '', pick(s.line.name)), el('span', 'xside', sideLabel(s.line)));
    head.append(title, button(compact ? '✕' : t('explain.all', 'All openings'), 'xclose', () => explain.stop()));
    if (compact) head.lastChild.setAttribute('aria-label', t('explain.all', 'All openings'));
    const text = el('p', 'xtext', sentence(s));
    text.dataset.kind = s.message?.type || '';
    const meta = el('div', 'xmeta');
    meta.append(el('span', '', status(s)), el('span', '', `${Math.min(s.ply, s.total)} / ${s.total}`));
    box.append(head, text, meta, controlsRow(s));
    if (s.phase === 'finished') box.append(button(t('explain.another', 'Choose another line'), 'xmore', () => explain.stop()));
    return box;
  }

  function list() {
    const box = el('div', 'xlist');
    box.append(el('p', 'xlead', t('explain.lead', 'Pick an opening. You play your moves, the game plays the other side, and every move says what it is for.')));
    for (const line of explain.lines) {
      const ok = playable(line);
      const b = el('button', 'xline');
      b.type = 'button';
      b.disabled = !ok;
      b.dataset.id = line.id;
      b.append(el('b', '', pick(line.name)), el('span', 'xside', sideLabel(line)), el('span', 'xidea', ok ? pick(line.idea) : t('explain.soon', 'Coming soon')));
      b.addEventListener('click', () => { if (explain.start(line.id)) closeSheet(); });
      box.append(b);
    }
    return box;
  }

  // ------------------------------------------------------------ render
  function render() {
    const s = explain.state();
    card.querySelector('h2').textContent = t('explain.title', 'Openings');
    root.replaceChildren(s.phase === 'list' ? list() : strip ? stub(s) : walking(s, { compact: false }));
    document.body.classList.toggle('explaining', s.phase !== 'list');
    if (!strip) return;
    strip.hidden = s.phase === 'list';
    if (s.phase !== 'list') {
      strip.replaceChildren(walking(s, { compact: true }));
      document.body.style.setProperty('--xh', `${strip.offsetHeight}px`);
    } else document.body.style.setProperty('--xh', '0px');
  }
  // Phone Menu card while a line runs: only a way out, the walking UI is in the strip.
  function stub(s) {
    const box = el('div', 'xlist');
    box.append(el('p', 'xlead', `${pick(s.line.name)}. ${sideLabel(s.line)}.`), button(t('explain.all', 'All openings'), '', () => explain.stop()));
    return box;
  }

  explain.on(render);
  onLanguage(render);
  if (strip && window.ResizeObserver) new ResizeObserver(() => { if (!strip.hidden) document.body.style.setProperty('--xh', `${strip.offsetHeight}px`); }).observe(strip);
  render();

  return { explain, hint, card, strip, tick: (dt) => explain.tick(dt) };
}
