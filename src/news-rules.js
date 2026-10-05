// When the News open by themselves (CHE-235). Pure, no DOM, unit tested in test/news.mjs.
//   never on a first visit (nothing remembered: the caller only remembers the version), never for a patch, only forwards:
//   a new first or second number (1.6.0 to 1.7.0 or 2.0.0) opens them, 1.6.0 to 1.6.1 and any older version do not.
export const parse = (v) => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; };

export function shouldAutoOpen(last, current) {
  const a = parse(last), b = parse(current);
  if (!a || !b) return false;
  return b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]);
}

export const releaseUrl = (version) => `https://github.com/bop-del/chess-3d/releases/tag/v${version}`;
