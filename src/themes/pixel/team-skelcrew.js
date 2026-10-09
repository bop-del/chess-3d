// Pixelwelt team skelcrew (CHE-372): the Geisterpiraten, a comic spooky ghost pirate crew, the Black side of ?pixteam=pirates.
// Own designs: sea green ghost skin, glowing cyan eyes, dark navy and black tattered coats, barnacles, seaweed and lantern light.
// A ghost deckhand on a peg leg (pawn), a barrel bellied barnacle bosun with an anchor (rook), a ghost rider on a ghostly sea horse
// (knight), a lookout in a tall floppy hood with a green lantern on a pole (bishop), a sea witch in a gown of kelp and dark water
// with a coral diadem (queen) and the ghost captain at the ship's wheel, a sea foam beard and a crown on a battered tricorn (king).
// Box lists in the blocky humanoid scheme of seta.js (head 8 x 8 x 8 with a painted face, front +z); heroes.js scales them.
import { Vox } from '../blocks/vox.js';
import { PAL } from './palette.js';
import { legs, arms, paint, facePal, holdSpear, sideTag, BLACK } from './seta.js';

const pal = {
  ...PAL.b,
  skin: 0x9ccfc8, skinD: 0x7aa8a2,                          // pale mint ghost skin
  coat: 0x2a3a5a, coatD: 0x1c2840, coatL: 0x3a4c70,         // navy coats
  shirt: 0x1a1f2c, stripe: 0x2c3a4e, pants: 0x222a36,
  hair: 0x10201f, boots: 0x15151c, hat: 0x15151c, hatL: 0x262833,
  weed: 0x2f7a3a, weedD: 0x1f5428,                          // seaweed and kelp
  glow: 0x6ff7e6, lamp: 0xffd270,                           // glowing eyes, lantern light
  barn: 0x8a948c, barnD: 0x5c665f,                          // barnacles
  wood: 0x664628, woodD: 0x4a3220, wheel: 0x7a5232, wheelD: 0x553820, mist: 0x7ff0e2, kelp: 0x4aa856, rope: 0x6a5236,
  brass: 0xb8923a, brassD: 0x80652a, rust: 0x8a5236, anchor: 0x5e6878,
  scarf: 0x6a2434, coral: 0xd65a4c, pearl: 0xd8f8ff, foam: 0x9fe8dc,
  water: 0x15384a, water2: 0x1d4c5e, waveL: 0x52b0bc,
  horse: 0x1c2840, horseD: 0x131b2c, horseL: 0x5cd0c4, hoof: 0x6ff7e6, mane: 0x4aa856,
};

// face maps (8 x 8, row 0 on top) in the format of seta.js; d a dark eye hole, g its glowing glint, k black, t a tooth, m lips, b brow, x eye patch
const F = {
  deck: ['........', '........', '.gd..gd.', '.dd..dd.', '........', '..k..k..', '...kk...', '........'],
  bosun: ['........', 'bbbbbbbb', '.gd..gd.', '.dd..dd.', '........', '...nn...', '.kkkkkk.', '.kt..tk.'],
  look: ['........', '.....bb.', '.gd..gd.', '.dd..dd.', '........', '...nn...', '..kkkk..', '...kt...'],
  witch: ['........', '........', '.bb..bb.', '.gd..gd.', '.dd..dd.', '........', '..m..m..', '...mm...'],
  capt: ['........', 'bbb..xbb', '.gd.xxx.', '.dd.xxx.', '...x....', '...nn...', '........', '........'],
};
/** Ghost mist round the feet: low glowing wisps on the board, each with a smaller puff on top. [x, z, w, d] each. */
function mist(b, C, at) {
  const g = b.g; b.g = 'body';
  for (const [x, z, w, d] of at) { b.add(x, 0, z, w, 0.7, d, C.mist); b.add(x + w / 4, 0.7, z, w / 2, 0.5, d / 2, C.mist); }
  b.g = g;
}
const fp = (C, extra = {}) => facePal(C, { g: C.glow, d: 0x14203a, b: C.hair, t: 0xcfd8cf, m: 0x6a2434, x: BLACK, ...extra });

