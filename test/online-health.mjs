// Server history (CHE-306, fast tier, no browser): sampling with a fake clock and a fake probe, maxima across samples, counts,
// retention, gaps and restart markers in the chart, and the /stats "Server" section with an empty table and with data.
import { createOnlineServer } from '../server/index.mjs';
import { openDb } from '../server/db.mjs';
import { createHealth, chartSvg, serverSection, SAMPLE_MS, KEEP_DAYS } from '../server/health.mjs';

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + detail}`); };
const DAY = 24 * 3600 * 1000, GB = 1024 ** 3;
let clock = Date.UTC(2026, 9, 7, 12);
const machine = { rss: 80e6, load: [0.5, 0.4, 0.3], memFree: 400e6, memTotal: 1000e6, diskFree: 50 * GB, diskTotal: 100 * GB, dbBytes: 3e6 };
let loop = 4;
const probe = { read: () => ({ ...machine }), loopMax: () => loop, resetLoop() { loop = 0; }, stop() {} };
const gauges = { present: 0, streams: 0, games: 0 };
const mk = (db) => createHealth(db, { now: () => clock, probe, gauges: { present: () => gauges.present, streams: () => gauges.streams, games: () => gauges.games } });
const rows = (db) => db.prepare('SELECT * FROM server_health ORDER BY at').all();

try {
  // ------------------------------------------------------------ sampling and maxima
  const db = openDb(':memory:');
  const h = mk(db);
  gauges.present = 2; gauges.streams = 3; gauges.games = 1; h.touch();
  gauges.present = 0; gauges.streams = 0; gauges.games = 0; h.touch();   // a visit shorter than the interval: gone again before the sample
  h.request(200); h.request(200); h.request(404); h.request(500);
  loop = 120; machine.rss = 120e6;
  clock += SAMPLE_MS; h.sample();
  const r1 = rows(db)[0];
  ok('one row per sample', rows(db).length === 1);
  ok('maxima over the interval survive a visit shorter than the sample', r1.present_max === 2 && r1.streams_max === 3 && r1.games_max === 1, JSON.stringify(r1));
  ok('requests, 4xx and 5xx are counted in the interval', r1.req === 4 && r1.r4xx === 1 && r1.r5xx === 1);
  ok('event loop delay and RSS are maxima', r1.loop_max_ms === 120 && r1.rss_max === 120e6);
  ok('machine group: load, memory, disk, database size', r1.load1 === 0.5 && r1.load15 === 0.3 && r1.mem_free === 400e6 && r1.mem_total === 1000e6 && r1.disk_free === 50 * GB && r1.disk_total === 100 * GB && r1.db_bytes === 3e6);
  ok('uptime and the server start time', r1.uptime_s === 300 && r1.started === Date.UTC(2026, 9, 7, 12));
  clock += SAMPLE_MS; machine.rss = 70e6; h.sample();
  const r2 = rows(db)[1];
  ok('the next interval starts clean: maxima, counts and loop delay reset', r2.present_max === 0 && r2.streams_max === 0 && r2.games_max === 0 && r2.req === 0 && r2.r4xx === 0 && r2.loop_max_ms === 0 && r2.rss_max === 120e6, JSON.stringify(r2));
  gauges.present = 1; gauges.streams = 1;
  clock += SAMPLE_MS; h.sample();
  ok('a player still Present at the sample counts in the new interval', rows(db)[2].present_max === 1 && rows(db)[2].streams_max === 1);
  ok('no player id and no IP in any row', !/player|ip|name|key/i.test(Object.keys(rows(db)[0]).join(' ')) );
  const cur = h.current();
  ok('current() gives live values, not the last row', cur.present === 1 && cur.rss === 70e6 && cur.uptime_s === 900);

  // ------------------------------------------------------------ retention
  clock += KEEP_DAYS * DAY - 2 * SAMPLE_MS - 10;
  ok('rows younger than 90 days stay', h.prune() === 0 && rows(db).length === 3);
  clock += 2 * DAY;
  ok('rows older than 90 days are deleted', h.prune() === 3 && rows(db).length === 0);

  // ------------------------------------------------------------ gaps and restart markers
  gauges.present = 0; gauges.streams = 0;
  const base = clock = Date.UTC(2026, 9, 8, 0);
  const mkRow = (at, over = {}) => ({ at, started: base - DAY, uptime_s: 0, present_max: 1, streams_max: 1, games_max: 0, loop_max_ms: 10, rss_max: 80e6, req: 5, r4xx: 0, r5xx: 0, load1: 1, load5: 1, load15: 1, mem_free: 500e6, mem_total: 1000e6, disk_free: 50 * GB, disk_total: 100 * GB, db_bytes: 1e6, ...over });
  const present = CHART_PRESENT();
  function CHART_PRESENT() { return { title: 't', lines: [['Present', (r) => r.present_max, 'c1']], int: true }; }
  const slot = (i, over) => mkRow(base - 3600e3 + i * SAMPLE_MS, over);
  const cont = [0, 1, 2, 3].map((i) => slot(i));
  ok('an unbroken series is one polyline', (chartSvg(present, cont, base - 3600e3, base).match(/<polyline/g) || []).length === 1);
  const gap = [0, 1, 2, 6, 7, 8].map((i) => slot(i));
  ok('an outage (no rows in a slot) breaks the line into two', (chartSvg(present, gap, base - 3600e3, base).match(/<polyline/g) || []).length === 2);
  ok('no restart: no marker', !/class="mk"/.test(chartSvg(present, cont, base - 3600e3, base)));
  const restart = [0, 1, 2, 3].map((i) => slot(i, i >= 2 ? { started: base - 3600e3 + 2 * SAMPLE_MS - 60e3 } : {}));
  ok('a new server start time is a vertical marker', (chartSvg(present, restart, base - 3600e3, base).match(/class="mk"/g) || []).length === 1);
  ok('a lone sample between two gaps is a dot', /<circle class="c1"/.test(chartSvg(present, [slot(0), slot(5), slot(10)], base - 3600e3, base)));
  const loopDef = { title: 'l', lines: [['ms', (r) => r.loop_max_ms, 'c1']], limit: 200, over: (v) => v > 200 };
  ok('a value over the limit is a red mark, under it none', /class="bad"/.test(chartSvg(loopDef, [slot(0, { loop_max_ms: 250 })], base - 3600e3, base)) && !/class="bad"/.test(chartSvg(loopDef, [slot(0)], base - 3600e3, base)));
  ok('an empty window says so', /No samples yet/.test(chartSvg(present, [], base - 3600e3, base)));

  // ------------------------------------------------------------ the page: empty table, then data, red values
  const SECRET = 'health-secret-1234';
  const app = createOnlineServer({ db: openDb(':memory:'), now: () => clock, adminSecret: SECRET, probe, firstSampleMs: 3600e3, sampleMs: 3600e3 });
  const port = await app.listen(0, '127.0.0.1');
  const page = async () => { const r = await fetch(`http://127.0.0.1:${port}/stats`, { headers: { Authorization: `Bearer ${SECRET}` } }); return { status: r.status, text: await r.text() }; };
  const p0 = await page();
  ok('/stats with an empty server_health table: the Server section, current state, no samples yet', p0.status === 200 && /<h2>Server<\/h2>/.test(p0.text) && /Present players/.test(p0.text) && /No samples yet/.test(p0.text));
  ok('the Server section comes first', p0.text.indexOf('<h2>Server</h2>') < p0.text.indexOf('Last 7 days'));
  ok('the page needs no script and no external resource', !/<script|src=|https?:\/\//.test(p0.text));
  app.health.sample(); clock += SAMPLE_MS; app.health.sample();
  const p1 = await page();
  ok('with data: charts for 24 hours and 7 days', (p1.text.match(/<svg class="chart"/g) || []).length === 16 && /Last 24 hours/.test(p1.text) && /Last 7 days/.test(p1.text) && /<polyline/.test(p1.text), String((p1.text.match(/<svg class="chart"/g) || []).length));
  ok('nothing over a limit: no red', !/class="stat bad"/.test(p1.text) && !/class="bad"/.test(p1.text));
  machine.diskFree = 10 * GB; machine.memFree = 50e6; loop = 300;
  const p2 = await page();
  ok('disk over 85 percent, free memory under 10 percent, loop over 200 ms: red', (p2.text.match(/class="stat bad"/g) || []).length === 3, String((p2.text.match(/class="stat bad"/g) || []).length));
  ok('an action and a request are counted in the next sample', (() => { app.health.request(200); app.health.sample(); return rows(app.db).at(-1).req >= 1; })());
  const pl = app.admin.invite('Felix');
  const ac = new AbortController();
  const stream = await fetch(`http://127.0.0.1:${port}/events`, { headers: { Authorization: `Bearer ${pl.key}` }, signal: ac.signal });
  await stream.body.getReader().read();
  ac.abort();
  await new Promise((r) => setTimeout(r, 100));   // the close reaches the server
  app.health.sample();
  ok('a real Live stream that came and went shows in the next sample (Present and streams)', rows(app.db).at(-1).present_max === 1 && rows(app.db).at(-1).streams_max === 1 && app.live.streamCount() === 0, JSON.stringify(rows(app.db).at(-1)));
  const live = await fetch(`http://127.0.0.1:${port}/up`);
  ok('the server answers /up with timers running', live.status === 200);
  await app.close();
  ok('serverSection renders from a plain health object', /Server/.test(serverSection(h, { now: clock })));
} catch (e) { failed++; console.log('FAIL  crashed: ' + (e.stack || e)); }
console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
