// CHE-315: the preview flag registry (docs/preview-flags.json). Two rules, no browser:
//   1. an open flag has an item (a CHE key) or a question, and src still reads it
//   2. a picked flag has a pickRef and no reader in src
// The registry must also be well formed (unique names, a known status, no flag in both lists). That every name src reads is
// registered is checked at land time by tools/check-flags.mjs.
import { loadRegistry, scanReaders } from '../tools/flag-scan.mjs';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ` (${detail})` : ''}`); if (!ok) failed++; };

const reg = loadRegistry(), readers = scanReaders();
const names = reg.flags.map((f) => f.flag);
check('registry: a scope header and the two lists', typeof reg.scope === 'string' && reg.scope.length > 40 && Array.isArray(reg.flags) && Array.isArray(reg.normal));
check('registry: no name twice, none in both lists', new Set([...names, ...reg.normal]).size === names.length + reg.normal.length, `${names.length} preview, ${reg.normal.length} normal`);
for (const f of reg.flags) {
  const places = readers.get(f.flag) || [];
  check(`${f.flag}: status is open or picked`, f.status === 'open' || f.status === 'picked', f.status);
  if (f.status === 'open') {
    check(`${f.flag}: open flag has an item or a question`, /^CHE-\d+$/.test(f.item || '') || (typeof f.question === 'string' && f.question.length > 10));
    check(`${f.flag}: open flag is still read in src`, places.length > 0, 'no reader: mark it picked or drop the entry');
  } else if (f.status === 'picked') {
    check(`${f.flag}: picked flag has a pickRef`, typeof f.pickRef === 'string' && f.pickRef.length > 10);
    check(`${f.flag}: picked flag has no reader in src`, places.length === 0, places.join(', '));
  }
}
for (const n of reg.normal) check(`normal flag ${n}: still read in src`, readers.has(n), 'no reader: drop it from normal');
console.log(failed ? `\n${failed} check(s) failed` : '\nflag registry passed');
process.exit(failed ? 1 : 0);
