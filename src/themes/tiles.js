// Option tile pictograms (CHE-265), a preview behind ?tiles=a|b|c. Without the flag the tiles keep their two colour dot.
//   a  small real renders of the game (public/tiles/<kind>-<id>.webp, made by tools/tile-renders.mjs)
//   b  pixel icons drawn on a 16 x 16 canvas in code (the Pixelwelt look)
//   c  plain line icons, inline SVG in code
// Kinds: theme, set, sky, back. dressTile(button, kind, id, colours) fills the tile's <i>; the row's box gets data-tiles.
export const TILE_KINDS = ['theme', 'set', 'sky', 'back'];

export function tileStyle(search = typeof location !== 'undefined' ? location.search : '') {
  const v = new URLSearchParams(search).get('tiles');
  return v === 'a' || v === 'b' || v === 'c' ? v : null;
}

export const tileFile = (kind, id) => `${kind}-${id}.webp`;

// ---------------------------------------------------------------- style b: pixel icons (16 x 16)
const N = 16;
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const mix = (a, b, k) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};
const SKY_BANDS = {   // top colour, bottom colour of the pixel gradient, per sky
  evening: ['#5b86d6', '#ffd6a8'], night: ['#070b22', '#2a3a7a'], sunrise: ['#4a5a9e', '#ff9a68'], storm: ['#2a303f', '#7c8696'], snow: ['#9fb0c8', '#eaf0f8'],
};
function skyLayer(g, id) {
  const [top, bot] = SKY_BANDS[id];
  for (let y = 0; y < N; y++) px(g, 0, y, N, 1, mix(top, bot, Math.min(1, Math.floor(y / 3) / 4)));   // five bands
  if (id === 'evening') { px(g, 10, 7, 4, 4, '#fff2cf'); px(g, 9, 8, 6, 2, '#fff2cf'); px(g, 5, 4, 3, 1, '#ffe9d6'); }
  else if (id === 'sunrise') { px(g, 6, 9, 5, 7, '#ffd9a0'); px(g, 5, 11, 7, 5, '#ffb070'); px(g, 3, 5, 4, 1, '#ffc7ae'); px(g, 11, 4, 3, 1, '#ffc7ae'); }
  else if (id === 'night') {
    px(g, 9, 3, 4, 5, '#f4f0d0'); px(g, 11, 4, 3, 3, mix(top, bot, 0.15));   // crescent: a disc with a bite
    for (const [x, y] of [[2, 2], [5, 6], [3, 10], [13, 12], [7, 1]]) px(g, x, y, 1, 1, '#ffffff');
  } else if (id === 'storm') {
    px(g, 2, 2, 8, 3, '#59606e'); px(g, 5, 1, 7, 3, '#59606e'); px(g, 8, 4, 6, 2, '#4a505c');
    px(g, 8, 6, 3, 2, '#ffe35a'); px(g, 7, 8, 3, 2, '#ffe35a'); px(g, 8, 10, 2, 3, '#ffe35a');
    px(g, 3, 8, 1, 2, '#9fc4ff'); px(g, 12, 9, 1, 2, '#9fc4ff'); px(g, 4, 12, 1, 2, '#9fc4ff');
  } else if (id === 'snow') {
    px(g, 3, 2, 7, 3, '#ffffff'); px(g, 6, 1, 6, 3, '#ffffff');
    for (const [x, y] of [[2, 7], [6, 9], [10, 7], [13, 10], [4, 12], [9, 13]]) px(g, x, y, 2, 2, '#ffffff');
  }
}
function backLayer(g, id, lone) {
  if (id === 'none') { if (lone) { px(g, 0, 0, N, N, '#c9d0dc'); for (let i = 3; i < 13; i++) px(g, i, i, 2, 1, '#8a93a3'); } return; }
  if (lone) for (let y = 0; y < N; y++) px(g, 0, y, N, 1, mix('#a9c8f0', '#d8e6f8', y / N));
  if (id === 'islands') {
    px(g, 2, 8, 8, 2, '#62a83c'); px(g, 3, 10, 6, 2, '#8a5f33'); px(g, 4, 12, 4, 1, '#6e4a28'); px(g, 5, 13, 2, 1, '#5a3d20');
    px(g, 10, 12, 5, 1, '#62a83c'); px(g, 11, 13, 3, 1, '#8a5f33'); px(g, 12, 14, 1, 1, '#6e4a28');
    px(g, 6, 6, 1, 2, '#4a7a2c'); px(g, 5, 4, 3, 2, '#4a7a2c');   // a tree
  } else if (id === 'castle') {
    const wall = '#808285', dark = '#5d5f62';
    px(g, 2, 8, 12, 8, wall); px(g, 2, 6, 3, 2, wall); px(g, 6, 6, 4, 2, wall); px(g, 11, 6, 3, 2, wall);   // wall with crenels
    px(g, 6, 3, 4, 5, dark); px(g, 6, 2, 1, 1, dark); px(g, 9, 2, 1, 1, dark);   // tower
    px(g, 7, 5, 2, 2, '#ffcf6a'); px(g, 4, 10, 2, 2, '#ffcf6a'); px(g, 10, 10, 2, 2, '#ffcf6a'); px(g, 7, 12, 2, 4, '#3a2c20');
  }
}
function themeIcon(g, id, [a, b]) {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px(g, x * 4, y * 4, 4, 4, (x + y) % 2 ? b : a);   // the board corner
  const fg = id === 'pixel' ? '#2f67c8' : '#c2412d';   // a pawn that stands out on both colours
  px(g, 7, 3, 2, 2, fg); px(g, 6, 5, 4, 1, fg); px(g, 7, 6, 2, 3, fg); px(g, 5, 9, 6, 2, fg); px(g, 4, 11, 8, 2, fg);
  px(g, 7, 3, 1, 1, '#ffffff');
  if (id === 'glass') { px(g, 0, 0, 1, 6, 'rgba(255,255,255,.6)'); px(g, 1, 0, 5, 1, 'rgba(255,255,255,.6)'); }
  if (id === 'metal') { px(g, 12, 1, 3, 1, '#ffffff'); px(g, 13, 2, 2, 1, '#ffffff'); }
  if (id === 'wood') { for (const y of [2, 6, 10, 14]) px(g, 0, y, N, 1, 'rgba(70,30,10,.25)'); }
  if (id === 'tournament') { px(g, 0, 0, N, 1, '#2f5a33'); px(g, 0, 15, N, 1, '#2f5a33'); }
}
export function drawPixelIcon(canvas, kind, id, colours = ['#888', '#444']) {
  canvas.width = N; canvas.height = N;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, N, N);
  if (kind === 'theme') themeIcon(g, id, colours);
  else if (kind === 'sky') skyLayer(g, id);
  else if (kind === 'back') backLayer(g, id, true);
  else if (kind === 'set') { skyLayer(g, colours.sky); backLayer(g, colours.backdrop, false); }
}

