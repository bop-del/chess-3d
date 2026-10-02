// Phone tier, part 1: screenshots and layout audits at five iPhone sizes (headless Chrome, touch emulation, software GL).
// Usage: node tools/phoneshots.mjs [--skip-build] [--port=5306] [--only=portrait,se] [--dpr=3]
//   Builds into .tmp/phone-dist, serves it on port 5306 and, for each size, loads the page with quality=low&manual=1&ai=0&touch=1
//   and takes five shots into .tmp/phone-shots/<size>/ : start, selected (a real tap on e2), drawer (Controls tapped), help, promo.
//   Simulated safe area insets (portrait 47 top 34 bottom, landscape 47 left and right 21 bottom, the short sizes keep the side
//   insets and drop the bottom one) go through CDP Emulation.setSafeAreaInsetsOverride. One contact sheet per size follows.
// Audits per size, on every shot, duplicates merged:
//   tap targets      visible button, select, input, [role=button], .card header under 44 x 44 CSS px: WARN (M3 flips TAP_TARGET_FAILS)
//   text size        visible text under 11 CSS px: WARN
//   clipping         visible HUD elements reaching outside the viewport: WARN
//   page errors      console errors, page errors, foreign requests: FAIL
//   blank canvas     the 3D canvas is flat after draw(): FAIL
// Exit codes: 0 pass (warnings allowed), 1 a check failed, 2 usage or setup error.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, reporter, launchBrowser, watchPage, startServer, build, sleep } from './_lib.mjs';
import { contactSheets } from './contact-sheet.mjs';

// M3 switches the tap target audit from WARN to FAIL by flipping this one constant.
const TAP_TARGET_FAILS = false;
const TAP_MIN = 44, TEXT_MIN = 11;

const SIZES = {
  portrait: { w: 390, h: 844, inset: [0, 47, 0, 34] },     // left, top, right, bottom in CSS px
  landscape: { w: 844, h: 390, inset: [47, 0, 47, 21] },
  short290: { w: 844, h: 290, inset: [47, 0, 47, 0] },     // Safari tab with the bars up: the toolbar covers the home indicator
  short260: { w: 740, h: 260, inset: [47, 0, 47, 0] },
  se: { w: 667, h: 375, inset: [0, 0, 0, 21] },
};
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const QUERY = 'quality=low&manual=1&ai=0&touch=1';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const flag = (n) => args.includes(`--${n}`);
const known = /^--(skip-build|port=\d+|only=[a-z0-9,]+|dpr=\d+)$/;
const names = opt('only', '') ? opt('only').split(',') : Object.keys(SIZES);
if (args.some((a) => !known.test(a)) || names.some((n) => !SIZES[n])) {
  console.error(`usage: node tools/phoneshots.mjs [--skip-build] [--port=5306] [--only=${Object.keys(SIZES).join(',')}] [--dpr=3]`);
  process.exit(2);
}
const PORT = Number(opt('port', 5306)), DPR = Number(opt('dpr', 3));
const DIST = '.tmp/phone-dist', SHOTS = join(ROOT, '.tmp/phone-shots');
const R = reporter();
const t0 = Date.now();

