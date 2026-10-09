// Pixelwelt team pirates (CHE-372, ?pixteam=pirates): the White crew, a cheerful pirate band of our own design. Cream and white
// shirts with red stripes, red bandanas and sashes, tan leather, gold buttons and coins, sky blue coats for the officers.
// pawn: a barefoot deckhand in a striped shirt, hands on hips. rook: a broad bosun in a leather vest with an eye patch who carries a
// fat cask of gold coins on his shoulders.
// knight: a pirate with a raised cutlass on a sea horse with a fish tail and a little sail. bishop: the navigator in a long cream coat,
// a crosswise hat, gold spectacles, a brass spyglass and a compass. queen: the pirate queen in a wide coat skirt, a feathered hat
// over a small diadem, her cutlass up. king: the pirate king in a long blue coat, a huge tricorn with a gold crown, a big ginger beard
// and a parrot on his shoulder. Boxes in the blocky scheme of seta.js (head 8 x 8 x 8, front +z), heroes.js scales and fits them.
import { Vox } from '../blocks/vox.js';
import { PAL } from './palette.js';
import { legs, paint, facePal, horse, holdSpear, sideTag } from './seta.js';

const WHITE = 0xffffff, CREAM = 0xf6eedc, CREAM2 = 0xe6dcc4, RED = 0xe8473c, RED2 = 0xc4332c;
const GOLD = 0xf2c53a, GOLD2 = 0xd0a028, TAN = 0xcc9a62, TAN2 = 0xa8743e, SKY = 0x62b4ec, SKY2 = 0x3f8fd0;
const NAVY = 0x2e5aa8, NAVY2 = 0x24488a, GINGER = 0xd2743a, GINGER2 = 0xaa5626, WOOD = 0xc68c4e, WOOD2 = 0x9a6634;
const BOOT = 0x6a4a30, STEEL = 0xe4e8ee, INK = 0x2a2018;

// face maps (8 x 8, row 0 on top), letters as in seta.js plus g gold, h ginger, l lips
const FACES = {
  grin: ['........', '........', '.bb..bb.', '.we..ew.', '.we..ew.', '........', '.m....m.', '..mmmm..'],
  patch: ['........', 'kkkkkkkk', '.kk..bb.', '.kk..ew.', '.kk..ew.', '........', '.hhhhhh.', '..mmmm..'],
  specs: ['........', '........', '.gg..gg.', 'gweggewg', '.gg..gg.', '........', '..mmmm..', '........'],
  lady: ['........', '........', '.bb..bb.', '.we..ew.', '.we..ew.', '........', '..llll..', '........'],
  king: ['........', '........', '.bb..bb.', '.we..ew.', '.we..ew.', '...nn...', '........', '........'],
  rider: ['........', '.bb..bb.', '........', '.ew..we.', '.ee..ee.', '........', '.mmmmmm.', '..mttm..'],
};
const fp = (C, extra) => facePal(C, { g: GOLD, h: GINGER, l: RED2, ...extra });

/** A box with red stripes wrapped round it every `step` voxels from y0 + off. */
function striped(b, x, y, z, w, h, d, base, stripe, off = 1.6, step = 3, sh = 1.4) {
  b.add(x, y, z, w, h, d, base);
  for (let yy = y + off; yy + sh <= y + h + 0.01; yy += step) b.add(x, yy, z, w + 0.2, sh, d + 0.2, stripe);
}
/** A cutlass standing upright: grip and gold guard at y, a slightly curved steel blade above it, all thin. */
function cutlass(b, x, y, z, len = 11) {
  b.add(x, y - 2.4, z, 1, 2.6, 1, TAN2);
  b.add(x, y, z, 1.2, 0.8, 3, GOLD);
  b.add(x, y + 0.8, z + 0.2, 0.8, len * 0.6, 1.2, STEEL);
  b.add(x, y + 0.8 + len * 0.6, z + 0.6, 0.8, len * 0.4, 1.1, STEEL);
}

