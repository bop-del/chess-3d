// Views: the named camera setups the player chooses from (Views button, preset buttons, keys 1 to 5, ?view=). One list is the
// single source. A view has a kind: 'preset' (a perspective camera preset), 'easy' (orthographic, style A flat with symbols or
// style B steep 3D) or 'play' (the phone portrait play view: perspective, close, with the follow camera of src/views/play.js).
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
  { id: 'easy-flat', label: 'Easy flat', kind: 'easy', style: 'A', pitch: 89.6 * DEG },
  { id: 'easy-3d', label: 'Easy 3D', kind: 'easy', style: 'B', pitch: 62 * DEG },
  { id: 'play', label: 'Play', kind: 'play', when: 'phone-portrait', dist: 10.3, pitch: 40 },
];
const BY_ID = Object.fromEntries(VIEWS.map((v) => [v.id, v]));
const BY_LABEL = Object.fromEntries(VIEWS.map((v) => [v.label, v.id]));
export const PIECE_SCALE_B = 1.15;

Object.assign(DE, {
  'preset.Easy flat': 'Einfach flach', 'preset.Easy 3D': 'Einfach 3D', 'preset.Play': 'Spielansicht',
});

// The director (battle scenes) asks this before it plays one. Easy views skip every scene: the capture just happens.
let current = null;
export function viewsAllowBattle() { return !(current && current.isEasy()); }

export function createViews({ controls, stage, game, board, device }) {
  const listeners = [];
  const phonePortrait = () => !!device.phone && !!device.portrait;
  const available = (v) => !v.when || (v.when === 'phone-portrait' && phonePortrait());
  const list = () => VIEWS.filter(available);
  const fallback = () => (phonePortrait() ? 'play' : 'white');
  let id = fallback();
  try {
    const s = localStorage.getItem(STORE);
    if (s && BY_ID[s] && available(BY_ID[s])) id = s;
  } catch (e) { /* storage blocked */ }
  let applied = null;
  let scaled = false;

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
    controls.setOrbitLock(v.style === 'A');
    if (v.kind === 'easy') {
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
