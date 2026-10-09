// Pixelwelt team wizards (CHE-372): the White side of ?pixteam=wizards, a bright wizard academy of our own design. Light robes in
// white, sky blue and silver with gold trim, glowing cyan crystals and yellow pixel stars. The cast: an apprentice with a floppy hat and
// a little wand (pawn), a walking stone tower with a friendly glowing face (rook), a battle mage on a white unicorn (knight), the tall
// star hat wizard with a long white beard and a crystal staff (bishop), an enchantress in a layered gown with a moon diadem, a crescent
// staff and floating light orbs (queen), the archmage king with a crown round his star hat, a long beard, a cape and a star staff (king).
// Boxes in the Vox format (front +z, y 0 the board, sizes in voxels); heroes.js scales every figure to the height ladder of set a.
import { Vox } from '../blocks/vox.js';
import { PAL } from './palette.js';
import { shade } from './shade.js';
import { legs, arms, paint, facePal, horse, holdSpear, sideTag } from './seta.js';

const GOLD = 0xf2c53a, GOLDD = 0xc99a22, STAR = 0xfff07a, CYAN = 0x5ff0ff, CYANL = 0xd8feff;
const WHITE = 0xf6f8fc, SNOW = 0xe2e8f2, SILVER = 0xc2cbd8, SKY = 0x7cc0f2, SKYD = 0x4f95e2, SKYL = 0xbfe2fa;
const PURPLE = 0x8a52d0, BEARD = 0xf6f6f8, BEARDD = 0xd8dce6, WOOD = 0xe6d6b4, BOOT = 0x8a6a4a;
const STONE = 0xe6eaf0, STONED = 0xbcc6d4;

// faces, 8 x 8, row 0 on top (letters as in seta.js, c a glowing cyan pixel)
const FACES = {
  apprentice: ['........', '........', '.bb..bb.', '.we..ew.', '.we..ew.', '........', '.m....m.', '..mmmm..'],
  sage: ['........', '........', 'bbb..bbb', '.we..ew.', '.we..ew.', '........', '........', '........'],
  stone: ['........', '........', '.cc..cc.', '.cc..cc.', '........', '.c....c.', '..cccc..', '........'],
  lady: ['........', '........', 'k......k', '.we..ew.', '.we..ew.', '........', '...mm...', '........'],
  mage: ['........', '........', 'bb....bb', '.we..ew.', '.we..ew.', '........', '..mmmm..', '........'],
};

/** A pixel star on a front face (facing +z): a row of three with one pixel above and below. y is the bottom of the middle row. */
function star(b, x, y, z, c = STAR, s = 1) {
  b.add(x, y, z, 3 * s, s, 0.3, c); b.add(x, y + s, z, s, s, 0.3, c); b.add(x, y - s, z, s, s, 0.3, c);
}
/** The same star on a side face (facing +x or -x). */
function starX(b, x, y, z, c = STAR, s = 1) {
  b.add(x, y, z, 0.3, s, 3 * s, c); b.add(x, y + s, z, 0.3, s, s, c); b.add(x, y - s, z, 0.3, s, s, c);
}
/** Stacks hat tiers [w, h, dx, dz, color] from y; returns the top. */
function tiers(b, y, list, z0 = 0) {
  let yy = y;
  for (const [w, h, dx = 0, dz = 0, c] of list) { b.add(dx, yy, z0 + dz, w, h, w, c); yy += h; }
  return yy;
}
/** A crystal of thin boxes (each min(w, d) <= 1.3 so it never widens the footprint): a diamond with a light core. */
function crystal(b, x, y, z, c = CYAN, l = CYANL) {
  b.add(x, y, z, 1.2, 4.2, 1.2, c); b.add(x, y + 1.2, z, 2.6, 1.8, 1.2, c); b.add(x, y + 1.2, z, 1.2, 1.8, 2.6, c);
  b.add(x, y + 1.6, z + 0.75, 0.6, 0.8, 0.3, l);
}

