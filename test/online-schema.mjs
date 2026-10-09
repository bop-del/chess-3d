// Additive schema lint for the online database (CHE-406, fast tier, no browser). A server update must never lose data, so the schema
// only grows: the source of server/*.mjs may not DROP, RENAME or ALTER anything but ADD COLUMN, and the schema that openDb() builds
// must still hold every table and column of server/schema.snapshot.json (a column that vanished from the snapshot is a removal).
// A new table or column fails until the snapshot knows it: `node test/online-schema.mjs --update` only ever adds to the snapshot.
// A real exception (a destructive migration) needs its own migration step and the owner's explicit go: it is not a switch here.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP = join(ROOT, 'server', 'schema.snapshot.json');

/** the forbidden statements in a source text; comments are cut first (// comments, whole line or trailing) */
export function schemaViolations(src) {
  const out = [];
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\s\/\/.*$/, '').replace(/^\s*\/\/.*$/, '');
    const at = (why) => out.push(`${i + 1}: ${why}: ${raw.trim().slice(0, 100)}`);
    if (/\bDROP\s+(TABLE|COLUMN|INDEX|VIEW|TRIGGER)\b/i.test(line)) at('DROP');
    if (/\bRENAME\s+(TO|COLUMN)\b/i.test(line)) at('RENAME');
    const alter = line.match(/\bALTER\s+TABLE\s+\S+\s+(\w+(?:\s+\w+)?)/i);
    if (alter && !/^ADD\s+COLUMN$/i.test(alter[1])) at(`ALTER TABLE ${alter[1]}`);
    if (/\bADD\s+COLUMN\b/i.test(line) && /\bNOT\s+NULL\b/i.test(line) && !/\bDEFAULT\b/i.test(line)) at('ADD COLUMN NOT NULL without DEFAULT');
  });
  return out;
}

/** { table: { column: type } } of a fresh database */
export function currentSchema() {
  const db = openDb(':memory:'), s = {};
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    s[name] = Object.fromEntries(db.prepare(`PRAGMA table_info(${name})`).all().map((c) => [c.name, c.type]));
  }
  db.close();
  return s;
}

/** the problems between the snapshot and the current schema: removed or retyped (a break), unknown (the snapshot must be updated) */
export function schemaDiff(snap, cur) {
  const breaks = [], unknown = [];
  for (const [t, cols] of Object.entries(snap)) {
    if (!cur[t]) { breaks.push(`table ${t} is gone`); continue; }
    for (const [c, type] of Object.entries(cols)) {
      if (!(c in cur[t])) breaks.push(`column ${t}.${c} is gone`);
      else if (cur[t][c] !== type) breaks.push(`column ${t}.${c} changed type ${type} to ${cur[t][c]}`);
    }
  }
  for (const [t, cols] of Object.entries(cur)) for (const c of Object.keys(cols)) if (!snap[t] || !(c in snap[t])) unknown.push(`${t}.${c}`);
  return { breaks, unknown };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let failed = 0;
  const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
  const cur = currentSchema();
  if (process.argv.includes('--update')) {
    let snap = {}; try { snap = JSON.parse(readFileSync(SNAP, 'utf8')); } catch (e) { /* first run */ }
    const { breaks } = schemaDiff(snap, cur);
    if (breaks.length) { console.error(`refusing to update: ${breaks.join('; ')}`); process.exit(1); }
    for (const [t, cols] of Object.entries(cur)) snap[t] = { ...(snap[t] || {}), ...cols };
    writeFileSync(SNAP, JSON.stringify(snap, null, 1) + '\n');
    console.log(`snapshot updated: ${Object.keys(snap).length} tables`); process.exit(0);
  }
  // the checker itself
  ok('lint: DROP TABLE is refused', schemaViolations('db.exec("DROP TABLE moves");').length === 1);
  ok('lint: DROP COLUMN is refused', schemaViolations("ALTER TABLE players DROP COLUMN bot").length >= 1);
  ok('lint: RENAME is refused', schemaViolations('ALTER TABLE players RENAME TO people').length >= 1 && schemaViolations('ALTER TABLE players RENAME COLUMN a TO b').length >= 1);
  ok('lint: ALTER TABLE other than ADD COLUMN is refused', schemaViolations('ALTER TABLE players ALTER COLUMN x').length === 1);
  ok('lint: ADD COLUMN NOT NULL needs a DEFAULT', schemaViolations('ALTER TABLE players ADD COLUMN x INTEGER NOT NULL').length === 1 && schemaViolations('ALTER TABLE players ADD COLUMN x INTEGER NOT NULL DEFAULT 0').length === 0);
  ok('lint: ADD COLUMN and comments about DROP pass', schemaViolations('// DROP TABLE is never used\nALTER TABLE players ADD COLUMN x INTEGER   // DROP').length === 0);
  ok('lint: live.drop(id) is not SQL', schemaViolations('live.drop(id)').length === 0);
  ok('diff: a vanished column is a break', schemaDiff({ a: { x: 'INTEGER' } }, { a: {} }).breaks.length === 1 && schemaDiff({ a: { x: 'INTEGER' } }, {}).breaks.length === 1);
  ok('diff: a new column is not a break but must be in the snapshot', (() => { const d = schemaDiff({ a: {} }, { a: { y: 'TEXT' } }); return !d.breaks.length && d.unknown[0] === 'a.y'; })());
  // the real files
  for (const f of readdirSync(join(ROOT, 'server')).filter((x) => x.endsWith('.mjs'))) {
    const v = schemaViolations(readFileSync(join(ROOT, 'server', f), 'utf8'));
    ok(`server/${f}: additive schema statements only`, !v.length, v.join(' | '));
  }
  let snap; try { snap = JSON.parse(readFileSync(SNAP, 'utf8')); } catch (e) { snap = null; }
  ok('server/schema.snapshot.json exists', !!snap, 'run: node test/online-schema.mjs --update');
  if (snap) {
    const d = schemaDiff(snap, cur);
    ok('openDb() still holds every table and column of the snapshot', !d.breaks.length, d.breaks.join('; ') + ' (a removal needs its own migration step and the owner\'s go)');
    ok('the snapshot knows every table and column of openDb()', !d.unknown.length, `${d.unknown.join(', ')}: run node test/online-schema.mjs --update`);
  }
  console.log(failed ? `\nSCHEMA FAILED (${failed})` : '\nSCHEMA OK');
  process.exit(failed ? 1 : 0);
}
