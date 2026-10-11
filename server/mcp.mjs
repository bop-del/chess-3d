// The live Server-Dashboard endpoint (CHE-442, ADR 0014): a read only MCP server over Streamable HTTP, written by hand (JSON-RPC 2.0, no SDK,
// like the push sender in ADR 0013). claude.ai adds it as a custom connector; a private Artifact reads it every 30 s. The URL is the key:
// /mcp/<secret> with ONLINE_MCP_SECRET (32 characters or more). Unset or too short: there is no route. A wrong secret answers 404, the same
// as an unknown path. Counts only: no player name or id, no IP, no error text, no chat text in any result.
import { secretOk } from './stats.mjs';
import { versionInfo } from './version.mjs';
import { LIMITS, ALERT } from './health.mjs';

export const SECRET_MIN = 32;
export const RATE = { max: 120, windowMs: 60e3 };   // requests per IP and minute, every request under /mcp/ counts
export const BODY_MAX = 8192;
export const MAX_POINTS = 300;
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DAY_MS = 24 * 3600 * 1000;
const RANGES = { '24h': DAY_MS, '7d': 7 * DAY_MS, '30d': 30 * DAY_MS };
const RANGE_PROP = { type: 'string', enum: Object.keys(RANGES), description: 'Time range: 24h, 7d or 30d' };

export const TOOLS = [
  { name: 'live_stats', description: 'The chess server and its host right now: present players, Live streams, running games, moves and chat messages in the last minute, requests and 4xx/5xx in the last 5 minutes, event loop delay, memory, CPU, load, disk, uptime, version, and red flags. Counts only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'history', description: 'The server_health rows of the last 24h, 7d or 30d, downsampled to at most 300 points (maxima for peaks, sums for counts, averages for load and CPU). Counts only.',
    inputSchema: { type: 'object', properties: { range: RANGE_PROP }, additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'player_events', description: 'Usage of the game from the stats events, counts only: feature use per day, error counts per place, load time median and 90th percentile per performance tier.',
    inputSchema: { type: 'object', properties: { range: RANGE_PROP }, additionalProperties: false }, annotations: { readOnlyHint: true } },
];

const rnd = (x, d = 1) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const quantile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null);

/** The red flags of the live values: the /stats limits (LIMITS) and the percent limits of the external alert (ALERT, CHE-433). */
export function redFlags({ loopMs, memUsedPct, diskUsedPct, hostCpu, procCpu, recent }) {
  const flags = {
    event_loop: loopMs != null && loopMs > LIMITS.loopMs,
    memory: memUsedPct != null && memUsedPct > ALERT.ram,
    memory_free_low: memUsedPct != null && memUsedPct > 100 - 100 * LIMITS.memFree,
    disk: diskUsedPct != null && diskUsedPct > 100 * LIMITS.diskUsed,
    disk_alert: diskUsedPct != null && diskUsedPct > ALERT.disk,
    host_cpu: hostCpu != null && hostCpu > ALERT.cpu,
    process_cpu: procCpu != null && procCpu > ALERT.cpu,
    error_rate: recent.req >= LIMITS.minRequests && recent.r5xx / recent.req > LIMITS.errorRate,
  };
  return { any: Object.values(flags).some(Boolean), ...flags };
}

