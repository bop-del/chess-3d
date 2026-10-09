// Battle scene settings: "Battle scenes" (On, Short, Off), stored per device.
// "Blood" (On, Off, Pixelwelt only, default On) sits in the same block and the same key; ?gore=0|1 beats the stored value for
// that load without overwriting it, and the control is hidden while another theme than Pixelwelt is shown.
// "Scene" (Normal, Wild, shown with the lit themes only, default Normal, CHE-369): Wild is the short weapon fight that ends in a shatter,
// plus the checkmate finale. It lives in the same key; ?capture=wild|normal beats the stored value for that load without overwriting it.
// The block is mounted in the Scene card on desktop and in the Menu sheet on phones through ui.mountSettings.
import { t, addDE, onLanguage } from '../i18n.js';
import { device } from '../device.js';
import { chipGroup } from '../panel.js';

addDE({ 'battle.scenes': 'Schlagen', 'battle.on': 'An', 'battle.short': 'Kurz', 'battle.off': 'Aus', 'battle.blood': 'Blut', 'battle.capture': 'Szene', 'battle.cap.standard': 'Normal', 'battle.cap.wild': 'Wild' });

const KEY = 'chess3d.battle';
const MODES = ['on', 'short', 'off'];
const CAPTURES = ['normal', 'wild'];
const NO_LIT = ['pixel', 'blocks'];   // themes with scenes of their own: no Scene row

function load() {
  const def = { mode: 'on', gore: true, capture: 'normal' };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { mode: MODES.includes(v.mode) ? v.mode : def.mode, gore: v.gore !== '0' && v.gore !== false, capture: CAPTURES.includes(v.capture) ? v.capture : def.capture };
  } catch (e) { return def; }
}
function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private window or blocked storage */ } }

export function createSettings({ ui, themes, gore: goreFlag = null, capture: captureFlag = null } = {}) {
  const state = load();
  const stored = { gore: state.gore, capture: state.capture };       // what is written back: a ?gore= or ?capture= flag only changes this load
  if (CAPTURES.includes(captureFlag)) state.capture = captureFlag;
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

  // Scene: Normal or Wild, lit themes only
  const capLabels = () => [{ value: 'normal', label: t('battle.cap.normal', 'Normal') }, { value: 'wild', label: t('battle.cap.wild', 'Wild') }];
  const capRow = document.createElement('div');
  capRow.className = 'battle-capture';
  let cap;
  if (device.phone) {
    cap = field('sel-capture', t('battle.capture', 'Scene'), capLabels().map((o) => [o.value, o.label]));
    capRow.append(cap.row);
    onLanguage(() => {
      cap.row.firstChild.textContent = t('battle.capture', 'Scene');
      capLabels().forEach((o, i) => { cap.sel.options[i].textContent = o.label; });
    });
  } else {
    const sel = chipGroup('sel-capture', capLabels(), { label: t('battle.capture', 'Scene') });
    const head = document.createElement('h4');
    head.textContent = t('battle.capture', 'Scene');
    head.dataset.i18n = 'battle.capture';
    head.style.marginTop = '14px';
    cap = { sel };
    capRow.append(head, sel);
    onLanguage(() => { sel.relabel(capLabels()); });
  }
  el.append(capRow);
  const showCapture = () => { capRow.hidden = themes ? NO_LIT.includes(themes.current()) : false; };
  themes?.on?.(showCapture);
  showCapture();
  const showBlood = () => { goreRow.hidden = themes ? themes.current() !== 'pixel' : false; };
  themes?.on?.(showBlood);
  showBlood();

  const sync = () => { mode.sel.value = state.mode; gore.sel.value = state.gore ? '1' : '0'; cap.sel.value = state.capture; };
  function set(partial = {}) {
    let changed = false;
    if (MODES.includes(partial.mode) && partial.mode !== state.mode) { state.mode = partial.mode; changed = true; }
    if (typeof partial.gore === 'boolean' && partial.gore !== state.gore) { state.gore = stored.gore = partial.gore; changed = true; }
    if (CAPTURES.includes(partial.capture) && partial.capture !== state.capture) { state.capture = stored.capture = partial.capture; changed = true; }
    sync();
    if (!changed) return;
    save({ mode: state.mode, gore: stored.gore, capture: stored.capture });
    listeners.forEach((fn) => fn({ ...state }));
  }
  mode.sel.addEventListener('change', () => set({ mode: mode.sel.value }));
  gore.sel.addEventListener('change', () => set({ gore: gore.sel.value === '1' }));
  cap.sel.addEventListener('change', () => set({ capture: cap.sel.value }));
  sync();
  ui?.mountSettings?.('battle', el);

  return {
    element: el,
    get mode() { return state.mode; },
    get gore() { return state.gore; },
    get capture() { return state.capture; },
    set,
    onChange(fn) { listeners.push(fn); },
  };
}
