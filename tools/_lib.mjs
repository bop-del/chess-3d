// Shared helpers for the test and release tools (test/smoke.mjs, tools/release-check.mjs). Not a tool itself.
//   ROOT                     repo root
//   reporter()               PASS / FAIL / WARN rows printed as they come, plus summary(): { rows, nf, nw }
//   launchBrowser(opts)      headless Chrome through puppeteer-core with software GL (swiftshader) by default, so it runs anywhere;
//                            the GPU (ANGLE Metal) is the default on Apple Silicon, CHESS_GL=swiftshader opts out, and it logs the WebGL renderer once per launch ({ gl: 'swiftshader' } pins it, as the release check's extra software pass does).
//                            Waits for a machine wide slot first: two always, three under load 12, four under load 6 (with metal: four under 8, three under 16).
//                            Every launch appends its slot wait to .tmp/chrome-waits.jsonl.
//   pageRenderer(page)       the WebGL renderer the page itself draws with (the app's own context, UNMASKED_RENDERER), logged by the smoke, phone and release tiers as proof of the GPU
//   proveGpu(page, R)        prints pageRenderer once, a WARN when the GPU was asked for and the page reports software
//   watchPage(page, hosts)   collects console errors and warnings, page errors and requests to foreign hosts (foreign requests are aborted); sets Battle scenes Off for the page unless { scenes: true }
//   startServer(opts)        vite preview of a built folder or the vite dev server, resolves when it answers. Only reuses a server this process started; a port that answers otherwise is an error (no port given: the next free one is taken)
//   claimPort(opts)          a port for a server, from the lane name: the first free port from the lane's own, claimed by a lock folder (pid, lane, build hash) so two callers at once never share one; a port that answers without our claim is skipped
//   waitReady(page, opts)    the ready signal of every tier (window.__chessReady or window.__chessError), with what it still waited for when it times out
//   build(outDir)            vite build into outDir (inside a folder, never touches dist/), through a content hashed cache in ~/.cache/chess-3d/dist-<hash>
// Exit codes used by the tools: 0 pass (warnings allowed), 1 a check failed, 2 usage or setup error.
import { spawn, execFileSync } from 'node:child_process';
import { connect } from 'node:net';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir, loadavg, homedir, freemem, totalmem } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const VITE = (cwd = ROOT) => join(cwd, 'node_modules', '.bin', 'vite');

export function reporter() {
  const rows = [];
  const add = (status, name, detail = '') => { rows.push({ status, name, detail }); console.log(`${status.padEnd(4)}  ${name}${detail ? '  ' + detail : ''}`); };
  return {
    rows,
    pass: (n, d) => add('PASS', n, d), fail: (n, d) => add('FAIL', n, d), warn: (n, d) => add('WARN', n, d),
    /** expect(name, condition, detailOnPass, detailOnFail) */
    expect(n, ok, dPass = '', dFail = dPass) { add(ok ? 'PASS' : 'FAIL', n, ok ? dPass : dFail); return ok; },
    summary() {
      const nf = rows.filter((r) => r.status === 'FAIL').length, nw = rows.filter((r) => r.status === 'WARN').length;
      return { rows, nf, nw, np: rows.length - nf - nw };
    },
  };
}

export function chromePath() {
  const cands = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  return cands.find((p) => existsSync(p));
}

