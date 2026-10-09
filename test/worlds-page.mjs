// Backdrop worlds in the real page (CHE-370): node test/worlds-page.mjs [--port=5356] [--base=<server>]
//   default   no ?world= flag: no world module, the studio floor shows, the fog keeps its usual distances (today's look unchanged)
//   build     each of hall, space, zen, lava builds: a world group in the gimbal, the floor hidden, the fog in the world's colour,
//             nothing inside the clear zone around the board and the capture areas, the page quiet
//   leaks     switching the quality between Low and Medium rebuilds the world (lite and full) three times: geometries and
//             textures come back to the same count; Pixelwelt removes the world, Classic brings it back
// GPU or software GL, ?manual=1. Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5356').slice(7));
const R = reporter();
const OUT = '.tmp/worlds-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const URL0 = BASE || `http://127.0.0.1:${PORT}`;
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const open = async (query) => {
    const page = await browser.newPage();
    const w = await watchPage(page);
    await page.setViewport({ width: 960, height: 640 });
    await page.goto(`${URL0}/?${query}&manual=1&ai=0&intro=0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
    await page.evaluate(async () => { await window.__chess.world?.ready; const C = window.__chess; C.step(0.5); C.draw(); });
    return { page, w };
  };
  // the world's state, measured in the page
  const state = (page) => page.evaluate(() => {
    const C = window.__chess, { stage, gimbal } = C, r = stage.renderer;
    const g = gimbal.children.find((o) => /^world-/.test(o.name));
    const d = stage.camera.position.length();
    // anything of the world inside the clear zone (|x| <= 7.2, |z| <= 6.8) above the ground, outside the dais under the board
    const bad = [];
    if (g) {
      // per vertex (merged ring meshes have a bounding box over the whole board), instances included
      g.updateMatrixWorld(true);
      const T = C.THREE, inv = gimbal.matrixWorld.clone().invert(), m = new T.Matrix4(), mi = new T.Matrix4(), v = new T.Vector3();
      g.traverse((o) => {
        if (!o.isMesh || !o.geometry || o.name === 'sky' || o.userData.ground || o.userData.shaderPlaced) return;   // shaderPlaced: billboards the vertex shader moves to their spots
        const p = o.geometry.attributes.position, n = o.isInstancedMesh ? o.count : 1;
        let worst = null;
        for (let k = 0; k < n; k++) {
          m.multiplyMatrices(inv, o.matrixWorld);
          if (o.isInstancedMesh) { o.getMatrixAt(k, mi); m.multiply(mi); }
          for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).applyMatrix4(m);
            if (Math.abs(v.x) > 7.2 || Math.abs(v.z) > 6.8 || v.y <= -1.15) continue;
            if (Math.abs(v.x) <= 4.6 && Math.abs(v.z) <= 4.6 && v.y <= -0.5) continue;   // the dais under the board
            if (!worst || v.y > worst.y) worst = v.clone();
          }
        }
        if (worst) bad.push(`${o.name || o.type} (${worst.x.toFixed(1)}, ${worst.y.toFixed(2)}, ${worst.z.toFixed(1)})`);
      });
    }
    return {
      world: C.world ? C.world.id : null, group: !!g, meshes: g ? g.children.length : 0, floor: stage.floor.visible,
      fogNear: +(stage.scene.fog.near - d).toFixed(2), fogFar: +(stage.scene.fog.far - d).toFixed(2), fog: stage.scene.fog.color.getHexString(),
      geos: r.info.memory.geometries, texs: r.info.memory.textures, quality: stage.quality, lite: C.world?.lite ?? null, bad: bad.slice(0, 4),
    };
  });
  const settle = (page) => page.evaluate(async () => { const C = window.__chess; await C.world?.ready; for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 30)); C.step(0.2); } C.draw(); });

  // default: no flag
  let { page, w } = await open('quality=low');
  let s = await state(page);
  R.expect('no flag: no world, the floor shows, the fog keeps d + 1.5 and d + 34', s.world === null && !s.group && s.floor && s.fogNear === 1.5 && s.fogFar === 34, JSON.stringify(s));
  R.expect('no flag: no worlds chunk was requested', !(await page.evaluate(() => performance.getEntriesByType('resource').some((e) => /\/(hall|space|zen|lava|worlds\/)/.test(e.name)))), 'none');
  R.expect('no flag: no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
  await page.close();

  for (const id of ['hall', 'space', 'zen', 'lava']) {
    ({ page, w } = await open(`world=${id}&quality=low`));
    s = await state(page);
    R.expect(`${id}: builds (lite), the floor hidden, its own fog colour`, s.world === id && s.group && s.meshes > 0 && !s.floor && s.lite === true && s.fog !== '000000', JSON.stringify({ meshes: s.meshes, floor: s.floor, lite: s.lite, fog: s.fog }));
    R.expect(`${id}: the clear zone around the board and the capture areas is free`, !s.bad.length, 'free', s.bad.join(' | '));
    // leaks: Low (lite) and Medium (full) three times, the counts at Low must match
    const counts = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__chess.stage.setQuality('medium')); await settle(page);
      const m = await state(page);
      if (i === 0) R.expect(`${id}: Medium builds the full world`, m.group && m.lite === false && !m.bad.length, JSON.stringify({ lite: m.lite, bad: m.bad }));
      await page.evaluate(() => window.__chess.stage.setQuality('low')); await settle(page);
      const l = await state(page); counts.push(`${l.geos}/${l.texs}`);
    }
    R.expect(`${id}: no leak over three rebuilds (geometries/textures at Low)`, new Set(counts).size === 1, counts[0], counts.join(' '));
    await page.evaluate(() => window.__chess.themes.set('pixel', { persist: false })); await settle(page);
    s = await state(page);
    R.expect(`${id}: Pixelwelt shows its own world, no backdrop world`, !s.group && !s.floor && s.fogNear === 1.5, JSON.stringify({ group: s.group, fogNear: s.fogNear }));
    await page.evaluate(() => window.__chess.themes.set('wood', { persist: false })); await settle(page);
    s = await state(page);
    R.expect(`${id}: a lit theme brings the world back`, s.group && !s.floor, JSON.stringify({ group: s.group, floor: s.floor }));
    R.expect(`${id}: no console error or warning`, !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
    await page.close();
  }
  // Options row (CHE-370): None plus four worlds; a pick builds without a reload, is stored, survives a reload; ?world= wins; Pixelwelt hides the row
  ({ page, w } = await open('quality=low'));
  const row = () => page.evaluate(() => { const r = document.querySelector('[data-pixlook="world"]'); return r ? { hidden: r.hidden || !r.offsetParent, values: [...r.querySelectorAll('button')].map((b) => b.dataset.value), on: r.querySelector('button.on')?.dataset.value } : null; });
  let r0 = await row();
  R.expect('Options: the World row has None, hall, space, zen, lava; None is on', !!r0 && r0.values.join() === 'none,hall,space,zen,lava' && r0.on === 'none', JSON.stringify(r0));
  for (const id of ['hall', 'space', 'zen', 'lava']) {
    await page.evaluate((v) => document.querySelector(`[data-pixlook="world"] button[data-value="${v}"]`).click(), id); await settle(page);
    s = await state(page);
    R.expect(`Options: picking ${id} builds it without a reload`, s.world === id && s.group && !s.floor, JSON.stringify({ world: s.world, group: s.group }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 }); await settle(page);
    s = await state(page);
    R.expect(`Options: ${id} survives a reload and is marked`, s.world === id && s.group && (await row()).on === id, JSON.stringify({ world: s.world, on: (await row())?.on }));
  }
  await page.goto(`${URL0}/?world=space&quality=low&manual=1&ai=0&intro=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 }); await settle(page);
  s = await state(page);
  R.expect('?world=space wins over the stored lava', s.world === 'space' && s.group, JSON.stringify({ world: s.world }));
  await page.evaluate(() => document.querySelector('[data-pixlook="world"] button[data-value="none"]').click()); await settle(page);
  s = await state(page);
  R.expect('Options: None removes the world and brings the floor back', !s.group && s.floor && s.fogNear === 1.5 && s.fogFar === 34, JSON.stringify({ group: s.group, floor: s.floor, fogNear: s.fogNear }));
  await page.evaluate(() => window.__chess.themes.set('pixel', { persist: false })); await settle(page);
  R.expect('Options: the World row hides with Pixelwelt', (await row()).hidden, 'hidden');
  R.expect('Options: no console error or warning', !w.errs.length && !w.warns.length, 'none', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
  await page.close();
  process.exitCode = R.summary().nf ? 1 : 0;
} finally {
  await browser.close();
  server.stop();
}