// ------------------------------------------------------------------ pawn: a ghost deckhand on a peg leg
function pawn(C) {
  const b = new Vox();
  b.g = 'legN'; b.add(-2, 0, 0, 4, 12, 4, C.pants); b.add(-2, 0, 0.2, 4.3, 2, 4.5, C.boots); b.add(-2, 2, 0, 4.2, 0.6, 4.2, C.mist);
  b.g = 'legP'; b.add(2, 6, 0, 4, 6, 4, C.pants); b.add(2, 5, 0, 4.4, 1.4, 4.4, C.coatD); b.add(2, 6.4, 0, 4.2, 0.6, 4.2, C.mist);   // a ragged trouser cuff, a glowing hem
  b.add(2, 0, 0, 2, 5.2, 2, C.wood); b.add(2, 0, 0, 2.4, 0.8, 2.4, C.woodD);                             // the peg leg
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, C.shirt);
  for (const y of [14.6, 17.6, 20.6]) b.add(0, y, 0, 8.2, 1.2, 4.2, C.stripe);                          // a striped shirt
  b.add(0, 12, 0, 8.4, 1.2, 4.4, C.rope); b.add(1.6, 11.4, 2.3, 1.2, 1.8, 0.4, C.rope); b.add(0, 13.2, 0, 8.5, 0.5, 4.5, C.mist);   // a rope belt with a knot, a glowing seam
  b.add(-2.4, 16.2, 2.25, 2, 1.2, 0.3, C.skin);                                                          // a tear in the shirt
  b.add(0, 22.6, 0, 8.6, 1.4, 4.6, C.scarf);                                                             // a neckerchief
  b.g = 'poseRest';                                                                                      // a cheeky "boo": one hand up, a lantern in the other
  b.add(-6, 22, 0, 4, 9, 4, C.shirt); b.add(-6, 24.4, 0, 4.2, 1.2, 4.2, C.stripe); b.add(-6, 27.4, 0, 4.2, 1.2, 4.2, C.stripe);   // the arm raised beside the head
  b.add(-6, 30.4, 0, 4.3, 0.6, 4.3, C.mist); b.add(-6, 31, 0, 4, 2.4, 3.2, C.skin);                      // a glowing cuff, the open palm
  for (const x of [-7.4, -6, -4.6]) b.add(x, 33.4, 0, 1, 1.4, 1, C.skin);
  b.add(-8.4, 31.4, 0, 0.8, 1, 1, C.skin);                                                               // the thumb
  b.add(6, 12, 0, 4, 12, 4, C.shirt); b.add(6, 17.6, 0, 4.2, 1.2, 4.2, C.stripe); b.add(6, 20.6, 0, 4.2, 1.2, 4.2, C.stripe);   // the arm hanging down
  b.add(6, 14, 0, 4.3, 0.6, 4.3, C.mist); b.add(6, 12, 0, 4.2, 2, 4.2, C.skin);
  b.add(6, 10.4, 0, 0.4, 1.6, 0.4, C.anchor); b.add(6, 10, 0, 2.6, 0.5, 2.6, C.anchor);                  // a little lantern
  b.add(6, 7, 0, 2, 3, 2, C.lamp); b.add(6, 6.6, 0, 2.6, 0.4, 2.6, C.anchor);
  mist(b, C, [[-4.6, 2.4, 2.4, 1.6], [4.4, -1.8, 2, 2], [0.4, 3.4, 1.6, 1.2]]);
  holdSpear(b, C, C.shirt);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, F.deck, fp(C));
  b.add(0, 31, 0, 8.4, 1.4, 8.4, C.weedD); b.add(0, 29, -4.25, 8.4, 2.4, 0.5, C.weedD);                   // a mop of seaweed
  b.add(-2.6, 29.4, 4.45, 1, 1.8, 0.5, C.weed); b.add(2.4, 30, 4.45, 1.2, 1.2, 0.5, C.weed);             // strands over the forehead
  for (const s of [-1, 1]) b.add(s * 4.3, 26.4, -1, 0.6, 5, 1.4, C.weed);
  b.add(-1.4, 32.4, 0.5, 1, 1.6, 1, C.weed); b.add(1.2, 32.4, -1.4, 1, 1, 1, C.weed);
  b.add(3.2, 24.8, 4.3, 1, 1, 0.4, C.barn);                                                              // a barnacle on the cheek
  return b;
}

