// The Crystal and Mech figure sets (CHE-368): loads the set module and forces its style on the piece set. Chosen by the Pieces
// row of Options (src/piece-setting.js, stored) or ?pieces=crystal|mech (this visit only). Over a lit theme only: Pixelwelt and Blocks keep their own.
const SETS = {
  crystal: () => import('./crystal.js'),
  mech: () => import('./mech.js'),
};
export const STYLE_SETS = Object.keys(SETS);

export async function applyPieceStyle({ id, pieceSet, quality }) {
  if (!SETS[id]) return null;
  const mod = await SETS[id]();
  const style = mod.createStyle({ quality });
  pieceSet.force(style);
  window.__pieceStyle = style;   // test hook: the forced style (make, height, update)
  return style;
}
