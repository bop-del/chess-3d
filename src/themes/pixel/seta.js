// Set a of the Pixelwelt figures (all twelve, drawn with the palette they are given; figures.js swaps four of them for the team
// figures of teams.js). Lists of boxes (the Vox format of ../blocks/vox.js, one voxel = one "pixel" of the figure).
// Proportions follow the blocky humanoid scheme: a cube head of 8 x 8 x 8 pixels with an 8 x 8 pixel face, a box body 8 x 12 x 4, box
// arms and legs 4 x 12 x 4 (so 32 pixels tall). Own designs: the White side is a blue kingdom (a trader, a stone guardian, an armoured
// knight on a horse, a robed cleric, a queen and a king), the Black side its red rivals (a shambling walker, a dark guardian, a rider,
// a bone archer, a queen and a king). The set stays close to the familiar archetypes (arms out like a walker, folded arms and a long
// nose on the trader, a skull faced archer). The face is painted pixel by pixel from the ASCII maps below. Front is +z, rig.js turns the figure.
import { Vox } from '../blocks/vox.js';
import { shade } from './shade.js';

const GOLD = 0xf2c53a, GOLD2 = 0xc99a22, BONE = 0xe8e4d2, BONE2 = 0xb9b5a2, WHITE = 0xffffff, BLACK = 0x1a1a22, EMBER = 0xff7a2a;
const sideTag = (name, s) => name + (s < 0 ? 'N' : 'P');

// ------------------------------------------------------------------ face maps (8 x 8, row 0 on top)
// letters: e dark eye, w white of the eye, k black, r red or ember, m mouth, n nose or cheek shade, b brow or hair, t tooth, x stitch
const FACE = {
  calm: ['........', '........', 'bbb..bbb', '.we..ew.', '.we..ew.', '........', '..mmmm..', '........'],
  stern: ['........', 'bb....bb', '.bb..bb.', '.ee..ee.', '.ew..we.', '........', '..mmmm..', '........'],
  grim: ['........', '.bb..bb.', '.kk..ke.', '.kk..kk.', '........', '...nn...', '.mmmmmm.', '..m..m..'],
  skull: ['........', '........', '.kk..kk.', '.kk..kk.', '...kk...', '........', '.tktktk.', '..t..t..'],
  stone: ['........', 'kkkkkkkk', '.rr..rr.', '.rr..rr.', '........', '...kk...', '..kkkk..', '........'],
  visor: ['........', 'kkkkkkkk', 'kkkkkkkk', 'krkkkkrk', '........', '........', '..mmmm..', '........'],
};

/** Paints the 8 x 8 face on the front of an 8 wide head whose base is at y0 and whose depth is d. */
function paint(b, y0, rows, pal, d = 8) {
  const z = d / 2 + 0.15;
  rows.forEach((row, r) => {
    let c = 0;
    while (c < 8) {
      const ch = row[c];
      if (ch === '.') { c++; continue; }
      let e = c; while (e < 8 && row[e] === ch) e++;
      if (pal[ch] !== undefined) b.add((c + e) / 2 - 4, y0 + 7 - r, z, e - c, 1, 0.3, pal[ch]);
      c = e;
    }
  });
}
const facePal = (C, extra = {}) => ({ e: 0x2a2018, w: WHITE, k: BLACK, r: 0xd23a2e, m: 0x8a4a3a, n: C.skinD, b: C.hair, t: BONE, x: 0x4a3a26, ...extra });

// ------------------------------------------------------------------ building blocks
function legs(b, C, o = {}) {
  const { h = 12, w = 4, d = 4, x = 2, color = C.iron, boot = C.boots, bootH = 2 } = o;
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    b.add(s * x, 0, 0, w, h, d, color);
    if (bootH) b.add(s * x, 0, 0.2, w + 0.3, bootH, d + 0.5, boot);
  }
  b.g = 'body';
}
function arms(b, C, o = {}) {
  const { y = 24, h = 12, w = 4, d = 4, x = 6, color = C.iron, hand = C.skin, handH = 2 } = o;
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * x, y - h, 0, w, h, d, color);
    if (handH) b.add(s * x, y - h, 0, w + 0.2, handH, d + 0.2, hand);
  }
  b.g = 'body';
}
function head(b, y, color, o = {}) { b.g = 'head'; b.add(0, y, 0, o.w || 8, o.h || 8, o.d || 8, color); }
const mitre = (b, y, main, trim, tiers = [[8, 8], [6.6, 6.6], [5, 5], [3.4, 3.4], [1.8, 1.8]]) => {
  let yy = y;
  tiers.forEach(([w, d], i) => { const h = i === 0 ? 1.6 : 2.2; b.add(0, yy, 0, w, h, d, i % 2 === 0 && i < 3 ? trim : main); yy += h; });
  return yy;
};
function crown(b, y, color = GOLD, o = {}) {
  const { w = 9, d = 9, tall = 3, gem = 0xd8344a } = o;
  b.add(0, y, 0, w, 1.8, d, color);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) b.add(x * (w / 2 - 0.5), y + 1.8, z * (d / 2 - 0.5), 1, x === 0 || z === 0 ? tall * 0.6 : tall, 1, color);
  b.add(0, y + 0.4, d / 2 + 0.15, 1.6, 1.2, 0.3, gem);
  return y + 1.8 + tall;
}

