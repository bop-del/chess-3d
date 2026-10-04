// The twelve Pixelwelt figures as lists of boxes (the Vox format of ../blocks/vox.js). The palette (palette.js) is iron, blue and gold
// heroes against bone, moss and violet monsters. Set a (seta.js) is the base; the team figures of teams.js replace the White knight and
// king and the Black queen and king (owner decision, review round 20).
import { PAL } from './palette.js';
import { buildSetA } from './seta.js';
import { heroKnight, heroKing, monsterQueen, monsterKing, normalise } from './teams.js';

const TEAM = { wn: heroKnight, wk: heroKing, bq: monsterQueen, bk: monsterKing };

/** The box list of one figure: color 'w' or 'b', type p, n, b, r, q or k. */
export function buildPixelVox(color, type) {
  const make = TEAM[color + type];
  return make ? normalise(make(PAL[color]), type) : buildSetA(color, type, PAL[color]);
}
