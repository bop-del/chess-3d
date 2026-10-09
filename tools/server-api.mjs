// Live online server API against what this build needs (CHE-405). The release needs NEEDS_SERVER_API (src/online/version.js); the live
// server says its API on the public GET /version (a server from before the route answers 404 = API 0). Below the need the release
// would show "Server update" to every player, so the check is red. No answer at all is a warning (the monitor tells about outages).
// Library: neededApi(text), judge({ needed, live }), liveApi(base). CLI: node tools/server-api.mjs [--base=<server url>] [--ref=<git ref>]
// exit 0 ok or unknown, 1 red. tools/release-check.mjs calls it; the private go push check (lib/server-api-gate.mjs) does the same by hand.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './_lib.mjs';

export const LIVE_SERVER = 'https://chess.borisdiebold.com';
export const neededApi = (text) => { const m = /export const NEEDS_SERVER_API\s*=\s*(\d+)/.exec(String(text)); return m ? Number(m[1]) : null; };

/** { api, commit } of the live server; api 0 for a 404; null when it does not answer */
export async function liveApi(base = LIVE_SERVER, fetchFn = fetch) {
  try {
    const r = await fetchFn(base.replace(/\/+$/, '') + '/version', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return { api: 0, commit: '' };
    if (!r.ok) return null;
    const j = await r.json();
    return Number.isFinite(j?.api) ? { api: j.api, commit: String(j.commit || '') } : null;
  } catch (e) { return null; }
}

/** { state: 'ok' | 'red' | 'unknown', line } */
export function judge({ needed, live }) {
  if (needed == null) return { state: 'unknown', line: 'NEEDS_SERVER_API not found in src/online/version.js' };
  if (!live) return { state: 'unknown', line: `live server did not answer GET /version (this release needs API ${needed})` };
  const at = `live server API ${live.api}${live.commit ? ` (${live.commit.slice(0, 7)})` : ''}`;
  return live.api >= needed ? { state: 'ok', line: `${at}, this release needs ${needed}` } : { state: 'red', line: `${at} is below the API ${needed} this release needs: deploy the server first` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opt = (n, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  const ref = opt('ref', '');
  const text = ref ? execFileSync('git', ['show', `${ref}:src/online/version.js`], { cwd: ROOT, encoding: 'utf8' }) : readFileSync(join(ROOT, 'src/online/version.js'), 'utf8');
  const v = judge({ needed: neededApi(text), live: await liveApi(opt('base', LIVE_SERVER)) });
  console.log(`${v.state.toUpperCase()}  ${v.line}`);
  process.exit(v.state === 'red' ? 1 : 0);
}