/** A rib cage that stands out of the chest: a dark recess, a sternum and rib bars from it, so single ribs read at board size.
 *  x, y: centre and bottom of the chest panel, z: the chest front. w wide, n ribs 1.8 apart. */
function ribcage(b, x, y, z, w, n, bone = BONE, dark = BLACK) {
  const gap = 1.8, h = n * gap + 0.4;
  b.add(x, y, z, w, h, 0.3, dark);                                                                      // the recess behind the ribs
  b.add(x, y + 0.2, z + 0.4, 1, h - 0.4, 0.8, bone);                                                    // the sternum
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) b.add(x + s * (w / 4 + 0.25), y + 0.4 + i * gap, z + 0.4, w / 2 - 0.5, 0.9, 0.8, bone);   // a rib each side
}

// ------------------------------------------------------------------ pawns
// Every pawn holds a spear in both hands in front of the body, point forward (CHE-219). The spear is its own rig group ('spear', not
// animated by rig.js) so the capture scene can slide it through the hands or throw it; the arms are part of the still body.
const WOOD = 0x8a5a30, STEEL = 0xd5dbe3, STEEL2 = 0x9aa3b0;
export const PAWN_UNIT = 0.0312;
/** The spear as [x, y bottom, z, w, h, d, color] in voxels, long axis +z (the front), shaft from z -9 to 10, head to 17.4. */
export const SPEAR = [
  [0, 17, 0.5, 1.6, 1.6, 19, WOOD], [0, 16.8, -9.3, 1.9, 2, 0.6, STEEL2],
  [0, 16.7, 10.7, 2.2, 2.2, 1.4, GOLD], [0, 16.8, 13.4, 1.8, 2, 4, STEEL], [0, 17.2, 16.4, 0.9, 1.2, 2, STEEL],
];
function holdSpear(b, C, sleeve) {
  b.g = 'body';
  for (const s of [-1, 1]) b.add(s * 5.6, 17, 0.4, 3, 7, 3, sleeve);                                    // upper arms at the sides
  b.add(-3.4, 16.3, 2.95, 4.2, 2.8, 3.9, sleeve); b.add(3.1, 16.3, 4.75, 2.6, 2.8, 7.5, sleeve);        // forearms: the rear one across, the front one forward
  b.add(0, 16.2, 3.5, 3.4, 3, 3, C.skin); b.add(0.8, 16.2, 8.2, 3.4, 3, 3.2, C.skin);                   // the two hands round the shaft
  b.g = 'spear';
  for (const p of SPEAR) b.add(...p);
  b.g = 'body';
}
function pawnW(C0) {
  const C = { ...C0, robe: shade(C0.robe, 1.15), robeD: shade(C0.robe, 1.0) };                          // a lighter robe, so the team gap survives greyscale
  const b = new Vox(0.0312);
  legs(b, C, { color: C.robeD, boot: C.boots, bootH: 0 });
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, C.robe);
  b.add(0, 12, 0, 8.4, 5, 4.4, C.robeD); b.add(0, 15, 0, 8.4, 1.2, 4.4, C.main);                        // a robe with a blue sash
  holdSpear(b, C, C.robe);
  head(b, 24, C.skin);
  b.add(0, 25, 5, 2, 4, 2, C.skinD);                                                                    // a long nose
  paint(b, 24, FACE.stern, facePal(C, { b: C.robeD }));
  b.add(0, 31.5, 0, 8.4, 0.6, 8.4, C.robeD);
  return b;
}
function pawnB(C) {
  const b = new Vox(0.0312);
  const rag = C.dark;                                                                                   // dark rags, for the same reason
  legs(b, C, { color: C.ironD, boot: C.boots, bootH: 1 });
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, rag);
  b.add(0, 12, 2.1, 6, 3, 0.3, C.skinD); b.add(-2, 19, 2.1, 3, 5, 0.3, C.dark);                        // torn cloth showing skin
  holdSpear(b, C, rag);
  head(b, 24, C.skin);
  paint(b, 24, FACE.grim, facePal(C, { r: EMBER, b: C.robeD }));
  b.add(0, 31, 0, 8.4, 1.2, 8.4, C.skinD); b.add(-3, 31, 3, 2, 1.4, 2, C.hair);                         // tufts of hair
  return b;
}

