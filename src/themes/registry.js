// Themes: one bundle of board, frame, inlay, pieces and lighting. A theme module (src/themes/<id>.js, loaded on first use)
// exports { board(ctx), pieces(ctx), light(ctx) }:
//   board(ctx)  -> { squaresLight, squaresDark, frame, inlay, gold, plinth, labels, tray } property specs (themes/apply.js)
//   pieces(ctx) -> { white: { body, accent }, black: { body, accent }, dark } property specs, or null for the classic pieces
//   world(ctx)  -> { group, update(dt), dispose() } an optional scene of its own (the Blocks island), added to the gimbal
//   pieceStyle(ctx) -> a piece style for pieceSet.setStyle (block characters), or absent
//   light(ctx)  -> { preset, key, fill, rim, exposure, tone ('neutral', default ACES), env, floor, bg, post } (see stage.setThemeLight), or null
// ctx = { THREE, quality, base, track(texture) }. Every texture a theme builds goes through track(): it is disposed when the theme
// is left, so ten switches leave no textures behind. Classic is today's look: no module, nothing built.
import * as THREE from 'three';
import { addDE } from '../i18n.js';
import { createSkin } from './apply.js';
import { setHintStyle } from '../openings/arrow.js';

export const THEMES = [
  { id: 'classic', label: { en: 'Classic', de: 'Klassisch' }, swatch: ['#ece2cc', '#0d0f15'] },
  { id: 'tournament', label: { en: 'Tournament', de: 'Turnier' }, swatch: ['#f8e5a6', '#4a7c4f'] },
  { id: 'wood', label: { en: 'Wood', de: 'Holz' }, swatch: ['#efc687', '#6a2b1c'] },
  { id: 'metal', label: { en: 'Metal', de: 'Metall' }, swatch: ['#d9a640', '#9aa1ac'] },
  { id: 'glass', label: { en: 'Glass', de: 'Glas' }, swatch: ['#9fd0ff', '#3a4250'] },
  { id: 'blocks', label: { en: 'Blocks', de: 'Blöcke' }, swatch: ['#62b43a', '#4b515e'], hidden: true },
  { id: 'pixel', label: { en: 'Pixel world', de: 'Pixelwelt' }, swatch: ['#e3d49a', '#7a7a7a'] },
];
const LOADERS = {
  tournament: () => import('./tournament.js'),
  wood: () => import('./wood.js'),
  metal: () => import('./metal.js'),
  glass: () => import('./glass.js'),
  blocks: () => import('./blocks.js'),
  pixel: () => import('./pixel.js'),
};
const STORE = 'chess3d.theme';

addDE({ 'theme.label': 'Thema', 'theme.group': 'Thema wählen' });
for (const th of THEMES) addDE({ [`theme.${th.id}`]: th.label.de });