// Headless Chromes at a time on this machine, across lanes and agents, adaptive by load: two slots always, a third
// while the 1 minute load is under 12, a fourth under 6. With CHESS_GL=metal (the GPU does the drawing): four under load 8, three under 16, else two. Each slot is a lock directory in the temp folder holding its
// owner's pid (slot 0 keeps the original lock name, so older checkouts still count). A lock whose pid is gone is stale
// and taken over. Released when the browser closes or the process exits.
const SLOTS = ['', '.1', '.2', '.3'].map((x) => join(tmpdir(), 'chess-3d-chrome.lock' + x));
export const defaultGl = () => {
  const want = process.env.CHESS_GL || (process.platform === 'darwin' && process.arch === 'arm64' ? 'metal' : 'swiftshader');   // GPU by default on Apple Silicon, CHESS_GL=swiftshader opts out
  return want === 'metal' ? 'metal' : 'swiftshader';
};
const metalOn = () => defaultGl() === 'metal';
/** Slots for a 1 minute load. With Metal (the GPU does the drawing): under 8 gives 4, under 16 gives 3, else 2. Without: under 6 gives 4, under 12 gives 3, else 2. */
export const slotsFor = (load, metal) => metal ? (load < 8 ? 4 : load < 16 ? 3 : 2) : (load < 6 ? 4 : load < 12 ? 3 : 2);
const allowedSlots = () => slotsFor(loadavg()[0], metalOn());
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
/** Slots free right now at this load (at least 0). Used by test/smoke-groups.mjs to size its parallelism. */
export const freeSlots = () => SLOTS.slice(0, allowedSlots()).filter((lock) => { try { return !alive(Number(readFileSync(join(lock, 'pid'), 'utf8'))); } catch (e) { return !existsSync(lock); } }).length;
// one entry per open browser: a process may hold several slots at once, each released with its own browser
const held = new Set();
const releaseLock = (lock) => { if (!held.delete(lock)) return; try { rmSync(lock, { recursive: true, force: true }); } catch (e) { /* ignore */ } };
process.on('exit', () => { for (const lock of [...held]) releaseLock(lock); });
async function acquireLock(maxWaitMs = 15 * 60 * 1000) {
  const t0 = Date.now(); let said = false;
  for (;;) {
    for (const lock of SLOTS.slice(0, allowedSlots())) {
      try { mkdirSync(lock); writeFileSync(join(lock, 'pid'), String(process.pid)); held.add(lock); return { lock, waited: (Date.now() - t0) / 1000 }; } catch (e) { /* taken */ }
      let pid = 0; try { pid = Number(readFileSync(join(lock, 'pid'), 'utf8')); } catch (e) { /* being written */ }
      if (pid && !alive(pid)) rmSync(lock, { recursive: true, force: true });
    }
    if (Date.now() - t0 > maxWaitMs) throw new Error(`all headless Chrome slots busy for over ${maxWaitMs / 60000} min`);
    if (!said) { console.log(`      waiting for a headless Chrome slot (${allowedSlots()} allowed at this load)`); said = true; }
    await sleep(1000);
  }
}

const GL_ARGS = {
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
  metal: ['--enable-gpu', '--use-angle=metal', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],   // swiftshader stays allowed as a fallback, the renderer log shows which one won
};
const logWait = (secs, gl) => { try { mkdirSync(join(ROOT, '.tmp'), { recursive: true }); appendFileSync(join(ROOT, '.tmp', 'chrome-waits.jsonl'), JSON.stringify({ t: new Date().toISOString(), script: process.argv[1] ? process.argv[1].split('/').slice(-2).join('/') : '', waitSecs: Math.round(secs * 10) / 10, load: Math.round(loadavg()[0] * 10) / 10, freePct: Math.round(freemem() / totalmem() * 100), slots: allowedSlots(), gl }) + '\n'); } catch (e) { /* ignore */ } };
async function logRenderer(browser) {
  try {
    const pg = await browser.newPage();
    const r = await pg.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const x = c && c.getExtension('WEBGL_debug_renderer_info'); return c ? (x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)) : 'no webgl'; });
    await pg.close();
    console.log(`      WebGL renderer (CHESS_GL=metal): ${r}`);
  } catch (e) { console.log('      WebGL renderer: unknown ' + e.message); }
}

