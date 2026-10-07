// News rules and data (CHE-235), fast tier, no browser: node test/news.mjs   Exit 0 when every case holds, 1 otherwise.
import { shouldAutoOpen, parse, releaseUrl, decide, isUnread, pickVariant } from '../src/news-rules.js';
import { NEWS } from '../src/news-data.js';
import { readFileSync } from 'node:fs';

const cases = [];
const check = (name, ok) => cases.push({ name, ok: !!ok });
check('a new second number opens', shouldAutoOpen('1.6.0', '1.7.0'));
check('a new first number opens', shouldAutoOpen('1.6.3', '2.0.0'));
check('a patch does not open', !shouldAutoOpen('1.6.0', '1.6.1'));
check('the same version does not open', !shouldAutoOpen('1.6.0', '1.6.0'));
check('an older version does not open', !shouldAutoOpen('1.7.0', '1.6.0') && !shouldAutoOpen('2.0.0', '1.9.9'));
check('nothing remembered (first visit) does not open', !shouldAutoOpen(null, '1.6.0') && !shouldAutoOpen('', '1.6.0'));
check('a broken stored value does not open', !shouldAutoOpen('abc', '1.6.0') && parse('x') === null);
check('release link', releaseUrl('1.6.0') === 'https://github.com/bop-del/chess-3d/releases/tag/v1.6.0');

// CHE-333: the first visit to the new address, the dot, the variant
const on = (o) => decide({ current: '1.10.1', newHost: true, ...o });
const off = (o) => decide({ current: '1.10.1', newHost: false, ...o });
check('new host, true first visit (nothing remembered): opens, remembers, marks', (() => { const d = on({ last: null, first: false }); return d.open && d.write && d.mark; })());
check('new host, second load (marker set): does not open', !on({ last: '1.10.1', first: true }).open && !on({ last: null, first: true }).open);
check('new host, older minor remembered, no marker: opens', on({ last: '1.9.0', first: false }).open);
check('new host, current minor already remembered: silent, marker set', (() => { const d = on({ last: '1.10.0', first: false }); return !d.open && d.mark; })());
check('new host, after the marker the normal rule applies: minor opens, patch silent', on({ last: '1.9.0', first: true }).open && !on({ last: '1.10.0', first: true }).open);
check('other host, first visit stays silent as before', (() => { const d = off({ last: null, first: false }); return !d.open && d.write && !d.mark; })());
check('other host: patch silent, minor opens, same silent', !off({ last: '1.10.0' }).open && off({ last: '1.9.0' }).open && !off({ last: '1.10.1' }).open && !off({ last: '1.10.1' }).write);
check('the dot: unread while the remembered version is older', isUnread('1.9.0', '1.10.1') && isUnread('1.10.0', '1.10.1'));
check('the dot: gone when current or newer, none for nothing remembered or junk', !isUnread('1.10.1', '1.10.1') && !isUnread('2.0.0', '1.10.1') && !isUnread(null, '1.10.1') && !isUnread('x', '1.10.1'));
check('variant: a, b, c pass; anything else is the default a', ['a', 'b', 'c'].every((v) => pickVariant(v) === v) && pickVariant('z') === 'a' && pickVariant(null) === 'a');
{ // storage blocked: reading the rules never touches storage; the mount wraps access in try/catch (page test covers it)
  const src = readFileSync(new URL('../src/news.js', import.meta.url), 'utf8');
  check('every localStorage access in news.js sits in try/catch', (src.match(/localStorage\./g) || []).length === (src.match(/try \{[^}]*localStorage\./g) || []).length);
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
check('the newest News entry is the package version', NEWS[0].version === pkg);
check('newest first, strictly descending', NEWS.every((n, i) => i === 0 || (parse(NEWS[i - 1].version).join() > '' && (() => { const a = parse(NEWS[i - 1].version), b = parse(n.version); return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))); })())));
check('every entry has 3 to 5 points in German and English', NEWS.every((n) => /^\d{4}-\d\d-\d\d$/.test(n.date) && n.de.length >= 3 && n.de.length <= 5 && n.de.length === n.en.length && [...n.de, ...n.en].every((p) => typeof p === 'string' && p.trim())));
check('backfill: 1.4.0, 1.5.0 and 1.6.0 are there', ['1.4.0', '1.5.0', '1.6.0'].every((v) => NEWS.some((n) => n.version === v)));

let bad = 0;
for (const c of cases) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`); if (!c.ok) bad++; }
console.log(bad ? `NEWS FAILED (${bad})` : 'NEWS OK');
process.exit(bad ? 1 : 0);