// ------------------------------------------------------------------ rooks
function guardian(C, side) {
  const b = new Vox(0.042), B = side === 'b';
  const stone = C.iron, seam = C.ironD;
  legs(b, C, { h: 8, w: 5, d: 5, x: 3.5, color: stone, boot: seam, bootH: 2 });
  b.add(0, 8, 0, 14, 10, 8, stone);                                                                     // a broad chest
  b.add(0, 8, 4.1, 14.2, 1.4, 0.4, seam); b.add(0, 13, 4.1, 14.2, 0.8, 0.4, seam); b.add(0, 8, -4.1, 14.2, 1.4, 0.4, seam);
  b.add(0, 9.4, 4.15, 6, 3.6, 0.3, C.main);                                                             // a banner on the chest
  b.add(0, 9.4, 4.4, 6.4, 0.6, 0.3, GOLD2);
  if (B) { b.add(-3, 10, 4.2, 1, 3, 0.3, EMBER); b.add(2, 14, 4.2, 3, 1, 0.3, EMBER); b.add(4, 11, 4.2, 1, 2, 0.3, EMBER); }   // glowing cracks
  for (const s of [-1, 1]) { b.g = sideTag('arm', s); b.add(s * 8.6, 3, 0, 4.4, 14, 5, stone); b.add(s * 8.6, 3, 0, 4.7, 2.4, 5.3, seam); b.add(s * 8.6, 16, 0, 4.8, 2, 5.4, seam); }
  b.g = 'head';
  b.add(0, 18, 0.5, 8, 8, 8, stone);
  paint(b, 18, FACE.stone, facePal(C, { r: B ? EMBER : 0x4fd0ff, b: seam }), 9);
  b.add(0, 19, 5.6, 2, 4, 2, seam);                                                                     // a heavy nose
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ knights (a horse and a rider)
function horse(b, C, o = {}) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.g = 'lg' + (sx < 0 ? 'N' : 'P') + (sz > 0 ? 'F' : 'B');
    b.add(sx * 2.4, 0, sz * 5.4, 3, 9, 3, C.horse); b.add(sx * 2.4, 0, sz * 5.4, 3.3, 2, 3.3, C.hoof);
  }
  b.g = 'body';
  b.add(0, 9, 0, 7, 7, 15, C.horse);
  b.add(0, 9, 0, 7.2, 2, 15.2, C.horseD);
  b.g = 'head';
  b.add(0, 13, 6, 4, 8, 4, C.horse);                                                                    // neck
  b.add(0, 17, 10.5, 4.6, 5, 8, C.horse); b.add(0, 17, 14.9, 4.8, 3, 0.4, C.horseD);                    // head and muzzle
  b.add(0, 16.6, 13.6, 4.8, 1.2, 3, C.horseD);
  for (const s of [-1, 1]) { b.add(s * 1.6, 22, 7.4, 1.2, 2, 1.2, C.horse); b.add(s * 2.35, 19, 12, 0.3, 1.4, 1.4, WHITE); b.add(s * 2.4, 19.2, 12.6, 0.3, 1, 0.8, BLACK); }
  b.add(0, 13, 4.2, 1.2, 9, 1.4, C.mane);                                                               // mane
  b.g = 'tail';
  b.add(0, 8, -8.4, 2, 7, 2, C.mane);
  b.g = 'body';
  b.add(0, 16, -0.5, 7.6, 1, 8, o.cloth);                                                               // blanket
  b.add(0, 16.2, -0.5, 7.8, 0.6, 8.2, o.trim || GOLD2);
}
function knightW(C) {
  const b = new Vox(0.0432);
  horse(b, C, { cloth: C.main, trim: GOLD2 });
  b.g = 'rider';
  for (const s of [-1, 1]) b.add(s * 4.2, 10, -1.2, 2.4, 7, 2.8, C.iron);                              // legs along the horse
  b.add(0, 17, -1.2, 6, 9, 3.4, C.iron); b.add(0, 19, 0.6, 4, 5, 0.3, C.main); b.add(0, 17, -1.2, 6.3, 1.2, 3.7, C.ironD);   // armour and tabard
  for (const s of [-1, 1]) { b.add(s * 4.2, 18, -0.2, 2.4, 7, 2.6, C.iron); b.add(s * 4.2, 18, 1.6, 2.2, 2, 1.6, C.skin); }
  b.add(0, 26, -1.2, 6.4, 6.4, 6.4, C.iron);                                                            // helmet over the head
  paint({ add: (x, y, z, w, h, d, c) => b.add(x * 0.8, y * 0.8, z * 0.8 - 1.2, w * 0.8, h * 0.8, d * 0.8, c) }, 26 / 0.8, FACE.visor, facePal(C), 8);
  b.add(0, 32.4, -1.2, 1.6, 2.4, 6.4, C.main); b.add(0, 34.4, -2.5, 1.6, 2, 3, C.main);                  // a plume
  return b;
}
function knightB(C) {
  const b = new Vox(0.0432);
  horse(b, C, { cloth: C.main, trim: C.dark });
  b.g = 'rider';
  for (const s of [-1, 1]) b.add(s * 4.2, 10, -1.2, 2.4, 7, 2.8, BONE2);
  b.add(0, 17, -1.2, 6, 9, 3.4, BONE);
  ribcage(b, 0, 18, 0.5, 4.8, 3);                                                                       // ribs
  for (const s of [-1, 1]) { b.add(s * 4.2, 18, -0.2, 2.4, 7, 2.6, BONE2); b.add(s * 4.2, 18, 1.6, 2.2, 2, 1.6, BONE); }
  b.add(0, 26, -1.2, 6.4, 6.4, 6.4, BONE);
  paint({ add: (x, y, z, w, h, d, c) => b.add(x * 0.8, y * 0.8, z * 0.8 - 1.2, w * 0.8, h * 0.8, d * 0.8, c) }, 26 / 0.8, FACE.skull, facePal(C, { r: EMBER }), 8);
  b.add(0, 32.4, -1.2, 6.8, 1.4, 6.8, C.dark); b.add(0, 33.8, -1.2, 1.4, 2.4, 1.4, C.main);             // a small red cap
  return b;
}

