// Pixelwelt team goblins (CHE-372, Black of ?pixteam=wizards): a cheeky goblin horde of our own design, comic not scary. Moss green
// skin, dark leather, rusty iron and purple rags, with bright accents (yellow eyes, orange glow) so the dark side still reads. Big
// pointy ears that stick out sideways from the cube head are the team signature. Cast: a grunt with a pot helmet (pawn), a dim
// friendly troll with a watchtower on its back (rook), a goblin on a tusked boar (knight), a shaman with a feathered hat and a
// mushroom staff (bishop), a queen in a ragged gown with a crown of thorns (queen), a fat king with a jagged crown and a club (king).
// Format: Vox box lists as in seta.js (front +z, y up, sizes in voxels, rig tags per box); heroes.js scales every figure.
import { Vox } from '../blocks/vox.js';
import { PAL } from './palette.js';
import { paint, holdSpear, sideTag } from './seta.js';

// ------------------------------------------------------------------ colours
const SKIN = 0x52702a, SKIN_D = 0x3c5420, SKIN_L = 0x6c8c36, EAR_IN = 0x7a4a3c;
const TROLL = 0x55654a, TROLL_D = 0x3e4b36, TROLL_L = 0x6a7a58, MOSS = 0x7a9a2a;
const LEATHER = 0x4a3020, LEATHER_D = 0x30201a, FUR = 0x6e5a44, FUR_L = 0x8c7658;
const RUST = 0x9a5428, RUST_D = 0x6a3a20, IRON = 0x4c4852, IRON_D = 0x34313a;
const RAG = 0x4b2a62, RAG_D = 0x341c46, RAG_L = 0x6a3f86;
const WOOD = 0x6b4a2a, WOOD_D = 0x4c321c, ROBE = 0x5c4030, ROBE_D = 0x432e22;
const EYE = 0xf6e23a, PUPIL = 0x1a1410, MOUTH = 0x24140f, TOOTH = 0xeae2c4, GLOW = 0xff9a2a, LIME = 0xb8f040, CROWN = 0xc08a2a, CROWN_D = 0x8a5e1e;
const BOAR = 0x5e4230, BOAR_D = 0x432f22, SNOUT = 0x8a5e4e, SNOUT_L = 0xd89a8a, CREST = 0xd0682a, VEST = 0xd8702a, MAGENTA = 0xe040c0, MAGENTA_D = 0x8a2a7a;

// ------------------------------------------------------------------ faces (8 x 8, row 0 on top; y eye, p pupil, b brow, m mouth, t tooth, g war paint)
const FACES = {
  grin: ['........', '.bb..bb.', '.yy..yy.', '.yp..py.', '........', 'm......m', '.mtmmtm.', '..mmmm..'],
  grump: ['........', 'bb....bb', '.bb..bb.', '.yy..yy.', '.yp..py.', '........', '........', '........'],
  shaman: ['........', '.bb..bb.', '.yy..yy.', 'gyp..pyg', 'g......g', '.m....m.', '..mmmm..', '........'],
  queen: ['........', '.bb..bb.', '.yy..yy.', '.yp..py.', '........', 'c......c', '.m....m.', '..mmmm..'],
  king: ['........', 'bbb..bbb', '..b..b..', '.yp..py.', '.yy..yy.', '........', 'mtmmmmtm', '.mmmmmm.'],
};
const FP = { c: 0x8a4a4a, y: EYE, p: PUPIL, b: 0x22180f, m: MOUTH, t: TOOTH, g: LIME };

/** A builder that shifts (and scales) everything it adds: paint() and friends on a head that is not at x = z = 0. */
const off = (b, dx, dy, dz, s = 1) => ({ add: (x, y, z, w, h, d, c) => b.add(x * s + dx, y * s + dy, z * s + dz, w * s, h * s, d * s, c) });

