// The daily puzzle card on the start screen: title, the puzzle's theme line, the streak, a Start button, or "Solved today" with
// a gold or silver mark once it is done. Desktop: the top of the Play tab. Phone: the top of the Game section of the Menu sheet.
// It shows while no game is running: no move played, no Explain, Drill or Puzzle open.
import * as I18N from '../i18n.js';
import { themeLine } from './panel.js';
import './strings.js';

const { t, onLanguage } = I18N;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const streakText = (n) => (n === 0 ? t('daily.streak0', 'Start your streak') : n === 1 ? t('daily.streak1', '1 day in a row') : t('daily.streak', '{n} days in a row', { n }));

/** The card element. `update()` redraws it from the daily store; Start calls onStart() then the puzzle opens. */
export function dailyCard({ daily, onStart }) {
  const root = el('section', 'dailycard');
  root.setAttribute('aria-label', t('daily.title', 'Daily puzzle'));
  function update() {
    const p = daily.puzzle(), mark = daily.done(), n = daily.streak();
    root.dataset.state = mark ? 'done' : 'open';
    if (mark) root.dataset.mark = mark; else delete root.dataset.mark;
    root.setAttribute('aria-label', t('daily.title', 'Daily puzzle'));
    const head = el('div', 'dchead');
    head.append(el('b', 'dctitle', t('daily.title', 'Daily puzzle')));
    const best = daily.best();
    const streak = el('span', 'dcstreak', streakText(n));
    if (best > 1) streak.title = t('daily.best', 'Best: {n}', { n: best });
    head.append(streak);
    const line = el('p', 'dctheme', p ? themeLine(p.theme) : '');
    const foot = el('div', 'dcfoot');
    if (mark) {
      const done = el('span', 'dcdone');
      const dot = el('i', `pzdot ${mark === 'g' ? 'gold' : 'silver'}`);
      dot.setAttribute('role', 'img');
      dot.setAttribute('aria-label', t(`daily.mark.${mark}`, mark === 'g' ? 'solved without help' : 'solved with help'));
      done.append(dot, document.createTextNode(t('daily.done', 'Solved today')));
      foot.append(done);
    } else {
      const b = el('button', 'btn primary dcstart', t('daily.start', 'Start'));
      b.type = 'button';
      b.addEventListener('click', () => onStart());
      foot.append(b);
    }
    root.replaceChildren(head, line, foot);
  }
  daily.onChange(update);
  onLanguage(update);
  update();
  root.update = update;
  return root;
}

const RUNNING = ['explaining', 'drilling', 'puzzling'];

/** Builds the card, mounts it through ui.mountDaily and keeps it hidden while a game or a lesson runs. */
export function mountDailyCard({ daily, ui, game, puzzles, onStart = () => {} }) {
  const card = dailyCard({ daily, onStart: () => { onStart(); puzzles.startDaily(daily.puzzle()); } });
  const host = ui.mountDaily(card);
  const sync = () => {
    const running = RUNNING.some((c) => document.body.classList.contains(c)) || game.getState().moves.length > 0;
    card.hidden = running;
  };
  game.on('change', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
  return { card, host, sync };
}