// ------------------------------------------------------------------ rook: a barrel bellied barnacle bosun with an anchor
function rook(C) {
  const b = new Vox();
  legs(b, C, { h: 8, w: 5, d: 5, x: 3.5, color: C.pants, boot: C.boots, bootH: 2.4 });
  b.add(0, 8, 0, 14, 11, 9, C.wood);                                                                     // the barrel belly
  for (const x of [-4.5, -1.5, 1.5, 4.5]) b.add(x, 8, 4.6, 0.4, 11, 0.3, C.woodD);                     // staves
  b.add(0, 9.2, 0, 14.4, 1.4, 9.4, C.brassD); b.add(0, 15.8, 0, 14.4, 1.4, 9.4, C.brassD);                 // brass hoops
  for (const y of [9.7, 16.3]) { b.add(0, y, 4.85, 14.4, 0.4, 0.3, C.mist); for (const sx of [-1, 1]) b.add(sx * 7.35, y, 0, 0.3, 0.4, 9.4, C.mist); }   // with a glowing seam
  b.add(0, 18.6, 0, 12, 1, 8, C.woodD);
  for (const [x, y] of [[-5.2, 17.2], [-4.2, 17.6], [-5.6, 12.2], [4.6, 11.4], [5.4, 12.4], [2.4, 17.4]]) b.add(x, y, 4.8, 1.2, 1.2, 0.8, C.barn);
  b.add(-6.4, 11, 4.9, 1.2, 8, 0.4, C.weed); b.add(-5.2, 13.4, 4.9, 1, 5.6, 0.4, C.weed); b.add(6.2, 14.2, 4.9, 1, 4.8, 0.4, C.weed);   // seaweed
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 8.8, 5, 0, 4.4, 8, 4.8, C.coatD); b.add(s * 8.8, 13, 0, 4.8, 7, 5.2, C.coat); b.add(s * 8.8, 18.4, 0, 5.2, 1.8, 5.6, C.coatD); b.add(s * 8.8, 12.6, 0, 5, 0.6, 5.4, C.mist);
    b.add(s * 8.8, 2.6, 0, 5, 3, 5.4, C.skinD);                                                           // big fists
    b.add(s * 9.4, 9, 2.6, 1.2, 1.2, 0.6, C.barn); b.add(s * 8.2, 15, 2.8, 1.2, 1.2, 0.6, C.barn);
  }
  b.g = 'head';
  b.add(0, 19, 0.5, 8, 8, 8, C.skin);
  paint(b, 19, F.bosun, fp(C, { b: C.skinD }), 9);
  b.add(0, 20, 5.3, 2, 3, 1.6, C.skinD);                                                                 // a big nose
  b.add(0, 26, 0.5, 8.6, 1.4, 8.6, C.scarf); b.add(0, 27.4, 0.5, 7.8, 1.6, 7.8, C.scarf); b.add(0, 29, 0.5, 2, 1, 2, C.weed);   // a knit cap
  b.g = 'body';
  mist(b, C, [[-6.8, 3.6, 2.6, 1.6], [0, 4.2, 2, 1.2], [-1.6, -3.6, 2.4, 1.4]]);
  const ax = 9, az = 4;                                                                                  // a big anchor, held in the right fist
  const A = C.barn;
  b.add(ax, 1, az, 2.4, 22, 1.2, A);
  b.add(ax, 18.4, az, 8.4, 1.8, 1.1, A); for (const s of [-1, 1]) b.add(ax + s * 4.4, 18.2, az, 0.8, 2.2, 1.2, C.rust);
  b.add(ax, 23, az, 3.8, 1, 1.2, C.rust); for (const s of [-1, 1]) b.add(ax + s * 1.5, 24, az, 0.8, 2, 1.1, C.rust); b.add(ax, 26, az, 3.8, 0.9, 1.2, C.rust);
  b.add(ax, 0.2, az, 9.6, 2, 1.2, A);
  for (const s of [-1, 1]) { b.add(ax + s * 4, 2, az, 1.8, 4, 1.1, A); b.add(ax + s * 4, 6, az, 3.2, 1.6, 1.2, C.rust); }
  b.add(ax, 7, az + 0.65, 1.2, 1.2, 0.4, C.barnD); b.add(ax - 0.4, 12, az + 0.65, 1, 1, 0.4, C.barnD); b.add(ax, 14, az + 0.65, 1, 1.6, 0.4, C.weed);
  return b;
}