/** The team signature: two big pointy ears out of the sides of a head of half width hw, ear bottom at y, centred at z. */
function ears(b, hw, y, z, skin = SKIN, s = 1) {
  for (const k of [-1, 1]) {
    b.add(k * (hw + 1.6 * s), y, z, 3.2 * s, 4 * s, 1.4 * s, skin);
    b.add(k * (hw + 4.4 * s), y + 1.2 * s, z, 2.4 * s, 3.2 * s, 1.2 * s, skin);
    b.add(k * (hw + 6.4 * s), y + 2.6 * s, z, 1.6 * s, 2.6 * s, 1.0 * s, skin);
    b.add(k * (hw + 2.8 * s), y + 1.4 * s, z + 0.75 * s, 4.2 * s, 1.8 * s, 0.3 * s, EAR_IN);
  }
}
/** A long hooked goblin nose on a head front at z (the head's front face), centre height y. */
function nose(b, y, z, s = 1, c = SKIN_L) {
  b.add(0, y, z + 0.7 * s, 1.8 * s, 2.2 * s, 1.4 * s, c);
  b.add(0, y - 0.3 * s, z + 1.9 * s, 1.2 * s, 1.4 * s, 1.2 * s, c);
}
/** A goblin head: the 8 cube, a painted face, the nose and the ears. Base at (0, y, z). */
function goblinHead(b, y, z, face, o = {}) {
  const { skin = SKIN, earY = 3.2, earS = 1 } = o;
  b.g = 'head';
  b.add(0, y, z, 8, 8, 8, skin);
  paint(off(b, 0, 0, z), y, face, FP);
  nose(b, y + 2.6, z + 4);
  ears(b, 4, y + earY, z - 0.6, skin, earS);
}

// ------------------------------------------------------------------ pawn: a goblin grunt with a dented pot helmet and a little club
function pawn(C) {
  const b = new Vox();
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    b.add(s * 2.1, 0, 0, 3.2, 9, 3.2, LEATHER);
    b.add(s * 2.3, 0, 1.0, 3.8, 1.6, 5.4, SKIN_D);                                                     // big bare feet
  }
  b.g = 'body';
  b.add(0, 9, 0, 9, 13, 5, RAG);                                                                        // a rag tunic
  b.add(-2.8, 7.8, 0, 2.4, 1.6, 5.3, RAG); b.add(1.8, 7.4, 0, 2, 2, 5.3, RAG);                          // a torn hem
  b.add(0, 12.5, 0, 9.4, 1.6, 5.4, LEATHER_D); b.add(0, 12.6, 2.85, 2.4, 1.4, 0.3, GLOW);               // belt and buckle
  b.add(0, 9, 0, 9.2, 0.8, 5.2, LIME);                                                                  // a lime trim on the hem
  b.add(2.2, 16.4, 2.65, 2.2, 2.2, 0.3, RAG_L);                                                         // a patch
  b.g = 'poseRest';
  b.add(-5.9, 18.5, 0, 3, 3.5, 3.6, RAG); b.add(-7, 15, 0, 2.8, 4.4, 2.8, SKIN); b.add(-5.6, 13.2, 0, 4.4, 2.2, 2.8, SKIN);   // hand on the hip
  b.add(5.9, 18.5, 0, 3, 3.5, 3.6, RAG); b.add(6, 13, 0.3, 2.8, 6, 2.8, SKIN); b.add(6, 11, 1.2, 3.2, 2.6, 3.2, SKIN_D);   // the club arm
  b.add(6, 9.4, 3, 1.2, 9, 1.2, WOOD); b.add(6, 15.6, 3, 2.6, 4.4, 2.6, WOOD_D); b.add(6, 17, 3, 2.9, 0.8, 2.9, RUST);     // a little club
  holdSpear(b, C, RAG);
  goblinHead(b, 22, 0, FACES.grin);
  b.add(0, 29.2, 0, 9.2, 3.2, 9.2, IRON); b.add(0, 29.2, 0, 10, 0.9, 10, RUST);                     // the pot helmet
  b.add(-1.8, 32.4, 1.2, 3.4, 0.5, 3.4, IRON_D); b.add(2, 30.4, 4.65, 1.6, 1.2, 0.3, RUST);           // a dent and rust
  b.add(5.1, 30.4, 0, 1.2, 1.2, 2.4, IRON_D);                                                           // the pot handle
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ rook: a big dim troll with a wooden watchtower on its back
function rook() {
  const b = new Vox();
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    b.add(s * 4.2, 0, 0.5, 6, 7.4, 6.4, TROLL);
    b.add(s * 4.2, 0, 1.4, 6.6, 2, 8.2, TROLL_D);                                                     // wide flat feet
  }
  b.g = 'body';
  b.add(0, 7, 0, 17, 14, 10, TROLL);                                                                    // a broad body
  b.add(0, 8, 0.6, 13, 10, 10.4, TROLL_L);                                                              // the belly
  b.add(0, 7, 0, 17.4, 2.4, 10.4, LEATHER); b.add(0, 3.6, 5.3, 6, 5.4, 0.6, LEATHER_D);                // belt and loin cloth
  b.add(0, 7.6, 5.3, 2.2, 1.4, 0.4, GLOW); b.add(0, 9.4, 0, 17.6, 0.6, 10.6, GLOW);                   // buckle and an orange trim
  for (const s of [-1, 1]) b.add(s * 4.6, 9.4, 0, 1.8, 11.8, 10.8, LEATHER);                           // the straps of the tower
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 10.6, 13, 0, 5.4, 8.4, 6.4, TROLL); b.add(s * 10.9, 5, 0.6, 5.6, 8.4, 6.6, TROLL);
    b.add(s * 10.9, 2.4, 1, 6.4, 4.4, 7.2, TROLL_D);                                                   // big fists
  }
  b.g = 'head';                                                                                         // a small head, low and forward
  b.add(0, 20.5, 2.6, 8, 8, 8, TROLL);
  paint(off(b, 0, 0, 2.6), 20.5, FACES.grump, FP);
  b.add(0, 23.4, 7.2, 2.8, 2.6, 1.8, TROLL_L);                                                          // a potato nose
  b.add(0, 20.1, 6.6, 7.2, 2.6, 1.4, TROLL_D);                                                          // an underbite jaw
  for (const s of [-1, 1]) b.add(s * 2.4, 22.1, 7.0, 1.2, 1.8, 1.0, TOOTH);                            // two tusks
  b.add(0, 21.7, 7.35, 4, 0.6, 0.3, MOUTH);
  ears(b, 4, 24.2, 2, TROLL, 0.8);
  b.add(-1.6, 28.5, 3.4, 3, 0.8, 3, MOSS); b.add(2, 28.5, 1.2, 2, 1.2, 2, MOSS);                      // moss on the head
  b.g = 'body';
  b.add(0, 10, -9.5, 13, 26, 8, WOOD);                                                                  // the watchtower on its back
  for (const y of [13, 17, 21, 25, 29, 33]) b.add(0, y, -9.5, 13.3, 0.7, 8.3, WOOD_D);                     // planks
  for (const s of [-1, 1]) b.add(s * 6.6, 24, -10, 0.3, 3.4, 2.4, PUPIL);                              // window slits
  b.add(0, 18, -13.6, 2.4, 4, 0.3, PUPIL);
  b.add(0, 36, -9.5, 15, 1.6, 10.4, WOOD_D);                                                            // the platform
  for (const [x, z] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) b.add(x * 6, 37.6, -9.5 + z * 3.7, 3, 3, 3, WOOD);   // battlements with gaps
  b.add(3.6, 30, -5.35, 2, 3, 0.3, EYE);                                                                // a lit window over the troll's shoulder
  b.add(0, 40.6, -5.8, 0.6, 3.4, 0.6, WOOD_D); b.add(1.8, 42, -5.8, 3, 2, 0.4, GLOW);                   // an orange flag on top
  return b;
}

