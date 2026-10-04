// Battle scene settings: "Battle scenes" (On, Short, Off), stored per device.
// "Blood" (On, Off, Pixelwelt only, default On) sits in the same block and the same key; ?gore=0|1 beats the stored value for
// that load without overwriting it, and the control is hidden while another theme than Pixelwelt is shown.
// The block is mounted in the Scene card on desktop and in the Menu sheet on phones through ui.mountSettings.
import { t, addDE, onLanguage } from '../i18n.js';
import { device } from '../device.js';
import { chipGroup } from '../panel.js';

addDE({ 'battle.scenes': 'Schlagen', 'battle.on': 'An', 'battle.short': 'Kurz', 'battle.off': 'Aus', 'battle.blood': 'Blut' });

const KEY = 'chess3d.battle';
const MODES = ['on', 'short', 'off'];

function load() {
  const def = { mode: 'on', gore: true };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { mode: MODES.includes(v.mode) ? v.mode : def.mode, gore: v.gore !== '0' && v.gore !== false };
  } catch (e) { return def; }
}
function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window or blocked storage */ } }

export function createSettings({ ui, themes, gore: goreFlag = null } = {}) {
  const state = load();
  const stored = { gore: state.gore };       // what is written back: a ?gore= flag only changes this load
  if (goreFlag === '0' || goreFlag === '1') state.gore = goreFlag === '1';
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
    onLanguage(() => {
      mode.row.firstChild.textContent = t('battle.scenes', 'Battle scenes');
      labels().forEach((o, i) => { mode.sel.options[i].textContent = o.label; });
    });
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

  // Blood: its own row below Battle scenes, same widget kind as the mode control
  const goreLabels = () => [{ value: '1', label: t('battle.on', 'On') }, { value: '0', label: t('battle.off', 'Off') }];
  const goreRow = document.createElement('div');
  goreRow.className = 'battle-gore';
  let gore;
  if (device.phone) {
    gore = field('sel-gore', t('battle.blood', 'Blood'), goreLabels().map((o) => [o.value, o.label]));
    goreRow.append(gore.row);
    onLanguage(() => {
      gore.row.firstChild.textContent = t('battle.blood', 'Blood');
      goreLabels().forEach((o, i) => { gore.sel.options[i].textContent = o.label; });
    });
  } else {
    const sel = chipGroup('sel-gore', goreLabels(), { label: t('battle.blood', 'Blood') });
    const head = document.createElement('h4');
    head.textContent = t('battle.blood', 'Blood');
    head.dataset.i18n = 'battle.blood';
    head.style.marginTop = '14px';     // the card gives only the first heading of the block room above it
    gore = { sel };
    goreRow.append(head, sel);
    onLanguage(() => { sel.relabel(goreLabels()); });
  }
  el.append(goreRow);
  const showBlood = () => { goreRow.hidden = themes ? themes.current() !== 'pixel' : false; };
  themes?.on?.(showBlood);
  showBlood();

  const sync = () => { mode.sel.value = state.mode; gore.sel.value = state.gore ? '1' : '0'; };
  function set(partial = {}) {
    let changed = false;
    if (MODES.includes(partial.mode) && partial.mode !== state.mode) { state.mode = partial.mode; changed = true; }
    if (typeof partial.gore === 'boolean' && partial.gore !== state.gore) { state.gore = stored.gore = partial.gore; changed = true; }
    sync();
    if (!changed) return;
    save({ mode: state.mode, gore: stored.gore });
    listeners.forEach((fn) => fn({ ...state }));
  }
  mode.sel.addEventListener('change', () => set({ mode: mode.sel.value }));
  gore.sel.addEventListener('change', () => set({ gore: gore.sel.value === '1' }));
  sync();
  ui?.mountSettings?.('battle', el);

  return {
    element: el,
    get mode() { return state.mode; },
    get gore() { return state.gore; },
    set,
    onChange(fn) { listeners.push(fn); },
  };
}