export const isTheme = (id) => THEMES.some((th) => th.id === id);
// Hidden themes (Blocks) stay in the game but no picker lists them: only their ?theme= link opens them, and that is never stored.
// A Blocks pick stored before it was hidden becomes Pixelwelt, and the store is rewritten.
export function storedTheme() {
  try {
    let id = localStorage.getItem(STORE);
    if (id === 'blocks') { id = 'pixel'; localStorage.setItem(STORE, id); }
    return isTheme(id) ? id : 'classic';
  } catch (e) { return 'classic'; }
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

  // what a theme's own scene needs to keep out of the way: the camera, the canvas size and the UI controls floating over it
  const OVER = '.pstatus, .pgood, .pbar, .viewbar';
  const screenView = () => ({ camera: stage.camera, w: innerWidth, h: innerHeight, rects: [...document.querySelectorAll(OVER)].filter((e) => e.offsetWidth).map((e) => e.getBoundingClientRect()) });

  let current = 'classic';
  let world = null;   // the theme's own scene (Blocks island), in the gimbal
  let tracked = [];
  let want = 'classic';
  let chain = Promise.resolve();
  const listeners = [];

  // a theme chunk can fail (stale deploy, flaky network) or stall. A browser remembers a failed import() of a URL for the page's life,
  // so the plain retry is the same rejection: the failure message names the chunk URL, and a fresh query string asks the network again.
  // The timeout keeps a stuck request from blocking later switches.
  const withTimeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('theme chunk timed out')), ms); p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); no(e); }); });
  const tries = {};
  async function load(id) {
    try { return await withTimeout(LOADERS[id](), 15000); } catch (e) {
      const url = /https?:\/\/[^\s'"]+?\.js/.exec(String(e?.message))?.[0];
      if (!url) throw e;
      await new Promise((r) => setTimeout(r, 400));
      tries[id] = (tries[id] || 0) + 1;
      return withTimeout(import(/* @vite-ignore */ `${url.split('?')[0]}?retry=${tries[id]}`), 15000);
    }
  }

  async function build(id) {
    const mod = LOADERS[id] ? await load(id) : null;
    const fresh = [];
    const ctx = { THREE, quality: stage.quality, base: board.base, view: screenView, track: (tex) => { fresh.push(tex); return tex; } };
    const b = mod?.board?.(ctx) || null;
    return { fresh, board: b, pieces: mod?.pieces?.(ctx) || null, pieceStyle: mod?.pieceStyle?.(ctx) || null, world: mod?.world?.(ctx) || null, light: mod?.light?.(ctx) || null };
  }

  function show(id, built) {
    const old = tracked;
    tracked = built.fresh;
    board.applyTheme(built.board);
    setHintStyle(built.board?.hint);
    pieceSet.setStyle?.(built.pieceStyle || null);
    pieceSkin.apply(built.pieces);
    game?.restyle?.();
    if (world) { world.group.parent?.remove(world.group); world.dispose(); }
    world = built.world;
    if (world) { board.group.parent?.add(world.group); world.settle?.(); }
    stage.setFloorHidden?.(!!built.light?.noFloor);
    traySpec = built.board?.tray ? { tray: built.board.tray } : null;
    trayMaterial()?.apply(traySpec);
    stage.setThemeLight(built.light);
    for (const tex of old) tex.dispose();
    current = id;
    listeners.forEach((fn) => fn(id));
  }

  async function run(id, persist) {
    if (id === current || want !== id) return;
    let built;
    try { built = await build(id); } catch (e) {
      // a chunk that failed to load (offline, stale deploy): keep the current theme, move the mark back and keep later switches working
      console.warn('theme failed to load, keeping', current, id, e);
      if (current === '') show('classic', { fresh: [], board: null, pieces: null, light: null });   // a rebuild after a quality change failed: Classic
      if (want === id) want = current;
      listeners.forEach((fn) => fn(current));
      return;
    }
    if (want !== id) { for (const tex of built.fresh) tex.dispose(); return; }   // a later pick overtook this one
    show(id, built);
    if (persist) try { localStorage.setItem(STORE, id); } catch (e) { /* storage blocked */ }
  }

  // a quality change can change a theme (Glass uses real transmission on High only): build it again
  stage.onQuality?.(() => { if (current !== 'classic') { const id = current; current = ''; chain = chain.then(() => run(id, false)).catch(() => {}); } });

  return {
    /** the themes the pickers offer: hidden themes (Blocks) are left out, set() still takes them */
    list: () => THEMES.filter((th) => !th.hidden),
    current: () => current,
    /** set(id, { persist = true }): resolves when the theme is on. persist false: this load only (the ?theme= flag). */
    set(id, { persist = true } = {}) {
      if (!isTheme(id)) return Promise.resolve(false);
      if (persist && id === current) { try { localStorage.setItem(STORE, id); } catch (e) { /* storage blocked */ } }
      want = id;
      chain = chain.then(() => run(id, persist)).catch(() => {}).then(() => true);
      return chain;
    },
    on(fn) { listeners.push(fn); },
    /** the game was created after the theme was turned on: give its trays the theme too */
    attachGame(g) { game = g; if (traySpec) trayMaterial()?.apply(traySpec); },
    /** per frame: the theme's own scene (water, clouds) */
    update(dt) { world?.update(dt); },
    /** the theme's own scene, for the tests */
    get world() { return world; },
    get textureCount() { return tracked.length; },
  };
}
