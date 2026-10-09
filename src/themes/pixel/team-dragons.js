// Pixelwelt team dragons (CHE-372, Black of ?pixteam=dragons): a dragon brood of our own design, majestic and cool, never scary.
// Dark charcoal and deep crimson scales, dark purple wing membranes, glowing orange ember eyes and belly plates, small bone horns,
// little puffs of smoke. Humanoid dragonkin: the 8 cube head carries a snout box in front, horns, cheek frills and head spines.
// Cast: a hatchling with egg shell bits as a helmet (pawn), a broad stone scaled guardian with a smoking rock fortress on its back
// (rook), a dragonkin rider on a young four legged dragon (knight), a sage with tall swept back horns and an ember staff (bishop),
// the queen in a gown of scales with a spread wing collar and a horn diadem (queen), the king with half open wings, a crown of
// horns and an ember sceptre (king).
// Format: Vox box lists as in seta.js (front +z, y up, sizes in voxels, rig tags per box); heroes.js scales every figure.
import { Vox } from '../blocks/vox.js';
import { PAL } from './palette.js';
import { paint, holdSpear, sideTag } from './seta.js';

// ------------------------------------------------------------------ colours
const SCALE = 0x3a3442, SCALE_D = 0x27232e, SCALE_L = 0x4c4556;                      // charcoal scales
const RED = 0x86202c, RED_D = 0x5e1620, RED_L = 0xa82a34;                             // deep crimson scales
const WING = 0x3e2252, WING_D = 0x2a173a, WING_L = 0x553070;                          // purple wing membranes
const BELLY = 0xe0802a, BELLY_D = 0xa8521c;                                           // glowing ember belly plates
const HORN = 0xbcaa8a, HORN_D = 0x8a7a62;                                             // bone horns and claws
const EYE = 0xffb82e, PUPIL = 0x1a0f0a, MOUTH = 0x2a0f12, TOOTH = 0xf0e8d4, EMBER = 0xff6a1a, FLAME = 0xffd25a;
const GOLD = 0xd8a030, GOLD_D = 0x9a6c1e, STONE = 0x6a6474, STONE_D = 0x524c5c, SMOKE_L = 0x77727e;
const SHELL = 0xb8ad94, SHELL_D = 0x8a8068, LEATHER = 0x3a2a22, WOOD = 0x4a3222;
const WHISKER = 0xc8c0b0;

// ------------------------------------------------------------------ faces (8 x 8, row 0 on top; the snout covers rows 4 to 7)
// y glowing eye, k slit pupil, b brow ridge, l lash
const FACES = {
  kind: ['........', '........', '.bb..bb.', '.yy..yy.', '.yk..ky.', '........', '........', '........'],
  bold: ['........', 'bb....bb', '.bbb.bb.', '.yy..yy.', '.yk..ky.', '........', '........', '........'],
  wise: ['........', 'b.b..b.b', '.bb..bb.', '.yy..yy.', '.ky..yk.', '........', '........', '........'],
  queen: ['........', 'l.l..l.l', '.ll..ll.', '.yy..yy.', '.yk..ky.', '........', '........', '........'],
  king: ['........', 'bbb..bbb', '..bb.bb.', '.yy..yy.', '.yk..ky.', '........', '........', '........'],
};
const FP = { y: EYE, k: PUPIL, b: SCALE_D, l: 0x14101a };

/** A builder that shifts (and scales) everything it adds: paint() and friends on a head that is not at the origin. */
const off = (b, dx, dy, dz, s = 1) => ({ add: (x, y, z, w, h, d, c) => b.add(x * s + dx, y * s + dy, z * s + dz, w * s, h * s, d * s, c) });

/** A dragonkin head in rig group 'head': the 8 cube with a painted face, a snout with nostrils and two little fangs, swept back
 *  horns, cheek frills and a crest of spines. Base at (0, y, z), scale s. Returns the builder for extra head parts. */