// ------------------------------------------------------------------ pawn: the apprentice
function apprentice(C) {
  const b = new Vox();
  legs(b, C, { color: SNOW, boot: BOOT, bootH: 2 });
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, SKY);                                                                      // a short robe
  b.add(0, 8, 0, 9, 5, 5, SKY); b.add(0, 8, 0, 9.2, 1, 5.2, WHITE);                                    // the skirt of the robe with a white hem
  b.add(0, 14, 0, 8.4, 1.2, 4.4, GOLD); b.add(0, 14, 2.3, 1.6, 1.2, 0.3, CYAN);                         // a belt with a glowing buckle
  b.add(0, 22.8, 0, 9, 1.2, 4.6, WHITE);                                                               // a collar
  star(b, -2, 18.5, 2.15, STAR);
  b.g = 'poseRest';                                                                                    // rest: left arm down, right arm forward with a wand
  b.add(-6, 13, 0, 4, 11, 4, SKY); b.add(-6, 13, 0, 4.4, 1.2, 4.4, WHITE); b.add(-6, 11, 0, 3.6, 2, 3.6, C.skin);
  b.add(6, 19, 0, 4, 5, 4, SKY); b.add(6, 17, 2.5, 4, 3, 5, SKY); b.add(6, 17, 5.2, 4.4, 3.2, 0.6, WHITE); b.add(6, 17, 7, 3.4, 3, 3, C.skin);
  b.add(6, 18, 8.8, 0.8, 0.8, 4, WOOD); b.add(6, 18, 11.4, 1.3, 1.3, 1.3, CYAN); b.add(6, 19.6, 12, 0.5, 0.5, 0.5, CYANL);   // the wand, pointing ahead
  holdSpear(b, C, SKY);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.apprentice, facePal(C, { b: C.hair }));
  b.add(0, 30, 0, 8.4, 2, 8.4, C.hair); b.add(0, 25, -4.1, 8.4, 5, 0.6, C.hair);                       // hair under the hat
  for (const s of [-1, 1]) b.add(s * 4.15, 27, -1, 0.6, 3, 6, C.hair);
  b.add(0, 31.2, 0, 8.8, 1.6, 8.8, WHITE); star(b, 0, 33.4, 3.45, GOLD, 0.6);                            // a small white cap with a blue tip and a gold star
  b.add(0, 32.8, -0.2, 7, 1.6, 7, WHITE); b.add(0.4, 34.4, -0.6, 4.6, 1.4, 4.6, SKYD); b.add(1, 35.8, -1, 2.6, 1.2, 2.6, SKYD);
  b.add(1.6, 37, -1.4, 1.2, 1.2, 1.2, STAR);
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ rook: the tower guardian
function towerGuardian(C) {
  const b = new Vox(), J = 0xa8b5c8;
  legs(b, C, { h: 5, w: 5, d: 5, x: 3.6, color: STONED, boot: J, bootH: 1.5 });
  b.g = 'body';
  b.add(0, 5, 0, 15, 19, 8, STONE); b.add(0, 5, 0, 12, 19, 11, STONE);                                 // a round tower (two crossed boxes)
  b.add(0, 5, 0, 15.3, 1, 8.3, J); b.add(0, 5, 0, 12.3, 1, 11.3, J);                                   // the plinth
  for (const [x, y, w] of [[-3.5, 8.4, 5], [3.5, 11.4, 5], [-4.5, 14.4, 3], [4.5, 17.4, 3], [-2.5, 17.4, 4], [2, 20.4, 5]]) b.add(x, y, 5.65, w, 0.5, 0.3, J);   // mortar lines
  for (const [x, y] of [[-1, 8.9], [5.5, 11.9], [-3, 14.9], [3, 17.9], [-4.5, 20.9]]) b.add(x, y, 5.65, 0.5, 2.5, 0.3, J);
  b.add(0, 6, 5.65, 5.4, 7, 0.4, GOLD); b.add(0, 6, 5.85, 4, 6, 0.3, SKYD); b.add(0, 12, 5.85, 2.4, 0.8, 0.3, SKYD);   // an arched door
  b.add(0, 7.4, 6.1, 2.4, 3, 0.3, CYAN); b.add(0, 10.4, 6.1, 1.2, 0.8, 0.3, CYANL);                     // its glowing window
  for (const s of [-1, 1]) { b.add(s * 7.65, 12, 0, 0.3, 4, 2, CYAN); b.add(s * 7.65, 16, 0, 0.3, 1, 1, CYAN); }   // slit windows on the sides
  b.add(0, 15.6, 5.65, 3, 1, 0.3, STAR); b.add(0, 16.6, 5.65, 1, 1, 0.3, STAR); b.add(0, 14.6, 5.65, 1, 1, 0.3, STAR);
  b.add(0, 6, -5.65, 4.2, 7.4, 0.3, GOLD); b.add(0, 6, -5.8, 3, 6, 0.3, 0x2f5fa8); b.add(0, 12, -5.8, 1.6, 0.8, 0.3, 0x2f5fa8);   // a dark blue arched back door
  b.add(0, 15, -5.65, 1, 3, 0.3, 0x5a6a80); for (const y of [14, 19, 21.6]) b.add(0, y, -5.65, 12.2, 0.5, 0.3, 0x9aa6b8);   // a slit window and stone courses on the back
  b.add(0, 23, 0, 16.4, 1.6, 12.4, J);                                                                 // a ledge round the shoulders
  for (const s of [-1, 1]) {                                                                           // stubby stone arms
    b.g = sideTag('arm', s);
    b.add(s * 10.3, 8, 0, 5, 15, 5.6, STONE); b.add(s * 10.3, 8, 0, 5.4, 3, 6, STONED); b.add(s * 10.3, 20.4, 0, 5.4, 2.4, 6, GOLD);
    b.add(s * 10.3, 20.8, 3.05, 1.4, 1.4, 0.3, CYAN);
  }
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, STONE);
  paint(b, 24, FACES.stone, facePal(C, { c: CYAN }));
  b.add(0, 32, 0, 12, 2.4, 12, J);                                                                      // the flat battlement on top: a 12 wide ring
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(x * 5, 34.4, z * 5, 2, 3, 2, STONE);   // four corner merlons
  b.add(0, 34.4, 0, 1, 5, 1, SILVER); b.add(2.5, 36.4, 0, 4, 3, 0.4, SKYD); b.add(2.5, 37.4, 0.25, 1, 1, 0.3, STAR);   // a pennant at the top centre
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ knight: the battle mage on a unicorn
function unicornRider(C) {
  const b = new Vox();
  const H = { ...C, horse: 0xfafaff, horseD: 0xdfe4f2, mane: 0x9fdcff, hoof: GOLD };
  horse(b, H, { cloth: SKYD, trim: GOLD });
  b.g = 'body';
  for (const s of [-1, 1]) { b.add(s * 3.75, 11.4, -0.5, 0.4, 5, 8, SKYD); b.add(s * 3.8, 11.4, -0.5, 0.4, 0.8, 8.2, GOLD); starX(b, s * 3.95, 13.6, -0.5); }   // the saddle cloth
  b.g = 'head';
  b.add(0, 22, 11.6, 1.8, 1.6, 1.8, GOLD); b.add(0, 23.6, 12, 1.3, 1.6, 1.3, WHITE); b.add(0, 25.2, 12.4, 1, 1.6, 1, GOLD); b.add(0, 26.8, 12.8, 0.6, 1.4, 0.6, WHITE);   // the horn
  b.add(0, 18, 4.6, 1.6, 6, 2, 0xc8b8ff); b.add(0, 21, 6.6, 1.6, 2.4, 2.4, 0x9fdcff);                  // a two colour mane
  b.g = 'tail';
  b.add(0, 6, -9.2, 2.4, 6, 2, 0xc8b8ff); b.add(0, 4.6, -9.6, 1.6, 2, 1.6, 0x9fdcff);
  b.g = 'rider';
  for (const s of [-1, 1]) { b.add(s * 4.2, 10, -1.2, 2.4, 7, 2.8, SKY); b.add(s * 4.2, 10, -0.6, 2.6, 2, 3.4, BOOT); }
  b.add(0, 17, -1.2, 6, 9, 3.4, SKY); b.add(0, 17, -1.2, 6.3, 1.2, 3.7, GOLD); b.add(0, 18.4, 0.6, 1.4, 6, 0.3, WHITE);   // robe and belt
  b.add(0, 15, -3.4, 7, 11, 1, WHITE); b.add(0, 25, -3.2, 7.6, 1.4, 1.4, GOLD);                       // a white cloak
  b.add(-4.2, 18, -0.2, 2.4, 7, 2.6, SKY); b.add(-4.2, 18, 1.6, 2.2, 2, 1.6, C.skin);                  // left arm at the reins
  b.add(4.8, 21, -0.6, 2.4, 5, 2.6, SKY); b.add(5.6, 19.6, -1, 2.4, 2.4, 2.4, C.skin);                // right arm with the staff, held beside and behind the head
  b.add(6.6, 12, -1, 0.9, 24, 0.9, WOOD); b.add(6.6, 35.4, -1, 1.3, 1, 1.3, GOLD); crystal(b, 6.6, 36.2, -1);
  b.add(0, 26, -1.2, 8, 8, 8, C.skin);                                                                 // the head
  const P = { add: (x, y, z, w, h, d, c) => b.add(x, y, z - 1.2, w, h, d, c) };
  const hair = 0x8a5a34;
  paint(P, 26, FACES.mage, facePal(C, { b: hair }), 8);
  b.add(0, 33, -1.2, 8.4, 1.2, 8.4, hair); b.add(0, 28, -5.35, 8.4, 5, 0.6, hair); b.add(0, 26, 2.95, 6, 1, 0.6, hair);   // hair and a short beard
  b.add(0, 34.4, -1.2, 10, 0.8, 10, SKY);                                                             // a pointed hat
  tiers(b, 35.2, [[6.6, 2.2, 0, 0, SKY], [5, 2.2, 0, -0.4, SKY], [3.4, 2, 0, -1, SKY], [1.8, 1.8, 0, -1.8, STAR]], -1.2);
  b.add(0, 35.2, -1.2, 6.8, 0.9, 6.8, GOLD); star(b, 0, 36.8, 2.25, STAR, 0.7);
  return b;
}

