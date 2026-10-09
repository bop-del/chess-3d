// The Wild capture scenes of the lit themes (CHE-369, Options Scene row, ?capture=wild): they replace the capture scenes of
// Classic, Tournament, Wood, Metal and Glass, and add a checkmate finale. Nothing here loads while Normal is on.
import wild from './wild.js';
export { createFinale } from './finale.js';

// the scene module for one attacker type: { attacker, cam, run(ctx) }
export function scene(variant, type) {
  return wild.forType ? wild.forType(type) : wild;
}
