// Battle scene settings: "Battle scenes" (On, Short, Off), stored per device.
// The block is mounted in the Scene card on desktop and in the Menu sheet on phones through ui.mountSettings.
import { t, onLanguage } from '../i18n.js';
import { device } from '../device.js';
import { chipGroup } from '../panel.js';

const KEY = 'chess3d.battle';
const MODES = ['on', 'short', 'off'];

function load() {
  const def = { mode: 'on' };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { mode: MODES.includes(v.mode) ? v.mode : def.mode };
  } catch (e) { return def; }
}
function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window or blocked storage */ } }

export function createSettings({ ui } = {}) {
  const state = load();
  const listeners = [];

  const el = document.createElement('div');
  el.className = 'battle-settings';
  const field = (id, label, options) => {
    const row = document.createElement('label');
    row.className = 'field';
    const name = document.createElement('span');
    name.textContent = label;
    const sel = document.createElement('select');
    sel.id = id;
    for (const [value, text] of options) {
      const o = document.createElement('option');
      o.value = value; o.textContent = text;
      sel.append(o);
    }
    row.append(name, sel);
    return { row, sel };
  };
  const labels = () => [{ value: 'on', label: t('battle.on', 'On') }, { value: 'short', label: t('battle.short', 'Short') }, { value: 'off', label: t('battle.off', 'Off') }];
  let mode;
  if (device.phone) {
    mode = field('sel-battle', t('battle.scenes', 'Battle scenes'), labels().map((o) => [o.value, o.label]));
    el.append(mode.row);
  } else {
    // desktop and tablets: visible chips instead of a dropdown, with a value and a change event like the select
    const sel = chipGroup('sel-battle', labels(), { label: t('battle.scenes', 'Battle scenes') });
    const head = document.createElement('h4');
    head.textContent = t('battle.scenes', 'Battle scenes');
    head.dataset.i18n = 'battle.scenes';
    mode = { sel };
    el.append(head, sel);
    onLanguage(() => { sel.relabel(labels()); });
  }

  const sync = () => { mode.sel.value = state.mode; };
  function set(partial = {}) {
    let changed = false;
    if (MODES.includes(partial.mode) && partial.mode !== state.mode) { state.mode = partial.mode; changed = true; }
    sync();
    if (!changed) return;
    save(state);
    listeners.forEach((fn) => fn({ ...state }));
  }
  mode.sel.addEventListener('change', () => set({ mode: mode.sel.value }));
  sync();
  ui?.mountSettings?.('battle', el);

  return {
    element: el,
    get mode() { return state.mode; },
    set,
    onChange(fn) { listeners.push(fn); },
  };
}
