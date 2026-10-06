// The theme swatch row: first line of the Scene card on desktop, of the Menu sheet on phones (through ui.mountSettings).
import { t, onLanguage, translateTree } from '../i18n.js';
import { dressTile, dressBox } from './tiles.js';

export function mountSwatches({ themes, ui }) {
  const row = document.createElement('div');
  row.className = 'field themes';
  row.innerHTML = '<span data-i18n="theme.label">Theme</span><div class="swatches" role="radiogroup" data-i18n-aria="theme.group" aria-label="Choose a theme"></div>';
  const box = row.querySelector('.swatches');
  const buttons = new Map();
  dressBox(box);
  for (const th of themes.list()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.theme = th.id;
    b.setAttribute('role', 'radio');
    b.style.setProperty('--sw-a', th.swatch[0]);
    b.style.setProperty('--sw-b', th.swatch[1]);
    b.innerHTML = '<i></i><b></b>';
    dressTile(b, 'theme', th.id, th.swatch);
    b.addEventListener('click', () => themes.set(th.id));
    box.append(b);
    buttons.set(th.id, b);
  }
  const label = () => {
    translateTree(row);
    for (const th of themes.list()) {
      const b = buttons.get(th.id), name = t(`theme.${th.id}`, th.label.en);
      b.title = name; b.setAttribute('aria-label', name); b.querySelector('b').textContent = name;
    }
  };
  const mark = (id) => { for (const [k, b] of buttons) { b.classList.toggle('on', k === id); b.setAttribute('aria-checked', k === id ? 'true' : 'false'); } };
  themes.on(mark);
  mark(themes.current());
  label();
  onLanguage(label);
  ui.mountSettings('themes', row);
  row.parentElement?.prepend(row);   // the theme is the first thing in the Scene card
  return row;
}