// ---------------------------------------------------------------- style c: line icons (24 x 24, currentColor)
const SVG = (inner) => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
const SUN = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
const CASTLE = '<path d="M4 20V9h3v2h2V9h2v2h2V9h2v2h2V9h3v11z"/><path d="M10 20v-4h4v4"/>';
const ISLAND = '<path d="M4 12h16c0 3-3 4-5 5l-1 3h-4l-1-3c-2-1-5-2-5-5z"/><path d="M9 12V9m3 3V7m3 5V9"/>';
const SNOWFLAKE = '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 6.5l2.5-2M9.5 19.5 12 17.5l2.5 2"/>';
const BOLTCLOUD = '<path d="M7 14a4 4 0 1 1 1.2-7.8A5 5 0 0 1 17.5 8 3.5 3.5 0 0 1 17 14"/><path d="m12 11-2 4h3l-2 4"/>';
const ICONS = {
  theme: {
    classic: '<path d="M8 21h8M9 21l1-8h4l1 8M8 13h8M10 13V9h4v4M12 9V4m-2 2h4"/>',
    tournament: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3M12 14v4m-4 3h8"/>',
    wood: '<path d="M12 3 6 12h4l-4 6h12l-4-6h4z"/><path d="M12 18v3"/>',
    metal: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/>',
    glass: '<path d="M12 3 20 10 12 21 4 10z"/><path d="M4 10h16M9 10l3 11 3-11M9 10l3-7 3 7"/>',
    pixel: '<path d="M4 4h6v6H4zM14 14h6v6h-6z"/><path d="M14 4h6v6h-6zM4 14h6v6H4z" stroke-dasharray="2 2"/>',
  },
  sky: {
    evening: `<path d="M3 17h18M6 17a6 6 0 0 1 12 0"/><path d="M12 6v2M5.6 9.6 7 11m11.4-1.4L17 11M3 13h2m14 0h2"/>`,
    night: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/><path d="M17 4v3m-1.5-1.5h3"/>',
    sunrise: '<path d="M3 18h18M7 18a5 5 0 0 1 10 0"/><path d="M12 3v5m-2.5-2.5L12 3l2.5 2.5M4 12l1.5 1.5M20 12l-1.5 1.5"/>',
    storm: BOLTCLOUD,
    snow: SNOWFLAKE,
  },
  back: {
    none: '<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>',
    islands: ISLAND,
    castle: CASTLE,
  },
  set: {
    sturmburg: '<path d="M3 21V11h3v2h2v-2h2v2h2v-2h3v10z"/><path d="M8 21v-4h3v4"/><path d="m18 3-3 5h3l-2 5"/>',
    inselmorgen: `${SUN(17, 7, 2.5)}<path d="M3 14h14c0 3-3 4-5 5l-.7 2H8.7L8 19c-2-1-5-2-5-5z"/>`,
    winterdorf: '<path d="M3 21v-8l5-4 5 4v8z"/><path d="M6.5 21v-4h3v4M18 3v8m-3.5-6.5 7 5m0-5-7 5"/>',
  },
};
export const lineIcon = (kind, id) => SVG(ICONS[kind]?.[id] || '');

// ---------------------------------------------------------------- the tile
/** Fill the <i> of a tile button. kind: theme | set | sky | back. colours: the two swatch colours (theme) or { sky, backdrop } (set). Style null leaves the dot as it is. */
export function dressTile(button, kind, id, colours, style = tileStyle()) {
  if (!style) return;
  const i = button.querySelector('i');
  if (!i) return;
  button.dataset.tile = style;
  if (style === 'a') {
    i.style.backgroundImage = `url("${import.meta.env.BASE_URL}tiles/${tileFile(kind, id)}")`;
  } else if (style === 'b') {
    const c = document.createElement('canvas');
    drawPixelIcon(c, kind, id, colours);
    i.replaceChildren(c);
  } else {
    i.innerHTML = lineIcon(kind, id);
  }
}

/** Mark a row's box so the tile rules in style.css apply. */
export function dressBox(box, style = tileStyle()) { if (style) box.dataset.tiles = style; }
