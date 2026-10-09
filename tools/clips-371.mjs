// CHE-371 clips and stills of the Pixelwelt capture fights (all of them, they rotate per attacker type) and the checkmate finale.
//   node tools/clips-371.mjs [--base=http://127.0.0.1:5xxx] [--only=knight-a,finale-w] [--sheet] [--no-phone] [--black] [--gl=..]
// Default: a fresh build served on the lane's preview port, every fight and both finales, each as a 480 px wide H.264 mp4
// (until the camera is back, at most 6.5 s, 30 fps) plus a poster PNG and a 390x844 phone still, into .tmp/clips371/ with index.json.
// --sheet: no mp4, one contact sheet PNG per item (8 frames over the scene, 4 x 2) for a quick look (subagents use this).
// --black: the attacker is black (the side check), files get a -black suffix.
// Deterministic: ?manual=1, quality=high on the GPU renderer, __chess.stepAsync() and .draw() per frame.
// One headless Chrome through launchBrowser(), closed in finally.
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launchBrowser, startServer, build, lanePorts, ROOT } from './_lib.mjs';


const args = process.argv.slice(2);
const opt = (k, d = '') => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const has = (k) => args.includes(`--${k}`);
const OUT = join(ROOT, opt('out', '.tmp/clips371'));
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const SHEET = has('sheet'), PHONE = !has('no-phone'), BLACK = has('black');
const only = opt('only') ? opt('only').split(',') : null;
const FPS = 30, W = 960, H = 540;

// one capture per attacker type: white attacker in the middle of the board, a black victim
const FIGHT = {
  p: { fen: '4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', move: ['e4', 'd5'] },
  n: { fen: '4k3/8/8/4b3/8/5N2/8/4K3 w - - 0 1', move: ['f3', 'e5'] },
  b: { fen: '4k3/8/8/4n3/8/2B5/8/4K3 w - - 0 1', move: ['c3', 'e5'] },
  r: { fen: 'k7/8/8/4b3/8/8/K3R3/8 w - - 0 1', move: ['e2', 'e5'] },
  q: { fen: '4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1', move: ['d1', 'd5'] },
  k: { fen: '7k/8/8/4p3/4K3/8/8/8 w - - 0 1', move: ['e4', 'e5'] },
};
// the same with colours swapped (black attacks): mirror ranks, swap case, black to move
const mirrorFen = (fen) => { const [b, , ...rest] = fen.split(' '); const rows = b.split('/').reverse().map((r) => r.replace(/[a-z]/gi, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))); return [rows.join('/'), 'b', ...rest].join(' '); };
const mirrorSq = (sq) => sq[0] + (9 - Number(sq[1]));
// mate in one for each side (the finale from both sides)
const FINALES = [
  { id: 'finale-w', side: 'w', fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', move: ['a1', 'a8'], de: 'Weiß setzt matt: Feuerwerk aus Würfeln, der schwarze Turm wächst aus der Wiese, kippt und zerfällt, die Helden drehen sich zur Kamera und jubeln' },
  { id: 'finale-b', side: 'b', fen: 'r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', move: ['a8', 'a1'], de: 'Schwarz setzt matt: Feuerwerk aus Würfeln, der weiße Turm wächst aus der Wiese, kippt und zerfällt, die Monster drehen sich zur Kamera und jubeln' },
];

const sh = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'ignore', 'pipe'] });

