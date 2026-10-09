// Feedback, the pure part (CHE-404): the context sent along, the device id, the picture fitting and the POST. No DOM here, so the
// fast tier tests it with a fake window. The dialog is src/feedback/index.js. Server side: server/feedback.mjs.
export const TEXT_MAX = 2000, PICTURE_MAX = 150 * 1024, ERRORS_KEPT = 5, ERROR_CUT = 300;
const DEVICE = 'chess3d.feedbackDevice';

const uaFamily = (ua = '') => (/Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) || /FxiOS/.test(ua) ? 'firefox' : /Chrome\/|CriOS/.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other');

/** The last console errors, kept from page start: call once from main.js. Never throws, keeps strings only. */
export function collectErrors(win = window) {
  if (win.__chessErrors) return win.__chessErrors;
  const list = win.__chessErrors = [];
  const push = (m) => { try { list.push(String(m).slice(0, ERROR_CUT)); if (list.length > 20) list.shift(); } catch (e) { /* ignore */ } };
  win.addEventListener?.('error', (e) => push(e.message || e.error));
  win.addEventListener?.('unhandledrejection', (e) => push(e.reason?.message || e.reason));
  const orig = win.console?.error;
  if (orig) win.console.error = function (...a) { push(a.map((x) => (x && x.message) || (typeof x === 'object' ? '[object]' : x)).join(' ')); return orig.apply(this, a); };
  return list;
}

/** What goes along with a report: version, device and screen, theme and view, the position and the moves, the last console errors. Never chat. */
export function buildContext({ win = window, nav = navigator, version = '', fen = '', moves = [], theme = '', view = '' } = {}) {
  return {
    version: String(version),
    device: { ua: uaFamily(nav.userAgent), touch: (nav.maxTouchPoints || 0) > 0, lang: String(nav.language || '').slice(0, 10) },
    screen: { w: Math.round(win.innerWidth || 0), h: Math.round(win.innerHeight || 0), dpr: Math.round((win.devicePixelRatio || 1) * 100) / 100 },
    theme: String(theme), view: String(view), fen: String(fen).slice(0, 100), moves: moves.slice(-200).map(String),
    errors: (win.__chessErrors || []).slice(-ERRORS_KEPT).map((e) => String(e).slice(0, ERROR_CUT)),
  };
}

/** A random id for this browser, kept in localStorage; the server counts 5 per hour per id. Survives blocked storage (a new id per call then). */
export function deviceId(store = typeof localStorage !== 'undefined' ? localStorage : null) {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  try {
    let id = store.getItem(DEVICE);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id || '')) { id = make(); store.setItem(DEVICE, id); }
    return id;
  } catch (e) { return make(); }
}

/** toData(quality) gives the base64 of a JPEG; the first quality that fits under the cap, or null (then no picture is sent). */
export function fitPicture(toData, cap = PICTURE_MAX, qualities = [0.7, 0.55, 0.4, 0.3, 0.2]) {
  for (const q of qualities) { const d = toData(q); if (d && d.length <= cap) return d; }
  return null;
}

/** POST /feedback. Resolves { ok, id } or { ok: false, error } with error: slow-down, offline, or the server's code. Never throws. */
export async function sendFeedback({ server, kind, text, name = '', picture = null, context = null, device = '', key = '', fetch: doFetch = globalThis.fetch?.bind(globalThis) }) {
  const body = { kind, text: String(text).trim(), name: String(name).trim(), device, ...(picture ? { picture } : {}), ...(context ? { context } : {}) };
  try {
    const r = await doFetch(`${String(server).replace(/\/+$/, '')}/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, id: j.id };
    return { ok: false, error: r.status === 429 ? 'slow-down' : j.error || `http-${r.status}` };
  } catch (e) { return { ok: false, error: 'offline' }; }
}
