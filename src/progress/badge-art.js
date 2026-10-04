// The look of a badge, drawn in SVG, no asset files: a round medal with a ribbon (decided by the owner, N3).
// The colours are CSS custom properties set per family and per state in badges.css (--bc base, --bc2 dark rim, --bcl light), so the SVG
// carries no colour and a locked badge is the same drawing in grey. The viewBox is 0 0 64 72 and the glyph centre (32, 30). Own markup only: no player text goes into it.
const ICON = {
  puzzles: '<path d="M0 -6.5 L1.8 -1.8 L6.5 0 L1.8 1.8 L0 6.5 L-1.8 1.8 L-6.5 0 L-1.8 -1.8Z"/>',                                // sparkle: the aha
  openings: '<path d="M-7 -4.5 Q-3.5 -6 -0.7 -4 V5.5 Q-3.5 3.8 -7 5Z M7 -4.5 Q3.5 -6 0.7 -4 V5.5 Q3.5 3.8 7 5Z"/>',                 // an open book
  daily: '<path d="M0 -7.5 C3.5 -3.5 5.5 -1.2 5.5 2 A5.5 5.5 0 0 1 -5.5 2 C-5.5 -0.6 -3.4 -2.6 -2 -4.4 C-1.6 -2.6 -1 -1.8 -0.2 -1.4 C-0.4 -3.6 -0.5 -5.4 0 -7.5Z"/>', // a flame
  wins: '<path d="M-5.5 -7 H5.5 V-1.5 A5.5 5.5 0 0 1 -5.5 -1.5Z M-5.5 -5 H-9 V-3 A4 4 0 0 0 -5.5 0.5 V-1.4 A2.4 2.4 0 0 1 -7 -3.2 V-3.4 H-5.5Z M5.5 -5 H9 V-3 A4 4 0 0 1 5.5 0.5 V-1.4 A2.4 2.4 0 0 0 7 -3.2 V-3.4 H5.5Z M-1.3 3.5 H1.3 V7 H-1.3Z M-4.5 7 H4.5 V9.2 H-4.5Z"/>', // a cup
};
const STAR = '<path d="M0 -6.5 L1.9 -2.1 L6.6 -1.7 L3 1.4 L4.1 6 L0 3.5 L-4.1 6 L-3 1.4 L-6.6 -1.7 L-1.9 -2.1Z"/>';

/** The centre of the badge: an icon and a number, or for a win the cup and one pip per level. */
function glyph(family, label, pips) {
  if (family === 'wins') {
    const dots = Array.from({ length: 4 }, (_, i) => `<circle cx="${32 + (i - 1.5) * 7}" cy="46" r="2.1" class="bd-pip${i < pips ? ' on' : ''}"/>`).join('');
    return `<g class="bd-g" transform="translate(32 24.5) scale(1.3)">${ICON.wins}</g>${dots}`;
  }
  const size = label.length >= 3 ? 14 : label.length === 2 ? 17 : 20;
  const icon = family === 'openings' && label === '★' ? STAR : ICON[family];
  const text = label === '★' ? '' : `<text x="32" y="${size >= 20 ? 45 : 43}" text-anchor="middle" class="bd-num" font-size="${size}">${label}</text>`;
  return `<g class="bd-g" transform="translate(32 ${text ? 21 : 30}) scale(${text ? 1 : 1.9})">${icon}</g>${text}`;
}

const BODY = (g) => `<path class="bd-rb" d="M18 46 L11 70 L22 64 L28 71 L33 47Z"/><path class="bd-rb" d="M46 46 L53 70 L42 64 L36 71 L31 47Z"/>
    <circle class="bd-rim" cx="32" cy="30" r="27"/><circle class="bd-face" cx="32" cy="30" r="21.5"/><path class="bd-shine" d="M15 24 A19 19 0 0 1 33 11"/>${g}`;

/** The SVG markup of one badge. `label` is the number in the middle ('★' for all openings), `pips` the level of a win (1 to 4). */
export function badgeSvg({ family, label = '', pips = 0 }) {
  return `<svg class="bd" viewBox="0 0 64 72" role="img" focusable="false" aria-hidden="true">${BODY(glyph(family, String(label), pips))}</svg>`;
}
