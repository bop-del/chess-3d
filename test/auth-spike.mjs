// Google sign-in spike (CHE-341, fast tier, no network, no browser): POST /auth-spike on the real server with a locally generated
// key pair and an injected key set (no fetch to Google). Valid token, wrong audience, wrong issuer, expired, another key, CSRF
// missing and mismatched, garbage, a return URL off the allow list, the route absent without a client id, nothing stored; and text
// checks of public/auth-spike.html (noindex, not linked, no storage). Needs server/node_modules (npm install in server/).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { loadJose } from '../server/auth-spike.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

let jose;
try { jose = await loadJose(); } catch (e) { console.log('INCOMPLETE  jose is not installed: run npm install in server/'); process.exit(3); }
const { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } = jose;

const CLIENT = 'test-client.apps.googleusercontent.com', RETURN = 'https://chess3d.borisdiebold.com/auth-spike.html';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const other = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const jwks = createLocalJWKSet({ keys: [jwk] });
const sign = (key, { iss = 'https://accounts.google.com', aud = CLIENT, sub = '1234567890', exp = '1h', kid = 'k1' } = {}) =>
  new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid }).setIssuer(iss).setAudience(aud).setSubject(sub).setIssuedAt().setExpirationTime(exp).sign(key);

const logs = [];
const start = async (authSpike) => {
  const app = createOnlineServer({ db: openDb(':memory:'), heartbeatMs: 200, log: (l) => logs.push(l), authSpike });
  return { app, base: `http://127.0.0.1:${await app.listen(0, '127.0.0.1')}` };
};
const post = (base, { credential, csrf = 'tok', cookie = csrf, raw } = {}) => fetch(base + '/auth-spike', {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: `g_csrf_token=${cookie}` } : {}) },
  body: raw ?? new URLSearchParams({ ...(credential !== undefined ? { credential } : {}), ...(csrf ? { g_csrf_token: csrf } : {}) }).toString(),
});

const s = await start({ clientId: CLIENT, returnUrl: RETURN, jwks });
const dump = () => JSON.stringify(['players', 'keys', 'challenges', 'games', 'moves', 'messages', 'actions'].map((t) => s.app.db.prepare(`SELECT * FROM ${t}`).all()));
const before = dump();
const counts = () => ['players', 'keys', 'games', 'messages'].map((t) => s.app.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n).join();
const c0 = counts();
let tokenSeen = '';
try {
  const good = await sign(privateKey);
  tokenSeen = good;
  let r = await post(s.base, { credential: good });
  ok('valid token: 303 to the page with the marker in the fragment and the sub', r.status === 303 && r.headers.get('location') === RETURN + '#spike=redirect&sub=1234567890', `${r.status} ${r.headers.get('location')}`);
  ok('the redirect target has no query string', !r.headers.get('location').includes('?'));
  const bads = [
    ['wrong audience', { credential: await sign(privateKey, { aud: 'someone-else' }) }],
    ['wrong issuer', { credential: await sign(privateKey, { iss: 'https://evil.example' }) }],
    ['expired token', { credential: await sign(privateKey, { exp: Math.floor(Date.now() / 1000) - 3600 }) }],
    ['token signed with another key', { credential: await sign(other.privateKey) }],
    ['garbage credential', { credential: 'not.a.jwt' }],
    ['missing credential', {}],
    ['missing CSRF cookie', { credential: good, cookie: '' }],
    ['CSRF field missing', { credential: good, csrf: '', cookie: 'tok' }],
    ['CSRF mismatch', { credential: good, csrf: 'a', cookie: 'b' }],
  ];
  for (const [name, o] of bads) {
    r = await post(s.base, o);
    const t = await r.text();
    ok(`${name}: 400, short text, no Location`, r.status === 400 && t.length < 20 && !r.headers.get('location'), `${r.status} ${t}`);
  }
  r = await post(s.base, { raw: 'x'.repeat(40000) });
  ok('an oversized body is refused (400)', r.status === 400);
  r = await fetch(s.base + '/auth-spike', { redirect: 'manual' });
  ok('GET /auth-spike with the client id set: 405, not a page', r.status === 405);
  ok('nothing is stored: the tables are unchanged', dump() === before && counts() === c0);
  ok('no token and no csrf value in the log lines', !logs.some((l) => l.includes(tokenSeen) || l.includes('tok')) && logs.some((l) => l.startsWith('POST /auth-spike')), logs.join('|'));
} finally { await s.app.close(); }

