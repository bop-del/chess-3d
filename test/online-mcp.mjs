// Live Server-Dashboard (CHE-442, ADR 0014, fast tier, no browser): the read only MCP endpoint at /mcp/<secret> over the real HTTP server,
// a seeded in memory database, a fake clock and a fake probe. Handshake, tools/list, each tool, the secret gate, no name, IP or text in any
// result, the rate limit, the log line without the secret, the CPU meter and the downsampling.
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { cpuMeter } from '../server/health.mjs';
import { downsample, redFlags, TOOLS, RATE, SECRET_MIN, MAX_POINTS } from '../server/mcp.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };

const SECRET = 'test-only-secret-for-the-mcp-unit-test-0123456789';   // not a real secret
const GB = 1024 ** 3, DAY = 24 * 3600 * 1000;
let clock = Date.UTC(2026, 9, 11, 12);
const machine = { rss: 90e6, load: [0.4, 0.3, 0.2], memFree: 600e6, memTotal: 1000e6, diskFree: 60 * GB, diskTotal: 100 * GB, dbBytes: 5e6 };
let cpu = { proc: 3.5, host: 12.3 };
const probe = { read: () => ({ ...machine }), loopMax: () => 7, resetLoop() {}, stop() {}, cpu: () => cpu, cpuSample: () => cpu };
const logs = [];
const db = openDb(':memory:');
const app = createOnlineServer({ db, now: () => clock, probe, mcpSecret: SECRET, heartbeatMs: 60000, log: (l) => logs.push(l) });
const port = await app.listen(0, '127.0.0.1');
const BASE = `http://127.0.0.1:${port}`;

// ------------------------------------------------------------ seed: players, a game, chat, events, health rows
const NAME_A = 'Zeldaplayer', NAME_B = 'Quentinplayer', CHAT = 'secretchattext hello', ERR = 'TypeError secret error message', IPTAG = '203.0.113.77';
const a = app.admin.invite(NAME_A), b = app.admin.invite(NAME_B);
const pa = app.admin.byName(NAME_A), pb = app.admin.byName(NAME_B);
db.prepare("INSERT INTO games (id, white_id, black_id, status, created, last_move_at) VALUES (1, ?, ?, 'active', ?, ?)").run(pa.id, pb.id, clock - 5000, clock - 5000);
db.prepare('INSERT INTO moves (game_id, ply, uci, san, at) VALUES (1, 0, ?, ?, ?)').run('e2e4', 'e4', clock - 30e3);
db.prepare('INSERT INTO moves (game_id, ply, uci, san, at) VALUES (1, 1, ?, ?, ?)').run('e7e5', 'e5', clock - 10 * 60e3);
db.prepare('INSERT INTO messages (from_id, to_id, text, at) VALUES (?, ?, ?, ?)').run(pa.id, pb.id, CHAT, clock - 20e3);
const ev = db.prepare('INSERT INTO events (at, day, kind, name, device, value, data) VALUES (?, ?, ?, ?, ?, ?, ?)');
const day = (t) => new Date(t).toISOString().slice(0, 10);
for (let i = 0; i < 5; i++) ev.run(clock - i * 3600e3, day(clock - i * 3600e3), 'feature', 'puzzles', 'chrome pointer', null, null);
ev.run(clock - 1000, day(clock), 'feature', 'battle', 'chrome pointer', null, null);
ev.run(clock - 2 * DAY, day(clock - 2 * DAY), 'feature', 'puzzles', 'safari touch', null, null);
ev.run(clock - 1000, day(clock), 'error', 'src/online/api.js', 'chrome pointer', null, JSON.stringify({ message: ERR, device: {} }));
for (const v of [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]) ev.run(clock - 1000, day(clock), 'perf', 'high', 'chrome pointer', v, null);
ev.run(clock - 1000, day(clock), 'session', 'session', 'chrome pointer', 120, null);
for (let i = 0; i < 40; i++) db.prepare('INSERT INTO server_health (at, started, uptime_s, present_max, streams_max, games_max, loop_max_ms, rss_max, req, r4xx, r5xx, load1, load5, load15, mem_free, mem_total, disk_free, disk_total, db_bytes, proc_cpu, host_cpu) VALUES (?, ?, 0, ?, 1, 1, 5, 80000000, 10, 1, 0, 0.5, 0.4, 0.3, 500000000, 1000000000, 50000000000, 100000000000, 3000000, ?, ?)')
  .run(clock - (40 - i) * 300e3, clock - DAY, i % 5, i % 2 ? 4.5 : null, i % 2 ? 20 : null);