/** The renderer string of the context the app itself uses (window.__chess.stage.renderer), else a probe canvas. Never throws. Call after the page is ready. */
export async function pageRenderer(page) {
  try {
    return await page.evaluate(() => {
      const r = window.__chess && window.__chess.stage && window.__chess.stage.renderer;
      const gl = r && r.getContext ? r.getContext() : document.createElement('canvas').getContext('webgl');
      if (!gl) return 'no webgl';
      const x = gl.getExtension('WEBGL_debug_renderer_info');
      return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
  } catch (e) { return 'unknown ' + String(e.message).slice(0, 60); }
}

/** Print the page's renderer once as proof; when the GPU was asked for and the page reports software, a WARN on the reporter R. Returns the string. */
export async function proveGpu(page, R, gl = defaultGl()) {
  const r = await pageRenderer(page);
  if (gl === 'metal' && /swiftshader|software|llvmpipe/i.test(r)) R.warn('page renders on the GPU', `the page reports ${r}`);
  else console.log(`      page renderer (${gl}): ${r}`);
  return r;
}

export async function launchBrowser({ w = 1280, h = 720, args = [], gl = defaultGl() } = {}) {
  const executablePath = chromePath();
  if (!executablePath) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(2); }
  let lock, waited = 0;
  try { ({ lock, waited } = await acquireLock()); } catch (e) { logWait(-1, gl); throw e; }
  logWait(waited, gl);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath, headless: true,
      args: [...GL_ARGS[gl], `--window-size=${w},${h}`, '--hide-scrollbars', ...args],
      defaultViewport: { width: w, height: h, deviceScaleFactor: 1 },
    });
    if (gl === 'metal') await logRenderer(browser);
  } catch (e) { releaseLock(lock); throw e; }
  const close = browser.close.bind(browser);
  // Chrome sometimes needs minutes to quit after a busy GPU run (seen: a group that printed its last line at 45 s and ended at 371 s). After 8 s the browser process this call started is killed by its own PID and its temp profile removed.
  browser.close = async () => {
    const proc = browser.process();
    let timer;
    try {
      await Promise.race([close(), new Promise((r) => { timer = setTimeout(r, 8000); })]);
      if (proc && proc.exitCode === null && !proc.killed) {
        proc.kill('SIGKILL');
        const dir = (proc.spawnargs.find((a) => a.startsWith('--user-data-dir=')) || '').slice(16);
        if (dir && dir.startsWith(tmpdir())) { await sleep(300); try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ } }
      }
    } finally { clearTimeout(timer); releaseLock(lock); }
  };
  browser.on('disconnected', () => releaseLock(lock));
  return browser;
}

/** Attach collectors to a page. Requests to hosts other than the given ones are recorded and aborted. */
export async function watchPage(page, hosts = ['127.0.0.1', 'localhost'], { scenes = false } = {}) {
  const w = { errs: [], warns: [], foreign: [] };
  // Battle scenes are promise driven and take game time: tests of rules and layout play with them Off unless the page
  // already has a stored choice. Pass { scenes: true } to keep the app default (On).
  if (!scenes) await page.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('chess3d.battle')) localStorage.setItem('chess3d.battle', '{"mode":"off","style":"gore"}'); } catch (e) { /* ignore */ } });
  page.on('console', (m) => {
    if (m.type() === 'error') w.errs.push('console: ' + m.text().slice(0, 200));
    else if (m.type() === 'warning') w.warns.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => w.errs.push('PAGEERR ' + String(e.message).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) w.errs.push(`HTTP ${r.status()} ${r.url().slice(0, 90)}`); });
  await page.setRequestInterception(true);
  page.on('request', (rq) => {
    const u = rq.url();
    if (/^(data|blob|about):/.test(u)) return rq.continue();
    let host = ''; try { host = new URL(u).hostname; } catch (e) { /* ignore */ }
    if (hosts.includes(host)) return rq.continue();
    w.foreign.push(u.slice(0, 100)); rq.abort();
  });
  return w;
}

