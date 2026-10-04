// The team figures of Pixelwelt (owner decision, review round 20): heroes get a knight with a great helm and a kite shield and a king
// with a tall crown and a great sword, monsters a spider queen and a skeleton king with a crown of flames. Every other piece is set a
// (seta.js). One voxel is a pixel of the figure; the figure is scaled to the height ladder of set a by normalise().
import { Vox } from '../blocks/vox.js';
import { shade } from './shade.js';
import { legs, arms, paint, facePal, horse, ribcage, FACE } from './seta.js';

const FACES = {
  calm: FACE.calm, stern: FACE.stern, skull: FACE.skull,
  slit: ['........', '........', 'kkkkkkkk', 'kr....rk', '........', '...kk...', '........', '........'],
};

function shield(b, x, y, z, w, h, main, trim, d = 1.4) {
  b.add(x, y, z, w, h, d, trim); b.add(x, y + 0.7, z + 0.2, w - 1.4, h - 1.4, d, main);
  b.add(x, y + h / 2 - 0.5, z + d / 2 + 0.2, 1.6, 1.6, 0.3, trim);
}
/** A thin circlet with a front jewel and small points: the diadem of every queen. */
function diadem(b, y, color, jewel, o = {}) {
  const { w = 8.6, d = 8.6, pts = 5, tall = 1.8 } = o;
  b.add(0, y, 0, w, 1.2, d, color);
  for (let i = 0; i < pts; i++) { const x = (i / (pts - 1) - 0.5) * (w - 1.2); b.add(x, y + 1.2, d / 2 - 0.5, 0.9, i === (pts - 1) / 2 ? tall + 1.2 : tall, 0.9, color); }
  b.add(0, y + 0.1, d / 2 + 0.1, 1.6, 1.4, 0.35, jewel);
}
/** A full crown: band and points all around, a front gem. */
function kingCrown(b, y, color, gemC, o = {}) {
  const { w = 9.4, d = 9.4, tall = 3.4 } = o;
  b.add(0, y, 0, w, 2, d, color);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [-1, 0], [1, 0]]) b.add(x * (w / 2 - 0.6), y + 2, z * (d / 2 - 0.6), 1.2, x === 0 || z === 0 ? tall * 0.6 : tall, 1.2, color);
  b.add(0, y + 0.4, d / 2 + 0.15, 1.8, 1.2, 0.3, gemC);
  return y + 2 + tall;
}

// ------------------------------------------------------------------ heroes
function rider(b, C, o = {}) {
  const { helm = C.iron, plume, visor = true, cloth = C.main, shieldOn = false, open = false } = o;
  b.g = 'rider';
  for (const s of [-1, 1]) b.add(s * 4.2, 10, -1.2, 2.4, 7, 2.8, C.iron);
  b.add(0, 17, -1.2, 6, 9, 3.4, C.iron); b.add(0, 19, 0.6, 4, 5, 0.3, cloth); b.add(0, 17, -1.2, 6.3, 1.2, 3.7, C.ironD);
  for (const s of [-1, 1]) { b.add(s * 4.2, 18, -0.2, 2.4, 7, 2.6, C.iron); b.add(s * 4.2, 18, 1.6, 2.2, 2, 1.6, C.skin); }
  b.add(0, 26, -1.2, 6.4, 6.4, 6.4, helm);
  const P = { add: (x, y, z, w, h, d, c) => b.add(x * 0.8, y * 0.8, z * 0.8 - 1.2, w * 0.8, h * 0.8, d * 0.8, c) };
  if (open) paint(P, 26 / 0.8, FACES.calm, facePal(C, { b: C.hair }), 8); else paint(P, 26 / 0.8, FACES.slit, facePal(C, { r: C.glow }), 8);
  if (plume) plume(b);
  if (shieldOn) shield(b, -6.6, 16, 0.6, 5.4, 8, cloth, C.trim);
}
/** The hero knight: a rider in a great helm with a kite shield on a brown horse. */
export function heroKnight(C) {
  const b = new Vox();
  horse(b, { ...C, horse: 0x8a6240, horseD: 0x6a4a30, mane: 0x2a1c14 }, { cloth: C.main, trim: C.trim });
  rider(b, C, { helm: C.ironD, shieldOn: true, cloth: C.dark }); b.add(0, 32.4, -1.2, 6.8, 1, 6.8, C.main); b.add(0, 33.4, -1.2, 3, 1.6, 3, C.trim);
  b.add(0, 12.4, 0.5, 8.4, 3.4, 8.4, C.main); b.add(0, 17.2, 7.6, 5, 5, 4.8, C.ironD);
  return b;
}

