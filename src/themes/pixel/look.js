// Pixelwelt look (CHE-239): the Sky (mood of the heaven: evening, night, sunrise, storm, snow), the Backdrop (what stands far below the
// island: none, floating islands, castle and village) and the Sets (named pairs of both). The default for a new player is the set
// Inselmorgen (sunrise and islands).
// Pure data and choice logic, no three.js: the sky layer (sky.js) and the Options rows (look-setting.js) read it.
// Precedence per axis: a click in Options (this page) > ?sky= / ?backdrop= > ?set= > stored > default.
import { SETS } from './sets.js';

export const SKY_IDS = ['evening', 'night', 'sunrise', 'storm', 'snow'];
export const BACKDROP_IDS = ['islands', 'castle'];
export const DEFAULT_SET = 'inselmorgen';
export const DEFAULT_SKY = 'sunrise';
export const DEFAULT_BACKDROP = 'islands';
export const WARM = { world: 0xffe9d2, figure: 0xfff1e2 };   // multiplier colours of the evening (texture pixels and the baked face shading stay)
const KEY_SKY = 'chess3d.pixsky', KEY_BACKDROP = 'chess3d.pixbackdrop';

// One entry per sky. bg/post/exposure go to stage.setThemeLight, mul is the multiplier colour of the unlit world materials and fig of the
// figures, cloud the colour of the clouds, hz the horizon colour the backdrops fade into, dim how dark the backdrops stand (1 when absent). sun: null (hidden) or the sun's { y, color };
// moon, stars (count), weather ('rain' | 'snow'), flash (the storm's lightning).
export const SKIES = {
  evening: {
    en: 'Evening', de: 'Abend', swatch: ['#5b86d6', '#ffd6a8'],
    light: { key: ['#ffc78a', 2.4], fill: ['#cfe0ff', 0.8], rim: ['#ffd9b0', 0.3], exposure: 0.88, floor: '#5b86d6',
      bg: { top: '#5b86d6', bottom: '#ffd6a8', glow: '#ffe2bd', glowAmount: 0.25 }, post: { bloom: 0.05, vignette: 0.2, tint: '#fff0e0' } },
    mul: WARM.world, fig: WARM.figure, cloud: WARM.world, hz: 0xffd6a8, sun: { y: 17, color: 0xffffff },
  },
  night: {
    en: 'Night', de: 'Nacht', swatch: ['#070b22', '#2a3a7a'],
    light: { key: ['#9fb4ff', 1.6], fill: ['#7f93d8', 0.7], rim: ['#bcd0ff', 0.3], exposure: 1.0, floor: '#1a2552',
      bg: { top: '#050820', bottom: '#2a3a7a', glow: '#3d4f9a', glowAmount: 0.2 }, post: { bloom: 0.06, vignette: 0.24, tint: '#e4e9ff' } },
    mul: 0xa8b6ee, fig: 0xe2e8ff, cloud: 0x6b78b0, hz: 0x2a3a7a, dim: 0.5, sun: null, moon: true, stars: 140,
  },
  sunrise: {
    en: 'Sunrise', de: 'Sonnenaufgang', swatch: ['#4a5a9e', '#ff9a68'],
    light: { key: ['#ffb27a', 2.4], fill: ['#d6c8ff', 0.7], rim: ['#ffc9a0', 0.3], exposure: 0.92, floor: '#4a5a9e',
      bg: { top: '#4a5a9e', bottom: '#ff9a68', glow: '#ffd29c', glowAmount: 0.45 }, post: { bloom: 0.06, vignette: 0.18, tint: '#fff0e4' } },
    mul: 0xffe0cc, fig: 0xffeadb, cloud: 0xffc7ae, hz: 0xff9a68, sun: { y: 2.6, color: 0xffb070 },
  },
  storm: {
    en: 'Storm', de: 'Gewitter', swatch: ['#2a303f', '#7c8696'],
    light: { key: ['#c7d3e6', 1.8], fill: ['#9fb0c8', 0.7], rim: ['#dfe8f5', 0.3], exposure: 0.95, floor: '#4a5566',
      bg: { top: '#262c3a', bottom: '#7c8696', glow: '#98a2b2', glowAmount: 0.1 }, post: { bloom: 0, vignette: 0.28, tint: '#eef3fa' } },
    mul: 0xbcc4d2, fig: 0xe8ecf2, cloud: 0x687080, hz: 0x7c8696, dim: 0.85, sun: null, weather: 'rain', flash: true,
  },
  snow: {
    en: 'Snow', de: 'Schnee', swatch: ['#9fb0c8', '#eaf0f8'],
    light: { key: ['#ffffff', 2.0], fill: ['#dbe6ff', 0.9], rim: ['#ffffff', 0.3], exposure: 0.98, floor: '#b8c6dc',
      bg: { top: '#9aabc4', bottom: '#e8eff7', glow: '#ffffff', glowAmount: 0.25 }, post: { bloom: 0.03, vignette: 0.14, tint: '#f2f6ff' } },
    mul: 0xeaf0fb, fig: 0xf4f7ff, cloud: 0xdde4ee, hz: 0xe8eff7, sun: null, weather: 'snow',
  },
};

