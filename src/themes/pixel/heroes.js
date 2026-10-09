// Pixelwelt teams (CHE-372): the player picks who plays. Knights against monsters (today's figures: figures.js keeps set a with the
// team figures of teams.js) is the default; the other pairs are sun knights against a dragon brood, wizards against goblins and
// pirates against ghost pirates (hero side White, monster side Black). The Team row in
// Options (team-setting.js) stores the pick per browser (chess3d.pixteam); ?pixteam= beats it for that visit. A team module has six
// builders (p, n, b, r, q, k) that return a Vox box list in the blocky humanoid scheme of set a (head 8 x 8 x 8 with a painted face,
// body 8 x 12 x 4, limbs 4 x 12 x 4, front +z, rig tags as in seta.js). teamVox() scales each figure to the height of the set a figure
// of its type and keeps it inside its square, so the height ladder stays the same.
import { buildSetA } from './seta.js';
import { PAL } from './palette.js';
import { SUNKNIGHTS } from './team-sunknights.js';
import { DRAGONS } from './team-dragons.js';
import { WIZARDS } from './team-wizards.js';
import { GOBLINS } from './team-goblins.js';
import { PIRATES } from './team-pirates.js';
import { SKELCREW } from './team-skelcrew.js';

/** The pairs besides the default: White team against Black team. */
export const TEAM_PAIRS = {
  dragons: { w: SUNKNIGHTS, b: DRAGONS },
  wizards: { w: WIZARDS, b: GOBLINS },
  pirates: { w: PIRATES, b: SKELCREW },
};
export const DEFAULT_TEAM = 'knights';
/** Every choice of the Team row, the default first; swatch: White side, Black side. */
export const TEAM_IDS = [DEFAULT_TEAM, ...Object.keys(TEAM_PAIRS)];
export const TEAM_NAMES = {   // short tile labels: knights against monsters, sun knights against dragons, wizards against goblins, pirates against ghost pirates
  knights: { en: 'Knights', de: 'Ritter', swatch: ['#2f67c8', '#6f3fc0'] },
  dragons: { en: 'Dragons', de: 'Drachen', swatch: ['#f6c838', '#86202c'] },
  wizards: { en: 'Wizards', de: 'Zauberer', swatch: ['#7cc0f2', '#52702a'] },
  pirates: { en: 'Pirates', de: 'Piraten', swatch: ['#e8473c', '#2e5aa8'] },
};

const KEY = 'chess3d.pixteam';
const readStored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
let picked = null;   // what the player clicked on this page
const listeners = [];

/** The pair the URL names (?pixteam=dragons, ?pixteam=knights, ...), or null. */
export function teamFlag(search = typeof location !== 'undefined' ? location.search : '') {
  const v = new URLSearchParams(search).get('pixteam');
  return TEAM_IDS.includes(v) ? v : null;
}

/** The pair in use: a click on this page > ?pixteam= (this visit only) > stored > knights. */
export function teamChoice() { return [picked, teamFlag(), readStored()].find((v) => TEAM_IDS.includes(v)) || DEFAULT_TEAM; }

/** A click in Options: remembered per browser, the listeners (the theme rebuild) hear it. */
export function setTeam(id) {
  if (!TEAM_IDS.includes(id) || id === teamChoice()) return;
  picked = id;
  try { localStorage.setItem(KEY, id); } catch (e) { /* storage blocked */ }
  listeners.forEach((fn) => fn(id));
}
export function onTeam(fn) { listeners.push(fn); }
export function resetTeam() { picked = null; listeners.length = 0; }

const WIDTH = { p: [0.86, 0.86], r: [0.95, 0.95], n: [0.599, 1.25], b: [0.95, 0.95], q: [0.95, 0.95], k: [0.95, 0.95] };   // x and z in board units
const heightCache = {};
/** The height of the set a figure of this type, in board units (the ladder every team keeps). */
function setAHeight(color, type) {
  const key = color + type;
  if (heightCache[key] === undefined) {
    const v = buildSetA(color, type, PAL[color]);
    heightCache[key] = v.parts.reduce((m, p) => Math.max(m, p.y + p.h), 0) * v.unit;
  }
  return heightCache[key];
}

/** Sets the unit of a team figure: as tall as set a of its type, never wider than its square (thin parts do not count). */
export function fitToSquare(vox, color, type) {
  let top = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of vox.parts) {
    top = Math.max(top, p.y + p.h);
    if (Math.min(p.w, p.d) <= 1.3) continue;
    x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2);
    z0 = Math.min(z0, p.z - p.d / 2); z1 = Math.max(z1, p.z + p.d / 2);
  }
  const [wx, wz] = WIDTH[type];
  vox.unit = Math.min(setAHeight(color, type) / top, wx / (x1 - x0), wz / (z1 - z0));
  return vox;
}

/** The box list of one figure of the chosen pair, or null for the default (today's figures). */
export function teamVox(color, type, id = teamChoice()) {
  const team = id && TEAM_PAIRS[id]?.[color];
  if (!team) return null;
  return fitToSquare(team.build[type](team.pal), color, type);
}
