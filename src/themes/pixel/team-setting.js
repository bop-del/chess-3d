// The Pixelwelt "Team" row (CHE-372): knights against monsters (the default), sun knights against dragons, wizards against goblins or
// pirates against ghost pirates, shown under the Island
// row only while Pixelwelt is the theme (desktop Scene card and phone Menu, through ui.mountSettings). The pick is stored per browser
// (heroes.js, chess3d.pixteam); ?pixteam= beats it for that visit. A pick builds the theme again without a reload, so every figure on
// the board and in the captured rows changes in place.
import { t, onLanguage, addDE, translateTree } from '../../i18n.js';
import { TEAM_IDS, TEAM_NAMES, teamChoice, setTeam, onTeam } from './heroes.js';

addDE({ 'pixteam.label': 'Team', 'pixteam.group': 'Team wählen' });
for (const [id, n] of Object.entries(TEAM_NAMES)) addDE({ [`pixteam.${id}`]: n.de });

export function mountTeamSetting({ themes, ui }) {
  const row = document.createElement('div');
  row.className = 'field themes pixlook';
  row.dataset.pixlook = 'team';
  row.innerHTML = '<span data-i18n="pixteam.label">Team</span><div class="swatches" role="radiogroup" data-i18n-aria="pixteam.group" aria-label="Team"></div>';
  const box = row.querySelector('.swatches'), buttons = new Map();
  for (const id of TEAM_IDS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.dataset.value = id; b.setAttribute('role', 'radio');
    const [a, c] = TEAM_NAMES[id].swatch;
    b.style.setProperty('--sw-a', a); b.style.setProperty('--sw-b', c);
    b.innerHTML = '<i></i><b></b>';
    b.addEventListener('click', () => setTeam(id));
    box.append(b); buttons.set(id, b);
  }
  const names = () => { translateTree(row); for (const [id, b] of buttons) { const n = t(`pixteam.${id}`, TEAM_NAMES[id].en); b.title = n; b.setAttribute('aria-label', n); b.querySelector('b').textContent = n; } };
  const mark = () => { const v = teamChoice(); for (const [id, b] of buttons) { b.classList.toggle('on', id === v); b.setAttribute('aria-checked', id === v ? 'true' : 'false'); } };
  const show = () => { row.hidden = themes.current() !== 'pixel'; mark(); };
  themes.on(show);
  onTeam(() => { mark(); themes.rebuild(); });
  ui.mountSettings('themes', row);
  names();
  onLanguage(names);
  show();
  return row;
}
