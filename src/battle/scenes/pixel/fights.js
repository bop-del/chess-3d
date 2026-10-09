// Pixelwelt capture fights (CHE-371, the owner's pick 2026-10-09: all of them): the scene module the director loads for every
// Pixelwelt capture. Two or three fights per attacker type, taken in turn, so a capture by the same piece type never plays the
// same fight twice in a row.
//   (no flag)            the fights of the attacker type in turn (the capture count and the square pick the first)
//   ?pixfight=old        the earlier pixel gore scene (pixel-gore.js), for this load
//   ?pixfight=<id>       always this fight when its attacker type captures (for example knight-b), else the rotation
// The pick is a pure function of the captures so far in this load and the square, so ?manual=1 runs repeat exactly.
// A fight module (pawn.js, knight.js, ...) exports a list of { id, attacker, de, still, cam?, noTurn?, cleanup?, run(ctx, kit) }.
import classic from '../pixel-gore.js';
import { pixKit } from './kit.js';
import pawn from './pawn.js';
import knight from './knight.js';
import bishop from './bishop.js';
import rook from './rook.js';
import queen from './queen.js';
import king from './king.js';

export const VARIANTS = [...pawn, ...knight, ...bishop, ...rook, ...queen, ...king];
const CLASSIC = { id: 'classic', attacker: '*', de: 'Der frühere Pixel Kampf', run: (ctx) => classic.run(ctx) };
let count = 0;
if (typeof window !== 'undefined') window.__pixfightVariants = VARIANTS.map(({ id, attacker, de, still }) => ({ id, attacker, de, still }));   // test and clip hook

export const flag = () => { try { return new URLSearchParams(location.search).get('pixfight') || ''; } catch (e) { return ''; } };
const hash = (str) => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

/** The fight for one capture. mode is the flag value; n the capture count; square the victim square (a number or name). */
export function pick(type, { mode = flag(), n = 0, square = '' } = {}) {
  if (mode === 'old') return CLASSIC;
  const own = VARIANTS.filter((x) => x.attacker === type);
  const forced = own.find((x) => x.id === mode);
  if (forced) return forced;
  if (!own.length) return CLASSIC;
  return own[(hash(square) + n) % own.length];
}

let current = null;
export default {
  attacker: '*',
  cam: { pitch: 13 },
  // the director asks for the camera first (with the capture info), then runs: both see the same pick
  camFor(type, info) { current = pick(type, { n: count, square: info?.square ?? '' }); return current.cam || classic.camFor?.(type); },
  async run(ctx) {
    const chosen = current?.attacker === ctx.attacker || current === CLASSIC ? current : pick(ctx.attacker, { n: count, square: ctx.square });
    count++; current = null;
    if (typeof window !== 'undefined') window.__pixfight = { id: chosen.id, attacker: ctx.attacker, n: count };   // test hook: the last pick
    if (chosen === CLASSIC) return chosen.run(ctx);
    const g = ctx.attackerObj.group, clear = () => { delete g.userData.noTurn; };
    if (chosen.noTurn) { g.userData.noTurn = true; ctx.signal.addEventListener('abort', clear, { once: true }); }
    try { return await chosen.run(ctx, pixKit(ctx, { seed: hash(chosen.id) % 9973 })); } finally { clear(); chosen.cleanup?.(ctx); }
  },
};
