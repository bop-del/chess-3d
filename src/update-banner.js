// Offline cache and "new version" banner (CHE-304). Registers public/sw.js (release build, or ?sw=1; ?sw=0 never) and watches for a new
// worker. A new release waits in the background: the banner "New version, reload" shows, a tap activates it and reloads. The page never
// reloads on its own, so a running game is safe; without a tap the next open loads the new version (the worker activates when the last tab closes).
// Everything browser specific comes through `env` so a test can pass fakes. Hook: window.__chess.update ({ state(), check(), tap() }).
import { t } from './i18n.js';

export function swWanted(search = location.search, dflt = typeof __SW_DEFAULT__ === 'boolean' && __SW_DEFAULT__) {
  const v = new URLSearchParams(search).get('sw');
  return v === '1' ? true : v === '0' ? false : dflt;
}

export function createUpdates({ env = { sw: typeof navigator !== 'undefined' ? navigator.serviceWorker : null, doc: typeof document !== 'undefined' ? document : null, reload: () => location.reload() }, url = './sw.js' } = {}) {
  let reg = null, shown = false, tapped = false, el = null;
  const state = () => (tapped ? 'reloading' : shown ? 'banner' : reg ? 'idle' : 'off');

  function show() {
    if (shown || !env.doc) return;
    shown = true;
    el = env.doc.createElement('div');
    el.id = 'update-banner'; el.setAttribute('role', 'status');
    const b = env.doc.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.dataset.i18n = 'update.banner'; b.textContent = t('update.banner', 'New version, reload');
    b.addEventListener('click', tap);
    el.appendChild(b);
    env.doc.body.appendChild(el);
  }
  function tap() {
    if (tapped) return;
    tapped = true;
    const w = reg && reg.waiting;
    if (w) w.postMessage({ type: 'skip-waiting' }); else env.reload();   // no waiting worker (already active): just reload
  }
  function track(r) {
    if (r.waiting && env.sw.controller) show();
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && env.sw.controller) show(); });
    });
  }
  async function check() { try { if (reg) await reg.update(); } catch (e) { /* offline: try again later */ } return state(); }

  async function start() {
    if (!env.sw) return state();
    // the first worker claims the page too: only a tap may reload, never a controller change on its own
    env.sw.addEventListener('controllerchange', () => { if (tapped) env.reload(); });
    try { reg = await env.sw.register(url); } catch (e) { return state(); }
    track(reg);
    if (env.doc) env.doc.addEventListener('visibilitychange', () => { if (env.doc.visibilityState === 'visible') check(); });
    return state();
  }
  return { start, state, check, tap, show };
}
