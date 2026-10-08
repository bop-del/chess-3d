// The Pixelwelt "Island" row (CHE-357): five choices a to e (meadow, beach, village, floating, volcano), shown under the Backdrop row only
// while Pixelwelt is the theme (desktop Scene card and phone Menu, through ui.mountSettings). The pick is stored per browser
// (islands.js, chess3d.pixisland, default d); ?island= beats it for that visit. A pick builds the Pixelwelt world again without a reload.
import { t, onLanguage, addDE, translateTree } from '../../i18n.js';
import { ISLAND_IDS, ISLAND_NAMES, islandChoice, setIsland, onIsland } from './islands.js';

addDE({ 'pixisland.label': 'Insel', 'pixisland.group': 'Insel wählen' });
for (const [id, n] of Object.entries(ISLAND_NAMES)) addDE({ [`pixisland.${id}`]: n.de });

export function mountIslandSetting({ themes, ui }) {
  const row = document.createElement('div');
  row.className = 'field themes pixlook';
  row.dataset.pixlook = 'island';
  row.innerHTML = '<span data-i18n="pixisland.label">Island</span><div class="swatches" role="radiogroup" data-i18n-aria="pixisland.group" aria-label="Island"></div>';
  const box = row.querySelector('.swatches'), buttons = new Map();
  for (const id of ISLAND_IDS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.dataset.value = id; b.setAttribute('role', 'radio');
    const [a, c] = ISLAND_NAMES[id].swatch;
    b.style.setProperty('--sw-a', a); b.style.setProperty('--sw-b', c);
    b.innerHTML = '<i></i><b></b>';
    b.addEventListener('click', () => setIsland(id));
    box.append(b); buttons.set(id, b);
  }
  const names = () => { translateTree(row); for (const [id, b] of buttons) { const n = t(`pixisland.${id}`, ISLAND_NAMES[id].en); b.title = n; b.setAttribute('aria-label', n); b.querySelector('b').textContent = n; } };
  const mark = () => { const v = islandChoice(); for (const [id, b] of buttons) { b.classList.toggle('on', id === v); b.setAttribute('aria-checked', id === v ? 'true' : 'false'); } };
  const show = () => { row.hidden = themes.current() !== 'pixel'; mark(); };
  themes.on(show);
  onIsland(() => { mark(); themes.rebuild(); });
  ui.mountSettings('themes', row);
  names();
  onLanguage(names);
  show();
  return row;
}