function dragonHead(b, y, z, o = {}) {
  const { s = 1, skin = SCALE, snout = skin, jaw = RED_L, frill = RED, face = FACES.kind, horn = HORN, horns = true, crest = true } = o;
  b.g = 'head';
  const h = off(b, 0, y, z, s);
  h.add(0, 0, 0, 8, 8, 8, skin);
  paint(h, 0, face, FP);
  h.add(0, 0.6, 5.6, 6, 3.4, 3.2, snout);                                                       // the snout, z 4 to 7.2
  h.add(0, 0.2, 5.5, 5.4, 1.2, 3.2, jaw);                                                       // a lighter lower jaw
  for (const k of [-1, 1]) {
    h.add(k * 1.5, 3.1, 7.35, 1, 0.7, 0.3, PUPIL);                                              // nostrils
    h.add(k * 1.7, 0.85, 7.25, 0.8, 0.9, 0.3, TOOTH);                                           // two little fangs
    h.add(k * 4.6, 3.4, -0.6, 1.2, 2.6, 3, frill);                                              // cheek frills
    h.add(k * 5.4, 4.6, -1.4, 1, 2, 2, frill);
    if (horns) {                                                                                // horns, swept back
      h.add(k * 2.6, 7.6, -1.2, 1.8, 2, 2, horn);
      h.add(k * 2.9, 9.2, -2.6, 1.4, 1.8, 1.8, horn);
      h.add(k * 3.1, 10.6, -3.9, 1, 1.6, 1.6, HORN_D);
    }
  }
  h.add(0, 1.65, 7.25, 4.4, 0.5, 0.3, MOUTH);                                                   // a little smile line
  if (crest) { h.add(0, 7.6, 1.4, 1, 1.4, 2, frill); h.add(0, 7.6, -1.6, 1, 2, 2, frill); h.add(0, 5, -4.4, 1, 2.4, 1, frill); h.add(0, 1.6, -4.4, 1, 2, 1, frill); }
  return h;
}

/** Belly plates on a chest front at z: bands from y up, n bands, w wide, glowing and darker in turn. */
function belly(b, y, z, w, n, gap = 1.8) {
  for (let i = 0; i < n; i++) b.add(0, y + i * gap, z, w - (i % 2) * 0.6, gap - 0.4, 0.3, i % 2 ? BELLY_D : BELLY);
}

/** One wing behind the figure: two large panels in one colour from |x| x0 to x1 at depth z, the top edge from yt0 (inside) to
 *  yt1 (outside), the bottom edge from yb0 to yb1 with one scallop step per panel, an arm bone along the top and a single finger
 *  bone, both on the front face only. k is the side. All membranes are thin. */
function wing(b, k, o) {
  const { x0, x1, yt0, yt1, yb0, yb1, z, mem = WING_L, d = 1 } = o;
  const xm = (x0 + x1) / 2, cw = (x1 - x0) / 2, f = z + d / 2 + 0.15;
  for (let i = 0; i < 2; i++) {
    const t = i === 0 ? 0.3 : 0.85, top = yt0 + (yt1 - yt0) * t, bot = yb0 + (yb1 - yb0) * t, xc = x0 + cw * (i + 0.5);
    b.add(k * xc, bot + 1.3, z, cw, top - bot - 1.3, d, mem);                                    // the panel
    b.add(k * (xc + cw / 4), bot, z, cw / 2, 1.4, d, mem);                                       // one scallop step on the bottom edge
    b.add(k * xc, top - 1, f, cw + 0.2, 1, 0.3, HORN);                                            // the arm bone along the top
  }
  const yb = yb0 + (yb1 - yb0) * 0.6, yt = yt0 + (yt1 - yt0) * 0.55;
  b.add(k * xm, yb, f, 1, yt - yb, 0.3, HORN_D);                                                  // the finger bone
}

