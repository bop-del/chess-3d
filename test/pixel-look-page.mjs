// Pixelwelt rendered look checks (S61, CHE-166) in the real page: node test/pixel-look-page.mjs [--port=5354] [--base=<server>] [--shots=<dir>]
// Statistics and targeted scans only, no golden images. Quality High at device pixel ratio 2 (the setting of the owner's recording).
//   pond      the pixels over the water do not depend on what is behind it (frame with everything else hidden gives the same pixels)
//   posts     no plank ring and no corner posts (CHE-236), no surfaces at equal depth where the grass meets the board corners
//   hairline  orbit sweep (yaw 0 to 3 degrees, 0.1 steps, pitch 14, dist 16): no row of green pixels along the bottom edge of the
//             grass blocks, where a wrapped texture sample draws the green top row of the side texture
// Exit codes: 0 pass, 1 a check failed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5354').slice(7));
const SHOTS = (args.find((a) => a.startsWith('--shots=')) || '').slice(8);
const R = reporter();
const OUT = '.tmp/pixel-look-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  await page.goto(`${URL0}/?theme=pixel&island=oak&quality=high&manual=1&ai=0&hud=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  // helpers inside the page (a function, so the island variants below can set it up again after each load)
  const SETUP = () => {
    const C = window.__chess, T = C.THREE, D = Math.PI / 180;
    C.step(3); for (let i = 0; i < 30; i++) C.stage.render(0.2);
    const cv = document.querySelector('canvas'), off = document.createElement('canvas'), ox = off.getContext('2d', { willReadFrequently: true });
    const world = C.gimbal.getObjectByName('pixel-world'), island = world.getObjectByName('island');
    const meshes = []; C.gimbal.traverse((o) => { if (o.isMesh) meshes.push(o); }); C.game.root.traverse((o) => { if (o.isMesh && !meshes.includes(o)) meshes.push(o); });
    const rc = new T.Raycaster();
    const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };   // the raycaster ignores visibility
    const inWorld = (o) => { for (let p = o; p; p = p.parent) if (p === world) return true; return false; };
    const H = {};
    H.view = (yaw, pitch, dist) => { C.controls.setCamera({ yaw: yaw * D, pitch: pitch * D, dist }); C.step(0.0334, 30); };
    H.snap = () => { C.draw(); off.width = cv.width; off.height = cv.height; ox.drawImage(cv, 0, 0); return ox.getImageData(0, 0, cv.width, cv.height).data; };
    H.hit = (px, py) => { rc.setFromCamera(new T.Vector2((px + 0.5) / cv.width * 2 - 1, 1 - (py + 0.5) / cv.height * 2), C.stage.camera); const all = rc.intersectObjects(meshes.filter(shown), false); if (!all[0]) return undefined; all[0].ties = all.filter((x) => x.distance - all[0].distance < 1e-4).map((x) => x.object); return all[0]; };
    H.screen = (v) => { const p = v.clone().project(C.stage.camera); return [(p.x + 1) / 2 * cv.width, (1 - p.y) / 2 * cv.height]; };
    H.box = (mesh) => { const b = new T.Box3().setFromObject(mesh), xs = [], ys = []; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const [sx, sy] = H.screen(new T.Vector3(x, y, z)); xs.push(sx); ys.push(sy); } return [Math.max(0, Math.floor(Math.min(...xs))), Math.max(0, Math.floor(Math.min(...ys))), Math.min(cv.width, Math.ceil(Math.max(...xs))), Math.min(cv.height, Math.ceil(Math.max(...ys)))]; };
    // frame with and without a change: pixels the select(hit) accepts, largest channel difference
    H.compare = (target, select, change, undo, stride = 3, regions = null) => {
      const a = H.snap(), pts = [];
      for (const [x0, y0, x1, y1] of regions || [H.box(target)]) for (let y = Math.max(0, y0); y < Math.min(cv.height, y1); y += stride) for (let x = Math.max(0, x0); x < Math.min(cv.width, x1); x += stride) { const h = H.hit(x, y); if (h && select(h)) pts.push((y * cv.width + x) * 4); }
      change(); const b = H.snap(); undo();
      let max = 0, over = 0;
      for (const i of pts) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > max) max = d; if (d > 8) over++; }
      return { n: pts.length, max, over, share: +(over / Math.max(1, pts.length)).toFixed(3) };
    };
    // pixels where two different surfaces lie at the same depth: the picture there is decided by rounding (z fighting)
    H.tied = (regions, stride) => { let n = 0, tied = 0; for (const [x0, y0, x1, y1] of regions) for (let y = Math.max(0, y0); y < Math.min(cv.height, y1); y += stride) for (let x = Math.max(0, x0); x < Math.min(cv.width, x1); x += stride) { const h = H.hit(x, y); if (!h) continue; n++; if (new Set(h.ties.filter(inWorld).map((o) => o.uuid)).size > 1) tied++; } return { n, tied }; };
    H.hideAllBut = (keep) => { const was = meshes.map((m) => m.visible); meshes.forEach((m) => { if (!keep(m)) m.visible = false; }); return () => meshes.forEach((m, i) => { m.visible = was[i]; }); };
    H.world = { island, meshes };
    window.__H = H;
  };
  await page.evaluate(SETUP);
  // pond
  const pond = [];
  for (const [yaw, pitch, dist] of [[180, 35, 19], [150, 25, 19], [215, 45, 17], [200, 30, 22]]) {
    pond.push(await page.evaluate((v) => {
      const H = window.__H; H.view(...v);
      const water = H.world.island.getObjectByName('water');
      let undo;
      return H.compare(water, (h) => h.object === water, () => { undo = H.hideAllBut((m) => m === water); }, () => undo(), 8);
    }, [yaw, pitch, dist]));
  }
  const pn = pond.reduce((s, r) => s + r.n, 0), pm = Math.max(...pond.map((r) => r.max));
  R.expect('pond: the pixels over the water do not depend on what is behind it', pn > 500 && pond.every((r) => r.share < 0.15), `${pn} pixels in ${pond.length} views, largest difference ${pm} (edge pixels only, the rest equal)`, `${pn} pixels, largest difference ${pm}, views ${JSON.stringify(pond)}`);
  // posts (CHE-236): no frame left, the grass reaches the squares; no two surfaces at the same depth around the four board corners
  const posts = [];
  for (const yaw of [35, 125, 215, 305]) {
    posts.push(await page.evaluate((yaw) => {
      const H = window.__H; H.view(yaw, 28, 9);
      const T = window.__chess.THREE, regions = [[-4, -4], [4, -4], [-4, 4], [4, 4]].map(([x, z]) => { const [sx, sy] = H.screen(window.__chess.gimbal.localToWorld(new T.Vector3(x, 0, z))); return [sx - 90, sy - 90, sx + 90, sy + 90]; });
      return H.tied(regions, 2);
    }, yaw));
  }
  const noFrame = await page.evaluate(() => { const H = window.__H, w = window.__chess.themes.world; return !H.world.island.getObjectByName('planks') && !w.frame && !w.group.userData.frame; });
  const tied = posts.reduce((s, r) => s + r.tied, 0);
  R.expect('posts: no plank ring, no frame fold, no two surfaces at the same depth at the board corners', noFrame && tied === 0, `no frame, ${tied} pixels at equal depth in 4 views`, `noFrame ${noFrame}, ${tied} pixels at equal depth, ${JSON.stringify(posts)}`);
  // hairline
  const SETUP_HAIR = () => {
    const H = window.__H, T = window.__chess.THREE, grass = H.world.island.getObjectByName('grassSide');
    if (!grass) { H.edges = []; return; }   // an island variant without grass block sides (CHE-106)
    const pos = grass.geometry.attributes.position, nor = grass.geometry.attributes.normal;
    const edges = [];
    for (let q = 0; q + 3 < pos.count; q += 4) if (nor.getZ(q) > 0.9) edges.push([grass.localToWorld(new T.Vector3().fromBufferAttribute(pos, q)), grass.localToWorld(new T.Vector3().fromBufferAttribute(pos, q + 1))]);
    H.edges = edges;
    // one frame: along the bottom edge of every grass block face that is not covered, the share of green pixels per row (8 above to 8 below; the dirt and the grass side texture have no green pixel at the block bottom, a wrapped sample is a green row)
    H.hairFrame = (yaw) => {
      H.view(yaw, 14, 16);
      const img = H.snap(), W = window.__chess.stage.renderer.domElement.width;
      let worst = 0, samples = 0;
      const pts = [];   // samples off screen are not valid: they would read the wrapped pixel of the next row
      for (const [a, b] of edges) {
        const [ax, ay] = H.screen(a), [bx, by] = H.screen(b);
        for (let s = 0; s <= 24; s++) { const t = s / 24, x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t), h = H.hit(x, y + 6); pts.push([x, y, x >= 0 && x < W && y >= 8 && y < img.length / 4 / W - 8 && !!h && (h.object.name === 'grassSide' || h.object.name === 'dirt') && h.point.z > 3]); }
      }
      for (let e = 0; e < edges.length; e++) for (let dy = -8; dy <= 8; dy++) {
        let ok = 0, green = 0;
        for (let s = 0; s <= 24; s++) {
          const [x, y, v] = pts[e * 25 + s]; if (!v) continue;
          ok++; const k = ((y + dy) * W + x) * 4; if (img[k + 1] > img[k] + 6 && img[k + 1] > img[k + 2] + 25) green++;
        }
        samples += ok;
        if (ok >= 8 && green / ok > 0.25) worst = Math.max(worst, green / ok);
      }
      return [yaw, samples, +worst.toFixed(2)];
    };
  };
  await page.evaluate(SETUP_HAIR);
  const frames = [];
  for (let i = 0; i <= 30; i++) frames.push(await page.evaluate((y) => window.__H.hairFrame(y), +(i * 0.1).toFixed(1)));
  const seen = frames.reduce((s, f) => s + f[1], 0), bad = frames.filter((f) => f[2] > 0);
  R.expect('hairline: no green row along the bottom of the grass blocks while orbiting', seen > 1000 && bad.length === 0, `${seen} samples in 31 frames`, `${seen} samples, frames with a green row (yaw, samples, share): ${JSON.stringify(bad)}`);
  // CHE-220/222: the tree never vanishes and never scales. Yaw 0 to 330 times pitch 2 to 89 times distance 6, 19, 40: visible at
  // scale 1 and drawn (the pixels differ from a frame with the tree hidden) in most cameras that look at it; `treeCovers` counts the
  // cameras where its screen hull meets the board hull (CHE-222: 92 of 216 before the move to the far corner)
  const tree = await page.evaluate(() => {
    const H = window.__H, C = window.__chess, world = C.themes.world, foot = world.group.getObjectByName('tree-foot'), D = Math.PI / 180;
    let cams = 0, gone = [], drawn = 0, small = 0, covers = 0;
    for (const yaw of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) for (const pitch of [2, 10, 25, 46, 70, 89]) for (const dist of [6, 19, 40]) {
      C.controls.setCamera({ yaw: yaw * D, pitch: pitch * D, dist }); C.step(0.2, 30); world.settle(); C.stage.camera.updateMatrixWorld();
      cams++;
      if (world.avoid.treeCovers) covers++;
      if (!foot.visible || foot.scale.x !== 1 || world.avoid.treeHidden) { gone.push([yaw, pitch, dist, +foot.scale.x.toFixed(2)]); continue; }
            const a = H.snap().slice(); foot.visible = false; const b = H.snap(); foot.visible = true;
      let diff = 0; for (let i = 0; i < a.length; i += 16) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) > 30) diff++;
      if (diff > 3) drawn++;
    }
    return { cams, gone: gone.slice(0, 5), goneN: gone.length, drawn, small, covers };
  });
  R.expect('tree: visible at scale 1 in every camera of the sweep', tree.goneN === 0, `${tree.cams} cameras, ${tree.goneN} not at scale 1`, JSON.stringify(tree));
  R.expect('tree: covers the board hull in clearly fewer cameras than the 92 before CHE-222', tree.covers <= 70, `${tree.covers} of ${tree.cams} cameras`);
  R.expect('tree: drawn on screen in the cameras that look at it', tree.drawn > tree.cams * 0.3, `${tree.drawn} of ${tree.cams} cameras`);
  // CHE-222: the waterfall stands over the pond's back edge and runs down; the pond drifts toward it (a top face's v grows toward -z)
  const fall = await page.evaluate(() => {
    const world = window.__chess.themes.world, mesh = world.group.getObjectByName('island').getObjectByName('fall'), T = world.kit.T;
    if (!mesh) return { mesh: false };
    const b = new window.__chess.THREE.Box3().setFromObject(mesh), f0 = T.fall.offset.y, w0 = T.water.offset.y;
    window.__chess.step(0.4, 30);
    return { mesh: true, top: +b.max.y.toFixed(2), bottom: +b.min.y.toFixed(2), zBack: +b.min.z.toFixed(2), down: (T.fall.offset.y - f0 + 1) % 1 > 0 && (T.fall.offset.y - f0 + 1) % 1 < 0.5, pond: (w0 - T.water.offset.y + 1) % 1 > 0 && (w0 - T.water.offset.y + 1) % 1 < 0.5 };
  });
  R.expect('waterfall: a sheet over the back edge of the pond, running down, the pond drifting toward it', fall.mesh && fall.bottom < -4 && fall.top > -0.5 && fall.down && fall.pond, JSON.stringify(fall));
  // CHE-106: the five island variants behind ?island=a..e. Each one loads and renders (canvas not blank, the island group is there and
  // is not today's, no page error) and, where it has grass block sides, shows no green hairline row while orbiting a little.
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    await page.goto(`${URL0}/?theme=pixel&island=${id}&quality=high&manual=1&ai=0&hud=0&intro=0&view=white`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.evaluate(() => { const C = window.__chess; C.step(3); for (let i = 0; i < 30; i++) C.stage.render(0.2); });
    await page.evaluate(SETUP); await page.evaluate(SETUP_HAIR);
    const r = await page.evaluate(() => {
      const H = window.__H, img = H.snap(), seen = new Set(); let nonSky = 0;
      for (let i = 0; i < img.length; i += 4 * 97) seen.add((img[i] >> 4) << 8 | (img[i + 1] >> 4) << 4 | img[i + 2] >> 4);
      const world = window.__chess.themes.world, isl = world.group.getObjectByName('island');
      return { colors: seen.size, island: !!isl, boxes: isl?.userData.boxes.length || 0, edges: H.edges.length };
    });
    R.expect(`island ${id}: loads and renders (canvas not blank, island group built)`, r.colors > 60 && r.island && r.boxes > 300, `${r.colors} colours, ${r.boxes} island boxes`);
    if (r.edges) {
      const fr = [];
      for (let i = 0; i <= 6; i++) fr.push(await page.evaluate((y) => window.__H.hairFrame(y), +(i * 0.1).toFixed(1)));
      const bad = fr.filter((f) => f[2] > 0);
      R.expect(`island ${id}: no green row along the bottom of the grass blocks while orbiting`, bad.length === 0, `${fr.reduce((a, f) => a + f[1], 0)} samples in ${fr.length} frames`, JSON.stringify(bad));
    }
  }
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    for (const [name, v] of [['pond', [180, 35, 14]], ['posts', [35, 28, 7]], ['tray', [0, 55, 13]]]) {
      const url = await page.evaluate((v) => { window.__H.view(...v); window.__chess.draw(); return document.querySelector('canvas').toDataURL('image/png'); }, v);
      writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
  }
  R.expect('no console error or warning', w.errs.length === 0, '', w.errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.stop(); }
const s = R.summary();
console.log(s.nf ? '\nPIXEL LOOK FAILED' : '\nPIXEL LOOK PASSED');
process.exit(s.nf ? 1 : 0);