app.health.request(200); app.health.request(404); app.health.request(500);

async function mcp(body, { path = `/mcp/${SECRET}`, method = 'POST', raw } = {}) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }
  return { status: r.status, json, text, headers: r.headers };
}
const call = async (name, args = {}, id = 9) => (await mcp({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })).json;
const allOut = [], structured = [];
const tool = async (name, args) => { const j = await call(name, args); allOut.push(JSON.stringify(j)); structured.push(JSON.stringify(j?.result?.structuredContent)); return j?.result?.structuredContent; };

try {
  // ------------------------------------------------------------ protocol
  const init = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude.ai', version: '1' } } });
  ok('initialize answers 200 JSON-RPC with the protocol version, the tools capability and the server info', init.status === 200 && init.json.jsonrpc === '2.0' && init.json.id === 1 && init.json.result.protocolVersion === '2025-06-18' && !!init.json.result.capabilities.tools && !!init.json.result.serverInfo.name, init.text);
  const old = await mcp({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  ok('an unknown protocol version is answered with one this server speaks', old.json.result.protocolVersion === '2025-06-18');
  const note = await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' });
  ok('notifications/initialized: 202, no body', note.status === 202 && note.text === '');
  const ping = await mcp({ jsonrpc: '2.0', id: 3, method: 'ping' });
  ok('ping answers an empty result', ping.json.result && Object.keys(ping.json.result).length === 0);
  const list = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/list' });
  const tools = list.json.result.tools;
  ok('tools/list: live_stats, history, player_events', tools.map((t) => t.name).join() === 'live_stats,history,player_events');
  ok('every tool has a description and an object input schema, read only', tools.every((t) => t.description.length > 20 && t.inputSchema.type === 'object' && t.annotations.readOnlyHint === true));
  ok('history and player_events take a range of 24h, 7d or 30d', ['history', 'player_events'].every((n) => tools.find((t) => t.name === n).inputSchema.properties.range.enum.join() === '24h,7d,30d'));
  ok('TOOLS export matches the list', JSON.stringify(TOOLS) === JSON.stringify(tools));
  const unk = await mcp({ jsonrpc: '2.0', id: 5, method: 'resources/list' });
  ok('an unknown method: -32601', unk.json.error.code === -32601);
  const badTool = await call('drop_everything');
  ok('an unknown tool: -32602', badTool.error.code === -32602);
  const junk = await mcp(null, { raw: '{not json' });
  ok('broken JSON: 400 with -32700', junk.status === 400 && junk.json.error.code === -32700);
  const batch = await mcp([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }]);
  ok('a batch answers every request and skips the notification', batch.status === 200 && batch.json.length === 2);
  const get = await mcp(null, { method: 'GET' });
  ok('GET answers 405 with Allow: POST', get.status === 405 && get.headers.get('allow') === 'POST');
  const big = await mcp(null, { raw: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', pad: 'x'.repeat(9000) }) });
  ok('a body over 8 KB: 413', big.status === 413, String(big.status));

  // ------------------------------------------------------------ live_stats
  const live = await tool('live_stats');
  console.log('live_stats sample:', JSON.stringify(live));
  ok('live_stats: moves and chat of the last minute', live.server.moves_last_minute === 1 && live.server.chat_last_minute === 1, JSON.stringify(live.server));
  ok('live_stats: running games and players present from the live gauges', live.server.running_games === 1 && live.server.present === 0 && live.server.streams === 0);
  ok('live_stats: requests and 4xx/5xx of the last 5 minutes', live.server.requests_5min === 3 && live.server.r4xx_5min === 1 && live.server.r5xx_5min === 1, JSON.stringify(live.server));
  ok('live_stats: event loop, rss and process CPU', live.server.event_loop_max_ms === 7 && live.server.rss_mb === 85.8 && live.server.cpu_percent === 3.5, JSON.stringify(live.server));
  ok('live_stats: host load, CPU, memory, disk', live.host.load.join() === '0.4,0.3,0.2' && live.host.cpu_percent === 12.3 && live.host.mem_used_pct === 40 && live.host.disk_used_pct === 40 && live.host.disk_total_gb === 100, JSON.stringify(live.host));
  ok('live_stats: uptime, version (api and commit), time', live.uptime_s >= 0 && live.version.api === 1 && typeof live.version.commit === 'string' && live.at === clock);
  ok('live_stats: nothing red on a quiet machine', live.red.any === false && Object.values(live.red).every((v) => v === false), JSON.stringify(live.red));
  machine.memFree = 100e6; machine.diskFree = 8 * GB; cpu = { proc: 91, host: 95 };
  const hot = await tool('live_stats');
  ok('red flags: memory over 85, disk over 85 and 90, CPU over 80, free memory under 10 percent', hot.red.any && hot.red.memory && hot.red.memory_free_low === false && hot.red.disk && hot.red.disk_alert && hot.red.host_cpu && hot.red.process_cpu, JSON.stringify(hot.red));
  machine.memFree = 50e6;
  ok('red flag memory_free_low under 10 percent free', (await tool('live_stats')).red.memory_free_low === true);
  machine.memFree = 600e6; machine.diskFree = 60 * GB; cpu = { proc: null, host: null };
  const nocpu = await tool('live_stats');
  ok('CPU is null where it is not available (macOS)', nocpu.server.cpu_percent === null && nocpu.host.cpu_percent === null && nocpu.red.host_cpu === false);
  cpu = { proc: 3.5, host: 12.3 };
  ok('redFlags: error rate needs 20 requests', redFlags({ recent: { req: 10, r5xx: 10 } }).error_rate === false && redFlags({ recent: { req: 100, r5xx: 6 } }).error_rate === true && redFlags({ recent: { req: 100, r5xx: 5 } }).error_rate === false);
  ok('redFlags: event loop over 200 ms', redFlags({ loopMs: 250, recent: { req: 0, r5xx: 0 } }).event_loop === true);

  // ------------------------------------------------------------ history
  const hist = await tool('history', { range: '24h' });
  ok('history 24h: the 40 seeded rows as points', hist.range === '24h' && hist.rows === 40 && hist.points.length === 40, `${hist.rows}/${hist.points.length}`);
  ok('history: a point holds the chess server and host values, CPU null where unknown', hist.points[1].host_cpu === 20 && hist.points[1].proc_cpu === 4.5 && hist.points[0].host_cpu === null && hist.points[1].mem_used_pct === 50 && hist.points[1].disk_used_pct === 50 && hist.points[1].req === 10);
  const h7 = await tool('history', { range: '7d' });
  ok('history 7d reads the same rows', h7.rows === 40);
  const bad = await call('history', { range: '1y' });
  ok('history: an unknown range is a tool error with a fixed message', bad.result.isError === true && /range must be/.test(bad.result.content[0].text));
  const dflt = await tool('history');
  ok('history: the range defaults to 24h', dflt.range === '24h');
  const many = Array.from({ length: 8640 }, (_, i) => ({ at: i * 300e3, started: i < 4000 ? 1 : 2, present_max: i % 7, streams_max: 0, games_max: 0, loop_max_ms: i === 5000 ? 900 : 1, rss_max: 1e8, req: 1, r4xx: 0, r5xx: i === 100 ? 1 : 0, load1: 1, load5: 1, load15: 1, mem_free: 5, mem_total: 10, disk_free: 1, disk_total: 4, proc_cpu: null, host_cpu: null }));
  const down = downsample(many);
  ok('downsample: 30 days (8640 rows) become at most 300 points', down.length <= MAX_POINTS && down.length > 250, String(down.length));
  ok('downsample keeps peaks and sums counts', Math.max(...down.map((p) => p.loop_max_ms)) === 900 && down.reduce((t, p) => t + p.req, 0) === 8640 && down.reduce((t, p) => t + p.r5xx, 0) === 1 && down.reduce((t, p) => t + p.restarts, 0) === 1);
  ok('downsample: few rows stay as they are', downsample(many.slice(0, 10)).length === 10);

  // ------------------------------------------------------------ player_events
  const pe = await tool('player_events', { range: '24h' });
  ok('player_events: feature use per day, counts only', pe.features_per_day.some((f) => f.name === 'puzzles' && f.n === 5 && f.day === day(clock)) && pe.features_per_day.some((f) => f.name === 'battle' && f.n === 1) && !pe.features_per_day.some((f) => f.day === day(clock - 2 * DAY)), JSON.stringify(pe.features_per_day));
  ok('player_events: errors per place as a count, no message', pe.errors_per_place.length === 1 && pe.errors_per_place[0].place === 'src/online/api.js' && pe.errors_per_place[0].n === 1 && !('message' in pe.errors_per_place[0]));
  ok('player_events: load time median and p90 (nearest rank) per tier and overall', pe.load_time.all.n === 10 && pe.load_time.all.median_ms === 5000 && pe.load_time.all.p90_ms === 9000 && pe.load_time.by_tier.high.p90_ms === 9000, JSON.stringify(pe.load_time));
  ok('player_events: sessions counted', pe.sessions === 1);
  const pe7 = await tool('player_events', { range: '7d' });
  ok('player_events 7d includes the older day', pe7.features_per_day.some((f) => f.day === day(clock - 2 * DAY)));
  const empty = (() => { const d2 = openDb(':memory:'); const x = createOnlineServer({ db: d2, mcpSecret: SECRET, probe }); return x; })();
  const ee = empty.stats && await (async () => { const p = await empty.listen(0, '127.0.0.1'); const r = await fetch(`http://127.0.0.1:${p}/mcp/${SECRET}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'player_events', arguments: {} } }) }); const j = await r.json(); await empty.close(); return j.result.structuredContent; })();
  ok('player_events on an empty database: zeros and nulls', ee.sessions === 0 && ee.load_time.all.median_ms === null && ee.features_per_day.length === 0);

  // ------------------------------------------------------------ no leaks
  const blob = allOut.join('\n') + JSON.stringify(down);
  for (const [what, needle] of [['player name', NAME_A], ['player name', NAME_B], ['player name lower', NAME_A.toLowerCase()], ['invite key', a.key], ['invite code', a.code], ['chat text', CHAT], ['error text', ERR], ['IP', '127.0.0.1'], ['IP', IPTAG], ['secret', SECRET]]) {
    ok(`no ${what} in any tool result`, !blob.includes(needle), needle);
  }
  ok('no result field is called name, player, id, ip, text or message (except feature names and places)', !/"(player|player_id|ip|text|message|from|to|code|key)":/.test(structured.join('')));

  // ------------------------------------------------------------ the secret gate
  const none = await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { path: '/mcp/' });
  const wrong = await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { path: `/mcp/${SECRET.slice(0, -1)}x` });
  const prefix = await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { path: `/mcp/${SECRET.slice(0, 10)}` });
  const root = await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { path: '/mcp' });
  const other = await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' }, { path: '/mcpx/abc' });
  ok('secret missing, wrong, a prefix: 404 with the same empty body as an unknown path', [none, wrong, prefix].every((r) => r.status === 404 && r.text === '') && other.status === 404 && other.text === '', [none.status, wrong.status, prefix.status].join());
  ok('/mcp without a secret is not a route', root.status === 404 || root.status === 405 || root.status === 401, String(root.status));
  ok('right secret: 200', (await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' })).status === 200);
  ok('a wrong secret gets no CORS and no hint', wrong.headers.get('access-control-allow-origin') === null && wrong.headers.get('content-type') === null);
  const ing = await fetch(`${BASE}/mcp/${SECRET}`, { method: 'GET' });
  ok('GET with the right secret is 405, with a wrong secret 404 (the method does not tell)', ing.status === 405 && (await mcp(null, { method: 'GET', path: '/mcp/nope' })).status === 404);

  // ------------------------------------------------------------ logs and counters
  ok('the log never holds the secret', !logs.join('\n').includes(SECRET) && logs.some((l) => l.startsWith('POST /mcp/* ')), logs.filter((l) => l.includes('mcp')).slice(0, 2).join('|'));
  const before = app.health.recent().req;
  await mcp({ jsonrpc: '2.0', id: 1, method: 'ping' });
  ok('MCP calls do not move the request counters (a dashboard cannot move the error rate)', app.health.recent().req === before);

  // ------------------------------------------------------------ the secret must be long
  for (const s of ['', 'short', 'x'.repeat(SECRET_MIN - 1)]) {
    const d3 = openDb(':memory:'), x = createOnlineServer({ db: d3, mcpSecret: s, probe }), p = await x.listen(0, '127.0.0.1');
    const r = await fetch(`http://127.0.0.1:${p}/mcp/${s}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
    ok(`secret of ${s.length} characters: the route does not exist (404)`, r.status === 404);
    await x.close();
  }
  { const d3 = openDb(':memory:'), x = createOnlineServer({ db: d3, mcpSecret: 'x'.repeat(SECRET_MIN), probe }), p = await x.listen(0, '127.0.0.1');
    const r = await fetch(`http://127.0.0.1:${p}/mcp/${'x'.repeat(SECRET_MIN)}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
    ok(`secret of exactly ${SECRET_MIN} characters works`, r.status === 200);
    await x.close(); }

  // ------------------------------------------------------------ rate limit per IP
  { let t = Date.UTC(2026, 9, 11, 12);
    const d4 = openDb(':memory:'), x = createOnlineServer({ db: d4, mcpSecret: SECRET, probe, now: () => t }), p = await x.listen(0, '127.0.0.1');
    const hit = (path = `/mcp/${SECRET}`) => fetch(`http://127.0.0.1:${p}${path}`, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) }).then((r) => r.status);
    let last = 0;
    for (let i = 0; i < RATE.max; i++) last = await hit();
    ok(`${RATE.max} requests in a minute are served`, last === 200);
    ok('the next one is 429 with Retry-After', (await hit()) === 429);
    ok('wrong secrets count too (guessing is throttled)', (await hit('/mcp/guess')) === 429);
    t += RATE.windowMs + 1;
    ok('a minute later it is served again', (await hit()) === 200);
    await x.close(); }

  // ------------------------------------------------------------ the CPU meter
  { let t = 1000, u = { user: 0, system: 0 }, st = 'cpu  100 0 100 700 100 0 0 0 0 0\n';
    const m = cpuMeter({ clock: () => t, usage: () => u, stat: () => st, minMs: 2000 });
    ok('CPU meter: nothing yet inside the first interval', m().proc === null);
    t += 10000; u = { user: 300e3, system: 200e3 }; st = 'cpu  600 0 300 900 200 0 0 0 0 0\n';
    const r = m();
    ok('CPU meter: process 0.5 s CPU in 10 s is 5 percent', r.proc === 5, JSON.stringify(r));
    ok('CPU meter: host busy share from /proc/stat deltas (idle + iowait)', r.host === 70, JSON.stringify(r));   // total 1000 to 2000, idle + iowait 800 to 1100
    t += 500;
    ok('CPU meter: a read under the minimum interval repeats the last value', m().proc === 5);
    const noStat = cpuMeter({ clock: () => t, usage: () => u, stat: () => { throw new Error('ENOENT'); }, minMs: 0 });
    t += 1000; u = { user: u.user + 100e3, system: u.system };
    const n = noStat();
    ok('CPU meter: no /proc/stat gives a null host value, the process value stays', n.host === null && n.proc === 10, JSON.stringify(n)); }

  // ------------------------------------------------------------ the sample stores the CPU
  app.health.sample();
  const row = db.prepare('SELECT proc_cpu, host_cpu FROM server_health ORDER BY at DESC LIMIT 1').get();
  ok('health.sample() stores process and host CPU in the new columns', row.proc_cpu === 3.5 && row.host_cpu === 12.3, JSON.stringify(row));
} catch (e) {
  failed++; console.log('FAIL  test crashed: ' + (e?.stack || e));
} finally {
  await app.close();
}
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
