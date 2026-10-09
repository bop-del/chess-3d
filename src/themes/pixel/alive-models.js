// The creatures of the living island (CHE-372): animals and villagers of our own design, drawn in pixels (1 px = 1/16 block),
// front +z, y = 0 the ground, x and z the centre of a box, y its bottom (like Vox). Each creature is a few rigid parts (body, head,
// legs, arms, tail), each part one meshed geometry with the fixed per face shade, turned at its pivot by alive.js. Overlay boxes (eyes,
// cheeks, belts) stand a tenth of a pixel proud of the face below them, so no two boxes of a part share a plane (Pixelwelt rule 2).
import { Mesher } from '../blocks/mesher.js';

export const PX = 1 / 16;
const EYE = 0x231a16, SHINE = 0xffffff, BLUSH = 0xf3a0a0, MOUTH = 0xa8505a;

/** A part: a pivot and its boxes [x, y, z, w, h, d, color] (x, z centre, y bottom, pixels). */
const part = (pivot, ...boxes) => ({ pivot, boxes });

// ------------------------------------------------------------------ animals
// our sheep: a round wool body with a fluffy two tier cloud of wool round a cream (or dark) face, eyes with a white ring and a shine
function sheep(wool = 0xf4f0e4, face = 0xf2dcc4, legs = 0x463c38, ear = 0xe8b4a0) {
  const shade = wool === 0xf4f0e4 ? 0xe2dccb : 0x7a5a40, top = wool === 0xf4f0e4 ? 0xfdfbf4 : 0xc8a27c;   // the brown sheep gets light tufts, so it never reads as a crate
  return {
    speed: 0.45, r: 0.42, kind: 'quad',
    parts: {
      body: part([0, 0, 0], [0, 3, 0, 8, 6, 10, wool], [0, 2.4, 0, 6.4, 0.6, 8.4, wool], [0, 9, -2, 6, 1.2, 4, top], [0, 9, 2.6, 4.6, 0.8, 3, top],
        [-4.05, 4, 0, 0.1, 3, 6, shade], [4.05, 4, 0, 0.1, 3, 6, shade], [0, 6, -5.5, 2.4, 2.4, 1, wool]),
      head: part([0, 7, 4.5], [0, 6, 6.5, 6.4, 4, 4.2, wool], [0, 10, 6.3, 4.4, 1.6, 3.4, top], [0, 4.4, 8.2, 3.8, 4.4, 1.6, face],
        [-3.6, 7.6, 6.6, 1.6, 0.9, 1.4, ear], [3.6, 7.6, 6.6, 1.6, 0.9, 1.4, ear],
        [-1, 6.6, 9.05, 1.4, 1.6, 0.1, SHINE], [1, 6.6, 9.05, 1.4, 1.6, 0.1, SHINE], [-0.9, 6.7, 9.125, 0.9, 1.2, 0.05, EYE], [0.9, 6.7, 9.125, 0.9, 1.2, 0.05, EYE],
        [-0.75, 7.4, 9.175, 0.4, 0.4, 0.05, SHINE], [1.05, 7.4, 9.175, 0.4, 0.4, 0.05, SHINE], [0, 4.9, 9.05, 1.4, 0.6, 0.1, 0xc98a7a]),
      legA: part([0, 3, 0], [-2.4, 0, 3.2, 2, 3.2, 2, legs], [2.4, 0, -3.2, 2, 3.2, 2, legs]),
      legB: part([0, 3, 0], [2.4, 0, 3.2, 2, 3.2, 2, legs], [-2.4, 0, -3.2, 2, 3.2, 2, legs]),
    },
  };
}