// ------------------------------------------------------------------ pawn: the deckhand
function pawn(C) {
  const b = new Vox();
  legs(b, C, { color: CREAM, boot: C.skin, bootH: 2 });
  for (const s of [-1, 1]) { b.g = sideTag('leg', s); b.add(s * 2, 3, 0, 4.4, 1.6, 4.4, CREAM2); }   // rolled up trousers, bare feet
  b.g = 'body';
  striped(b, 0, 12, 0, 8, 12, 4, WHITE, RED, 3, 3);
  b.add(0, 12, 0, 8.6, 1.8, 4.6, RED); b.add(3, 9.6, 2.4, 1.6, 3, 0.6, RED);                           // a red sash with a hanging end
  b.g = 'poseRest';                                                                                     // hands on hips, elbows out
  for (const s of [-1, 1]) {
    striped(b, s * 6, 18, 0, 4, 6, 4, WHITE, RED, 2.2, 3);
    b.add(s * 7.6, 14.6, 0, 3.4, 4.4, 3.4, WHITE); b.add(s * 7.6, 16, 0, 3.6, 1.2, 3.6, RED);
    b.add(s * 5.3, 13.4, 0.2, 2.6, 3.2, 3.2, C.skin);
  }
  holdSpear(b, C, WHITE);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.grin, fp(C, { b: 0x6a4527 }));
  b.add(0, 30.2, 0, 8.4, 2.2, 8.4, RED);                                                                // a red bandana with white dots
  for (const [x, y] of [[-2.4, 31], [0.6, 30.6], [2.8, 31.4]]) b.add(x, y, 4.3, 1, 0.8, 0.3, WHITE);
  b.add(0, 28.6, -4.6, 2.4, 2.4, 1, RED); b.add(-0.8, 25.6, -4.5, 1.2, 3, 0.6, RED); b.add(0.9, 26, -4.5, 1.2, 2.6, 0.6, RED);
  b.add(4.15, 25.4, 0.6, 0.6, 1.6, 1.2, GOLD);                                                          // a gold earring
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ rook: the bosun with the barrel
function rook(C) {
  const b = new Vox();
  legs(b, C, { h: 7, w: 5, d: 5, x: 2.9, color: CREAM, boot: BOOT, bootH: 2.4 });
  b.g = 'body';
  b.add(0, 7, 0, 11, 10, 7, NAVY);                                                                      // a navy shirt
  for (const s of [-1, 1]) b.add(s * 3.45, 7, 0, 4.3, 10, 7.4, TAN);                                    // a tan leather vest, open in front
  b.add(0, 7, -3.4, 11.4, 10, 0.8, TAN);
  for (const s of [-1, 1]) for (const y of [10, 13.4]) b.add(s * 1.4, y, 3.75, 0.9, 0.9, 0.3, GOLD);    // vest buttons
  b.add(0, 7, 0, 11.6, 1.8, 7.6, TAN2); b.add(0, 7, 3.9, 2.6, 1.8, 0.4, GOLD);                         // belt and buckle
  for (const s of [-1, 1]) {                                                                            // strong arms up to the cask ends
    b.add(s * 7.6, 10, -1.6, 4.2, 11, 4.6, C.skin);
    b.add(s * 7.6, 15.4, -1.6, 4.6, 3.4, 5, NAVY);
    b.add(s * 7.6, 20.6, -2.2, 3.4, 3.2, 3, C.skinD);                                                   // hands on the cask
  }
  b.g = 'head';                                                                                         // the head pokes out in front of the cask
  b.add(0, 17, 2.4, 8, 8, 8, C.skin);
  paint(b, 17, FACES.patch, fp(C, { b: GINGER2 }), 12.8);
  b.add(0, 20, 6.8, 2, 2.4, 1.4, C.skinD);                                                              // a big nose
  b.g = 'body';
  const z = -5.8;                                                                                       // a fat cask lying sideways on the shoulders
  b.add(0, 18.6, z, 19.4, 7.6, 7.4, WOOD);
  b.add(0, 18.2, z, 8, 8.4, 8.2, WOOD);
  for (const s of [-1, 1]) {
    b.add(s * 6.4, 18.3, z, 1.2, 8.2, 8, GOLD2);
    b.add(s * 9.8, 19, z, 0.4, 6.8, 6.6, WOOD2); b.add(s * 9.95, 21.2, z, 0.3, 2.4, 2.4, TAN2);      // the cask ends with a tap hole
  }
  for (const y of [20, 22.4, 24.8]) b.add(0, y, z + 4.15, 3, 0.5, 0.3, WOOD2);
  for (const y of [20.2, 24.2]) b.add(0, y, z - 3.85, 19.6, 1, 0.3, GOLD2);                              // hoop bands on the back
  for (const [x, dz] of [[-2.4, 0.6], [1.6, -1.4], [3.8, 1]]) b.add(x, 26.6, z + dz, 1.4, 1, 1.4, GOLD);   // gold coins on top
  return b;
}