for (const [id, v] of Object.entries(SKIES)) v.id = id;

// the backdrops: a name, two swatch colours (sky of the tile) and the one line German text for the review clips
export const BACKDROPS = {
  none: { en: 'None', de: 'Keine', swatch: ['#8a93a3', '#c9d0dc'] },
  islands: { en: 'Islands', de: 'Inseln', swatch: ['#62a83c', '#a9c8f0'] },
  castle: { en: 'Castle', de: 'Burg', swatch: ['#808285', '#d9a05b'] },
};

export { SETS };

const hasWindow = () => typeof location !== 'undefined';
const params = () => (hasWindow() ? new URLSearchParams(location.search) : new URLSearchParams(''));
const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };

let pick = {};   // what the player clicked on this page: { sky, backdrop }
const listeners = [];
const okSky = (v) => SKY_IDS.includes(v);
const okBackdrop = (v) => v === 'none' || BACKDROP_IDS.includes(v);

/** The set the URL names (?set=sturmburg), or null. */
export function flagSet() { const s = SETS.find((x) => x.id === params().get('set')); return s || null; }

/** The choice: { sky, backdrop } after the precedence in the header. */
export function choice() {
  const q = params(), set = flagSet();
  const sky = [pick.sky, q.get('sky'), set?.sky, read(KEY_SKY)].find((v) => v && okSky(v)) || DEFAULT_SKY;
  const backdrop = [pick.backdrop, q.get('backdrop'), set?.backdrop, read(KEY_BACKDROP)].find((v) => v && okBackdrop(v)) || DEFAULT_BACKDROP;
  return { sky, backdrop };
}
export function look() { return choice(); }
/** The id of the set the current look is, or null (a free combination). */
export function currentSetId(l = look()) { return SETS.find((x) => x.sky === l.sky && x.backdrop === l.backdrop)?.id || null; }

/** A click in Options: remembered per browser, wins over the flags on this page. { set } picks both axes of a set. */
export function setChoice(part) {
  const set = part.set && SETS.find((x) => x.id === part.set);
  if (set) part = { sky: set.sky, backdrop: set.backdrop };
  if (part.sky && okSky(part.sky)) { pick.sky = part.sky; write(KEY_SKY, part.sky); }
  if (part.backdrop && okBackdrop(part.backdrop)) { pick.backdrop = part.backdrop; write(KEY_BACKDROP, part.backdrop); }
  emit();
}
export function onLook(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
export function emit() { for (const fn of listeners) fn(look()); }
/** For the tests: forget the click on this page. */
export function resetLook() { pick = {}; listeners.length = 0; }

/** The theme light spec (stage.setThemeLight) of a sky. */
export function skyLight(id) {
  const s = SKIES[id] || SKIES[DEFAULT_SKY], L = s.light;
  const l = (k) => ({ color: L[k][0], intensity: L[k][1] });
  return {
    preset: 'Gallery',
    key: { ...l('key'), dir: [-10, 16, -8] }, fill: { ...l('fill'), dir: [10, 8, 9] }, rim: { ...l('rim'), dir: [8, 5, -12] },
    exposure: L.exposure, env: 0.5, floor: L.floor, bg: { ...L.bg }, post: { ...L.post }, noFloor: true,
  };
}
