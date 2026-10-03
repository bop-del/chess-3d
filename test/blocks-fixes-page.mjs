// Blocks fixes and desktop polish in the real page: node test/blocks-fixes-page.mjs [--port=5353] [--base=<server>] [--shots=<dir>]
// The tree never covers a board square or the frame in any view (rays from the camera through every square and frame cell hit no
// tree), clouds never pass behind the status bar, hint bulb, thumb bar or view bar (rays through a grid on each control hit no cloud
// over time), the Captured text list of the desktop Play tab is hidden while the 3D trays are on and back with trays=0 or the switch
// off, the game review strip leaves the lower board frame free (1440x900, three views), the Blocks hint arrow has its dark outline
// and the other themes keep the quiet gold one, the block textures use mipmaps when minified (no moire on the corner posts).
// ai=0, manual=1, quality=low: time by __chess.step()/draw(). Exit codes: 0 pass, 1 a check failed.
import { mkdirSync } from 'node:fs';
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const PORT = Number(opt('port', 5353)), BASE = opt('base', '').replace(/\/$/, ''), SHOTS = opt('shots', '');
const R = reporter();
const OUT = '.tmp/blocks-fixes-dist';
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const DESK = { width: 1440, height: 900 }, PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 };
const VIEWS = ['white', 'black', 'top', 'side', 'iso', 'tokens', 'symbols', 'above', 'easy-3d'];
const MOVES = [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']];   // fool's mate for the review strip
const browser = await launchBrowser({ w: 1440, h: 900 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  const load = async (vp, query = '') => {
    await page.setViewport(vp);
    await page.goto(`${URL0}/?quality=low&manual=1&ai=0${vp.isMobile ? '&touch=1' : ''}${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.waitForFunction("document.getElementById('loader').classList.contains('done')");
  };
  const settle = (s = 2) => page.evaluate((n) => { const c = window.__chess; for (let i = 0; i < 10; i++) c.step(n / 10); c.draw(); }, s);

  // ---- the tree (F3): rays from the camera through every square centre and frame cell centre hit no tree mesh
  const treeCheck = () => page.evaluate(() => {
    const c = window.__chess, cam = c.stage.camera, V = c.THREE.Vector3, world = c.themes.world;
    const foot = world.group.getObjectByName('tree-foot');
    cam.updateMatrixWorld(); world.group.updateWorldMatrix(true, true);
    const meshes = []; foot.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const pts = [];
    for (let i = -5; i < 5; i++) for (let k = -5; k < 5; k++) pts.push([i + 0.5, k + 0.5]);   // squares and frame: the 10 x 10 block
    let hits = 0;
    const rc = new c.THREE.Raycaster();
    if (foot.visible) for (const [x, z] of pts) for (const y of [0, 0.6]) {
      const p = c.gimbal.localToWorld(new V(x, y, z));
      const camPos = new V().setFromMatrixPosition(cam.matrixWorld);
      const dir = p.clone().sub(camPos);
      if (cam.isOrthographicCamera) { const f = new V(); cam.getWorldDirection(f); rc.set(p.clone().sub(f.multiplyScalar(60)), f); } else rc.set(camPos, dir.clone().normalize());
      rc.far = cam.isOrthographicCamera ? 60 : dir.length();
      if (rc.intersectObjects(meshes, false).length) hits++;
    }
    return { visible: foot.visible, hits };
  });
  for (const [name, vp, q] of [['desktop', DESK, ''], ['phone', PHONE, '']]) {
    await load(vp, '&theme=blocks');
    const seen = [];
    for (const v of VIEWS) {
      await page.evaluate((x) => window.__chess.views.set(x, { instant: true, remember: false }), v);
      await settle(2);
      const r = await treeCheck();
      seen.push(`${v}:${r.visible ? 'shown' : 'hidden'}`);
      R.expect(`tree ${name} ${v}: covers no square and no frame cell`, r.hits === 0, r.visible ? 'tree shown, 0 rays blocked' : 'tree stepped aside', `${r.hits} rays hit the tree`);
    }
    R.expect(`tree ${name}: stays on the island in at least the White view and shrinks away in some other`, seen[0].endsWith('shown') && seen.some((s) => s.endsWith('hidden')), seen.join(' '));
  }
  // an oblique gimbal and an orbit through the whole circle
  await load(DESK, '&theme=blocks');
  let bad = 0, shown = 0;
  for (let yaw = 0; yaw < 360; yaw += 30) {
    await page.evaluate((y) => { const c = window.__chess; c.controls.setCamera({ yaw: y * Math.PI / 180, pitch: 38 * Math.PI / 180, dist: 17 }); }, yaw);
    await settle(1.5);
    const r = await treeCheck(); bad += r.hits; shown += r.visible ? 1 : 0;
  }
  R.expect('tree: a full turn of the camera (12 yaws) never covers the board', bad === 0 && shown > 0 && shown < 12, `${shown} of 12 yaws show the tree`, `hits ${bad}, shown ${shown}`);

  // ---- clouds (F4): rays through a grid on every control hit no visible cloud, over a long stretch of drift
  const cloudCheck = () => page.evaluate(() => {
    const c = window.__chess, cam = c.stage.camera, V = c.THREE.Vector3, world = c.themes.world;
    cam.updateMatrixWorld(); world.group.updateWorldMatrix(true, true);
    const clouds = world.group.children.filter((o) => o.name === 'cloud');
    const meshes = []; for (const g of clouds) if (g.visible && g.userData.mats[0].opacity > 0.05) g.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const rects = [...document.querySelectorAll('.pstatus, .pgood, .pbar, .viewbar')].filter((e) => e.offsetWidth).map((e) => e.getBoundingClientRect());
    const rc = new c.THREE.Raycaster(); let hits = 0, rays = 0;
    for (const r of rects) for (let x = r.left; x <= r.right; x += 10) for (let y = r.top; y <= r.bottom; y += 10) {
      rc.setFromCamera(new c.THREE.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), cam); rays++;
      if (rc.intersectObjects(meshes, false).length) hits++;
    }
    return { hits, rays, controls: rects.length, hiddenNow: clouds.filter((g) => g.userData.fade < 0.5).length };
  });
  for (const [name, vp, views] of [['phone', PHONE, ['play', 'easy-3d', 'above', 'tokens', 'black']], ['desktop', DESK, ['white', 'iso', 'above']]]) {
    await load(vp, '&theme=blocks');
    let hits = 0, rays = 0, everHid = 0;
    for (const v of views) {
      await page.evaluate((x) => window.__chess.views.set(x, { instant: true, remember: false }), v);
      for (let i = 0; i < 40; i++) {   // 40 x 4 s of drift per view, a cloud crosses a tenth of the sky
        await page.evaluate(() => { window.__chess.step(4); window.__chess.draw(); });
        const r = await cloudCheck(); hits += r.hits; rays += r.rays; everHid = Math.max(everHid, r.hiddenNow);
      }
    }
    R.expect(`clouds ${name}: none behind a control (${views.join(', ')})`, hits === 0 && rays > 0, `${rays} rays checked, 0 hit`, `${hits} of ${rays} rays hit a cloud`);
  }
  // a cloud really is put aside at a control: park one over the status bar and see it fade
  await load(PHONE, '&theme=blocks&view=easy-3d');
  const park = await page.evaluate(() => {
    const c = window.__chess, world = c.themes.world, cl = world.group.children.find((o) => o.name === 'cloud');
    const r = document.querySelector('.pstatus').getBoundingClientRect(), cam = c.stage.camera, T = c.THREE;
    // the point at height 6 over the island that the centre of the status bar looks at
    cam.updateMatrixWorld();
    const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2((r.left + r.width / 2) / innerWidth * 2 - 1, 1 - (r.top + r.height / 2) / innerHeight * 2), cam);
    const hit = new T.Vector3(); rc.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -6), hit);
    const p = world.group.worldToLocal(hit);
    cl.userData.speed = 0; cl.userData.x0 = p.x; cl.position.set(p.x, p.y, p.z);
    for (let i = 0; i < 12; i++) c.step(0.5);
    c.draw();
    return { fade: cl.userData.fade, visible: cl.visible };
  });
  R.expect('a cloud parked behind the status bar fades out', park.fade < 0.05 && !park.visible, JSON.stringify(park));

  // ---- the Captured list (CHE-95a)
  const capVisible = () => page.evaluate(() => { const e = document.querySelector('.cap-sec'); return !!e && e.offsetParent !== null; });
  await load(DESK, '&theme=blocks');
  R.expect('desktop Play tab: trays on, no Captured text list', !(await capVisible()) && (await page.evaluate(() => document.body.dataset.traysShown)) === 'on', 'hidden');
  await page.evaluate(() => { document.querySelector('[data-tp="play"]') || 0; });
  await load(DESK, '&theme=blocks&trays=0');
  R.expect('desktop Play tab: trays=0 shows the Captured list again', (await capVisible()) && (await page.evaluate(() => document.body.dataset.traysShown)) === 'off', 'visible');
  await page.evaluate(() => { document.querySelector('[data-trays]').click(); });
  R.expect('the switch back on hides it again', !(await capVisible()), 'hidden');
  await page.evaluate(() => { document.querySelector('[data-trays]').click(); });
  R.expect('and off shows it (stored per device)', await capVisible(), 'visible');
  await page.evaluate(() => localStorage.clear());
  if (SHOTS) { await load(DESK, '&theme=blocks'); await settle(1); await page.screenshot({ path: `${SHOTS}/captured-trays-on.png` }); await load(DESK, '&theme=blocks&trays=0'); await settle(1); await page.screenshot({ path: `${SHOTS}/captured-trays-off.png` }); }

  // ---- the review strip (CHE-95b): the lowest corner of the frame on screen is above the strip
  for (const [theme, view] of [['classic', 'white'], ['blocks', 'black'], ['blocks', 'iso']]) {
    await load(DESK, `&theme=${theme}&view=${view}`);
    await page.evaluate((mv) => { for (const [a, b] of mv) window.__chess.game.move(a, b); }, MOVES);
    for (let i = 0; i < 20 && !(await page.evaluate(() => !!document.getElementById('bn-review-game') && !document.getElementById('banner').hidden)); i++) await settle(0.5);
    await page.evaluate(() => document.getElementById('bn-review-game').click());
    await settle(3);
    await new Promise((r) => setTimeout(r, 400));
    const m = await page.evaluate(() => {
      const c = window.__chess, cam = c.stage.camera, V = c.THREE.Vector3; cam.updateMatrixWorld();
      const lows = [-5, 5].flatMap((x) => [-5, 5].map((z) => { const v = c.gimbal.localToWorld(new V(x, 0, z)).project(cam); return (1 - v.y) / 2 * innerHeight; }));
      const r = document.querySelector('.rv').getBoundingClientRect();
      return { low: Math.max(...lows), top: r.top, hidden: document.querySelector('.rv').hidden };
    });
    R.expect(`review strip ${theme} ${view} 1440x900: the lower frame edge stays above the strip`, !m.hidden && m.low <= m.top, `frame ${Math.round(m.low)} px, strip ${Math.round(m.top)} px`, JSON.stringify(m));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/review-${theme}-${view}.png` });
  }
  // closing the review gives the board its room back
  const fitDuring = await page.evaluate(() => window.__chess.controls.frame.bottom);
  await page.evaluate(() => document.querySelector('.rv-close').click());
  await settle(1);
  const fitAfter = await page.evaluate(() => window.__chess.controls.frame.bottom);
  R.expect('closing the review frees the bottom inset again', fitDuring > 100 && fitAfter === 0, `${fitDuring} px then ${fitAfter}`);

  // ---- hint arrow and move markers (g5)
  await load(DESK, '&theme=blocks&view=white');
  const arrowLook = () => page.evaluate(() => {
    const h = window.__chess.openings.hint; h.force?.(true); h.show(11, 27); window.__chess.step(0.1); window.__chess.draw();
    const ms = h.group.children; return { outline: ms.filter((m) => m.visible && m.material.opacity > 0.5 && m.material.color.getHex() === 0x10131a).length, arrow: ms.map((m) => m.material.color.getHex().toString(16)) };
  });
  const b = await arrowLook();
  R.expect('Blocks: the hint arrow has its dark outline', b.outline === 1, JSON.stringify(b));
  await page.evaluate(async () => { await window.__chess.themes.set('classic', { persist: false }); });
  const k = await arrowLook();
  R.expect('Classic: the hint stays the quiet gold arrow, no outline', k.outline === 0 && k.arrow.includes('d8b468'), JSON.stringify(k));
  await page.evaluate(async () => { await window.__chess.themes.set('blocks', { persist: false }); });
  R.expect('and back in Blocks the outline returns', (await arrowLook()).outline === 1, 'outline on');
  if (SHOTS) { await settle(1); await page.screenshot({ path: `${SHOTS}/hint-blocks.png` }); }

  // ---- no moire on the corner posts (g7): block textures are mipmapped when minified
  const tex = await page.evaluate(() => { const T = window.__chess.themes.world.kit.T; return Object.entries(T).filter(([k, t]) => !['vox', 'cloud'].includes(k)).map(([k, t]) => [k, t.minFilter, t.generateMipmaps, t.magFilter]); });
  const LMM = 1008, NEAREST = 1003;   // THREE.LinearMipmapLinearFilter, THREE.NearestFilter
  R.expect('block textures: trilinear mipmaps when minified, nearest up close', tex.length > 10 && tex.every(([, min, gen, mag]) => min === LMM && gen && mag === NEAREST), `${tex.length} textures`, JSON.stringify(tex.filter(([, min]) => min !== LMM)));

  // ---- the loader's step line (Ready) over the island (F11): a calm pill in Blocks, unchanged in the other themes
  const pill = async (theme) => {
    await load(DESK, `&theme=${theme}`);
    return page.evaluate(() => { const l = document.getElementById('loader'); l.classList.remove('done'); l.classList.add('live'); const e = document.getElementById('loader-step'); return { world: l.dataset.world, bg: getComputedStyle(e).backgroundColor }; });
  };
  const pb = await pill('blocks');
  R.expect('Blocks: the Ready line sits on a dark pill', pb.world === 'blocks' && /rgba\(14, 16, 22, 0\.78\)/.test(pb.bg), JSON.stringify(pb));
  for (const t of ['classic', 'wood', 'metal', 'glass', 'tournament']) { const p = await pill(t); R.expect(`${t}: the Ready line is unchanged (no backing)`, p.world === t && /rgba\(0, 0, 0, 0\)|transparent/.test(p.bg), JSON.stringify(p)); }

  R.expect('no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 5).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
