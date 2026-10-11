// Web push in the Online tab (CHE-272). The state machine for the permission card and the bell; the browser parts (service worker,
// PushManager, Notification) come through `env` so a test can pass a fake (hook: __chessOnline.push, setEnv).
//   state(): 'unsupported' | 'install' (iPhone Safari tab: add to Home Screen first) | 'denied' | 'off' | 'on'
//   wantCard(): CHE-440: push is not on, the browser does not block it and the player did not tap "Nein danke" (the card shows at every start until then)
//   refresh(): at every start; with the permission already granted and no subscription it subscribes silently (no gesture needed), unless the player turned the bell off
// The browser prompt only comes from enable(), which only a tap on "Ja" or the bell calls. The server routes are in server/push.mjs.
const KEY = 'chess3d.push';   // { v, acted, answered, off }
const VERSION = 2;           // CHE-440: one time reset of answered and off, so players who said no before the default change start on

const b64 = (s) => { const p = s.replace(/-/g, '+').replace(/_/g, '/'); const r = atob(p + '='.repeat((4 - p.length % 4) % 4)); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

export function browserEnv() {
  return {
    sw: typeof navigator !== 'undefined' ? navigator.serviceWorker : null,
    hasPush: typeof window !== 'undefined' && 'PushManager' in window,
    Notification: typeof Notification !== 'undefined' ? Notification : null,
    iosTab: typeof document !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !(window.matchMedia && matchMedia('(display-mode: standalone)').matches),
  };
}

export function createPush({ server, getKey, env = browserEnv(), storage = (typeof localStorage !== 'undefined' ? localStorage : null), onChange = () => {}, call = null }) {
  const base = server.replace(/\/+$/, '');
  let sub = null, err = '', fail = null;   // fail: { step, message } of the last enable() that did not finish (CHE-438)
  const read = () => { try { return JSON.parse(storage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const write = (v) => { try { storage.setItem(KEY, JSON.stringify({ ...read(), ...v })); } catch (e) { /* blocked: for this page only */ } };
  if (read().v !== VERSION) write({ v: VERSION, answered: false, off: false });
  const supported = () => !!(env.sw && env.hasPush && env.Notification);
  const perm = () => (env.Notification ? env.Notification.permission : 'denied');

  function state() {
    if (env.iosTab) return 'install';
    if (!supported()) return 'unsupported';
    if (perm() === 'denied') return 'denied';
    return perm() === 'granted' && sub && !read().off ? 'on' : 'off';
  }
  const wantCard = () => { const st = state(); return (st === 'off' || st === 'install') && perm() !== 'denied' && !read().answered; };

  async function api(path, body, method = 'POST') {
    if (call) return call(path, body, method);   // preview: a fake of the three routes
    const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${getKey()}`, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body || {}) : undefined, cache: 'no-store' });
    let j = null; try { j = await r.json(); } catch (e) { /* empty */ }
    if (!r.ok) { const e = new Error(j?.error || `http ${r.status}`); e.status = r.status; throw e; }
    return j;
  }

  /** after a restart: is there a live subscription already? */
  async function refresh() {
    if (!supported() || env.iosTab) { onChange(); return state(); }
    try { const reg = await env.sw.getRegistration(); sub = reg ? await reg.pushManager.getSubscription() : null; } catch (e) { sub = null; }
    onChange();
    if (!sub && perm() === 'granted' && !read().off) return enable();   // CHE-440: allowed before, so on without a tap
    return state();
  }

  /** the first online action (a challenge sent, a game started): from now on the card may show */
  function acted() { if (!read().acted) { write({ acted: true }); onChange(); } }
  function answer(yes) { write({ answered: true }); onChange(); return yes ? enable() : Promise.resolve(state()); }

  async function enable() {
    err = ''; fail = null;
    if (!supported() || env.iosTab) return state();
    let step = 'permission';   // CHE-438: the step that is running, so a failure says which one
    try {
      const p = perm() === 'granted' ? 'granted' : await env.Notification.requestPermission();
      if (p !== 'granted') { write({ answered: true }); fail = { step, message: `permission is ${p}` }; onChange(); return state(); }
      step = 'register'; await env.sw.register('./sw.js');
      step = 'ready'; const reg = await env.sw.ready;
      step = 'key'; const { key } = await api('/push/key', null, 'GET');
      step = 'subscribe'; sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      step = 'server'; await api('/push/subscribe', sub.toJSON());
      write({ answered: true, off: false });
    } catch (e) {
      err = e.status === 404 ? 'off-server' : 'failed'; sub = null;
      fail = { step, message: `${e?.name && e.name !== 'Error' ? e.name + ': ' : ''}${e?.message || e}${e?.status ? ` (http ${e.status})` : ''}` };
    }
    onChange();
    return state();
  }

  async function disable() {
    err = '';
    const s = sub;
    sub = null; write({ off: true });
    try { if (s) { const ep = s.endpoint; await s.unsubscribe(); await api('/push/unsubscribe', { endpoint: ep }); } } catch (e) { /* the server drops a dead endpoint on its own (410) */ }
    onChange();
    return state();
  }

  return {
    state, wantCard, refresh, acted, answer, enable, disable, toggle: () => (state() === 'on' ? disable() : enable()),
    get error() { return err; },
    /** CHE-438: the step that failed last (permission, register, ready, key, subscribe, server) and its message, '' when enable() worked */
    get failStep() { return fail ? fail.step : ''; },
    /** the line for the Details panel text; never a key or an endpoint */
    detailText() { return fail ? `push: step ${fail.step} failed: ${fail.message}` : ''; },
    /** test aid: swap the browser parts for fakes */
    setEnv(e) { env = e; sub = null; onChange(); },
  };
}
