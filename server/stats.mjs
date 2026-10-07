// Our own mini stats (CHE-291, ADR 0010): events from logged in online players, raw for 90 days, a daily roll up forever, and a
// server rendered dashboard. No player id and no IP is stored: an event is (time, kind, name, device class, value, data).
// Kinds: error { message, where, device }, feature { name, device }, perf { tier, loadMs, device }, session { length, device }.
import { timingSafeEqual } from 'node:crypto';
import { sha256 } from './db.mjs';

export const RAW_DAYS = 90;
export const BATCH_MAX = 20;          // events per POST
export const EVENTS_BODY_MAX = 16384; // bytes per POST
export const DAILY_MAX = 2000;        // events per key and day
const DAY_MS = 24 * 3600 * 1000;
const UA = ['chrome', 'safari', 'firefox', 'edge', 'other'];
const GPU = ['gpu', 'software', 'unknown'];
const TIERS = ['high', 'mid', 'low'];

export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const tag = (v, max) => str(v, max).replace(/[^A-Za-z0-9._:/ -]/g, '');

/** the device class a sum is kept under: "safari touch", "chrome pointer" */
function deviceOf(d) {
  if (!d || typeof d !== 'object') return null;
  const ua = UA.includes(d.ua) ? d.ua : 'other';
  const touch = d.touch ? 'touch' : 'pointer';
  const gpu = GPU.includes(d.gpu) ? d.gpu : 'unknown';
  const w = int(d.w, 0, 20000) ?? 0, h = int(d.h, 0, 20000) ?? 0;
  return { cls: `${ua} ${touch}`, full: { ua, touch: !!d.touch, gpu, w, h } };
}

/** Validate one event. Returns { kind, name, device, value, data } or null (refused: the whole batch is refused on one bad event). */
export function cleanEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const dev = deviceOf(e.device);
  if (!dev) return null;
  const base = { device: dev.cls };
  switch (e.kind) {
    case 'error': {
      const message = str(e.message, 300), where = tag(e.where, 80);
      if (!message || !where) return null;
      return { ...base, kind: 'error', name: where, value: null, data: { message, device: dev.full } };
    }
    case 'feature': {
      const name = tag(e.name, 48);
      if (!name) return null;
      return { ...base, kind: 'feature', name, value: null, data: null };
    }
    case 'perf': {
      const loadMs = int(e.loadMs, 0, 600000);
      if (!TIERS.includes(e.tier) || loadMs == null) return null;
      return { ...base, kind: 'perf', name: e.tier, value: loadMs, data: { device: dev.full } };
    }
    case 'session': {
      const length = int(e.length, 0, 86400);
      if (length == null) return null;
      return { ...base, kind: 'session', name: 'session', value: length, data: null };
    }
    default: return null;
  }
}

