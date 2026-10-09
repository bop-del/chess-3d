// The "World" row in Options (CHE-370): None, Torch hall, Space, Zen garden, Lava. Shown for the lit themes; Pixelwelt and Blocks have
// their own world (Pixelwelt its Island row), so the row hides there. A pick is stored per browser (choice.js) and builds the world
// without a reload; ?world= beats it for that visit.
import { t, onLanguage, addDE, translateTree } from '../i18n.js';
import { WORLD_IDS, WORLD_NAMES, worldChoice, setWorld, onWorld } from './choice.js';

addDE({ 'world.label': 'Welt', 'world.group': 'Welt wählen' });
for (const [id, n] of Object.entries(WORLD_NAMES)) addDE({ [`world.${id}`]: n.de });

export function mountWorldSetting({ themes, ui }) {
  const row = document.createElement('div');
  row.className = 'field themes pixlook';
  row.dataset.pixlook = 'world';
  row.innerHTML = '<span data-i18n="world.label">World</span><div class="swatches" role="radiogroup" data-i18n-aria="world.group" aria-label="World"></div>';
  const box = row.querySelector('.swatches'), buttons = new Map();
  for (const id of WORLD_IDS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.dataset.value = id; b.setAttribute('role', 'radio');
    const [a, c] = WORLD_NAMES[id].swatch;
    b.style.setProperty('--sw-a', a); b.style.setProperty('--sw-b', c);
    b.innerHTML = '<i></i><b></b>';
    b.addEventListener('click', () => setWorld(id));
    box.append(b); buttons.set(id, b);
  }
  const names = () => { translateTree(row); for (const [id, b] of buttons) { const n = t(`world.${id}`, WORLD_NAMES[id].en); b.title = n; b.setAttribute('aria-label', n); b.querySelector('b').textContent = n; } };
  const mark = () => { const v = worldChoice(); for (const [id, b] of buttons) { b.classList.toggle('on', id === v); b.setAttribute('aria-checked', id === v ? 'true' : 'false'); } };
  const show = () => { row.hidden = themes.current() === 'pixel' || themes.current() === 'blocks'; mark(); };
  themes.on(show);
  onWorld(mark);
  ui.mountSettings('themes', row);
  names();
  onLanguage(names);
  show();
  return row;
}