function kingBase(b, C, o = {}) {
  const { gold = C.trim, goldD = C.trimD, legC = C.trimD, capeC = C.main, beard = false, face = 'stern' } = o;
  legs(b, C, { color: legC, boot: C.boots, bootH: 2 }); b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, gold); b.add(0, 12, 2.15, 4.6, 10, 0.3, C.main); b.add(0, 12.6, 2.2, 8.2, 1.4, 0.3, goldD); b.add(0, 18, 2.4, 1.8, 1.8, 0.3, C.glow);
  for (const s of [-1, 1]) b.add(s * 5.4, 22, 0, 5, 2, 5, goldD);
  arms(b, C, { color: gold, hand: C.skin });
  if (capeC) { b.add(0, 8, -2.6, 8.6, 15, 1.1, capeC); b.add(0, 22, -2.6, 9.6, 2, 1.6, C.cloth); }
  b.g = 'head'; b.add(0, 24, 0, 8, 8, 8, C.skin); paint(b, 24, FACES[face], facePal(C, { b: C.hair })); b.add(0, 31.2, 0, 8.4, 1, 8.4, C.hair);
  if (beard) b.add(0, 24, 4.4, 6, 2.6, 0.9, C.hair);
  b.g = 'body';
}
/** The hero king: a tall crown, a beard and a great sword planted in front. */
export function heroKing(C) {
  const b = new Vox();
  kingBase(b, C, { beard: true, capeC: C.dark, legC: C.iron }); kingCrown(b, 32, C.trim, C.glow, { tall: 4.4 }); b.add(0, 2, 7, 1.6, 2, 1, C.trimD);
  b.add(0, 0, 7, 1.4, 22, 0.8, C.iron); b.add(0, 22, 7, 7, 1.4, 1.6, C.trimD); b.add(0, 23.4, 7, 1.4, 4, 1.4, C.trimD); for (const s of [-1, 1]) b.add(s * 5.4, 11, 4, 1.6, 4, 1.6, C.skin);
  return b;
}

// ------------------------------------------------------------------ monsters
function sideLeg(b, C, s, z, k = 1.8) {                                                                       // a spider leg beside the gown: out, up to a knee, down to the floor
  const c = shade(C.spider, 1.32);
  b.add(s * 6.8, 4, z, 3, k, k, c); b.add(s * 7.9, 4, z, k + 0.4, 6, k, c); b.add(s * 8.8, 8.2, z, 2.4, k, k, c); b.add(s * 9.6, 0, z, k, 9.6, k, shade(C.spider, 1.14));
}
function torsoM(b, C, o = {}) {
  const { y = 12, cloth = C.robe, trim = C.main, skin = C.skin, hair = C.hair, face = 'calm', fp = {} } = o;
  b.add(0, y, 0, 8, 12, 4, cloth); b.add(0, y, 2.15, 4, 8, 0.3, trim); b.add(0, y + 10, 0, 9, 1.2, 4.6, C.dark);
  arms(b, C, { color: cloth, y: y + 11, h: 10, hand: skin, w: 4 });
  b.g = 'head'; b.add(0, y + 12, 0, 8, 8, 8, skin); paint(b, y + 12, FACES[face], facePal(C, { b: hair, r: C.glow, ...fp })); b.add(0, y + 18.6, 0, 8.6, 1.8, 8.6, hair); b.add(0, y, -4.6, 9.6, 19, 1.8, hair); b.g = 'body';
}
/** The monster queen: a spider queen, a dark abdomen as the gown, six legs beside it and a glowing diadem. */
export function monsterQueen(C) {
  const b = new Vox();
  b.add(0, 0, 0, 12, 5, 12, C.spider); b.add(0, 5, -1, 11, 4, 10.4, C.spiderD); b.add(0, 9, 0, 10, 3, 7, C.spider); b.add(0, 2, 6.15, 4, 5, 0.4, C.main);
  torsoM(b, C, { cloth: C.spider, trim: C.main }); diadem(b, 32, C.trim, C.glow); for (const s of [-1, 1]) for (const z of [3.4, 0, -3.4]) sideLeg(b, C, s, z);
  return b;
}

