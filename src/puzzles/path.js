// The puzzle path: the fixed order of a level and its chapters. Pure: no DOM, no storage, no clock.
//
// A level (band) holds up to 100 puzzles. They are sorted by rating, easiest first (ties by id, so the order is the same on
// every device), then cut into chapters of CHAPTER_SIZE stations. Inside a chapter the themes are mixed: the puzzles of the
// chapter are dealt out round robin by theme, each theme keeping its rating order.
export const CHAPTER_SIZE = 10;

export function mixThemes(block) {
  const lanes = new Map();
  for (const p of block) { if (!lanes.has(p.theme)) lanes.set(p.theme, []); lanes.get(p.theme).push(p); }
  // the theme with the easiest puzzle leads, so a chapter still starts with its easiest one
  const order = [...lanes.values()];
  const out = [];
  while (out.length < block.length) for (const l of order) if (l.length) out.push(l.shift());
  return out;
}

/** The puzzles of one band in path order. */
export function levelOrder(puzzles, band) {
  const sorted = puzzles.filter((p) => p.band === band).sort((a, b) => (a.rating - b.rating) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out = [];
  for (let i = 0; i < sorted.length; i += CHAPTER_SIZE) out.push(...mixThemes(sorted.slice(i, i + CHAPTER_SIZE)));
  return out;
}

/** The order cut into chapters: [[puzzle x 10], ...] (the last one may be shorter). */
export function chaptersOf(order) {
  const out = [];
  for (let i = 0; i < order.length; i += CHAPTER_SIZE) out.push(order.slice(i, i + CHAPTER_SIZE));
  return out;
}