// our pig: a round pink nose (no flat plate), floppy ears that hang forward over the brow, a curly tail
function pig() {
  const P = 0xf3a9b6, D = 0xd98799, S = 0xe8899e;
  return {
    speed: 0.4, r: 0.4, kind: 'quad',
    parts: {
      body: part([0, 0, 0], [0, 2.5, 0, 7, 5.5, 9.5, P], [0, 8, 0, 5, 0.1, 6, 0xf7b9c4], [-1.5, 8.05, -2.5, 1.6, 0.1, 1.2, 0xd17a8d],
        [0.5, 6.2, -5.15, 1, 0.8, 0.8, D], [1.3, 6.8, -5.15, 0.8, 1.2, 0.8, D], [0.6, 7.8, -5.15, 1.4, 0.8, 0.8, D], [-0.1, 7, -5.15, 0.8, 1, 0.8, D]),
      head: part([0, 5.5, 4.5], [0, 3, 6.5, 6, 5.6, 4, P], [0, 3.9, 8.9, 2.6, 1.6, 0.8, S], [0, 3.6, 8.9, 1.8, 2.2, 0.8, S],
        [-0.55, 4.3, 9.35, 0.5, 0.7, 0.1, 0x8a4a5a], [0.55, 4.3, 9.35, 0.5, 0.7, 0.1, 0x8a4a5a],
        [-1.6, 5.9, 8.55, 1, 1.2, 0.1, EYE], [1.6, 5.9, 8.55, 1, 1.2, 0.1, EYE], [-1.35, 6.6, 8.625, 0.5, 0.5, 0.05, SHINE], [1.85, 6.6, 8.625, 0.5, 0.5, 0.05, SHINE],
        [-1.9, 8.6, 7.8, 1.8, 0.6, 1.6, D], [1.9, 8.6, 7.8, 1.8, 0.6, 1.6, D], [-1.9, 7.4, 8.9, 1.8, 1.8, 0.8, D], [1.9, 7.4, 8.9, 1.8, 1.8, 0.8, D],
        [-2.6, 4.6, 8.55, 0.9, 0.6, 0.1, 0xf07f98], [2.6, 4.6, 8.55, 0.9, 0.6, 0.1, 0xf07f98]),
      legA: part([0, 2.5, 0], [-2, 0, 3, 2, 2.8, 2, D], [2, 0, -3, 2, 2.8, 2, D]),
      legB: part([0, 2.5, 0], [2, 0, 3, 2, 2.8, 2, D], [-2, 0, -3, 2, 2.8, 2, D]),
    },
  };
}

function goat() {
  const W = 0xe9e5dc, G = 0xb9b2a6, H = 0x8c7a62;
  return {
    speed: 0.5, r: 0.42, kind: 'quad',
    parts: {
      body: part([0, 0, 0], [0, 4, 0, 6, 5, 9, W], [0, 9, -1, 4, 0.1, 5, 0xf6f3ec], [0, 7, -4.9, 1.6, 2.4, 0.8, G]),
      head: part([0, 8, 4], [0, 6.5, 6.5, 4, 4.6, 4.6, W], [0, 6.4, 9.1, 2.8, 2, 0.6, G], [0, 5, 8.5, 1.4, 1.6, 1, G],
        [-1.3, 9.6, 5.6, 1, 2.2, 1, H], [1.3, 9.6, 5.6, 1, 2.2, 1, H], [-1.3, 11.4, 4.6, 1, 1, 1.2, H], [1.3, 11.4, 4.6, 1, 1, 1.2, H],
        [-2.6, 9, 6.6, 1.4, 0.8, 1.2, G], [2.6, 9, 6.6, 1.4, 0.8, 1.2, G],
        [-1, 9.2, 8.85, 0.9, 1, 0.1, EYE], [1, 9.2, 8.85, 0.9, 1, 0.1, EYE], [-0.8, 9.8, 8.925, 0.45, 0.45, 0.05, SHINE], [1.2, 9.8, 8.925, 0.45, 0.45, 0.05, SHINE]),
      legA: part([0, 4, 0], [-1.8, 0, 3, 1.6, 4.2, 1.6, G], [1.8, 0, -3, 1.6, 4.2, 1.6, G]),
      legB: part([0, 4, 0], [1.8, 0, 3, 1.6, 4.2, 1.6, G], [-1.8, 0, -3, 1.6, 4.2, 1.6, G]),
    },
  };
}

