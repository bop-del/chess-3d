// Our own mini stats, the client side (CHE-291, ADR 0010): only for a logged in online player (started from src/online/index.js,
// so never without ?online). Batches errors, feature use, performance and the session, sends them to POST /events on the online
// server (the key in the Authorization header) and flushes on pagehide with keepalive. Never blocks the game: every failure is
// swallowed, the queue is capped, nothing is retried.
// Other modules report a feature without importing this file: document.dispatchEvent(new CustomEvent('chess:feature', { detail: 'name' })).
const FLUSH_MS = 15000, BATCH = 10, QUEUE_MAX = 60;

export const uaFamily = (ua = '') => (/Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) || /FxiOS/.test(ua) ? 'firefox' : /Chrome\/|CriOS/.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other');
export const fpsTier = (fps) => (fps >= 50 ? 'high' : fps >= 28 ? 'mid' : 'low');

function gpuTier(doc) {
  try {
    const c = doc.createElement('canvas'), gl = c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !gl ? 'unknown' : /swiftshader|llvmpipe|software|basic render/i.test(r) ? 'software' : r ? 'gpu' : 'unknown';
  } catch (e) { return 'unknown'; }
}

/** env is injectable for the tests: { win, doc, nav, fetch, now, setInterval } */
export function startStats({ server, key, env = {} }) {
  const win = env.win ?? (typeof window !== 'undefined' ? window : null);
  const doc = env.doc ?? (typeof document !== 'undefined' ? document : null);
  const nav = env.nav ?? (typeof navigator !== 'undefined' ? navigator : {});
  const doFetch = env.fetch ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  const now = env.now ?? (() => Date.now());
  if (!win || !doc || !doFetch || !server || !key) return null;
  if (win.__chessStats && win.__chessStats.key === key) return win.__chessStats;
  win.__chessStats?.stop();

  const device = {
    ua: uaFamily(nav.userAgent), touch: (nav.maxTouchPoints || 0) > 0,
    w: Math.round(win.screen?.width || win.innerWidth || 0), h: Math.round(win.screen?.height || win.innerHeight || 0),
    gpu: gpuTier(doc),
  };
  let queue = [], stopped = false, timer = 0;
  const started = now();
  const url = server.replace(/\/+$/, '') + '/events';
  const push = (e) => { if (!stopped) { queue.push({ ...e, device }); if (queue.length > QUEUE_MAX) queue.shift(); if (queue.length >= BATCH) flush(); } };

  function flush(keepalive = false) {
    while (queue.length) {
      const events = queue.splice(0, BATCH);
      try {
        const p = doFetch(url, { method: 'POST', keepalive, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ events }) });
        p?.catch?.(() => {});
      } catch (e) { /* never blocks the game */ }
    }
  }

  const error = (message, where) => push({ kind: 'error', message: String(message || 'error').slice(0, 300), where: String(where || 'window').slice(0, 80) });
  const feature = (name) => { if (name) push({ kind: 'feature', name: String(name).slice(0, 48) }); };
  const onError = (ev) => error(ev?.message, ev?.filename ? String(ev.filename).split('/').pop() + ':' + (ev.lineno || 0) : 'window.error');
  const onReject = (ev) => error(ev?.reason?.message || ev?.reason, 'promise');
  const onFeature = (ev) => feature(ev?.detail);
  const onHide = () => { endSession(); flush(true); };
  let ended = false;
  function endSession() { if (ended) return; ended = true; push({ kind: 'session', length: Math.round((now() - started) / 1000) }); }

  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onReject);
  win.addEventListener('pagehide', onHide);
  doc.addEventListener('chess:feature', onFeature);
  timer = (env.setInterval ?? setInterval)(() => flush(), FLUSH_MS);
  timer?.unref?.();

  // performance: the page load time and the frame rate tier over about 3 s after start (measured, not guessed)
  try {
    const nt = win.performance?.getEntriesByType?.('navigation')?.[0];
    const loadMs = Math.round(nt ? (nt.loadEventEnd || nt.domContentLoadedEventEnd || nt.duration) : win.performance?.now?.() || 0);
    const raf = win.requestAnimationFrame;
    if (raf) {
      let frames = 0, t0 = 0;
      const tick = (t) => {
        if (stopped) return;
        if (!t0) t0 = t;
        frames++;
        if (t - t0 >= 3000) push({ kind: 'perf', tier: fpsTier((frames * 1000) / (t - t0)), loadMs: Math.max(0, loadMs) });
        else raf.call(win, tick);
      };
      raf.call(win, tick);
    }
  } catch (e) { /* no perf event */ }

  const api = {
    key, error, feature, flush: () => flush(), queue: () => queue.slice(),
    stop() {
      if (stopped) return;
      stopped = true; clearInterval(timer);
      win.removeEventListener('error', onError); win.removeEventListener('unhandledrejection', onReject); win.removeEventListener('pagehide', onHide);
      doc.removeEventListener('chess:feature', onFeature);
      if (win.__chessStats === api) win.__chessStats = null;
    },
  };
  win.__chessStats = api;
  feature('online.start');
  return api;
}
