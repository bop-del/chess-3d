// Option tile pictures (CHE-265, CHE-287): small renders of the real game, one webp per choice in public/tiles/<kind>-<id>.webp,
// made by tools/tile-renders.mjs, never edited by hand (docs/adr/0011). Kinds: theme, set, sky, back.
// dressTile(button, kind, id) fills the tile's <i>; the row's box gets data-tiles so the tile rules in style.css apply.
export const TILE_KINDS = ['theme', 'set', 'sky', 'back'];

export const tileFile = (kind, id) => `${kind}-${id}.webp`;

const dressed = new Set();   // every tile file a row asked for, so the idle preload always matches the rows (CHE-345)
const tileUrl = (kind, id) => `${import.meta.env.BASE_URL}tiles/${tileFile(kind, id)}`;

/** Fill the <i> of a tile button with the picture of its choice. kind: theme | set | sky | back. */
export function dressTile(button, kind, id) {
  const i = button.querySelector('i');
  if (!i) return;
  dressed.add(`${kind}\t${id}`);
  i.style.backgroundImage = `url("${tileUrl(kind, id)}")`;
}

/** Fetch and decode the picture of every dressed tile (call in idle time). Resolves to the number loaded; the images stay referenced so the cache keeps them. */
const kept = [];
export function preloadAllTiles() {
  return Promise.all([...dressed].map((k) => {
    const [kind, id] = k.split('\t');
    const img = new Image();
    img.decoding = 'async';
    img.src = tileUrl(kind, id);
    kept.push(img);
    return (img.decode ? img.decode() : Promise.resolve()).then(() => 1, () => 0);
  })).then((r) => r.reduce((a, b) => a + b, 0));
}

/** Mark a row's box so the tile rules in style.css apply. */
export function dressBox(box) { box.dataset.tiles = ''; }
