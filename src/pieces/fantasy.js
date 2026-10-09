// Fantasy piece set (CHE-367, ?pieces=fantasy): the six builders, each (mat) -> THREE.Group, unit scale, front -z, at most three meshes.
import { buildPawn } from './fantasy/pawn.js';
import { buildRook } from './fantasy/rook.js';
import { buildKnight } from './fantasy/knight.js';
import { buildBishop } from './fantasy/bishop.js';
import { buildQueen } from './fantasy/queen.js';
import { buildKing } from './fantasy/king.js';

export const BUILDERS = { p: buildPawn, r: buildRook, n: buildKnight, b: buildBishop, q: buildQueen, k: buildKing };
