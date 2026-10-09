// The Showcase entry of the menu (CHE-374): a small card, on desktop right under the daily puzzle card in the Play tab, on a
// phone at the end of the Game section of the menu (below the Play button, which must stay on screen in landscape). A game to pick and two buttons, Trailer (about a minute) and Full game; a press closes the
// menu and the showcase starts. A tap ends it and the game that was on the board comes back (showcase.js keeps it).
// Hidden while Explain, Drill, a puzzle or the game review runs (they own the board).
import { t, addDE, onLanguage, i18n } from '../i18n.js';
import { GAMES, DEFAULT_GAME } from './games.js';
import './entry.css';

addDE({
  'showcase.title': 'Berühmte Partie',
  'showcase.text': 'Die Kamera zeigt eine berühmte Partie wie im Kino. Tippen beendet sie, dein Spiel geht weiter.',
  'showcase.trailer': 'Trailer',
  'showcase.full': 'Ganze Partie',
  'showcase.pick': 'Partie',
});
const RUNNING = ['explaining', 'drilling', 'puzzling', 'reviewing'];   // the game review owns the Play tab too

export function mountShowcaseEntry({ ui, game, start }) {
  const root = document.createElement('section');
  root.className = 'showcase-entry';
  let pick = DEFAULT_GAME;
  function render() {
    const lang = i18n.language === 'de' ? 'de' : 'en';
    root.setAttribute('aria-label', t('showcase.title', 'Famous game'));
    root.innerHTML = `<div class="sce-head"><b class="sce-title"></b><select class="sce-pick"></select></div><p class="sce-text"></p>
      <div class="sce-row"><button type="button" class="btn primary sce-go" data-mode="trailer"></button><button type="button" class="btn sce-go" data-mode="1"></button></div>`;
    root.querySelector('.sce-title').textContent = t('showcase.title', 'Famous game');
    root.querySelector('.sce-text').textContent = t('showcase.text', 'The camera shows a famous game like a film. A tap ends it and your game goes on.');
    const sel = root.querySelector('.sce-pick');
    sel.setAttribute('aria-label', t('showcase.pick', 'Game'));
    for (const g of Object.values(GAMES)) {
      const o = document.createElement('option');
      o.value = g.id; o.textContent = g.title[lang];   // the year is on the title card; the phone row has no room for it
      sel.append(o);
    }
    sel.value = pick;
    sel.addEventListener('change', () => { pick = sel.value; });
    const [trailer, full] = root.querySelectorAll('.sce-go');
    trailer.textContent = t('showcase.trailer', 'Trailer');
    full.textContent = t('showcase.full', 'Full game');
    for (const b of [trailer, full]) b.addEventListener('click', () => { ui.closeSheets?.(); start(b.dataset.mode, pick); });
  }
  render();
  onLanguage(render);
  const desk = document.querySelector('#tp-play');
  const host = desk || document.querySelector('#hud .card[data-card="game"] .body');
  const daily = desk?.querySelector(':scope > .dailycard');
  if (!desk) host?.append(root);
  else if (daily) daily.after(root); else host.prepend(root);
  const sync = () => { root.hidden = RUNNING.some((c) => document.body.classList.contains(c)) || game.mode !== 'play'; };
  game.on('change', sync);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
  return { el: root, host, sync };
}