export function createStats(db, { now = () => Date.now() } = {}) {
  const q = (sql) => db.prepare(sql);
  const perKeyDay = new Map();   // key id + day -> events accepted (in memory, resets on restart)

  /** Store a batch. Returns { n } or { error } with an HTTP status. */
  function ingest(keyId, body) {
    const list = body && Array.isArray(body.events) ? body.events : null;
    if (!list || !list.length || list.length > BATCH_MAX) return { status: 400, error: 'bad-batch' };
    const clean = list.map(cleanEvent);
    if (clean.some((c) => !c)) return { status: 400, error: 'bad-event' };
    const t = now(), day = dayOf(t), k = `${keyId}:${day}`;
    const used = perKeyDay.get(k) || 0;
    if (used + clean.length > DAILY_MAX) return { status: 429, error: 'daily-limit' };
    for (const key of perKeyDay.keys()) if (!key.endsWith(day)) perKeyDay.delete(key);
    perKeyDay.set(k, used + clean.length);
    const ins = q('INSERT INTO events (at, day, kind, name, device, value, data) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of clean) ins.run(t, day, c.kind, c.name, c.device, c.value, c.data ? JSON.stringify(c.data) : null);
    return { n: clean.length };
  }

  /** Daily roll up of every finished day still in the raw table, then drop raw events older than 90 days. */
  function maintain() {
    const t = now(), today = dayOf(t), cutoff = dayOf(t - RAW_DAYS * DAY_MS);
    db.exec('BEGIN IMMEDIATE');
    try {
      q(`INSERT OR REPLACE INTO stats_daily (day, kind, name, device, n, v)
         SELECT day, kind, name, device, COUNT(*), COALESCE(SUM(value), 0) FROM events WHERE day < ? GROUP BY day, kind, name, device`).run(today);
      const r = q('DELETE FROM events WHERE day < ?').run(cutoff);
      db.exec('COMMIT');
      return { purged: Number(r.changes) };
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  /** Rolled up days plus the raw days not rolled up yet (today), from `since` (a day string) on. */
  const rows = (since) => q(`SELECT day, kind, name, device, n, v FROM stats_daily WHERE day >= ?
    UNION ALL SELECT day, kind, name, device, COUNT(*), COALESCE(SUM(value), 0) FROM events
      WHERE day >= ? AND day NOT IN (SELECT DISTINCT day FROM stats_daily) GROUP BY day, kind, name, device`).all(since, since);

  function report(days) {
    const since = dayOf(now() - (days - 1) * DAY_MS);
    const all = rows(since);
    const sum = (f) => all.filter(f).reduce((a, r) => ({ n: a.n + r.n, v: a.v + r.v }), { n: 0, v: 0 });
    const group = (kind, by) => {
      const m = new Map();
      for (const r of all) if (r.kind === kind) { const k = by(r), c = m.get(k) || { key: k, n: 0, v: 0 }; c.n += r.n; c.v += r.v; m.set(k, c); }
      return [...m.values()].sort((a, b) => b.n - a.n);
    };
    const s = sum((r) => r.kind === 'session');
    const perDay = new Map();
    for (const r of all) if (r.kind === 'session') perDay.set(r.day, (perDay.get(r.day) || 0) + r.n);
    return {
      days, since,
      sessions: { n: s.n, avgSeconds: s.n ? Math.round(s.v / s.n) : 0, perDay: [...perDay].sort() },
      features: group('feature', (r) => r.name),
      errorsByDevice: group('error', (r) => r.device),
      errorsByWhere: group('error', (r) => r.name),
      perf: group('perf', (r) => r.name).map((c) => ({ tier: c.key, n: c.n, avgLoadMs: c.n ? Math.round(c.v / c.n) : 0 })),
      recentErrors: q("SELECT at, name, device, data FROM events WHERE kind = 'error' AND day >= ? ORDER BY id DESC LIMIT 15").all(since)
        .map((r) => ({ at: r.at, where: r.name, device: r.device, message: JSON.parse(r.data).message })),
    };
  }

  return { ingest, maintain, report, rows };
}

// ------------------------------------------------------------ dashboard
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PAGE = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>
:root{color-scheme:dark light;--bg:#14161c;--fg:#e6e8ee;--h2:#9fb4ff;--line:#2a2e3a;--mut:#8a90a2;--card:#1b1e27;--c1:#7aa2ff;--c2:#6fd39a;--c3:#f0b45a;--c4:#e6d36a;--c5:#ff6b6b;--bad:#ff4d4d}
@media (prefers-color-scheme:light){:root{--bg:#f6f7fa;--fg:#1b1e27;--h2:#2f4fbf;--line:#d5d9e3;--mut:#5d6477;--card:#fff;--c1:#2f5fe0;--c2:#1f9a5a;--c3:#c27a12;--c4:#a08a00;--c5:#d12b2b;--bad:#d12b2b}}
body{font:15px/1.45 system-ui,sans-serif;margin:0;padding:16px;background:var(--bg);color:var(--fg);max-width:900px}
h1{font-size:20px}h2{font-size:16px;margin:24px 0 6px;color:var(--h2)}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.muted{color:var(--mut)}input,button{font:inherit;padding:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}.stat{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px 10px}
.stat span{display:block;font-size:12px;color:var(--mut)}.stat b{font-variant-numeric:tabular-nums}.stat.bad{border-color:var(--bad)}.stat.bad b{color:var(--bad)}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:10px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px}
figcaption{font-size:13px;color:var(--mut);margin:0 0 2px 4px}.chart{width:100%;height:auto;display:block}.chart .tx{font-size:10px;fill:var(--mut)}.chart .ax{stroke:var(--line);stroke-width:1}
.chart .ln{fill:none;stroke-width:1.5}.chart .c1{stroke:var(--c1);fill:var(--c1)}.chart .c2{stroke:var(--c2);fill:var(--c2)}.chart .c3{stroke:var(--c3);fill:var(--c3)}.chart .c4{stroke:var(--c4);fill:var(--c4)}.chart .c5{stroke:var(--c5);fill:var(--c5)}
.chart .ln.c1,.chart .ln.c2,.chart .ln.c3,.chart .ln.c4,.chart .ln.c5{fill:none}.chart text.c1,.chart text.c2,.chart text.c3,.chart text.c4,.chart text.c5{stroke:none}
.chart .lim{stroke:var(--bad);stroke-width:1;stroke-dasharray:4 3}.chart .mk{stroke:var(--mut);stroke-width:1;stroke-dasharray:2 2}.chart .bad{fill:var(--bad);stroke:none}
</style></head><body>${body}</body></html>`;

export const loginPage = (bad) => PAGE('Stats', `<h1>Stats</h1>${bad ? '<p>Wrong secret.</p>' : ''}<form method="post" action="/stats"><input type="password" name="secret" autocomplete="off" autofocus> <button>Open</button></form>`);

const table = (head, rowsHtml) => rowsHtml.length ? `<table><tr>${head.map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr>${rowsHtml.join('')}</table>` : '<p class="muted">Nothing yet.</p>';
const tr = (cells) => `<tr>${cells.map((c, i) => `<td${i ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`;

export function dashboardPage(r7, r30, serverHtml = '') {
  const block = (r) => `<h2>Last ${r.days} days</h2>
<p>Sessions: <b>${r.sessions.n}</b>, average length ${r.sessions.avgSeconds} s</p>
${table(['Day', 'Sessions'], r.sessions.perDay.map(([d, n]) => tr([d, n])))}
<h3>Top features</h3>${table(['Feature', 'Uses'], r.features.slice(0, 15).map((f) => tr([f.key, f.n])))}
<h3>Errors by device</h3>${table(['Device', 'Errors'], r.errorsByDevice.map((f) => tr([f.key, f.n])))}
<h3>Errors by place</h3>${table(['Where', 'Errors'], r.errorsByWhere.slice(0, 15).map((f) => tr([f.key, f.n])))}
<h3>Performance tiers</h3>${table(['Tier', 'Sessions', 'Avg load ms'], r.perf.map((p) => tr([p.tier, p.n, p.avgLoadMs])))}`;
  const recent = r30.recentErrors.length ? `<h2>Latest errors</h2>${table(['When (UTC)', 'Where', 'Device', 'Message'], r30.recentErrors.map((e) => `<tr><td>${esc(new Date(e.at).toISOString().slice(0, 16).replace('T', ' '))}</td><td>${esc(e.where)}</td><td>${esc(e.device)}</td><td>${esc(e.message)}</td></tr>`))}` : '';
  return PAGE('Stats', `<h1>chess-3d stats</h1><p class="muted">Logged in online players only. Raw events ${RAW_DAYS} days, daily sums forever.</p>${serverHtml}${block(r7)}${block(r30)}${recent}`);
}

/** constant time compare of the secret (both sides hashed, so the length does not leak) */
export function secretOk(given, secret) {
  if (!secret || !given) return false;
  return timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(sha256(secret)));
}
