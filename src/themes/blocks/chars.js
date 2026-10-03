// The twelve block characters of the Blocks theme. The registry asks pieceStyle(ctx) for the piece style and hands it to
// pieceSet.setStyle (src/pieceset.js); the theme's materials are not used, the characters bring their own.
import { createPieceStyle } from './rig.js';

export function pieceStyle(ctx) { return createPieceStyle(ctx); }