// Build cache shared by all tiers and lanes. Key: sha1 over the content of every file that can change the build (git
// tracked and untracked under src, public, index.html, vite.config*, package.json, package-lock.json) plus `git ls-files -s`.
// Built once into ~/.cache/chess-3d/dist-<hash>, then copied into outDir with an APFS clone (cp -c, plain copy elsewhere).
const BUILD_INPUT = /^(src\/|public\/|index\.html$|vite\.config\.|package(-lock)?\.json$)/;
export function buildHash(cwd = ROOT) {
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const h = createHash('sha1');
  h.update(git('ls-files', '-s'));
  const files = [...new Set([...git('ls-files').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])].filter((f) => f && BUILD_INPUT.test(f)).sort();
  for (const f of files) { try { h.update(f + '\0'); h.update(readFileSync(join(cwd, f))); } catch (e) { h.update('missing'); } }
  return h.digest('hex').slice(0, 16);
}
// keep the 20 newest cached builds (owner approved the cache in ~/.cache/chess-3d, 2026-10-03, with this limit)
function pruneCache(dir) {
  try {
    const all = readdirSync(dir).filter((n) => /^dist-[0-9a-f]+$/.test(n)).map((n) => ({ n, t: statSync(join(dir, n)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const old of all.slice(20)) rmSync(join(dir, old.n), { recursive: true, force: true });
  } catch (e) { /* pruning is best effort */ }
}

/** Build into outDir (relative to cwd), from the cache when the inputs are unchanged. Returns the vite output, or a one line cache hit note. */
export function build(outDir, cwd = ROOT) {
  const out = resolve(cwd, outDir);
  let key = '';
  try { key = buildHash(cwd); } catch (e) { /* not a git checkout: build without the cache */ }
  const cache = key ? join(homedir(), '.cache', 'chess-3d', 'dist-' + key) : '';
  let log, hit = false;
  if (cache && existsSync(join(cache, 'index.html'))) hit = true;
  else if (cache) {
    const tmp = cache + '.' + process.pid;
    log = execFileSync(VITE(cwd), ['build', '--outDir', tmp, '--emptyOutDir'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    try { renameSync(tmp, cache); } catch (e) { rmSync(tmp, { recursive: true, force: true }); if (!existsSync(join(cache, 'index.html'))) throw e; }   // lost a race: the other build wins
    pruneCache(dirname(cache));
  } else return execFileSync(VITE(cwd), ['build', '--outDir', outDir, '--emptyOutDir'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(dirname(out), { recursive: true });
  try { execFileSync('cp', ['-cR', cache, out], { stdio: 'ignore' }); } catch (e) { rmSync(out, { recursive: true, force: true }); execFileSync('cp', ['-R', cache, out], { stdio: 'ignore' }); }
  const msg = hit ? `build cache hit dist-${key}` : `build cached as dist-${key}`;
  console.log('      ' + msg);
  return (log || '') + (hit ? msg + '\n' : '');
}

const children = new Set();
const killAll = () => { for (const c of children) { try { c.kill(); } catch (e) { /* ignore */ } } };
process.on('exit', killAll);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { killAll(); process.exit(130); });

const started = new Map();   // port -> child of a server this process started: the only kind startServer may reuse
/** True when something accepts connections on the port (any server, whatever it serves). */
export const portAnswers = (port) => new Promise((ok) => {
  const sock = connect({ port, host: '127.0.0.1' });
  const done = (v) => { sock.destroy(); ok(v); };
  sock.setTimeout(2000, () => done(true));   // a listener that never answers still owns the port
  sock.on('connect', () => done(true)); sock.on('error', () => done(false));
});
/** The first free port from `from` upward (the caller passed no port). */
export async function freePort(from = lanePorts().preview) {
  for (let p = from; p < from + 200; p++) if (!(await portAnswers(p))) return p;
  throw new Error(`no free port from ${from} to ${from + 199}`);
}

/** Claim a port for a server this process is about to start. Starts at the lane's own port (lanePorts: preview, or dev with
 *  { kind: 'dev' }) and takes the first one that neither answers nor is claimed by a live process. The claim is a lock folder in the
 *  temp folder holding { pid, lane, build, port }, taken atomically, so concurrent callers (also in one process) get different ports.
 *  Released with release() or when the process exits. Pass the port to startServer. */
export async function claimPort({ kind = 'preview', root = ROOT, span = 200 } = {}) {
  const lp = lanePorts(root), from = kind === 'dev' ? lp.dev : lp.preview;
  let build = ''; try { build = buildHash(root); } catch (e) { /* not a git checkout */ }
  for (let port = from; port < from + span; port++) {
    const lock = join(tmpdir(), `chess-3d-port.${port}`);
    try { mkdirSync(lock); } catch (e) {
      let pid = 0; try { pid = JSON.parse(readFileSync(join(lock, 'claim.json'), 'utf8')).pid; } catch (e2) { /* being written */ }
      if (pid && !alive(pid)) { rmSync(lock, { recursive: true, force: true }); port--; }   // stale: take it over on the next round
      continue;
    }
    if (await portAnswers(port)) { rmSync(lock, { recursive: true, force: true }); continue; }   // something we did not start owns it
    writeFileSync(join(lock, 'claim.json'), JSON.stringify({ pid: process.pid, lane: lp.lane, build, port }));
    claimed.add(lock);
    return { port, lane: lp.lane, build, release() { if (claimed.delete(lock)) rmSync(lock, { recursive: true, force: true }); } };
  }
  throw new Error(`no free ${kind} port from ${from} to ${from + span - 1}`);
}
const claimed = new Set();
process.on('exit', () => { for (const lock of claimed) { try { rmSync(lock, { recursive: true, force: true }); } catch (e) { /* ignore */ } } });

/** mode 'preview' serves outDir with vite preview, mode 'dev' runs the dev server. Resolves { base, port, stop }.
 *  A port that answers is reused only when this process started that server; anything else on it (another lane, a stale
 *  server, a foreign program) is an error naming the port. Without a port the next free one is taken. */
export async function startServer({ mode = 'preview', port, outDir = 'dist', cwd = ROOT, subPath = '' }) {
  const explicit = port !== undefined && port !== null;
  if (!explicit) port = await freePort(mode === 'dev' ? lanePorts().dev : lanePorts().preview);
  const base = `http://127.0.0.1:${port}${subPath || '/'}`;
  const mine = started.get(port);
  if (mine && mine.child.exitCode === null && !mine.child.killed) {
    if (mine.mode !== mode || mine.outDir !== resolve(cwd, outDir) || mine.subPath !== subPath) throw new Error(`port ${port} is held by a server this run started with other settings (${mine.mode} ${mine.outDir}${mine.subPath}); stop it first or use another port.`);
    return { base, port, stop() {} };   // the owner of the first start stops it
  }
  if (await portAnswers(port)) throw new Error(`port ${port} is already in use by a server this run did not start (another lane, a stale server or another program). Stop it or pass another port; refusing to reuse it.`);
  const baseArg = subPath ? ['--base', subPath] : [];   // for example '/chess-3d/', like GitHub Pages
  const args = mode === 'dev' ? ['--port', String(port), '--strictPort', '--host', '127.0.0.1', ...baseArg]
    : ['preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1', '--outDir', outDir, ...baseArg];
  const child = spawn(VITE(cwd), args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  started.set(port, { child, mode, outDir: resolve(cwd, outDir), subPath });
  const forget = () => { children.delete(child); if (started.get(port)?.child === child) started.delete(port); };
  let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
  let exited = false; child.on('exit', () => { exited = true; forget(); });
  for (let i = 0; i < 80; i++) {
    if (exited) throw new Error(`vite ${mode} exited early (port ${port} busy?): ${log.trim().split('\n').slice(-3).join(' | ')}`);
    try { const r = await fetch(base); if (r.ok) return { base, port, stop() { try { child.kill(); } catch (e) { /* ignore */ } forget(); } }; } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  child.kill(); forget();
  throw new Error(`vite ${mode} did not answer on ${base}`);
}

/** Wait for the app's ready signal (window.__chessReady, or window.__chessError when boot failed), the one every tier uses.
 *  Resolves { ready, error, ms, why }: why is empty when ready, else what it still waited for at the timeout. Never throws. */
export async function waitReady(page, { timeout = 120000 } = {}) {
  const t = Date.now();
  let timedOut = false;
  try { await page.waitForFunction(() => window.__chessReady || window.__chessError, { timeout, polling: 100 }); } catch (e) { timedOut = true; }
  const ms = Date.now() - t;
  const st = await page.evaluate(() => ({
    ready: !!window.__chessReady, error: window.__chessError || null, doc: document.readyState, hook: !!window.__chess,
    step: (document.getElementById('loader-step') || {}).textContent || '', loaderDone: !!(document.getElementById('loader') || { classList: { contains: () => false } }).classList.contains('done'),
  })).catch(() => ({ ready: false, error: 'page gone', doc: '?', hook: false, step: '', loaderDone: false }));
  const why = st.ready ? '' : `${timedOut ? `no __chessReady after ${Math.round(ms / 1000)}s` : 'boot failed'}: document ${st.doc}, loader step "${st.step.slice(0, 60)}"${st.loaderDone ? ' (loader done)' : ''}, __chess ${st.hook ? 'present' : 'missing'}${st.error ? ', error ' + st.error.slice(0, 120) : ''}`;
  return { ready: st.ready, error: st.error, ms, why };
}

/** Which lane this checkout is: the worktree directory name, or '' for the main checkout. */
export function laneName(root = ROOT) {
  try {
    const git = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return resolve(root, git(['rev-parse', '--git-dir'])) !== resolve(root, git(['rev-parse', '--git-common-dir'])) ? basename(root) : '';
  } catch (e) { return ''; }
}
/** Ports for a checkout: a stable hash of the lane name into 5400 to 5498 (preview) and 5500 to 5598 (dev), the main checkout keeps 5303 and 5302.
 *  inLane is for tests; by default it is looked up with git. */
export function lanePorts(root = ROOT, inLane = !!laneName(root)) {
  if (!inLane) return { preview: 5303, dev: 5302, lane: '' };
  const h = parseInt(createHash('sha1').update(basename(root)).digest('hex').slice(0, 8), 16) % 99;   // 99, so the release check's PORT + 1 stays below the dev range
  return { preview: 5400 + h, dev: 5500 + h, lane: basename(root) };
}

/** decodeURIComponent that never throws: a hostile URL such as %%% comes back as it is. */
export function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