function kingM(b, C, o = {}) {
  const { capeC = C.main, armor = false, bw = 8 } = o;
  legs(b, C, { color: C.bone, boot: C.boneD, bootH: 1, w: 3, d: 3, x: 2 }); b.g = 'body';
  b.add(0, 12, 0, bw, 12, 4, armor ? C.iron : C.boneD); ribcage(b, 0, 13.4, 2.15, 6.4, 5); if (armor) { b.add(0, 12, 2.15, 6, 10, 0.4, C.ironD); b.add(0, 17, 2.4, 2, 2, 0.4, C.glow); }
  for (const s of [-1, 1]) b.add(s * (bw / 2 + 1.4), 22, 0, 5, 2, 5, armor ? C.ironD : C.dark);
  arms(b, C, { color: armor ? C.iron : C.bone, w: 3, x: bw / 2 + 1.5, hand: C.boneD });
  if (capeC) { b.add(0, 8, -2.6, bw + 0.6, 15, 1.1, capeC); b.add(0, 22, -2.6, bw + 1.6, 2, 1.6, C.dark); }
  b.g = 'head'; b.add(0, 24, 0, 8, 8, 8, C.bone); paint(b, 24, FACES.skull, facePal(C, { r: C.glow }), 8); b.g = 'body';
}
/** The monster king: a skeleton king with a crown of flames and a cape of rags. */
export function monsterKing(C) {
  const b = new Vox();
  kingM(b, C, { capeC: C.robe }); const top = kingCrown(b, 32, C.trim, C.glow, { tall: 3 });
  for (const [x, z, h] of [[0, 0, 7], [-2.6, 0, 5], [2.6, 0, 5], [0, 2.6, 4.4], [0, -2.6, 4.4]]) b.add(x, top, z, 1.8, h, 1.8, C.glow); b.add(0, top + 1, 0, 1, 4, 1, C.light);
  for (const x of [-3.6, 0, 3.6]) b.add(x, 3, -3.4, 2.2, 2 + Math.abs(x) * 0.6, 0.8, C.robe);
  return b;
}

// ------------------------------------------------------------------ scale to the height ladder of set a
const TARGET = { n: 1.55, q: 1.8, k: 2.15 };   // the heights of set a, in board units
const WIDTH = { n: [0.599, 1.25], q: [0.95, 0.95], k: [1.0, 1.0] };   // x and z, never wider than the square allows

/** Sets the unit of a figure so it is as tall as set a of its type and still fits its square. */
export function normalise(vox, type) {
  let top = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of vox.parts) {
    top = Math.max(top, p.y + p.h);
    if (Math.min(p.w, p.d) <= 1.3) continue;   // thin things (spears, staffs, banners) do not count for the footprint
    x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2);
    z0 = Math.min(z0, p.z - p.d / 2); z1 = Math.max(z1, p.z + p.d / 2);
  }
  vox.unit = Math.min(TARGET[type] / top, WIDTH[type][0] / (x1 - x0), WIDTH[type][1] / (z1 - z0));
  return vox;
}
