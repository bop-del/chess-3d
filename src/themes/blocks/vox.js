// Block heroes (White, blue) and friendly block critters (Black, red): the 12 characters as lists of boxes in voxel units.
// V = 0.08 world units per voxel. The local front is +z here; rig.js turns the whole character so it faces -z like every
// other piece set. Every box carries a group tag: 'body' stands still, the other tags are the parts the animation moves
// (see anim.js): head, armN/armP and legN/legP (N is the side at negative x), horse legs lg + N|P + F|B, tail, rider, handN/handP.
export const V = 0.08;

export class Vox {
  constructor(unit) { this.parts = []; this.g = 'body'; if (unit) this.unit = unit; }   // unit: world size of one voxel, V when absent
  /** x,z centre, y bottom, sizes in voxels. The group tag is this.g unless o.g is given. */
  add(x, y, z, w, h, d, color, o = {}) { this.parts.push({ x, y, z, w, h, d, color, g: o.g || this.g, ry: o.ry || 0 }); return this; }
}

const HERO = {
  trim: 0xeef1f6, armor: 0xcfd7e2, armor2: 0x97a4b7, gold: 0xe3eaf3, horse: 0xf3efe6, skin: 0xf2c6a0, hair: 0x7d5532, boots: 0x6a5440,
  belt: 0x7a5a38, wood: 0x9a6b3a,
  tunic: 0x2f6bd1, tunic2: 0x1f4aa3, light: 0x78a2ec, cape: 0x2a5fc4, acc: 0xd23a3a, mane: 0xd23a3a, pants: 0x2f56b0, stone: 0x93b2ee, stone2: 0x6b8fd8,
};
const CRIT = {
  horn: 0xf3ead2, eyeW: 0xffffff, pupil: 0x2a2250, gold: 0xf4c542, gem: 0x5fe3ff, leaf: 0x5cc24a, band: 0xffd24a,
  body: 0xd9453d, body2: 0xb23a38, belly: 0xff9a8a, cheek: 0xffc2d6, stone: 0xe8564d, stone2: 0xa82f2c, hat: 0xa82f2c, mouth: 0x2a1018,
};

const sideTag = (name, s) => name + (s < 0 ? 'N' : 'P');

// ---------------- heroes ----------------
function humanoid(b, P, o) {
  const { legs = 2, torso = 3, hH = 5, hW = 6, hD = 5, tW = 5, tD = 3, shirt = P.tunic, hair = true, arms = true, armH = 3 } = o;
  for (const s of [-1, 1]) {
    b.g = sideTag('leg', s);
    if (legs > 0) { b.add(s * 1.5, 0, 0, 2, legs, 2.4, P.pants); b.add(s * 1.5, 0, 0.3, 2.2, Math.min(1, legs), 3, P.boots); }
  }
  b.g = 'body';
  b.add(0, legs, 0, tW, torso, tD, shirt);
  if (torso >= 3) b.add(0, legs + 0.2, 0, tW + 0.2, 0.8, tD + 0.2, P.belt);
  b.add(0, legs + torso - 1.8, tD / 2 + 0.1, 1.6, 1.4, 0.3, P.trim);
  const y0 = legs + torso;
  if (arms) for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    const ay = y0 - armH;
    b.add(s * (tW / 2 + 0.75), ay, 0, 1.5, armH, 2, shirt);
    b.add(s * (tW / 2 + 0.75), ay - 0.9, 0, 1.5, 1, 1.8, P.skin);
  }
  b.g = 'head';
  b.add(0, y0, 0, hW, hH, hD, P.skin);
  if (hair) {
    b.add(0, y0 + hH - 0.9, 0, hW + 0.2, 1.0, hD + 0.2, P.hair);
    b.add(0, y0 + 1.4, -hD / 2 - 0.1, hW + 0.2, hH - 1.4, 0.6, P.hair);
    for (const s of [-1, 1]) b.add(s * (hW / 2 + 0.05), y0 + hH - 2.6, -0.4, 0.4, 2, hD - 1.4, P.hair);
  }
  face(b, y0, hH, hD);
  b.g = 'body';
  return { y0, top: y0 + hH };
}
function face(b, y0, hH, hD, dark = 0x34466e) {
  for (const s of [-1, 1]) {
    b.add(s * 1.5, y0 + hH * 0.4, hD / 2 + 0.2, 0.8, 1.2, 0.4, dark);
    b.add(s * 2.3, y0 + hH * 0.2, hD / 2 + 0.2, 1, 0.7, 0.4, 0xf29a8a);
  }
  b.add(0, y0 + hH * 0.17, hD / 2 + 0.2, 1.4, 0.4, 0.4, 0xc0605a);
}

