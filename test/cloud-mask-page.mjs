// Cloud mask (CHE-159) in the real page: node test/cloud-mask-page.mjs [--port=5356] [--base=<server>] [--shots=<dir>]
// No cloud is drawn over the board or a figure, in Pixelwelt, for a sweep of cameras (the five presets, then yaw 0 to 330
// in steps of 30 times pitch 2 to 89 times distance 6, 19, 40, each after 6 s of drift). Each camera: one frame with the clouds, one with
// the cloud groups hidden, and the pixels over the board (hull of the frame square) and over every figure (projected box) must be the same.
// The check has to bite: with the fix switched off (world.avoid.boardAvoid = false) the same sweep must find clouds over the board in
// at least one camera. The clouds must still be there as sky: some camera sees a visible cloud on screen.
// Exit codes: 0 pass, 1 a check failed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5356').slice(7));
const SHOTS = (args.find((a) => a.startsWith('--shots=')) || '').slice(8);
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
const R = reporter();
const COVER = 64;   // a cloud over a pixel changes it by 200 or more; below that is the post process glow of the bright cloud (bloom), not a cloud over the board
const OUT = '.tmp/cloud-mask-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const browser = await launchBrowser({ w: 960, h: 540 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 1 });
  for (const theme of ['pixel']) {
    await page.goto(`${URL0}/?theme=${theme}&sky=evening&backdrop=none&quality=low&manual=1&ai=0&hud=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step && !!window.__chess.themes.world', { timeout: 120000 });
    const sweep = (fixOn) => page.evaluate((fixOn, COVER) => {
      const C = window.__chess, T = C.THREE, D = Math.PI / 180, world = C.themes.world, cv = document.querySelector('canvas');
      world.avoid.boardAvoid = fixOn;
      const clouds = world.group.children.filter((o) => o.name === 'cloud');
      const off = document.createElement('canvas'), ox = off.getContext('2d', { willReadFrequently: true });
      const snap = () => { C.draw(); off.width = cv.width; off.height = cv.height; ox.drawImage(cv, 0, 0); return ox.getImageData(0, 0, cv.width, cv.height).data; };
      const scr = (x, y, z) => { const p = new T.Vector3(x, y, z).project(C.stage.camera); return [(p.x + 1) / 2 * cv.width, (1 - p.y) / 2 * cv.height]; };
      const inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > y) !== (poly[j][1] > y) && x < (poly[j][0] - poly[i][0]) * (y - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
      const cams = Object.values(C.controls.constructor === Object ? {} : {}).length ? [] : [];
      const list = [];
      for (const p of [[0, 46, 19], [180, 46, 19], [0, 89.4, 19.5], [0, 7, 20], [45, 35.264, 20]]) list.push(p);
      for (const yaw of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) for (const pitch of [2, 10, 25, 46, 70, 89]) for (const dist of [6, 19, 40]) list.push([yaw, pitch, dist]);
      let cameras = 0, worst = 0, badCams = [], pixels = 0, noise = 0, skyCams = 0;
      for (const [yaw, pitch, dist] of list) {
        C.controls.setCamera({ yaw: yaw * D, pitch: pitch * D, dist }); C.step(0.2, 30);
        world.settle(); C.stage.camera.updateMatrixWorld();
        const a = snap().slice(), a2 = snap().slice();
        const was = clouds.map((c) => c.userData.mats.map((m) => m.opacity)); clouds.forEach((c) => c.userData.mats.forEach((m) => { m.opacity = 0; }));   // opacity, not visible: a hidden cloud changes the shadow fit
        const b = snap().slice(); clouds.forEach((c, i) => c.userData.mats.forEach((m, k) => { m.opacity = was[i][k]; }));
        const W = cv.width, Hh = cv.height;
        const board = [[-4.5, -4.5], [4.5, -4.5], [4.5, 4.5], [-4.5, 4.5]].map(([x, z]) => scr(x, 0, z));
        const rects = [];
        const bx = board.map((p) => p[0]), by = board.map((p) => p[1]);
        rects.push([Math.min(...bx), Math.min(...by), Math.max(...bx), Math.max(...by), board]);
        C.game.root.traverse((o) => { if (o.userData?.dia && o.visible) { const bb = new T.Box3().setFromObject(o), xs = [], ys = []; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { const [sx, sy] = scr(x, y, z); xs.push(sx); ys.push(sy); } rects.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), null]); } });
        let maxd = 0, over = 0, n = 0, noisy = 0, dx0 = 1e9, dx1 = 0, dy0 = 1e9, dy1 = 0;
        for (const [x0, y0, x1, y1, poly] of rects) for (let y = Math.max(0, Math.floor(y0)); y < Math.min(Hh, y1); y += 2) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, x1); x += 2) {
          if (poly && !inside(poly, x, y)) continue;
          n++; const i = (y * W + x) * 4;
          if (Math.max(Math.abs(a[i] - a2[i]), Math.abs(a[i + 1] - a2[i + 1]), Math.abs(a[i + 2] - a2[i + 2])) > 8) { noisy++; continue; }   // not steady from frame to frame
          if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > COVER) { over++; maxd = Math.max(maxd, Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); dx0 = Math.min(dx0, x); dx1 = Math.max(dx1, x); dy0 = Math.min(dy0, y); dy1 = Math.max(dy1, y); }
        }
        cameras++; pixels += n; noise += noisy;
        if (over > 0) { badCams.push([yaw, pitch, dist, over, [dx0, dy0, dx1, dy1].join(',') + ' max' + maxd, clouds.filter((c) => c.visible).map((c) => +c.userData.fade.toFixed(2)).join('/')]); worst = Math.max(worst, over); }
        if (clouds.some((c) => c.visible && c.userData.fade > 0.5)) skyCams++;
      }
      return { cameras, pixels, worst, noise, bad: badCams.length, first: badCams.slice(0, 4), skyCams };
    }, fixOn, COVER);
    const on = await sweep(true);
    R.expect(`${theme}: no cloud over the board or a figure in ${on.cameras} cameras`, on.bad === 0 && on.pixels > 100000, `${on.pixels} pixels checked`, JSON.stringify(on));
    R.expect(`${theme}: the clouds still show as sky`, on.skyCams > on.cameras * 0.5, `${on.skyCams} of ${on.cameras} cameras show a cloud`);
    const bite = await sweep(false);
    R.expect(`${theme}: the check bites (fix off: clouds over the board in some cameras)`, bite.bad >= 5, `${bite.bad} of ${bite.cameras} cameras, first ${JSON.stringify(bite.first)}`);
    await sweep(true);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      for (const [name, v] of [['low', [20, 6, 14]], ['side', [0, 7, 20]], ['high', [0, 46, 19]]]) {
        const url = await page.evaluate((v) => { const C = window.__chess; C.controls.setCamera({ yaw: v[0] * Math.PI / 180, pitch: v[1] * Math.PI / 180, dist: v[2] }); C.step(0.2, 30); C.themes.world.settle(); C.draw(); return document.querySelector('canvas').toDataURL('image/png'); }, v);
        writeFileSync(`${SHOTS}/${theme}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
      }
    }
  }
  R.expect('no console error or warning', w.errs.length === 0, '', w.errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.stop(); }
const s = R.summary();
console.log(s.nf ? '\nCLOUD MASK FAILED' : '\nCLOUD MASK PASSED');
process.exit(s.nf ? 1 : 0);
