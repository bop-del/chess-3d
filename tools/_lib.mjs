// Shared helpers for the test and release tools (test/smoke.mjs, tools/release-check.mjs). Not a tool itself.
//   ROOT                     repo root
//   reporter()               PASS / FAIL / WARN rows printed as they come, plus summary(): { rows, nf, nw }
//   launchBrowser(opts)      headless Chrome through puppeteer-core with software GL (swiftshader) by default, so it runs anywhere;
//                            the GPU (ANGLE Metal) is the default on Apple Silicon, CHESS_GL=swiftshader opts out, and it logs the WebGL renderer once per launch ({ gl: 'swiftshader' } pins it, as the release check does).
//                            Waits for a machine wide slot first: two always, three under load 12, four under load 6 (four with metal).
//                            Every launch appends its slot wait to .tmp/chrome-waits.jsonl.
//   watchPage(page, hosts)   collects console errors and warnings, page errors and requests to foreign hosts (foreign requests are aborted); sets Battle scenes Off for the page unless { scenes: true }
//   startServer(opts)        vite preview of a built folder or the vite dev server, resolves when it answers
//   build(outDir)            vite build into outDir (inside a folder, never touches dist/), through a content hashed cache in ~/.cache/chess-3d/dist-<hash>
// Exit codes used by the tools: 0 pass (warnings allowed), 1 a check failed, 2 usage or setup error.
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir, loadavg, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
// while the 1 minute load is under 12, a fourth under 6 (always four with CHESS_GL=metal, the GPU does the drawing). Each slot is a lock directory in the temp folder holding its
// owner's pid (slot 0 keeps the original lock name, so older checkouts still count). A lock whose pid is gone is stale
// and taken over. Released when the browser closes or the process exits.
const SLOTS = ['', '.1', '.2', '.3'].map((x) => join(tmpdir(), 'chess-3d-chrome.lock' + x));
// the release check always renders in software, whatever CHESS_GL says
const defaultGl = () => {
  if (/release-check\.mjs$/.test(process.argv[1] || '')) return 'swiftshader';
  const want = process.env.CHESS_GL || (process.platform === 'darwin' && process.arch === 'arm64' ? 'metal' : 'swiftshader');   // GPU by default on Apple Silicon, CHESS_GL=swiftshader opts out
  return want === 'metal' ? 'metal' : 'swiftshader';
};
const metalOn = () => defaultGl() === 'metal';
const allowedSlots = () => { const l = loadavg()[0]; return l < 6 || (metalOn() && l < 12) ? 4 : l < 12 ? 3 : 2; };
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
const logWait = (secs, gl) => { try { mkdirSync(join(ROOT, '.tmp'), { recursive: true }); appendFileSync(join(ROOT, '.tmp', 'chrome-waits.jsonl'), JSON.stringify({ t: new Date().toISOString(), script: process.argv[1] ? process.argv[1].split('/').slice(-2).join('/') : '', waitSecs: Math.round(secs * 10) / 10, load: Math.round(loadavg()[0] * 10) / 10, gl }) + '\n'); } catch (e) { /* ignore */ } };
async function logRenderer(browser) {
  try {
    const pg = await browser.newPage();
    const r = await pg.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const x = c && c.getExtension('WEBGL_debug_renderer_info'); return c ? (x ? c.getParameter(x.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER)) : 'no webgl'; });
    await pg.close();
    console.log(`      WebGL renderer (CHESS_GL=metal): ${r}`);
  } catch (e) { console.log('      WebGL renderer: unknown ' + e.message); }
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
  browser.close = async () => { try { await close(); } finally { releaseLock(lock); } };
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

/** mode 'preview' serves outDir with vite preview, mode 'dev' runs the dev server. Resolves { base, stop }. */
export async function startServer({ mode = 'preview', port, outDir = 'dist', cwd = ROOT, subPath = '' }) {
  const baseArg = subPath ? ['--base', subPath] : [];   // for example '/chess-3d/', like GitHub Pages
  const args = mode === 'dev' ? ['--port', String(port), '--strictPort', '--host', '127.0.0.1', ...baseArg]
    : ['preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1', '--outDir', outDir, ...baseArg];
  const child = spawn(VITE(cwd), args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
  let exited = false; child.on('exit', () => { exited = true; });
  const base = `http://127.0.0.1:${port}${subPath || '/'}`;
  for (let i = 0; i < 80; i++) {
    if (exited) throw new Error(`vite ${mode} exited early (port ${port} busy?): ${log.trim().split('\n').slice(-3).join(' | ')}`);
    try { const r = await fetch(base); if (r.ok) return { base, stop() { try { child.kill(); } catch (e) { /* ignore */ } children.delete(child); } }; } catch (e) { /* not up yet */ }
    await sleep(250);
  }
  child.kill();
  throw new Error(`vite ${mode} did not answer on ${base}`);
}