// ------------------------------------------------------------------ bishop: the star hat wizard
function starWizard(C) {
  const b = new Vox();
  b.add(0, 0, 0, 10.4, 12, 6.4, SKY); b.add(0, 0, 0, 10.6, 1.4, 6.6, GOLD);                          // a long robe over the feet
  star(b, -2.6, 6, 3.35); star(b, 2.4, 3.4, 3.35); b.add(2.6, 9, 3.35, 1, 1, 0.3, STAR);
  b.add(0, 12, 0, 8, 12, 4, SKY); b.add(0, 13, 0, 8.4, 1.2, 4.4, GOLD);
  b.add(0, 22.8, 0, 9.2, 1.4, 4.8, WHITE);
  arms(b, C, { color: SKY, w: 4, h: 10, hand: C.skin });
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 6, 15.6, 0, 4.6, 1.6, 4.6, WHITE); }
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.sage, facePal(C, { b: BEARD }));
  b.add(0, 27, 4.6, 1.6, 1.6, 1.2, C.skinD);                                                           // a nose
  b.add(0, 26, 4.5, 6.4, 1, 1, BEARD);                                                                 // the moustache
  b.add(0, 22, 4.5, 7.6, 4, 1.2, BEARD); b.add(0, 19, 4.3, 6, 3, 1.2, BEARD); b.add(0, 16.4, 4.1, 3.6, 2.6, 1.2, BEARD); b.add(0, 15, 3.9, 1.6, 1.4, 1.2, BEARDD);   // the long beard
  b.add(0, 25, -4.3, 8.4, 6, 0.8, BEARD); for (const s of [-1, 1]) b.add(s * 4.2, 25, -1, 0.6, 5, 6, BEARD);   // white hair
  b.add(0, 31.4, 0, 11.4, 1, 11.4, SKYD);                                                              // the wide brim
  b.add(0, 32.4, 0, 8.2, 1.4, 8.2, GOLD);
  tiers(b, 32.4, [[7.6, 3.4, 0, 0, SKYD], [6.2, 3.2, 0, -0.2, SKYD], [4.8, 3, 0, -0.5, SKYD], [3.4, 2.6, 0, -0.9, SKYD], [2.2, 2.2, 0, -1.6, SKYD], [1.2, 1.8, 0, -2.4, STAR]]);
  star(b, -1.6, 34.6, 3.95, STAR, 0.7); b.add(1.8, 34.4, 3.95, 0.8, 0.8, 0.3, STAR);                   // stars and a moon on the hat
  star(b, 1, 37.2, 3.05, STAR, 0.8);
  b.add(-0.8, 39.6, 2.05, 0.8, 1.8, 0.3, GOLD); b.add(-0.2, 39.4, 2.05, 0.8, 0.6, 0.3, GOLD); b.add(-0.2, 41.0, 2.05, 0.8, 0.6, 0.3, GOLD);
  starX(b, 3.95, 34.6, 0, STAR, 0.7); starX(b, -3.95, 34.6, 0, STAR, 0.7); starX(b, 3.25, 37.2, -0.2, STAR, 0.7); starX(b, -3.25, 37.2, -0.2, STAR, 0.7);
  b.g = 'body';                                                                                        // the crystal staff in the left hand
  b.add(-6, 0, 2.9, 1.2, 36, 1.2, WOOD); b.add(-6, 35, 2.9, 2.4, 1, 1.2, GOLD); b.add(-6, 35, 2.9, 1.2, 1, 2.4, GOLD); crystal(b, -6, 36, 2.9);
  return b;
}

