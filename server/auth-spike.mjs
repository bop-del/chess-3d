// CHE-341 spike: POST /auth-spike, the redirect flow of Google sign-in (GIS ux_mode redirect). Google POSTs the ID token here, the
// token is verified with jose and the browser is sent back to the spike page with a marker in the fragment. Nothing is stored and the
// token is never logged. jose is loaded lazily, so the rest of the server and its tests do not need server/node_modules.
export const SPIKE_GAME_ORIGIN = 'https://chess3d.borisdiebold.com';   // the fixed allow list entry for the return page
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const BODY_MAX = 16384;

/** jose, loaded on first use (the module lives in server/node_modules only). */
export const loadJose = () => import('jose');

const cookieOf = (req, name) => {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
};

/** Is the return URL on the allow list (https page of the game origin, a listed origin, or originOk)? */
export function returnAllowed(url, { origins = [], originOk = () => false } = {}) {
  try {
    const u = new URL(url);
    return u.origin === SPIKE_GAME_ORIGIN || origins.includes(u.origin) || originOk(u.origin);
  } catch (e) { return false; }
}

/**
 * createAuthSpike({ clientId, returnUrl, jwks, origins, originOk })
 * jwks: a key set function for jose (the test injects a local one); default is Google's remote set.
 * Returns { enabled, handle(req, res, path, readBody) }: handle answers true when it took the request.
 */
export function createAuthSpike({ clientId = '', returnUrl = '', jwks, origins = [], originOk } = {}) {
  const enabled = !!clientId;
  let keys = jwks;
  const text = (res, status, body, extra = {}) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra }); res.end(body); };
  const bad = (res, why) => text(res, 400, why);

  async function handle(req, res, path, readBody) {
    if (!enabled || path !== '/auth-spike') return false;
    if (req.method !== 'POST') { text(res, 405, 'POST only', { Allow: 'POST' }); return true; }
    let form;
    try { form = await readBody(req, BODY_MAX, (t) => Object.fromEntries(new URLSearchParams(t))); } catch (e) { bad(res, 'bad request'); return true; }
    const cookie = cookieOf(req, 'g_csrf_token'), field = String(form.g_csrf_token || '');
    if (!cookie || !field || cookie !== field) { bad(res, 'csrf'); return true; }
    if (!returnAllowed(returnUrl, { origins, originOk })) { bad(res, 'bad return'); return true; }
    try {
      const jose = await loadJose();
      keys ||= jose.createRemoteJWKSet(new URL(GOOGLE_JWKS));
      const { payload } = await jose.jwtVerify(String(form.credential || ''), keys, { issuer: ISSUERS, audience: clientId, algorithms: ['RS256'] });
      if (!payload.sub) throw new Error('no sub');
      const to = new URL(returnUrl);
      to.hash = `spike=redirect&sub=${encodeURIComponent(String(payload.sub))}`;
      text(res, 303, '', { Location: to.href });
    } catch (e) { bad(res, 'bad token'); }   // the reason and the token stay out of the answer and the log
    return true;
  }
  return { enabled, handle };
}
