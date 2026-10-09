// Pixelwelt team sunknights (CHE-372): the White side of ?pixteam=dragons, a radiant order of sun knights of our own design.
// Polished white and pale silver armour, warm gold, sunny orange and sky turquoise accents, pixel sun emblems and glowing sun gems.
// The cast: a squire with a round sun shield and an open face helmet (pawn), a sturdy bulwark knight behind a battlemented tower
// shield taller than himself (rook), a paladin on a white sun griffin with raised wings (knight), a sun priest with a tall sun
// disc headdress and a sunburst staff (bishop), the dawn queen in a wide gold and white gown with a radiant halo (queen), the sun
// king with a big sunburst crown, an orange cape and a sun sceptre (king).
// Boxes in the Vox format (front +z, y 0 the board, sizes in voxels); heroes.js scales every figure to the height ladder of set a.
import { Vox } from '../blocks/vox.js';
import { PAL } from './palette.js';
import { legs, arms, paint, facePal, holdSpear, sideTag } from './seta.js';

const WHITE = 0xf8f9fc, PEARL = 0xe8ecf3, SILVER = 0xd2d9e4, SILVERD = 0xa9b3c3;
const GOLD = 0xf6c838, GOLDD = 0xd29f26, ORANGE = 0xff9a2e, ORANGED = 0xe9761c, SUN = 0xffe066, SUNL = 0xfff4b0;
const BEAK = 0x9a5a1e, BEAKD = 0x6a3a14, TURQ = 0x37d3cc, TURQL = 0xb4f7f1, TAN = 0xb88a58, CREAM = 0xf3e8cf, CREAMD = 0xdccfae;

// faces, 8 x 8, row 0 on top (letters as in seta.js, c a turquoise pixel, o an orange pixel)
const FACES = {
  squire: ['........', '........', '.bb..bb.', '.we..ew.', '.we..ew.', '........', '..m..m..', '...mm...'],
  bulwark: ['........', '........', 'bbb..bbb', '.we..ew.', '.we..ew.', '...nn...', '.oooooo.', '..m..m..'],
  priest: ['........', '........', '.bb..bb.', '.ce..ec.', '........', '........', '..m..m..', '...mm...'],
  paladin: ['........', '........', 'bb....bb', '.we..ew.', '.we..ew.', '........', '..mmmm..', '........'],
  lady: ['........', '........', '.kk..kk.', '.we..ew.', '.we..ew.', '.o....o.', '...mm...', '........'],
  king: ['........', 'bb....bb', '.bb..bb.', '.we..ew.', '.we..ew.', '........', '........', '........'],
};