/** A tail in rig group 'tail', from the back at (y, z) out behind, n segments, ending in a spade. */
function tail(b, y, z, segs, color = RED, tip = RED_D) {
  b.g = 'tail';
  let zz = z;
  for (const [w, dy, len] of segs) { b.add(0, y + dy, zz - len / 2, w, w, len, color); zz -= len - 0.2; }
  const last = segs[segs.length - 1];
  b.add(0, y + last[1] + last[0] / 2 - 0.6, zz - 0.6, 3.4, 1.2, 1.6, tip);                     // the spade tip
  b.add(0, y + last[1] + last[0] / 2 - 0.5, zz - 1.6, 1.8, 1, 1, tip);
  b.g = 'body';
}

// ------------------------------------------------------------------ pawn: a little hatchling with egg shell bits as a helmet
function pawn(C) {
  const b = new Vox();
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    b.add(s * 2.2, 0, 0, 3.4, 8, 3.8, RED_D);                                                    // short stubby legs
    b.add(s * 2.3, 0, 0.9, 4, 1.6, 5.4, RED_D);                                                  // feet
    for (const x of [-1, 1]) b.add(s * 2.3 + x * 1.2, 0, 3.85, 0.8, 0.9, 0.6, HORN);            // toe claws
  }
  b.g = 'body';
  b.add(0, 8, 0, 9, 14, 5.6, RED);                                                               // a chubby body
  belly(b, 9.3, 2.95, 5.6, 6);
  for (const s of [-1, 1]) wing(b, s, { x0: 1, x1: 5.2, yt0: 22, yt1: 24.4, yb0: 15.6, yb1: 18, z: -3.3 });   // tiny wings
  tail(b, 9, -2.8, [[3, 0, 3], [2.4, -1.6, 3], [1.8, -3.4, 2.6]]);
  b.g = 'poseRest';                                                                              // little arms held up in front, claws out
  for (const s of [-1, 1]) {
    b.add(s * 5.4, 16.6, 0.4, 2.6, 4.4, 3, RED);
    b.add(s * 5.2, 15.2, 2.6, 2.4, 2.4, 4.2, RED);
    b.add(s * 5.2, 15.0, 5.1, 2.6, 1.2, 1, HORN);
  }
  holdSpear(b, C, RED);
  dragonHead(b, 22, 0, { skin: RED, jaw: BELLY_D, frill: RED_D, face: FACES.kind, horns: false, crest: false });
  b.g = 'head';                                                                                  // the egg shell helmet, jagged rim
  b.add(0, 28.8, 0, 9, 2.6, 9, SHELL);
  for (const [x, z] of [[-3.6, 4.2], [-0.4, 4.2], [2.8, 4.2], [-2, -4.2], [1.4, -4.2], [4.2, -2], [4.2, 1.6], [-4.2, -0.8], [-4.2, 2.6]]) {
    const ax = Math.abs(x) > 4 ? 0.6 : 1.6, az = Math.abs(z) > 4 ? 0.6 : 1.6;
    b.add(x, 31.4, z, ax, 1.4, az, SHELL);
  }
  b.add(-2.2, 30, 4.65, 1.6, 1, 0.3, SHELL_D); b.add(2.4, 29.4, 4.65, 1, 1.2, 0.3, SHELL_D);   // speckles
  for (const k of [-1, 1]) { b.add(k * 2.4, 31.4, -0.6, 1.4, 2, 1.4, HORN); b.add(k * 2.6, 33.2, -1.2, 1, 1, 1, HORN_D); }   // nub horns through the shell
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ rook: a broad stone scaled guardian with a smoking rock fortress on its back
function rook() {
  const b = new Vox();
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    b.add(s * 4.2, 0, 0.5, 5.6, 8, 6.4, SCALE);
    b.add(s * 4.2, 0, 1.6, 6.2, 2, 7.8, SCALE_D);
    for (const x of [-1.8, 0, 1.8]) b.add(s * 4.2 + x, 0, 5.75, 1, 1.2, 0.8, HORN);
  }
  b.g = 'body';
  b.add(0, 7, 0, 16, 13, 10, SCALE);                                                             // a broad body
  belly(b, 8.3, 5.15, 9, 6);
  for (const s of [-1, 1]) b.add(s * 4.6, 9.4, 0, 1.8, 10.8, 10.4, LEATHER);                   // straps of the fortress
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 10, 12, 0.4, 5, 8, 6.4, SCALE_L); b.add(s * 10.3, 5, 1, 5.2, 8, 6, SCALE);
    b.add(s * 10.3, 3, 1.4, 5.8, 3, 6.6, SCALE_D);                                               // big fists
    for (const z of [-1.6, 0.4, 2.4]) b.add(s * 10.3, 2.4, 1.4 + z, 4, 1, 1, HORN);            // knuckle claws
    b.add(s * 10.2, 18.6, 0.4, 5.6, 2, 7, STONE_D);                                              // stone shoulder plates
  }
  dragonHead(b, 17, 2.4, { skin: SCALE, jaw: SCALE_L, frill: RED, face: FACES.bold });
  b.g = 'body';
  b.add(0, 10, -9, 15, 26, 8, STONE);                                                            // the rock fortress, well above the horns
  for (const [y, x] of [[13.5, -2], [17.5, 2.4], [21.5, -1.5], [25.5, 2.5], [29.5, -2.2], [33.2, 1.8]]) b.add(x, y, -9, 9, 0.6, 8.3, STONE_D);   // block seams
  for (const s of [-1, 1]) for (const y of [26.6, 31]) { b.add(s * 5.4, y, -4.85, 3, 3, 0.3, PUPIL); b.add(s * 5.4, y + 0.5, -4.7, 2, 2, 0.3, EMBER); }   // ember windows at the front corners
  for (const s of [-1, 1]) { b.add(s * 7.65, 22, -10, 0.3, 3, 3, PUPIL); b.add(s * 7.8, 22.5, -10, 0.3, 2, 2, EMBER); }   // and on the sides
  for (const [x, y] of [[-3.6, 16], [3.6, 16], [0, 22], [-3.6, 28], [3.6, 28]]) { b.add(x, y, -13.15, 3, 3, 0.3, PUPIL); b.add(x, y + 0.5, -13.3, 2, 2, 0.3, EMBER); }   // windows on the back
  b.add(0, 36, -9, 16.4, 1.6, 9.4, STONE_D);                                                     // the platform
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) b.add(x * 7.2, 37.6, -9 + z * 3.7, 2, 2.6, 2, STONE);   // battlements
  b.add(-1, 37.6, -9, 3, 1, 3, EMBER);                                                           // a fire inside the fortress
  b.add(-1.6, 38.6, -9.4, 4, 2.6, 4, SMOKE_L); b.add(0.8, 40.4, -10, 3, 2.2, 3, SMOKE_L);        // a round puff of smoke
  return b;
}

