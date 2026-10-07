// CHE-315: the land check for URL flags. Fails when src reads a URL parameter name that docs/preview-flags.json does not
// list (a preview flag under "flags", anything else under "normal"). The lead wires it into the land step (bin/lane land)
// next to the fast tier. Usage: node tools/check-flags.mjs    Exit 0 clean, 1 with the unregistered names and where they are read.
import { loadRegistry, registered, scanReaders } from './flag-scan.mjs';

const known = registered(loadRegistry()), unknown = [...scanReaders()].filter(([n]) => !known.has(n));
if (!unknown.length) { console.log(`flags: ${known.size} registered, every URL flag src reads is listed`); process.exit(0); }
for (const [n, where] of unknown) console.error(`UNREGISTERED URL flag "${n}" read at ${where.join(', ')}: add it to docs/preview-flags.json (flags if it picks a variant, else normal)`);
process.exit(1);
