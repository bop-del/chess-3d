// Animals piece set (CHE-367, ?pieces=animals): the six builders, each (mat) -> THREE.Group, unit scale, front -z, at most three meshes.
import { buildPawn } from './animals/pawn.js';
import { buildRook } from './animals/rook.js';
import { buildKnight } from './animals/knight.js';
import { buildBishop } from './animals/bishop.js';
import { buildQueen } from './animals/queen.js';
import { buildKing } from './animals/king.js';

export const BUILDERS = { p: buildPawn, r: buildRook, n: buildKnight, b: buildBishop, q: buildQueen, k: buildKing };