// ------------------------------------------------------------------ knight: a dragonkin rider on a young four legged dragon
function mount(b) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.g = 'lg' + (sx < 0 ? 'N' : 'P') + (sz > 0 ? 'F' : 'B');
    b.add(sx * 2.8, 0, sz * 5, 3, 8, 3.4, RED_D);
    b.add(sx * 2.8, 0, sz * 5 + 0.5, 3.4, 1.4, 4.2, SCALE_D);
    for (const x of [-1, 1]) b.add(sx * 2.8 + x, 0, sz * 5 + 2.85, 0.7, 0.8, 0.6, HORN);
  }
  b.g = 'body';
  b.add(0, 7, 0, 8, 7, 14, RED);                                                                 // the body
  b.add(0, 6.6, 0.4, 6.4, 1.6, 12.6, BELLY_D);                                                   // the belly plates underneath
  for (const z of [-2, 0, 2, 4]) b.add(0, 6.5, z, 6.6, 1.2, 1, BELLY);
  b.add(0, 14, -0.8, 8.4, 1, 6.4, LEATHER); b.add(0, 13.4, -0.8, 8.6, 0.6, 6.6, GOLD_D);         // the saddle
  for (const z of [-5, -6.6]) b.add(0, 14, z, 1, 1.4, 1, HORN_D);                               // back spines
  for (const k of [-1, 1]) {                                                                     // one raised wing per side, sloping back and up
    b.add(k * 4.5, 12.4, -5.8, 0.8, 7, 6, WING_L);
    b.add(k * 4.5, 19.4, -7.2, 0.8, 3, 3.2, WING_L);
    b.add(k * 4.55, 13.4, -2.6, 1.1, 1.2, 1.2, HORN); b.add(k * 4.55, 18.6, -5.6, 1.1, 1.2, 4, HORN); b.add(k * 4.55, 21.6, -8.2, 1.1, 1.2, 1.6, HORN);   // the arm bone
  }
  b.g = 'head';
  b.add(0, 11, 7.4, 4.4, 6, 4, RED);                                                             // the neck, rising forward
  b.add(0, 15.4, 9, 4, 4.6, 4, RED);
  for (const z of [7.4, 9.6]) b.add(0, 13.8 + (z - 7.4), z - 2.1, 1, 1.6, 1, HORN_D);           // neck spines
  b.add(0, 18, 11.6, 7, 5.6, 6.4, RED);                                                          // the head, z 8.4 to 14.8
  b.add(0, 18.2, 16, 5, 3, 3.4, RED); b.add(0, 17.8, 15.8, 4.6, 1.2, 3.2, BELLY_D);              // snout and jaw
  for (const k of [-1, 1]) {
    b.add(k * 2, 21.4, 14.95, 2, 2, 0.3, EYE); b.add(k * 1.5, 21.6, 15.1, 0.6, 1.6, 0.3, PUPIL);   // eyes on the front
    b.add(k * 3.65, 21.4, 12.6, 0.3, 2, 2, EYE); b.add(k * 3.8, 21.6, 12.9, 0.3, 1.6, 0.6, PUPIL);       // and on the sides
    b.add(k * 1.2, 20.4, 17.75, 0.8, 0.6, 0.3, PUPIL);                                                   // nostrils
    b.add(k * 1.3, 18.2, 17.55, 0.7, 0.9, 0.3, TOOTH);                                                   // fangs
    b.add(k * 2.2, 23.4, 10, 1.4, 1.8, 2, HORN); b.add(k * 2.4, 24.6, 8.4, 1, 1.4, 2, HORN_D);              // horns
    b.add(k * 4.1, 19.4, 9.6, 1.2, 2.4, 2.4, RED_D);                                                     // cheek frills
  }
  b.add(0, 19.4, 17.85, 3.2, 0.5, 0.3, MOUTH);
  b.g = 'tail';                                                                                  // a tail that curls up into a spade
  b.add(0, 10.4, -8.2, 3, 3, 2.8, RED); b.add(0, 11.8, -10.2, 2.4, 2.6, 2, RED);
  b.add(0, 14, -11, 2, 2.6, 1.8, RED); b.add(0, 16.4, -11.2, 3.4, 2.4, 0.8, RED_D); b.add(0, 18.6, -11.2, 1.6, 1.4, 0.8, RED_D);
  b.g = 'body';
}
function knight() {
  const b = new Vox(), s = 0.8, zr = -1.4;
  mount(b);
  b.g = 'rider';
  for (const k of [-1, 1]) { b.add(k * 4.6, 10.4, zr + 1, 2.2, 5, 2.8, SCALE); b.add(k * 4.7, 10, zr + 2, 2.4, 1.6, 3.6, SCALE_D); }   // legs and feet
  b.add(0, 15, zr, 6.4, 8, 4, RED_L);                                                            // a crimson tunic
  belly(off(b, 0, 0, zr), 15.6, 2.15, 4, 3);
  b.add(0, 21.4, zr, 7, 2, 4.6, BELLY);                                                          // a bright ember collar
  b.add(0, 14, zr - 2.6, 6.4, 9.6, 1, RED);                                                      // a short cape
  for (const k of [-1, 1]) { b.add(k * 4.2, 17.4, zr + 2, 2.2, 5, 2.4, RED_L); b.add(k * 3.6, 17.4, zr + 4.4, 2.2, 2, 2.6, SCALE_L); }   // arms at the reins
  b.add(0, 18, zr + 5.6, 5.2, 0.5, 0.5, LEATHER); b.add(0, 18.6, 9.4, 4.8, 0.5, 0.5, LEATHER);   // reins
  const y0 = 23.4, rz = zr;
  dragonHead(b, y0, rz, { s, skin: SCALE_L, jaw: RED_L, frill: RED, face: FACES.bold });
  b.g = 'rider';
  b.add(0, y0 + 6.4, rz - 0.6, 0.8, 1, 5, EMBER);                                                // a glowing crest
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ bishop: a sage with tall swept back horns and an ember staff
function bishop() {
  const b = new Vox();
  b.add(0, 0, 0, 11, 6, 7.6, WING); b.add(0, 6, 0, 10, 6, 6.6, WING_L);                        // a long deep purple robe in two tiers
  b.add(0, 0, 0, 11.2, 1.4, 7.8, RED);                                                          // a crimson hem
  b.add(0, 12, 0, 8, 12, 4.4, WING_L); b.add(0, 12, 0, 8.4, 1.4, 4.8, RED_D);                   // body and sash
  b.add(0, 13.4, 2.35, 2.6, 10.6, 0.3, RED_L);                                                  // a light crimson stole with ember beads
  for (const y of [15, 18, 21]) b.add(0, y, 2.6, 1.2, 1.2, 0.3, EMBER);
  for (const s of [-1, 1]) wing(b, s, { x0: 1, x1: 5.6, yt0: 24, yt1: 27, yb0: 14, yb1: 18, z: -2.9, mem: RED_D });   // folded wings
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 6, 13, 0, 4, 11, 4.4, WING_L); b.add(s * 6, 12, 0.2, 4.8, 2.2, 5, WING);         // wide sleeves
    b.add(s * 6, 10.8, 0.4, 3, 1.8, 3, SCALE_L);
  }
  b.g = 'armN';                                                                                  // the staff with an ember on top
  b.add(-6, 0, 2.8, 1.2, 30, 1.2, WOOD);
  b.add(-6, 29.4, 2.8, 3.2, 1, 3.2, HORN_D);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(-6 + x * 1.3, 30.4, 2.8 + z * 1.3, 0.6, 2.4, 0.6, HORN);
  b.add(-6, 30.6, 2.8, 2.4, 2.4, 2.4, EMBER); b.add(-6, 31.2, 2.8, 1.2, 1.2, 2.7, FLAME);
  b.g = 'body';
  dragonHead(b, 24, 0, { skin: SCALE, jaw: SCALE_L, frill: RED, face: FACES.wise, horns: false });
  b.g = 'head';
  for (const k of [-1, 1]) {
    b.add(k * 3.2, 21.6, 6.4, 0.6, 4.2, 0.6, WHISKER); b.add(k * 3.2, 20.4, 7, 0.6, 1.6, 0.6, WHISKER);   // long whiskers
    // tall horns that rise and meet at the top like a mitre
    b.add(k * 2.8, 31.6, -0.4, 2.2, 3.4, 2.2, HORN);
    b.add(k * 2.3, 35, -0.9, 1.9, 3.2, 1.9, HORN);
    b.add(k * 1.7, 38.2, -1.4, 1.6, 3, 1.6, HORN);
    b.add(k * 1, 41.2, -1.9, 1.2, 2.2, 1.2, HORN_D);
  }
  b.add(0, 31.6, -0.6, 1, 7, 4, RED); b.add(0, 38.6, -1.2, 1, 2.6, 2.6, RED_D);                 // a crimson crest between the horns
  b.add(0, 32.2, 4.15, 1.8, 1.8, 0.3, EMBER);                                                    // a glowing gem on the brow
  b.add(0, 22.4, 6.2, 2, 1.8, 1, WHISKER);                                                         // a little beard
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ queen: a gown of scales, a spread wing collar, a horn diadem
function queen() {
  const b = new Vox();
  b.add(0, 0, 0, 15, 4, 10.6, RED_D); b.add(0, 4, 0, 13, 4, 9, RED); b.add(0, 8, 0, 10.6, 4, 7.2, RED_D);   // a wide tiered gown
  b.add(0, 0, 0, 15.2, 1, 10.8, GOLD_D);
  for (const [x, y, z] of [[-5, 1.6, 5.35], [-1.6, 2.2, 5.35], [2, 1.6, 5.35], [5.4, 2.2, 5.35], [-4, 5.4, 4.55], [0, 5.6, 4.55], [4, 5.4, 4.55], [-2, 9.2, 3.65], [2, 9.4, 3.65]]) b.add(x, y, z, 2, 1.2, 0.3, SCALE_D);   // scale pattern
  b.add(0, 12, 0, 8, 12, 4, SCALE); belly(b, 12.6, 2.15, 4.4, 4);                               // a bodice with ember plates
  b.add(0, 21.2, 2.2, 6, 0.8, 0.4, GOLD); b.add(0, 19.6, 2.45, 1.6, 1.6, 0.4, EMBER);           // a necklace with an ember gem
  for (const s of [-1, 1]) b.add(s * 5.4, 21.4, 0, 3.6, 2.6, 5, RED);                           // shoulders
  for (const s of [-1, 1]) wing(b, s, { x0: 1.6, x1: 8.4, yt0: 30.3, yt1: 35, yb0: 17, yb1: 28, z: -2.8 });   // the spread wing collar
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 6, 12.6, 0, 3.6, 10, 3.6, RED); b.add(s * 6, 11, 0.2, 3.2, 2, 3.2, SCALE_L);
  }
  b.g = 'armP';                                                                                  // a slim sceptre with a glowing gem
  b.add(6, 9, 2.4, 1, 12, 1, GOLD_D); b.add(6, 20.6, 2.4, 2.2, 2.2, 2.2, EMBER);
  b.g = 'body';
  dragonHead(b, 24, 0, { skin: RED, jaw: BELLY_D, frill: RED_D, face: FACES.queen, horns: false, crest: false });
  b.g = 'head';
  b.add(0, 31.6, 0, 9, 1, 9, GOLD);                                                              // a golden tiara
  for (const [x, h] of [[-2.6, 2], [-1.3, 2.8], [0, 4], [1.3, 2.8], [2.6, 2]]) b.add(x, 32.6, 4.1, 1, h, 1, GOLD);
  b.add(0, 33.4, 4.75, 1.8, 1.8, 0.5, EMBER); b.add(0, 33.8, 5.05, 0.8, 0.8, 0.3, FLAME);       // the glowing gem in front
  for (const k of [-1, 1]) {                                                                     // two elegant horns swept back
    b.add(k * 3, 32.4, -1.4, 1.6, 2, 1.8, HORN); b.add(k * 3.3, 34, -2.8, 1.3, 1.8, 1.6, HORN);
    b.add(k * 3.5, 35.4, -4.2, 1, 1.4, 1.6, HORN_D); b.add(k * 3.5, 36.4, -5.4, 0.8, 0.9, 1.2, HORN_D);
  }
  b.add(0, 32.6, -2.6, 1, 2.2, 3.6, RED_D);                                                      // a crest at the back
  b.add(0, 29, -4.6, 1, 2.6, 1.2, RED_D); b.add(0, 25.6, -4.6, 1, 2.4, 1.2, RED_D);            // and down the back of the head
  b.g = 'body';
  return b;
}