function hen(chick = false) {
  if (chick) {
    const Y = 0xf7d84a;
    return {
      speed: 0.6, r: 0.2, kind: 'bird',
      parts: {
        body: part([0, 0, 0], [0, 1, 0, 3, 2.6, 3, Y], [0, 2.4, -1.75, 1.6, 1, 0.6, 0xf0c838]),
        head: part([0, 3, 0.8], [0, 3, 0.8, 2.6, 2.4, 2.4, Y], [0, 3.8, 2.4, 1, 0.6, 0.8, 0xf29a2a], [-0.75, 4.4, 2.05, 0.6, 0.7, 0.1, EYE], [0.75, 4.4, 2.05, 0.6, 0.7, 0.1, EYE]),
        legA: part([0, 1, 0], [-0.7, 0, 0, 0.6, 1.2, 0.6, 0xf2a23a]),
        legB: part([0, 1, 0], [0.7, 0, 0, 0.6, 1.2, 0.6, 0xf2a23a]),
      },
    };
  }
  // our hen: round (two crossed boxes), brown speckles, a little tuft of feathers instead of a comb
  const W = 0xfaf7ef, L = 0x2e2a28, SP = 0xb0703a, T = 0xc8742a;
  return {
    speed: 0.55, r: 0.3, kind: 'bird',
    parts: {
      body: part([0, 0, 0], [0, 2.5, 0, 5, 3, 5.5, W], [0, 2, 0, 4, 4.4, 4.6, W], [-2.55, 3.2, -0.6, 0.1, 1, 1.2, SP], [2.55, 3.6, 0.4, 0.1, 1, 1.2, SP], [2.55, 2.8, -1.6, 0.1, 0.8, 0.8, SP],
        [-1, 6.45, -1, 1.2, 0.1, 1.2, SP], [0, 4, -3.2, 3, 3, 1.6, W], [0.6, 6.6, -3.2, 1, 0.8, 1.2, SP]),
      head: part([0, 5.5, 1.6], [0, 5, 2.2, 3, 4, 3, W], [0, 9, 2.2, 0.6, 1.4, 0.6, T], [-0.6, 9, 1.7, 0.5, 1, 0.5, T], [0.6, 9, 1.7, 0.5, 1, 0.5, T],
        [0, 6.8, 4.2, 1.6, 1, 1.4, 0xf2b632], [-1.55, 7.2, 3, 0.1, 1, 1, L], [1.55, 7.2, 3, 0.1, 1, 1, L]),
      legA: part([0, 2, 0], [-1, 0, 0.3, 0.8, 2.2, 0.8, 0xf2a23a], [-1, 0, 0.9, 1.2, 0.3, 1.2, 0xf2a23a]),
      legB: part([0, 2, 0], [1, 0, 0.3, 0.8, 2.2, 0.8, 0xf2a23a], [1, 0, 0.9, 1.2, 0.3, 1.2, 0xf2a23a]),
    },
  };
}

