// When the News open by themselves (CHE-235). Pure, no DOM, unit tested in test/news.mjs.
//   never on a first visit (nothing remembered: the caller only remembers the version), never for a patch, only forwards:
//   a new first or second number (1.6.0 to 1.7.0 or 2.0.0) opens them, 1.6.0 to 1.6.1 and any older version do not.
export const parse = (v) => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; };

export function shouldAutoOpen(last, current) {
  const a = parse(last), b = parse(current);
  if (!a || !b) return false;
  return b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]);
}

// CHE-333: the first visit to the new address (chess3d.borisdiebold.com) opens the News once, also when nothing is remembered, unless the
// visitor already has the current first and second number remembered. `newHost` and `first` (the stored marker chess3d.newsFirst) come from
// the caller; this module never looks at the host. Returns what to do: { open, write (remember the version), mark (set the marker), why }.
export function decide({ last, current, newHost = false, first = false }) {
  if (newHost && !first) {
    const go = last == null || shouldAutoOpen(last, current);
    return { open: go, write: last !== current, mark: true, why: go ? 'first on new host' : 'known on new host' };
  }
  if (last == null) return { open: false, write: true, mark: false, why: 'first visit' };
  if (last === current) return { open: false, write: false, mark: false, why: 'same' };
  const go = shouldAutoOpen(last, current);
  return { open: go, write: true, mark: false, why: go ? 'opened' : 'patch' };
}

// The dot on the News entry: the newest News version is newer than the remembered one (nothing remembered: no dot, there is nothing to catch up on).
export function isUnread(seen, newest) {
  const a = parse(seen), b = parse(newest);
  if (!a || !b) return false;
  return b[0] > a[0] || (b[0] === a[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] > a[2])));
}


export const releaseUrl = (version) => `https://github.com/bop-del/chess-3d/releases/tag/v${version}`;
