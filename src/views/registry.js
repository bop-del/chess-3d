// Views: the named camera setups the player chooses from (Views button, preset buttons, keys 1 to 5, ?view=). One list is the
// single source. A view has a kind: 'preset' (a perspective camera preset), 'easy' (style V From above: perspective at 65 degrees with the real pieces,
// style S Symbols: flat chess diagram symbols on a plain board, perspective at 65 degrees, free orbit) or 'play' (the phone portrait play view: perspective, close, with the follow camera of src/views/play.js).
// Symbols is not a view but a switch over every view (CHE-227): toggleSymbols/setSymbols turn it on and off, the camera and the view stay.
// It is remembered under localStorage 'chess3d.symbols'; ?view=symbols and a stored view 'symbols' mean the device default view plus Symbols on.
// The choice is remembered per device under localStorage 'chess3d.view'. See docs/ARCHITECTURE.md (Views).
import { DE } from '../i18n.js';

const DEG = Math.PI / 180;
const STORE = 'chess3d.view', STORE_SYM = 'chess3d.symbols';

export const VIEWS = [
  { id: 'white', label: 'White view', kind: 'preset' },
  { id: 'black', label: 'Black view', kind: 'preset' },
  { id: 'top', label: 'Top down', kind: 'preset' },
  { id: 'side', label: 'Side', kind: 'preset' },
  { id: 'iso', label: 'Isometric', kind: 'preset' },
  { id: 'above', label: 'From above', kind: 'easy', style: 'V', pitch: 65 * DEG, persp: true },
  { id: 'play', label: 'Play', kind: 'play', when: 'phone-portrait', dist: 10.3, pitch: 40 },
];
const BY_ID = Object.assign(Object.create(null), Object.fromEntries(VIEWS.map((v) => [v.id, v])));
const BY_LABEL = Object.assign(Object.create(null), Object.fromEntries(VIEWS.map((v) => [v.label, v.id])));

// 'Von oben' is the name of From above, so the Top down preset is called Draufsicht in German
Object.assign(DE, {
  'preset.Top down': 'Draufsicht', 'preset.From above': 'Von oben',
  'preset.Play': 'Spielansicht', 'preset.Symbols': 'Symbole',
});
// From above: a slight shift of the look point towards Black keeps the back rank clear of the frame's edge
const ABOVE_FOCUS = { x: 0, z: -0.3 }, ABOVE_ZOOM = 1;

// The director (battle scenes) asks this before it plays one. Symbols has no 3D pieces to fight, so the capture just happens while
// the switch is on, in every view and theme; From above with the real pieces plays the scene (CHE-90).
let current = null;
export function viewsAllowBattle() { return !(current && current.isSymbols()); }

export function createViews({ controls, stage, game, board, device }) {
  const listeners = [], symListeners = [];
  const phonePortrait = () => !!device.phone && !!device.portrait;
  const available = (v) => !v.when || (v.when === 'phone-portrait' && phonePortrait());
  // On a phone in portrait the cycle starts with the easy views: Play, From above, then the presets
  const EASY_FIRST = ['play', 'above'];
  const list = () => {
    const l = VIEWS.filter((v) => available(v) && !v.unlisted);
    if (!phonePortrait()) return l;
    const rank = (v) => { const i = EASY_FIRST.indexOf(v.id); return i < 0 ? EASY_FIRST.length : i; };
    return l.map((v, i) => [v, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
  };
  const fallback = () => (phonePortrait() ? 'play' : 'white');
  let id = fallback();
  let symbolsOn = false;
  try {
    const s = localStorage.getItem(STORE);   // an id that is gone (tokens, easy-3d, easy-flat) is not in BY_ID: the device default stays
    if (s && BY_ID[s] && available(BY_ID[s])) id = s;
    if (s === 'symbols') { symbolsOn = true; localStorage.setItem(STORE_SYM, '1'); localStorage.removeItem(STORE); }   // the old Symbols view: default view plus the switch
    else if (localStorage.getItem(STORE_SYM) === '1') symbolsOn = true;
  } catch (e) { /* storage blocked */ }
  let applied = null;
  let focused = false;

  function enter(v, { instant = false } = {}) {
    const dur = instant ? 0 : undefined;
    controls.hooks.preset = (name) => { const k = BY_LABEL[name]; if (k) set(k); };
    controls.setOrbitLock(!!v.lock);
    controls.setEdgeToEdge(v.kind === 'easy');
    if (v.id === 'above') controls.setFocus(ABOVE_FOCUS, { dur: 0, zoom: ABOVE_ZOOM });
    else if (focused) controls.setFocus(null, { dur: 0 });
    focused = v.id === 'above';
    if (v.persp) {
      controls.glideTo({ pitch: v.pitch, yaw: 0, dist: 19, dur });
    } else if (v.kind === 'play') {
      controls.glideTo({ pitch: (v.pitch ?? 46) * DEG, dist: v.dist, dur });
    } else {
      controls.setPreset(v.label);
    }
    if (instant) for (let i = 0; i < 120; i++) controls.update(0.02);
  }

  function setSymbols(on, { remember = true } = {}) {
    on = !!on;
    if (on === symbolsOn) return true;
    symbolsOn = on;
    if (remember) try { localStorage.setItem(STORE_SYM, on ? '1' : '0'); } catch (e) { /* storage blocked */ }
    symListeners.forEach((fn) => fn(on));
    return true;
  }
  function set(next, opts = {}) {
    if (next === 'symbols') { setSymbols(true, opts); next = fallback(); }   // ?view=symbols: the default view plus Symbols on
    const v = BY_ID[next];
    if (!v || !available(v)) return false;
    const first = applied === null;
    if (v.id !== applied) {
      id = v.id; applied = v.id;
      enter(v, { instant: first || opts.instant });
      if (opts.remember !== false) try { localStorage.setItem(STORE, id); } catch (e) { /* storage blocked */ }
      listeners.forEach((fn) => fn(id));
    }
    return true;
  }
  function next() {
    const l = list();
    const i = l.findIndex((v) => v.id === id);
    set(l[(i + 1) % l.length].id);
    return id;
  }
  // The Symbols/Pieces toggle of the thumb bar and the view bar: the view and the camera stay
  function toggleSymbols() { return setSymbols(!symbolsOn); }
  // Called every frame: re-checks the device when it turns.
  function update() {
    if (applied && !available(BY_ID[applied])) set(fallback());
  }

  const api = {
    list, current: () => id, set, next, update, toggleSymbols, setSymbols,
    isSymbols: () => symbolsOn, onSymbols: (fn) => { symListeners.push(fn); }, entry: (k) => BY_ID[k] || null,
    isEasy: () => BY_ID[id].kind === 'easy',
    style: () => BY_ID[id].style || null,
    label: () => BY_ID[id].label,
    on: (fn) => { listeners.push(fn); },
    // the view that fits the camera best after a manual orbit is not tracked: the choice stays what the player picked
    byLabel: (label) => BY_LABEL[label] || null,
  };
  current = api;
  return api;
}