// ------------------------------------------------------------------ knight: a ghost rider on a ghostly sea horse
function seaHorse(b, C) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.g = 'lg' + (sx < 0 ? 'N' : 'P') + (sz > 0 ? 'F' : 'B');
    b.add(sx * 2.4, 0, sz * 5.4, 3, 9, 3, C.horse); b.add(sx * 2.4, 0, sz * 5.4, 3.4, 1.2, 3.4, C.hoof);   // glowing wisps for hooves
    b.add(sx * 2.4, 5, sz * 5.4, 3.3, 1, 3.3, C.horseL);
  }
  b.g = 'body';
  b.add(0, 9, 0, 7, 7, 15, C.horse); b.add(0, 9, 0, 7.2, 1.6, 15.2, C.horseD);
  for (const z of [-2.4, 0, 2.4]) b.add(0, 11.4, z, 7.3, 3, 0.6, C.horseL);                            // glowing rib bands
  b.add(0, 16, -0.5, 7.6, 1, 8, C.coat); b.add(0, 16.2, -0.5, 7.8, 0.6, 8.2, C.weed);                    // a ragged saddle cloth
  b.g = 'head';
  b.add(0, 13, 6, 4, 8, 4, C.horse);
  b.add(0, 17, 10.5, 4.6, 5, 8, C.horse); b.add(0, 16.6, 13.6, 4.8, 1.2, 3, C.horseD); b.add(0, 17, 14.6, 4.8, 3, 0.6, C.horseD);
  for (const s of [-1, 1]) {
    b.add(s * 2.45, 18.8, 12, 0.3, 2, 2, C.glow);                                                        // glowing eyes
    b.add(s * 1.4, 22, 7.6, 1, 2.4, 2, C.weed);                                                            // fin like ears
  }
  b.add(0, 13, 4, 1.4, 10, 1.6, C.mane); b.add(0, 14, 2.95, 0.8, 9, 0.5, C.glow); b.add(0, 23.6, 6.8, 0.8, 0.5, 2.4, C.glow); b.add(0, 18, 3.4, 1.6, 3, 1.4, C.weed); b.add(0, 22, 6.8, 1.6, 1.6, 2.4, C.mane);   // a kelp mane
  b.g = 'tail';
  b.add(0, 8, -8.4, 2, 7, 2, C.mane); b.add(0, 6, -9.4, 3.4, 3, 1.2, C.weedD); b.add(0, 4.6, -10, 1.6, 1.6, 1, C.glow);
  b.g = 'body';
}
function knight(C) {
  const b = new Vox();
  seaHorse(b, C);
  b.g = 'rider';
  for (const s of [-1, 1]) { b.add(s * 4.2, 10, -1.2, 2.4, 7, 2.8, C.pants); b.add(s * 4.2, 9.4, -1.2, 2.7, 2, 3.2, C.boots); }
  b.add(0, 17, -1.2, 6, 9, 3.4, C.coat);
  for (const y of [20, 22.4]) b.add(0, y, -1.2, 6.2, 1, 3.6, C.stripe);
  b.add(0, 17, -1.2, 6.4, 1.2, 3.8, C.rope); b.add(0, 18.2, -1.2, 6.5, 0.5, 3.9, C.mist);
  for (const s of [-1, 1]) { b.add(s * 4.2, 18, -0.2, 2.4, 7, 2.6, C.coatL); b.add(s * 4.2, 19.6, -0.2, 2.6, 0.7, 2.8, C.mist); b.add(s * 4.2, 18, 1.6, 2.2, 2, 1.6, C.skin); }
  b.add(4.2, 20.4, 1.9, 0.6, 6, 1.2, 0xaab6c0); b.add(4.2, 19.8, 1.9, 1.8, 0.6, 1.8, C.brass);             // a cutlass held up
  b.add(0, 26, -1.2, 6.4, 6.4, 6.4, C.skin);
  paint({ add: (x, y, z, w, h, d, c) => b.add(x * 0.8, y * 0.8, z * 0.8 - 1.2, w * 0.8, h * 0.8, d * 0.8, c) }, 26 / 0.8, F.deck, fp(C), 8);
  b.add(0, 30.2, -1.2, 8.6, 2.4, 7.4, C.coral); b.add(-0.7, 27.4, -5.3, 1, 3, 0.8, C.coral); b.add(0.8, 27, -5.3, 1, 3, 0.8, C.coral);   // a bandana with two knot tails
  b.add(-3.4, 27.6, 0.4, 0.4, 3.4, 1.2, C.weed);
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ bishop: a lookout in a tall floppy hood with a green lantern
function bishop(C) {
  const b = new Vox();
  b.add(0, 0, 0, 10, 12, 6.4, C.coat);                                                                   // a long coat over the feet
  for (const x of [-3.6, -0.4, 2.8]) b.add(x, 0, 0, 1.6, 1.4, 6.6, C.coatD);                            // a tattered hem
  b.add(0, 1.4, 0, 10.2, 0.6, 6.6, C.mist);                                                              // with a glowing seam
  b.add(0, 12, 0, 8, 12, 4, C.coat);
  mist(b, C, [[4.8, 3.8, 2.4, 1.4], [-2.6, 3.8, 1.8, 1.2], [5.6, -2.4, 1.6, 2]]);
  b.add(0, 4, 3.25, 2.4, 20, 0.3, C.stripe);                                                             // the striped shirt in the opening
  for (const y of [7, 11, 15, 19]) b.add(0, y, 3.4, 2.6, 1, 0.3, C.shirt);
  b.add(0, 13.6, 0, 8.4, 1.2, 4.4, C.rope); b.add(0, 14.8, 0, 8.5, 0.4, 4.5, C.mist); b.add(0, 13.4, 2.35, 1, 2, 0.4, C.lamp); b.add(-3.2, 11.6, 2.5, 1.4, 1.4, 1.4, C.brass);
  b.add(2.8, 10.6, 2.6, 1.2, 4.6, 1.2, C.brass); b.add(2.8, 10.4, 2.6, 1.5, 1, 1.5, C.brassD);           // a spyglass in the belt
  arms(b, C, { color: C.coat, w: 4, h: 10, hand: C.skin });
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 6, 16, 0, 4.3, 0.7, 4.3, C.mist); }   // glowing cuffs
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, F.look, fp(C));
  for (const s of [-1, 1]) b.add(s * 4.5, 24, -0.6, 1, 8.6, 7.6, C.hat);                                // the hood round the face
  b.add(0, 24, -4.5, 10, 8.6, 1, C.hat);
  for (const s of [-1, 1]) b.add(s * 4.5, 24, 3.3, 1.1, 7.4, 0.4, C.mist);                                // a glowing trim along the hood edge
  b.add(0, 23.8, -4.5, 10.2, 0.6, 1.2, C.mist);
  b.add(0, 32, -0.4, 10, 2, 9, C.hat); b.add(0, 31.4, 4.2, 10, 1, 1.2, C.hatL); b.add(0, 31.4, 4.85, 10.2, 0.6, 0.2, C.mist);
  b.add(0, 34, -0.8, 7.6, 3, 7, C.hat); b.add(0.4, 37, -1.1, 5.6, 3, 5.2, C.hat); b.add(1, 40, -1.2, 3.6, 2.6, 3.6, C.hat);
  b.add(1.8, 42.6, -1.2, 2.4, 1.6, 2.4, C.hat); b.add(3.6, 42.2, -1.2, 2, 1.8, 2, C.hat); b.add(5, 40.8, -1.2, 1.6, 2, 1.6, C.hat); b.add(5, 39, -1.2, 1.9, 1.9, 1.9, C.glow); b.add(5, 38.2, -1.2, 0.9, 0.8, 0.9, C.pearl);   // the tip flops to the side, a glowing bead
  b.add(0, 34, 2.75, 7.6, 0.8, 0.4, C.stripe);
  b.g = 'body';
  const px = -6.2, pz = 2.9;                                                                             // the lantern pole in the left hand
  b.add(px, 0, pz, 1.2, 37, 1.2, C.wood); b.add(px, 37, pz + 1.6, 1, 1, 4.4, C.wood);
  const lz = pz + 3.6;
  b.add(px, 35, lz, 0.4, 2, 0.4, C.anchor);
  b.add(px, 34.2, lz, 3.6, 0.8, 3.6, C.anchor); b.add(px, 34.9, lz, 1.6, 0.6, 1.6, C.anchor);
  b.add(px, 29.6, lz, 2.8, 4.6, 2.8, C.lamp);
  b.add(px, 29.6, lz, 3.1, 4.6, 0.5, C.anchor); b.add(px, 29.6, lz, 0.5, 4.6, 3.1, C.anchor);
  b.add(px, 29, lz, 3.6, 0.6, 3.6, C.anchor);
  return b;
}