// ------------------------------------------------------------------ knight: a pirate on a sea horse
function knight(C) {
  const b = new Vox();
  const SEA = 0xf2dfb4, FIN = 0x3fb6e0;
  horse(b, { ...C, horse: SEA, horseD: 0xdcc493, mane: FIN, hoof: TAN2 }, { cloth: RED, trim: WHITE });
  b.g = 'head';                                                                                         // a fin crest along the neck
  b.add(0, 17, 4.2, 0.8, 5.6, 2.2, FIN); b.add(0, 20.4, 6.6, 0.8, 3.4, 2.4, FIN); b.add(0, 22, 9, 0.8, 1.6, 2.6, FIN);
  for (const s of [-1, 1]) b.add(s * 2.45, 17.6, 9.6, 0.3, 2.2, 2.4, FIN);                              // little gill fins
  b.g = 'tail';                                                                                         // a fish tail fin
  b.add(0, 5, -9.6, 1.2, 3, 1, FIN); b.add(0, 3.4, -10.2, 6, 2, 0.8, FIN); b.add(0, 3.4, -10.2, 2, 2.4, 0.9, SEA);
  b.g = 'body';
  for (const z of [-3, 0, 3]) b.add(0, 16.2, z - 0.5, 7.9, 0.7, 1, WHITE);                              // stripes on the saddle cloth
  b.add(0, 16, -7.2, 0.8, 19, 0.8, WOOD2);                                                              // a little mast and sail
  b.add(0, 24, -7.6, 8.4, 8, 0.8, CREAM); for (const y of [25.6, 28.8]) b.add(0, y, -7.6, 8.6, 1.4, 0.9, RED);
  b.add(1.6, 33.4, -7.2, 3, 1.8, 0.4, RED);
  b.g = 'rider';
  for (const s of [-1, 1]) { b.add(s * 4.2, 10, -2.7, 2.4, 7, 2.8, CREAM); b.add(s * 4.2, 10, -2.3, 2.7, 2.4, 3.4, BOOT); }
  striped(b, 0, 17, -2.7, 6, 9, 3.4, WHITE, RED, 2.2, 2.6, 1.2);
  b.add(0, 17, -2.7, 6.4, 1.4, 3.8, TAN2);
  b.add(-4.2, 18, -1.7, 2.4, 7, 2.6, WHITE); b.add(-4.2, 18, 0.1, 2.2, 2, 1.6, C.skin);
  b.add(4.2, 22, -1.1, 2.4, 4, 2.6, WHITE); b.add(4.2, 21.4, 0.9, 2.4, 2.4, 3, WHITE); b.add(4.2, 21.4, 2.7, 2.2, 2.4, 1.6, C.skin);   // sword arm forward
  cutlass(b, 4.2, 23.8, 2.9, 10);
  b.add(0, 26, -2.7, 6.4, 6.4, 6.4, C.skin);
  paint({ add: (x, y, z, w, h, d, c) => b.add(x * 0.8, y * 0.8, z * 0.8 - 2.7, w * 0.8, h * 0.8, d * 0.8, c) }, 26 / 0.8, FACES.rider, fp(C, { b: 0x6a4527 }), 8);
  b.add(0, 30.8, -2.7, 6.8, 1.9, 6.8, RED); b.add(0, 29.4, -6.1, 2, 2, 1, RED);                         // bandana
  b.add(3.35, 27.4, -2.3, 0.5, 1.4, 1, GOLD);
  return b;
}