function heroPawn(P) {
  const b = new Vox();
  const h = humanoid(b, P, { legs: 1, torso: 3, hair: false, hH: 5, armH: 2.4 });
  b.g = 'head';
  b.add(0, h.top - 1.5, 0, 6.5, 1.8, 5.5, P.cape);                            // cap
  b.add(0, h.top - 1.5, 0, 6.7, 0.7, 5.7, P.armor);                           // iron rim
  b.add(0, h.top - 0.3, 0, 1.2, 0.8, 5.7, P.trim);                            // crest stripe
  b.add(0, h.top - 2.6, 2.8, 0.9, 2, 0.5, P.armor);                           // nose guard
  b.g = 'armN';
  b.add(-4.5, 1.2, 0.3, 0.9, 3.2, 3.2, P.tunic2); b.add(-4.5, 1.2, 0.3, 1.1, 1.2, 1.2, P.trim);  // shield
  b.g = 'armP';
  b.add(3.9, 2.3, 1.2, 0.8, 0.8, 0.8, P.wood);                                // sword hilt in hand
  b.add(3.9, 3.1, 1.2, 0.7, 4.6, 0.7, P.armor); b.add(3.9, 2.7, 1.2, 2.6, 0.5, 0.8, P.wood);
  return b;
}
function heroRook(P) {
  const S = { ...P, stone: 0xb9bdc7, stone2: 0x858b98 }, b = new Vox();                  // a grey stone tower: the only grey hero
  b.add(0, 0, 0, 9.4, 1.2, 9.4, S.stone2);                                                 // plinth
  b.add(0, 1.2, 0, 8.4, 6.2, 8.4, S.stone);                                                // tower
  for (const y of [3.0, 5.0]) b.add(0, y, 0, 8.6, 0.4, 8.6, S.stone2);                     // brick bands
  b.add(0, 1.2, 4.3, 3.2, 3.4, 0.3, 0x6a4524); b.add(0, 4.2, 4.3, 2.2, 0.6, 0.3, 0x6a4524);   // wooden door
  b.add(0, 2.0, 4.5, 0.5, 0.5, 0.3, P.gold);
  b.add(0, 4.9, 4.35, 1.2, 2.4, 0.3, 0x2c2f3d);                                            // arrow slit
  for (const s of [-1, 1]) { b.add(s * 4.3, 1.2, 0, 0.3, 4.2, 2.4, P.cape); }              // blue pennants on the sides
  b.add(0, 7.4, 0, 9.6, 1, 9.6, S.stone2);                                                 // top ring
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(sx * 3.7, 8.4, sz * 3.7, 2.2, 2, 2.2, S.stone);   // merlons
  for (const s of [-1, 1]) { b.add(s * 3.7, 8.4, 0, 2.2, 1.2, 2.2, S.stone); b.add(0, 8.4, s * 3.7, 2.2, 1.2, 2.2, S.stone); }
  b.g = 'head';
  b.add(0, 8.4, 0, 4.4, 3.8, 4, P.skin);                                                   // soldier peeking out
  b.add(0, 11.4, 0, 5, 1.2, 4.6, P.armor2); b.add(0, 12.0, 0, 5, 0.8, 1, P.armor2); b.add(0, 12.4, 0, 1.6, 1.6, 3, P.acc);   // helmet and crest
  face(b, 8.4, 3.8, 4);
  for (const s of [-1, 1]) { b.g = sideTag('hand', s); b.add(s * 3.6, 10.2, 2.3, 1.4, 1.2, 1.2, P.skin); }   // waving hands
  return b;
}
function horseLegs(b, body, hoof, big) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.g = 'lg' + (sx < 0 ? 'N' : 'P') + (sz > 0 ? 'F' : 'B');
    if (big) { b.add(sx * 1.6, 0, sz * 3.1, 2, 2.8, 2, body); b.add(sx * 1.6, 0, sz * 3.1 + 0.2, 2.2, 0.7, 2.4, hoof); }
    else { b.add(sx * 1.6, 0, sz * 3.1, 1.9, 2.8, 1.9, body); b.add(sx * 1.6, 0, sz * 3.1, 2.1, 0.8, 2.1, hoof); }
  }
  b.g = 'body';
}
function heroKnight(P) {
  const b = new Vox();
  horseLegs(b, P.horse, P.armor2, false);
  b.add(0, 2.6, 0, 5, 3.6, 9, P.horse);                                     // body
  b.add(0, 2.8, -0.6, 5.2, 2.6, 3.8, P.tunic); b.add(0, 5.0, -0.6, 3.6, 0.6, 3.2, P.gold);   // saddle blanket
  b.add(0, 3.4, 4.5, 5.2, 2.8, 0.8, P.tunic);                               // chest barding
  b.g = 'head';
  b.add(0, 5.4, 3.6, 3, 5.4, 2.8, P.horse);                                 // neck
  b.add(0, 8.6, 5.3, 3.8, 3.8, 3.8, P.horse);                               // head
  b.add(0, 8.6, 7.9, 3, 2.2, 2.6, P.horse); b.add(0, 8.6, 9.25, 3.2, 1.4, 0.3, 0xf0a9a0);    // muzzle and nose
  for (const s of [-1, 1]) {
    b.add(s * 1.4, 10.3, 7.25, 1.1, 1.2, 0.4, 0xffffff); b.add(s * 1.4, 10.3, 7.55, 0.7, 1.0, 0.4, 0x1d2a4a);   // eyes
    b.add(s * 1.2, 12.3, 4.6, 1.1, 1.8, 1.1, P.horse); b.add(s * 1.2, 12.3, 4.6, 0.5, 1.2, 1.2, 0xf0a9a0);     // ears
    b.add(s * 0.8, 8.9, 9.1, 0.4, 0.5, 0.5, 0x6b4a40);                                                         // nostrils
  }
  b.add(0, 5.4, 2.0, 1.1, 6.8, 1.3, P.mane); b.add(0, 11.6, 3.0, 1.1, 1.4, 1.6, P.mane);   // mane
  b.g = 'tail';
  b.add(0, 4.0, -5.1, 1.5, 2.4, 1.3, P.mane); b.add(0, 1.8, -5.6, 1.3, 2.4, 1.2, P.mane);   // tail
  // rider
  b.g = 'rider';
  b.add(0, 6.2, -0.8, 3.6, 2.6, 2.8, P.tunic2); b.add(0, 6.2, -0.8, 3.8, 0.6, 3, P.belt);
  for (const s of [-1, 1]) { b.add(s * 2.4, 6.2, -0.1, 1.2, 2.2, 1.6, P.tunic2); b.add(s * 2.4, 5.6, 0.6, 1.2, 1, 1.4, P.skin); }
  b.add(0, 8.8, -0.8, 4.4, 3.4, 3.8, P.skin);
  b.add(0, 11.2, -0.8, 4.8, 1.6, 4.2, P.light); b.add(0, 8.8, -2.5, 4.8, 3.4, 0.7, P.tunic2);   // helmet
  b.add(0, 11.0, 1.15, 4.8, 0.8, 0.5, P.armor2);
  b.add(0, 12.8, -0.8, 1.1, 2, 3, P.acc);                                    // plume
  face(b, 8.8, 3.4, 3.8); b.parts.slice(-4).forEach((p) => { p.z -= 0.8; });
  return b;
}
function heroBishop(P) {
  const W = { ...P, tunic: 0xf4f6fa, tunic2: 0xd3d9e5, trim: 0xe5c45c, cape: 0x2a5fc4 }, b = new Vox();   // a tall slim white robe, blue mitre
  b.add(0, 0, 0, 7.2, 0.6, 5.4, W.trim);                                                   // gold hem
  b.add(0, 0.6, 0, 6.8, 2.4, 5, W.tunic2); b.add(0, 3, 0, 5.8, 3.6, 4.2, W.tunic);          // robe
  b.add(0, 6.4, 0, 6.4, 1.6, 3.8, W.tunic);                                                // shoulders
  b.add(0, 0.6, 2.55, 1.8, 7, 0.3, W.cape);                                                // blue stole down the front
  b.add(0, 5.4, 2.0, 5.2, 0.7, 0.4, W.trim);
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 3.9, 3.2, 0, 2, 4.8, 2.4, W.tunic2); b.add(s * 3.9, 3.2, 0, 2.2, 0.7, 2.6, W.trim);   // wide sleeve
    b.add(s * 3.9, 2.4, 0, 1.4, 1, 1.6, P.skin);
  }
  b.g = 'head';
  b.add(0, 8, 0, 4.8, 4.2, 4.4, P.skin); face(b, 8, 4.2, 4.4);
  b.add(0, 8, -2.3, 5, 3.4, 0.5, 0xd8d8d8);                                               // white hair behind
  b.add(0, 12, 0, 5.6, 1, 5, W.trim);                                                      // mitre band
  [5, 4.4, 3.8, 3.2, 2.6, 2, 1.4, 0.8].forEach((ww, i) => b.add(0, 13 + i * 1.0, 0, ww, 1.05, ww * 0.8 + 0.4, i % 3 === 2 ? W.trim : W.cape));   // a very tall blue mitre
  b.add(0, 14.4, 2.3, 0.8, 3, 0.3, W.trim); b.add(0, 15.4, 2.3, 2.4, 0.8, 0.3, W.trim);  // gold cross
  b.g = 'body';                                                                            // staff with a gold crook, standing on the ground
  b.add(-5.6, 0, 1.4, 0.8, 16, 0.8, 0x9a6b3a); b.add(-5.6, 16, 1.4, 2.4, 0.9, 1.2, W.trim); b.add(-6.6, 14.8, 1.4, 0.9, 1.4, 1.2, W.trim);
  return b;
}
function heroQueen(P) {
  const Q = { ...P, gown: 0x1b3a94, gown2: 0x2f6bd1, hair: 0x8a3b22, gold: 0xffd34d, lace: 0xffffff }, b = new Vox();   // a wide blue gown, golden hair, big crown
  b.add(0, 0, 0, 10.4, 0.8, 8, Q.gold);                                                    // hem
  b.add(0, 0.8, 0, 9.8, 2.6, 7.4, Q.gown);                                                 // hoop skirt
  b.add(0, 3.4, 0, 8, 1.8, 5.8, Q.gown); b.add(0, 5.2, 0, 5.8, 2, 3.8, Q.gown2);           // upper skirt, bodice
  b.add(0, 3.4, 3.0, 2.6, 1.8, 0.3, Q.gold);                                               // front panel
  b.add(0, 5.2, 1.95, 2.4, 1.4, 0.3, Q.gold);
  b.add(0, 7.2, 0, 7, 0.7, 4.6, Q.lace);                                                   // lace collar
  for (const s of [-1, 1]) {
    b.g = sideTag('arm', s);
    b.add(s * 4.1, 5.4, 0, 2.2, 2.8, 2.4, Q.gown2); b.add(s * 4.1, 4.6, 0, 1.4, 0.9, 1.6, P.skin);   // puffed sleeves
  }
  b.g = 'body';
  b.add(0, 7.7, 0, 3, 0.6, 2.6, P.skin);                                                   // neck
  const y0 = 8.2;
  b.g = 'head';
  b.add(0, y0, 0, 5.6, 4.6, 4.6, P.skin);
  b.add(0, y0 + 3.4, 0, 6, 1.6, 5, Q.hair);                                                // fringe
  b.add(0, y0 - 4.6, -2.7, 7.4, 9.6, 1.4, Q.hair);                                         // long golden hair behind
  for (const s of [-1, 1]) b.add(s * 3.1, y0 - 2.4, -0.2, 0.9, 6.4, 3.6, Q.hair);          // side locks
  face(b, y0, 4.6, 4.6);
  for (const s of [-1, 1]) b.add(s * 1.5, y0 + 2.3, 2.5, 1.3, 0.35, 0.4, 0x1d2a4a);        // lashes
  const cy = y0 + 4.4;
  b.add(0, cy, 0, 6.6, 1.3, 5.4, Q.gold);                                                  // crown band
  for (const [x, z, h] of [[-2.9, -2.2, 2.6], [-1.45, -2.2, 3.6], [0, -2.2, 2.6], [1.45, -2.2, 3.6], [2.9, -2.2, 2.6], [-2.9, 2.2, 2.6], [-1.45, 2.2, 3.6], [0, 2.2, 2.6], [1.45, 2.2, 3.6], [2.9, 2.2, 2.6], [-2.9, 0, 3.2], [2.9, 0, 3.2]]) b.add(x, cy + 1.3, z, 0.9, h, 0.9, Q.gold);
  b.add(0, cy + 0.1, 2.8, 1.2, 1.1, 0.4, 0xff4a6a); b.add(0, cy + 1.3, 0, 1.6, 1.6, 1.6, 0x56d4ff);
  return b;
}
function heroKing(P) {
  const b = new Vox();
  const h = humanoid(b, P, { legs: 2, torso: 4.6, hair: true, shirt: P.tunic, tW: 6, tD: 3.6, hH: 5, hW: 6, armH: 3.4 });
  b.add(0, 2, 0, 6.2, 0.9, 3.8, P.belt); b.add(0, 2, 1.95, 1.6, 0.9, 0.3, P.gold);
  b.add(0, 2.9, 1.9, 3.4, 3.2, 0.4, P.light);                                 // tabard
  b.add(0, 3.8, 2.15, 1.3, 1.5, 0.3, P.gold);
  for (const s of [-1, 1]) b.add(s * 3.2, h.y0 - 0.2, 0, 2.2, 1.2, 2.6, P.armor);          // pauldrons
  b.add(0, 1.4, -2.3, 7, h.y0 - 1.4, 0.9, P.cape);                            // cape
  b.add(0, h.y0 - 0.5, -2.2, 7.4, 0.9, 1.1, P.trim);
  b.g = 'head';
  b.add(0, h.y0 - 0.2, 2.3, 4.4, 1.9, 0.6, P.hair);                            // beard
  b.add(0, h.y0 + 1.6, 2.3, 1, 0.7, 0.4, P.hair);
  const cy = h.top - 0.2;
  b.add(0, cy, 0, 6.4, 1.6, 5.4, P.gold);                                      // crown
  for (const [x, z] of [[-2.8, -2.2], [0, -2.2], [2.8, -2.2], [-2.8, 2.2], [0, 2.2], [2.8, 2.2], [-2.8, 0], [2.8, 0]]) b.add(x, cy + 1.6, z, 0.9, 1.4, 0.9, P.gold);
  b.add(0, cy + 0.4, 2.8, 1.2, 1, 0.4, 0xff4a6a); b.add(-2, cy + 0.4, 2.8, 0.9, 0.9, 0.4, 0x56d4ff); b.add(2, cy + 0.4, 2.8, 0.9, 0.9, 0.4, 0x56d4ff);
  b.add(0, cy + 1.6, 0, 1, 3.2, 1, P.gold); b.add(0, cy + 2.7, 0, 3, 1, 1, P.gold);    // cross
  b.add(0, cy + 1.6, 0, 3, 1, 1, 0xff4a6a);
  b.g = 'armP';                                                                // sword in the right hand
  b.add(4.5, 2.7, 1.4, 0.9, 1, 0.9, P.wood); b.add(4.5, 3.6, 1.4, 3.2, 0.7, 1, P.gold); b.add(4.5, 4.3, 1.4, 0.9, 6.6, 0.5, P.armor);
  return b;
}
const HERO_BUILD = { p: heroPawn, r: heroRook, n: heroKnight, b: heroBishop, q: heroQueen, k: heroKing };