// the return URL must be on the allow list
const evil = await start({ clientId: CLIENT, returnUrl: 'https://evil.example/page', jwks });
try {
  const r = await post(evil.base, { credential: await sign(privateKey) });
  ok('return URL off the allow list: 400, no redirect', r.status === 400 && !r.headers.get('location'), `${r.status}`);
} finally { await evil.app.close(); }
const listed = await start({ clientId: CLIENT, returnUrl: 'https://game.example/p.html', jwks });
try {
  const l = createOnlineServer({ db: openDb(':memory:'), origins: ['https://game.example'], authSpike: { clientId: CLIENT, returnUrl: 'https://game.example/p.html', jwks } });
  const base = `http://127.0.0.1:${await l.listen(0, '127.0.0.1')}`;
  try {
    const r = await post(base, { credential: await sign(privateKey) });
    ok('an origin from ONLINE_ORIGINS is allowed as the return target', r.status === 303 && r.headers.get('location').startsWith('https://game.example/p.html#spike=redirect'), `${r.status}`);
  } finally { await l.close(); }
  const r2 = await post(listed.base, { credential: await sign(privateKey) });
  ok('an https origin not in ONLINE_ORIGINS or the fixed list is refused', r2.status === 400);
} finally { await listed.app.close(); }

// no client id: the endpoint does not exist
const off = await start({ jwks });
try {
  const g = await fetch(off.base + '/auth-spike', { redirect: 'manual' });
  const p = await post(off.base, { credential: await sign(privateKey) });
  ok('without AUTH_SPIKE_CLIENT_ID: GET and POST answer 404', g.status === 404 && p.status === 404, `${g.status} ${p.status}`);
} finally { await off.app.close(); }

// the page
const page = readFileSync(new URL('../public/auth-spike.html', import.meta.url), 'utf8');
ok('page: noindex', /<meta name="robots" content="noindex">/.test(page));
ok('page: config values at the top and the placeholder warning', /const CLIENT_ID = 'YOUR_CLIENT_ID\.apps\.googleusercontent\.com'/.test(page) && /const SPIKE_ENDPOINT = 'https:\/\/chess\.borisdiebold\.com\/auth-spike'/.test(page) && /placeholder/.test(page));
ok('page: GIS client, both flows, display-mode and sub', page.includes('https://accounts.google.com/gsi/client') && page.includes("ux_mode: 'redirect'") && page.includes('login_uri: SPIKE_ENDPOINT') && page.includes('(display-mode: standalone)') && page.includes('navigator.standalone') && /id="sub"/.test(page));
ok('page: stores nothing (no localStorage, sessionStorage, cookie, indexedDB, fetch)', !/localStorage|sessionStorage|document\.cookie|indexedDB|fetch\(/.test(page));
ok('page: no import from the game', !/\bimport\b|src=".*\/src\//.test(page.replace(/<script src="https:\/\/accounts\.google\.com[^>]*>/, '')));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : [p]; });
const ROOT = new URL('..', import.meta.url).pathname;
const linked = [ROOT + 'index.html', ...walk(ROOT + 'src')].filter((f) => /auth-spike/.test(readFileSync(f, 'utf8')));
ok('page: not linked from index.html or src/', linked.length === 0, linked.join(','));
ok('root package.json has no jose', !/jose/.test(readFileSync(ROOT + 'package.json', 'utf8')) && existsSync(ROOT + 'server/package.json'));

process.exit(failed ? 1 : 0);
