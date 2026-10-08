// Captured pieces layout: pure numbers, no three.js, so the fast tier can test it in node. There are no trays any more (CHE-358):
// the pieces stand on the ground (grass, or the floor) in an area (see SLAB, the name stays) at each side of the board.
// Each side has one area. Captured pieces lie inside it with a margin on every side, spaced from each piece's real
// base diameter, in two columns, ordered by value (queen, rooks, bishops, knights, pawns) from the far end of the slab toward
// the camera. The tall pieces stand at the back, so they hide as little as possible of the short ones in front.
// layoutTray(items) -> { scale, slots: [{ x, z }] } where x is relative to the slab centre line (the caller mirrors it per side)
// and slots[i] belongs to items[i]. An item is { type, dia, h }: base diameter and height in board units at scale 1.

export const SLAB = { cx: 5.75, cz: 0.96, w: 1.45, len: 4.9 };   // centre x of the right area (the left one mirrors), centre z, size
// Portrait (a phone held upright): there is no room at the sides, so both areas stand at the near end of the board (the end
// of the side the camera looks from), the black ones to the right, the white ones to the left. Each is a shorter area turned
// 90 degrees: layoutTray(items, ROWS) is in its own coordinates (z along the board, x across), rowSlots() maps it to the world.
export const ROWS = { cz: 0, w: 1.45, len: 3.7 };
export const ROW_CZ = 5.2;        // centre z of the rows (the ground of every theme reaches z 6.0 there)
export const ROW_X = 2.05;        // centre x of each row's area (it spans x 0.2 to 3.9 on its side)
export const MARGIN = 0.14;       // clear space between a piece and the slab edge, every side
const GAP = 0.05;                 // clear space between two pieces
const SCALE_MAX = 0.62, SCALE_MIN = 0.4, SCALE_STEP = 0.01;
const WIDEN = 1.15;               // the layout reserves 1.15 times each piece's base diameter, a roomier spacing in every view
const EXTRA_MAX = 0.2;            // spare depth spread between the rows while the tray is not full, never more than this per row
export const VALUE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 };
const COLS = 2;

/** World x, z of the slots of layoutTray(items, ROWS) for one color: `right` true for the black pieces, `zSign` +1 (white's end) or -1 (black's end). */
export const rowSlots = (lay, right, zSign) => lay.slots.map((p) => ({ x: (right ? 1 : -1) * (ROW_X + p.z), z: zSign * ROW_CZ + zSign * p.x }));

export const trayDepth = (area = SLAB) => area.len - 2 * MARGIN;
export const trayWidth = (area = SLAB) => area.w - 2 * MARGIN;

// rows of the value ordered list: [[itemIndex, ...], ...] and the order itself
function order(items) {
  return items.map((it, i) => i).sort((a, b) => (VALUE_ORDER[items[a].type] - VALUE_ORDER[items[b].type]) || (a - b));
}

function fitAt(items, idx, s, area) {
  const rows = [];
  for (let i = 0; i < idx.length; i += COLS) rows.push(idx.slice(i, i + COLS));
  const need = rows.map((r) => Math.max(...r.map((k) => items[k].dia)) * WIDEN * s + GAP);
  const widest = Math.max(...items.map((it) => it.dia)) * WIDEN * s;
  const fitsW = COLS * widest + GAP <= trayWidth(area) + 1e-9;
  const total = need.reduce((a, b) => a + b, 0) - GAP;
  return { rows, need, widest, fits: fitsW && total <= trayDepth(area) + 1e-9, total };
}

export function layoutTray(items, area = SLAB) {
  if (!items.length) return { scale: SCALE_MAX, slots: [] };
  const idx = order(items);
  let s = SCALE_MAX, fit = fitAt(items, idx, s, area);
  while (!fit.fits && s > SCALE_MIN + 1e-9) { s = Math.max(SCALE_MIN, +(s - SCALE_STEP).toFixed(4)); fit = fitAt(items, idx, s, area); }
  const { rows, need, widest } = fit;
  const spare = trayDepth(area) - fit.total;
  const extra = Math.max(0, Math.min(EXTRA_MAX, spare / Math.max(1, rows.length)));
  const colOff = (widest + GAP) / 2;
  const slots = new Array(items.length);
  let z = area.cz - area.len / 2 + MARGIN;                  // far edge of the usable depth
  rows.forEach((row, ri) => {
    const pitch = need[ri] - GAP + extra;                   // the row's depth: its widest base plus the spread
    const cz = z + (need[ri] - GAP) / 2;
    row.forEach((k, ci) => { slots[k] = { x: (ci === 0 ? -1 : 1) * colOff, z: cz }; });
    z += pitch + GAP;
  });
  return { scale: s, slots };
}

// Does the layout keep every piece inside the usable area and clear of the others? Returns a list of problems (tests).
export function checkLayout(items, lay, area = SLAB) {
  const bad = [];
  const half = (i) => items[i].dia * WIDEN * lay.scale / 2;
  const x0 = -trayWidth(area) / 2, x1 = trayWidth(area) / 2, z0 = area.cz - trayDepth(area) / 2, z1 = area.cz + trayDepth(area) / 2;
  items.forEach((it, i) => {
    const p = lay.slots[i], h = half(i);
    if (p.x - h < x0 - 1e-6 || p.x + h > x1 + 1e-6 || p.z - h < z0 - 1e-6 || p.z + h > z1 + 1e-6) bad.push(`${it.type}${i} leaves the margin`);
    for (let j = 0; j < i; j++) {
      const q = lay.slots[j];
      if (Math.hypot(p.x - q.x, p.z - q.z) < h + half(j) - 1e-6) bad.push(`${it.type}${i} overlaps ${items[j].type}${j}`);
    }
  });
  return bad;
}
