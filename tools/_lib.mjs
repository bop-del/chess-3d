// Shared helpers for the test and release tools (test/smoke.mjs, tools/release-check.mjs). Not a tool itself.
//   ROOT                     repo root
//   reporter()               PASS / FAIL / WARN rows printed as they come, plus summary(): { rows, nf, nw }
//   launchBrowser(opts)      headless Chrome through puppeteer-core with software GL (swiftshader), so it runs anywhere.
//                            Waits for a machine wide slot first: two always, three under load 10, four under load 6.
//   watchPage(page, hosts)   collects console errors and warnings, page errors and requests to foreign hosts (foreign requests are aborted); sets Battle scenes Off for the page unless { scenes: true }
//   startServer(opts)        vite preview of a built folder or the vite dev server, resolves when it answers
//   build(outDir)            vite build into outDir (inside a folder, never touches dist/)
// Exit codes used by the tools: 0 pass (warnings allowed), 1 a check failed, 2 usage or setup error.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, loadavg } from 'node:os';
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
// while the 1 minute load is under 10, a fourth under 6. Each slot is a lock directory in the temp folder holding its
// owner's pid (slot 0 keeps the original lock name, so older checkouts still count). A lock whose pid is gone is stale
// and taken over. Released when the browser closes or the process exits.
const SLOTS = ['', '.1', '.2', '.3'].map((x) => join(tmpdir(), 'chess-3d-chrome.lock' + x));
const allowedSlots = () => { const l = loadavg()[0]; return l < 6 ? 4 : l < 10 ? 3 : 2; };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
let held = null;
const releaseLock = () => { if (!held) return; const d = held; held = null; try { rmSync(d, { recursive: true, force: true }); } catch (e) { /* ignore */ } };
process.on('exit', releaseLock);
async function acquireLock(maxWaitMs = 15 * 60 * 1000) {
  const t0 = Date.now(); let said = false;
  for (;;) {
    for (const lock of SLOTS.slice(0, allowedSlots())) {
      try { mkdirSync(lock); writeFileSync(join(lock, 'pid'), String(process.pid)); held = lock; return; } catch (e) { /* taken */ }
      let pid = 0; try { pid = Number(readFileSync(join(lock, 'pid'), 'utf8')); } catch (e) { /* being written */ }
      if (pid && !alive(pid)) rmSync(lock, { recursive: true, force: true });
    }
    if (Date.now() - t0 > maxWaitMs) throw new Error(`all headless Chrome slots busy for over ${maxWaitMs / 60000} min`);
    if (!said) { console.log(`      waiting for a headless Chrome slot (${allowedSlots()} allowed at this load)`); said = true; }
    await sleep(1000);
  }
}

export async function launchBrowser({ w = 1280, h = 720, args = [] } = {}) {
  const executablePath = chromePath();
  if (!executablePath) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(2); }
  await acquireLock();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath, headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', `--window-size=${w},${h}`, '--hide-scrollbars', ...args],
      defaultViewport: { width: w, height: h, deviceScaleFactor: 1 },
    });
  } catch (e) { releaseLock(); throw e; }
  const close = browser.close.bind(browser);
  browser.close = async () => { try { await close(); } finally { releaseLock(); } };
  browser.on('disconnected', releaseLock);
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

/** Build into outDir (relative to cwd). Returns the combined vite output. */
export function build(outDir, cwd = ROOT) {
  return execFileSync(VITE(cwd), ['build', '--outDir', outDir, '--emptyOutDir'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }) ;
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