/** server_health rows -> at most MAX_POINTS points. Peaks stay maxima, counts are summed, load and CPU are averaged over the bucket. */
export function downsample(rows, max = MAX_POINTS) {
  const size = Math.max(1, Math.ceil(rows.length / max)), out = [];
  const mx = (a) => a.reduce((m, v) => (v == null ? m : m == null ? v : Math.max(m, v)), null);
  const sum = (a) => a.reduce((t, v) => t + (v ?? 0), 0);
  const avg = (a) => { const b = a.filter((v) => v != null); return b.length ? b.reduce((t, v) => t + v, 0) / b.length : null; };
  for (let i = 0; i < rows.length; i += size) {
    const b = rows.slice(i, i + size), last = b[b.length - 1];
    out.push({
      at: last.at, samples: b.length,
      present_max: mx(b.map((r) => r.present_max)), streams_max: mx(b.map((r) => r.streams_max)), games_max: mx(b.map((r) => r.games_max)),
      loop_max_ms: mx(b.map((r) => r.loop_max_ms)), rss_max_mb: rnd(mx(b.map((r) => r.rss_max)) / 1048576),
      req: sum(b.map((r) => r.req)), r4xx: sum(b.map((r) => r.r4xx)), r5xx: sum(b.map((r) => r.r5xx)),
      load1: rnd(avg(b.map((r) => r.load1)), 2), proc_cpu: rnd(avg(b.map((r) => r.proc_cpu))), host_cpu: rnd(avg(b.map((r) => r.host_cpu))),
      mem_used_pct: rnd(avg(b.map((r) => (r.mem_total ? 100 * (1 - r.mem_free / r.mem_total) : null)))),
      disk_used_pct: rnd(avg(b.map((r) => (r.disk_total ? 100 * (1 - r.disk_free / r.disk_total) : null)))),
      restarts: b.filter((r, j) => j > 0 ? r.started !== b[j - 1].started : i > 0 && r.started !== rows[i - 1].started).length,
    });
  }
  return out;
}

