// The twelve Pixelwelt figures as lists of boxes (the Vox format of ../blocks/vox.js). The palette (palette.js) is iron, blue and gold
// heroes against bone, moss and violet monsters. Set a (seta.js) is the base; the team figures of teams.js replace the White knight and
// king and the Black queen and king (owner decision, review round 20).
import { PAL } from './palette.js';
import { buildSetA } from './seta.js';
import { heroKnight, heroKing, monsterQueen, monsterKing, normalise } from './teams.js';
import { coplanarOverlaps } from '../blocks/mesher.js';

import { teamVox } from './heroes.js';

const TEAM = { wn: heroKnight, wk: heroKing, bq: monsterQueen, bk: monsterKing };

/** The box list of one figure: color 'w' or 'b', type p, n, b, r, q or k. ?pixteam= (heroes.js, CHE-372) swaps in a team variant. */
export function buildPixelVox(color, type) {
  const make = TEAM[color + type];
  const vox = teamVox(color, type) || (make ? normalise(make(PAL[color]), type) : buildSetA(color, type, PAL[color]));
  return pushClashes(vox);
}

// CHE-299 figeps: two parts of a figure that draw a face on the same plane the same way round z fight (the sash of the
// white pawn against its lower robe, the collars, the eye lines). The later part of each pair is pushed out by 0.06 voxel (about 0.002 world
// units, above the depth rounding at the farthest zoom) on the clashing face, so it always wins (a bottom face on the board is skipped: it is never seen and the figure must stand on y 0). test/pixel-rules.mjs checks only the world.
const FACE = { px: [0, 1], nx: [0, -1], py: [1, 1], ny: [1, -1], pz: [2, 1], nz: [2, -1] };
function pushClashes(vox, push = 0.06) {
  const boxes = vox.parts.filter((p) => !p.ry).map((p) => ({ part: p, x: p.x - p.w / 2, y: p.y, z: p.z - p.d / 2, w: p.w, h: p.h, d: p.d, ry: 0, color: p.color, faces: { px: 1, nx: 1, py: 1, ny: 1, pz: 1, nz: 1 } }));
  const owner = new Map(boxes.map((b, i) => [b, i]));
  for (let pass = 0; pass < 4; pass++) {   // a pushed part can meet the next plane: go on until nothing clashes (two or three passes)
    const clashes = coplanarOverlaps(boxes);
    if (!clashes.length) break;
    for (const { a, b, face } of clashes) {
      const later = owner.get(a) > owner.get(b) ? a : b, p = later.part, [ax, sign] = FACE[face];
      if (ax === 0) { p.w += push; p.x += sign * push / 2; later.w = p.w; later.x = p.x - p.w / 2; } else if (ax === 1) { if (sign < 0 && p.y - push < 0) continue; p.h += push; later.h = p.h; if (sign < 0) { p.y -= push; later.y = p.y; } } else { p.d += push; p.z += sign * push / 2; later.d = p.d; later.z = p.z - p.d / 2; }
    }
  }
  return vox;
}
