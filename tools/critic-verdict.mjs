// CHE-388 critic verdict files: one JSON per lane and critic round at .tmp/critic/round-<n>.json.
//   node tools/critic-verdict.mjs <file...>                    validate (exit 1 on a problem, one line per problem)
//   node tools/critic-verdict.mjs --index=<index.json> <file>  also check that every variant of the clips index has a verdict
//   node tools/critic-verdict.mjs --latest [<dir>]             print the path of the newest round file (default .tmp/critic)
// Shape (tools/critic-verdict.schema.json is the same in JSON Schema): { lane, key, round, critic, date, variants: [ { id, label?,
// score 1..10, rank 1..n, fixed[], deferred[], pros[], cons[], pref, why? } ] }. Text is German where the owner reads it (pros, cons,
// why, label): bin/picks in the private repo puts them on the morning page.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isStr = (x) => typeof x === 'string' && x.trim() !== '';
const strList = (x) => Array.isArray(x) && x.every(isStr);

/** All problems of one verdict object as strings; an empty list means valid. `clipVariants` (optional) are the variant ids of the clips index. */
export function validateVerdict(v, { clipVariants } = {}) {
  const bad = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['not an object'];
  if (!isStr(v.lane)) bad.push('lane: non empty string (the lane name, for example che-370-world-menu)');
  if (!isStr(v.key) || !/^CHE-\d+$/.test(v.key)) bad.push('key: a Linear key like CHE-370');
  if (!Number.isInteger(v.round) || v.round < 1) bad.push('round: integer >= 1');
  if (!isStr(v.critic)) bad.push('critic: non empty string (the critic agent or model)');
  if (!isStr(v.date) || Number.isNaN(Date.parse(v.date))) bad.push('date: ISO date time');
  if (!Array.isArray(v.variants) || v.variants.length === 0) { bad.push('variants: non empty array'); return bad; }
  const ids = new Set(), ranks = new Set();
  v.variants.forEach((x, i) => {
    const at = `variants[${i}]${x && x.id ? ` (${x.id})` : ''}`;
    if (!x || typeof x !== 'object') { bad.push(`${at}: not an object`); return; }
    if (!isStr(x.id)) bad.push(`${at}.id: non empty string`);
    else if (ids.has(x.id)) bad.push(`${at}.id: duplicate`); else ids.add(x.id);
    if (!Number.isInteger(x.score) || x.score < 1 || x.score > 10) bad.push(`${at}.score: integer 1 to 10`);
    if (!Number.isInteger(x.rank) || x.rank < 1 || x.rank > v.variants.length) bad.push(`${at}.rank: integer 1 to ${v.variants.length}`);
    else if (ranks.has(x.rank)) bad.push(`${at}.rank: ${x.rank} used twice`); else ranks.add(x.rank);
    for (const f of ['fixed', 'deferred', 'pros', 'cons']) if (!strList(x[f])) bad.push(`${at}.${f}: array of non empty strings (may be empty)`);
    if (typeof x.pref !== 'boolean') bad.push(`${at}.pref: true or false`);
    for (const f of ['label', 'why']) if (x[f] !== undefined && !isStr(x[f])) bad.push(`${at}.${f}: non empty string when present`);
  });
  const byRank = [...v.variants].filter((x) => x && Number.isInteger(x.rank) && Number.isInteger(x.score)).sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) if (byRank[i].score > byRank[i - 1].score) bad.push(`rank: ${byRank[i].id} has a higher score than ${byRank[i - 1].id} but a worse rank`);
  if (clipVariants) for (const id of clipVariants) if (!ids.has(id)) bad.push(`variants: no verdict for clip variant ${id}`);
  return bad;
}

/** Newest round file of a critic folder (highest round number), or null. */
export function latestRound(dir) {
  if (!existsSync(dir)) return null;
  const rounds = readdirSync(dir).map((f) => ({ f, n: Number((f.match(/^round-(\d+)\.json$/) || [])[1]) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  return rounds.length ? join(dir, rounds[0].f) : null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--latest')) {
    const dir = args.find((a) => !a.startsWith('--')) || '.tmp/critic';
    const f = latestRound(resolve(dir));
    if (!f) { console.error(`no round-<n>.json in ${dir}`); process.exit(1); }
    console.log(f); process.exit(0);
  }
  const idx = (args.find((a) => a.startsWith('--index=')) || '').slice(8);
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) { console.error('usage: node tools/critic-verdict.mjs [--index=<index.json>] <round-n.json...> | --latest [<dir>]'); process.exit(2); }
  const clipVariants = idx ? [...new Set(JSON.parse(readFileSync(idx, 'utf8')).map((e) => e.variant))] : undefined;
  let code = 0;
  for (const f of files) {
    let problems;
    try { problems = validateVerdict(JSON.parse(readFileSync(f, 'utf8')), { clipVariants }); } catch (e) { problems = [`unreadable: ${e.message}`]; }
    if (problems.length) { code = 1; console.log(`FAIL ${f}`); for (const p of problems) console.log(`  ${p}`); } else console.log(`ok ${f}`);
  }
  process.exit(code);
}
