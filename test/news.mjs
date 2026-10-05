// News rules and data (CHE-235), fast tier, no browser: node test/news.mjs   Exit 0 when every case holds, 1 otherwise.
import { shouldAutoOpen, parse, releaseUrl } from '../src/news-rules.js';
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

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
check('the newest News entry is the package version', NEWS[0].version === pkg);
check('newest first, strictly descending', NEWS.every((n, i) => i === 0 || (parse(NEWS[i - 1].version).join() > '' && (() => { const a = parse(NEWS[i - 1].version), b = parse(n.version); return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))); })())));
check('every entry has 3 to 5 points in German and English', NEWS.every((n) => /^\d{4}-\d\d-\d\d$/.test(n.date) && n.de.length >= 3 && n.de.length <= 5 && n.de.length === n.en.length && [...n.de, ...n.en].every((p) => typeof p === 'string' && p.trim())));
check('backfill: 1.4.0, 1.5.0 and 1.6.0 are there', ['1.4.0', '1.5.0', '1.6.0'].every((v) => NEWS.some((n) => n.version === v)));

let bad = 0;
for (const c of cases) { console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`); if (!c.ok) bad++; }
console.log(bad ? `NEWS FAILED (${bad})` : 'NEWS OK');
process.exit(bad ? 1 : 0);