export function createMcp({ db, health, secret = '', now = () => Date.now(), probeVersion = () => versionInfo() } = {}) {
  if (typeof secret !== 'string' || secret.length < SECRET_MIN) return null;   // no route at all
  const q = (sql) => db.prepare(sql);
  const hits = new Map();   // ip -> request times in the window
  const limited = (ip) => {
    const t = now(), list = (hits.get(ip) || []).filter((x) => t - x < RATE.windowMs);
    if (list.length >= RATE.max) { hits.set(ip, list); return true; }
    list.push(t); hits.set(ip, list);
    if (hits.size > 1000) for (const [k, v] of hits) if (!v.some((x) => t - x < RATE.windowMs)) hits.delete(k);
    return false;
  };

  function liveStats() {
    const c = health.current(), t = now(), r = health.recent();
    const memUsedPct = c.memTotal ? 100 * (1 - c.memFree / c.memTotal) : null, diskUsedPct = c.diskTotal ? 100 * (1 - c.diskFree / c.diskTotal) : null;
    const cpu = c.cpu || {};
    return {
      at: t, version: probeVersion(), uptime_s: c.uptime_s,
      server: {
        present: c.present, streams: c.streams, running_games: c.games,
        moves_last_minute: q('SELECT COUNT(*) AS n FROM moves WHERE at >= ?').get(t - 60e3).n,
        chat_last_minute: q('SELECT COUNT(*) AS n FROM messages WHERE at >= ?').get(t - 60e3).n,
        requests_5min: r.req, r4xx_5min: r.r4xx, r5xx_5min: r.r5xx,
        event_loop_max_ms: c.loop_ms, rss_mb: rnd(c.rss / 1048576), cpu_percent: cpu.proc ?? null,
      },
      host: {
        load: c.load.map((l) => rnd(l, 2)), cpu_percent: cpu.host ?? null,
        mem_free_mb: rnd(c.memFree / 1048576, 0), mem_total_mb: rnd(c.memTotal / 1048576, 0), mem_used_pct: rnd(memUsedPct),
        disk_free_gb: c.diskFree == null ? null : rnd(c.diskFree / 1073741824), disk_total_gb: c.diskTotal == null ? null : rnd(c.diskTotal / 1073741824), disk_used_pct: rnd(diskUsedPct),
        db_mb: rnd(c.dbBytes / 1048576),
      },
      red: redFlags({ loopMs: c.loop_ms, memUsedPct, diskUsedPct, hostCpu: cpu.host, procCpu: cpu.proc, recent: r }),
    };
  }

  function history({ range = '24h' } = {}) {
    if (!RANGES[range]) throw new Error('range must be 24h, 7d or 30d');
    const rows = health.history(now() - RANGES[range]);
    return { range, rows: rows.length, points: downsample(rows) };
  }

  function playerEvents({ range = '24h' } = {}) {
    if (!RANGES[range]) throw new Error('range must be 24h, 7d or 30d');
    const since = now() - RANGES[range];
    const count = (kind, col) => q(`SELECT ${col} AS k, COUNT(*) AS n FROM events WHERE kind = ? AND at >= ? GROUP BY ${col} ORDER BY n DESC, k LIMIT 30`).all(kind, since).map((r) => ({ [col === 'name' ? 'name' : col]: r.k, n: r.n }));
    const perf = {};
    for (const { name, value } of q("SELECT name, value FROM events WHERE kind = 'perf' AND value IS NOT NULL AND at >= ? ORDER BY value").all(since)) (perf[name] ||= []).push(value);
    const all = Object.values(perf).flat().sort((a, b) => a - b);
    const stat = (a) => ({ n: a.length, median_ms: quantile(a, 0.5), p90_ms: quantile(a, 0.9) });
    return {
      range,
      features_per_day: q("SELECT day, name, COUNT(*) AS n FROM events WHERE kind = 'feature' AND at >= ? GROUP BY day, name ORDER BY day, n DESC, name LIMIT 600").all(since).map((r) => ({ day: r.day, name: r.name, n: r.n })),
      errors_per_place: q("SELECT name AS place, COUNT(*) AS n FROM events WHERE kind = 'error' AND at >= ? GROUP BY name ORDER BY n DESC, name LIMIT 30").all(since).map((r) => ({ place: r.place, n: r.n })),
      sessions: q("SELECT COUNT(*) AS n FROM events WHERE kind = 'session' AND at >= ?").get(since).n,
      load_time: { all: stat(all), by_tier: Object.fromEntries(Object.entries(perf).sort().map(([k, v]) => [k, stat(v)])) },
    };
  }

  const impl = { live_stats: liveStats, history, player_events: playerEvents };

  /** one JSON-RPC message -> a response object, or null for a notification */
  function rpc(msg) {
    const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(msg?.id, -32600, 'Invalid Request');
    const isNote = msg.id === undefined || msg.id === null;
    if (isNote) return null;   // notifications/initialized and the like: nothing to answer
    const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    switch (msg.method) {
      case 'initialize': {
        const want = msg.params?.protocolVersion;
        return ok({ protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'chess-3d-server-dashboard', version: String(probeVersion().api) } });
      }
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        const name = msg.params?.name, fn = Object.hasOwn(impl, name) ? impl[name] : null;
        if (!fn) return err(msg.id, -32602, 'Unknown tool');
        try {
          const out = fn(msg.params?.arguments || {});
          return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out, isError: false });
        } catch (e) {
          // a fixed message only: an internal error text could carry a value from the database
          const bad = /^range must be/.test(e?.message);
          return ok({ content: [{ type: 'text', text: bad ? e.message : 'The tool failed.' }], isError: true });
        }
      }
      default: return err(msg.id, -32601, 'Method not found');
    }
  }

  /** true when the path belongs to this endpoint (any /mcp/...), handled here; the caller counts nothing and logs no path */
  async function handle(req, res, path, ip, readBody) {
    const reply = (status, body, headers = {}) => {
      res.writeHead(status, { 'Cache-Control': 'no-store', ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), ...headers });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    if (limited(ip)) return reply(429, { error: 'slow-down' }, { 'Retry-After': '60' });
    if (!secretOk(path.slice('/mcp/'.length), secret)) return reply(404);
    if (req.method !== 'POST') return reply(405, undefined, { Allow: 'POST' });   // no server initiated stream
    let body;
    try { body = await readBody(req, BODY_MAX); } catch (e) { return reply(e?.status === 413 ? 413 : 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
    if (Array.isArray(body)) {
      const out = body.slice(0, 20).map(rpc).filter(Boolean);
      return out.length ? reply(200, out) : reply(202);
    }
    const out = rpc(body);
    return out ? reply(200, out) : reply(202);
  }

  return { handle, rpc, liveStats, history, playerEvents };
}