/** A flat round plate facing +z: rows of boxes, centre x, yc, plane z, radius r, depth d. */
function disc(b, x, yc, z, r, c, d = 0.6) {
  for (let y = -r; y < r - 0.01; y += 1) {
    const m = y + 0.5, w = Math.round(2 * Math.sqrt(Math.max(0, r * r - m * m)) * 2) / 2;
    if (w >= 1) b.add(x, yc + y, z, w, 1, d, c);
  }
}
/** A pixel sun on a front face (facing +z): an orange core, gold rays on the four sides and four corners. y is the centre. */
function sunFront(b, x, y, z, s = 1, core = ORANGE, ray = GOLD) {
  b.add(x, y - 1.5 * s, z, 3 * s, 3 * s, 0.3, core);
  b.add(x, y - 0.5 * s, z, 0.01 + 5 * s, s, 0.25, ray); b.add(x, y - 2.5 * s, z, s, 5 * s, 0.25, ray);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(x + dx * 2 * s, y + dy * 2 * s - 0.5 * s, z, s, s, 0.3, ray);
}
/** The same sun on a side face (facing +x or -x). */
function sunSide(b, x, y, z, s = 1, core = ORANGE, ray = GOLD) {
  b.add(x, y - 1.5 * s, z, 0.3, 3 * s, 3 * s, core);
  b.add(x, y - 0.5 * s, z, 0.25, s, 0.01 + 5 * s, ray); b.add(x, y - 2.5 * s, z, 0.25, 5 * s, s, ray);
  for (const [dz, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(x, y + dy * 2 * s - 0.5 * s, z + dz * 2 * s, 0.3, s, s, ray);
}
/** A sunburst: a gold disc, an orange heart, a glowing turquoise gem and eight rays round it, standing in the xy plane. */
function sunburst(b, x, yc, z, r, o = {}) {
  const { d = 0.8, ray = 1.6, rim = GOLD, heart = ORANGE, gem = TURQ, rayC = SUN } = o;
  disc(b, x, yc, z, r, rim, d);
  disc(b, x, yc, z + d / 2 + 0.15, Math.max(1, r - 1.2), heart, 0.3);
  b.add(x, yc - 0.7, z + d / 2 + 0.45, 1.4, 1.4, 0.3, gem);
  const t = 1;
  b.add(x, yc + r - 0.2, z, t, ray, d * 0.8, rayC); b.add(x, yc - r - ray + 0.2, z, t, ray, d * 0.8, rayC);
  b.add(x - r - ray / 2 + 0.2, yc - t / 2, z, ray, t, d * 0.8, rayC); b.add(x + r + ray / 2 - 0.2, yc - t / 2, z, ray, t, d * 0.8, rayC);
  const k = r * 0.72 + ray * 0.35;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(x + sx * k, yc + sy * k - t / 2, z, t, t, d * 0.8, rayC);
}

// ------------------------------------------------------------------ pawn: the squire
function squire(C) {
  const b = new Vox();
  legs(b, C, { color: SILVER, boot: TAN, bootH: 2.4 });
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, SILVER);                                                                   // mail shirt
  b.add(0, 9, 0, 7, 13.4, 4.6, WHITE); b.add(0, 9, 0, 7.2, 0.8, 4.8, GOLD);                           // a short white tabard with a gold hem
  b.add(0, 14, 0, 8.4, 1.2, 5, GOLDD); b.add(0, 14, 2.55, 1.6, 1.2, 0.3, TURQ);                        // a belt with a glowing buckle
  sunFront(b, 0, 19, 2.45, 0.8);
  b.add(0, 22.8, 0, 8.8, 1.2, 4.8, GOLD);                                                              // the collar
  b.g = 'poseRest';                                                                                    // rest: the left arm holds the round sun shield, the right hangs
  b.add(-6, 13, 0, 4, 11, 4, SILVER); b.add(-6, 13, 0, 4.2, 2, 4.2, C.skin); b.add(-6, 21, 0, 4.6, 3.2, 4.6, GOLD);
  b.add(6, 12, 0, 4, 12, 4, SILVER); b.add(6, 12, 0, 4.2, 2, 4.2, C.skin); b.add(6, 21, 0, 4.6, 3.2, 4.6, GOLD);
  disc(b, -5, 16, 2.9, 4.2, GOLD, 1); disc(b, -5, 16, 3.55, 3.2, WHITE, 0.3);
  sunFront(b, -5, 16.6, 3.85, 0.7);
  holdSpear(b, C, SILVER);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.squire, facePal(C, { b: C.hair }));
  b.add(0, 25, -4.1, 8.2, 5, 0.4, C.hair);                                                             // hair at the back, under the helmet
  b.add(0, 30, 0, 8.8, 2.4, 8.8, SILVER); b.add(0, 32.4, 0, 7.2, 1.2, 7.2, SILVER);                    // an open face helmet
  b.add(0, 30, 0, 9, 0.8, 9, GOLD);
  for (const s of [-1, 1]) b.add(s * 4.3, 26, 0.6, 0.6, 4, 5.4, SILVER);                              // cheek guards
  b.add(0, 26, -4.3, 8.8, 4, 0.6, SILVER);                                                             // neck guard
  b.add(0, 32.4, 0, 1.4, 2.4, 8, GOLD); b.add(0, 30.8, 4.6, 1.4, 1.4, 0.3, TURQ);                      // a gold crest and a sun gem
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ rook: the bulwark knight with the tower shield
function bulwark(C) {
  const b = new Vox();
  legs(b, C, { h: 9, w: 5, d: 5, x: 3, color: SILVER, boot: GOLDD, bootH: 2 });
  b.g = 'body';
  b.add(0, 9, 0, 12, 13, 7, SILVER);                                                                   // a broad armoured chest
  b.add(0, 9, 0, 12.4, 2, 7.4, GOLDD);
  b.add(2, 11, 3.6, 6, 10, 0.4, WHITE); sunFront(b, 2, 16.6, 3.95, 0.9);                               // the tabard, half behind the shield
  b.add(0, 21, 0, 10, 1.4, 7.4, GOLD);                                                                 // a gorget
  for (const s of [-1, 1]) { b.add(s * 7.8, 18.2, 0, 6.4, 3.8, 8, GOLD); b.add(s * 7.8, 18.2, 0, 6.6, 0.8, 8.2, GOLDD); b.add(s * 7.4, 22, 0, 4.4, 1, 6.4, GOLDD); }   // big pauldrons, broad shoulders
  const ST = 0xeceef2, STD = 0xc9ced8;                                                                 // a crenellated tower pack on the back
  b.add(0, 7, -5.6, 10, 14, 4, ST); b.add(0, 16.4, -5.6, 10.4, 1.2, 4.4, GOLD);
  for (const [x, y, w] of [[-2.5, 10, 4], [2.5, 13, 4]]) b.add(x, y, -7.65, w, 0.4, 0.3, STD);        // mortar lines
  b.add(0, 9.5, -7.65, 1.6, 2.6, 0.3, TURQ);                                                           // a glowing arrow slit
  for (const x of [-4, 0, 4]) b.add(x, 21, -6, 2, 2, 2, ST);
  b.g = 'armN';
  b.add(-8.2, 8, 0, 4.4, 11, 5, SILVER); b.add(-8.2, 8, 0, 4.8, 2.6, 5.4, GOLD);
  b.g = 'armP';
  b.add(8.2, 8, 0, 4.4, 11, 5, SILVER); b.add(8.2, 8, 0, 4.8, 2.6, 5.4, GOLD);
  b.add(8.2, 6, 3.2, 1, 13, 1, TAN); b.add(8.2, 19, 3.2, 2.4, 2.4, 2.4, GOLD);                         // a sun mace
  b.add(8.2, 19.7, 3.2, 4.2, 1, 1, ORANGE); b.add(8.2, 18.2, 3.2, 1, 4, 1, ORANGE); b.add(8.2, 19.7, 3.2, 1, 1, 4.2, ORANGE);
  b.g = 'body';                                                                                        // the tower shield, taller than the knight, with battlements
  const sx = -7.4, sz = 5.2;
  b.add(sx, 1, sz, 9.6, 31, 1.4, GOLD); b.add(sx, 2, sz + 0.5, 7.8, 29, 0.8, WHITE);
  for (const x of [-3.6, 0, 3.6]) b.add(sx + x, 32, sz, 2.4, 2.6, 1.4, GOLD);
  b.add(sx, 2, sz + 1.05, 1.4, 29, 0.3, SUNL);
  b.add(sx, 1.4, sz - 0.9, 9.4, 30.2, 0.4, SILVER); b.add(sx, 3, sz - 1.2, 6.8, 26.6, 0.2, SILVERD);       // the back of the shield: a silver frame
  for (const y of [12.5, 24.5]) b.add(sx + 0.6, y, sz - 1.45, 6.4, 1.4, 0.3, TAN);                     // and two straps
  sunburst(b, sx, 17.6, sz + 1.2, 3.4, { d: 0.6, ray: 1.4 });
  b.add(sx, 6, sz + 1.05, 4.4, 1.2, 0.3, ORANGE); b.add(sx, 26, sz + 1.05, 4.4, 1.2, 0.3, ORANGE);
  b.g = 'head';
  b.add(0, 22, 0, 8, 8, 8, C.skin);
  paint(b, 22, FACES.bulwark, facePal(C, { b: C.hair, o: C.hair }));
  b.add(0, 23, -4.2, 8.2, 6, 0.4, C.hair);
  b.add(0, 29.4, 0, 11.6, 0.8, 11.6, SILVER); b.add(0, 29.4, 0, 11.8, 0.4, 11.8, GOLD);               // a helmet with a wide brim
  b.add(0, 30.2, 0, 10, 2, 10, SILVER); b.add(0, 30.2, 0, 10.2, 0.6, 10.2, GOLD);                     // and a battlement crown on it
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(x * 4, 32.2, z * 4, 2, 2, 2, SILVER);
  b.add(0, 31, 5.15, 1.8, 1.2, 0.3, TURQ);
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ knight: the paladin on the sun griffin
function griffinRider(C) {
  const b = new Vox();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {                                                 // eagle legs in front, lion legs behind
    b.g = 'lg' + (sx < 0 ? 'N' : 'P') + (sz > 0 ? 'F' : 'B');
    if (sz > 0) { b.add(sx * 2.4, 4, 5.4, 3, 6, 3, WHITE); b.add(sx * 2.4, 1.4, 5.4, 2.4, 3.2, 2.4, GOLD); b.add(sx * 2.4, 0, 5.8, 3, 1.4, 3.6, ORANGE); }
    else { b.add(sx * 2.4, 2, -5.4, 3, 8, 3, CREAM); b.add(sx * 2.4, 0, -5.2, 3.4, 2, 3.6, CREAMD); }
  }
  b.g = 'body';
  b.add(0, 9, 0, 7, 7, 15, WHITE); b.add(0, 9, -3, 7.2, 2, 9, CREAM);                                 // the body, white feathers in front, lion behind
  b.add(0, 15.4, -0.5, 7.6, 1, 9, GOLD); b.add(0, 11, -0.5, 7.4, 4.4, 9, GOLD);                       // a golden barding
  b.add(0, 11, -0.5, 7.6, 0.8, 9.2, TURQ);
  for (const s of [-1, 1]) sunSide(b, s * 3.95, 13.6, -0.5, 0.7);
  for (const s of [-1, 1]) {                                                                           // raised wings behind the rider: layered feathers, gold edges (thin plates)
    b.add(s * 3.9, 13.6, -7, 1, 6.4, 5.4, WHITE); b.add(s * 4.3, 19, -8.8, 1, 6.4, 5, GOLD); b.add(s * 4.7, 24.4, -10.6, 1, 5.4, 4.2, GOLD);   // white at the root, gold outer half
    b.add(s * 4.3, 18.9, -8.8, 1.2, 1.1, 5.2, GOLDD); b.add(s * 4.7, 24.3, -10.6, 1.2, 1.1, 4.4, GOLDD);   // darker gold feather steps
    b.add(s * 5, 28.8, -12, 1, 3, 3, ORANGE); b.add(s * 5.1, 31, -13.2, 0.8, 1.6, 1.6, SUN);
    b.add(s * 4.1, 13.6, -4.6, 0.8, 11, 1, PEARL); b.add(s * 4.6, 24.4, -8.8, 0.8, 7, 1, ORANGE);              // the leading edge
    for (const [y, z] of [[14.6, -10.2], [19.6, -11.8], [24.6, -13.2]]) { b.add(s * 4.4, y, z, 0.6, 3.4, 1.4, ORANGE); b.add(s * 4.4, y - 1.6, z + 0.4, 0.6, 1.6, 1, ORANGED); }   // sunny feather tips
  }
  b.g = 'head';
  b.add(0, 12.4, 6.2, 4.8, 5, 4.6, WHITE);                                                             // a short feathered neck
  b.add(0, 16.4, 10, 6, 6, 6, WHITE);                                                                  // the big eagle head
  b.add(0, 18, 14, 2, 2, 2, BEAK); b.add(0, 17, 14.5, 2, 1, 1, BEAKD);                                 // an amber beak with a hook at the tip
  b.add(0, 15.6, 6.6, 5.8, 1.6, 5.6, GOLD);                                                           // a gold feather ruff at the neck base
  for (const s of [-1, 1]) {
    b.add(s * 3.05, 19.4, 11.6, 0.3, 1.6, 1.6, 0x2a2018); b.add(s * 3.1, 20, 11.9, 0.3, 0.6, 0.6, WHITE);   // eyes
    b.add(s * 3.05, 21.2, 11.4, 0.5, 0.8, 2.6, GOLD);                                                  // a gold brow over each eye
  }
  b.add(0, 22.4, 9.6, 1.4, 1.2, 3, GOLD); b.add(0, 23.4, 7.8, 1.2, 1.2, 3.2, ORANGE); b.add(0, 24.4, 6, 1, 1, 3, GOLD);   // a crest of feathers swept back
  b.g = 'tail';                                                                                        // a lion tail with a sunny tuft
  b.add(0, 11, -8.2, 1.2, 1.2, 2.4, CREAM); b.add(0, 7, -9, 1.2, 5, 1.2, CREAM); b.add(0, 4.4, -9.2, 2, 2.8, 2, ORANGE);
  b.g = 'rider';
  for (const s of [-1, 1]) { b.add(s * 4.2, 10, -1.2, 2.4, 7, 2.8, SILVER); b.add(s * 4.2, 10, -0.6, 2.6, 2, 3.4, GOLDD); }
  b.add(0, 17, -1.2, 6, 9, 3.4, SILVER); b.add(0, 17.6, 1, 4, 7.4, 1.2, TURQ);                         // armour and a turquoise tabard, proud of the chest
  sunFront(b, 0, 21.6, 1.75, 0.6);
  b.add(0, 17, -1.2, 6.3, 1, 3.7, GOLDD); b.add(0, 25, -1.2, 7.6, 1.4, 4, GOLD);                      // belt and gold shoulders
  b.add(0, 15, -3.3, 6.4, 10, 0.8, ORANGE);                                                            // a short orange cape
  b.add(-4.2, 18, -0.2, 2.4, 7, 2.6, SILVER); b.add(-4.2, 18, 1.6, 2.2, 2, 1.6, C.skin);               // left arm with the sun shield
  b.add(-5.8, 17, 0.2, 0.8, 6, 5, GOLD); b.add(-6.3, 18, 0.2, 0.3, 4, 3.4, WHITE); b.add(-6.5, 19.4, 0.2, 0.3, 1.4, 1.4, ORANGE);
  b.add(4.2, 21, 0.4, 2.4, 5, 2.6, SILVER); b.add(5, 19.6, 1.4, 2.6, 2.4, 2.4, C.skin);                // right arm with a sun lance held outside
  b.add(6.2, 12, 1.4, 0.9, 23, 0.9, PEARL); b.add(6.2, 35, 1.4, 1.2, 1, 1.2, GOLD); b.add(6.2, 36, 1.4, 0.7, 2.4, 0.7, GOLD);
  b.add(6.2, 31, 3, 0.3, 3, 2.4, ORANGE); b.add(6.2, 31.6, 4.6, 0.3, 1.8, 1, ORANGE);                   // its pennant
  b.add(0, 26, -1.2, 6.4, 6.4, 6.4, C.skin);
  const P = { add: (x, y, z, w, h, d, c) => b.add(x * 0.8, y * 0.8, z * 0.8 - 1.2, w * 0.8, h * 0.8, d * 0.8, c) };
  paint(P, 26 / 0.8, FACES.paladin, facePal(C, { b: C.hair }), 8);
  b.add(0, 31.2, -1.2, 7, 1.4, 7, SILVER); b.add(0, 32.6, -1.2, 5.4, 1, 5.4, SILVER);                  // an open helmet
  b.add(0, 27, -4.5, 7, 4.2, 0.6, SILVER); for (const s of [-1, 1]) b.add(s * 3.45, 27.6, -1.6, 0.5, 3.6, 4.4, SILVER);
  b.add(0, 33.6, -1.6, 1.2, 2.4, 4.4, ORANGE); b.add(0, 34.6, -4, 1.2, 1.6, 1.6, ORANGE);              // a sun plume
  b.add(0, 31.5, 2.15, 1.2, 1, 0.3, TURQ);
  return b;
}

// ------------------------------------------------------------------ bishop: the sun priest
function sunPriest(C) {
  const b = new Vox();
  b.add(0, 0, 0, 10.4, 12, 6.4, WHITE); b.add(0, 0, 0, 10.6, 1.4, 6.6, GOLD);                        // a long robe over the feet
  b.add(0, 1.4, 3.25, 2.6, 10.6, 0.3, ORANGE); b.add(0, 6.4, 3.45, 1.2, 1.2, 0.3, SUN);
  b.add(0, 12, 0, 8, 12, 4, WHITE); b.add(0, 12, 2.15, 2.6, 9.4, 0.3, ORANGE);                         // the robe with an orange stole
  b.add(0, 13, 0, 8.4, 1.2, 4.4, GOLDD); sunFront(b, 0, 17.2, 2.45, 0.8, GOLD, SUN);                  // a gold sun on the chest
  b.add(0, 20.4, 0, 10, 3, 5.6, GOLD); b.add(0, 20.4, 2.85, 2, 2, 0.3, TURQ);                          // a gold mantle with a sun gem
  arms(b, C, { color: WHITE, w: 4, h: 10, hand: C.skin });
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 6, 14.4, 0, 4.6, 1.4, 4.6, GOLD); }
  b.g = 'body';                                                                                        // the sunburst staff in the left hand
  b.add(-6, 0, 2.9, 1.1, 34, 1.1, PEARL); b.add(-6, 33.4, 2.9, 2.2, 1, 1.2, GOLD);
  sunburst(b, -6, 37, 2.9, 2.2, { d: 0.8, ray: 1.2 });
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.priest, facePal(C, { b: C.hair, c: TURQ }));
  b.add(0, 24, -4.35, 8.6, 8, 0.7, PEARL); for (const s of [-1, 1]) b.add(s * 4.35, 24, -0.6, 0.7, 8, 6.6, PEARL);   // a white hood
  b.add(0, 31.4, 0, 8.8, 1.2, 8.8, PEARL); b.add(0, 31.4, 4.15, 8.8, 1.2, 0.5, GOLD);
  b.add(0, 32.6, 0, 6, 1.4, 6, GOLD); b.add(0, 34, 0, 2.4, 1.4, 1.4, GOLDD);                          // the stand of the sun disc
  sunburst(b, 0, 39.6, 0, 4.6, { d: 1.2, ray: 1.8 });                                                  // the tall sun disc headdress
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ queen: the dawn queen
function dawnQueen(C) {
  const b = new Vox(), PEACH = 0xffd2a0;
  b.add(0, 0, 0, 15, 4, 11, WHITE); b.add(0, 0, 0, 15.2, 1, 11.2, GOLD);                              // a wide gown in tiers
  b.add(0, 4, 0, 13.4, 1, 9.8, ORANGE); b.add(0, 5, 0, 12.6, 3.4, 9, PEACH);
  b.add(0, 8.4, 0, 11.4, 1, 7.8, GOLD); b.add(0, 9.4, 0, 10.4, 2.6, 6.4, WHITE);
  sunFront(b, -4.4, 2.2, 5.65, 0.6); sunFront(b, 4.4, 2.2, 5.65, 0.6); sunFront(b, 0, 6.8, 4.65, 0.6);
  sunSide(b, -7.65, 2.2, 0, 0.6); sunSide(b, 7.65, 2.2, 0, 0.6);
  b.add(0, 12, 0, 8, 12, 4, GOLD); b.add(0, 12, 2.15, 3.6, 9.6, 0.3, WHITE);                           // the bodice
  b.add(0, 18.6, 2.45, 1.6, 1.6, 0.3, TURQ);
  b.add(0, 22.8, 0, 9.4, 1.2, 4.8, WHITE);
  arms(b, C, { color: WHITE, y: 23, h: 10, hand: C.skin, w: 4 });
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 6, 19.4, 0, 4.8, 3.6, 4.8, PEACH); b.add(s * 6, 15, 0, 4.6, 1.2, 4.6, GOLD); }   // puffed sleeves
  b.g = 'body';                                                                                        // a slim sceptre with a dawn orb
  b.add(6, 0, 2.9, 1, 30, 1, GOLD); b.add(6, 30, 2.9, 2.4, 2.4, 2.4, TURQ); b.add(6, 31, 3.6, 0.8, 0.8, 1.4, TURQL);
  b.add(6, 32.4, 2.9, 1, 1.4, 1, SUN);
  b.g = 'head';
  const hair = C.hairQ;
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.lady, facePal(C, { b: hair, k: 0x5a3a20, m: 0xe0707a, o: 0xf6a8a0 }));
  b.add(0, 30.6, 0, 8.6, 1.8, 8.6, hair); b.add(0, 20, -4.6, 9.6, 11, 1.8, hair);                    // fringe and long golden hair in two steps
  b.add(0, 13, -4.4, 7.6, 7, 1.4, C.hairQD); b.add(0, 11.4, -4.3, 4, 1.6, 1.2, hair);
  for (const s of [-1, 1]) b.add(s * 4.4, 20, 0, 1, 10, 6, hair);
  b.add(0, 32.4, 0, 8.8, 1.2, 8.8, GOLD);                                                              // the diadem with rays
  for (const x of [-3.4, -1.7, 1.7, 3.4]) b.add(x, 33.6, 3.9, 0.9, Math.abs(x) > 2 ? 1.6 : 2.4, 0.9, GOLD);
  b.add(0, 33.6, 3.9, 1.3, 3.6, 0.9, GOLD); b.add(0, 34.4, 4.5, 1.2, 1.4, 0.3, TURQ);
  const n = 22;                                                                                        // the radiant halo behind the head: one closed arc of 1.6 boxes
  for (let i = 0; i <= n; i++) {
    const a = -0.6 + (Math.PI + 1.2) * (i / n), r = 8.4;
    b.add(-Math.cos(a) * r, 31 + Math.sin(a) * r - 0.8, -4.9, 1.6, 1.6, 0.6, i % 2 ? SUN : GOLD);
  }
  b.add(0, 38.2, -4.9, 2.4, 2.4, 1.2, SUNL); for (const z of [-4.15, -5.65]) b.add(0, 38.8, z, 1.2, 1.2, 0.3, TURQ);   // a glowing sun gem on top of the halo
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ king: the sun king
function sunKing(C) {
  const b = new Vox();
  legs(b, C, { color: PEARL, boot: GOLDD, bootH: 2.4 });
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, GOLD);                                                                     // a gold breastplate
  b.add(0, 9, 0, 6, 12.4, 4.6, WHITE); b.add(0, 9, 0, 6.2, 0.8, 4.8, GOLD);                           // a white tabard with a big sun
  sunFront(b, 0, 16.8, 2.45, 0.9);
  b.add(0, 12.6, 0, 8.4, 1.4, 5, GOLDD); b.add(0, 12.6, 2.55, 1.6, 1.4, 0.3, TURQ);
  b.add(0, 2, -2.7, 9.6, 21, 1.2, ORANGE); b.add(0, 2, -2.75, 9.8, 1.2, 1.3, GOLD);                   // a long orange cape
  sunFront(b, 0, 14, -2.1, 1, SUN, GOLD);
  b.add(0, 22, -0.4, 10.4, 2.4, 6, WHITE);                                                             // a white collar
  for (const s of [-1, 1]) { b.add(s * 5.6, 21.4, 0, 5, 2.6, 5.2, GOLD); b.add(s * 5.6, 22.2, 2.65, 1.4, 1.4, 0.3, TURQ); }   // pauldrons with sun gems
  arms(b, C, { color: SILVER, hand: C.skin });
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 6, 14, 0, 4.6, 2, 4.6, GOLD); }
  b.g = 'armP';                                                                                        // the sun sceptre in the right hand
  b.add(6, 0, 2.9, 1.2, 34, 1.2, GOLD); b.add(6, 33.4, 2.9, 2.4, 1.2, 1.4, GOLDD);
  sunburst(b, 6, 37, 2.9, 2.4, { d: 0.9, ray: 1.4 });
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.king, facePal(C, { b: ORANGED }));
  b.add(0, 27, 4.6, 1.6, 1.6, 1, C.skinD);                                                             // a nose
  b.add(0, 26.2, 4.5, 6.4, 1, 1, CREAM);                                                                // moustache and a short cream beard
  b.add(0, 23.2, 4.5, 6.6, 3, 1.2, CREAM);
  b.add(0, 25, -4.3, 8.4, 6, 0.6, C.hairK); for (const s of [-1, 1]) b.add(s * 4.2, 25, -1.4, 0.6, 5, 5.4, C.hairK);
  b.add(0, 31.4, 0, 9.8, 2.4, 9.8, GOLD); b.add(0, 31.4, 0, 10, 1, 10, ORANGE);                        // the big sunburst crown, an orange line at its bottom
  b.add(0, 32, 4.95, 2.2, 1.6, 0.3, TURQ); for (const s of [-1, 1]) b.add(s * 3, 32.2, 4.95, 1.2, 1.2, 0.3, ORANGE);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [-1, 0], [1, 0]]) {
    const big = x === 0 || z === 0, h1 = big ? 3 : 2, h2 = big ? 3.4 : 2;
    b.add(x * 4.2, 33.8, z * 4.2, 1.6, h1, 1.6, big ? GOLD : ORANGE);
    b.add(x * 4.2, 33.8 + h1, z * 4.2, 0.9, h2, 0.9, big ? SUN : GOLD);
  }
  b.add(0, 33.8, 0, 6.6, 1.4, 6.6, ORANGE); b.add(0, 35.2, 0, 2, 2, 2, SUN);                         // a glowing sun at the heart of the crown
  b.g = 'body';
  return b;
}

export const SUNKNIGHTS = {
  id: 'sunknights', side: 'w',
  pal: { ...PAL.w, main: ORANGE, dark: ORANGED, light: SUNL, iron: SILVER, ironD: SILVERD, trim: GOLD, trimD: GOLDD, cloth: WHITE,
    skin: 0xf4c9a4, skinD: 0xdea883, hair: 0xd08a3a, hairQ: 0xf6d36a, hairQD: 0xe8be4e, hairK: 0xf2c460, boots: TAN, glow: TURQ },
  build: { p: squire, n: griffinRider, b: sunPriest, r: bulwark, q: dawnQueen, k: sunKing },
};
