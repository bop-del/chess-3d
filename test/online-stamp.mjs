// Chat time stamp (CHE-425, fast tier, no browser): fixed clock, all five forms in both languages, the midnight edge.
import { stamp } from '../src/online/stamp.js';
import '../src/online/strings.js';
import { setLanguage } from '../src/i18n.js';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const NOW = new Date(2026, 9, 10, 15, 42).getTime();   // Sat 10 Oct 2026, local time
const at = (y, m, d, h = 21, mi = 14) => new Date(y, m - 1, d, h, mi).getTime();
const cases = [
  ['today', at(2026, 10, 10, 9, 5), '09:05', '09:05'],
  ['yesterday', at(2026, 10, 9), 'Gestern 21:14', 'Yesterday 21:14'],
  ['2 days back: weekday', at(2026, 10, 8), 'Do 21:14', 'Thu 21:14'],
  ['6 days back: weekday', at(2026, 10, 4), 'So 21:14', 'Sun 21:14'],
  ['7 days back: date', at(2026, 10, 3), '3. Okt. 21:14', 'Oct 3 21:14'],
  ['same year', at(2026, 9, 29), '29. Sep. 21:14', 'Sep 29 21:14'],
  ['another year', at(2025, 12, 12), '12. Dez. 2025 21:14', 'Dec 12, 2025 21:14'],
];
for (const [lang, idx] of [['de', 2], ['en', 3]]) {
  setLanguage(lang);
  for (const c of cases) { const got = stamp(c[1], NOW); ok(`${lang}: ${c[0]}`, got === c[idx], `${got} != ${c[idx]}`); }
}
setLanguage('de');
const MID = new Date(2026, 9, 10, 0, 0).getTime();
ok('midnight edge: 23:59 the evening before is yesterday', stamp(at(2026, 10, 9, 23, 59), MID) === 'Gestern 23:59');
ok('midnight edge: 00:00 of today is only the time', stamp(MID, MID) === '00:00');
ok('a stamp from the future (clock skew) is only the time', stamp(NOW + 3600e3, NOW) === '16:42');
setLanguage('en');
if (failed) { console.log(`${failed} failed`); process.exit(1); }