// ------------------------------------------------------------------ queen: the enchantress
function enchantress(C) {
  const b = new Vox();
  b.add(0, 0, 0, 15, 3.4, 11, SKY); b.add(0, 0, 0, 15.2, 1, 11.2, GOLD);                              // a wide layered gown: sky blue tiers with white frills
  b.add(0, 3.4, 0, 13.6, 1.2, 9.8, WHITE); b.add(0, 4.6, 0, 13, 2.8, 9.2, SKY);
  b.add(0, 7.4, 0, 11.6, 1.2, 8, WHITE); b.add(0, 8.6, 0, 11, 2.2, 7.2, SKY);
  b.add(0, 10.8, 0, 9.6, 1.2, 5.8, WHITE);
  star(b, -4.6, 1.8, 5.65); star(b, 4.6, 1.8, 5.65); star(b, 0, 5.6, 4.75); b.add(-3.8, 9.4, 3.75, 1, 1, 0.3, STAR); b.add(3.8, 9.4, 3.75, 1, 1, 0.3, STAR);
  starX(b, -7.65, 1.8, 0); starX(b, 7.65, 1.8, 0);
  b.add(0, 12, 0, 8, 12, 4, SKY); b.add(0, 12, 2.15, 3.6, 9, 0.3, WHITE); b.add(0, 12, 0, 8.4, 1.2, 4.4, GOLD);   // the bodice
  b.add(0, 19.6, 2.3, 1.6, 1.6, 0.3, CYAN);
  b.add(0, 22.8, 0, 9.4, 1.2, 4.8, WHITE); b.add(0, 22, -2.4, 10, 3, 1, SKYL);                        // a high collar
  arms(b, C, { color: WHITE, y: 23, h: 10, hand: C.skin, w: 4 });
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 6, 15, 0, 4.6, 1.4, 4.6, SKYL); }
  b.g = 'body';                                                                                        // a crescent moon staff in the right hand
  b.add(6, 0, 2.9, 1, 34, 1, WOOD);
  b.add(6, 34, 2.9, 3.4, 1.2, 1, GOLD); b.add(4.1, 35, 2.9, 1.2, 2.8, 1, GOLD); b.add(7.9, 35, 2.9, 1.2, 2.8, 1, GOLD); b.add(4.7, 37.8, 2.9, 1, 1, 1, GOLD); b.add(7.3, 37.8, 2.9, 1, 1, 1, GOLD);
  b.add(6, 35.6, 2.9, 1.2, 1.2, 1.2, CYAN);
  b.add(-6.2, 27, 1.2, 2.2, 2.2, 2.2, CYAN); b.add(-6.2, 27.8, 2.45, 0.8, 0.8, 0.3, CYANL);             // a floating light orb
  b.add(0, 12, -2.6, 11, 11, 1.2, SKY); b.add(0, 12, -2.65, 11.2, 0.8, 1.3, GOLD);                      // a sky blue cape on the back
  b.g = 'head';
  const hair = C.hairQ;
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.lady, facePal(C, { b: hair, k: 0x3a2a40, m: 0xd86a7a }));
  b.add(0, 30.6, 0, 8.6, 1.8, 8.6, hair); b.add(0, 24, -4.6, 9.6, 7, 1.8, hair); b.add(0, 21, -4.4, 7, 3, 1.6, hair);   // fringe and hair, tapering
  for (const s of [-1, 1]) b.add(s * 4.4, 21, 0, 1, 9, 6, hair);
  b.add(0, 14, -4.1, 2.4, 7, 1.8, hair); for (const y of [15.6, 18]) b.add(0, y, -5.05, 2.6, 0.6, 0.3, shade(hair, 0.85));   // a braid down to the shoulder blades
  b.add(0, 13.2, -4.1, 2.8, 1.2, 2.2, SKYD); b.add(0, 13.4, -5.3, 1, 0.8, 0.3, CYAN);                  // its ribbon
  b.add(0, 32.4, 0, 8.8, 1.2, 8.8, GOLD);                                                              // the tall diadem with a moon
  for (const x of [-3.6, -1.8, 1.8, 3.6]) b.add(x, 33.6, 3.9, 1, Math.abs(x) > 2 ? 1.6 : 2.6, 1, GOLD);
  b.add(0, 33.6, 3.9, 1.4, 4, 1, GOLD); b.add(0, 34.4, 4.55, 1.2, 1.4, 0.3, CYAN);
  b.add(0, 37.6, 3.9, 2, 1, 1, GOLD); b.add(0, 38.2, 3.9, 3.8, 1, 1, STAR); for (const sx of [-1, 1]) b.add(sx * 1.4, 39.2, 3.9, 1, 1.8, 1, STAR);   // a crescent moon on the spire
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ king: the archmage king
function archmage(C) {
  const b = new Vox();
  b.add(0, 0, 0, 11.4, 12, 7.2, WHITE); b.add(0, 0, 0, 11.6, 1.4, 7.4, GOLD);                        // the grand robe
  b.add(0, 1.4, 3.65, 4, 10.6, 0.3, SKYD); star(b, 0, 5.4, 3.95); b.add(0, 9.6, 3.95, 1, 1, 0.3, STAR);
  b.add(0, 12, 0, 8, 12, 4, WHITE); b.add(0, 12, 2.15, 3.2, 10, 0.3, GOLD);
  b.add(0, 13, 0, 8.4, 1.4, 4.4, GOLDD); b.add(0, 13, 2.35, 1.6, 1.4, 0.3, CYAN);
  b.add(0, 1, -4.2, 12.4, 22, 1.2, SKYD); b.add(0, 1, -4.25, 12.6, 1, 1.3, GOLD);                    // the cape with gold edges
  for (const s of [-1, 1]) b.add(s * 6, 2, -4.25, 0.8, 20, 1.3, GOLD);
  for (const [x, y] of [[-3.6, 6], [3.2, 12], [-1, 17]]) { b.add(x, y, -4.95, 3, 1, 0.3, STAR); b.add(x, y + 1, -4.95, 1, 1, 0.3, STAR); b.add(x, y - 1, -4.95, 1, 1, 0.3, STAR); }
  b.add(0, 22, -1, 11, 2.4, 7, WHITE);                                                                // an ermine collar
  for (const x of [-4, -1.4, 1.4, 4]) b.add(x, 22.8, 2.55, 0.6, 0.8, 0.3, 0x30303a);
  arms(b, C, { color: WHITE, hand: C.skin });
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 6, 14, 0, 4.6, 1.6, 4.6, GOLD); }
  b.g = 'body';                                                                                        // the star staff in the right hand
  b.add(6, 0, 2.9, 1.2, 38, 1.2, WOOD); b.add(6, 37, 2.9, 2.2, 1, 1.2, GOLD);
  b.add(6, 39, 2.9, 5, 1.2, 1, GOLD); b.add(6, 37.8, 2.9, 1.2, 3.6, 1, GOLD); b.add(6, 41.4, 2.9, 1.2, 1.2, 1, GOLD); b.add(6, 39, 3.5, 1.2, 1.2, 0.3, CYAN);
  b.add(4.4, 37.6, 2.9, 1, 1, 1, GOLD); b.add(7.6, 37.6, 2.9, 1, 1, 1, GOLD);
  b.g = 'head';
  b.add(0, 24, 0, 8, 8, 8, C.skin);
  paint(b, 24, FACES.sage, facePal(C, { b: BEARD }));
  b.add(0, 27, 4.6, 1.6, 1.6, 1.2, C.skinD);
  b.add(0, 26, 4.5, 7, 1, 1, BEARD);
  b.add(0, 21.6, 4.6, 8, 4.4, 1.4, BEARD); b.add(0, 18, 4.4, 6.6, 3.6, 1.4, BEARD); b.add(0, 14.6, 4.2, 4.6, 3.4, 1.4, BEARD); b.add(0, 13, 4, 2.4, 1.6, 1.4, BEARDD);
  b.add(0, 25, -4.3, 8.4, 6, 0.8, BEARD); for (const s of [-1, 1]) b.add(s * 4.2, 25, -1, 0.6, 5.4, 6, BEARD);
  b.add(0, 31.2, 0, 9.6, 2.6, 9.6, GOLD); b.add(0, 31.2, 0, 9.8, 0.6, 9.8, GOLDD);                   // a tall gold crown with five points a side over a purple cap
  b.add(0, 33.8, 0, 7.6, 2.6, 7.6, PURPLE); b.add(0, 36.4, 0, 5, 1.2, 5, PURPLE);
  for (const [i, h] of [[-2, 4.6], [-1, 3.2], [0, 6], [1, 3.2], [2, 4.6]]) for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1]]) {
    const o = i * 2.1, e = sg * 4.2;
    if (ax === 0) b.add(o, 33.8, e, 1.2, h, 1.2, GOLD); else if (Math.abs(i) < 2) b.add(e, 33.8, o, 1.2, h, 1.2, GOLD);
  }
  b.add(0, 39.8, 4.2, 1.6, 1.6, 1.6, CYAN);                                                            // a gem on the tallest point
  b.add(0, 31.8, 4.95, 1.8, 1.4, 0.3, CYAN); b.add(-2.8, 32.2, 4.95, 1, 1, 0.3, 0xd8344a); b.add(2.8, 32.2, 4.95, 1, 1, 0.3, 0xd8344a);
  b.add(0, 37.6, 0, 1.6, 1.6, 1.6, GOLD); b.add(0, 39.2, 0, 1, 2.2, 1, GOLD); b.add(0, 40, 0, 2.4, 0.8, 1, GOLD);   // a little gold cross on the cap
  b.g = 'body';
  return b;
}

export const WIZARDS = {
  id: 'wizards', side: 'w',
  pal: { ...PAL.w, main: SKY, dark: SKYD, light: SKYL, skin: 0xf2c4a0, skinD: 0xd9a07c, hair: 0xc98a3e, hairQ: 0xf3d78a },
  build: { p: apprentice, n: unicornRider, b: starWizard, r: towerGuardian, q: enchantress, k: archmage },
};
