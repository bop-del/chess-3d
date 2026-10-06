// The Pixelwelt Sets, Sky and Backdrop rows (CHE-239): three tile rows under the theme swatches, only shown while Pixelwelt is the theme
// (desktop Scene card and phone Menu, through ui.mountSettings). One pick per row, remembered per browser (look.js). A Set sets both
// the sky and the backdrop; the Sky and Backdrop rows then adjust one axis. A pick sets the light of the stage here; the world and the
// figures follow through onLook.
import { t, onLanguage, addDE } from '../../i18n.js';
import { SKIES, SKY_IDS, BACKDROPS, BACKDROP_IDS, SETS, choice, currentSetId, setChoice, onLook, look, skyLight } from './look.js';

addDE({ 'pixsky.label': 'Himmel', 'pixsky.group': 'Himmel wählen', 'pixset.label': 'Welt', 'pixset.group': 'Welt wählen', 'pixback.label': 'Hintergrund', 'pixback.group': 'Hintergrund wählen' });
for (const s of SETS) addDE({ [`pixset.${s.id}`]: s.de });
for (const [id, s] of Object.entries(SKIES)) addDE({ [`pixsky.${id}`]: s.de });
for (const [id, b] of Object.entries(BACKDROPS)) addDE({ [`pixback.${id}`]: b.de });

export function mountLookSetting({ themes, ui, stage }) {
  const rows = [];
  const mk = (kind, label, ids, swatch, en, pick, current) => {
    const row = document.createElement('div');
    row.className = 'field themes pixlook';
    row.dataset.pixlook = kind;
    row.innerHTML = `<span data-i18n="pix${kind}.label">${label}</span><div class="swatches" role="radiogroup" data-i18n-aria="pix${kind}.group" aria-label="${label}"></div>`;
    const box = row.querySelector('.swatches'), buttons = new Map();
    for (const id of ids) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.dataset.value = id; b.setAttribute('role', 'radio');
      const [a, c] = swatch(id);
      b.style.setProperty('--sw-a', a); b.style.setProperty('--sw-b', c);
      b.innerHTML = '<i></i><b></b>';
      b.addEventListener('click', () => setChoice(pick(id)));
      box.append(b); buttons.set(id, b);
    }
    const names = () => { for (const [id, b] of buttons) { const n = t(`pix${kind}.${id}`, en(id)); b.title = n; b.setAttribute('aria-label', n); b.querySelector('b').textContent = n; } };
    const mark = () => { const v = current(); for (const [id, b] of buttons) { b.classList.toggle('on', id === v); b.setAttribute('aria-checked', id === v ? 'true' : 'false'); } };
    rows.push({ row, names, mark });
    return row;
  };
  const setOf = (id) => SETS.find((x) => x.id === id);
  mk('set', 'World', SETS.map((x) => x.id), (id) => [SKIES[setOf(id).sky].swatch[0], BACKDROPS[setOf(id).backdrop].swatch[0]], (id) => setOf(id).en, (id) => ({ set: id }), () => currentSetId());
  mk('sky', 'Sky', SKY_IDS, (id) => SKIES[id].swatch, (id) => SKIES[id].en, (id) => ({ sky: id }), () => choice().sky);
  mk('back', 'Backdrop', ['none', ...BACKDROP_IDS], (id) => BACKDROPS[id].swatch, (id) => BACKDROPS[id].en, (id) => ({ backdrop: id }), () => choice().backdrop);
  const show = () => { const on = themes.current() === 'pixel'; for (const r of rows) { r.row.hidden = !on; r.mark(); } };
  const light = () => { if (themes.current() === 'pixel') stage.setThemeLight(skyLight(look().sky)); };
  themes.on(show);
  onLook(() => { show(); light(); });
  for (const r of rows) { ui.mountSettings('themes', r.row); r.names(); }
  onLanguage(() => rows.forEach((r) => r.names()));
  show();
  return rows.map((r) => r.row);
}