async function main() {
  mkdirSync(OUT, { recursive: true });
  let base = opt('base').replace(/\/$/, ''), server = { stop() {} };
  if (!base) {
    const dist = join(ROOT, '.tmp', 'clips371-dist');
    build(dist);
    const port = lanePorts().preview;
    server = await startServer({ mode: 'preview', port, outDir: dist });
    base = `http://127.0.0.1:${port}`;
  }
  // the variant list comes from the page (fights.js), so this tool never goes out of step with the modules
  const browser = await launchBrowser({ w: W, h: H });
  const index = existsSync(join(OUT, 'index.json')) ? JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')) : [];
  const put = (e) => { const i = index.findIndex((x) => x.file === e.file); if (i >= 0) index[i] = e; else index.push(e); };
  try {
    const page = await browser.newPage();
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`   [page ${m.type()}] ${m.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => console.log(`   [page error] ${e.message}`));
    const open = async (q, vp) => {
      await page.setViewport(vp);
      await page.goto(`${base}/?${q}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction('window.__chessReady === true && !!window.__chess.stepAsync', { timeout: 120000 });
      await page.evaluate(async () => { const c = window.__chess; c.battle.settings.set({ mode: 'on', gore: true }); await c.battle.ready(); c.step(1.5); });
      await new Promise((r) => setTimeout(r, 1500));         // the loading veil fades in real time
    };
    // the dev server reloads the page when another agent saves a file: retry a load or an item up to three times
    const retry = async (what, fn) => { for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= 3) throw e; console.log(`   retry ${what} (${String(e.message || e).slice(0, 80)})`); } } };
    const list = await retry('variant list', async () => {
      await open('theme=pixel&quality=low&manual=1&ai=0&intro=0', { width: 480, height: 270 });
      const l = await page.evaluate(() => window.__pixfightVariants || null);
      if (!l) throw new Error('no variant list');
      return l;
    }).catch(() => null);
    const variants = list || [];
    const items = [
      ...variants.map((v) => ({ kind: 'fight', ...v })),
      ...FINALES.map((f) => ({ kind: 'finale', ...f, still: 2.2 })),
    ].filter((x) => !only || only.includes(x.id));
    if (!items.length) console.log('nothing to render (no variant matches --only)');

    for (const it of items) await retry(it.id, () => renderItem(it));
    async function renderItem(it) {
      const tag = it.id + (BLACK && it.kind === 'fight' ? '-black' : '');
      const f = it.kind === 'fight' ? FIGHT[it.attacker] : it;
      const fen = BLACK && it.kind === 'fight' ? mirrorFen(f.fen) : f.fen;
      const mv = BLACK && it.kind === 'fight' ? f.move.map(mirrorSq) : f.move;
      const q = new URLSearchParams({ theme: 'pixel', quality: 'high', manual: '1', ai: '0', intro: '0', hud: '0', fen });
      if (it.kind === 'fight') q.set('pixfight', it.id);                                    // the fights rotate by default: force this one
      const flags = it.kind === 'fight' ? `?theme=pixel&pixfight=${it.id}` : '?theme=pixel&ai=0';
      const t0 = Date.now();
      // ------------------------------------------------ frames
      const dir = join(OUT, `.frames-${tag}`);
      rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
      await open(q.toString(), { width: W, height: H, deviceScaleFactor: 1 });
      await page.evaluate((m) => window.__chess.game.move(m[0], m[1]), mv);
      // a finale starts some seconds after the mating move: run up to it fast, then record
      if (it.kind === 'finale') await page.evaluate(async () => { for (let i = 0; i < 300 && !window.__finale?.running; i++) await window.__chess.stepAsync(1 / 30); });
      // a sheet spreads 8 frames over a fixed window; an mp4 runs until the scene is over (the camera back), at most 6.5 s
      const total = it.kind === 'finale' ? 4.4 : SHEET ? 4.6 : 6.5;
      const frames = Math.round(total * FPS), every = SHEET ? Math.max(1, Math.floor(frames / 8)) : 1;
      let shot = 0, picked = '', tail = -1, posterAt = -1;
      for (let i = 0; i < frames; i++) {
        const { busy, st } = await page.evaluate(async () => { const c = window.__chess; await c.stepAsync(1 / 30); c.draw(); return { busy: c.game.busy || c.battle.active, st: c.battle.active ? c.battle.lastCtx?.time?.() ?? -1 : (window.__finale?.running ? window.__finale.t : -1) }; });
        if (posterAt < 0 && st >= (it.still || 1.5)) posterAt = Math.floor(i / every);        // the poster is the variant's key moment
        if (!SHEET && it.kind === 'fight' && i > 30) { if (!busy && tail < 0) tail = 12; if (tail >= 0 && tail-- === 0) break; }
        if (i % every) continue;
        const file = join(dir, `f${String(shot++).padStart(4, '0')}.png`);
        await page.screenshot({ path: file });
        if (!picked && it.kind === 'fight') picked = (await page.evaluate(() => window.__pixfight?.id)) || '';
      }
      if (it.kind === 'fight' && picked && picked !== it.id) console.log(`   WARN ${tag}: the page played ${picked}`);
      const poster = join(OUT, `${tag}.png`);
      if (SHEET) {
        sh(FFMPEG, ['-y', '-loglevel', 'error', '-i', join(dir, 'f%04d.png'), '-frames:v', '1', '-vf', 'scale=480:-2,tile=4x2', join(OUT, `${tag}-sheet.png`)]);
      } else {
        sh(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-vf', 'scale=480:-2:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-movflags', '+faststart', '-crf', '20', join(OUT, `${tag}.mp4`)]);
        const mid = String(Math.min(shot - 1, posterAt >= 0 ? posterAt : Math.round(shot * 0.45))).padStart(4, '0');
        sh(FFMPEG, ['-y', '-loglevel', 'error', '-i', join(dir, `f${mid}.png`), '-vf', 'scale=480:-2:flags=lanczos', poster]);
      }
      rmSync(dir, { recursive: true, force: true });
      // ------------------------------------------------ the phone still, at the variant's key moment (scene time)
      let phone = '';
      if (PHONE) {
        await open(q.toString(), { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        await page.evaluate((m) => window.__chess.game.move(m[0], m[1]), mv);
        await page.evaluate(async ({ kind, still }) => {
          const c = window.__chess;
          if (kind === 'finale') { for (let i = 0; i < 300 && !window.__finale?.running; i++) await c.stepAsync(1 / 30); for (let i = 0; i < 300 && (window.__finale?.t || 0) < still; i++) await c.stepAsync(1 / 30); }
          else for (let i = 0; i < 400; i++) { const ctx = c.battle.lastCtx; if (c.battle.active && ctx && ctx.time() >= still) break; await c.stepAsync(1 / 30); }
          c.draw();
        }, { kind: it.kind, still: it.still || 1.5 });
        phone = `${tag}-phone.png`;
        await page.screenshot({ path: join(OUT, phone) });
      }
      if (!SHEET) put({ file: `${tag}.mp4`, poster: `${tag}.png`, phone, kind: it.kind, variant: it.id, attacker: it.attacker || null, side: it.side || (BLACK ? 'b' : 'w'), flags, de: it.de || '' });
      console.log(`   ${tag}: ${SHEET ? `${tag}-sheet.png` : `${tag}.mp4`}${phone ? ` + ${phone}` : ''} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }

    if (!SHEET) writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  } finally {
    await browser.close();
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
