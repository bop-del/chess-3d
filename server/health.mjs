// Server history (CHE-306, ADR 0010): every 5 minutes one row about the process (the "chess server" group) and the machine, kept
// 90 days, shown as inline SVG on /stats. Present players, Live streams and running games are maxima over the interval (touch()
// runs on every change), so a visit shorter than 5 minutes still shows. Counts only: no player id, no IP in any row.
import os from 'node:os';
import { statfsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';

export const SAMPLE_MS = 5 * 60 * 1000;
export const KEEP_DAYS = 90;
export const LIMITS = { diskUsed: 0.85, memFree: 0.10, loopMs: 200, errorRate: 0.05, windowMs: 15 * 60 * 1000, minSamples: 3, minRequests: 20 };   // over these a value turns red; errorRate, disk and the window also drive /health (CHE-307)
const DAY_MS = 24 * 3600 * 1000;

/** The real machine and process readings. Tests pass their own probe. */
export function systemProbe({ dbFile = ':memory:' } = {}) {
  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const size = (f) => { try { return statSync(f).size; } catch (e) { return 0; } };
  const disk = () => { try { const s = statfsSync(dbFile === ':memory:' ? '.' : dirname(dbFile)); return { free: Number(s.bavail) * Number(s.bsize), total: Number(s.blocks) * Number(s.bsize) }; } catch (e) { return { free: null, total: null }; } };
  const ms = (ns) => (Number.isFinite(ns) ? Math.round(ns / 1e4) / 100 : 0);
  return {
    read() {
      const l = os.loadavg(), d = disk();
      return { rss: process.memoryUsage.rss(), load: l, memFree: os.freemem(), memTotal: os.totalmem(), diskFree: d.free, diskTotal: d.total, dbBytes: size(dbFile) + size(dbFile + '-wal') };
    },
    loopMax: () => ms(loop.max),   // since the last resetLoop(), in ms
    resetLoop: () => loop.reset(),
    stop: () => loop.disable(),
  };
}

export function createHealth(db, { now = () => Date.now(), probe, gauges = {} } = {}) {
  probe = probe || systemProbe();
  const started = now();
  const q = (sql) => db.prepare(sql);
  const cur = () => ({ present: gauges.present?.() ?? 0, streams: gauges.streams?.() ?? 0, games: gauges.games?.() ?? 0 });
  let max, count;
  const fresh = () => {
    const c = cur();
    max = { present: c.present, streams: c.streams, games: c.games, rss: probe.read().rss };
    count = { req: 0, r4xx: 0, r5xx: 0 };
    probe.resetLoop();
  };
  max = { present: 0, streams: 0, games: 0, rss: probe.read().rss };   // the gauges are not ready at creation (live is built after)
  count = { req: 0, r4xx: 0, r5xx: 0 };

  /** a presence, stream or game change: keep the maxima of the interval */
  function touch() {
    const c = cur();
    max.present = Math.max(max.present, c.present);
    max.streams = Math.max(max.streams, c.streams);
    max.games = Math.max(max.games, c.games);
  }
  function request(status) {
    count.req++;
    if (status >= 500) count.r5xx++; else if (status >= 400) count.r4xx++;
  }

  /** write the row of the interval that ends now and start the next one */
  function sample() {
    touch();
    const t = now(), m = probe.read();
    max.rss = Math.max(max.rss, m.rss);
    q(`INSERT OR REPLACE INTO server_health (at, started, uptime_s, present_max, streams_max, games_max, loop_max_ms, rss_max, req, r4xx, r5xx,
        load1, load5, load15, mem_free, mem_total, disk_free, disk_total, db_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(t, started, Math.round((t - started) / 1000), max.present, max.streams, max.games, probe.loopMax(), max.rss, count.req, count.r4xx, count.r5xx,
        m.load[0], m.load[1], m.load[2], m.memFree, m.memTotal, m.diskFree, m.diskTotal, m.dbBytes);
    fresh();
  }

  /** the daily maintain step: rows older than 90 days go */
  const prune = () => Number(q('DELETE FROM server_health WHERE at < ?').run(now() - KEEP_DAYS * DAY_MS).changes);
  const history = (sinceMs) => q('SELECT * FROM server_health WHERE at >= ? ORDER BY at').all(sinceMs);

  /** live values (not the last row) for the top of the page */
  function current() {
    touch();
    const m = probe.read(), c = cur();
    return { at: now(), started, uptime_s: Math.round((now() - started) / 1000), present: c.present, streams: c.streams, games: c.games,
      loop_ms: probe.loopMax(), rss: m.rss, load: m.load, memFree: m.memFree, memTotal: m.memTotal, diskFree: m.diskFree, diskTotal: m.diskTotal, dbBytes: m.dbBytes };
  }
  return { touch, request, sample, prune, history, current, stop: () => probe.stop?.() };
}

/** CHE-307: the verdict behind GET /health, from the rows of server_health only (pure; memory and event loop are display only).
 *  Fewer than minSamples rows in the window (fresh start) is ok. Reasons are fixed short strings, no counts of players. */
export function healthVerdict(db, { now = Date.now(), limits = LIMITS } = {}) {
  const reasons = [];
  let rows;
  try {
    db.prepare('SELECT 1').get();
    rows = db.prepare('SELECT req, r5xx, disk_free, disk_total FROM server_health WHERE at >= ? AND at <= ? ORDER BY at').all(now - limits.windowMs, now);
  } catch (e) { return { ok: false, reasons: ['db unreachable'] }; }
  if (rows.length >= limits.minSamples) {
    const req = rows.reduce((a, r) => a + r.req, 0), bad = rows.reduce((a, r) => a + r.r5xx, 0);
    if (req >= limits.minRequests && bad / req > limits.errorRate) reasons.push(`error rate ${Math.round(100 * bad / req)}% over ${Math.round(limits.windowMs / 60000)} min`);
    const used = rows.map((r) => (r.disk_total ? 1 - r.disk_free / r.disk_total : null));
    if (used.every((u) => u != null && u > limits.diskUsed)) reasons.push(`disk ${Math.round(100 * Math.min(...used))}% used`);
  }
  return { ok: reasons.length === 0, reasons };
}

// ------------------------------------------------------------ the page section: inline SVG, no script
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const stamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const MB = 1024 * 1024, GB = 1024 * MB;
const fmtBytes = (b) => (b == null ? 'n/a' : b >= GB ? `${(b / GB).toFixed(1)} GB` : `${Math.round(b / MB)} MB`);
const fmtUp = (s) => (s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor(s % 86400 / 3600)} h` : s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min` : `${Math.floor(s / 60)} min`);
const pct = (a, b) => (b ? a / b : null);

/** the charts: value(row) gives a number or null; red(value) marks a breach; threshold is drawn as a dashed line */
const CHARTS = [
  { title: 'Present players, Live streams, running games (max per sample)', lines: [['Present', (r) => r.present_max, 'c1'], ['Live streams', (r) => r.streams_max, 'c2'], ['Games', (r) => r.games_max, 'c3']], int: true },
  { title: 'Event loop delay (max ms)', lines: [['ms', (r) => r.loop_max_ms, 'c1']], limit: LIMITS.loopMs, over: (v) => v > LIMITS.loopMs, unit: ' ms' },
  { title: 'Process memory (max RSS, MB)', lines: [['RSS', (r) => r.rss_max / MB, 'c1']], unit: ' MB' },
  { title: 'Requests, 4xx and 5xx per sample', lines: [['Requests', (r) => r.req, 'c1'], ['4xx', (r) => r.r4xx, 'c4'], ['5xx', (r) => r.r5xx, 'c5']], int: true },
  { title: 'Machine load (1 min)', lines: [['load', (r) => r.load1, 'c1']] },
  { title: 'Free memory (percent)', lines: [['free', (r) => 100 * pct(r.mem_free, r.mem_total), 'c1']], limit: LIMITS.memFree * 100, over: (v) => v < LIMITS.memFree * 100, floor: 0, top: 100, unit: ' %' },
  { title: 'Disk used on the data volume (percent)', lines: [['used', (r) => (r.disk_total ? 100 * (1 - r.disk_free / r.disk_total) : null), 'c1']], limit: LIMITS.diskUsed * 100, over: (v) => v > LIMITS.diskUsed * 100, floor: 0, top: 100, unit: ' %' },
  { title: 'Database file incl. WAL (MB)', lines: [['db', (r) => r.db_bytes / MB, 'c1']], unit: ' MB' },
];

const W = 640, H = 150, L = 44, R = 8, T = 8, B = 20;
const nice = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

export function chartSvg(def, rows, from, to) {
  const x = (t) => L + (W - L - R) * (t - from) / (to - from);
  const vals = rows.flatMap((r) => def.lines.map(([, f]) => f(r))).filter((v) => v != null && Number.isFinite(v));
  const top = def.top ?? nice(Math.max(def.limit ?? 0, ...vals, def.int ? 1 : 0.01));
  const y = (v) => T + (H - T - B) * (1 - Math.min(Math.max(v, 0), top) / top);
  const fmt = (v) => (def.int || top >= 10 ? String(Math.round(v)) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(def.title)}">`;
  out += `<line class="ax" x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}"/><line class="ax" x1="${L}" y1="${T}" x2="${L}" y2="${y(0)}"/>`;
  out += `<text class="tx" x="${L - 4}" y="${T + 8}" text-anchor="end">${fmt(top)}</text><text class="tx" x="${L - 4}" y="${y(0)}" text-anchor="end">0</text>`;
  out += `<text class="tx" x="${L}" y="${H - 5}">${esc(stamp(from).slice(5))}</text><text class="tx" x="${W - R}" y="${H - 5}" text-anchor="end">${esc(stamp(to).slice(5))}</text>`;
  if (def.limit != null) out += `<line class="lim" x1="${L}" y1="${y(def.limit)}" x2="${W - R}" y2="${y(def.limit)}"/>`;
  if (!rows.length) return out + `<text class="tx" x="${W / 2}" y="${H / 2}" text-anchor="middle">No samples yet</text></svg>`;
  // restarts and deploys: a new server start time; an outage is a gap (no row in a slot) and breaks the line
  let prev = null;
  for (const r of rows) {
    if ((prev ? r.started !== prev.started : r.started >= from)) out += `<line class="mk" x1="${x(r.started >= from ? r.started : r.at)}" y1="${T}" x2="${x(r.started >= from ? r.started : r.at)}" y2="${y(0)}"><title>Restart ${esc(stamp(r.started))} UTC</title></line>`;
    prev = r;
  }
  for (const [label, f, cls] of def.lines) {
    let seg = [];
    const flush = () => {
      if (seg.length === 1) out += `<circle class="${cls}" cx="${x(seg[0].at)}" cy="${y(seg[0].v)}" r="2"/>`;
      else if (seg.length > 1) out += `<polyline class="ln ${cls}" points="${seg.map((p) => `${x(p.at).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>`;
      seg = [];
    };
    let last = null;
    for (const r of rows) {
      const v = f(r);
      if (v == null || !Number.isFinite(v) || (last && r.at - last > SAMPLE_MS * 1.5)) flush();
      if (v != null && Number.isFinite(v)) seg.push({ at: r.at, v });
      last = r.at;
    }
    flush();
    if (def.over) for (const r of rows) { const v = f(r); if (v != null && def.over(v)) out += `<circle class="bad" cx="${x(r.at)}" cy="${y(v)}" r="3"><title>${esc(stamp(r.at))} UTC: ${fmt(v)}${def.unit || ''}</title></circle>`; }
  }
  const legend = def.lines.length > 1 ? def.lines.map(([l, , cls], i) => `<text class="tx ${cls}" x="${L + 6 + i * 90}" y="${T + 8}">${esc(l)}</text>`).join('') : '';
  return out + legend + '</svg>';
}

export function serverSection(health, { now = Date.now() } = {}) {
  const c = health.current();
  const memFree = pct(c.memFree, c.memTotal), disk = c.diskTotal ? 1 - c.diskFree / c.diskTotal : null;
  const cell = (label, value, bad = false) => `<div class="stat${bad ? ' bad' : ''}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  const state = `<div class="stats">${[
    cell('Uptime', fmtUp(c.uptime_s)), cell('Started (UTC)', stamp(c.started)),
    cell('Present players', c.present), cell('Live streams', c.streams), cell('Running games', c.games),
    cell('Event loop (max ms)', c.loop_ms, c.loop_ms > LIMITS.loopMs), cell('Process memory', fmtBytes(c.rss)),
    cell('Load 1 / 5 / 15', c.load.map((l) => l.toFixed(2)).join(' / ')),
    cell('Free memory', memFree == null ? 'n/a' : `${fmtBytes(c.memFree)} (${Math.round(memFree * 100)} %)`, memFree != null && memFree < LIMITS.memFree),
    cell('Disk used (data)', disk == null ? 'n/a' : `${fmtBytes(c.diskTotal - c.diskFree)} of ${fmtBytes(c.diskTotal)} (${Math.round(disk * 100)} %)`, disk != null && disk > LIMITS.diskUsed),
    cell('Database file', fmtBytes(c.dbBytes)),
  ].join('')}</div>`;
  const win = (label, ms) => {
    const rows = health.history(now - ms);
    return `<h3>${label}</h3><p class="muted">${rows.length} samples, one per 5 minutes (max over the interval). Dashed red line: limit. Vertical line: restart or deploy. Gap: no sample (outage).</p>`
      + `<div class="charts">${CHARTS.map((d) => `<figure><figcaption>${esc(d.title)}</figcaption>${chartSvg(d, rows, now - ms, now)}</figure>`).join('')}</div>`;
  };
  return `<h2>Server</h2><p class="muted">Live values now, then the history. Counts only: no player, no IP. Kept ${KEEP_DAYS} days.</p>${state}${win('Last 24 hours', DAY_MS)}${win('Last 7 days', 7 * DAY_MS)}`;
}
