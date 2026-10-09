// The backdrop world choice (CHE-370): None (today's look) or Torch hall, Space, Zen garden, Lava, picked in the Options row Welt
// (stored in chess3d.world, default none) or by the URL flag ?world=hall|space|zen|lava|none (this visit only, beats the stored pick).
// Small and eager on purpose: the world code itself (index.js and the world modules) loads only once a world is wanted.
export const WORLD_IDS = ['none', 'hall', 'space', 'zen', 'lava'];
export const DEFAULT_WORLD = 'none';
export const WORLD_NAMES = {
  none: { en: 'None', de: 'Keine', swatch: ['#5a5a62', '#8a8a92'] },
  hall: { en: 'Torch hall', de: 'Fackelhalle', swatch: ['#3a2a22', '#ff9a3c'] },
  space: { en: 'Space', de: 'Weltraum', swatch: ['#0c1030', '#7a8cff'] },
  zen: { en: 'Zen garden', de: 'Zen-Garten', swatch: ['#9bc7a0', '#f0a8c0'] },
  lava: { en: 'Lava', de: 'Lava', swatch: ['#2a1a18', '#ff5a1f'] },
};
const KEY = 'chess3d.world';
const readStored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
let picked = null;   // what the player clicked on this page
const listeners = [];

/** The world the URL names (?world=space), or null. */
export function worldFlag() {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('world');
  return WORLD_IDS.includes(v) ? v : null;
}

/** The world in use: a click on this page > ?world= (this visit only) > stored > none. */
export function worldChoice() { return [picked, worldFlag(), readStored()].find((v) => WORLD_IDS.includes(v)) || DEFAULT_WORLD; }

/** A click in Options: remembered per browser, the listeners (the world manager) hear it. */
export function setWorld(id) {
  if (!WORLD_IDS.includes(id) || id === worldChoice()) return;
  picked = id;
  try { localStorage.setItem(KEY, id); } catch (e) { /* storage blocked */ }
  listeners.forEach((fn) => fn(id));
}
export function onWorld(fn) { listeners.push(fn); }
export function resetWorld() { picked = null; listeners.length = 0; }