// ------------------------------------------------------------------ in page audits (serialised into the page, so self contained)
const auditTap = (min) => {
  const out = [];
  const vis = (e) => {
    let el = e, op = 1;
    while (el && el !== document.documentElement) { const cs = getComputedStyle(el); op *= +cs.opacity; if (cs.visibility === 'hidden' || cs.display === 'none') op = 0; el = el.parentElement; }
    return op >= 0.05 && e.getClientRects().length > 0;
  };
  for (const e of document.querySelectorAll('button, select, input, [role=button], .card > header')) {
    if (e.hidden || e.disabled || e.type === 'hidden' || !vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    if (r.width < min - 0.5 || r.height < min - 0.5) {
      const name = e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : ''}`;
      const txt = (e.textContent || e.getAttribute('aria-label') || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 14);
      out.push(`${name} "${txt}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return out;
};
const auditText = (min) => {
  const out = new Set();
  for (const e of document.querySelectorAll('#hud *, #promo *, #banner *, #toast, #notice')) {
    let own = ''; for (const n of e.childNodes) if (n.nodeType === 3) own += n.textContent;
    own = own.trim(); if (!own) continue;
    let el = e, op = 1;
    while (el && el !== document.documentElement) { const cs = getComputedStyle(el); op *= +cs.opacity; if (cs.visibility === 'hidden' || cs.display === 'none') op = 0; el = el.parentElement; }
    if (op < 0.05 || !e.getClientRects().length) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < min) out.add(`${e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : '')} "${own.replace(/\s+/g, ' ').slice(0, 16)}" ${fs.toFixed(1)}px`);
  }
  return [...out];
};
const auditClip = () => {
  const out = new Set();
  const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
  for (const e of document.querySelectorAll('#hud .card, #hud button, #hud .help, #promo .promo-card, #banner .banner-card, #toast, #notice')) {
    if (e.hidden) continue;
    let el = e, op = 1;
    while (el && el !== document.documentElement) { const cs = getComputedStyle(el); op *= +cs.opacity; if (cs.visibility === 'hidden' || cs.display === 'none') op = 0; el = el.parentElement; }
    if (op < 0.05 || !e.getClientRects().length) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) {
      out.add(`${e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : '')} ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)} in ${W}x${H}`);
    }
  }
  return [...out];
};
// Draw one frame and read the canvas in the same task (no preserved drawing buffer needed). A flat image means blank.
const canvasStats = () => {
  window.__chess.draw();
  const t = document.createElement('canvas'); t.width = 48; t.height = 48;
  const x = t.getContext('2d'); x.drawImage(document.getElementById('stage'), 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data;
  let min = 255, max = 0; const seen = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3; if (l < min) min = l; if (l > max) max = l;
    seen.add(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
  }
  return { min, max, colors: seen.size };
};

// ------------------------------------------------------------------ run
let server = null, browser = null;
const finish = async (code) => {
  try { await browser?.close(); } catch (e) { /* ignore */ }
  try { server?.stop(); } catch (e) { /* ignore */ }
  const s = R.summary();
  console.log(`\nphoneshots: ${s.rows.length} checks: ${s.np} pass, ${s.nw} warn, ${s.nf} fail (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(s.nf ? 'PHONESHOTS FAILED' : s.nw ? 'PHONESHOTS OK WITH WARNINGS' : 'PHONESHOTS OK');
  process.exit(code ?? (s.nf ? 1 : 0));
};
process.on('uncaughtException', (e) => { console.error('FAIL  uncaught', e && e.stack || e); R.fail('uncaught exception', String(e && e.message).slice(0, 200)); finish(1); });

try {
  if (!flag('skip-build')) {
    const tb = Date.now();
    build(DIST);
    R.pass('vite build', `${((Date.now() - tb) / 1000).toFixed(1)}s`);
  }
  server = await startServer({ mode: 'preview', port: PORT, outDir: DIST });
  R.pass('preview server up', server.base);
} catch (e) {
  console.error('setup failed:', String(e && e.message || e).slice(0, 400));
  await finish(2);
}

try {
  mkdirSync(SHOTS, { recursive: true });
  browser = await launchBrowser({ w: 844, h: 390 });
  for (const name of names) {
    const { w, h, inset } = SIZES[name];
    const dir = join(SHOTS, name);
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) if (f.endsWith('.png')) rmSync(join(dir, f));
    const F = { tap: new Set(), text: new Set(), clip: new Set() };
    const page = await browser.newPage();
    try {
      await page.setUserAgent(UA);
      await page.setViewport({ width: w, height: h, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
      const watch = await watchPage(page);
      const cdp = await page.createCDPSession();
      let insetOk = true;
      try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: inset[0], top: inset[1], right: inset[2], bottom: inset[3] } }); }
      catch (e) { insetOk = false; R.warn(`${name} safe area insets`, 'override not available: ' + String(e.message).slice(0, 80)); }

      const load = async (extra = '') => {
        await page.goto(`${server.base}?${QUERY}${extra}`, { waitUntil: 'load', timeout: 120000 });
        await page.waitForFunction('window.__chessReady === true || !!window.__chessError', { timeout: 120000 });
        const err = await page.evaluate(() => window.__chessError);
        if (err) throw new Error('page reported: ' + err);
        await page.evaluate(() => { window.__chess.step(1.5); window.__chess.draw(); });
        await sleep(400);
      };
      const shot = async (label) => {
        await page.evaluate(() => { window.__chess.step(0.6); window.__chess.draw(); });
        await sleep(350);   // CSS transitions run on the real clock
        for (const k of await page.evaluate(auditTap, TAP_MIN)) F.tap.add(k);
        for (const k of await page.evaluate(auditText, TEXT_MIN)) F.text.add(k);
        for (const k of await page.evaluate(auditClip)) if (![...F.clip].some((x) => x.startsWith(k))) F.clip.add(`${k} (first seen: ${label})`);
        const s = await page.evaluate(canvasStats);
        const detail = `range ${s.min.toFixed(0)}-${s.max.toFixed(0)}, ${s.colors} colors`;
        R.expect(`${name} ${label} canvas not blank`, s.max - s.min > 12 && s.colors > 8, detail, 'flat canvas: ' + detail);
        await page.screenshot({ path: join(dir, `${label}.png`) });
      };
      const tapEl = async (sel) => {
        const p = await page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
        if (!p) return false;
        await page.touchscreen.tap(p.x, p.y); await sleep(450); return true;
      };

      // start position
      await load();
      const ins = await page.evaluate(() => ({ vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, touch: document.body.classList.contains('touch'), phone: document.body.classList.contains('phone') }));
      R.expect(`${name} emulation`, ins.vw === w && ins.vh === h && ins.dpr === DPR && ins.touch, `${ins.vw}x${ins.vh} @${ins.dpr}, touch ${ins.touch}, phone ${ins.phone}, safe area ${insetOk ? inset.join('/') : 'off'}`, `got ${JSON.stringify(ins)}`);
      await shot('start');

      // a piece selected by a real tap. The HUD can cover the board, so take the first white piece whose point is free
      // canvas and that the app's own picking resolves to that square.
      const tapPt = await page.evaluate(() => {
        const { THREE, stage, gimbal, pick } = window.__chess;
        const r = document.getElementById('stage').getBoundingClientRect();
        const order = [4, 3, 5, 2, 6, 1, 7, 0];
        for (const rank of [1, 0]) for (const f of order) {
          const v = new THREE.Vector3(f - 3.5, 0.35, 3.5 - rank); gimbal.localToWorld(v); v.project(stage.camera);
          const x = r.left + ((v.x + 1) / 2) * r.width, y = r.top + ((1 - v.y) / 2) * r.height;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          if (document.elementFromPoint(x, y)?.id !== 'stage') continue;
          if (pick(x, y) !== rank * 8 + f) continue;
          return { x, y, name: 'abcdefgh'[f] + (rank + 1) };
        }
        // nothing free: say what sits on e2 (an invisible element, opacity 0 up the tree, still taking taps is the usual culprit)
        const v = new THREE.Vector3(0.5, 0.35, 2.5); gimbal.localToWorld(v); v.project(stage.camera);
        const e = document.elementFromPoint(r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height);
        let op = 1; for (let n = e; n && n !== document.documentElement; n = n.parentElement) op *= +getComputedStyle(n).opacity;
        return { blocked: e ? `${e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : '')}${op < 0.05 ? ' (invisible, opacity 0, still takes the tap)' : ''}${e.closest('.tools') ? ' inside .tools' : ''}` : 'nothing' };
      });
      if (tapPt.blocked) { R.warn(`${name} tap selects a piece`, `no white piece is tappable, e2 is covered by ${tapPt.blocked}; used ?select=e2 for the shot`); await load('&select=e2'); }
      else {
        await page.touchscreen.tap(tapPt.x, tapPt.y); await sleep(300);
        const sel = await page.evaluate(() => window.__chess.game.getState().selected);
        if (!R.expect(`${name} tap selects ${tapPt.name}`, sel === tapPt.name, `selected ${sel}`, `selected ${sel}`)) await load('&select=e2');
      }
      await shot('selected');

      // Controls drawer (narrow layout)
      await load();
      const tapped = await tapEl('.drawer-btn');
      const open = await page.evaluate(() => !!document.querySelector('.col.left')?.classList.contains('open'));
      R.expect(`${name} Controls drawer opens by tap`, tapped && open, '', tapped ? 'drawer did not open' : 'no .drawer-btn visible');
      await shot('drawer');

      // help panel
      await load('&help=1');
      await shot('help');

      // promotion chooser: white pawn a7 to a8 from a bare position
      await load('&fen=4k3/P7/8/8/8/8/8/4K3%20w%20-%20-%200%201&promo=a7a8');
      const promoUp = await page.evaluate(() => { const p = document.getElementById('promo'); return !!p && !p.hidden && p.children.length > 0; });
      R.expect(`${name} promotion chooser shown`, promoUp, '', 'chooser not visible');
      await shot('promo');

      const bad = [...watch.errs, ...watch.foreign.map((u) => 'foreign ' + u)];
      R.expect(`${name} no page errors`, !bad.length, `${watch.warns.length} console warnings`, bad.slice(0, 3).join(' | '));
    } catch (e) {
      R.fail(`${name} run`, 'threw: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').slice(0, 300));
    } finally { await page.close().catch(() => {}); }

    const report = (set, status, what) => {
      if (!set.size) { R.pass(`${name} ${what}`, 'none'); return; }
      R[status.toLowerCase()](`${name} ${what}`, String(set.size));
      for (const k of [...set].sort()) console.log(`        ${k}`);
    };
    report(F.tap, TAP_TARGET_FAILS ? 'FAIL' : 'WARN', `tap targets under ${TAP_MIN}px`);
    report(F.text, 'WARN', `text under ${TEXT_MIN}px`);
    report(F.clip, 'WARN', 'clipped by the viewport');
  }

  for (const n of names) {
    try { for (const f of await contactSheets(browser, join(SHOTS, n), { cols: 3, width: 390 })) console.log(`      contact sheet: ${f.slice(ROOT.length + 1)}`); }
    catch (e) { R.warn('contact sheet', String(e.message).slice(0, 200)); }
  }
} catch (e) {
  R.fail('phoneshots', 'threw: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').slice(0, 300));
}
await finish();