function cat() {
  const O = 0xf0a040, S = 0xc8742a, C = 0xfbe6c8;
  return {
    speed: 0.7, r: 0.32, kind: 'quad',
    parts: {
      body: part([0, 0, 0], [0, 2.5, 0, 4, 3.5, 8, O], [0, 6, 1.5, 4.2, 0.1, 1, S], [0, 6, -0.5, 4.2, 0.1, 1, S], [0, 6, -2.5, 4.2, 0.1, 1, S], [0, 2.4, 2, 3, 0.1, 3, C]),
      head: part([0, 5, 4], [0, 4, 5.4, 5, 4, 4, O], [-1.7, 8, 5, 1.6, 2.2, 1.2, O], [1.7, 8, 5, 1.6, 2.2, 1.2, O], [-1.7, 10.2, 5, 0.8, 0.6, 0.8, O], [1.7, 10.2, 5, 0.8, 0.6, 0.8, O], [-1.6, 8.2, 5.65, 0.8, 1, 0.1, 0xf2a0a0], [1.6, 8.2, 5.65, 0.8, 1, 0.1, 0xf2a0a0],
        [0, 8, 5.4, 1.6, 0.1, 1, S], [-1.2, 6, 7.45, 1, 1.2, 0.1, 0x47b84a], [1.2, 6, 7.45, 1, 1.2, 0.1, 0x47b84a], [-1.2, 6.2, 7.525, 0.4, 0.8, 0.05, 0x1b2a1b], [1.2, 6.2, 7.525, 0.4, 0.8, 0.05, 0x1b2a1b],
        [0, 4.2, 7.45, 2.6, 1.2, 0.1, C], [0, 5.4, 7.45, 0.8, 0.6, 0.1, 0xe87a8a]),
      legA: part([0, 2.5, 0], [-1.2, 0, 2.8, 1.4, 2.6, 1.4, O], [1.2, 0, -2.8, 1.4, 2.6, 1.4, O]),
      legB: part([0, 2.5, 0], [1.2, 0, 2.8, 1.4, 2.6, 1.4, O], [-1.2, 0, -2.8, 1.4, 2.6, 1.4, O]),
      tail: part([0, 5, -4], [0, 5, -4.4, 1.2, 4.6, 1.2, O], [0, 9.6, -4.4, 1.5, 1.5, 1.5, C]),
    },
  };
}

function duck(child = false) {
  const B = child ? 0xf7d84a : 0xfaf8f0, W = child ? 0xf0c838 : 0xdcd8cc, BILL = 0xf29a2a;
  return {
    speed: 0.35, r: child ? 0.2 : 0.32, kind: 'swim', scale: child ? 0.6 : 1,
    parts: {
      body: part([0, 0, 0], [0, 0, 0, 5, 3, 7, B], [-2.55, 1, -0.8, 0.1, 1.6, 4, W], [2.55, 1, -0.8, 0.1, 1.6, 4, W], [0, 2, -4, 3, 2, 1.6, B]),
      head: part([0, 3, 2.5], [0, 2.5, 2.6, 3, 5, 3, child ? B : 0xfaf8f0], [0, 4, 4.9, 2.4, 1, 2, BILL],
        [-1.55, 5.6, 3.1, 0.1, 1, 1, EYE], [1.55, 5.6, 3.1, 0.1, 1, 1, EYE]),
    },
  };
}

function crab() {
  const R = 0xe0482f, D = 0xb83a22;
  return {
    speed: 0.5, r: 0.3, kind: 'crab',
    parts: {
      body: part([0, 0, 0], [0, 1, 0, 6, 2.4, 4, R], [0, 3.4, 0, 4, 0.6, 3, 0xf0644a], [-1, 3.9, 1.4, 0.6, 1.1, 0.6, 0xf3e6d6], [1, 3.9, 1.4, 0.6, 1.1, 0.6, 0xf3e6d6],
        [-1, 5, 1.4, 1, 1, 1, EYE], [1, 5, 1.4, 1, 1, 1, EYE], [-1.5, 2, 2.05, 1, 0.5, 0.1, BLUSH], [1.5, 2, 2.05, 1, 0.5, 0.1, BLUSH]),
      head: part([0, 2, 2], [-3.6, 1.4, 3, 2, 1.8, 2, R], [3.6, 1.4, 3, 2, 1.8, 2, R], [-3.6, 2.2, 4.2, 1, 1, 0.4, D], [3.6, 2.2, 4.2, 1, 1, 0.4, D]),
      legA: part([0, 1.5, 0], [-3.6, 0, 1.2, 1.6, 1.2, 0.6, D], [3.6, 0, -0.2, 1.6, 1.2, 0.6, D], [-3.6, 0, -1.6, 1.6, 1.2, 0.6, D]),
      legB: part([0, 1.5, 0], [3.6, 0, 1.2, 1.6, 1.2, 0.6, D], [-3.6, 0, -0.2, 1.6, 1.2, 0.6, D], [3.6, 0, -1.6, 1.6, 1.2, 0.6, D]),
    },
  };
}

