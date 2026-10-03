// Views: the named camera setups the player chooses from (Views button, preset buttons, keys 1 to 5, ?view=). One list is the
// single source. A view has a kind: 'preset' (a perspective camera preset), 'easy' (style T Tokens: flat top view with turned
// discs, style V From above: perspective at 65 degrees with the real pieces, style B Easy 3D: steep orthographic, style S Symbols: flat chess diagram symbols on a plain board, perspective at 65 degrees, free orbit) or 'play' (the phone portrait play view: perspective, close, with the follow camera of src/views/play.js).
// The choice is remembered per device under localStorage 'chess3d.view'. See docs/ARCHITECTURE.md (Views).
import { DE } from '../i18n.js';

const DEG = Math.PI / 180;
const STORE = 'chess3d.view';

export const VIEWS = [
  { id: 'white', label: 'White view', kind: 'preset' },
  { id: 'black', label: 'Black view', kind: 'preset' },
  { id: 'top', label: 'Top down', kind: 'preset' },
  { id: 'side', label: 'Side', kind: 'preset' },
  { id: 'iso', label: 'Isometric', kind: 'preset' },
  { id: 'tokens', label: 'Tokens', kind: 'easy', style: 'T', pitch: 89.6 * DEG, lock: true },
  { id: 'symbols', label: 'Symbols', kind: 'easy', style: 'S', pitch: 65 * DEG, persp: true },
  { id: 'above', label: 'From above', kind: 'easy', style: 'V', pitch: 65 * DEG, lock: true, persp: true },
  { id: 'easy-3d', label: 'Easy 3D', kind: 'easy', style: 'B', pitch: 62 * DEG },
  { id: 'play', label: 'Play', kind: 'play', when: 'phone-portrait', dist: 10.3, pitch: 40 },
];
const BY_ID = Object.assign(Object.create(null), Object.fromEntries(VIEWS.map((v) => [v.id, v])));
const BY_LABEL = Object.assign(Object.create(null), Object.fromEntries(VIEWS.map((v) => [v.label, v.id])));
export const PIECE_SCALE_B = 1.15;

// 'Von oben' is the name of From above, so the Top down preset is called Draufsicht in German
Object.assign(DE, {
  'preset.Top down': 'Draufsicht', 'preset.Tokens': 'Spielsteine', 'preset.From above': 'Von oben', 'preset.Easy 3D': 'Einfach 3D',
  'preset.Play': 'Spielansicht', 'preset.Symbols': 'Symbole',
});
// A stored id from before Tokens existed
const MIGRATE = Object.assign(Object.create(null), { 'easy-flat': 'tokens' });
// From above: a slight shift of the look point towards Black keeps the back rank clear of the frame's edge
const ABOVE_FOCUS = { x: 0, z: -0.3 }, ABOVE_ZOOM = 1;

// The director (battle scenes) asks this before it plays one. Easy views skip every scene: the capture just happens.
let current = null;
export function viewsAllowBattle() { return !(current && current.isEasy()); }

export function createViews({ controls, stage, game, board, device }) {
  const listeners = [];
  const phonePortrait = () => !!device.phone && !!device.portrait;
  const available = (v) => !v.when || (v.when === 'phone-portrait' && phonePortrait());
  // On a phone in portrait the cycle starts with the easy views: Play, Tokens, Symbols, From above, Easy 3D, then the presets
  const EASY_FIRST = ['play', 'tokens', 'symbols', 'above', 'easy-3d'];
  const list = () => {
    const l = VIEWS.filter(available);
    if (!phonePortrait()) return l;
    const rank = (v) => { const i = EASY_FIRST.indexOf(v.id); return i < 0 ? EASY_FIRST.length : i; };
    return l.map((v, i) => [v, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
  };
  const fallback = () => (phonePortrait() ? 'play' : 'white');
  let id = fallback();
  try {
    const s = MIGRATE[localStorage.getItem(STORE)] || localStorage.getItem(STORE);
    if (s && BY_ID[s] && available(BY_ID[s])) id = s;
  } catch (e) { /* storage blocked */ }
  let applied = null;
  let scaled = false;
  let focused = false;

  // Style B: the 3D pieces about 1.15x around their base. Scaled on their inner nodes (the game owns the group scale).
  const piecesRoot = () => game.root || stage.scene.getObjectByName('pieces');
  function scalePieces(k) {
    const root = piecesRoot();
    if (!root) return;
    for (const g of root.children) for (const c of g.children) if (!c.userData?.hit && c.name !== 'symbol' && Math.abs(c.scale.x - k) > 1e-4) c.scale.setScalar(k);
  }

  function enter(v, { instant = false } = {}) {
    const dur = instant ? 0 : undefined;
    controls.hooks.preset = (name) => { const k = BY_LABEL[name]; if (k) set(k); };
    controls.setOrbitLock(!!v.lock);
    controls.setEdgeToEdge(v.kind === 'easy');
    if (v.id === 'above') controls.setFocus(ABOVE_FOCUS, { dur: 0, zoom: ABOVE_ZOOM });
    else if (focused) controls.setFocus(null, { dur: 0 });
    focused = v.id === 'above';
    if (v.persp) {
      controls.setProjection('perspective', { pitch: v.pitch, yaw: 0, dist: 19, dur });
    } else if (v.kind === 'easy') {
      controls.setProjection('ortho', { pitch: v.pitch, yaw: 0, dist: 19, dur });
    } else if (v.kind === 'play') {
      controls.setProjection('perspective', { pitch: (v.pitch ?? 46) * DEG, dist: v.dist, dur });
    } else {
      controls.setProjection('perspective');
      controls.setPreset(v.label);
    }
    if (instant) for (let i = 0; i < 120; i++) controls.update(0.02);
    scaled = v.style === 'B';
    scalePieces(scaled ? PIECE_SCALE_B : 1);
  }

  function set(next, opts = {}) {
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
  // Called every frame: keeps the Style B scale on pieces created later (promotion) and re-checks the device when it turns.
  function update() {
    if (applied && !available(BY_ID[applied])) set(fallback());
    if (scaled) scalePieces(PIECE_SCALE_B);
  }

  const api = {
    list, current: () => id, set, next, update,
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