// ------------------------------------------------------------------ bishops
function bishopW(C) {
  const b = new Vox(0.0456), white = C.cloth;
  b.add(0, 0, 0, 10.4, 12, 6.4, white); b.add(0, 0, 0, 10.6, 1.4, 6.6, GOLD2);                          // a long robe over the feet
  b.add(0, 12, 0, 8, 12, 4, white); b.add(0, 12, 2.15, 2.4, 12, 0.3, C.main); b.add(0, 18, 2.2, 8.2, 1.2, 0.3, GOLD2);   // robe and a blue stole
  arms(b, C, { color: white, w: 4, h: 10, hand: C.skin });
  head(b, 24, C.skin);
  b.add(0, 25, 5, 2, 3.4, 2, C.skinD);
  paint(b, 24, FACE.calm, facePal(C, { b: 0xcfcfd6 }));
  b.add(0, 24, -4.3, 8.4, 4, 0.6, 0xdadae0);
  mitre(b, 32, C.main, GOLD);
  b.add(0, 34, 4.5, 1, 4, 0.4, GOLD); b.add(0, 36, 4.5, 3.2, 1, 0.4, GOLD);
  b.g = 'body';                                                                                         // a staff with a golden top, standing beside the figure
  b.add(-8.4, 0, 3, 1.2, 30, 1.2, C.robe); b.add(-8.4, 30, 3, 3.6, 1.4, 1.6, GOLD); b.add(-8.4, 31.4, 3, 1.2, 3, 1.2, GOLD);
  return b;
}
function bishopB(C) {
  const b = new Vox(0.0456);
  legs(b, C, { w: 3, d: 3, x: 2, color: BONE, boot: BONE2, bootH: 1 });
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, BONE2);
  ribcage(b, 0, 13.4, 2.15, 6.4, 5);
  arms(b, C, { color: BONE, w: 3, h: 10, x: 5.5, hand: BONE2 });
  head(b, 24, BONE);
  paint(b, 24, FACE.skull, facePal(C, { r: EMBER }));
  mitre(b, 32, C.main, C.dark);
  b.g = 'armP';                                                                                         // a bow in the right hand
  b.add(7, 4, 3.2, 1, 5, 1, C.robe); b.add(7, 8, 3.2, 1, 3, 1, 0x7a5a3a); b.add(7, 11, 3.2, 1, 5, 1, C.robe); b.add(6.2, 15, 3.2, 1, 4, 1, 0x7a5a3a); b.add(6.2, 1, 3.2, 1, 4, 1, 0x7a5a3a); b.add(5.6, 4, 3.2, 0.4, 12, 0.4, BONE2);
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ queens
function queen(C, side) {
  const b = new Vox(0.048), W = side === 'w';
  const gown = C.main, gown2 = C.dark;
  b.add(0, 0, 0, 14, 4, 10, gown2); b.add(0, 4, 0, 12, 4, 8.4, gown); b.add(0, 8, 0, 10, 4, 6.4, gown2); b.add(0, 0, 0, 14.2, 1, 10.2, GOLD);   // a wide gown
  b.add(0, 12, 0, 8, 12, 4, gown); b.add(0, 12, 2.15, 4, 8, 0.3, GOLD2); b.add(0, 22, 0, 9, 1.2, 4.6, W ? WHITE : C.light);
  arms(b, C, { color: gown2, y: 23, h: 10, hand: C.skin, w: 4 });
  const sk = W ? C.skin : 0xd6cbbd;
  head(b, 24, sk);
  paint(b, 24, FACE.calm, facePal(C, { b: C.hair, w: WHITE }));
  b.add(0, 30.6, 0, 8.6, 1.8, 8.6, C.hair);                                                             // a fringe
  b.add(0, 12, -4.6, 9.6, 19, 1.8, C.hair);                                                             // long hair down the back
  for (const s of [-1, 1]) b.add(s * 4.4, 20, 0, 1, 10, 6, C.hair);
  crown(b, 32, GOLD, { w: 9, d: 9, tall: 3.4 });
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ kings
function king(C, side) {
  const b = new Vox(0.0528), W = side === 'w';
  legs(b, C, { color: W ? C.dark : C.ironD, boot: C.boots, bootH: 2 });
  b.g = 'body';
  b.add(0, 12, 0, 8, 12, 4, W ? C.iron : C.ironD);
  b.add(0, 12, 2.15, 4.6, 10, 0.3, C.main); b.add(0, 12.6, 2.2, 8.2, 1.4, 0.3, GOLD2); b.add(0, 18, 2.4, 1.6, 1.6, 0.3, GOLD);   // a tabard and a belt
  b.add(0, 8, -2.6, 8.6, 15, 1.1, C.main); b.add(0, 22, -2.6, 9.6, 2, 1.6, W ? WHITE : C.light);        // a cape with a collar
  for (const s of [-1, 1]) b.add(s * 5.4, 22, 0, 5, 2, 5, C.ironD);                                      // pauldrons
  arms(b, C, { color: W ? C.iron : C.ironD, hand: C.skin });
  head(b, 24, W ? C.skin : 0xcfc6b8);
  paint(b, 24, FACE.stern, facePal(C, { b: C.hair, r: W ? 0x2a2018 : EMBER, e: W ? 0x2a2018 : 0xd23a2e }));
  b.add(0, 24, 4.4, 6, 2.6, 0.9, C.hair);                                                               // a beard
  b.add(0, 31.2, 0, 8.4, 1, 8.4, C.hair);
  const top = crown(b, 32, GOLD, { w: 9.4, d: 9.4, tall: 3 });
  b.add(0, top, 0, 1.4, 4, 1.4, GOLD); b.add(0, top + 1.6, 0, 4, 1.4, 1.4, GOLD); b.add(0, top + 1.6, 0, 1.6, 1.4, 1.6, 0xd8344a);   // a cross
  b.g = 'armP';
  b.add(6, 11.5, 1.4, 1.4, 5, 1.4, C.robe); b.add(6, 15.5, 1.4, 5, 1.2, 1.4, GOLD); b.add(6, 16.7, 1.4, 1.4, 12, 0.7, W ? WHITE : C.light);   // a sword
  b.g = 'body';
  return b;
}

const BUILD = {
  w: { p: pawnW, r: (C) => guardian(C, 'w'), n: knightW, b: bishopW, q: (C) => queen(C, 'w'), k: (C) => king(C, 'w') },
  b: { p: pawnB, r: (C) => guardian(C, 'b'), n: knightB, b: bishopB, q: (C) => queen(C, 'b'), k: (C) => king(C, 'b') },
};

/** The box list of one set a figure: color 'w' or 'b', type p, n, b, r, q or k. */
export function buildSetA(color, type, palette) {
  return BUILD[color][type](palette);
}

// the helpers the team figures reuse
export { legs, arms, paint, facePal, horse, ribcage, FACE, BONE, BONE2, BLACK, EMBER, sideTag };