// ------------------------------------------------------------------ villagers
/** A small blocky person (our own chibi design: big head, painted face, no nose): o sets skin, clothes, hair and hat boxes. */
function person(o) {
  const head = [[0, 9, 0, 6, 6, 6, o.skin], [-1.3, 11, 3.05, 1, 1.6, 0.1, EYE], [1.3, 11, 3.05, 1, 1.6, 0.1, EYE],
    [-1.05, 12, 3.125, 0.5, 0.5, 0.05, SHINE], [1.55, 12, 3.125, 0.5, 0.5, 0.05, SHINE], [-2.3, 10.1, 3.05, 0.9, 0.6, 0.1, BLUSH], [2.3, 10.1, 3.05, 0.9, 0.6, 0.1, BLUSH]];
  if (!o.noMouth) head.push([0, 9.8, 3.05, 1.4, 0.5, 0.1, MOUTH]);
  head.push(...o.hair);
  const leg = (s) => part([s * 1.25, 4, 0], [s * 1.25, 1.2, 0, 2, 2.8, 2, o.legs], [s * 1.25, 0, 0.25, 2.2, 1.2, 2.5, o.shoes]);
  const arm = (s, extra = []) => part([s * 3.75, 8.6, 0], [s * 3.75, 5.5, 0, 1.5, 3.5, 1.5, o.sleeves ?? o.shirt], [s * 3.75, 4.3, 0, 1.4, 1.2, 1.4, o.skin], ...extra);
  return {
    speed: 0.7, r: 0.36, kind: 'person',
    parts: {
      body: part([0, 0, 0], [0, 4, 0, 6, 5, 3.5, o.shirt], ...o.body),
      head: part([0, 9, 0], ...head),
      legN: leg(-1), legP: leg(1),
      armN: arm(-1), armP: arm(1, o.carry || []),
    },
  };
}

// our farmer: a green shirt, brown dungarees, a wide straw hat with a green band, a friendly smile
function farmer() {
  const B = 0x7a5230;
  return person({
    skin: 0xf2c9a0, shirt: 0x4f9a48, legs: B, shoes: 0x3a2a1a,
    body: [[0, 3.9, 0, 6.2, 2.7, 3.7, B], [0, 6.6, 1.8, 3.2, 1.8, 0.2, B], [-1.2, 8.2, 1.8, 0.6, 0.6, 0.25, 0xd9d2c0], [1.2, 8.2, 1.8, 0.6, 0.6, 0.25, 0xd9d2c0]],
    hair: [[0, 14.6, 0, 9.4, 0.6, 9.4, 0xe5c158], [0, 15.2, 0, 6.4, 2.2, 6.4, 0xefd06a], [0, 15.3, 0, 6.6, 0.6, 6.6, 0x3f7a35],
      [-3.05, 12.4, -0.6, 0.1, 2.2, 4.4, 0x6b4a2e], [3.05, 12.4, -0.6, 0.1, 2.2, 4.4, 0x6b4a2e], [0, 12.4, -3.05, 6, 2.2, 0.1, 0x6b4a2e]],
  });
}

