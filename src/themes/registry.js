// Themes: one bundle of board, frame, inlay, pieces and lighting. A theme module (src/themes/<id>.js, loaded on first use)
// exports { board(ctx), pieces(ctx), light(ctx) }:
//   board(ctx)  -> { squaresLight, squaresDark, frame, inlay, gold, plinth, labels, tray } property specs (themes/apply.js)
//   pieces(ctx) -> { white: { body, accent }, black: { body, accent }, dark } property specs, or null for the classic pieces
//   light(ctx)  -> { preset, key, fill, rim, exposure, env, floor, bg, post } (see stage.setThemeLight), or null
// ctx = { THREE, quality, base, track(texture) }. Every texture a theme builds goes through track(): it is disposed when the theme
// is left, so ten switches leave no textures behind. Classic is today's look: no module, nothing built.
import * as THREE from 'three';
import { addDE } from '../i18n.js';
import { createSkin } from './apply.js';

export const THEMES = [
  { id: 'classic', label: { en: 'Classic', de: 'Klassisch' }, swatch: ['#ece2cc', '#0d0f15'] },
  { id: 'tournament', label: { en: 'Tournament', de: 'Turnier' }, swatch: ['#f0eed6', '#58863b'] },
  { id: 'wood', label: { en: 'Wood', de: 'Holz' }, swatch: ['#efc687', '#6a2b1c'] },
  { id: 'metal', label: { en: 'Metal', de: 'Metall' }, swatch: ['#d9a640', '#9aa1ac'] },
  { id: 'glass', label: { en: 'Glass', de: 'Glas' }, swatch: ['#9fd0ff', '#3a4250'] },
];
const LOADERS = {
  tournament: () => import('./tournament.js'),
  wood: () => import('./wood.js'),
  metal: () => import('./metal.js'),
  glass: () => import('./glass.js'),
};
const STORE = 'chess3d.theme';

addDE({ 'theme.label': 'Thema', 'theme.group': 'Thema wählen' });
for (const th of THEMES) addDE({ [`theme.${th.id}`]: th.label.de });

export const isTheme = (id) => THEMES.some((th) => th.id === id);
export function storedTheme() {
  try { const id = localStorage.getItem(STORE); return isTheme(id) ? id : 'classic'; } catch (e) { return 'classic'; }
}

// game may be null at first (the start sequence turns the theme on before the game exists): attachGame(game) follows.
export function createThemes({ stage, board, pieceSet, materials, game = null }) {
  const pieceSkin = materials;   // materials.apply(spec | null), see materials.js
  let trayMats = null;
  let trayRoot = null;
  let traySpec = null;
  const trayMaterial = () => {
    if (!game) return null;
    if (!trayMats) {
      let slab = null;
      game.root.traverse((o) => { if (!slab && o.name === 'tray-slab') slab = o.material; });
      trayMats = { tray: slab };
      trayRoot = createSkin(trayMats);
    }
    return trayRoot;
  };

  let current = 'classic';
  let tracked = [];
  let want = 'classic';
  let chain = Promise.resolve();
  const listeners = [];

  async function build(id) {
    const mod = LOADERS[id] ? await LOADERS[id]() : null;
    const fresh = [];
    const ctx = { THREE, quality: stage.quality, base: board.base, track: (tex) => { fresh.push(tex); return tex; } };
    const b = mod?.board?.(ctx) || null;
    return { fresh, board: b, pieces: mod?.pieces?.(ctx) || null, light: mod?.light?.(ctx) || null };
  }

  function show(id, built) {
    const old = tracked;
    tracked = built.fresh;
    board.applyTheme(built.board);
    pieceSkin.apply(built.pieces);
    traySpec = built.board?.tray ? { tray: built.board.tray } : null;
    trayMaterial()?.apply(traySpec);
    stage.setThemeLight(built.light);
    for (const tex of old) tex.dispose();
    current = id;
    listeners.forEach((fn) => fn(id));
  }

  async function run(id, persist) {
    if (id === current || want !== id) return;
    const built = await build(id);
    if (want !== id) { for (const tex of built.fresh) tex.dispose(); return; }   // a later pick overtook this one
    show(id, built);
    if (persist) try { localStorage.setItem(STORE, id); } catch (e) { /* storage blocked */ }
  }

  // a quality change can change a theme (Glass uses real transmission on High only): build it again
  stage.onQuality?.(() => { if (current !== 'classic') { const id = current; current = ''; chain = chain.then(() => run(id, false)); } });

  return {
    list: () => THEMES,
    current: () => current,
    /** set(id, { persist = true }): resolves when the theme is on. persist false: this load only (the ?theme= flag). */
    set(id, { persist = true } = {}) {
      if (!isTheme(id)) return Promise.resolve(false);
      if (persist && id === current) { try { localStorage.setItem(STORE, id); } catch (e) { /* storage blocked */ } }
      want = id;
      chain = chain.then(() => run(id, persist)).then(() => true);
      return chain;
    },
    on(fn) { listeners.push(fn); },
    /** the game was created after the theme was turned on: give its trays the theme too */
    attachGame(g) { game = g; if (traySpec) trayMaterial()?.apply(traySpec); },
    get textureCount() { return tracked.length; },
  };
}
