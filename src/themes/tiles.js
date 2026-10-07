// Option tile pictures (CHE-265, CHE-287): small renders of the real game, one webp per choice in public/tiles/<kind>-<id>.webp,
// made by tools/tile-renders.mjs, never edited by hand (docs/adr/0011). Kinds: theme, set, sky, back.
// dressTile(button, kind, id) fills the tile's <i>; the row's box gets data-tiles so the tile rules in style.css apply.
export const TILE_KINDS = ['theme', 'set', 'sky', 'back'];

export const tileFile = (kind, id) => `${kind}-${id}.webp`;

/** Fill the <i> of a tile button with the picture of its choice. kind: theme | set | sky | back. */
export function dressTile(button, kind, id) {
  const i = button.querySelector('i');
  if (!i) return;
  i.style.backgroundImage = `url("${import.meta.env.BASE_URL}tiles/${tileFile(kind, id)}")`;
}

/** Mark a row's box so the tile rules in style.css apply. */
export function dressBox(box) { box.dataset.tiles = ''; }