// ------------------------------------------------------------------ king: half open wings, a crown of horns, an ember sceptre
function king() {
  const b = new Vox();
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    b.add(s * 2.2, 0, 0, 4, 12, 4, SCALE); b.add(s * 2.3, 0, 0.6, 4.4, 2.4, 5.4, SCALE_D);
    for (const x of [-1.2, 1.2]) b.add(s * 2.3 + x, 0, 3.6, 0.8, 1, 0.8, HORN);
  }
  b.g = 'body';
  b.add(0, 12, 0, 8.4, 12, 4.4, SCALE);
  belly(b, 13, 2.35, 4.6, 5);
  b.add(0, 12.4, 0, 8.8, 1.4, 4.8, GOLD_D); b.add(0, 12.2, 2.55, 2, 1.8, 0.3, GOLD);            // a belt and buckle
  b.add(0, 4, -2.8, 9, 19, 1.2, RED);                                                            // a crimson cape
  for (const s of [-1, 1]) { b.add(s * 5.6, 22, 0, 5, 2.4, 5.6, RED); b.add(s * 5.6, 24.4, 0, 3, 0.8, 4, GOLD_D); }   // pauldrons
  for (const s of [-1, 1]) wing(b, s, { x0: 2.3, x1: 8.7, yt0: 29, yt1: 36, yb0: 15, yb1: 29, z: -3.9 });   // big wings, half open
  tail(b, 2, -3.6, [[3.4, 0, 2.4], [2.6, -1, 2]]);
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 6.2, 12, 0, 4, 10, 4, SCALE); b.add(s * 6.2, 10.4, 0.2, 4.2, 2, 4.2, SCALE_L);
  }
  b.g = 'armP';                                                                                  // the ember sceptre
  b.add(6.2, 4, 2.8, 1.2, 18, 1.2, GOLD_D);
  b.add(6.2, 21.6, 2.8, 2.6, 1, 2.6, GOLD);
  b.add(6.2, 22.6, 2.8, 2.4, 2.4, 2.4, EMBER); b.add(6.2, 25, 2.8, 1.2, 1.4, 1.2, FLAME);
  b.g = 'body';
  dragonHead(b, 24, 0, { skin: SCALE, jaw: RED_L, frill: RED, face: FACES.king, horns: false });
  b.g = 'head';
  b.add(0, 26.3, 5.6, 6.2, 1.85, 3.4, RED);                                                      // a crimson band over the snout
  b.add(0, 31.6, 0, 9.4, 1.6, 9.4, GOLD); b.add(0, 31.4, 0, 9.6, 0.6, 9.6, GOLD_D);              // the crown of horns
  for (const [x, z, h] of [[-1, 1, 3], [1, 1, 3], [0, 1, 4.6], [-1, -1, 3.6], [1, -1, 3.6], [-1, 0, 4], [1, 0, 4], [0, -1, 3]]) b.add(x * 4.2, 33.2, z * 4.2, 1.2, h, 1.2, x === 0 && z === 1 ? GOLD : HORN);
  b.add(0, 32, 4.85, 2, 2, 0.4, EMBER);                                                          // a glowing gem
  b.add(0, 37.8, 4.2, 1, 1, 1, EMBER);
  b.g = 'body';
  return b;
}

export const DRAGONS = {
  id: 'dragons', side: 'b',
  pal: { ...PAL.b, skin: SCALE_L, skinD: SCALE_D, hair: RED_D, main: RED, dark: RED_D, light: RED_L, iron: SCALE, ironD: SCALE_D, boots: SCALE_D },
  build: { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king },
};