// ------------------------------------------------------------------ bishop: the navigator
function bishop(C) {
  const b = new Vox();
  b.add(0, 0, 0, 10.4, 12, 6.4, CREAM); b.add(0, 0, 0, 10.6, 1.4, 6.6, NAVY); b.add(0, 1.4, 0, 10.6, 0.6, 6.6, GOLD2);                           // a long coat to the floor
  b.add(0, 2, 3.25, 3, 10, 0.3, NAVY); b.add(-1.2, 0, 2.8, 1.8, 1.6, 2, BOOT); b.add(1.2, 0, 2.8, 1.8, 1.6, 2, BOOT);
  b.add(0, 12, 0, 8, 12, 4, CREAM); for (const s of [-1, 1]) b.add(s * 1.9, 12, 2.15, 0.8, 12, 0.3, NAVY);   // navy lapels
  b.add(0, 12, 2.15, 3, 10, 0.3, RED); b.add(0, 21, 2.2, 3.6, 2.6, 0.6, WHITE);                       // waistcoat and cravat
  for (const y of [13.5, 16, 18.5]) b.add(0, y, 2.4, 1, 1, 0.3, GOLD);
  b.add(0, 12.4, 0, 8.4, 1.6, 4.4, TAN2); b.add(0, 12.4, 2.3, 2, 1.6, 0.3, GOLD);
  b.add(0, 22.6, -0.4, 8.8, 1.4, 3.8, GOLD); b.add(0, 0, -3.25, 0.8, 12, 0.3, NAVY); b.add(0, 13.6, -2.15, 0.8, 9, 0.3, NAVY);   // collar and back seam
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 6, 14, 0, 4, 10, 4, CREAM); b.add(s * 6, 14, 0, 4.4, 1.6, 4.4, NAVY); b.add(s * 6, 12, 0, 3.4, 2, 3.4, C.skin);
  }
  b.g = 'armN';                                                                                         // a compass in the left hand
  b.add(-6, 12, 2.6, 3.2, 3.2, 0.8, GOLD); b.add(-6, 12.5, 3.05, 2.2, 2.2, 0.3, WHITE); b.add(-6, 13.1, 3.3, 0.4, 1.2, 0.3, RED);
  b.g = 'armP';                                                                                         // a brass spyglass, pulled out, held upright
  b.add(6.6, 6, 2.6, 1.3, 8, 1.3, TAN2); b.add(6.6, 14, 2.6, 1.1, 7, 1.1, GOLD); b.add(6.6, 21, 2.6, 0.9, 6, 0.9, GOLD2);
  for (const y of [6, 13.4, 20.6]) b.add(6.6, y, 2.6, 1.3, 0.8, 1.3, GOLD);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.specs, fp(C, { b: 0x6a4527 }));
  b.add(0, 27, -4.3, 8.4, 4.4, 0.8, 0x6a4527); for (const x of [-4.3, 4.3]) b.add(x, 28, -1.6, 0.8, 3.4, 4.6, 0x6a4527);   // hair, tied back
  b.add(0, 23.4, -4.9, 1.6, 4, 1, 0x6a4527); b.add(0, 26.6, -5, 2.2, 1, 1.2, RED);
  b.add(0, 31.4, 0, 8.6, 1, 8.6, NAVY2);                                                                // a tall hat worn crosswise
  b.add(0, 32, 0, 12, 2, 4.6, NAVY); b.add(0, 34, 0, 10, 2, 4.6, NAVY); b.add(0, 36, 0, 7.6, 2, 4.6, NAVY); b.add(0, 38, 0, 4.4, 1.6, 4.6, NAVY);
  b.add(0, 32, 0, 12.2, 0.8, 4.8, GOLD);
  b.add(0, 34.6, 2.4, 2.6, 2.6, 0.4, RED); b.add(0, 35.2, 2.65, 1.2, 1.2, 0.3, WHITE);                 // a cockade
  for (const y of [34, 36]) b.add(0, y, 0, y === 34 ? 10.2 : 7.8, 0.8, 4.8, GOLD);                         // gold bands
  b.add(0, 39.4, -0.4, 1.8, 4, 2, WHITE); b.add(0, 42.4, -1.6, 1.6, 1.6, 1.6, WHITE);                  // a white plume
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ queen: the pirate queen
function queen(C) {
  const b = new Vox();
  b.add(0, 0, 0, 14, 4, 10, RED); b.add(0, 4, 0, 12, 4, 8.4, RED); b.add(0, 8, 0, 10, 4, 6.4, RED);     // a wide coat skirt
  b.add(0, 0, 0, 14.2, 1, 10.2, GOLD);
  b.add(0, 1, 5.05, 4, 3, 0.3, CREAM); b.add(0, 4, 4.25, 3.4, 4, 0.3, CREAM); b.add(0, 8, 3.25, 2.8, 4, 0.3, CREAM);   // the white petticoat in front
  b.add(0, 12, 0, 8, 12, 4, WHITE);
  b.add(0, 12, 2.15, 5, 7, 0.3, RED); for (const y of [13.5, 15.5, 17.5]) b.add(0, y, 2.35, 1, 1, 0.3, GOLD);   // a red bodice
  b.add(0, 12, 0, 8.4, 1.4, 4.4, TAN2); b.add(0, 12, 2.3, 2, 1.4, 0.3, GOLD);
  b.add(0, 22, 0, 9, 1.2, 4.6, CREAM2);
  b.g = 'armN';
  b.add(-6, 13, 0, 4, 10, 4, RED); b.add(-6, 13, 0, 4.4, 1.6, 4.4, WHITE); b.add(-6, 11, 0, 3.4, 2, 3.4, C.skin);
  b.g = 'armP';                                                                                         // the sword arm, forearm forward, cutlass up
  b.add(6, 17, 0, 4, 6, 4, RED); b.add(6, 16.6, 2.6, 3.8, 3.4, 5, RED); b.add(6, 16.6, 4.9, 4, 3.4, 0.8, WHITE); b.add(6, 16.8, 6.4, 3, 3, 2.4, C.skin);
  cutlass(b, 6, 19.8, 6.4, 13);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.lady, fp(C, { b: GINGER2 }));
  b.add(0, 21, -4.6, 9.6, 10, 1.8, GINGER); b.add(0, 13, -4.5, 7, 8, 1.4, GINGER); b.add(0, 11.4, -4.4, 4, 1.6, 1.2, GINGER); for (const s of [-1, 1]) b.add(s * 4.4, 20, -0.6, 1, 10, 6.6, GINGER);   // long auburn hair
  b.add(0, 30.4, 0, 8.6, 1.8, 8.6, GINGER);
  b.add(0, 30.6, 4.2, 7, 1, 0.6, GOLD); for (const x of [-2.4, 0, 2.4]) b.add(x, 31.6, 4.2, 0.9, x ? 0.8 : 1.4, 0.6, GOLD);   // a small diadem
  b.add(0, 30.9, 4.55, 1.2, 1, 0.3, 0x4fc0ff);
  b.add(0, 32.4, 0, 13, 1.2, 12, RED2); b.add(0, 33.6, 0, 8.4, 3.4, 8.4, RED2); b.add(0, 33.6, 0, 8.6, 1, 8.6, GOLD);   // a wide feathered hat
  b.add(3.2, 34, -1, 2.2, 4, 2, WHITE); b.add(2.2, 37, -2.2, 2.2, 3, 2, WHITE); b.add(0.6, 39, -3.4, 2.4, 2, 2, WHITE); b.add(-1.2, 39.6, -4.8, 2, 1.4, 1.8, WHITE);
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ king: the pirate king
function king(C) {
  const b = new Vox();
  legs(b, C, { color: CREAM, boot: BOOT, bootH: 4 });
  for (const s of [-1, 1]) { b.g = sideTag('leg', s); b.add(s * 2, 3.4, 0.2, 4.6, 1.4, 4.8, TAN); }    // boot cuffs
  b.g = 'body';
  b.add(0, 12, 0, 9, 12, 5, SKY);                                                                       // the long blue coat
  b.add(0, 4, -2.4, 9.6, 8, 1.2, SKY); for (const s of [-1, 1]) b.add(s * 4.3, 4, 0, 1.4, 8, 5, SKY);
  for (const s of [-1, 1]) { b.add(s * 3.2, 4, 2.6, 2.8, 8, 0.6, SKY); b.add(s * 2.1, 4, 2.95, 0.6, 8, 0.3, GOLD); }   // coat tails in front
  b.add(0, 4, -2.4, 9.8, 1, 1.4, GOLD); for (const s of [-1, 1]) { b.add(s * 4.3, 4, 0, 1.6, 1, 5.2, GOLD); b.add(s * 3.2, 4, 2.65, 3, 1, 0.8, GOLD); }
  b.add(0, 12, 2.6, 3.2, 12, 0.3, CREAM);
  for (const s of [-1, 1]) for (const y of [14, 16.6, 19.2]) b.add(s * 2.6, y, 2.7, 1.2, 1.2, 0.4, GOLD);
  b.add(0, 12.6, 0, 9.4, 1.8, 5.4, RED); b.add(0, 12.4, 2.8, 2.6, 2.2, 0.4, GOLD);                    // a red sash with a buckle
  b.add(-4.9, 5, 1.6, 1, 8, 1.2, TAN2); b.add(-4.9, 13, 1.6, 1.4, 1, 2.6, GOLD); b.add(-4.9, 14, 1.6, 1, 2, 1, GOLD2);   // a cutlass in its scabbard
  for (const s of [-1, 1]) { b.add(s * 5.6, 22.4, 0, 4.4, 1.6, 5.4, GOLD); b.add(s * 7.4, 20.6, 0, 0.8, 1.8, 5, GOLD2); }   // epaulettes
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 6.5, 12, 0, 4, 10.4, 4, SKY); b.add(s * 6.5, 12.4, 0, 4.6, 2.2, 4.6, GOLD); b.add(s * 6.5, 10.2, 0, 3.4, 2.2, 3.4, C.skin);
  }
  b.g = 'body';                                                                                         // a parrot on the left shoulder
  const P = -6.4, PR = 0xe8382e;
  b.add(P, 24, 0.6, 3, 4.4, 3.2, PR); b.add(P - 1.6, 24.4, 0.4, 0.6, 3.4, 2.6, 0x3a9ae8); b.add(P + 1.6, 24.4, 0.4, 0.6, 3.4, 2.6, 0x3a9ae8);
  b.add(P, 20.6, -1.4, 1.6, 4.4, 0.8, 0x3a9ae8); b.add(P, 19.6, -1.6, 1.2, 1.4, 0.8, GOLD);
  b.add(P, 28.4, 0.8, 3, 3, 3, PR); b.add(P, 28.6, 2.6, 1.4, 1.6, 1.4, GOLD); b.add(P, 31.4, 0.4, 1, 1.4, 1.6, GOLD);
  b.add(P - 0.8, 29.8, 2.45, 0.8, 0.8, 0.3, WHITE); b.add(P + 0.8, 29.8, 2.45, 0.8, 0.8, 0.3, WHITE);
  b.add(P - 0.8, 29.8, 2.65, 0.4, 0.6, 0.3, INK); b.add(P + 0.8, 29.8, 2.65, 0.4, 0.6, 0.3, INK);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.king, fp(C, { b: GINGER2 }));
  b.add(0, 19.6, 4.5, 7.4, 6.4, 1.6, GINGER); b.add(0, 18, 4.4, 4.4, 2, 1.4, GINGER);                   // a big ginger beard
  for (const s of [-1, 1]) b.add(s * 3.7, 24, 2.4, 1, 4.6, 3.4, GINGER);
  b.add(0, 26.2, 5, 6.6, 1.2, 0.8, GINGER2);                                                            // moustache
  b.add(0, 24.4, -4.35, 8.4, 6.8, 0.7, GINGER);                                                         // hair at the back
  b.add(0, 31, 0, 8.6, 1.4, 8.6, NAVY2);                                                                 // a huge tricorn
  b.add(0, 32, -3.6, 13.6, 3.6, 2, NAVY);
  for (const [x, z, w, d] of [[5.6, -1.4, 2.4, 3], [4.2, 1.2, 2.6, 2.6], [2.6, 3.4, 2.6, 2.4], [0, 5, 2.8, 2]]) for (const s of [-1, 1]) b.add(s * x, 32, z, w, 3.2, d, NAVY);
  b.add(0, 32, -3.6, 13.8, 0.8, 2.2, GOLD);
  for (const [x, z, w, d] of [[5.6, -1.4, 2.6, 3.2], [4.2, 1.2, 2.8, 2.8], [2.6, 3.4, 2.8, 2.6], [0, 5, 3, 2.2]]) for (const s of [-1, 1]) b.add(s * x, 34.6, z, w, 0.8, d, GOLD);
  b.add(0, 32, -0.4, 8, 3.8, 6.4, NAVY2); b.add(0, 35.8, -0.4, 6.4, 2, 6.4, NAVY2);
  const y = 37.8;                                                                                       // a gold crown on top
  b.add(0, y, -0.4, 7, 1.8, 7, GOLD);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [-1, 0], [1, 0]]) b.add(x * 2.9, y + 1.8, -0.4 + z * 2.9, 1.2, x === 0 || z === 0 ? 3 : 4.4, 1.2, GOLD);
  b.add(0, y + 0.3, 3.2, 1.6, 1.2, 0.3, 0xe8382e);
  b.g = 'body';
  return b;
}

export const PIRATES = {
  id: 'pirates', side: 'w', pal: { ...PAL.w, skin: 0xf0c49c, skinD: 0xd8a47c },
  build: { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king },
};
