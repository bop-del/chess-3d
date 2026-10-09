// Server and client API version check (CHE-405, docs/ARCHITECTURE.md "API version"). GET /version of the server gives { api, minClient,
// commit }. The client has its own API (CLIENT_API) and the lowest server API it needs (NEEDS_SERVER_API). Both are plain numbers, bumped
// only by a change that breaks the other side. Server too old: the Online tab says "Server update" instead of the cards. Client too old:
// the new version banner (CHE-304). tools/release-check.mjs reads NEEDS_SERVER_API from this file.
export const CLIENT_API = 1;
export const NEEDS_SERVER_API = 1;

/** 'ok' | 'server-old' | 'client-old' | 'unknown' (no answer: the connection line already tells). A server without the route is API 0. */
export function compareApi(info, { clientApi = CLIENT_API, needs = NEEDS_SERVER_API } = {}) {
  if (!info || info.missing !== true && !Number.isFinite(info.api)) return 'unknown';
  const api = info.missing ? 0 : info.api;
  if (api < needs) return 'server-old';
  if (Number.isFinite(info.minClient) && info.minClient > clientApi) return 'client-old';
  return 'ok';
}

/** GET /version without a key: the info, { missing: true } for a 404 (server from before the route), null for no answer */
export async function fetchVersion(server, fetchFn = fetch) {
  try {
    const r = await fetchFn(server.replace(/\/+$/, '') + '/version', { cache: 'no-store' });
    if (r.status === 404) return { missing: true };
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j === 'object' ? j : null;
  } catch (e) { return null; }
}

/** Reads the version on login and on every reconnect (run()), tells onChange the verdict when it changes. */
export function createVersionCheck({ server, onChange = () => {}, fetchFn = fetch, ...limits }) {
  let verdict = 'unknown', seq = 0;
  async function run() {
    const mine = ++seq;
    const v = compareApi(await fetchVersion(server, fetchFn), limits);
    if (mine !== seq || v === 'unknown') return verdict;   // an older answer, or none: keep what we know
    if (v !== verdict) { verdict = v; onChange(v); }
    return verdict;
  }
  return { run, get verdict() { return verdict; } };
}