// ------------------------------------------------------------------ knight: a goblin on a tusked boar
function boar(b) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.g = 'lg' + (sx < 0 ? 'N' : 'P') + (sz > 0 ? 'F' : 'B');
    b.add(sx * 2.6, 0, sz * 5, 3, 8, 3.2, BOAR); b.add(sx * 2.6, 0, sz * 5 + 0.2, 3.3, 1.6, 3.6, BOAR_D);
  }
  b.g = 'body';
  b.add(0, 7, 0, 8, 8, 15, BOAR);                                                                       // a round body
  b.add(0, 7, 0.5, 8.2, 2, 14, BOAR_D);
  b.add(0, 15, -6, 2, 2, 6, CREST);                                                                     // a bright bristle crest
  b.add(0, 13, -2.6, 8.4, 2, 8, RUST);                                                                   // a saddle cloth
  b.add(0, 12.6, -2.6, 8.6, 0.8, 8.2, GLOW);
  b.g = 'head';
  b.add(0, 7, 9.5, 7, 7, 6, BOAR);                                                                      // a big low head
  b.add(0, 7.6, 13.6, 4.6, 3.6, 2.6, SNOUT); b.add(0, 7.9, 15, 3.6, 3, 0.4, SNOUT_L);                  // the snout
  for (const s of [-1, 1]) b.add(s * 0.9, 9, 15.3, 0.8, 0.8, 0.3, BOAR_D);                              // nostrils
  b.add(0, 14, 8.6, 2, 2, 5, CREST);                                                                     // the crest on the head
  for (const s of [-1, 1]) {
    b.add(s * 2, 7.6, 15.8, 1.2, 3, 1.2, TOOTH); b.add(s * 2, 10.6, 15.3, 1.2, 1, 1.2, TOOTH);               // two tusks curving up and back
    b.add(s * 2.2, 11.4, 12.65, 1.4, 1.2, 0.3, EYE); b.add(s * 1.9, 11.4, 12.85, 0.7, 0.8, 0.3, PUPIL);   // eyes
    b.add(s * 2.6, 14, 8.4, 1.6, 2, 1.2, BOAR_D);                                                      // ears
  }
  b.g = 'tail';
  b.add(0, 11, -7.9, 1.2, 1.2, 1.2, BOAR_D); b.add(0, 11.6, -8.6, 1, 2, 1, BOAR_D);                  // a curly tail
  b.g = 'body';
}
function knight() {
  const b = new Vox(), s = 0.9, zr = -2.4;
  boar(b);
  b.g = 'rider';
  for (const k of [-1, 1]) { b.add(k * 4.6, 9.6, zr + 1, 2.2, 6, 2.6, LEATHER); b.add(k * 4.7, 9.4, zr + 2, 2.4, 1.6, 3.2, SKIN_D); }   // legs and feet
  b.add(0, 14.6, zr, 6.4, 8, 4, RAG); b.add(0, 16, zr, 6.8, 6.6, 4.4, VEST); b.add(0, 15.2, zr, 7, 1.2, 4.6, LEATHER_D);   // an orange vest and belt
  for (const k of [-1, 1]) { b.add(k * 4.2, 17, zr + 2, 2.2, 5, 2.4, RAG); b.add(k * 3.6, 17, zr + 4.4, 2.2, 2, 2.6, SKIN); }   // arms forward at the reins
  b.add(0, 17.6, zr + 6.6, 5.2, 0.5, 0.5, LEATHER_D); b.add(0, 15.6, 9.6, 6, 0.5, 0.5, LEATHER_D);    // reins
  const y0 = 22.6, hw = 4 * s;
  b.add(0, y0, zr, 8 * s, 8 * s, 8 * s, SKIN);                                                          // the head, a little smaller
  paint(off(b, 0, y0, zr, s), 0, FACES.grin, FP);
  nose(b, y0 + 2.6 * s, zr + hw, s);
  ears(b, hw, y0 + 3.4 * s, zr - 0.5, SKIN, 0.34);
  b.add(0, y0 + 5.8 * s, zr, 7.8, 1.8, 7.8, LEATHER); b.add(0, y0 + 5.8 * s + 1.8, zr - 0.4, 4.4, 1.2, 4.4, LEATHER_D);   // a leather cap
  b.add(-1.6, y0 + 5.8 * s + 1.8, zr - 1.6, 0.8, 3.6, 0.8, GLOW);                                      // a straight feather
  b.add(0, y0 - 0.6, zr, 7.6, 1.2, 7.6, RAG_L);                                                         // a scarf
  b.add(0, y0 - 3.4, zr - 3.6, 3, 3.6, 0.6, RAG_L);
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ bishop: a shaman with a tall feathered hat and a mushroom staff
function bishop() {
  const b = new Vox();
  b.add(0, 0, 0, 11, 6, 7.6, ROBE_D); b.add(0, 6, 0, 10, 6, 6.6, ROBE);                                  // a long robe in two tiers
  for (const x of [-4, -1, 2.6]) b.add(x, 0, 0, 1.8, 0.8, 7.8, ROBE_D);                               // ragged hem
  b.add(0, 12, 0, 8, 12, 4.4, ROBE); b.add(0, 12, 0, 8.4, 1.4, 4.8, RAG);                            // body and belt
  b.add(0, 13.8, 2.3, 2.8, 10.2, 0.3, RAG_L);                                                             // a hide stole
  for (const [x, y] of [[-2.6, 21.2], [-1.4, 20], [0, 19.6], [1.4, 20], [2.6, 21.2]]) b.add(x, y, 2.6, 1, 1, 0.6, GLOW);   // a bead necklace
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 6, 13, 0, 4, 11, 4.2, ROBE); b.add(s * 6, 12, 0.2, 4.6, 2, 4.8, ROBE_D);
    b.add(s * 6, 11, 0.4, 3.2, 2, 3.2, SKIN);
  }
  b.g = 'body';                                                                                         // the mushroom staff, standing beside the shaman
  b.add(-7, 0, 2.6, 1.2, 35, 1.2, WOOD);
  b.add(-7, 34.4, 2.6, 5, 2.4, 5, GLOW); b.add(-7, 36.8, 2.6, 3.2, 1.2, 3.2, GLOW);                   // a glowing mushroom cap
  b.add(-7, 33.4, 2.6, 2, 1.2, 2, 0xf2dcb0);
  for (const x of [-1.5, 0.2, 1.6]) b.add(-7 + x, 35.2 + (x === 0.2 ? 0.6 : 0), 5.15, 0.9, 0.9, 0.3, 0xfff2a0);   // spots
  b.g = 'body';
  goblinHead(b, 24, 0, FACES.shaman);
  b.g = 'head';                                                                                         // a tall feathered mask hat
  b.add(0, 31, 0, 9, 2, 9, LEATHER); b.add(0, 31.6, 4.6, 9.2, 0.8, 0.3, GLOW);
  let y = 33;
  for (const [w, h, c] of [[7.4, 3, RAG], [5.8, 3, RAG_D], [4.2, 3, RAG], [2.6, 2.6, RAG_D]]) { b.add(0, y, -0.6, w, h, w, c); y += h; }
  b.add(0, y, -1.2, 1.2, 2.2, 1.2, LIME);                                                               // a lime tip
  for (const s of [-1, 1]) {                                                                            // feathers fanning up and out
    b.add(s * 3.2, 34, -3.6, 1, 7, 0.8, GLOW); b.add(s * 3.6, 40.6, -3.6, 1, 2.4, 0.8, LIME);
    b.add(s * 4.8, 33, -3.0, 1, 5, 0.8, LIME); b.add(s * 5.4, 37.6, -3.0, 1, 1.8, 0.8, GLOW);
  }
  b.add(0, 34.6, 3.15, 2, 2, 0.3, LIME);                                                                // a glowing eye sign on the hat
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ queen: a ragged gown, a crown of thorns, glowing jewels
function queen() {
  const b = new Vox();
  b.add(0, 0, 0, 15, 4, 11, RAG_D); b.add(0, 0.6, 0, 15.2, 0.8, 11.2, MAGENTA); b.add(0, 4, 0, 13, 4, 9.2, RAG); b.add(0, 8, 0, 10.6, 4, 7.2, RAG_D);   // a wide tiered gown
  for (const [x, z] of [[-6.2, 1], [-2, 1], [2.4, 1], [6.2, 1], [-5, -1], [0, -1], [5, -1]]) b.add(x, 0, z * 5.6, 1.6, 2.4, 0.6, RAG);   // ragged hem drops
  for (const x of [-4.6, 0, 4.6]) b.add(x, 4.4, 4.7, 1.4, 1.4, 0.3, LIME);                            // jewels on the gown
  b.add(0, 12, 0, 8, 12, 4, LEATHER); b.add(0, 12, 2.15, 4, 9, 0.3, RAG_L);                             // bodice
  b.add(0, 21.2, 2.2, 6, 1, 0.4, CROWN_D); b.add(0, 19.6, 2.35, 1.6, 1.6, 0.4, LIME);                  // necklace with a glowing jewel
  for (const s of [-1, 1]) b.add(s * 5.4, 21.4, 0, 3.6, 2.6, 5, FUR);                                  // fur shoulders
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 6, 12.6, 0, 3.6, 10, 3.6, RAG); b.add(s * 6, 11, 0.2, 3.2, 2, 3.2, SKIN);
  }
  b.g = 'armP';                                                                                         // a little sceptre with a glowing orb
  b.add(6, 9, 2.4, 1, 12, 1, WOOD_D); b.add(6, 20.6, 2.4, 2.4, 2.4, 2.4, LIME);
  b.g = 'body';
  goblinHead(b, 24, 0, FACES.queen, { earS: 0.8 });
  b.g = 'head';
  b.add(0, 30.6, 0, 8.6, 1.6, 8.6, RAG_D);                                                              // dark hair
  b.add(0, 18, -4.5, 8.8, 14, 1.6, RAG_D);                                                              // long hair down the back
  b.add(0, 32.2, -2.6, 4, 2.4, 3, RAG_D);                                                               // a bun
  b.add(0, 31.6, 0.4, 9, 1.2, 8.4, MAGENTA_D);                                                          // a tall three spike tiara
  for (const [x, h] of [[-2.9, 4.4], [0, 5.6], [2.9, 4.4]]) b.add(x, 32.8, 4.2, 1.8, h, 1.2, MAGENTA);
  b.add(0, 34.2, 4.95, 2.2, 2.2, 0.6, LIME);                                                            // one big jewel
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ king: a fat goblin king, jagged rusty crown, fur cape and a big club
function king() {
  const b = new Vox();
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    b.add(s * 2.6, 0, 0, 4, 9, 4, LEATHER); b.add(s * 2.7, 0, 0.8, 4.4, 2, 5.8, LEATHER_D);
  }
  b.g = 'body';
  b.add(0, 9, 0, 11, 14, 7, RAG);                                                                       // a fat body
  b.add(0, 10, 0.8, 9, 9, 7, RAG_L);                                                                    // the belly
  b.add(0, 11.6, 0, 11.4, 1.8, 7.4, LEATHER_D); b.add(0, 11.4, 3.75, 3, 2.2, 0.4, CROWN);              // belt with a big buckle
  b.add(0, 7, -4.2, 13, 17, 1.6, FUR);                                                                  // a fur cape
  b.add(0, 7, -4.2, 13.4, 2, 2, FUR_L); b.add(0, 9, -4.2, 13.4, 0.8, 2, GLOW);                         // a light fur hem with an orange trim
  b.add(0, 20, -3.6, 14, 6, 3, FUR_L); for (const x of [-4, 0, 4]) b.add(x, 21.6, -2, 1.2, 1.2, 0.4, FUR);   // a high fur collar
  for (const s of [-1, 1]) b.add(s * 5.8, 21.6, 0, 5, 2.6, 7.4, FUR_L);                                // fur shoulders
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 7.4, 11, 0, 3.8, 11, 4.4, RAG); b.add(s * 7.4, 9.6, 0.3, 3.6, 2.4, 3.6, SKIN);
  }
  b.g = 'armP';                                                                                         // a big club sceptre
  b.add(7.4, 3, 2.8, 1.4, 16, 1.4, WOOD);
  b.add(7.4, 16.4, 2.8, 3.6, 6, 3.6, WOOD_D); b.add(7.4, 18, 2.8, 3.9, 1, 3.9, RUST);
  b.add(7.4, 22.4, 2.8, 2, 2, 2, GLOW);                                                                 // with a glowing gem
  b.g = 'body';
  goblinHead(b, 23, 0.4, FACES.king, { earS: 0.7 });
  b.g = 'head';
  b.add(0, 30.4, 0.4, 10, 2.2, 10, CROWN);                                                              // the jagged rusty crown
  b.add(0, 30.4, 0.4, 10.2, 0.8, 10.2, CROWN_D);
  for (const [x, z, h] of [[-1, 1, 4], [-0.5, 1, 2.6], [0, 1, 6], [0.5, 1, 2.6], [1, 1, 4.6], [-1, -1, 4.6], [0, -1, 5], [1, -1, 3.6], [-1, 0, 3.4], [1, 0, 4.2]]) {
    b.add(x * 4.4, 32.6, 0.4 + z * 4.4, 1.6, h, 1.6, CROWN);
  }
  b.add(0, 32.6, 4.9, 2.4, 2.4, 0.4, GLOW);                                                             // gems
  for (const s of [-1, 1]) b.add(s * 2.6, 31, 5.1, 1.2, 1.2, 0.3, LIME);
  b.add(0, 38.6, 4.8, 1.6, 1.6, 1.6, LIME);
  b.g = 'body';
  return b;
}

export const GOBLINS = {
  id: 'goblins', side: 'b',
  pal: { ...PAL.b, skin: SKIN, skinD: SKIN_D, hair: RAG_D, main: RAG, dark: RAG_D, light: RAG_L, iron: IRON, ironD: IRON_D, boots: LEATHER_D },
  build: { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king },
};
