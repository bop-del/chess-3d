// Online play transport, the client side (CHE-271): Server-Sent Events read with fetch and a ReadableStream (not EventSource, so
// the key travels in the Authorization header and never in a URL), plain POST for actions. The other side is server/live.mjs; a
// later switch to WebSocket touches only these two files.
// Connection states (decision 13): 'connected' (green), 'connecting' (grey: right after a drop or when the app comes back to the
// foreground), 'unreachable' (red: only after 10 s without a connection). Every (re)connect refetches the full state: the server's
// first event on a new stream is the whole state.
export const RED_AFTER_MS = 10000;
const RETRY_MS = [1000, 2000, 4000, 8000];
const RETRY_MAX_MS = 10000;
const SILENT_MS = 50000;   // no byte for this long (the heartbeat comes every 20 s): the stream is dead

export function createApi({ server, key, onState = () => {}, onStatus = () => {}, version = '', now = () => Date.now() }) {
  const base = server.replace(/\/+$/, '');
  let host = ''; try { host = new URL(base).host; } catch (e) { /* shown as '-' */ }
  let status = 'connecting', ctrl = null, retryT = 0, retryAt = 0, attempt = 0, downSince = now(), lastOk = null, lastData = 0, stopped = false;
  let info = { cause: '', request: '', status: null, error: '', host, version, time: now() };
  let hiddenAt = 0;

  const set = (s) => { if (s === status) return; status = s; onStatus(s); };
  function problem(p) {
    info = { ...info, ...p, host, version, time: now() };
    if (status === 'connected') set('connecting');
    if (downSince == null) downSince = now();
  }
  function schedule() {
    if (stopped) return;
    clearTimeout(retryT);
    const ms = info.cause === 'invite' ? 30000 : (RETRY_MS[attempt] ?? RETRY_MAX_MS);
    attempt++;
    retryAt = now() + ms;
    retryT = setTimeout(connect, ms);
  }
  const causeOf = (e) => (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : e?.name === 'TypeError' ? 'noanswer' : 'noanswer');

  async function connect() {
    if (stopped) return;
    clearTimeout(retryT); retryAt = 0;
    ctrl?.abort();
    const mine = ctrl = new AbortController();
    if (status !== 'unreachable') set('connecting');
    let r;
    try {
      r = await fetch(base + '/events', { headers: { Authorization: `Bearer ${key}`, Accept: 'text/event-stream' }, signal: mine.signal, cache: 'no-store' });
    } catch (e) {
      if (mine !== ctrl) return;
      problem({ cause: causeOf(e), request: 'GET /events', status: null, error: String(e?.message || e) });
      return schedule();
    }
    if (mine !== ctrl) return;
    if (!r.ok || !r.body) {
      problem({ cause: r.status === 401 ? 'invite' : 'server', request: 'GET /events', status: r.status, error: r.statusText || 'no stream' });
      return schedule();
    }
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '';
    lastData = now();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        lastData = now();
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          let ev = 'message'; const data = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) ev = line.slice(6).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
          }
          if (ev === 'state' && data.length) {
            let s = null; try { s = JSON.parse(data.join('\n')); } catch (e) { /* a broken event: wait for the next */ }
            if (s) {
              attempt = 0; downSince = null; lastOk = now();
              set('connected');
              onState(s);
            }
          }
        }
      }
    } catch (e) {
      if (mine !== ctrl) return;   // we closed it ourselves (reconnect, stop)
    }
    if (mine !== ctrl || stopped) return;
    problem({ cause: 'noanswer', request: 'GET /events', status: r.status, error: 'stream closed' });
    schedule();
  }

  // the red state after 10 s, and a stream that went silent
  const tick = setInterval(() => {
    if (stopped) return;
    if (status === 'connected' && now() - lastData > SILENT_MS) { problem({ cause: 'noanswer', request: 'GET /events', error: 'no heartbeat' }); connect(); return; }
    if (status === 'connecting' && downSince != null && now() - downSince >= RED_AFTER_MS) set('unreachable');
  }, 500);

  // back in the foreground after a while: the stream may have died with the app in the background, so connect afresh (grey)
  const onVis = () => {
    if (document.hidden) { hiddenAt = now(); return; }
    if (status === 'connected' && now() - hiddenAt < 5000) return;
    attempt = 0;
    if (status === 'connected') { downSince = now(); set('connecting'); }
    connect();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
  const onOnline = () => { attempt = 0; connect(); };
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline);

  async function post(path, body) {
    let r;
    try {
      r = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), cache: 'no-store' });
    } catch (e) {
      problem({ cause: causeOf(e), request: `POST ${path}`, status: null, error: String(e?.message || e) });
      const err = new Error('network'); err.net = true; throw err;
    }
    let j = null; try { j = await r.json(); } catch (e) { /* empty body */ }
    if (!r.ok) {
      if (r.status >= 500 || r.status === 401) problem({ cause: r.status === 401 ? 'invite' : 'server', request: `POST ${path}`, status: r.status, error: j?.error || r.statusText });
      const err = new Error(j?.error || `http ${r.status}`); err.status = r.status; err.code = j?.error || ''; throw err;
    }
    return j;
  }

  connect();
  return {
    get status() { return status; },
    get connected() { return status === 'connected'; },
    /** for the Details box: the last problem, when the last good contact was, ms to the next automatic retry */
    details() { return { ...info, lastOk, retryIn: retryAt ? Math.max(0, retryAt - now()) : 0 }; },
    retry() { attempt = 0; connect(); },
    post,
    stop() { stopped = true; clearInterval(tick); clearTimeout(retryT); ctrl?.abort(); ctrl = null; if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); if (typeof window !== 'undefined') window.removeEventListener('online', onOnline); },
  };
}

/** POST /login-code without a key: { key, name } or throws with .code ('wrong-code', 'slow-down') or .net */
export async function loginWithCode(server, code) {
  let r;
  try { r = await fetch(server.replace(/\/+$/, '') + '/login-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), cache: 'no-store' }); }
  catch (e) { const err = new Error('network'); err.net = true; throw err; }
  let j = null; try { j = await r.json(); } catch (e) { /* empty */ }
  if (!r.ok || !j?.key) { const err = new Error(j?.error || `http ${r.status}`); err.code = j?.error || 'server'; err.status = r.status; throw err; }
  return j;
}
