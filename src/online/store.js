// Online play, the small part every page loads (CHE-271): the ?online=<server url> flag (remembered for the session) and the login
// in localStorage `chess3d.online` { server, key, name }. The invite link carries the key in the fragment (#online=<key>), never in
// the query: it is stored here and stripped from the address bar as soon as this module runs. Nothing else of online play loads
// without the flag (src/online/index.js is imported by ui.js only then).
const LOGIN = 'chess3d.online', SESSION = 'chess3d.onlineServer';

/** a usable server url (http or https, no credentials), normalised without a trailing slash, or '' */
export function cleanServer(s) {
  try {
    const u = new URL(String(s || ''));
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password) return '';
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch (e) { return ''; }
}

/** the server of a release build (vite.config.js defines __ONLINE_DEFAULT__ only with CHESS_RELEASE=1), '' in dev and test builds */
export const DEFAULT_SERVER = typeof __ONLINE_DEFAULT__ === 'string' ? cleanServer(__ONLINE_DEFAULT__) : '';

/** the server of this session: ?online=<url> (then remembered in sessionStorage), the remembered one, else the release default; '' when online play is off */
export function onlineServer(search = typeof location !== 'undefined' ? location.search : '', fallback = DEFAULT_SERVER) {
  const flag = cleanServer(new URLSearchParams(search).get('online'));
  try {
    if (flag) { sessionStorage.setItem(SESSION, flag); return flag; }
    return cleanServer(sessionStorage.getItem(SESSION)) || fallback;
  } catch (e) { return flag || fallback; }
}

export function readLogin() {
  try { const v = JSON.parse(localStorage.getItem(LOGIN) || 'null'); return v && typeof v.key === 'string' && v.key ? v : null; } catch (e) { return null; }
}
export function writeLogin(v) { try { localStorage.setItem(LOGIN, JSON.stringify({ server: v.server, key: v.key, name: v.name || null })); } catch (e) { /* storage blocked: the login lives for this page */ } }
export function clearLogin() { try { localStorage.removeItem(LOGIN); } catch (e) { /* blocked */ } }
/** the login for this server, or null (a key of another server does not count) */
export function loginFor(server) { const l = readLogin(); return l && cleanServer(l.server) === server ? l : null; }

/** the invite fragment: store the key for the session's server and strip it from the address bar at once */
export function takeFragment(loc = typeof location !== 'undefined' ? location : null, hist = typeof history !== 'undefined' ? history : null) {
  if (!loc) return null;
  const m = String(loc.hash || '').match(/^#online=([A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  try { hist?.replaceState(hist.state, '', loc.pathname + loc.search); } catch (e) { /* keep going: the key is stored anyway */ }
  const server = onlineServer(loc.search);
  if (!server) return null;
  const prev = loginFor(server);
  const v = { server, key: m[1], name: prev && prev.key === m[1] ? prev.name : null };
  writeLogin(v);
  return v;
}
export const fromLink = takeFragment();