function girl() {
  const H = 0x5a3320;
  return person({
    skin: 0xd9a477, shirt: 0xe8558f, legs: 0xd9a477, shoes: 0xc0392b,
    body: [[0, 2.6, 0, 7, 2.6, 4.6, 0xd8457f], [0, 8.2, 0, 6.2, 0.6, 3.7, 0xffffff], [0, 3.6, 2.35, 7.2, 0.5, 0.1, 0xffffff]],
    hair: [[0, 13.6, -0.25, 6.4, 1.8, 6.6, H], [0, 9.5, -2.4, 6.4, 4.1, 1.4, H], [-3.9, 9.6, -1.2, 1.4, 3.2, 1.4, H], [3.9, 9.6, -1.2, 1.4, 3.2, 1.4, H],
      [-3.9, 12.5, -1.2, 1.9, 1, 1.9, 0xf2d13a], [3.9, 12.5, -1.2, 1.9, 1, 1.9, 0xf2d13a]],
    carry: [[3.75, 1.4, 1.4, 3, 2.2, 2.8, 0xa8763e], [3.75, 3.6, 1.4, 3.3, 0.4, 3.1, 0x7a5228], [3.1, 4, 1.0, 1.2, 1.2, 1.2, 0xe0364f], [4.5, 4, 1.9, 1.1, 1.1, 1.1, 0x7cc142], [3.6, 4.05, 2.3, 0.9, 0.9, 0.9, 0xf2a03a]],
  });
}

function fisher() {
  return person({
    skin: 0xe8b48a, shirt: 0x2f5a8a, legs: 0x6b5a3a, shoes: 0xf2c230, noMouth: true,
    body: [[0, 4.6, 0, 6.2, 0.8, 3.7, 0x5a3a22], [0, 8.6, 0, 4, 0.5, 3.7, 0x264a72]],
    hair: [[0, 8.9, 3.2, 5, 2.1, 0.3, 0xc9c2b6], [0, 13.4, 0, 6.4, 2.4, 6.4, 0xe8742a], [0, 13.2, 0, 6.6, 0.9, 6.6, 0xc85a1a], [0, 15.8, 0, 2, 1.6, 2, 0xfff0d8]],
  });
}

/** The fishing rod (a part hung on the fisher's hand): grip at the origin, the rod along +z. tip: where the line starts. */
export const ROD = { tip: [0, 0, 12.5], boxes: [[0, -0.3, 6, 0.6, 0.6, 13, 0x8a5a2a], [0.75, -0.9, 0.8, 0.8, 1.2, 1.2, 0x9aa0a8], [0, -0.25, 12.6, 0.4, 0.4, 0.6, 0x3a2a1a]] };
/** The shepherd's crook (the fisher without water): grip at the origin, a staff up with a hook on top. */
export const CROOK = { boxes: [[0, -3, 0, 0.7, 15, 0.7, 0x8a5a2a], [0, 12, 1.1, 0.7, 0.7, 2.2, 0x8a5a2a], [0, 10.6, 2.0, 0.7, 1.4, 0.7, 0x8a5a2a]] };
export const LINE = { boxes: [[0, -1, 0, 0.25, 1, 0.25, 0xf4f4f4]] };
export const BOBBER = { boxes: [[0, -0.6, 0, 1.2, 0.6, 1.2, 0xffffff], [0, 0, 0, 1.2, 0.8, 1.2, 0xe0364f]] };

export const SPECIES = {
  sheep: () => sheep(), brownSheep: () => sheep(0x94714f, 0x3a2c24, 0x2e231c, 0x6a4e3a), pig, goat, hen: () => hen(), chick: () => hen(true), cat,
  duck: () => duck(), duckling: () => duck(true), crab, farmer, girl, fisher,
};

/** Meshes the boxes of a part (fixed face shade, one 'flat' bucket) and moves the pivot to the origin. Returns { geo, boxes }. */
export function meshPart(p, pivot = [0, 0, 0]) {
  const m = new Mesher({ shade: true });
  for (const [x, y, z, w, h, d, color] of p.boxes) if (w > 0 && h > 0 && d > 0) m.box('flat', x - w / 2, y, z - d / 2, w, h, d, { color });
  const geo = m.geometries().get('flat');
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  geo.computeBoundingSphere();
  return { geo, boxes: m.boxes };
}