// ------------------------------------------------------------------ queen: a sea witch in a gown of kelp and dark water
function queen(C) {
  const b = new Vox();
  b.add(0, 0, 0, 15, 4, 11, C.water); b.add(0, 3.2, 0, 15.2, 0.8, 11.2, C.waveL);                        // the gown in three waves
  b.add(0, 4, 0, 12.6, 4, 8.8, C.water2); b.add(0, 7.2, 0, 12.8, 0.8, 9, C.waveL);
  b.add(0, 8, 0, 10.4, 4, 6.6, C.water); b.add(0, 11.2, 0, 10.6, 0.8, 6.8, C.waveL);
  for (const [x, z, y, h] of [[-5.4, 5.6, 0, 3.2], [-1.6, 5.6, 0, 3.2], [3.2, 5.6, 0, 3.2], [6, 5.6, 0, 3.2], [-4, 4.5, 4, 3.2], [1.4, 4.5, 4, 3.2], [4.4, 4.5, 4, 3.2], [-2.4, 3.4, 8, 3.2], [2.6, 3.4, 8, 3.2]]) b.add(x, y, z + 0.05, 1.2, h, 0.3, C.weed);   // kelp strands
  for (const [x, y, z] of [[-3, 2, 5.75], [4.6, 5.6, 4.65], [-1, 9.4, 3.55]]) b.add(x, y, z, 0.9, 0.9, 0.4, C.pearl);   // pearls on the gown
  mist(b, C, [[-6.4, 6.2, 2.4, 1.2], [5.2, 6, 2, 1.2]]);
  b.add(0, 12, 0, 8, 12, 4, C.weedD); b.add(0, 12, 2.15, 4, 9, 0.3, C.weed);
  b.add(0, 22, 0, 9, 1.2, 4.6, C.water2);
  for (const [x, y] of [[-2.6, 20.4], [-1.4, 19.2], [1.4, 19.2], [2.6, 20.4]]) b.add(x, y, 2.35, 1, 1, 0.4, C.pearl);   // a pearl necklace
  b.add(0, 17.4, 2.4, 1.8, 1.8, 0.5, C.glow);
  arms(b, C, { color: C.water2, y: 23, h: 10, hand: C.skin, w: 4 });
  b.g = 'body';                                                                                          // a driftwood staff with a glowing pearl
  b.add(6, 0, 2.6, 1.2, 28, 1.2, C.woodD);
  b.add(6, 28, 2.6, 3, 3, 3, C.pearl);
  for (const s of [-1, 1]) b.add(6 + s * 1.8, 27, 2.6, 0.6, 3, 0.6, C.coral);
  b.add(6, 31, 2.6, 0.6, 1.4, 0.6, C.coral);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, F.witch, fp(C, { m: C.coral }));
  b.add(0, 30.6, 0, 8.6, 1.8, 8.6, C.hair);                                                              // a fringe
  b.add(0, 12, -4.6, 9.6, 19, 1.8, C.hair);                                                              // long hair down the back
  for (const s of [-1, 1]) { b.add(s * 5.2, 24.4, 2, 0.8, 1, 0.8, C.pearl); b.add(s * 4.4, 20, 0, 1, 10, 6, C.hair); b.add(s * 4.6, 19, 1.4, 0.6, 7, 1, C.weed); }
  b.add(-2, 12.4, -5.6, 1, 15, 0.4, C.weed); b.add(2.2, 14, -5.6, 1, 12, 0.4, C.weed);
  b.add(0, 32.4, 0, 8.4, 1.2, 8.4, C.coral);                                                              // the coral diadem
  for (const [x, h] of [[-3.4, 2], [-1.8, 3], [0, 4.4], [1.8, 3], [3.4, 2]]) b.add(x, 33.6, 3.7, 0.9, h, 0.9, C.coral);
  b.add(-2.5, 35, 3.7, 1, 0.8, 0.8, C.coral); b.add(2.5, 35, 3.7, 1, 0.8, 0.8, C.coral);
  b.add(0, 38, 3.7, 1.4, 1.4, 1.4, C.pearl); b.add(0, 32.6, 4.3, 1.6, 1.4, 0.4, C.glow);
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ king: the ghost captain at the ship's wheel
function wheel(b, C, cy, cz) {
  b.add(0, cy + 4.4, cz, 5, 1.2, 1, C.wheel); b.add(0, cy - 5.6, cz, 5, 1.2, 1, C.wheel);                  // the rim, an octagon
  for (const s of [-1, 1]) b.add(s * 5, cy - 2.5, cz, 1.2, 5, 1, C.wheel);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.add(sx * 3.6, cy + sy * 3.6 - 1, cz, 2.2, 2, 1.2, C.wheel);
  b.add(0, cy - 0.4, cz, 9, 0.8, 0.6, C.wheelD); b.add(0, cy - 4.5, cz, 0.8, 9, 0.7, C.wheelD);              // spokes
  b.add(0, cy - 1.2, cz, 2.4, 2.4, 1.6, C.glow);                                                          // the hub
  for (const [x, y] of [[0, 5.6], [0, -7.2], [-6.4, -0.8], [6.4, -0.8]]) b.add(x, cy + y + (x ? 0 : y > 0 ? 0 : 0.6), cz, 1, 1, 0.8, C.glow);   // glowing handle tips
}
function king(C) {
  const b = new Vox();
  legs(b, C, { color: C.pants, boot: C.boots, bootH: 4 });
  for (const s of [-1, 1]) { b.g = sideTag('leg', s); b.add(s * 2, 3.4, 0.2, 4.8, 1.4, 5, C.hatL); }   // boot cuffs
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, C.coat);
  b.add(0, 6, 0, 9.4, 7, 5.2, C.coat); b.add(0, 6, -0.1, 9.6, 0.7, 5.4, C.mist);                         // the long coat skirt, a glowing hem
  b.add(0, 3, -2.8, 9, 10, 1, C.coat); for (const x of [-2.6, 1.4]) b.add(x, 2.8, -2.8, 1.4, 1, 1.1, C.coatD); b.add(0, 3.8, -2.8, 9.2, 0.5, 1.2, C.mist);   // coat tails, ragged
  b.add(0, 12.6, 0, 8.4, 1.6, 4.4, C.hat); b.add(0, 14.2, 0, 8.5, 0.4, 4.5, C.mist); b.add(0, 12.4, 2.3, 2.4, 2, 0.4, C.brass);                     // a belt with a buckle
  for (const s of [-1, 1]) for (const y of [15.4, 18, 20.6]) b.add(s * 2.2, y, 2.15, 1, 1, 0.3, C.brass);
  for (const s of [-1, 1]) { b.add(s * 5.4, 22, 0, 5, 1.6, 5, C.brass); b.add(s * 5.4, 20.6, 0, 5.2, 1.4, 5.2, C.brassD); }   // epaulettes
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);                                                                             // both hands on the wheel
    b.add(s * 6, 16, 0, 4, 8, 4, C.coat);
    b.add(s * 5.6, 14.6, 3, 3.6, 3.4, 6, C.coat); b.add(s * 5.6, 14.3, 4.8, 4.4, 4, 1.8, C.coatL); b.add(s * 5.6, 18.3, 4.8, 4.6, 0.6, 2, C.mist); b.add(s * 5.6, 13.9, 4.8, 4.6, 0.5, 2, C.mist);
    b.add(s * 4.6, 14.8, 6.8, 3, 3, 1.8, C.skin);
  }
  b.g = 'body';
  mist(b, C, [[-4.8, 3, 2.4, 1.6], [4.6, 2.6, 2, 1.4], [0, 3.6, 1.6, 1.2], [5, -2.6, 1.6, 2]]);
  wheel(b, C, 15.6, 6.4);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, F.capt, fp(C, { b: C.foam }));
  b.add(-1.6, 30.4, 4.3, 5, 0.6, 0.3, BLACK);                                                             // the eye patch strap
  b.add(0, 20.6, 4.6, 7.4, 5.6, 1.6, C.foam); b.add(0, 19.2, 4.8, 4.6, 1.6, 1.4, C.foam);                 // a beard of sea foam
  for (const s of [-1, 1]) { b.add(s * 3.7, 24, 2.6, 0.8, 3, 3.6, C.foam); b.add(s * 2.4, 26.2, 4.6, 3, 1, 0.8, C.foam); b.add(s * 4.2, 26.6, 4.6, 1, 1.6, 0.8, C.foam); }   // whiskers, a curly moustache
  for (const [x, y] of [[-2.4, 22.2], [1.6, 21.2], [2.8, 23.6], [-0.6, 19.8]]) b.add(x, y, 5.5, 0.8, 0.8, 0.3, C.glow);   // glowing bubbles in the foam
  b.add(0, 31.4, 0, 9, 3.6, 9, C.hat);                                                                   // the battered tricorn
  b.add(0, 32, 0, 15, 1, 13, C.hat); b.add(0, 31.4, 0, 15.2, 0.6, 13.2, C.mist);                         // a glowing hem on the brim
  for (const s of [-1, 1]) {
    b.add(s * 7, 32, -0.4, 1.2, 4.6, 11, C.hat); b.add(s * 7, 36.6, -0.4, 1.4, 0.6, 11.2, C.brassD);
    b.add(s * 4.7, 32, 4.9, 4, 4.2, 1.2, C.hat); b.add(s * 2.2, 32, 6.1, 2.4, 3.8, 1.2, C.hat);
    b.add(s * 4.7, 36.2, 4.9, 4.2, 0.6, 1.3, C.brassD);
  }
  b.add(0, 32, -6.2, 13, 4.6, 1.2, C.hat); b.add(0, 36.6, -6.2, 13.2, 0.6, 1.4, C.brassD);
  b.add(0, 32, 6.9, 1.6, 3.4, 1, C.hat);
  b.add(5.2, 33.4, 5.6, 1.4, 1.4, 0.3, C.hatL); b.add(-7.7, 34, 1, 0.3, 1.6, 1.6, C.hatL);                 // patches on the old hat
  b.add(0, 33.6, 7.45, 1.2, 1.2, 0.3, C.glow);
  b.add(0, 35, 0, 6.4, 1.4, 6.4, C.brass);                                                                // the crown on the hat
  for (const [x, z, h] of [[-2.6, 2.6, 2.6], [0, 2.6, 1.8], [2.6, 2.6, 2.6], [-2.6, -2.6, 2.6], [2.6, -2.6, 2.6], [-2.6, 0, 1.8], [2.6, 0, 1.8], [0, -2.6, 1.8]]) b.add(x, 36.4, z, 1.2, h, 1.2, C.brass);
  b.add(0, 35.2, 3.3, 1.4, 1, 0.3, C.glow);
  b.g = 'body';
  return b;
}

export const SKELCREW = { id: 'skelcrew', side: 'b', pal, build: { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king } };
