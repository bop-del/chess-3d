// Puzzles panel: the puzzle in progress, in the look of the Drill and Explain panels (same classes, explain.css). Phone: a
// strip under the status line, because the theme line is about the position and a sheet would hide it. Desktop: one card in
// the right column. It shows the theme line, the band, one calm message and the buttons, never a score, a count or a streak.
// The idle side (Start or Next) is the Learn tab, built by puzzlesTab() below.
import * as I18N from '../i18n.js';
import { device } from '../device.js';
import { THEMES } from './themes.js';
import './strings.js';
import './puzzles.css';

const { t, onLanguage, i18n } = I18N;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
export const themeLine = (id) => (THEMES[id] ? THEMES[id][i18n.language] || THEMES[id].en : '');
export const bandName = (b) => t(`puzzles.band.${b}`, b[0].toUpperCase() + b.slice(1));

const SAY = {
  start: ['puzzles.your', 'Your move.'],
  your: ['puzzles.your', 'Your move.'],
  right: ['puzzles.right', 'Right. The opponent replies.'],
  wrong: ['puzzles.wrong', 'Not this one. Try again.'],
  again: ['puzzles.again', 'Not yet. Take your time.'],
  help: ['puzzles.helpShown', 'The gold arrow shows the move.'],
};
function sentence(s) {
  const m = s.message?.type;
  if (m === 'solved') return s.clean ? t('puzzles.solved', 'Solved!') : t('puzzles.solvedLater', 'Solved. This one comes back later.');
  const k = SAY[m];
  return k ? t(k[0], k[1]) : '';
}

export function mountPuzzlesPanel({ puzzles, ui = null, onClose = null }) {
  const root = el('div', 'xp pzp');
  const card = ui?.mountPanel ? ui.mountPanel('puzzles', root, { title: t('puzzles.tab', 'Puzzles') }) : null;
  const strip = device.phone ? el('section', 'xstrip pzstrip') : null;
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
  const close = () => (onClose ? onClose() : puzzles.stop());

  function body(s, compact) {
    const box = el('div', 'xwalk');
    const head = el('div', 'xhead');
    const title = el('div', 'xtitle');
    title.append(el('b', 'pztheme', themeLine(s.theme)), el('span', 'xside pzband', bandName(s.band)));
    const x = button(compact ? '✕' : t('puzzles.stop', 'Stop'), 'xclose', close);
    x.setAttribute('aria-label', t('puzzles.stop', 'Stop'));
    head.append(title, x);
    const text = el('p', 'xtext pzsay', sentence(s));
    text.dataset.kind = s.message?.type === 'wrong' || s.message?.type === 'again' ? 'wrong' : s.message?.type || '';
    box.append(head, text);
    const row = el('div', 'xrow');
    if (s.phase === 'solved') row.append(button(t('puzzles.next', 'Next puzzle'), 'primary pznext', () => puzzles.next()));
    else row.append(button(t('puzzles.help', 'Help'), 'pzhelp', () => puzzles.help()));
    row.lastChild.disabled = s.phase === 'solved' ? false : !s.canHelp;
    box.append(row);
    return box;
  }

  function render() {
    const s = puzzles.state();
    const live = s.phase !== 'idle';
    if (card) { card.hidden = !live || !!strip; card.querySelector('h2').textContent = t('puzzles.tab', 'Puzzles'); }
    document.body.classList.toggle('puzzling', live);
    if (!live) {
      root.replaceChildren();
      if (strip) { strip.hidden = true; strip.replaceChildren(); document.body.style.setProperty('--ph', '0px'); }
      return;
    }
    if (strip) {
      strip.hidden = false;
      strip.replaceChildren(body(s, true));
      document.body.style.setProperty('--ph', `${strip.offsetHeight}px`);
    } else root.replaceChildren(body(s, false));
  }

  puzzles.on(render);
  onLanguage(render);
  if (strip && window.ResizeObserver) new ResizeObserver(() => { if (!strip.hidden) document.body.style.setProperty('--ph', `${strip.offsetHeight}px`); }).observe(strip);
  render();
  return { card, strip, root };
}

// The Learn tab: the band, one big Start or Next button. `onStart` lets the Learn sheet close itself and stop whatever else
// runs on the board before the puzzle opens.
export function puzzlesTab({ puzzles, progress, onStart = () => {} }) {
  const box = el('div', 'xlist pztab');
  const st = progress.stats();
  const used = Object.values(st.solved).some((n) => n > 0) || st.queued > 0;
  if (!Object.values(st.size).some((n) => n > 0)) {
    box.append(el('p', 'xlead xempty', t('puzzles.empty', 'No puzzles available.')));
    return box;
  }
  box.append(el('p', 'xlead', t('puzzles.lead', 'Short tasks on the board. Find the best move. It never runs out.')));
  const band = el('p', 'pzbandline');
  band.append(el('span', '', t('puzzles.band', 'Level')), el('b', '', bandName(st.band)));
  box.append(band);
  const go = el('button', 'btn primary pzstart', used ? t('puzzles.next', 'Next puzzle') : t('puzzles.start', 'Start'));
  go.type = 'button';
  go.addEventListener('click', () => { onStart(); puzzles.start(); });
  box.append(go);
  return box;
}