// ---------------- critters ----------------
// The whole torso (body, face, hat, arms) is the 'head' group: a critter looks around by turning its upper body, the legs walk.
function mBody(b, S, o) {
  const { w, h, d, legH = 1, eye = 2, arms = true, eyeY = 0.55, fangs = true } = o;
  for (const s of [-1, 1]) { b.g = sideTag('leg', s); b.add(s * w * 0.25, 0, 0, Math.max(2, w * 0.3), legH, Math.max(2.2, d * 0.45), S.body2); }
  b.g = 'head';
  b.add(0, legH, 0, w, h, d, S.body); b.add(0, legH + 0.4, d / 2 + 0.05, w * 0.55, h * 0.38, 0.3, S.belly);
  if (arms) for (const s of [-1, 1]) b.add(s * (w / 2 + 0.6), legH + h * 0.28, 0.2, 1.3, h * 0.38, 1.6, S.body2);
  const yb = legH + h * eyeY, z = d / 2 + 0.25;
  for (const s of [-1, 1]) {
    b.add(s * w * 0.22, yb, z, eye, eye, 0.5, S.eyeW);
    b.add(s * w * 0.22 - s * eye * 0.12, yb + eye * 0.05, z + 0.3, eye * 0.55, eye * 0.6, 0.4, S.pupil);
    b.add(s * w * 0.36, yb - eye * 0.8, z, 1.1, 0.8, 0.4, S.cheek);
  }
  const my = legH + h * 0.18;
  b.add(0, my, z, w * 0.34, 0.6, 0.4, S.mouth);
  if (fangs) for (const s of [-1, 1]) b.add(s * w * 0.12, my + 0.7, z + 0.1, 0.7, 0.8, 0.4, S.eyeW);
  return legH + h;
}
const sprout = (b, S, y) => { b.add(0, y, 0, 0.6, 1.4, 0.6, S.leaf); b.add(-0.9, y + 1.1, 0, 1.6, 0.6, 1, S.leaf); b.add(0.9, y + 1.6, 0, 1.6, 0.6, 1, S.leaf); };
const nubs = (b, S, y, x) => { for (const s of [-1, 1]) b.add(s * x, y, 0, 1, 1.4, 1, S.horn); };
function monsterPawn(S) { const b = new Vox(); const t = mBody(b, S, { w: 6, h: 6, d: 5, legH: 1, eye: 2 }); sprout(b, S, t); nubs(b, S, t, 2.2); return b; }
function monsterRook(S) {
  const b = new Vox(); const t = mBody(b, S, { w: 7, h: 8, d: 6, legH: 1, eye: 2.2, eyeY: 0.62 });
  b.add(0, t, 0, 7.6, 0.8, 6.6, S.stone2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(sx * 2.7, t + 0.8, sz * 2.2, 2, 1.8, 2, S.stone);
  for (const s of [-1, 1]) { b.add(s * 2.7, t + 0.8, 0, 2, 1.2, 2, S.stone); b.add(0, t + 0.8, s * 2.2, 2, 1.2, 2, S.stone); }
  b.add(-2.2, 3.2, 3.25, 2.2, 0.6, 0.3, S.stone2); b.add(2.5, 5.6, 3.3, 1.4, 0.5, 0.3, S.stone2);
  return b;
}
function monsterBishop(S) {
  const b = new Vox(); const t = mBody(b, S, { w: 6, h: 5.5, d: 5, legH: 1, eye: 2, eyeY: 0.5 });
  b.add(0, t, 0, 8.4, 0.8, 7.2, S.hat);                                       // brim
  const w = [5.4, 4.6, 3.8, 3, 2.2, 1.4];
  w.forEach((ww, i) => b.add(i > 2 ? 0.25 * (i - 2) : 0, t + 0.8 + i * 1.0, 0, ww, 1.1, ww * 0.85, S.hat));
  b.add(0, t + 0.8, 0, 5.8, 0.9, 4.9, S.band); b.add(0.6, t + 3.2, 2.4, 1.2, 1.2, 0.3, S.band);
  return b;
}
function monsterQueen(S) {
  const b = new Vox(); const t = mBody(b, S, { w: 6.4, h: 6.2, d: 5.2, legH: 1, eye: 2, eyeY: 0.52 });
  for (const s of [-1, 1]) { b.add(s * 3.7, t - 2.2, 0, 1.4, 2.2, 1.4, S.cheek); b.add(s * 3.7, t - 3.6, 0, 1.8, 1.4, 1.8, S.cheek); }
  const yb = 1 + 6.2 * 0.52 + 2.1;
  for (const s of [-1, 1]) b.add(s * 1.5, yb, 2.9, 1.6, 0.35, 0.4, S.pupil);   // lashes
  b.add(0, t, 0, 6.6, 1.2, 5.4, S.gold);
  for (const [x, z, h] of [[-2.8, -2, 2], [0, -2, 1.5], [2.8, -2, 2], [-2.8, 2, 2], [0, 2, 1.5], [2.8, 2, 2], [-2.8, 0, 1.5], [2.8, 0, 1.5]]) b.add(x, t + 1.2, z, 0.9, h, 0.9, S.gold);
  b.add(0, t + 0.2, 2.8, 1.2, 1, 0.4, 0xff4a8a); b.add(0, t + 1.2, 0, 1.4, 1.3, 1.4, S.gem);
  b.add(2.6, t - 0.2, 2.3, 2.4, 1.6, 0.8, 0xff4a8a); b.add(2.6, t - 1.0, 2.5, 0.9, 1, 0.4, 0xff4a8a);   // bow
  return b;
}
function monsterKing(S) {
  const b = new Vox(); const t = mBody(b, S, { w: 8, h: 7.2, d: 6.2, legH: 2, eye: 2.4, eyeY: 0.56 });
  for (const s of [-1, 1]) {                                                   // big horns
    b.add(s * 4.4, t - 2.4, 0, 1.6, 2, 1.8, S.horn); b.add(s * 5.2, t - 0.6, 0, 1.4, 2, 1.6, S.horn); b.add(s * 5.4, t + 1.2, 0, 1.1, 2.2, 1.3, S.horn);
  }
  b.add(0, t, 0, 7.8, 1.6, 6.6, S.gold);
  for (const [x, z] of [[-3.4, -2.6], [0, -2.6], [3.4, -2.6], [-3.4, 2.6], [0, 2.6], [3.4, 2.6], [-3.4, 0], [3.4, 0]]) b.add(x, t + 1.6, z, 1, 1.5, 1, S.gold);
  b.add(0, t + 0.4, 3.35, 1.3, 1.1, 0.4, 0xff4a6a); b.add(-2.2, t + 0.4, 3.35, 1, 1, 0.4, S.gem); b.add(2.2, t + 0.4, 3.35, 1, 1, 0.4, S.gem);
  b.add(0, t + 1.6, 0, 1.2, 3.2, 1.2, S.gold); b.add(0, t + 2.8, 0, 3.2, 1.2, 1.2, S.gold); b.add(0, t + 2.9, 0, 1.2, 1, 1.2, 0xff4a6a);
  return b;
}
function monsterKnight(S) {
  const b = new Vox(), body = S.body;
  horseLegs(b, S.body2, S.horn, true);
  b.add(0, 2.6, 0, 5, 3.8, 9, body);
  b.add(0, 2.8, 0.2, 5.2, 1.6, 6, S.belly);
  b.add(0, 5.0, -0.4, 5.3, 1.2, 4, S.gold);                                      // saddle blanket
  b.g = 'head';
  b.add(0, 5.4, 3.6, 3.2, 5.6, 3, body);                                          // neck
  b.add(0, 8.8, 5.3, 4.2, 4.2, 4.2, body);                                        // head
  b.add(0, 8.8, 8.1, 3.2, 2.4, 2.4, S.belly);                                     // muzzle
  b.add(0, 9.2, 9.35, 1.8, 0.5, 0.3, S.mouth);
  for (const s of [-1, 1]) {
    b.add(s * 1.5, 10.6, 7.45, 1.7, 1.9, 0.5, S.eyeW); b.add(s * 1.35, 10.5, 7.8, 1.0, 1.4, 0.4, S.pupil);
    b.add(s * 2.4, 9.6, 7.3, 1.0, 0.8, 0.4, S.cheek);
    b.add(s * 1.9, 12.9, 4.4, 1.1, 1.6, 1.1, S.body2);                           // ears
  }
  b.add(0, 13.0, 6.2, 1.2, 1.8, 1.2, S.horn); b.add(0, 14.8, 6.4, 0.9, 1.4, 0.9, S.horn); b.add(0, 16.1, 6.6, 0.6, 1, 0.6, S.horn);   // one big horn
  b.add(0, 5.4, 1.8, 1.4, 7.2, 1.4, S.body2); b.add(0, 11.8, 3.2, 1.4, 1.6, 1.6, S.body2);   // mane
  b.g = 'tail';
  b.add(0, 4.4, -5.1, 1.5, 2.2, 1.3, S.body2); b.add(0, 2.0, -5.5, 1.3, 2.6, 1.2, S.body2);  // tail
  // small critter rider
  b.g = 'rider';
  b.add(0, 6.2, -0.6, 4.4, 3.6, 3.6, S.stone); b.add(0, 6.2, -0.6, 4.6, 0.8, 3.8, S.gold);
  for (const s of [-1, 1]) {
    b.add(s * 1.1, 8.0, 1.25, 1.4, 1.4, 0.5, S.eyeW); b.add(s * 0.9, 8.0, 1.6, 0.7, 0.9, 0.4, S.pupil);
    b.add(s * 1.7, 9.8, -0.6, 0.9, 1.6, 0.9, S.horn); b.add(s * 2.4, 6.9, -0.6, 0.9, 1.6, 1.8, S.stone2);
  }
  b.add(0, 7.0, 1.3, 1.5, 0.5, 0.4, S.mouth);
  return b;
}
const MON_BUILD = { p: monsterPawn, r: monsterRook, n: monsterKnight, b: monsterBishop, q: monsterQueen, k: monsterKing };

/** The box list of one character: color 'w' (blue heroes) or 'b' (red critters), type p, n, b, r, q or k. */
export function buildVox(color, type) {
  return color === 'w' ? HERO_BUILD[type](HERO) : MON_BUILD[type](CRIT);
}
