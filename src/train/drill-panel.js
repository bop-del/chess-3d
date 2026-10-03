// Drill panel: the session in progress, in the look of the Explain panel (same classes, explain.css). Phone: a strip under
// the status line, because the sentence is about the position and a sheet would hide it. Desktop: one card in the right
// column. It shows the move sentence, never a score, a count or a streak. Every string goes through t(); the German
// strings are registered here with addDE.
import * as I18N from '../i18n.js';
import { device } from '../device.js';
import './drill.css';

const { t, onLanguage, i18n, addDE } = I18N;

addDE({
  'drill.title': 'Üben',
  'drill.yourMove': 'Dein Zug.',
  'drill.watch': 'Schau zu.',
  'drill.missLead': 'Nicht ganz.',
  'drill.done': 'Fertig.',
  'drill.donePractise': 'Die Linie ist durch.',
  'drill.stop': 'Beenden',
  'drill.close': 'Schließen',
  'drill.again': 'Nochmal',
});

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const pick = (pair) => (pair ? pair[i18n.language] || pair.en || '' : '');
const sideLabel = (l) => t(l.side === 'w' ? 'explain.forWhite' : 'explain.forBlack', l.side === 'w' ? 'You play White' : 'You play Black');

export function mountDrillPanel({ drill, ui = null, onClose = null, onAgain = null }) {
  const root = el('div', 'xp drillp');
  const card = ui?.mountPanel ? ui.mountPanel('drill', root, { title: t('drill.title', 'Drill') }) : null;
  const strip = device.phone ? el('section', 'xstrip drillstrip') : null;
  if (strip) {
    strip.hidden = true;
    strip.setAttribute('aria-live', 'polite');
    document.getElementById('hud').append(strip);
  }
  if (card) card.hidden = true;

  const button = (label, cls, fn) => {
    const b = el('button', `btn ${cls || ''}`.trim(), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };

  function sentence(s) {
    const m = s.message;
    if (!m || s.phase === 'finished') return s.phase === 'finished' ? t(s.mode === 'due' ? 'drill.done' : 'drill.donePractise', s.mode === 'due' ? 'Done.' : 'The line is through.') : '';
    const mv = s.line.moves[m.ply];
    if (m.type === 'prompt') return pick(s.line.moves[m.ply - 1]) || pick(s.line.intro);
    const text = pick(mv);
    return m.type === 'miss' ? `${t('drill.missLead', 'Not quite.')} ${text}` : text;
  }

  function body(s, compact) {
    const box = el('div', 'xwalk');
    const head = el('div', 'xhead');
    const title = el('div', 'xtitle');
    title.append(el('b', '', pick(s.line.name)), el('span', 'xside', sideLabel(s.line)));
    head.append(title);
    if (!compact) {   // phone: Beenden sits in the learning bar
      const close = button(t('drill.stop', 'Stop'), 'xclose', () => (onClose ? onClose() : drill.stop()));
      close.setAttribute('aria-label', t('drill.stop', 'Stop'));
      head.append(close);
    }
    const text = el('p', 'xtext', sentence(s));
    text.dataset.kind = s.message?.type === 'miss' ? 'refused' : s.message?.type || '';
    const meta = el('div', 'xmeta');
    const status = s.phase === 'finished' ? '' : s.awaiting ? t('drill.yourMove', 'Your move.') : t('drill.watch', 'Watch.');
    meta.append(el('span', '', status));
    box.append(head, text, meta);
    if (s.phase === 'finished' && !compact) {
      const row = el('div', 'xrow');
      if (s.mode === 'practise') row.append(button(t('drill.again', 'Again'), '', () => (onAgain ? onAgain(s.line.id) : drill.startPractise(s.line.id))));
      row.append(button(t('drill.close', 'Close'), 'primary', () => (onClose ? onClose() : drill.stop())));
      box.append(row);
    }
    return box;
  }

  // phone: the thumb bar becomes the controls (Show me, Hint, End); finished: Again (practise) and End
  function learnBar(s) {
    const end = { id: 'end', icon: 'end', label: t('lb.end', 'End'), aria: t('drill.stop', 'Stop'), run: () => (onClose ? onClose() : drill.stop()) };
    if (s.phase === 'finished') {
      const again = s.mode === 'practise' ? [{ id: 'again', icon: 'show', label: t('lb.again', 'Again'), aria: t('drill.again', 'Again'), run: () => (onAgain ? onAgain(s.line.id) : drill.startPractise(s.line.id)) }] : [];
      return [...again, { ...end, primary: true }];
    }
    return [
      { id: 'show', icon: 'show', label: t('lb.show', 'Show me'), aria: t('explain.showMe', 'Show me'), primary: true, disabled: !s.awaiting, run: () => drill.showMe() },
      { id: 'hint', icon: 'good', label: t('lb.hint', 'Hint'), aria: t(s.hint ? 'explain.hintOff' : 'explain.hintOn', s.hint ? 'Hide the hint' : 'Show the hint'), on: s.hint, pressed: s.hint, run: () => drill.setHint(!s.hint) },
      end,
    ];
  }

  function render() {
    const s = drill.state();
    ui?.setLearnBar?.('drill', strip && s.phase !== 'idle' ? learnBar(s) : null);
    const live = s.phase !== 'idle';
    if (card) { card.hidden = !live || !!strip; card.querySelector('h2').textContent = t('drill.title', 'Drill'); }
    document.body.classList.toggle('drilling', live);
    if (!live) {
      root.replaceChildren();
      if (strip) { strip.hidden = true; strip.replaceChildren(); document.body.style.setProperty('--dh', '0px'); }
      return;
    }
    if (strip) {
      strip.hidden = false;
      strip.replaceChildren(body(s, true));
    } else root.replaceChildren(body(s, false));
    if (strip) document.body.style.setProperty('--dh', `${strip.offsetHeight}px`);
  }

  drill.on(render);
  onLanguage(render);
  if (strip && window.ResizeObserver) new ResizeObserver(() => { if (!strip.hidden) document.body.style.setProperty('--dh', `${strip.offsetHeight}px`); }).observe(strip);
  render();

  return { card, strip, root };
}
